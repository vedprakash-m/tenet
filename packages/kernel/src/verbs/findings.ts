// `findings`: record a reviewer's or an analyst's result (TS §8.7, §5.5). A reviewer result is bound to its
// reservation, attempt and review chain; an analyst result is simpler (AGT-03/05/11): no axes, coverage or
// disposition state machine, since an analyst only reports and the kernel never judges its findings.
import { recordDelegation, settleReservation } from "../core/budget.ts";
import { reason } from "../core/reasons.ts";
import { applyAnalystResult, applyResult, checkAnalystResult, checkResult } from "../core/review.ts";
import { FindingsInput } from "../core/schemas.ts";
import type { AnalystResult, Finding, ReviewResult, State, WorkContract } from "../core/schemas.ts";
import type { Plan, Verb } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { nx, withWork, workOf } from "./common.ts";
import { gather } from "./facts.ts";
import { deepPasses } from "./manifest.ts";

async function recordAnalyst(ports: Ports, state: State, w: WorkContract, r: AnalystResult): Promise<Plan> {
  const chk = checkAnalystResult(w, r);
  if (!chk.reservation) {
    const dispatched = r.dispatchMode === "same-session" ? w.budget : recordDelegation(w.budget);
    const nw = { ...w, budget: dispatched, updatedAt: ports.clock.now() };
    const next = [nx("analyst", "Request a fresh packet with packet analyst, then dispatch again.", true)];
    return { state: withWork(state, nw), resp: { work: w.id, exit: 2, reasons: chk.reasons, next } };
  }
  const now = ports.clock.now();
  const currentCandidate = (await gather(ports, w)).candidate;
  const applied = applyAnalystResult(r, chk.reservation, currentCandidate);
  const settled = { countRound: false, recheck: false, native: r.dispatchMode === "subagent-fresh" };
  const budget = settleReservation(w.budget, chk.reservation.id, settled);
  const nw = { ...w, analyses: [...w.analyses, applied.link], budget, updatedAt: now };
  // Partial output never counts as a completed answer (AGT-05): dispatch again, never proceed as if settled.
  const next = r.status !== "completed"
    ? [nx("analyst", `The analyst's result is ${r.status}, not complete; request a retry with packet analyst.`, true)]
    : [];
  const stale = applied.link.stale;
  const staleNote = "the source changed since this analyst observed it; its findings may be outdated";
  return {
    state: withWork(state, nw),
    resp: {
      work: w.id, next,
      reasons: stale ? [reason("stale", staleNote, { note: true })] : [],
      data: {
        status: r.status, role: r.role, recorded: r.findings.length, artifacts: r.artifacts,
        openDependencies: applied.link.openDependencies,
        ...(r.sketch ? { sketch: r.sketch } : {}), ...(r.decisionRecord ? { decisionRecord: r.decisionRecord } : {}),
      },
    },
  };
}

function recordReview(ports: Ports, state: State, w: WorkContract, r: ReviewResult): Plan {
  const chk = checkResult(w, r, w.lane);
  // Every reported native dispatch counts, including a stale result; a same-session pass is never a delegation.
  if (!chk.reservation) {
    const dispatched = r.dispatchMode === "same-session" ? w.budget : recordDelegation(w.budget);
    const nw = { ...w, budget: dispatched, updatedAt: ports.clock.now() };
    const next = [nx("review", "Request a fresh manifest with packet reviewer, then dispatch again.", true)];
    return { state: withWork(state, nw), resp: { work: w.id, exit: 2, reasons: chk.reasons, next } };
  }
  const now = ports.clock.now();
  const applied = applyResult(w, r, chk.reservation, now);
  // A basis gap the reviewer reports is a finding against the basis itself, so it needs a disposition like any other.
  const all: Finding[] = [...applied.findings];
  for (const g of applied.basisGaps) {
    const claim = `${g.kind}: ${g.detail}`;
    if (all.some((f) => f.claim === claim)) continue;
    const n = all.length + 1;
    all.push({
      id: `FND-${n}`, n, severity: "major", axis: "behavior", location: { path: "basis" }, claim,
      evidence: "reported by the reviewer as a gap in the basis", state: "valid",
      history: [{ to: "valid", by: "reviewer", reason: "basis gap", at: now }],
    });
  }
  const settled = { countRound: applied.countRound, recheck: r.mode === "recheck", native: r.dispatchMode === "subagent-fresh" };
  const budget = settleReservation(w.budget, chk.reservation.id, settled);
  const nw = {
    ...w, findings: all, attention: applied.attention, reviews: [...w.reviews, applied.link], budget,
    focusedReview: undefined, updatedAt: now,
  };
  const isBlocking = (f: Finding) =>
    (f.severity === "blocker" || f.severity === "major") && ["valid", "open", "disputed"].includes(f.state);
  const blocking = all.filter(isBlocking);
  const action = w.lane === "quick" ? "focused-review" : "review";
  const next = r.status === "partial" || applied.link.uncovered.length
    ? [nx(action, "The review left parts uncovered; request a follow-up manifest for the uncovered list.", true)]
    : r.status !== "completed" ? [nx(action, `The review ${r.status}; request a retry with packet reviewer --retry.`, true)]
    : blocking.length ? [nx("implement", "Fix the blockers and majors, then check; one focused recheck follows.", true)]
    : [...deepPasses(nw, applied.link.candidate), nx("finish", "The review reached this candidate with nothing blocking.")];
  const failedAxis = r.axes.behavior === "fail" ? "behavior" : "structure";
  return {
    state: withWork(state, nw),
    resp: {
      work: w.id, next, progress: { phase: "review", boundary: "milestone" },
      reasons: r.axes.behavior === "fail" || r.axes.structure === "fail"
        ? [reason("major-undisposed", `reviewer judged ${failedAxis}: fail`, { note: true })] : [],
      data: {
        status: r.status, recorded: r.findings.length,
        blocking: blocking.map((f) => ({ id: f.id, severity: f.severity, location: f.location, claim: f.claim })),
        uncovered: applied.link.uncovered,
      },
    },
  };
}

export const findings: Verb<FindingsInput> = {
  name: "findings",
  schema: FindingsInput,
  class: () => "mutating",

  run(ports, state, input) {
    const w = workOf(state, input.h);
    return input.result.kind === "analyst" ? recordAnalyst(ports, state!, w, input.result) : recordReview(ports, state!, w, input.result);
  },
};
