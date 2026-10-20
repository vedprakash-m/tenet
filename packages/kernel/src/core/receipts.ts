// Receipts (TS §9.6): turn one observed run and its normalized report into one receipt per obligation. The adapter
// normalized the report; this decides what it proves. A receipt that cannot prove anything is inconclusive, never a pass.
import { redact } from "./redact.ts";
import { reason } from "./reasons.ts";
import type { Obligation, Reason, Receipt } from "./schemas.ts";
import type { Normalized, StaticNorm, ToolVersions } from "../ports/types.ts";

/** What was observed about the process, independent of what the report says. */
export interface RunFacts {
  exit?: number;
  signal?: string;
  timedOut: boolean;
  durationMs: number;
  pid?: number;
  startedAt: string;
  raw: string | null;
  after: string;
  ran: boolean; // `after` is the inventory digest once the run ended
}

export interface ReceiptContext {
  stage: Receipt["stage"];
  scope: "targeted" | "full";
  id: string;
  candidate: string;
  runId: string;
  runDir: string;
  argv: string[];
  before: string;
  versions: ToolVersions;
  missing: ReadonlySet<string>;
}

type FileCounts = NonNullable<ReturnType<Normalized["files"]["get"]>>;
type Sum = { executed: number; passed: number; failed: number; skipped: number; focused: number };

/** The receipt before any judgement: inconclusive, with the identity and provenance of the run. */
function blank(o: RunFacts, ob: Obligation, i: number, c: ReceiptContext): Receipt {
  const rec: Receipt = {
    id: `RC-${c.runId}-${i + 1}`,
    obligation: ob.id,
    kind: ob.kind,
    stage: c.stage,
    source: "kernel-run",
    checkInputId: c.id,
    scope: c.scope,
    argv: c.argv,
    cwd: ".",
    durationMs: o.durationMs,
    versions: { tool: c.versions.tool, reporter: c.versions.reporter, adapter: c.versions.adapter },
    provenance: { runId: c.runId, runDir: c.runDir, startedAt: o.startedAt, ...(o.pid ? { pid: o.pid } : {}) },
    status: "inconclusive",
    qualifiers: [],
    reasons: [],
    limitations: [],
    candidate: c.candidate,
  };
  if (o.exit !== undefined) rec.exit = o.exit;
  if (o.signal) rec.signal = o.signal;
  return rec;
}

/** Why the run itself says nothing: it did not execute, timed out, was killed, or an input changed during it (EVD-11). */
function runProblem(o: RunFacts, c: ReceiptContext): string | undefined {
  if (!o.ran) return "not-executed";
  if (o.timedOut) return "timeout";
  if (o.signal || o.exit === undefined) return "not-executed";
  if (o.after !== c.before) return "concurrent-edit";
  return undefined;
}

const sumOf = (per: readonly FileCounts[]): Sum =>
  per.reduce(
    (a, p) => ({
      executed: a.executed + p.executed,
      passed: a.passed + p.passed,
      failed: a.failed + p.failed,
      skipped: a.skipped + p.skipped,
      focused: a.focused + p.focused,
    }),
    { executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0 },
  );

/** Exit status and report disagree. The exit status belongs to the whole run: a file that passed beside a failing one is no contradiction (found with TDD-04). */
function contradicts(o: RunFacts, norm: Normalized, sum: Sum): boolean {
  if (o.exit === 0 && sum.failed > 0) return true;
  return o.exit !== undefined && o.exit !== 0 && ![...norm.files.values()].some((p) => p.failed > 0);
}

/** Did it execute, is the report valid and attributable, do exit status and report agree, is the population right? */
function receiptFor(o: RunFacts, norm: Normalized | null, ob: Obligation, i: number, c: ReceiptContext): Receipt {
  const rec = blank(o, ob, i, c);
  const stop = (code: string) => {
    rec.reasons.push(code);
    return rec;
  };
  if (c.missing.has(ob.id)) {
    rec.limitations.push("the test file does not exist yet");
    return stop("not-executed");
  }
  const early = runProblem(o, c);
  if (early) return stop(early);
  if (!norm) return stop(o.raw === null ? "report-missing" : "report-invalid");
  if (norm.invalid) return stop("report-invalid");
  // An acceptance test is one file; the suite is every file the report names.
  const files = ob.testFile ? [ob.testFile] : [...norm.files.keys()];
  const per = files.flatMap((f) => norm.files.get(f) ?? []);
  if (per.length !== files.length) return stop("population-mismatch");
  const sum = sumOf(per);
  rec.counts = { discovered: sum.executed + sum.skipped, ...sum };
  rec.failures = per
    .flatMap((p) => p.failures)
    .slice(0, 5)
    .map((f) => ({ ...f, message: redact(f.message) })); // the record keeps no likely secret (SEC-11)
  rec.failureKinds = [...new Set(per.flatMap((p) => p.failureKinds))];
  if (sum.focused) return stop("focused-tests");
  if (sum.executed === 0 && sum.failed === 0) return stop("zero-tests"); // runners exit non-zero when they find nothing to run; that is no contradiction
  if (sum.skipped > 0 && ob.testFile) {
    rec.limitations.push(`${sum.skipped} skipped`);
    return stop("population-mismatch");
  }
  if (contradicts(o, norm, sum)) return stop("report-contradiction");
  rec.status = sum.failed > 0 ? "fail" : "pass";
  return rec;
}

/** A static check proves one thing about the whole project: the tool ran to the end on this tree and reported nothing, or errors. */
export function staticReceipt(o: RunFacts, norm: StaticNorm, ob: Obligation, i: number, c: ReceiptContext): Receipt {
  const rec = blank(o, ob, i, c);
  const tool = ob.tool ?? "";
  rec.versions = { tool: `${tool}@${c.versions.static[tool] ?? "none"}`, reporter: tool, adapter: c.versions.adapter };
  const stop = (code: string, limit?: string) => {
    rec.reasons.push(code);
    if (limit) rec.limitations.push(limit);
    return rec;
  };
  if (!o.ran) return stop("not-executed", `${tool} did not run; is it installed in the project?`);
  const early = runProblem(o, c);
  if (early) return stop(early);
  if (norm.status === "invalid") return stop("report-invalid", norm.problem);
  rec.failures = norm.failures.map((f) => ({ ...f, message: redact(f.message) }));
  rec.failureKinds = [...new Set(norm.failures.map((f) => f.kind))];
  rec.status = norm.status;
  return rec;
}

export const receiptsFrom = (o: RunFacts, norm: Normalized | null, obs: readonly Obligation[], c: ReceiptContext): Receipt[] =>
  obs.map((ob, i) => receiptFor(o, norm, ob, i, c));

export const receiptReasons = (r: Receipt): Reason[] =>
  r.reasons.map((c) => reason(c as never, r.obligation, { refs: [r.obligation] }));
