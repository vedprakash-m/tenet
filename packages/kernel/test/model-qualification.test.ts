// Deep work on an unqualified or unknown model: one question, continue or pause, and the label never changes (RSC-08, TS §4.8).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project } from "./support/fixture.ts";
import { modelLimit } from "../src/decisions/model-limit.ts";
import { MODEL_LIMIT, modelQuestion, needsModelAnswer } from "../src/verbs/model-limit.ts";
import type { DecisionCtx } from "../src/decisions/types.ts";
import type { WorkContract } from "../src/core/schemas.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const posix = process.platform !== "win32";
const unknown = { requested: "inherited", source: "unknown", qualification: "unknown" } as const;
const work = (over: Partial<WorkContract> = {}) => ({ id: "W1", lane: "deep", model: unknown, basis: null, ...over }) as unknown as WorkContract;
const decide = (w: WorkContract, shown: WorkContract, value: string) =>
  modelLimit.run({ state: { pending: [modelQuestion(shown)], work: { W1: w } }, work: w, input: { answers: { [MODEL_LIMIT]: value } } } as unknown as DecisionCtx);

describe("model warning before Deep work [RSC-08]", () => {
  it("[RSC-08] asks only for Deep work on a model that is not qualified", () => {
    assert.equal(needsModelAnswer(work()), true);
    assert.equal(needsModelAnswer(work({ model: { ...unknown, qualification: "unqualified" } })), true);
    assert.equal(needsModelAnswer(work({ lane: "standard" })), false);
    assert.equal(needsModelAnswer(work({ model: { requested: "m", source: "reported", qualification: "qualified" } })), false);
    const q = modelQuestion(work());
    assert.match(q.question, /hasn't been evaluated for Deep work/);
    assert.deepEqual(q.options!.map((o) => o.description.match(/^Answer: ([a-z]+)/)![1]), ["continue", "pause"]);
    assert.ok(!q.options!.some((o) => /switch|choose a model|another model/i.test(o.label + o.description)), "no model menu or switch suggestion");
  });

  it("[RSC-08] continue records the answer for these facts only and leaves the model label unknown", async () => {
    const plan = (await decide(work(), work(), "continue")) as { state: { pending: unknown[]; work: Record<string, WorkContract> } };
    const w = plan.state.work.W1!;
    assert.equal(plan.state.pending.length, 0);
    assert.equal(w.model?.qualification, "unknown");
    assert.equal(needsModelAnswer(w), false);
    assert.equal(needsModelAnswer({ ...w, model: { requested: "other", source: "reported", qualification: "unknown" } }), true, "a changed model needs a new answer");
  });

  it("[RSC-08] refuses an answer given for different facts, and any answer other than continue or pause", async () => {
    const changed = work({ model: { requested: "other", source: "reported", qualification: "unknown" } });
    await assert.rejects(async () => decide(changed, work(), "continue"), /changed since the question was asked/);
    await assert.rejects(async () => decide(work(), work(), "switch"), /answer "continue" or "pause"/);
  });
});

describe("model warning through the public verbs [RSC-08]", { skip: !posix && "mutating work is refused on Windows" }, () => {
  it("[RSC-08] open and check ask before Deep work; after continue the check runs and the model stays unknown", async () => {
    const p = project();
    roots.push(p.root);
    const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "deep" });
    assert.equal(o.exit, 3, JSON.stringify(o));
    assert.equal(o.questions![0]!.id, MODEL_LIMIT);
    const h = o.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    const asked = await p.call("check", { h, stage: "baseline" });
    assert.equal(asked.exit, 3, JSON.stringify(asked));
    assert.equal(asked.questions![0]!.id, MODEL_LIMIT);
    const a = await p.call("decide", { h, kind: MODEL_LIMIT, answers: { [MODEL_LIMIT]: "continue" } });
    assert.equal(a.exit, 0, JSON.stringify(a));
    assert.notEqual((await p.call("check", { h, stage: "baseline" })).exit, 3);
    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.ok(!green.questions?.some((q) => q.id === MODEL_LIMIT), "one answer covers the work");
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.model?.qualification, "unknown");
  });

  it("[RSC-08] pause parks the work and a standard-lane contract is never asked", async () => {
    const p = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "deep" })).handle!;
    const paused = await p.call("decide", { h, kind: MODEL_LIMIT, answers: { [MODEL_LIMIT]: "pause" } });
    assert.equal(paused.exit, 0, JSON.stringify(paused));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.state, "parked");
    const q = project();
    roots.push(q.root);
    const s = await q.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" });
    assert.ok(!s.questions?.some((x) => x.id === MODEL_LIMIT));
  });
});
