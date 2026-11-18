// What a finished check run turns into: the reasons, the next action, the review manifest, and the published contract.
import { changeTraitsOf } from "./facts.ts";
import { executionDisclosures } from "../core/execution-envelope.ts";
import { reason } from "../core/reasons.ts";
import {
  recordCoverageReceipts, stickyCoverageReceipts,
} from "../core/alternative-check.ts";
import type { Receipt, State, WorkContract } from "../core/schemas.ts";
import type { Resp } from "../pipeline.ts";
import { nx, withWork } from "./common.ts";
import { applyLocks, attentionOf, matchBaseline, receiptsOf } from "./check-evidence.ts";
import type { Executed, Run } from "./check-evidence.ts";
import { account } from "./check-account.ts";
import { sealedEvidence } from "./check-sealed.ts";
import { nextCoveredStep, snapshot, workloadEvidence, workloadTrend } from "./check-finalize-outcome.ts";

type Done = { state: State; resp: Resp };

function finalizedState(
  st: State,
  nw: WorkContract,
  pending: State["pending"],
  locks: State["locks"],
): State {
  return {
    ...withWork({ ...st, pending }, nw),
    locks,
  };
}

function stateWithCoverageReceipts(
  state: State,
  work: WorkContract,
  receipts: Receipt[],
  publication: number,
  now: string,
): ReturnType<typeof recordCoverageReceipts> {
  return recordCoverageReceipts(state, work.id, work.basis?.hash ?? "", receipts, publication, now);
}

function retainedReceipts(work: WorkContract, receipts: Receipt[]): Receipt[] {
  const replaced = (receipt: Receipt) =>
    receipts.some((next) => next.obligation === receipt.obligation &&
      next.stage === receipt.stage && next.scope === receipt.scope);
  return work.receipts.filter((receipt) => !replaced(receipt));
}

export async function finalizeCheck(run: Run, st: State, result: unknown, publication: number): Promise<Done> {
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
  const now = ports.clock.now();
  const recorded = stateWithCoverageReceipts(
    st, cw, stickyCoverageReceipts(st, cw.id, cw.basis?.hash ?? "", receiptsOf(run, cw, o)), publication, now,
  );
  const receipts = recorded.receipts;
  const configFailed = receipts.some((r) => r.status === "inconclusive"), matched = matchBaseline(run, cw, receipts);
  const ctx = sealedEvidence(run, cw, o, receipts);
  const { budget, stop } = account(run, cw, o, receipts, configFailed, ctx);
  const { locks, obligations } = applyLocks(run, cw, st.locks, matched, receipts);
  const trend = workloadTrend(run, st, receipts);
  const { changes, attention } = await attentionOf(run, cw, trend?.items ?? null);
  let nw: WorkContract = {
    ...cw,
    obligations,
    budget,
    attention,
    receipts: [...retainedReceipts(cw, receipts), ...receipts].slice(-80),
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
  const evidenced = recorded.state;
  const step = nextCoveredStep(run, evidenced, nw, receipts, obligations, stop, changes, ctx);
  const q = step.question, pending = q ? [...st.pending.filter((p) => p.id !== q.id), q] : st.pending;
  nw = step.work;
  await snapshot(run, nw, step.reasons);
  if (stage === "integrated" && step.passedAll && nw.git.integrated)
    nw = { ...nw, git: { ...nw.git, integrated: { ...nw.git.integrated, validated: true } } };
  return {
    state: finalizedState(evidenced, nw, pending, locks),
    resp: {
      work: nw.id,
      reasons: step.reasons,
      next: step.next,
      data: { ...step.data, ...workloadEvidence(receipts, trend), ...data },
      progress: { phase: "checking", ...(step.passedAll ? { boundary: "milestone" as const } : {}) },
      ...(q ? { exit: 3 as const, questions: [q] } : stop ? { exit: 2 as const } : {}),
    },
  };
}
