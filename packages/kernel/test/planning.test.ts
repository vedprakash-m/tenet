// `decide overview`, `decide plan` and the plan items that contracts work through (INT-02, INT-12, TS §7.2).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const state = (p: Project) => p.ports().store.read()!.state;
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const confirm = { "plan-confirm": "confirm" };
const ITEMS = [
  { ref: "a", outcome: "Sign in", check: "the sign-in journey test" },
  { ref: "b", outcome: "Reserve a book", check: "the reservation journey test", dependsOn: ["a"] },
];

async function planned(p: Project) {
  const h = (await p.call("open", { profile: "plan", request: "plan the library app" })).handle!;
  const ask = await p.call("decide", { h, kind: "plan", propose: { items: ITEMS } });
  assert.equal(ask.exit, 3, JSON.stringify(ask));
  const done = await p.call("decide", { h, kind: "plan", propose: { items: ITEMS }, answers: confirm });
  assert.equal(done.exit, 0, JSON.stringify(done));
  return h;
}

describe("decide overview [INT-02]", () => {
  it("records purpose, users, preferences and non-goals, revises the intent once, and does nothing when repeated", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "plan", request: "x" })).handle!;
    const body = { purpose: "Lend books", users: "librarians", nonGoals: ["no fines"] };
    const r = await p.call("decide", { h, kind: "overview", propose: body });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.deepEqual(state(p).project.intent.overview, { purpose: "Lend books", users: "librarians", preferences: [], nonGoals: ["no fines"] });
    const rev = state(p).project.intent.revision;
    const again = await p.call("decide", { h, kind: "overview", propose: body, again: true });
    assert.equal(d(again).changed, false);
    assert.equal(state(p).project.intent.revision, rev);
    await p.call("decide", { h, kind: "overview", propose: { users: "librarians and members" } });
    assert.equal(state(p).project.intent.overview.purpose, "Lend books", "a field not named is kept");
  });
  it("refuses an empty purpose", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "plan", request: "x" })).handle!;
    assert.equal((await p.call("decide", { h, kind: "overview", propose: { purpose: "" } })).exit, 2);
  });
});

describe("decide plan [INT-12]", () => {
  it("asks once with the numbered plan, records nothing until the answer, then holds accepted items with stable IDs", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "plan", request: "plan the library app" })).handle!;
    const ask = await p.call("decide", { h, kind: "plan", propose: { items: ITEMS } });
    assert.match(ask.questions![0]!.question, /1\. Sign in[\s\S]*2\. Reserve a book/);
    assert.equal(state(p).project.intent.plan.length, 0);
    await p.call("decide", { h, kind: "plan", propose: { items: ITEMS }, answers: confirm });
    const plan = state(p).project.intent.plan;
    assert.deepEqual(plan.map((i) => i.state), ["accepted", "accepted"]);
    assert.match(plan[0]!.id, /^PLN-001-[a-z0-9]{3}$/);
    assert.deepEqual(plan[1]!.dependsOn, [plan[0]!.id]);
  });
  it("refuses a malformed plan before asking", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "plan", request: "x" })).handle!;
    const r = await p.call("decide", { h, kind: "plan", propose: { items: [{ ref: "a", outcome: "x", check: "" }] } });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]!.code, "plan-invalid");
  });
  it("an edited plan asks again and keeps IDs; an identical one changes nothing", async () => {
    const p = fresh();
    const h = await planned(p);
    const [a, b] = state(p).project.intent.plan;
    const same = await p.call("decide", { h, kind: "plan", again: true, propose: { items: [{ id: a!.id, outcome: a!.outcome, check: a!.check }, { id: b!.id, outcome: b!.outcome, check: b!.check, dependsOn: [a!.id] }] } });
    assert.equal(same.exit, 0, JSON.stringify(same));
    assert.equal(d(same).changed, false);
    const edit = await p.call("decide", { h, kind: "plan", propose: { items: [{ id: a!.id, outcome: "Sign in with a library card", check: a!.check }] } });
    assert.equal(edit.exit, 3);
    assert.match(edit.questions![0]!.question, /drop/i, "leaving an item out drops it, and the question says so");
  });
});

describe("working through the plan [INT-12]", () => {
  async function runItem(p: Project, itemId: string) {
    const o = await p.call("open", { profile: "feature", request: "build it", scopePaths: ["src/greet.ts"], planItem: itemId, lane: "standard" });
    return o;
  }

  it("proposes the next item and opens a contract for it, which holds the item in progress", async () => {
    const p = fresh();
    await planned(p);
    const [a, b] = state(p).project.intent.plan;
    assert.equal(d(await p.call("inspect", { view: "status" })).plan.next, a!.id);
    const o = await runItem(p, a!.id);
    assert.equal(o.exit, 0, JSON.stringify(o));
    assert.equal(state(p).project.intent.plan[0]!.state, "in-progress");
    assert.equal(state(p).project.intent.plan[0]!.work, Object.values(state(p).work).at(-1)!.id);
    assert.equal(d(await p.call("inspect", { view: "status" })).plan.next, null, "the second item waits for the first");
    void b;
  });

  it("refuses an unknown item, a proposed one and one whose dependency is not done", async () => {
    const p = fresh();
    await planned(p);
    const [, b] = state(p).project.intent.plan;
    assert.equal((await runItem(p, "PLN-999-zzz")).reasons[0]!.code, "plan-invalid");
    const blocked = await runItem(p, b!.id);
    assert.equal(blocked.exit, 2, JSON.stringify(blocked));
    assert.equal(blocked.reasons[0]!.code, "plan-item-blocked");
  });

  it("marks the item done when its contract reaches checked-local, and the next one becomes available", async () => {
    const p = fresh();
    await planned(p);
    const [a, b] = state(p).project.intent.plan;
    const o = await runItem(p, a!.id);
    const h = o.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, stage: "candidate" });
    await p.call("findings", { h, result: reviewResult(d(green)) });
    const done = await p.call("finish", { h, noCommit: true });
    assert.equal(d(done).endpoint, "checked-local", JSON.stringify(done.reasons));
    assert.equal(state(p).project.intent.plan[0]!.state, "done");
    assert.equal(d(await p.call("inspect", { view: "status" })).plan.next, b!.id);
  });

  it("returns the item to accepted when its contract is abandoned", async () => {
    const p = fresh();
    await planned(p);
    const [a] = state(p).project.intent.plan;
    const o = await runItem(p, a!.id);
    await p.call("stop", { h: o.handle!, mode: "abandon" });
    const item = state(p).project.intent.plan[0]!;
    assert.equal(item.state, "accepted");
    assert.equal(item.work, undefined);
  });
});
