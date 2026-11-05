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

describe("ambiguous plan references [INT-10, INT-12]", () => {
  const existing = item("PLN-001-old", "accepted");
  const proposed = (ref?: string) => ({ ref, outcome: "deliver one increment", check: "journey" });
  const cases: Array<{
    name: string; have: PlanItem[]; proposal: Parameters<typeof buildPlan>[1];
  }> = [
    { name: "duplicate new refs", have: [], proposal: [proposed("same"), proposed("same")] },
    { name: "new ref then existing ID alias", have: [existing], proposal: [proposed(existing.id), existing] },
    { name: "existing ID then new ref alias", have: [existing], proposal: [existing, proposed(existing.id)] },
    { name: "explicit then automatic key", have: [], proposal: [proposed("#1"), proposed()] },
    { name: "automatic then explicit key", have: [], proposal: [proposed(), proposed("#0")] },
    { name: "duplicate existing-item aliases", have: [existing], proposal: [{ ...existing, ref: "same" }, proposed("same")] },
  ];
  for (const { name, have, proposal } of cases) {
    it(`rejects ${name} without mutating input`, () => {
      const before = JSON.stringify({ have, proposal });
      const result = buildPlan(have, proposal, 1, () => "new");
      assert.equal(result.ok, false, JSON.stringify(result));
      if (result.ok) return;
      assert.match(result.message, /appears twice/);
      assert.equal(JSON.stringify({ have, proposal }), before);
    });
  }
  it("preserves unique automatic and explicit refs and their dependencies", () => {
    const result = buildPlan([], [proposed(), { ...proposed("next"), dependsOn: ["#0"] }], 3, () => "new");
    assert.ok(result.ok);
    if (!result.ok) return;
    assert.deepEqual(result.items.map(i => i.id), ["PLN-004-new", "PLN-005-new"]);
    assert.deepEqual(result.items[1]!.dependsOn, ["PLN-004-new"]);
  });
  it("still rejects repeated existing IDs with different refs", () => {
    const result = buildPlan([existing], [{ ...existing, ref: "one" }, { ...existing, ref: "two" }], 1, () => "new");
    assert.ok(!result.ok && /appears twice/.test(result.message));
  });
});

describe("frozen plan commitments [INT-12]", () => {
  for (const state of ["in-progress", "done"] as const) {
    for (const field of ["dependsOn", "elementIds"] as const) {
      it(`refuses changing ${field} on an ${state} item`, () => {
        const frozen = { ...item("PLN-001-old", state), elementIds: ["REQ-1"], dependsOn: [] };
        const dependency = item("PLN-002-old", "done");
        const before = structuredClone([frozen, dependency]);
        const result = buildPlan([frozen, dependency], [{
          ...frozen, [field]: field === "dependsOn" ? [dependency.id] : ["REQ-2"],
        }], 2, () => "new");
        assert.ok(!result.ok && /cannot be edited/.test(result.message), JSON.stringify(result));
        assert.deepEqual([frozen, dependency], before);
      });
    }
  }
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
