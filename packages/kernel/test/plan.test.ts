// The ordered plan of independently checkable increments (INT-12, TS §5 vertical slices). Pure.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildPlan, nextItem } from "../src/core/plan.ts";
import type { PlanItem } from "../src/core/schemas.ts";

const item = (id: string, state: PlanItem["state"], dependsOn: string[] = []): PlanItem => ({ id, outcome: id, elementIds: [], dependsOn, check: "c", state });

describe("building a plan from a proposal [INT-12]", () => {
  it("gives new items stable IDs after the highest sequence, resolves refs between them, and keeps their order", () => {
    const r = buildPlan([], [{ ref: "a", outcome: "sign in", check: "journey" }, { ref: "b", outcome: "reserve", check: "journey", dependsOn: ["a"] }], 11, () => "k7q");
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.items.map((i) => i.id), ["PLN-012-k7q", "PLN-013-k7q"]);
    assert.deepEqual(r.items[1]!.dependsOn, ["PLN-012-k7q"]);
    assert.ok(r.items.every((i) => i.state === "proposed"));
  });
  it("rejects an item with no way to check it, an unknown dependency and a cycle, naming the item", () => {
    const bad = (items: Parameters<typeof buildPlan>[1]) => { const r = buildPlan([], items, 0, () => "aaa"); return r.ok ? "" : r.message; };
    assert.match(bad([{ ref: "a", outcome: "x", check: "" }]), /check/);
    assert.match(bad([{ ref: "a", outcome: "x", check: "c", dependsOn: ["zzz"] }]), /zzz/);
    assert.match(bad([{ ref: "a", outcome: "x", check: "c", dependsOn: ["b"] }, { ref: "b", outcome: "y", check: "c", dependsOn: ["a"] }]), /cycle/);
    assert.match(bad([{ ref: "a", outcome: "x", check: "c", dependsOn: ["a"] }]), /cycle/);
  });
  it("edits an item by its ID, drops what the proposal leaves out, and keeps started and finished items untouched", () => {
    const have = [item("PLN-001-aaa", "done"), item("PLN-002-aaa", "in-progress"), item("PLN-003-aaa", "accepted"), item("PLN-004-aaa", "accepted")];
    const r = buildPlan(have, [{ id: "PLN-003-aaa", outcome: "renamed", check: "c2" }], 4, () => "bbb");
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(r.items.map((i) => [i.id, i.state]), [["PLN-001-aaa", "done"], ["PLN-002-aaa", "in-progress"], ["PLN-003-aaa", "proposed"], ["PLN-004-aaa", "dropped"]]);
    assert.equal(r.items.find((i) => i.id === "PLN-003-aaa")!.outcome, "renamed");
    assert.equal(r.changed.length, 2, "the edit and the drop need the user's word");
  });
  it("refuses to edit an item that is started or done", () => {
    const r = buildPlan([item("PLN-001-aaa", "done")], [{ id: "PLN-001-aaa", outcome: "different", check: "c" }], 1, () => "ccc");
    assert.equal(r.ok, false);
  });
  it("an unchanged proposal changes nothing", () => {
    const have = [item("PLN-001-aaa", "accepted")];
    const r = buildPlan(have, [{ id: "PLN-001-aaa", outcome: "PLN-001-aaa", check: "c" }], 1, () => "ddd");
    assert.ok(r.ok && r.changed.length === 0);
  });
});

describe("what is next [INT-12]", () => {
  it("is the first accepted item whose dependencies are done", () => {
    assert.equal(nextItem([item("a", "done"), item("b", "accepted", ["a"]), item("c", "accepted")])?.id, "b");
    assert.equal(nextItem([item("a", "accepted"), item("b", "accepted", ["a"])])?.id, "a");
    assert.equal(nextItem([item("a", "accepted", ["b"]), item("b", "accepted", ["a"])]), undefined);
  });
  it("skips proposed and dropped items, and is undefined when everything is done", () => {
    assert.equal(nextItem([item("a", "proposed"), item("b", "dropped"), item("c", "accepted")])?.id, "c");
    assert.equal(nextItem([item("a", "done")]), undefined);
  });
});
