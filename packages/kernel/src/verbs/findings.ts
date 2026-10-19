// `findings`: record a review result, bound to its reservation and attempt, and settle the delegation (TS §8.7).
import { recordDelegation, settleReservation } from "../core/budget.ts";
import { reason } from "../core/reasons.ts";
import { applyResult, checkResult } from "../core/review.ts";
import { FindingsInput } from "../core/schemas.ts";
import type { Finding } from "../core/schemas.ts";
import type { Verb } from "../pipeline.ts";
import { nx, withWork, workOf } from "./common.ts";

export const findings: Verb<FindingsInput> = {
  name: "findings",
  schema: FindingsInput,
  class: () => "mutating",

  run(ports, state, input) {
    const w = workOf(state, input.h);
    const r = input.result;
    const chk = checkResult(w, r, w.lane);
    // A result is a native dispatch whether or not it still binds to anything: stale or not, it counts (TS §8.6).
    if (!chk.reservation) {
      const nw = { ...w, budget: recordDelegation(w.budget), updatedAt: ports.clock.now() };
      return { state: withWork(state!, nw), resp: { work: w.id, exit: 2, reasons: chk.reasons, next: [nx("review", "Request a fresh manifest with packet reviewer, then dispatch again.", true)] } };
    }
    const now = ports.clock.now();
    const applied = applyResult(w, r, chk.reservation, now);
    // A basis gap the reviewer reports is a finding against the basis itself, so it needs a disposition like any other.
    const all: Finding[] = [...applied.findings];
    for (const g of applied.basisGaps) {
      const claim = `${g.kind}: ${g.detail}`;
      if (all.some((f) => f.claim === claim)) continue;
      const n = all.length + 1;
      all.push({ id: `FND-${n}`, n, severity: "major", axis: "behavior", location: { path: "basis" }, claim, evidence: "reported by the reviewer as a gap in the basis", state: "valid", history: [{ to: "valid", by: "reviewer", reason: "basis gap", at: now }] });
    }
    const budget = settleReservation(w.budget, chk.reservation.id, { countRound: applied.countRound, recheck: r.mode === "recheck" });
    const nw = { ...w, findings: all, attention: applied.attention, reviews: [...w.reviews, applied.link], budget, updatedAt: now };
    const blocking = all.filter((f) => (f.severity === "blocker" || f.severity === "major") && ["valid", "open", "disputed"].includes(f.state));
    const next = r.status === "partial" || applied.link.uncovered.length ? [nx("review", "The reviewer left parts uncovered; dispatch a follow-up on the uncovered list.", true)]
      : r.status !== "completed" ? [nx("review", `The review ${r.status}; request a retry with packet reviewer --retry.`, true)]
      : blocking.length ? [nx("implement", "Fix the blockers and majors, then check; one focused recheck follows.", true)]
      : [nx("finish", "The review reached this candidate with nothing blocking.")];
    return {
      state: withWork(state!, nw),
      resp: {
        work: w.id, next, progress: { phase: "review", boundary: "milestone" },
        reasons: [...(r.axes.behavior === "fail" || r.axes.structure === "fail" ? [reason("major-undisposed", `reviewer judged ${r.axes.behavior === "fail" ? "behavior" : "structure"}: fail`, { note: true })] : [])],
        data: { status: r.status, recorded: r.findings.length, blocking: blocking.map((f) => ({ id: f.id, severity: f.severity, location: f.location, claim: f.claim })), uncovered: applied.link.uncovered },
      },
    };
  },
};
