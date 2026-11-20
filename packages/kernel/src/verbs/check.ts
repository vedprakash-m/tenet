// `check`: run the obligations and turn what happened into receipts, counters, attention items and the next step.
// The run happens outside the lock (prepare, execute, finalize); the response is rebuilt from the observed result.
import { attemptsLeft, LIMITS, timeUp } from "../core/budget.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { parseWorkload, WORKLOAD_FILE } from "../core/fitness.ts";
import type { ParsedWorkload } from "../core/fitness.ts";
import { declaredInputs } from "../core/obligations.ts";
import { reason } from "../core/reasons.ts";
import { CheckInput } from "../core/schemas.ts";
import type { Question, Reason, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan, Verb } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { grantQuestion } from "./authority.ts";
import { finalizeCheck } from "./check-finalize.ts";
import { checkEnvelopeGate } from "./check-envelope.ts";
import { isWorkload } from "./check-evidence.ts";
import type { Run } from "./check-evidence.ts";
import { execute } from "./check-execute.ts";
import { outputsProblem } from "./check-outputs.ts";
import { nx, withWork, workOf } from "./common.ts";
import { observeToolchain } from "./check-rerun.ts";
import {
  dirtyQuestion, leftOutChanged, observeDirtyTransitions, settleCleaned, undecidedDirty,
} from "./dirty.ts";
import { modelQuestion, needsModelAnswer } from "./model-limit.ts";
import { checkInputId, gather, unauthorizedEdits, worldDigest } from "./facts.ts";
import { boundRecipeCoverage } from "../core/alternative-check.ts";
import { coverageDefinitionHash } from "../core/alternative-check.ts";
import { settingsFor, unsupportedExecution } from "./reconcile.ts";

const refuse = (code: "capability-missing" | "stale-session" | "continue-required", why: string): never => {
  throw new KernelError(code, why, { exit: 2 });
};
const safePath = (p: string) => !p.startsWith("/") && !p.split("/").includes("..");

function admittedToolchain(ports: Ports) {
  const observed = observeToolchain(ports);
  if (!observed.available)
    throw new KernelError("capability-missing", "the installed toolchain cannot be admitted; no check was launched", { exit: 2 });
  return observed;
}

function admittedRun(ports: Ports, run: Omit<Run, "toolchain" | "versions">): Run {
  const observed = admittedToolchain(ports);
  return { ...run, toolchain: observed.hash, versions: observed.versions };
}

export function admitCoverageDefinitions(ports: Ports, coverage: ReturnType<typeof boundRecipeCoverage>): void {
  const paths = [...new Set(coverage.flatMap((mapping) => [
    mapping.primary.config, mapping.primary.file, ...mapping.primary.support,
    mapping.alternative.config, mapping.alternative.file, ...mapping.alternative.support,
  ]))];
  const hashes = ports.project.hashes(paths);
  for (const mapping of coverage) {
    const primary = coverageDefinitionHash(
      mapping.primary, hashes[mapping.primary.config] ?? "", hashes[mapping.primary.file] ?? "",
      Object.fromEntries(mapping.primary.support.map((path) => [path, hashes[path] ?? ""])),
    );
    const alternative = coverageDefinitionHash(
      mapping.alternative, hashes[mapping.alternative.config] ?? "", hashes[mapping.alternative.file] ?? "",
      Object.fromEntries(mapping.alternative.support.map((path) => [path, hashes[path] ?? ""])),
    );
    if (primary !== mapping.primaryDefinitionHash || alternative !== mapping.alternativeDefinitionHash) {
      throw new KernelError(
        "evidence-inconclusive",
        `coverage mapping ${mapping.id} no longer matches its reviewed test and config files`,
        { exit: 2 },
      );
    }
  }
}

/** Every reason the kernel refuses to launch a check at all, before anything is written. */
function admit(ports: Ports, cur: State, w: WorkContract, input: CheckInput, inputs: readonly string[]) {
  if (!w.basis) refuse("continue-required", "record a basis with decide before checking");
  const unavailable = unsupportedExecution(ports, cur, w);
  if (unavailable.length)
    refuse(
      "capability-missing",
      `execution of ${unavailable.slice(0, 3).join(", ")} is not implemented; no substitute check was run`
    );
  const exclusions = settingsFor(ports, cur, w).exclusions as Exclusion[];
  const unreadable = inputs.filter((path) => !allowed("read", path, exclusions, { kind: "routine-inventory" }));
  if (unreadable.length)
    refuse(
      "capability-missing",
      `excluded evidence inputs cannot be verified from stat alone: ${unreadable.slice(0, 3).join(", ")}; no check was launched`
    );
  const detected = ports.stack.detect(ports.root);
  ports.stack.assertSupportedConfiguration(ports.root);
  if (!detected.runnerSupported || !detected.depsInstalled) {
    if (detected.runnerVersion)
      throw new KernelError(
        "adapter-unsupported-version",
        `Vitest ${detected.runnerVersion} is outside the supported adapter range; no check was launched`,
        { exit: 2 }
      );
    refuse("capability-missing", "a supported installed test runner is required; no check was launched");
  }
  // Finished work can still be rechecked on the integrated tree; nothing else reopens it.
  if (
    ["finished", "cancelled", "superseded"].includes(w.state) &&
    !(w.state === "finished" &&
      (input.stage === "integrated" || (w.git.noCommit && input.stage === "candidate")))
  )
    refuse("stale-session", `this work is ${w.state}`);
  if (input.stage === "candidate" && !input.targeted && (!attemptsLeft(w.budget, w.lane) || w.stopReason)) {
    throw new KernelError(
      w.stopReason === "repeated-failure" ? "repeated-failure" : "budget-exhausted",
      "No candidate attempt remains. Finish with the current evidence and handoff.",
      { exit: 2 }
    );
  }
  if (input.stage === "candidate" && !input.targeted && timeUp(w.budget, w.lane, ports.clock.now())) {
    const n = LIMITS[w.lane].minutes;
    const ask = `Tell the user what is done and what remains, and propose another ${n} minutes; record their yes with decide extend.`;
    throw new KernelError("budget-exhausted", `Active work time reached ${n} minutes since the last check-in.`, {
      exit: 2, next: [nx("ask", ask, true)],
    });
  }
}

/** The files this call declares as Tenet's, the existing files it declares as baseline scaffolding, and any it
 * declares as a TDD-03 negative control (declared, never inferred). */
function declare(w: WorkContract, input: CheckInput): WorkContract {
  const touched = (input.touched ?? []).filter(safePath).filter((p) => !w.touched.some((t) => t.path === p));
  const scaffold = (input.scaffold ?? []).filter(safePath);
  const alongside = (input.alongside ?? []).filter(safePath);
  return {
    ...w,
    touched: [...w.touched, ...touched.map((path) => ({ path }))],
    ...(scaffold.length ? { scaffolding: [...new Set([...(w.scaffolding ?? []), ...scaffold])] } : {}),
    ...(alongside.length ? { alongside: [...new Set([...(w.alongside ?? []), ...alongside])] } : {}),
  };
}

/** A question that stops the check: the contract is saved with it so the next call sees what was declared. */
function ask(cur: State, w: WorkContract, q: Question, reasons: Reason[], why: string): Plan {
  return {
    state: withWork({ ...cur, pending: [...cur.pending.filter((p) => p.id !== q.id), q] }, w),
    resp: { work: w.id, exit: 3, questions: [q], reasons, next: [nx("ask", why, true)] },
  };
}

/** The declaration, read only when this run owes the workload; an unreadable file is a named problem, not an abort. */
function readWorkload(ports: Ports): ParsedWorkload {
  try { return parseWorkload(ports.project.read(WORKLOAD_FILE)); } catch (e) {
    return { ok: false, problem: `${WORKLOAD_FILE} cannot be read: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200) };
  }
}

function shapeRun(ports: Ports, state: State, w: WorkContract, input: CheckInput, facts: Run["facts"]) {
  const baseline = input.stage === "baseline";
  const scope: Run["scope"] = baseline || input.targeted ? "targeted" : "full";
  const acceptance = w.obligations.filter((o) => o.testFile);
  const present = (f: string) => facts.inv.entries.has(f);
  const files = acceptance.filter((o) => !o.coverageTag).map((o) => o.testFile!).filter(present);
  return {
    baseline,
    scope,
    toRun: scope === "full" ? w.obligations : acceptance,
    ...(scope === "full" && w.obligations.some(isWorkload) ? { workload: readWorkload(ports) } : {}),
    missing: acceptance.filter((o) => !present(o.testFile!)),
    toExecute: scope === "full" ? ("all" as const) : files,
    id: checkInputId(ports, w, facts.candidate),
    coverage: boundRecipeCoverage(state, w.id, w.basis?.hash ?? ""),
  };
}

export const check: Verb<CheckInput> = {
  name: "check",
  schema: CheckInput,
  class: () => "mutating",
  identity: worldDigest,
  editing: () => true,

  async run(ports, state0, input): Promise<Plan> {
    if (input.stage === "committed")
      refuse("capability-missing", "committed-tree checks are not implemented; check the working-tree candidate instead");
    const cur = state0!;
    const w0 = workOf(cur, input.h);
    const inputs = declaredInputs(w0.obligations);
    admit(ports, cur, w0, input, inputs);
    if (cur.pending.length)
      return {
        resp: { work: w0.id, exit: 3, questions: cur.pending, next: [nx("ask", "Answer the open question first.", true)] },
      };

    const declared = declare(w0, input);
    let facts = await gather(ports, declared);
    const settled = settleCleaned(declared, new Set(facts.att.changed));
    const w = observeDirtyTransitions(settled, facts.inv, input.touched ?? [], ports.clock.now());
    if (w !== declared) facts = await gather(ports, w);
    const leftOut = leftOutChanged(w, (p) => facts.inv.entries.get(p)?.blob);
    if (leftOut.length) {
      const why = `${leftOut.join(", ")} changed, but the user asked to leave it out; restore it or ask the user`;
      throw new KernelError("attribution-mixed-file", why, { exit: 2 });
    }
    const undecided = undecidedDirty(w, facts.inv);
    if (undecided.length)
      return ask(
        cur,
        w,
        dirtyQuestion(w, facts.inv, ports.rand.base32(12), undecided),
        [reason("attribution-mixed-file", undecided.join(", "))],
        "Ask the user what happens to their edits."
      );
    const unusable = await outputsProblem(ports, w);
    if (unusable) refuse("capability-missing", unusable);
    const linked = inputs.filter((path) => facts.inv.entries.get(path)?.mode === "120000");
    if (linked.length)
      refuse(
        "capability-missing",
        `linked evidence inputs cannot be verified from their link spelling: ${linked.slice(0, 3).join(", ")}; no check was launched`
      );
    const ungranted = unauthorizedEdits(ports, w, facts);
    if (ungranted.length)
      return ask(
        cur,
        w,
        grantQuestion(ungranted),
        [reason("authority-needed", ungranted.slice(0, 3).join(", "))],
        "Ask the user; their words authorize the edits, or undo them."
      );
    if (needsModelAnswer(w)) {
      const why = "Ask the user: continue Deep work with this limitation, or pause.";
      return ask(cur, w, modelQuestion(w), [reason("model-unqualified-for-deep", "the model is not qualified for Deep work")], why);
    }

    const shape = shapeRun(ports, cur, w, input, facts);
    admitCoverageDefinitions(ports, shape.coverage);
    const envelopeGate = checkEnvelopeGate(ports, cur, w, shape);
    if (envelopeGate.plan) return envelopeGate.plan;
    const executionEnvelope = envelopeGate.envelope;

    const now = ports.clock.now();
    const runId = `${w.label}-${ports.rand.base32(6)}`;
    const runDir = ports.store.tempDir(`run-${runId}`);
    const run = admittedRun(ports, {
      ports, w, runId, runDir, stage: input.stage as Run["stage"], facts, ...shape, executionEnvelope });
    run.exclusions = settingsFor(ports, cur, w).exclusions as Exclusion[];
    // Prepare: record the run intent in the contract and release the lock (TS §7.3).
    const prepared: WorkContract = {
      ...w,
      lastValidPhase: w.state === "checking" ? w.lastValidPhase : w.state,
      state: "checking",
      updatedAt: now,
      session: { ...w.session, inCall: { runId, ...ports.store.self(), verb: "check", since: now, runDir, executionEnvelope } },
    };
    const job: Job = {
      id: runId,
      execute: () => execute(run, inputs),
      finalize: async (tx, st, result) => finalizeCheck(run, st, result, (tx.state?.revision ?? 0) + 1),
    };
    return { state: withWork(cur, prepared), resp: { work: w.id, progress: { phase: "checking" } }, job };
  },
};
