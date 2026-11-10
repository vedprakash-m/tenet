// A dirty-file answer covers only the files the question showed; a file added since then needs a new question.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dirtyOverlap } from "../src/decisions/simple.ts";
import { dirtyQuestion, leftOutChanged, settleCleaned } from "../src/verbs/dirty.ts";
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

const answer = (value: string) => {
  const w = work(["src/a.ts"]);
  const state = { pending: [dirtyQuestion(["src/a.ts"])], work: { W1: w } };
  return dirtyOverlap.run({ state, work: w, input: { answers: { "dirty-overlap": value } } } as unknown as DecisionCtx) as {
    state: { pending: unknown[]; work: Record<string, { includeDirty: string[]; keepOut: string[]; leaveOut?: string[] }> };
    resp: { data: Record<string, unknown> };
  };
};

describe("dirty-overlap choices (UX J-03b)", () => {
  it("[GIT-10] offers wait (recommended), include and leave-out, naming every file", () => {
    const q = dirtyQuestion(["d.ts", "c.ts", "b.ts", "a.ts"]);
    assert.match(q.question, /a\.ts, b\.ts, c\.ts, d\.ts/);
    assert.deepEqual(q.options!.map((o) => o.description.match(/^Answer: ([a-z-]+)/)![1]), ["wait", "include", "leave-out"]);
    assert.equal(q.options![0]!.recommended, true);
  });

  it("[GIT-10] wait records no decision and closes the question, so the next check asks again", () => {
    const plan = answer("wait");
    assert.deepEqual(plan.state.pending, []);
    assert.deepEqual([plan.state.work.W1!.includeDirty, plan.state.work.W1!.keepOut, plan.state.work.W1!.leaveOut], [[], [], undefined], "no decision is recorded");
    assert.deepEqual(plan.resp.data.waiting, ["src/a.ts"]);
  });

  it("[GIT-10] leave-out keeps the file out of the commit and out of Tenet's edits", () => {
    const w = answer("leave-out").state.work.W1!;
    assert.deepEqual([w.keepOut, w.leaveOut, w.includeDirty], [["src/a.ts"], ["src/a.ts"], []]);
  });

  it("refuses an unknown answer and names the three choices", () => {
    assert.throws(() => answer("sure"), /"wait", "include" or "leave-out"/);
  });

  it("[GIT-10] a file the user committed while Tenet waited stops being human-dirty; a left-out file may not change", () => {
    const w = work(["src/a.ts", "src/b.ts"]) as unknown as Parameters<typeof settleCleaned>[0];
    const settled = settleCleaned(w, new Set(["src/b.ts"]));
    assert.deepEqual(settled.git.start.dirty.map((e) => e.path), ["src/b.ts"]);
    assert.equal(settleCleaned(w, new Set(["src/a.ts", "src/b.ts"])), w, "nothing to settle");
    const left = { ...w, touched: [], leaveOut: ["src/a.ts"], git: { start: { dirty: [{ path: "src/a.ts", blob: "x" }] } } } as unknown as typeof w;
    assert.deepEqual(leftOutChanged(left, () => "x"), []);
    assert.deepEqual(leftOutChanged(left, () => "y"), ["src/a.ts"]);
    assert.deepEqual(leftOutChanged({ ...left, touched: [{ path: "src/a.ts" }] }, () => "x"), ["src/a.ts"]);
  });
});
