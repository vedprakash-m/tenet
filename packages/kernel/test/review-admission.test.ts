import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";
import { gather } from "../src/verbs/facts.ts";
import { issueReview } from "../src/verbs/manifest.ts";
import { buildManifest } from "../src/core/review.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function context() {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "review", lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  const ports = p.ports(), state = ports.store.read()!.state, work = Object.values(state.work)[0]!;
  return { ports, state, work, facts: await gather(ports, work) };
}

describe("review admission [WRK-08, REV-05]", () => {
  it("bounds the entire assignment including its rubric [AGT-04]", async () => {
    const { work, facts } = await context();
    const result = buildManifest({ work, elements: [], changes: [], candidate: facts.candidate, basisHash: work.basis!.hash, attempt: 1, mode: "full", recheckFindings: [], rubric: "x".repeat(80_000), id: work.label, files: {} });
    assert.ok("code" in result && result.code === "narrow-increment");
  });
  it("refuses a third Standard full round before issuing a manifest", async () => {
    const { ports, state, work, facts } = await context();
    const issued = issueReview(ports, state, { ...work, budget: { ...work.budget, reviewRounds: 2 } }, facts, []);
    assert.equal(issued.data, undefined);
    assert.ok(issued.reasons.some(r => r.code === "budget-exhausted"));
    assert.equal(issued.work.budget.reservations.length, 0);
  });
  it("refuses a third retry of one reservation", async () => {
    const { ports, state, work, facts } = await context();
    const first = issueReview(ports, state, work, facts, []);
    const second = issueReview(ports, state, first.work, facts, [], true);
    const third = issueReview(ports, state, second.work, facts, [], true);
    assert.ok(third.data);
    const refused = issueReview(ports, state, third.work, facts, [], true);
    assert.equal(refused.data, undefined);
    assert.ok(refused.reasons.some(r => r.code === "budget-exhausted"));
    assert.equal(refused.work.budget.delegations, third.work.budget.delegations);
  });
});
