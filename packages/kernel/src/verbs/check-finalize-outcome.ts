import { attemptsLeft } from "../core/budget.ts";
import {
  coverageEvidenceForReceipts, coveredCoverageEvidence, coveredReceiptIds,
} from "../core/alternative-check.ts";
import type { CoverageApproval, CoverageEvidence } from "../core/alternative-check.ts";
import { excused, failureReasons } from "../core/baseline.ts";
import type { BaselineCtx } from "../core/baseline.ts";
import { KernelError } from "../core/errors.ts";
import { SCOPE, trendOf } from "../core/fitness.ts";
import { reason } from "../core/reasons.ts";
import { receiptReasons } from "../core/receipts.ts";
import { fullChecksPassed } from "../core/verdict.ts";
import type { FileChange } from "../core/review.ts";
import type { Obligation, Question, Reason, Receipt, State, StopReason, WorkContract } from "../core/schemas.ts";
import { nx } from "./common.ts";
import { baselineQuestion } from "./check-sealed.ts";
import type { Run } from "./check-evidence.ts";
import { issueReview } from "./manifest.ts";

type Next = Array<ReturnType<typeof nx>>;
interface Outcome { reasons: Reason[]; next: Next; data: Record<string, unknown>; work: WorkContract }

function evidenceReasons(receipts: Receipt[], baseline: boolean, ctx: BaselineCtx, covered: ReadonlySet<string>): Reason[] {
  return receipts.flatMap((receipt) => {
    if (receipt.status === "pass" && receipt.qualifiers.includes("flaky") && !covered.has(receipt.id))
      return [reason("evidence-flaky", receipt.obligation, { refs: [receipt.obligation] })];
    if (receipt.status !== "fail") return receiptReasons(receipt);
    const tests = (receipt.failures ?? []).map((failure) => failure.test).slice(0, 3).join(", ");
    return baseline ? [] : failureReasons({ id: receipt.obligation }, receipt, ctx, `${receipt.obligation}: ${tests}`);
  });
}

const receiptSummary = (receipts: Receipt[]) => receipts.map((receipt) => ({
  obligation: receipt.obligation, status: receipt.status, qualifiers: receipt.qualifiers,
  history: receipt.history, counts: receipt.counts, failures: receipt.failures?.slice(0, 3),
  reasons: receipt.reasons, limitations: receipt.limitations.slice(0, 3),
  executionEnvelope: receipt.executionEnvelope,
}));

function nextStep(
  run: Run, state: State, work: WorkContract, receipts: Receipt[], obligations: Obligation[],
  stop: StopReason | undefined, changes: FileChange[], ctx: BaselineCtx,
  coverage: { approval: CoverageApproval[]; evidence: CoverageEvidence[] },
): Outcome & { passedAll: boolean; question?: Question | undefined } {
  const { baseline, scope, stage } = run;
  const failing = receipts.filter((receipt) => receipt.status === "fail" && !excused(receipt, ctx));
  const configFailed = receipts.some((receipt) => receipt.status === "inconclusive");
  const covered = coveredReceiptIds(receipts, coverage.approval, coverage.evidence);
  const flaky = receipts.some((receipt) => receipt.qualifiers.includes("flaky") && !covered.has(receipt.id));
  const passedAll = fullChecksPassed(work.obligations,
    receipts.map((receipt) => excused(receipt, ctx) ? { ...receipt, status: "pass" as const } : receipt),
    coverage.approval, coverage.evidence);
  const reasons = evidenceReasons(receipts, baseline, ctx, covered);
  const question = stop || baseline ? undefined : baselineQuestion(receipts, ctx);
  let data: Record<string, unknown> = { stage, scope, receipts: receiptSummary(receipts) };
  const visible = coveredCoverageEvidence(receipts, coverage.approval, coverage.evidence);
  if (visible.length) data = { ...data, coverage: visible.map((item) => ({
    obligation: item.obligation, primaryReceipt: item.primaryReceipt, alternativeReceipt: item.alternativeReceipt,
    mappingHash: item.mappingHash,
  })) };
  const next: Next = [];
  let nextWork = work;
  if (stop) {
    reasons.push(reason(stop === "repeated-failure" ? "repeated-failure" : "budget-exhausted"));
    next.push(nx("finish", "Stop here: finish reports the honest endpoint and a handoff.", true));
  } else if (baseline) {
    const unmatched = obligations.filter((obligation) => obligation.baselineMatched === false);
    reasons.push(...unmatched.map((obligation) => reason("no-distinguishing-red",
      `${obligation.id}: the test must fail on the baseline with a failed assertion`, { refs: [obligation.id] })));
    next.push(unmatched.length ? nx("test", "Fix the acceptance test so it fails for the right reason.", true)
      : nx("implement", "The red is distinguishing. Implement, then check.", true));
  } else if (failing.length || configFailed || flaky) {
    const why = failing.length ? `Fix the failing check (${attemptsLeft(work.budget, work.lane)} attempts left).`
      : flaky && !configFailed ? "A required check passed only on a rerun; make it deterministic, then check again."
        : "The check could not run cleanly; fix the cause and retry.";
    next.push(nx(failing.length || (flaky && !configFailed) ? "implement" : "check", why, true));
  } else if (passedAll) {
    const issued = issueReview(run.ports, state, work, run.facts, changes);
    nextWork = issued.work;
    next.push(...issued.next);
    reasons.push(...issued.reasons);
    if (issued.data) data = { ...data, ...issued.data };
  } else {
    next.push(scope === "targeted" ? nx("check", "Targeted checks pass; run a full check when the pass is done.")
      : nx("implement", "Continue."));
  }
  if (question) next.splice(0, next.length, nx("ask",
    "Ask the user: leave these failing tests out of this work, or fix them as part of it.", true));
  return { reasons, next, data, work: nextWork, passedAll, question };
}

export function nextCoveredStep(
  run: Run, state: State, work: WorkContract, receipts: Receipt[], obligations: Obligation[],
  stop: StopReason | undefined, changes: FileChange[], ctx: BaselineCtx,
) {
  const coverage = coverageEvidenceForReceipts(state, work.id, work.basis?.hash ?? "", receipts, run.id);
  return nextStep(run, state, work, receipts, obligations, stop, changes, ctx, coverage);
}

export function workloadTrend(run: Run, state: State, receipts: Receipt[]) {
  const receipt = receipts.find((item) => item.workload && (item.status === "pass" || item.status === "fail"));
  if (!receipt?.workload || !run.workload?.ok) return null;
  return trendOf(run.workload.decl, state.project.fitness ?? {},
    { receipt: receipt.id, at: receipt.provenance.startedAt, workload: receipt.workload });
}

export function workloadEvidence(receipts: Receipt[], trend: ReturnType<typeof workloadTrend>) {
  return receipts.some((receipt) => receipt.kind === "workload") ? { workload: { scope: SCOPE, trends: trend?.lines ?? [] } } : {};
}

export async function snapshot(run: Run, work: WorkContract, reasons: Reason[]) {
  if (work.git.mode !== "shadow") return;
  try { await run.ports.git.snapshot(`Tenet: ${run.stage} check`); }
  catch (error) {
    if (!(error instanceof KernelError)) throw error;
    reasons.push(...error.reasons.map((item) => ({ ...item, note: true })));
  }
}
