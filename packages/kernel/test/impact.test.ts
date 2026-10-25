// Intent-change impact (INT-08, TS §7.8): follows links that exist, infers nothing from text.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { impact } from "../src/core/impact.ts";
import { emptyState } from "../src/core/state.ts";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import type { State } from "../src/core/schemas.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const na = { notApplicable: "test" };
const el = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({ id, origin: "request" as const, kind: kind as any, text: id, verifiedBy: na, ...extra });

function world(): State {
  const s = emptyState("ws_x", "tag1");
  s.project.intent.elements = [
    el("REQ-001-aaa", "requirement"), el("EX-001-aaa.1", "example", { of: "REQ-001-aaa", testFile: "a.test.ts" }),
    el("EX-001-aaa.2", "example", { of: "REQ-001-aaa" }), el("REQ-002-aaa", "requirement"), el("DEC-003-aaa", "decision"),
  ];
  const item = (id: string, elementIds: string[], dependsOn: string[], extra: Record<string, unknown> = {}) =>
    ({ id, outcome: id, elementIds, dependsOn, check: "c", state: "accepted" as const, ...extra });
  s.project.intent.plan = [item("PLN-001-aaa", ["REQ-001-aaa"], []), item("PLN-002-aaa", ["REQ-002-aaa"], ["PLN-001-aaa"]), item("PLN-003-aaa", ["REQ-002-aaa"], [])];
  s.project.intent.records = [{ id: "DEC-003-aaa", title: "t", status: "accepted", date: "d", context: "c", decision: "d", consequences: "", alternatives: [], links: ["REQ-001-aaa"], quote: "q" }];
  return s;
}

describe("impact of changing intent [INT-08]", () => {
  it("a requirement reaches its examples, the plan items that carry it, their dependents, linked decisions and the tests", () => {
    const r = impact(world(), ["REQ-001-aaa"]);
    assert.deepEqual(r.elements.map((e) => e.id).sort(), ["EX-001-aaa.1", "EX-001-aaa.2", "REQ-001-aaa"]);
    assert.deepEqual(r.plan.map((p) => p.id), ["PLN-001-aaa", "PLN-002-aaa"], "PLN-002 depends on PLN-001; PLN-003 shares nothing with it");
    assert.deepEqual(r.decisions.map((d) => d.id), ["DEC-003-aaa"]);
    assert.deepEqual(r.tests, [{ file: "a.test.ts", element: "EX-001-aaa.1" }]);
  });

  it("an example reaches its requirement but not its sibling examples", () => {
    const r = impact(world(), ["EX-001-aaa.2"]);
    assert.deepEqual(r.elements.map((e) => e.id).sort(), ["EX-001-aaa.2", "REQ-001-aaa"]);
  });

  it("names unknown IDs instead of guessing, and live contracts that carry an affected element", () => {
    const s = world();
    s.work = { w1: { id: "w1", label: "W1", state: "implementing", basis: { elementIds: ["REQ-002-aaa"] }, planItem: undefined } as any,
      w2: { id: "w2", label: "W2", state: "finished", basis: { elementIds: ["REQ-001-aaa"] } } as any };
    const r = impact(s, ["REQ-002-aaa", "REQ-404-zzz"]);
    assert.deepEqual(r.unknown, ["REQ-404-zzz"]);
    assert.deepEqual(r.work.map((w) => w.id), ["w1"], "a finished contract is not in flight");
  });
});

describe("inspect --view impact [INT-08]", () => {
  it("answers from the recorded intent and needs the IDs", async () => {
    const p: Project = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "plan", request: "decide the store" })).handle!;
    await p.call("decide", { h, kind: "decision-record", quote: "ok", propose: { title: "Use SQLite", context: "small", decision: "SQLite" } });
    const id = p.ports().store.read()!.state.project.intent.records[0]!.id;
    const r = await p.call("inspect", { view: "impact", topic: id });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.deepEqual((r.data as any).impact.decisions.map((d: any) => d.id), [id]);
    assert.equal((await p.call("inspect", { view: "impact" })).exit, 1);
  });
});

describe("the plan preview shows the impact of an edit before anything is recorded [INT-08]", () => {
  it("editing an accepted item names the items that wait on it", async () => {
    const p: Project = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "plan", request: "plan the work" })).handle!;
    const items = [{ ref: "a", outcome: "sign in", check: "journey" }, { ref: "b", outcome: "reserve", check: "journey", dependsOn: ["a"] }];
    await p.call("decide", { h, kind: "plan", propose: { items } });
    await p.call("decide", { h, kind: "plan", propose: { items }, answers: { "plan-confirm": "confirm" } });
    const plan = p.ports().store.read()!.state.project.intent.plan;
    const [first, second] = [plan[0]!, plan[1]!];
    const edited = [{ id: first.id, outcome: "sign in with a code", check: "journey" }, { id: second.id, outcome: second.outcome, check: second.check, dependsOn: [first.id] }];
    const preview = await p.call("decide", { h, kind: "plan", propose: { items: edited } });
    assert.equal(preview.exit, 3, JSON.stringify(preview));
    const shown = (preview.data as any).impact;
    assert.deepEqual(shown.plan.map((x: any) => x.id), [first.id, second.id], "the edited item and the one that depends on it");
    assert.equal(p.ports().store.read()!.state.project.intent.revision, 1, "the preview recorded nothing");
  });
});
