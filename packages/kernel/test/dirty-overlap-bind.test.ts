// A dirty-file answer covers only the files the question showed; a file added since then needs a new question.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirtyOverlap } from "../src/decisions/simple.ts";
import { dirtyQuestion } from "../src/verbs/dirty.ts";
import type { DecisionCtx } from "../src/decisions/types.ts";

const work = (dirty: string[]) => ({
  id: "W1", includeDirty: [], keepOut: [], touched: dirty.map((path) => ({ path })), scope: { paths: [] },
  git: { start: { dirty: dirty.map((path) => ({ path })) } }, basis: null,
});
const run = (shown: string[], now: string[]) => {
  const w = work(now);
  const state = { pending: [dirtyQuestion(shown)], work: { W1: w } };
  return () => dirtyOverlap.run({ state, work: w, input: { answers: { "dirty-overlap": "include" } } } as unknown as DecisionCtx);
};

describe("dirty-overlap answer binding", () => {
  it("[GIT-10] refuses an answer when a dirty file was added after the question", () => {
    assert.throws(run(["src/a.ts"], ["src/a.ts", "src/b.ts"]), /changed since the question was asked/);
  });

  it("[GIT-10] applies the answer to exactly the files shown", () => {
    const plan = run(["src/b.ts", "src/a.ts"], ["src/a.ts", "src/b.ts"])() as { resp: { data: { decided: string[] } } };
    assert.deepEqual(plan.resp.data.decided, ["src/a.ts", "src/b.ts"]);
  });
});
