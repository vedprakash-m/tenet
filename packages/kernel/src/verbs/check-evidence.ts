// How a finished check run becomes evidence: receipts, the baseline match, counters, locks and attention items.
import { join } from "node:path";
import { failureSignature, recordAttempt, recordLaunchedChecks, stopFor, withSignature } from "../core/budget.ts";
import { hashOf } from "../core/ids.ts";
import { baselineDefinitionMatches, supportOf, wantsRed } from "../core/obligations.ts";
import { receiptsFrom, staticReceipt } from "../core/receipts.ts";
import type { RunFacts } from "../core/receipts.ts";
import { carryDispositions, netAttention } from "../core/review.ts";
import type { FileChange } from "../core/review.ts";
import type { AttentionItem, BudgetState, Obligation, Receipt, State, StopReason, WorkContract } from "../core/schemas.ts";
import type { Normalized, Ports, StaticTool } from "../ports/types.ts";
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

/** What a check run observed: the test runner, and each static tool (including the e2e obligation) by obligation. */
export interface Executed extends RunFacts { statics: Record<string, RunFacts> }
export const isStatic = (ob: Obligation): boolean => ob.kind === "static";
export const isE2e = (ob: Obligation): boolean => ob.tool === "playwright";
export const staticReport = (runDir: string, tool: string): string => join(runDir, `${tool}.json`);
export const e2eReport = (runDir: string): string => join(runDir, "playwright.json");

/** A static check is judged by its own run, on the same candidate as the tests. */
function staticReceipts(run: Run, o: Executed, firstIndex: number): Receipt[] {
  const { ports, facts, runId, runDir, stage, scope } = run;
  const versions = ports.stack.fingerprint(ports.root);
  return run.toRun.filter((ob) => isStatic(ob) && !isE2e(ob)).map((ob, i) => {
    const tool = ob.tool as StaticTool;
    const argv = ports.stack.staticArgv(ports.root, tool, staticReport(runDir, tool)) ?? [];
    const candidate = facts.candidate;
    const ctx = {
      stage, scope, id: run.id, candidate, runId, runDir, argv, versions, before: candidate,
      missing: new Set<string>(), population: facts.inv.entries,
    };
    const notRun: RunFacts = { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, after: candidate, ran: false };
    const ran = o.statics[ob.id] ?? notRun;
    const norm = ports.stack.normalizeStatic(tool, { exit: ran.exit, raw: ran.raw }, ports.root);
    return staticReceipt(ran, norm, ob, firstIndex + i, ctx);
  });
}

/** The e2e obligation is judged like a test (real pass/fail counts), but from its own separate Playwright run,
 * never the shared Vitest report (EVD-13). */
function e2eReceipts(run: Run, o: Executed, firstIndex: number): Receipt[] {
  const { ports, facts, runId, runDir, stage, scope } = run;
  const e2eObs = run.toRun.filter(isE2e);
  if (!e2eObs.length) return [];
  const candidate = facts.candidate;
  const notRun: RunFacts = { timedOut: false, durationMs: 0, startedAt: ports.clock.now(), raw: null, after: candidate, ran: false };
  const ran = o.statics[e2eObs[0]!.id] ?? notRun;
  const norm = ports.stack.normalizeE2e({ exit: ran.exit, raw: ran.raw }, ports.root);
  return receiptsFrom(ran, norm, e2eObs, {
    stage, scope, id: run.id, candidate, runId, runDir, argv: ports.stack.e2eArgv(ports.root, e2eReport(runDir)) ?? [],
    before: candidate, versions: ports.stack.fingerprint(ports.root), missing: new Set<string>(),
  }).map((r, i) => ({ ...r, id: `RC-${runId}-${firstIndex + i + 1}` }));
}

export function receiptsOf(run: Run, cw: WorkContract, o: Executed): Receipt[] {
  const { ports, facts, runId, runDir, stage, scope } = run;
  const norm: Normalized | null = o.raw === null ? null : ports.stack.normalize(o.raw, ports.root);
  const argv = ports.stack.argv(run.toExecute, join(runDir, "vitest.json"));
  const tests = run.toRun.filter((ob) => !isStatic(ob));
  const receipts = receiptsFrom(o, norm, tests, {
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
  receipts.push(...staticReceipts(run, o, tests.length));
  receipts.push(...e2eReceipts(run, o, tests.length + run.toRun.filter((ob) => isStatic(ob) && !isE2e(ob)).length));
  if (!run.baseline) return receipts;
  // The baseline may differ from the start only by tests and new files (the minimal scaffolding a new interface needs);
  // a pre-existing source file that changed means the red was not taken on the starting behavior. A path named with
  // `--alongside` is exempt the same way, but only once a disposition has recorded why a behavioral red was
  // infeasible (TDD-03) — the seeded fault still has to make the test actually fail; nothing else is weakened.
  const isNew = (p: string) => facts.inv.status.some((s) => s.path === p && (s.untracked || s.xy.startsWith("A")));
  const wasDirty = (p: string) => cw.git.start.dirty.some((d) => d.path === p && d.blob === facts.inv.entries.get(p)?.blob);
  const alongsideDeclared = cw.obligations.some((ob) => ob.alongsideReason);
  const exempt = (p: string) => (cw.scaffolding ?? []).includes(p) || (alongsideDeclared && (cw.alongside ?? []).includes(p));
  const contaminated = facts.inv.status
    .map((s) => s.path)
    .filter((p) => ports.stack.classify(p) === "source" && !isNew(p) && !wasDirty(p) && !exempt(p));
  if (cw.scaffolding?.length)
    for (const r of receipts)
      r.limitations.push(`scaffolding declared in existing files: ${cw.scaffolding.slice(0, 3).join(", ")}`);
  if (alongsideDeclared && cw.alongside?.length)
    for (const r of receipts)
      r.limitations.push(`negative control declared in existing files: ${cw.alongside.slice(0, 3).join(", ")}`);
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
  o: Executed,
  receipts: Receipt[],
  configFailed: boolean
): { budget: BudgetState; stop: StopReason | undefined } {
  const ranTests = o.ran ? run.toRun.filter((ob) => !isStatic(ob) && !run.missing.some((m) => m.id === ob.id)).length : 0;
  const launched = ranTests + run.toRun.filter((ob) => isStatic(ob) && o.statics[ob.id]?.ran).length;
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
  const allowed = new Set([...(cw.scopedTo ?? []), ...cw.obligations.flatMap((o) => o.testFile ?? [])]);
  // A vetted path is only exempt while its content still matches what the recipe wrote; an edit to it is a real
  // change outside the named findings like any other, not a free pass because the path was once vetted (R09).
  const stillVetted = (p: string) => p in cw.vetted && vetted[p] === cw.vetted[p];
  const outside = (cw.scopedTo ? facts.reviewPaths : []).filter((p) => !allowed.has(p) && !stillVetted(p));
  const stray = outside.map((path) => item(hashOf(["outside", path]), path, 1, "outside the named findings"));
  const declared = (cw.scaffolding ?? []).map((path) => item(hashOf(["scaffold", path]), path, 1, "declared scaffolding"));
  const weakened = netAttention(
    changes.filter((c) => !cw.reverting?.includes(c.path)),
    ports.stack.patterns
  );
  return { changes, attention: carryDispositions(cw.attention, [...declared, ...stray, ...weakened, ...cfg]) };
}
