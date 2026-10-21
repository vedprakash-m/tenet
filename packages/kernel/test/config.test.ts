// The settings catalog and how a setting resolves across its sources (PRD §7.3-7.5, TS §8.5). Pure.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { CATALOG, effectiveSettings, resolveSetting, validateSetting } from "../src/core/config.ts";
import type { Layers } from "../src/core/config.ts";

const layers = (over: Partial<Layers> = {}): Layers => ({ shared: {}, local: {}, task: {}, adoption: { intent: "undecided", policy: "undecided" }, ...over });
const KEYS = ["style", "checkpoints", "lane", "resource_mode", "shared_memory", "branching", "integration", "commands", "required_checks", "protected_paths", "exclusions", "dependency_policy"];

describe("the catalog [CFG-02]", () => {
  it("has the twelve settings, each with a default, a kind and the scopes it may be set in", () => {
    assert.deepEqual(Object.keys(CATALOG).sort(), [...KEYS].sort());
    for (const k of KEYS) assert.ok(CATALOG[k as keyof typeof CATALOG].scopes.length >= 0 && CATALOG[k as keyof typeof CATALOG].kind);
  });
  it("defaults: balanced style, milestone checkpoints, auto lane, per-work branches, offered integration, no restrictions", () => {
    const e = effectiveSettings(layers());
    assert.deepEqual([e.style, e.checkpoints, e.lane, e.resource_mode, e.branching, e.integration], ["balanced", "milestones", "auto", "normal", "per-work", "offer"]);
    assert.deepEqual([e.protected_paths, e.required_checks, e.exclusions], [[], [], []]);
    assert.deepEqual(e.dependency_policy, { min_release_age_days: 0, urgent_exception: "allow", unknown_age: "require-approval" });
  });
});

describe("validating a change [CFG-06, PRD §7.5 item 1]", () => {
  it("accepts a valid value in an allowed scope", () => {
    assert.deepEqual(validateSetting("style", "concise", "task"), { ok: true, value: "concise" });
    assert.deepEqual(validateSetting("integration", "never", "project"), { ok: true, value: "never" });
    assert.deepEqual(validateSetting("protected_paths", ["db/**"], "project"), { ok: true, value: ["db/**"] });
  });
  it("rejects a malformed value, naming the allowed ones", () => {
    const r = validateSetting("lane", "turbo", "project");
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.message : "", /auto, quick, standard, deep/);
    assert.equal(validateSetting("dependency_policy", { min_release_age_days: -1 }, "project").ok, false);
  });
  it("rejects a scope the setting does not have: a commitment is never a task preference", () => {
    for (const k of ["protected_paths", "required_checks", "dependency_policy", "commands", "exclusions", "integration"] as const) {
      const r = validateSetting(k, CATALOG[k].default, "task");
      assert.equal(r.ok, false, k);
    }
  });
  it("shared_memory is the answer to the adoption offer, not something set here", () => {
    assert.equal(validateSetting("shared_memory", "adopted", "project").ok, false);
  });
});

describe("resolving a preference [PRD §7.4]", () => {
  it("the most specific source wins, and what it overrides is reported", () => {
    const r = resolveSetting("checkpoints", layers({ local: { checkpoints: "minimal" }, task: { checkpoints: "each-phase" } }));
    assert.equal(r.value, "each-phase");
    assert.equal(r.source, "task");
    assert.deepEqual(r.overridden.map((o) => [o.source, o.value]), [["project", "minimal"], ["default", "milestones"]]);
  });
  it("removing an override restores the inherited value", () => {
    const withTask = layers({ local: { style: "guided" }, task: { style: "concise" } });
    assert.equal(resolveSetting("style", withTask).value, "concise");
    assert.equal(resolveSetting("style", { ...withTask, task: {} }).value, "guided");
    assert.equal(resolveSetting("style", { ...withTask, task: {}, local: {} }).value, "balanced");
  });
  it("a value set to the default is still a source (absent inherits, a stated value does not)", () => {
    assert.equal(resolveSetting("style", layers({ local: { style: "balanced" } })).source, "project");
  });
  it("says how to change it", () => assert.match(resolveSetting("lane", layers()).howToChange, /decide config/));
  it("shared_memory reads the adoption answer", () => {
    assert.equal(resolveSetting("shared_memory", layers({ adoption: { intent: "declined", policy: "undecided" } })).value, "declined");
  });
});

describe("resolving a restriction: sources only add [PRD §7.4 items 2, 14, 15]", () => {
  it("protected paths are the union of every source, with each contribution shown", () => {
    const r = resolveSetting("protected_paths", layers({ shared: { protected_paths: ["db/**"] }, local: { protected_paths: ["infra/**", "db/**"] }, adoption: { intent: "undecided", policy: "adopted" } }));
    assert.deepEqual([...(r.value as string[])].sort(), ["db/**", "infra/**"]);
    assert.deepEqual(r.contributions!.map((c) => c.source).sort(), ["project", "shared policy"]);
    assert.equal(r.adoption, "adopted");
  });
  it("an empty list removes nothing and adds nothing", () => {
    const r = resolveSetting("protected_paths", layers({ shared: { protected_paths: ["db/**"] }, local: { protected_paths: [] } }));
    assert.deepEqual(r.value, ["db/**"]);
  });
  it("restrictions from a shared file that is not adopted still apply, and are shown as not adopted", () => {
    const r = resolveSetting("protected_paths", layers({ shared: { protected_paths: ["db/**"] } }));
    assert.deepEqual(r.value, ["db/**"]);
    assert.equal(r.adoption, "undecided");
  });
  it("exclusions merge their kinds per pattern", () => {
    const r = resolveSetting("exclusions", layers({ shared: { exclusions: [{ pattern: "s/**", kinds: ["no-read"] }] }, local: { exclusions: [{ pattern: "s/**", kinds: ["no-edit"] }, { pattern: "t/**", kinds: ["no-export"] }] } }));
    assert.deepEqual(r.value, [{ pattern: "s/**", kinds: ["no-read", "no-edit"] }, { pattern: "t/**", kinds: ["no-export"] }]);
  });
  it("required checks are the union by ID; conflicting projections are named and block evidence", () => {
    const r = resolveSetting("required_checks", layers({ shared: { required_checks: [{ id: "unit", property: "behavior" }] }, local: { required_checks: [{ id: "unit", property: "other" }, { id: "e2e", property: "journeys" }] } }));
    assert.deepEqual((r.value as { id: string; property: string }[]).map((c) => [c.id, c.property]), [["unit", "behavior"], ["e2e", "journeys"]]);
    assert.ok(r.limits.some((l) => /unit/.test(l)));
  });
  it("dependency policy is the strictest value each field was given across sources; a field nobody stated keeps the default, and an explicit loosening stands", () => {
    const r = resolveSetting("dependency_policy", layers({ shared: { dependency_policy: { min_release_age_days: 14, unknown_age: "allow" } }, local: { dependency_policy: { min_release_age_days: 3, urgent_exception: "deny" } } }));
    assert.deepEqual(r.value, { min_release_age_days: 14, urgent_exception: "deny", unknown_age: "allow" });
  });
  it("commands are chosen per check name, and the project's own override the shared ones", () => {
    const r = resolveSetting("commands", layers({ shared: { commands: { test: { argv: ["npm", "test"] }, lint: { argv: ["npm", "run", "lint"] } } }, local: { commands: { test: { argv: ["npm", "run", "test:fast"] } } } }));
    assert.deepEqual(r.value, { test: { argv: ["npm", "run", "test:fast"] }, lint: { argv: ["npm", "run", "lint"] } });
  });
  it("resolution does not depend on the order the sources were read", () => {
    const list = fc.array(fc.constantFrom("a/**", "b/**", "c/**"), { maxLength: 3 });
    fc.assert(fc.property(list, list, (a, b) => {
      const x = resolveSetting("protected_paths", layers({ shared: { protected_paths: a }, local: { protected_paths: b } })).value as string[];
      const y = resolveSetting("protected_paths", layers({ shared: { protected_paths: b }, local: { protected_paths: a } })).value as string[];
      return [...x].sort().join() === [...y].sort().join();
    }));
  });
});
