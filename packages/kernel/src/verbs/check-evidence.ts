// How a finished check run becomes evidence: receipts, the baseline match, counters, locks and attention items.
import { join } from "node:path";
import { failureSignature, recordAttempt, recordLaunchedChecks, stopFor, withSignature } from "../core/budget.ts";
import { hashOf } from "../core/ids.ts";
import { baselineDefinitionMatches, supportOf, wantsRed } from "../core/obligations.ts";
import { receiptsFrom } from "../core/receipts.ts";
import type { RunFacts } from "../core/receipts.ts";
import { carryDispositions, netAttention } from "../core/review.ts";
import type { FileChange } from "../core/review.ts";
import type { AttentionItem, BudgetState, Obligation, Receipt, State, StopReason, WorkContract } from "../core/schemas.ts";
import type { Normalized, Ports } from "../ports/types.ts";
import type { Facts } from "./facts.ts";

/** Everything a run decided before it started, which its result needs to be interpreted. */
export interface Run {
  ports: Ports;
  w: WorkContract;
  runId: string;
  runDir: string;
  stage: "baseline" | "candidate" | "integrated";
  baseline: boolean;
  scope: "targeted" | "full";
  toRun: Obligation[];
  toExecute: "all" | string[];
  missing: Obligation[];
  facts: Facts;
  id: string;
}

export function receiptsOf(run: Run, cw: WorkContract, o: RunFacts): Receipt[] {
  const { ports, facts, runId, runDir, stage, scope } = run;
  const norm: Normalized | null = o.raw === null ? null : ports.stack.normalize(o.raw, ports.root);
  const argv = ports.stack.argv(run.toExecute, join(runDir, "vitest.json"));
  const receipts = receiptsFrom(o, norm, run.toRun, {
    stage,
    scope,
    id: run.id,
    candidate: facts.candidate,
    runId,
    runDir,
    argv,
    before: facts.candidate,
    versions: ports.stack.fingerprint(ports.root),
    missing: new Set(run.missing.map((m) => m.id)),
  });
  if (!run.baseline) return receipts;
  // The baseline may differ from the start only by tests and new files (the minimal scaffolding a new interface needs);
  // a pre-existing source file that changed means the red was not taken on the starting behavior.
  const isNew = (p: string) => facts.inv.status.some((s) => s.path === p && (s.untracked || s.xy.startsWith("A")));
  const wasDirty = (p: string) => cw.git.start.dirty.some((d) => d.path === p && d.blob === facts.inv.entries.get(p)?.blob);
  const contaminated = facts.inv.status
    .map((s) => s.path)
    .filter((p) => ports.stack.classify(p) === "source" && !isNew(p) && !wasDirty(p) && !(cw.scaffolding ?? []).includes(p));
  if (cw.scaffolding?.length)
    for (const r of receipts)
      r.limitations.push(`scaffolding declared in existing files: ${cw.scaffolding.slice(0, 3).join(", ")}`);
  if (contaminated.length) {
    for (const r of receipts) {
      r.status = "inconclusive";
      r.reasons.push("evidence-inconclusive");
      r.limitations.push(`source changed before the baseline: ${contaminated.slice(0, 3).join(", ")}`);
    }
  }
  return receipts;
}

/** A planned red is expected evidence: record whether each acceptance test failed (or passed) as declared. */
export function matchBaseline(run: Run, cw: WorkContract, receipts: Receipt[]): Obligation[] {
  return cw.obligations.map((ob) => {
    const r = receipts.find((x) => x.obligation === ob.id);
    if (!r || !run.baseline) return ob;
        const behavioral =
      r.status === "fail" && (r.failureKinds ?? []).length > 0 && r.failureKinds!.every((kind) => kind === "assertion");
    return {
      ...ob,
      baselineMatched: wantsRed(ob) ? behavioral : r.status === "pass",
      baselineTestHash: ob.testFile ? run.facts.inv.entries.get(ob.testFile)?.blob : undefined,
      baselineInputs: supportOf(ob, run.facts),
    };
  });
}

/** Launched checks always count; a full candidate run that could run counts one attempt and its failure signature (TS §8.6). */
export function account(
  run: Run,
  cw: WorkContract,
  o: RunFacts,
  receipts: Receipt[],
  configFailed: boolean
): { budget: BudgetState; stop: StopReason | undefined } {
  const launched = o.ran ? run.toRun.filter((ob) => !run.missing.some((m) => m.id === ob.id)).length : 0;
  let budget = recordLaunchedChecks(cw.budget, launched);
  if (run.stage === "candidate" && run.scope === "full" && !configFailed) {
    budget = recordAttempt(budget);
    const first = receipts.find((r) => r.status === "fail");
    budget = first
      ? withSignature(
          budget,
          failureSignature(
            first.obligation,
            (first.failures ?? []).map((f) => f.test),
            first.failures?.[0]?.message ?? ""
          )
        )
      : { ...budget, signatures: [] };
  }
  return { budget, stop: stopFor(budget, cw.lane) };
}

/** An acceptance test that went red to green is locked whole-file; a revised definition is marked, not locked (TS §9.7). */
export function applyLocks(run: Run, cw: WorkContract, locks: State["locks"], obligations: Obligation[], receipts: Receipt[]) {
  if (run.stage !== "candidate") return { locks, obligations };
  const blobOf = (path: string) => run.facts.inv.entries.get(path)?.blob;
  let out = obligations,
    held = locks;
  const mark = (id: string, state: "revised" | "locked") => {
    out = out.map((x) => (x.id === id ? { ...x, state } : x));
  };
  for (const ob of obligations) {
    const same = baselineDefinitionMatches(ob, blobOf);
    if (ob.baselineMatched && !same) mark(ob.id, "revised");
    const blob = ob.testFile ? blobOf(ob.testFile) : undefined;
    const passed = receipts.find((x) => x.obligation === ob.id)?.status === "pass";
    if (passed && ob.testFile && same && !held.some((l) => l.path === ob.testFile) && blob) {
      held = [
        ...held,
        {
          path: ob.testFile,
          hash: blob,
          obligation: ob.id,
          anchor: { provisional: cw.id },
          supportInputs: supportOf(ob, run.facts),
        },
      ];
      mark(ob.id, "locked");
    }
  }
  return { locks: held, obligations: out };
}

/** Markers and weakenings counted net per hunk, plus configuration that decides what runs and declared scaffolding. */
export async function attentionOf(run: Run, cw: WorkContract): Promise<{ changes: FileChange[]; attention: AttentionItem[] }> {
  const { ports, facts } = run;
  const changes = await ports.git.changes(cw.git.base, facts.reviewPaths, ports.stack.classify);
  const vetted = ports.project.hashes(Object.keys(cw.vetted)); // recipe files a scaffold wrote raise nothing until someone changes them
  const item = (id: string, path: string, line: number, pattern: string): AttentionItem => ({
    id: `AT-${id.slice(0, 8)}`,
    path,
    line,
    pattern,
    marker: false,
  });
  const cfg = changes
    .filter((c) => c.kind === "config" && vetted[c.path] !== cw.vetted[c.path])
    .map((c) => item(hashOf(["cfg", c.path, c.hunks]), c.path, c.hunks[0]?.line ?? 1, "test or build configuration"));
  const declared = (cw.scaffolding ?? []).map((path) => item(hashOf(["scaffold", path]), path, 1, "declared scaffolding"));
  const weakened = netAttention(
    changes.filter((c) => !cw.reverting?.includes(c.path)),
    ports.stack.patterns
  );
  return { changes, attention: carryDispositions(cw.attention, [...declared, ...weakened, ...cfg]) };
}
