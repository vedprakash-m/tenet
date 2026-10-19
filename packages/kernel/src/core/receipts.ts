// Receipts (TS §9.6): turn one observed run and its normalized report into one receipt per obligation. The adapter
// normalized the report; this decides what it proves. A receipt that cannot prove anything is inconclusive, never a pass.
import { reason } from "./reasons.ts";
import type { Obligation, Reason, Receipt } from "./schemas.ts";
import type { Normalized, ToolVersions } from "../ports/types.ts";

/** What was observed about the process, independent of what the report says. */
export interface RunFacts {
  exit?: number; signal?: string; timedOut: boolean; durationMs: number; pid?: number; startedAt: string;
  raw: string | null; after: string; ran: boolean; // `after` is the inventory digest once the run ended
}

export interface ReceiptContext {
  stage: Receipt["stage"]; scope: "targeted" | "full"; id: string; candidate: string; runId: string; runDir: string;
  argv: string[]; before: string; versions: ToolVersions; missing: ReadonlySet<string>;
}

/** Did it execute, is the report valid and attributable, do exit status and report agree, is the population right? */
export function receiptsFrom(o: RunFacts, norm: Normalized | null, obs: readonly Obligation[], c: ReceiptContext): Receipt[] {
  return obs.map((ob, i) => {
    const reasons: string[] = [];
    const rec: Receipt = {
      id: `RC-${c.runId}-${i + 1}`, obligation: ob.id, kind: ob.kind, stage: c.stage, source: "kernel-run", checkInputId: c.id, scope: c.scope,
      argv: c.argv, cwd: ".", durationMs: o.durationMs, versions: { tool: c.versions.tool, reporter: c.versions.reporter, adapter: c.versions.adapter },
      provenance: { runId: c.runId, runDir: c.runDir, startedAt: o.startedAt, ...(o.pid ? { pid: o.pid } : {}) },
      status: "inconclusive", qualifiers: [], reasons, limitations: [], candidate: c.candidate,
    };
    if (o.exit !== undefined) rec.exit = o.exit;
    if (o.signal) rec.signal = o.signal;
    const stop = (code: string) => { reasons.push(code); return rec; };
    if (c.missing.has(ob.id)) { rec.limitations.push("the test file does not exist yet"); return stop("not-executed"); }
    if (!o.ran) return stop("not-executed");
    if (o.timedOut) return stop("timeout");
    if (o.after !== c.before) return stop("concurrent-edit"); // an input changed during the run (EVD-11)
    if (!norm) return stop(o.raw === null ? "report-missing" : "report-invalid");
    if (norm.invalid) return stop("report-invalid");
    // An acceptance test is one file; the suite is every file the report names.
    const files = ob.testFile ? [ob.testFile] : [...norm.files.keys()];
    const per = files.map((f) => norm.files.get(f));
    if (per.some((p) => !p)) return stop("population-mismatch");
    const sum = per.reduce((a, p) => ({ executed: a.executed + p!.executed, passed: a.passed + p!.passed, failed: a.failed + p!.failed, skipped: a.skipped + p!.skipped, focused: a.focused + p!.focused }), { executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0 });
    rec.counts = { discovered: sum.executed + sum.skipped, ...sum };
    rec.failures = per.flatMap((p) => p!.failures).slice(0, 5);
    if (sum.focused) return stop("focused-tests");
    if (o.exit === 0 && sum.failed > 0) return stop("report-contradiction");
    if (o.exit !== undefined && o.exit !== 0 && sum.failed === 0) return stop("report-contradiction");
    if (sum.executed === 0 && sum.failed === 0) return stop("zero-tests");
    rec.status = sum.failed > 0 ? "fail" : "pass";
    if (sum.skipped > 0 && ob.testFile) rec.limitations.push(`${sum.skipped} skipped`);
    return rec;
  });
}

export const receiptReasons = (r: Receipt): Reason[] => r.reasons.map((c) => reason(c as never, r.obligation, { refs: [r.obligation] }));
