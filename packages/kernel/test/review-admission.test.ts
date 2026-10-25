import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, project, reviewResult } from "./support/fixture.ts";
import { gather } from "../src/verbs/facts.ts";
import { issueReview } from "../src/verbs/manifest.ts";
import { findings } from "../src/verbs/findings.ts";
import { FindingsInput } from "../src/core/schemas.ts";
import { buildManifest, estimateTokens, reviewOnlyManifest, TOKEN_BUDGET } from "../src/core/review.ts";
import { KernelError } from "../src/core/errors.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function context() {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "review", lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  const ports = p.ports(), state = ports.store.read()!.state, work = Object.values(state.work)[0]!;
  return { ports, state, work, h, facts: await gather(ports, work) };
}

describe("review admission [WRK-08, REV-05]", () => {
  it("refuses an oversized complete review-only assignment [AGT-04]", () => {
    assert.throws(() => reviewOnlyManifest([], [], "x".repeat(80_000), null), error => {
      assert.ok(error instanceof KernelError);
      assert.equal(error.exit, 2);
      assert.equal(error.reasons[0]?.code, "narrow-increment");
      assert.ok(error.next?.some(next => next.action === "ask" && /narrow/i.test(next.why) && next.required));
      return true;
    });
  });
  it("preserves a small complete review-only assignment [AGT-04]", () => {
    const rubric = "Review correctness and security.\n".repeat(12);
    const changes = [{ path: "src/example.ts", kind: "source" as const, added: 2, removed: 1, hunks: [] }];
    const attention = [{ id: "AT-example", path: "src/example.ts", line: 1, pattern: "as any", marker: true }];
    const result = reviewOnlyManifest(changes, attention, rubric, "head");
    const packet = JSON.parse(result.text);
    assert.equal(packet.rubric.join(""), rubric);
    assert.deepEqual(packet.changes, [{ path: "src/example.ts", kind: "source", added: 2, removed: 1 }]);
    assert.deepEqual(packet.attention, attention);
    assert.deepEqual(packet.investigation, ["src/example.ts"]);
    assert.equal(result.tokens, estimateTokens(result.text));
    assert.ok(result.tokens < TOKEN_BUDGET);
  });
  it("accepts exactly the review-only token bound and refuses one character more [AGT-04]", () => {
    const rubric = "x".repeat(1_000);
    const emptyHead = reviewOnlyManifest([], [], rubric, "");
    const maxLength = Math.floor(TOKEN_BUDGET * 4 / 1.1);
    const head = "h".repeat(maxLength - emptyHead.text.length);
    const result = reviewOnlyManifest([], [], rubric, head);
    assert.equal(result.text.length, maxLength);
    assert.equal(result.tokens, TOKEN_BUDGET);
    assert.equal(JSON.parse(result.text).identity.base, head);
    assert.equal(JSON.parse(result.text).rubric.join(""), rubric);
    assert.equal(estimateTokens(result.text + "h"), TOKEN_BUDGET + 1);
    assert.throws(() => reviewOnlyManifest([], [], rubric, head + "h"), error => {
      assert.ok(error instanceof KernelError);
      assert.equal(error.reasons[0]?.code, "narrow-increment");
      assert.equal(error.exit, 2);
      return true;
    });
  });
  it("bounds the entire assignment including its rubric [AGT-04]", async () => {
    const { work, facts } = await context();
    const result = buildManifest({ work, elements: [], changes: [], candidate: facts.candidate, basisHash: work.basis!.hash, attempt: 1, mode: "full", recheckFindings: [], rubric: "x".repeat(80_000), id: work.label, files: {}, charter: "" });
    assert.ok("code" in result && result.code === "narrow-increment");
  });
  it("refuses a third Standard full round before issuing a manifest", async () => {
    const { ports, state, work, facts } = await context();
    const issued = issueReview(ports, state, { ...work, budget: { ...work.budget, reviewRounds: 2 } }, facts, []);
    assert.equal(issued.data, undefined);
    assert.ok(issued.reasons.some(r => r.code === "budget-exhausted"));
    assert.equal(issued.work.budget.reservations.length, 0);
  });
  for (const rounds of [0, 1]) {
    it(`shares one round across three-path split coverage starting at ${rounds} rounds [REV-08, WRK-08]`, async () => {
      const { ports, state, work, h, facts } = await context();
      const paths = ["src/greet.ts", "package.json", "tsconfig.json"];
      let current = { ...work, budget: { ...work.budget, reviewRounds: rounds } };
      for (const opened of [1, 2, 3]) {
        const issued = issueReview(ports, state, current, { ...facts, reviewPaths: paths }, []);
        assert.ok(issued.data, `coverage dispatch ${opened} must be admitted`);
        const plan = await findings.run(ports, { ...state, work: { ...state.work, [current.id]: issued.work } }, FindingsInput.parse({
          h, result: reviewResult(issued.data, {
            status: opened === 1 ? "partial" : "completed",
            coverage: { inspected: paths.slice(0, opened), uncovered: [], crossCutting: "source and configuration checked", sampled: [] },
          }),
        }));
        current = plan.state!.work[current.id]!;
        assert.equal(current.budget.reviewRounds, rounds + 1, `coverage result ${opened} shares the round`);
        assert.equal(current.budget.delegations, opened);
        assert.equal(current.budget.reservations.length, 0);
        assert.equal(current.reviews.at(-1)!.status, opened === 3 ? "completed" : "partial");
        assert.deepEqual(current.reviews.at(-1)!.uncovered, paths.slice(opened));
      }
    });
  }
  it("does not complete a review by combining disjoint split coverage [REV-08]", async () => {
    const { ports, state, work, h, facts } = await context();
    const paths = ["src/greet.ts", "package.json", "tsconfig.json"];
    let current = work;
    for (const path of paths) {
      const issued = issueReview(ports, state, current, { ...facts, reviewPaths: paths }, []);
      assert.ok(issued.data);
      const plan = await findings.run(ports, { ...state, work: { ...state.work, [work.id]: issued.work } }, FindingsInput.parse({
        h, result: reviewResult(issued.data, {
          coverage: { inspected: [path], uncovered: [], crossCutting: "source and configuration checked", sampled: [] },
        }),
      }));
      current = plan.state!.work[work.id]!;
      assert.equal(current.reviews.at(-1)!.status, "partial");
      assert.deepEqual(current.reviews.at(-1)!.uncovered, paths.filter(other => other !== path));
      assert.equal(current.budget.reviewRounds, 1);
      assert.ok(!plan.resp.next?.some(next => next.action === "finish"));
    }
  });
  it("gives three Quick partial splits distinct identities and rejects an old result [REV-08, WRK-08]", async () => {
    const { ports, state, work, h, facts } = await context();
    let current = { ...work, lane: "quick" as const };
    const results = [];
    for (const opened of [1, 2, 3]) {
      const issued = issueReview(ports, state, current, facts, []);
      assert.ok(issued.data, `Quick split ${opened} must be admitted`);
      const liveState = { ...state, work: { ...state.work, [work.id]: issued.work } };
      const result = reviewResult(issued.data, { status: "partial", dispatchMode: "same-session" });
      if (opened === 3) {
        const stale = await findings.run(ports, liveState, FindingsInput.parse({ h, result: results[1] }));
        assert.equal(stale.resp.exit, 2, "the previous split must not settle the live assignment");
        assert.ok(stale.resp.reasons?.some(reason => reason.code === "review-stale"));
        assert.deepEqual(stale.state!.work[work.id]!.focusedReview, issued.work.focusedReview);
        assert.equal(stale.state!.work[work.id]!.reviews.length, 2);
      }
      results.push(result);
      const plan = await findings.run(ports, liveState, FindingsInput.parse({ h, result }));
      current = plan.state!.work[work.id]! as typeof current;
      assert.equal(current.budget.reviewRounds, 1);
      assert.equal(current.budget.delegations, 0);
      assert.equal(current.budget.reservations.length, 0);
      assert.equal(current.focusedReview, undefined);
      assert.equal(current.reviews.at(-1)!.status, "partial");
    }
    for (const field of ["reservation", "attempt", "manifest"] as const) {
      assert.equal(new Set(results.map(result => result[field])).size, 3, `${field} must identify each split`);
    }
    for (const changed of ["candidate", "basis"] as const) {
      const changedWork = changed === "basis" ? { ...current, basis: { ...current.basis!, hash: "changed-basis" } } : current;
      const changedFacts = changed === "candidate" ? { ...facts, candidate: "changed-candidate" } : facts;
      const refused = issueReview(ports, state, changedWork, changedFacts, []);
      assert.equal(refused.data, undefined, `${changed} changes require a new Quick round`);
      assert.ok(refused.reasons.some(reason => reason.code === "budget-exhausted"));
    }
  });
  it("does not exempt changed candidates, changed bases or exhausted delegations [REV-08, WRK-08]", async () => {
    const { ports, state, work, h, facts } = await context();
    const first = issueReview(ports, state, { ...work, budget: { ...work.budget, reviewRounds: 1 } }, facts, []);
    assert.ok(first.data);
    const plan = await findings.run(ports, { ...state, work: { ...state.work, [work.id]: first.work } }, FindingsInput.parse({
      h, result: reviewResult(first.data, { status: "partial" }),
    }));
    const partial = plan.state!.work[work.id]!;
    assert.equal(partial.budget.reviewRounds, 2);
    for (const changed of ["candidate", "basis"] as const) {
      const current = changed === "basis" ? { ...partial, basis: { ...partial.basis!, hash: "changed-basis" } } : partial;
      const observed = changed === "candidate" ? { ...facts, candidate: "changed-candidate" } : facts;
      const refused = issueReview(ports, state, current, observed, []);
      assert.equal(refused.data, undefined, `${changed} changes require a new round`);
      assert.ok(refused.reasons.some(reason => reason.code === "budget-exhausted"));
      assert.equal(refused.work.budget.reservations.length, 0);
    }
    const exhausted = { ...partial, budget: { ...partial.budget, delegations: 6 } };
    const refused = issueReview(ports, state, exhausted, facts, []);
    assert.equal(refused.data, undefined);
    assert.ok(refused.next.some(next => next.action === "stop" && /delegation/.test(next.why)));
    assert.equal(refused.work.budget.delegations, 6);
    assert.equal(refused.work.budget.reservations.length, 0);
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
