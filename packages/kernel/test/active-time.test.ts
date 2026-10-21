// Active work time between check-ins: call durations plus gaps after exit 0, never the waits after a question (WRK-08, TS §8.6).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_TEST, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

const clock = () => {
  let t = Date.parse("2026-10-21T09:00:00.000Z");
  return { advance: (minutes: number) => { t += minutes * 60_000; }, now: () => new Date(t).toISOString(), ms: () => t };
};
type Clock = ReturnType<typeof clock>;
const rig = () => {
  const p = project();
  roots.push(p.root);
  const c = clock();
  const call = (verb: string, input: Record<string, unknown> = {}) => runVerb({ ...p.ports(), clock: c }, VERBS, verb, input);
  const budget = () => Object.values(p.ports().store.read()!.state.work)[0]!.budget;
  return { p, c, call, budget };
};
const open = (r: ReturnType<typeof rig>, lane = "quick") => r.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane });
const asks = { ...BASIS, elements: [...BASIS.elements, { kind: "assumption", origin: "tenet", text: "names are plain strings" }] };
void (null as unknown as Project | Clock);

describe("active work time [WRK-08]", () => {
  it("counts the gap after a call that said to keep working", async () => {
    const r = rig();
    const h = (await open(r)).handle!;
    r.c.advance(10);
    await r.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.budget().activeMinutesTotal, 10);
    assert.equal(r.budget().activeMinutesSinceCheckIn, 0, "accepting the basis is a milestone, so a check-in");
    r.p.write("src/greet.test.ts", GREET_TEST);
    r.c.advance(3);
    await r.call("check", { h, stage: "baseline" });
    assert.equal(r.budget().activeMinutesSinceCheckIn, 3);
  });

  it("does not count the wait after a question, and a question starts a new interval", async () => {
    const r = rig();
    const h = (await open(r)).handle!;
    r.c.advance(5);
    const asked = await r.call("decide", { h, kind: "basis", propose: asks });
    assert.equal(asked.exit, 3, JSON.stringify(asked));
    assert.equal(r.budget().activeMinutesSinceCheckIn, 0, "a question is a check-in");
    assert.equal(r.budget().activeMinutesTotal, 5);
    r.c.advance(40); // the user was thinking
    await r.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.budget().activeMinutesTotal, 5, "the 40-minute wait is not work time");
    r.c.advance(4);
    await r.call("decide", { h, kind: "basis", propose: { ...BASIS, outcome: "greet(name) returns a friendly greeting, revised" } });
    assert.equal(r.budget().activeMinutesTotal, 9);
  });

  it("warns at 80% and refuses a new candidate attempt at the bound, until the user extends", async () => {
    const r = rig();
    const h = (await open(r)).handle!;
    await r.call("decide", { h, kind: "basis", propose: BASIS });
    r.p.write("src/greet.test.ts", GREET_TEST);
    await r.call("check", { h, stage: "baseline" });
    const wrong = (text: string) => r.p.write("src/greet.ts", `export const greet = (_name: string): string => '${text}';\n`);
    wrong("first");
    r.c.advance(13); // 80% of Quick's 15 minutes is 12
    await r.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] }); // red: not a milestone, so no check-in
    r.c.advance(1);
    wrong("second");
    const warned = await r.call("check", { h, stage: "candidate", touched: ["src/greet.ts"], again: true });
    assert.ok(warned.reasons.some((x) => x.code === "budget-warning"), JSON.stringify(warned));
    r.c.advance(5);
    wrong("third");
    const refused = await r.call("check", { h, stage: "candidate", touched: ["src/greet.ts"], again: true });
    assert.equal(refused.exit, 2, JSON.stringify(refused));
    assert.ok(refused.reasons.some((x) => x.code === "budget-exhausted" && /15 minutes/.test(x.message)), JSON.stringify(refused.reasons));
    assert.ok(refused.next.some((n) => n.action === "ask"), "the refusal proposes the extension to the user");
    const noQuote = await r.call("decide", { h, kind: "extend" });
    assert.equal(noQuote.exit, 2, "an extension needs the user's words");
    const extended = await r.call("decide", { h, kind: "extend", quote: "yes, keep going" });
    assert.equal(extended.exit, 0, JSON.stringify(extended));
    assert.equal(r.budget().activeMinutesSinceCheckIn, 0);
    wrong("fourth");
    const ran = await r.call("check", { h, stage: "candidate", touched: ["src/greet.ts"], again: true });
    assert.ok(ran.reasons.some((x) => x.code === "evidence-failed"), "the check ran after the extension");
    assert.ok(!ran.reasons.some((x) => /Active work time/.test(x.message)), JSON.stringify(ran.reasons));
  });
});
