// What a finished check run turns into: the reasons, the next action, the review manifest, and the published contract.
import { attemptsLeft, nearLimit } from "../core/budget.ts";
import { KernelError } from "../core/errors.ts";
import { handoffText } from "../core/handoff.ts";
import { reason } from "../core/reasons.ts";
import { receiptReasons } from "../core/receipts.ts";
import type { FileChange } from "../core/review.ts";
import type { Obligation, Reason, Receipt, State, StopReason, WorkContract } from "../core/schemas.ts";
import type { Resp } from "../pipeline.ts";
import { nx, withWork } from "./common.ts";
import { account, applyLocks, attentionOf, matchBaseline, receiptsOf } from "./check-evidence.ts";
import type { Executed, Run } from "./check-evidence.ts";
import { issueReview } from "./manifest.ts";

type Next = Array<ReturnType<typeof nx>>;
type Done = { state: State; resp: Resp };

interface Outcome {
  reasons: Reason[];
  next: Next;
  data: Record<string, unknown>;
  work: WorkContract;
}

/** A failed receipt is a reason to fix, except on the baseline where a planned red is expected; others say why they proved nothing. */
function evidenceReasons(receipts: Receipt[], baseline: boolean): Reason[] {
  return receipts.flatMap((r) => {
    if (r.status === "pass" && r.qualifiers.includes("flaky")) return [reason("evidence-flaky", r.obligation, { refs: [r.obligation] })];
    if (r.status !== "fail") return receiptReasons(r);
    const tests = (r.failures ?? []).map((f) => f.test).slice(0, 3).join(", ");
    return baseline ? [] : [reason("evidence-failed", `${r.obligation}: ${tests}`, { refs: [r.obligation] })];
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
  changes: FileChange[]
): Outcome & { passedAll: boolean } {
  const { baseline, scope, stage } = run;
  const failing = receipts.filter((r) => r.status === "fail");
  const configFailed = receipts.some((r) => r.status === "inconclusive");
  const flaky = receipts.some((r) => r.qualifiers.includes("flaky"));
  const passedAll =
    !baseline &&
    !flaky &&
    scope === "full" &&
    receipts.length > 0 &&
    receipts.every((r) => r.status === "pass") &&
    nw.obligations.every((ob) => receipts.some((r) => r.obligation === ob.id));
  const reasons = evidenceReasons(receipts, baseline);
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
  return { reasons, next, data, work, passedAll };
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
      },
    };
  }
  const receipts = receiptsOf(run, cw, o);
  const configFailed = receipts.some((r) => r.status === "inconclusive");
  const matched = matchBaseline(run, cw, receipts);
  const { budget, stop } = account(run, cw, o, receipts, configFailed);
  const { locks, obligations } = applyLocks(run, cw, st.locks, matched, receipts);
  const { changes, attention } = await attentionOf(run, cw);
  const now = ports.clock.now();
  const kept = cw.receipts.filter(
    (r) => !receipts.some((n) => n.obligation === r.obligation && n.stage === r.stage && n.scope === r.scope)
  );
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
    ...(stop ? { stopReason: stop } : {}),
  };
  const step = nextStep(run, st, nw, receipts, obligations, stop, changes);
  nw = step.work;
  await snapshot(run, nw, step.reasons);
  const nearBudgetLimit = nearLimit(nw.budget, nw.lane, ports.clock.now());
  if (nearBudgetLimit) step.reasons.push(reason("budget-warning", "80% of a limit is used", { note: true }));
  // At a stop, and at 80% of any limit, the handoff is written while there is still budget to write it (WRK-12).
  if (stop || nearBudgetLimit) nw = { ...nw, handoff: handoffText(withWork(st, nw), nw) };
  if (stage === "integrated" && step.passedAll && nw.git.integrated)
    nw = { ...nw, git: { ...nw.git, integrated: { ...nw.git.integrated, validated: true } } };
  return {
    state: { ...withWork(st, nw), locks },
    resp: {
      work: nw.id,
      reasons: step.reasons,
      next: step.next,
      data: step.data,
      progress: { phase: "checking", ...(step.passedAll ? { boundary: "milestone" as const } : {}) },
      ...(stop ? { exit: 2 as const } : {}),
    },
  };
}
