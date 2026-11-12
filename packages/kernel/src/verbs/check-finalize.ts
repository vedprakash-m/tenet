// What a finished check run turns into: the reasons, the next action, the review manifest, and the published contract.
import { changeTraitsOf } from "./facts.ts";
import { attemptsLeft } from "../core/budget.ts";
import { KernelError } from "../core/errors.ts";
import { executionDisclosures } from "../core/execution-envelope.ts";
import { SCOPE, trendOf } from "../core/fitness.ts";
import { reason } from "../core/reasons.ts";
import { receiptReasons } from "../core/receipts.ts";
import { fullChecksPassed } from "../core/verdict.ts";
import type { FileChange } from "../core/review.ts";
import type { Obligation, Question, Reason, Receipt, State, StopReason, WorkContract } from "../core/schemas.ts";
import type { Resp } from "../pipeline.ts";
import { nx, withWork } from "./common.ts";
import { applyLocks, attentionOf, matchBaseline, receiptsOf } from "./check-evidence.ts";
import type { Executed, Run } from "./check-evidence.ts";
import { issueReview } from "./manifest.ts";
import { account } from "./check-account.ts";
import { baselineQuestion, sealedEvidence } from "./check-sealed.ts";
import { excused, failureReasons } from "../core/baseline.ts";
import type { BaselineCtx } from "../core/baseline.ts";

type Next = Array<ReturnType<typeof nx>>;
type Done = { state: State; resp: Resp };

interface Outcome {
  reasons: Reason[];
  next: Next;
  data: Record<string, unknown>;
  work: WorkContract;
}

/** A failed receipt is a reason to fix, except on the baseline where a planned red is expected, and except a broader-suite
 * failure that also fails on the starting files or could not be classified (EVD-04); others say why they proved nothing. */
function evidenceReasons(receipts: Receipt[], baseline: boolean, ctx: BaselineCtx): Reason[] {
  return receipts.flatMap((r) => {
    if (r.status === "pass" && r.qualifiers.includes("flaky")) return [reason("evidence-flaky", r.obligation, { refs: [r.obligation] })];
    if (r.status !== "fail") return receiptReasons(r);
    const tests = (r.failures ?? []).map((f) => f.test).slice(0, 3).join(", ");
    return baseline ? [] : failureReasons({ id: r.obligation }, r, ctx, `${r.obligation}: ${tests}`);
  });
}

const receiptSummary = (receipts: Receipt[]) =>
  receipts.map((r) => ({
    obligation: r.obligation,
    status: r.status,
    qualifiers: r.qualifiers,
    history: r.history,
    counts: r.counts,
    failures: r.failures?.slice(0, 3),
    reasons: r.reasons,
    limitations: r.limitations.slice(0, 3),
    executionEnvelope: r.executionEnvelope,
  }));

/** The reasons, the next action and (when the checks all passed) the review manifest that follow from the receipts. */
function nextStep(
  run: Run,
  st: State,
  nw: WorkContract,
  receipts: Receipt[],
  obligations: Obligation[],
  stop: StopReason | undefined,
  changes: FileChange[],
  ctx: BaselineCtx
): Outcome & { passedAll: boolean; question?: Question | undefined } {
  const { baseline, scope, stage } = run;
  const failing = receipts.filter((r) => r.status === "fail" && !excused(r, ctx)); // a failure the user left out counts as passed
  const configFailed = receipts.some((r) => r.status === "inconclusive");
  const flaky = receipts.some((r) => r.qualifiers.includes("flaky"));
  const passedAll = fullChecksPassed(nw.obligations, receipts.map((r) => (excused(r, ctx) ? { ...r, status: "pass" as const } : r)));
  const reasons = evidenceReasons(receipts, baseline, ctx);
  const question = stop || baseline ? undefined : baselineQuestion(receipts, ctx);
  let data: Record<string, unknown> = { stage, scope, receipts: receiptSummary(receipts) };
  const next: Next = [];
  let work = nw;
  if (stop) {
    reasons.push(reason(stop === "repeated-failure" ? "repeated-failure" : "budget-exhausted"));
    next.push(nx("finish", "Stop here: finish reports the honest endpoint and a handoff.", true));
  } else if (baseline) {
    const unmatched = obligations.filter((ob) => ob.baselineMatched === false);
    reasons.push(
      ...unmatched.map((ob) =>
        reason("no-distinguishing-red", `${ob.id}: the test must fail on the baseline with a failed assertion`, { refs: [ob.id] })
      )
    );
    next.push(
      unmatched.length
        ? nx("test", "Fix the acceptance test so it fails for the right reason.", true)
        : nx("implement", "The red is distinguishing. Implement, then check.", true)
    );
  } else if (failing.length || configFailed || flaky) {
    const why = failing.length
      ? `Fix the failing check (${attemptsLeft(nw.budget, nw.lane)} attempts left).`
      : flaky && !configFailed
        ? "A required check passed only on a rerun; make it deterministic, then check again."
        : "The check could not run cleanly; fix the cause and retry.";
    next.push(nx(failing.length || (flaky && !configFailed) ? "implement" : "check", why, true));
  } else if (passedAll) {
    const issued = issueReview(run.ports, st, nw, run.facts, changes); // one builder for manifests (TS §8.7)
    work = issued.work;
    next.push(...issued.next);
    reasons.push(...issued.reasons);
    if (issued.data) data = { ...data, ...issued.data };
  } else {
    next.push(
      scope === "targeted"
        ? nx("check", "Targeted checks pass; run a full check when the pass is done.")
        : nx("implement", "Continue.")
    );
  }
  // the user's answer comes before any fix: whether these failures are this work's to fix is theirs to say (EVD-04)
  const ask = "Ask the user: leave these failing tests out of this work, or fix them as part of it.";
  if (question) next.splice(0, next.length, nx("ask", ask, true));
  return { reasons, next, data, work, passedAll, question };
}

/** The trend of each fitness function with this run's judged workload as its newest point (QLT-05); null when none was judged. */
function workloadTrend(run: Run, st: State, receipts: Receipt[]) {
  const r = receipts.find((x) => x.workload && (x.status === "pass" || x.status === "fail"));
  if (!r?.workload || !run.workload?.ok) return null;
  return trendOf(run.workload.decl, st.project.fitness ?? {}, { receipt: r.id, at: r.provenance.startedAt, workload: r.workload });
}

/** A prototype's recovery point: every check snapshots the folder into the shadow repository (TS §10.9). */
async function snapshot(run: Run, nw: WorkContract, reasons: Reason[]) {
  if (nw.git.mode !== "shadow") return;
  try {
    await run.ports.git.snapshot(`Tenet: ${run.stage} check`);
  } catch (e) {
    if (!(e instanceof KernelError)) throw e;
    reasons.push(...e.reasons.map((r) => ({ ...r, note: true })));
  }
}

export async function finalizeCheck(run: Run, st: State, result: unknown): Promise<Done> {
  const { ports, facts, stage } = run;
  const data = { executionEnvelopes: executionDisclosures([run.executionEnvelope], st.consents) };
  const cw = st.work[run.w.id];
  // A check that finishes after `stop cancel` or replacement can never publish passing receipts.
  if (!cw || cw.state !== "checking" || cw.session.inCall?.runId !== run.runId) {
    return {
      state: st,
      resp: {
        work: run.w.id,
        exit: 2,
        reasons: [reason("run-superseded")],
        next: [nx("stop", "The check was cancelled or replaced; its result was discarded.")],
        data,
      },
    };
  }
  const o = result as Executed | { error: string };
  if ("error" in o) {
    const back = { ...cw, state: cw.lastValidPhase ?? "executing", session: { generation: cw.session.generation } };
    return {
      state: withWork(st, back),
      resp: {
        work: run.w.id,
        exit: 5,
        reasons: [{ code: "internal-error", message: o.error }],
        next: [nx("check", "Retry the check.")],
        data,
      },
    };
  }
  const receipts = receiptsOf(run, cw, o);
  const configFailed = receipts.some((r) => r.status === "inconclusive");
  const matched = matchBaseline(run, cw, receipts);
  const ctx = sealedEvidence(run, cw, o, receipts);
  const { budget, stop } = account(run, cw, o, receipts, configFailed, ctx);
  const { locks, obligations } = applyLocks(run, cw, st.locks, matched, receipts);
  const trend = workloadTrend(run, st, receipts);
  const { changes, attention } = await attentionOf(run, cw, trend?.items ?? null);
  const workload = receipts.some((r) => r.kind === "workload") ? { workload: { scope: SCOPE, trends: trend?.lines ?? [] } } : {};
  const now = ports.clock.now();
  const replaced = (r: Receipt) => receipts.some((n) => n.obligation === r.obligation && n.stage === r.stage && n.scope === r.scope);
  const kept = cw.receipts.filter((r) => !replaced(r));
  let nw: WorkContract = {
    ...cw,
    obligations,
    budget,
    attention,
    receipts: [...kept, ...receipts].slice(-80),
    state: cw.lastValidPhase ?? "executing",
    session: { generation: cw.session.generation },
    updatedAt: now,
    touched: cw.touched.map((t) =>
      facts.tenetPaths.includes(t.path) && !configFailed
        ? { ...t, hashAtLastCheck: facts.inv.entries.get(t.path)?.blob ?? "" }
        : t
    ),
    lastCheck: { candidate: facts.candidate, at: now, stage },
    changeTraits: changeTraitsOf(run.ports, st, cw, facts).results,
    ...(stop ? { stopReason: stop } : {}),
    ...(ctx.sealed ? { sealedBaseline: ctx.sealed } : {}),
  };
  const step = nextStep(run, st, nw, receipts, obligations, stop, changes, ctx);
  const q = step.question, pending = q ? [...st.pending.filter((p) => p.id !== q.id), q] : st.pending;
  nw = step.work;
  await snapshot(run, nw, step.reasons);
  if (stage === "integrated" && step.passedAll && nw.git.integrated)
    nw = { ...nw, git: { ...nw.git, integrated: { ...nw.git.integrated, validated: true } } };
  return {
    state: { ...withWork({ ...st, pending }, nw), locks },
    resp: {
      work: nw.id,
      reasons: step.reasons,
      next: step.next,
      data: { ...step.data, ...workload, ...data },
      progress: { phase: "checking", ...(step.passedAll ? { boundary: "milestone" as const } : {}) },
      ...(q ? { exit: 3 as const, questions: [q] } : stop ? { exit: 2 as const } : {}),
    },
  };
}
