import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { contractFixture, project, reviewResult } from "./support/fixture.ts";
import { cleanup } from "./helpers.ts";
import { emptyState } from "../src/core/state.ts";
import { FindingsInput, StopInput, type State, type WorkContract } from "../src/core/schemas.ts";
import { findings } from "../src/verbs/findings.ts";
import { stop, stopWork } from "../src/verbs/stop.ts";
import { handleOf } from "../src/verbs/common.ts";
import { stamp } from "../src/pipeline-render.ts";
import type { Resp, Verb } from "../src/pipeline.ts";
import type { Tx } from "../src/ports/types.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const NOW = "2026-11-04T10:00:00.000Z";

function fixture(work: WorkContract) {
  const p = project(); roots.push(p.root);
  const ports = { ...p.ports(), clock: { now: () => NOW, ms: () => Date.parse(NOW) } };
  const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } };
  let published: State | undefined;
  const unused = (): never => { throw new Error("unexpected transaction operation"); };
  const tx: Tx = {
    state, recovered: false, ensure: unused, publish: next => { published = next; },
    call: () => {}, intent: unused, result: unused, unresolved: () => [], evict: unused, recent: unused,
  };
  const publish = (next = state, resp: Resp = { work: work.id }, final = true, verb: Verb = findings) => {
    const response = stamp(ports, verb, {}, null, tx, next, resp, final, NOW);
    return { response, work: published!.work[work.id]!, published: published! };
  };
  return { ports, state, tx, publish };
}

describe("shared budget publication [WRK-08, WRK-12]", () => {
  it("warns and preserves a handoff when a review settles at five of six delegations", async () => {
    const work = contractFixture({ label: "W-0001" });
    const reservation = {
      id: "RV-review", role: "reviewer" as const, manifest: "review.json", manifestHash: "review-hash",
      candidate: "candidate", basisHash: "basis", attempt: 5, mode: "full" as const, files: {},
    };
    work.budget = { ...work.budget, delegations: 4, reservations: [reservation] };
    const f = fixture(work);
    const before = structuredClone(f.state);
    const plan = await findings.run(f.ports, f.state, FindingsInput.parse({
      h: handleOf(f.state, work),
      result: reviewResult({ review: {
        hash: reservation.manifestHash, reservation: reservation.id, attempt: 5, mode: "full", files: [],
      } }),
    }));
    const out = f.publish(plan.state!, plan.resp);
    assert.equal(out.work.budget.delegations, 5);
    assert.equal(out.work.reviews.at(-1)!.status, "completed");
    assert.equal(out.response.reasons.filter(r => r.code === "budget-warning").length, 1);
    assert.match(out.work.handoff ?? "", /delegations 5\/6/);
    assert.deepEqual(f.state, before, "publication preserves the input state");
  });

  it("does not warn or create a handoff below every threshold", () => {
    const work = contractFixture();
    work.budget.delegations = 4;
    const out = fixture(work).publish();
    assert.ok(!out.response.reasons.some(r => r.code === "budget-warning"));
    assert.equal(out.work.handoff, undefined);
  });

  it("warns when an analyst settles without losing its stale-source disclosure", async () => {
    const work = contractFixture({ label: "W-0001" });
    const reservation = {
      id: "RV-analysis", role: "analyst" as const, analystRole: "researcher" as const,
      manifest: "analysis.json", manifestHash: "analysis-hash", candidate: "earlier", basisHash: "basis",
      attempt: 5, mode: "full" as const, files: {},
    };
    work.budget = { ...work.budget, delegations: 4, reservations: [reservation] };
    const f = fixture(work);
    const plan = await findings.run(f.ports, f.state, FindingsInput.parse({
      h: handleOf(f.state, work),
      result: {
        kind: "analyst", manifest: reservation.manifestHash, reservation: reservation.id, attempt: 5,
        role: "researcher", revision: "earlier", status: "completed", dispatchMode: "subagent-fresh",
        artifacts: [], findings: [], openDependencies: [],
      },
    }));
    const out = f.publish(plan.state!, plan.resp);
    assert.equal(out.work.budget.delegations, 5);
    assert.equal(out.work.analyses.at(-1)!.stale, true);
    assert.ok(out.response.reasons.some(r => r.code === "stale"));
    assert.ok(out.response.reasons.some(r => r.code === "budget-warning"));
    assert.match(out.work.handoff ?? "", /delegations 5\/6/);
  });

  it("includes live analyst reservations at publication without counting a dispatch", () => {
    const work = contractFixture();
    work.budget = { ...work.budget, delegations: 4, reservations: [{
      id: "RV-analysis", role: "analyst", manifest: "analysis.json", manifestHash: "hash",
      candidate: "candidate", basisHash: "basis", attempt: 5, mode: "full", files: {},
    }] };
    const out = fixture(work).publish();
    assert.ok(out.response.reasons.some(r => r.code === "budget-warning"));
    assert.ok(out.work.handoff);
    assert.equal(out.work.budget.delegations, 4);
    assert.deepEqual(out.work.budget.reservations, work.budget.reservations);
  });

  it("uses accrued active time before deciding the warning", () => {
    const work = contractFixture();
    work.budget = { ...work.budget, activeMinutesSinceCheckIn: 47,
      lastCall: { at: "2026-11-04T09:59:00.000Z", exit: 0 } };
    const out = fixture(work).publish();
    assert.equal(out.work.budget.activeMinutesSinceCheckIn, 48);
    assert.ok(out.response.reasons.some(r => r.code === "budget-warning"));
    assert.ok(out.work.handoff);
  });

  it("preserves a threshold-crossing warning when a milestone resets the active interval", () => {
    const work = contractFixture();
    work.budget = { ...work.budget, activeMinutesSinceCheckIn: 47,
      lastCall: { at: "2026-11-04T09:59:00.000Z", exit: 0 } };
    const out = fixture(work).publish(undefined, { work: work.id, progress: { phase: "green", boundary: "milestone" } });
    assert.equal(out.work.budget.activeMinutesSinceCheckIn, 0);
    assert.ok(out.response.reasons.some(r => r.code === "budget-warning"));
    assert.ok(out.work.handoff);
  });

  it("preserves a stop handoff below the warning threshold and does not duplicate a warning", () => {
    const work = contractFixture({ stopReason: "repeated-failure" });
    const f = fixture(work);
    const stopped = f.publish();
    assert.match(stopped.work.handoff ?? "", /stopped: repeated-failure/);
    assert.ok(!stopped.response.reasons.some(r => r.code === "budget-warning"));
    work.budget.delegations = 5;
    const out = fixture(work).publish(undefined, { work: work.id,
      reasons: [{ code: "budget-warning", message: "Already warned", note: true }] });
    assert.equal(out.response.reasons.filter(r => r.code === "budget-warning").length, 1);
    assert.ok(out.work.handoff);
  });

  it("publishes the same current-state handoff returned by a stop", async () => {
    for (const mode of ["pause", "cancel", "abandon"] as const) {
      const work = contractFixture({ label: "W-0001" });
      const f = fixture(work);
      const input = StopInput.parse({ h: handleOf(f.state, work), mode });
      let plan = await stopWork(f.ports, f.state, input, f.tx);
      if (mode === "abandon") {
        assert.equal(plan.resp.exit, 3);
        plan = await stopWork(f.ports, plan.state!, { ...input, answers: { "abandon-confirm": "abandon" } }, f.tx);
      }
      const out = f.publish(plan.state!, plan.resp, true, stop);
      assert.equal(out.work.state, mode === "pause" ? "parked" : mode === "abandon" ? "cancelled" : work.state);
      assert.equal((out.response.data as { handoff: string }).handoff, out.work.handoff, mode);
      assert.ok(out.work.handoff?.split("\n")[0]?.includes(`· ${out.work.state}`), mode);
      if (mode !== "pause") assert.match(out.work.handoff ?? "", /stopped: user-stop/);
    }
  });

  it("does not turn a provisional job response into a final warning or handoff", () => {
    const work = contractFixture();
    work.budget.delegations = 5;
    const out = fixture(work).publish(undefined, undefined, false);
    assert.equal(out.work.handoff, undefined);
    assert.ok(!out.response.reasons.some(r => r.code === "budget-warning"));
  });

  it("publishes the warning, handoff and cached response together without changing another contract", () => {
    const work = contractFixture();
    work.budget.delegations = 5;
    const f = fixture(work);
    const other = contractFixture({ id: "another" });
    f.state.work[other.id] = other;
    const before = structuredClone(other);
    const out = f.publish();
    assert.deepEqual(out.published.work[other.id], before);
    assert.deepEqual(out.work.session.last!.response, out.response);
    assert.ok(out.work.handoff);
    assert.ok(out.work.session.last!.response.reasons.some(r => r.code === "budget-warning"));
  });
});
