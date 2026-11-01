import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { newBudget, summarize } from "../src/core/budget.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("per-contract usage reporting [RSC-04]", () => {
  it("reports all required counts while preserving lane-limit summaries", () => {
    const budget = {
      ...newBudget(),
      attempts: 2,
      reviewRounds: 1,
      delegations: 3,
      checksLaunched: 4,
      activeMinutesTotal: 5.5,
    };

    assert.deepEqual(summarize(budget, "standard"), {
      attempts: "2/3",
      rounds: "1/2",
      delegations: "3/6",
      attemptCount: 2,
      reviewRoundCount: 1,
      delegationCount: 3,
      checksLaunched: 4,
      activeMinutesTotal: 5.5,
    });
  });

  it("includes the same counters in the work response, status view and completed result [RSC-04]", async () => {
    const p = project();
    roots.push(p.root);
    const opened = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"] });
    const h = opened.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const finished = await finishFixture(p, { h, noCommit: true });

    const state = p.ports().store.read()!.state;
    const work = Object.values(state.work)[0]!;
    const expected = summarize(work.budget, work.lane);
    assert.deepEqual(finished.data && (finished.data as { usage?: unknown }).usage, expected);

    const status = await p.call("inspect", { view: "status" });
    const statusWork = (status.data as { work: Array<{ budget: unknown }> }).work[0]!;
    assert.deepEqual(statusWork.budget, expected);
  });
});
