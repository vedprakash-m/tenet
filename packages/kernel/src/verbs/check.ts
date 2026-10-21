// `check`: run the obligations and turn what happened into receipts, counters, attention items and the next step.
// The run happens outside the lock (prepare, execute, finalize); the response is rebuilt from the observed result.
import { join } from "node:path";
import { attemptsLeft } from "../core/budget.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { declaredInputs } from "../core/obligations.ts";
import { reason } from "../core/reasons.ts";
import type { RunFacts } from "../core/receipts.ts";
import { CheckInput } from "../core/schemas.ts";
import type { Obligation, Question, Reason, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan, Verb } from "../pipeline.ts";
import type { Ports, RunResult, StaticTool } from "../ports/types.ts";
import { grantQuestion } from "./authority.ts";
import { finalizeCheck } from "./check-finalize.ts";
import { isStatic, staticReport } from "./check-evidence.ts";
import type { Executed, Run } from "./check-evidence.ts";
import { nx, withWork, workOf } from "./common.ts";
import { dirtyQuestion, undecidedDirty } from "./dirty.ts";
import { checkInputId, gather, unauthorizedEdits, worldDigest } from "./facts.ts";
import { settingsFor, unsupportedExecution } from "./reconcile.ts";

const TIMEOUT_MS = 10 * 60_000;
const refuse = (code: "capability-missing" | "stale-session" | "continue-required", why: string): never => {
  throw new KernelError(code, why, { exit: 2 });
};
const safePath = (p: string) => !p.startsWith("/") && !p.split("/").includes("..");

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
  const unreadable = inputs.filter((path) => !allowed("read", path, exclusions));
  if (unreadable.length)
    refuse(
      "capability-missing",
      `excluded evidence inputs cannot be verified from stat alone: ${unreadable.slice(0, 3).join(", ")}; no check was launched`
    );
  const detected = ports.stack.detect(ports.root);
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
  if (["finished", "cancelled", "superseded"].includes(w.state) && !(w.state === "finished" && input.stage === "integrated"))
    refuse("stale-session", `this work is ${w.state}`);
  if (input.stage === "candidate" && !input.targeted && (!attemptsLeft(w.budget, w.lane) || w.stopReason)) {
    throw new KernelError(
      w.stopReason === "repeated-failure" ? "repeated-failure" : "budget-exhausted",
      "No candidate attempt remains. Finish with the current evidence and handoff.",
      { exit: 2 }
    );
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

function shapeRun(ports: Ports, w: WorkContract, input: CheckInput, facts: Run["facts"]) {
  const baseline = input.stage === "baseline";
  const scope: Run["scope"] = baseline || input.targeted ? "targeted" : "full";
  const acceptance = w.obligations.filter((o) => o.testFile);
  const present = (f: string) => facts.inv.entries.has(f);
  const files = acceptance.map((o) => o.testFile!).filter(present);
  return {
    baseline,
    scope,
    toRun: scope === "full" ? w.obligations : acceptance,
    missing: acceptance.filter((o) => !present(o.testFile!)),
    toExecute: scope === "full" ? ("all" as const) : files,
    id: checkInputId(ports, w, facts.candidate),
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

    const w = declare(w0, input);
    const undecided = undecidedDirty(w);
    if (undecided.length)
      return ask(
        cur,
        w,
        dirtyQuestion(undecided),
        [reason("attribution-mixed-file", undecided.join(", "))],
        "Ask the user what happens to their edits."
      );
    const facts = await gather(ports, w);
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

    const now = ports.clock.now();
    const runId = `${w.label}-${ports.rand.base32(6)}`;
    const runDir = ports.store.tempDir(`run-${runId}`);
    const run: Run = { ports, w, runId, runDir, stage: input.stage as Run["stage"], facts, ...shapeRun(ports, w, input, facts) };
    // Prepare: record the run intent in the contract and release the lock (TS §7.3).
    const prepared: WorkContract = {
      ...w,
      lastValidPhase: w.state === "checking" ? w.lastValidPhase : w.state,
      state: "checking",
      updatedAt: now,
      session: { ...w.session, inCall: { runId, ...ports.store.self(), verb: "check", since: now, runDir } },
    };
    const job: Job = {
      id: runId,
      execute: () => execute(run, inputs),
      finalize: async (_tx, st, result) => finalizeCheck(run, st, result),
    };
    return { state: withWork(cur, prepared), resp: { work: w.id, progress: { phase: "checking" }, next: [] }, job };
  },
};

/** What the process did, whatever it was. `raw` is the output the tool's own report format is read from. */
const observed = (r: RunResult, raw: string | null): Omit<RunFacts, "after"> => ({
  outputTruncated: r.outputTruncated,
  ...(r.exit !== undefined ? { exit: r.exit } : {}),
  ...(r.signal ? { signal: r.signal } : {}),
  timedOut: r.timedOut,
  durationMs: r.durationMs,
  ...(r.pid ? { pid: r.pid } : {}),
  startedAt: r.startedAt,
  raw,
  ran: r.exit !== undefined || !!r.signal,
});

/** One static tool over the whole project; a tool that is not installed did not run. */
async function runStatic(run: Run, ob: Obligation): Promise<Omit<RunFacts, "after">> {
  const { ports, runDir } = run;
  const tool = ob.tool as StaticTool, report = staticReport(runDir, tool);
  const argv = ports.stack.staticArgv(ports.root, tool, report);
  if (!argv) return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, ran: false };
  const r = await ports.runner.run({ argv, cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS, report });
  return observed(r, ports.stack.staticOutput(tool, r));
}

/** Runs the named test files (or everything) once, outside the lock, then each static check, and reports what the processes did. */
async function execute(run: Run, inputs: readonly string[]): Promise<Executed> {
  const { ports, runDir, toExecute, facts } = run;
  if (toExecute !== "all" && !toExecute.length)
    return { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, after: facts.candidate, ran: false, statics: {} };
  const report = join(runDir, "vitest.json");
  const r = await ports.runner.run({ argv: ports.stack.argv(toExecute, report), cwd: ports.root, runDir, timeoutMs: TIMEOUT_MS, report });
  const statics: Record<string, Omit<RunFacts, "after">> = {};
  for (const ob of run.toRun.filter(isStatic)) statics[ob.id] = await runStatic(run, ob);
  const after = (await ports.git.inventory([], inputs)).digest;
  return {
    ...observed(r, r.report),
    after,
    statics: Object.fromEntries(Object.entries(statics).map(([id, s]) => [id, { ...s, after }])),
  };
}
