// tenet.policy.json: strict parsing and the structural trust comparison (TS §8.5, PRD §7.4 item 14).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { comparePolicy, effectivePolicy, parsePolicy } from "../src/core/policy.ts";
import type { Policy } from "../src/core/policy.ts";

const base: Policy = {
  protected_paths: ["db/migrations/**", ".github/**"],
  exclusions: [{ pattern: "secrets/**", kinds: ["no-model-send", "no-read"] }],
  required_checks: [{ id: "unit", property: "behavior", population: "src/**/*.test.ts" }],
  dependency_policy: { min_release_age_days: 7, urgent_exception: "require-approval", unknown_age: "require-approval" },
};
const with_ = (over: Partial<Policy>): Policy => ({ ...base, ...over });
const kinds = (a: Policy, b: Policy) => comparePolicy(a, b).map((c) => `${c.field}:${c.kind}`);

describe("parsing tenet.policy.json strictly [CFG-11]", () => {
  it("accepts the catalog's shared fields and an optional $schema", () => {
    assert.equal(parsePolicy({ $schema: "./schemas/tenet.policy.schema.json", ...base }).ok, true);
    assert.equal(parsePolicy({}).ok, true, "every field is optional; absent inherits");
  });
  it("blocks an unknown key and names the nearest valid one", () => {
    const r = parsePolicy({ ...base, protected_path: ["x"] });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.equal(r.key, "protected_path");
    assert.equal(r.nearest, "protected_paths");
    assert.match(r.message, /protected_paths/);
  });
  it("blocks a malformed value and names its key", () => {
    for (const bad of [{ dependency_policy: { ...base.dependency_policy, min_release_age_days: -1 } }, { dependency_policy: { ...base.dependency_policy, unknown_age: "sometimes" } }, { exclusions: [{ pattern: "x", kinds: ["no-such-kind"] }] }, { protected_paths: "all" }]) {
      const r = parsePolicy({ ...base, ...bad });
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.ok(!r.ok && r.key !== undefined);
    }
  });
});

describe("comparing a changed policy [PRD §7.4 item 14]", () => {
  it("reports nothing for an identical policy", () => assert.deepEqual(comparePolicy(base, structuredClone(base)), []));

  it("protected paths and exclusions: more is tighter, fewer is looser, a narrower kind list is looser", () => {
    assert.deepEqual(kinds(base, with_({ protected_paths: [...base.protected_paths!, "infra/**"] })), ["protected_paths:tightened"]);
    assert.deepEqual(kinds(base, with_({ protected_paths: [".github/**"] })), ["protected_paths:loosened"]);
    assert.deepEqual(kinds(base, with_({ exclusions: [{ pattern: "secrets/**", kinds: ["no-model-send", "no-read", "no-edit"] }] })), ["exclusions:tightened"]);
    assert.deepEqual(kinds(base, with_({ exclusions: [{ pattern: "secrets/**", kinds: ["no-read"] }] })), ["exclusions:loosened"]);
    assert.deepEqual(kinds(base, with_({ exclusions: [] })), ["exclusions:loosened"]);
  });
  it("a changed glob is a different path, so it loosens the old one and tightens the new one", () => {
    assert.deepEqual(kinds(base, with_({ protected_paths: ["db/migrations/*", ".github/**"] })).sort(), ["protected_paths:loosened", "protected_paths:tightened"]);
  });
  it("required checks: added by ID is tighter, removed is looser, a changed definition needs acceptance", () => {
    const more = [...base.required_checks!, { id: "e2e", property: "journeys" }];
    assert.deepEqual(kinds(base, with_({ required_checks: more })), ["required_checks:tightened"]);
    assert.deepEqual(kinds(base, with_({ required_checks: [] })), ["required_checks:loosened"]);
    assert.deepEqual(kinds(base, with_({ required_checks: [{ id: "unit", property: "behavior", population: "src/**/*.spec.ts" }] })), ["required_checks:changed"]);
  });
  it("dependency policy compares field by field, with deny > require-approval > allow", () => {
    const dp = base.dependency_policy!;
    assert.deepEqual(kinds(base, with_({ dependency_policy: { ...dp, min_release_age_days: 14 } })), ["dependency_policy.min_release_age_days:tightened"]);
    assert.deepEqual(kinds(base, with_({ dependency_policy: { ...dp, min_release_age_days: 0 } })), ["dependency_policy.min_release_age_days:loosened"]);
    assert.deepEqual(kinds(base, with_({ dependency_policy: { ...dp, urgent_exception: "deny" } })), ["dependency_policy.urgent_exception:tightened"]);
    assert.deepEqual(kinds(base, with_({ dependency_policy: { ...dp, unknown_age: "allow" } })), ["dependency_policy.unknown_age:loosened"]);
    assert.deepEqual(kinds(base, with_({ dependency_policy: { ...dp, min_release_age_days: 14, unknown_age: "allow" } })).sort(), ["dependency_policy.min_release_age_days:tightened", "dependency_policy.unknown_age:loosened"]);
  });
  it("an absent field inherits, so adding one is tighter and removing one is looser than a stated value", () => {
    assert.deepEqual(kinds({}, { protected_paths: ["x/**"] }), ["protected_paths:tightened"]);
    assert.deepEqual(kinds({ protected_paths: ["x/**"] }, {}), ["protected_paths:loosened"]);
    assert.deepEqual(kinds({ protected_paths: [] }, {}), [], "an empty list removes nothing and adds nothing");
  });
  it("commands never compare structurally: any change needs acceptance", () => {
    const a = with_({ commands: { test: { argv: ["npm", "test"] } } });
    const b = with_({ commands: { test: { argv: ["npm", "run", "test:fast"] } } });
    assert.deepEqual(kinds(a, b), ["commands:changed"]);
    assert.deepEqual(kinds(base, a), ["commands:changed"], "a new command needs its envelope consent too");
  });
});

describe("applying a pulled policy", () => {
  it("applies a tightening at once and says so", () => {
    const next = with_({ protected_paths: [...base.protected_paths!, "infra/**"] });
    const r = effectivePolicy(base, next, false);
    assert.deepEqual(r.policy.protected_paths, next.protected_paths);
    assert.deepEqual(r.pending, []);
    assert.equal(r.applied.length, 1);
  });
  it("keeps the previous rules for what loosens or changes, applies the rest, and lists what waits for the user", () => {
    const next = with_({
      protected_paths: [".github/**", "infra/**"], // drops one, adds one
      dependency_policy: { ...base.dependency_policy!, min_release_age_days: 14, unknown_age: "allow" },
      commands: { test: { argv: ["x"] } },
    });
    const r = effectivePolicy(base, next, false);
    assert.deepEqual([...r.policy.protected_paths!].sort(), [".github/**", "db/migrations/**", "infra/**"], "the old path stays, the new one applies");
    assert.equal(r.policy.dependency_policy!.min_release_age_days, 14);
    assert.equal(r.policy.dependency_policy!.unknown_age, "require-approval", "the loosened field keeps its previous value");
    assert.equal(r.policy.commands, undefined);
    assert.deepEqual(r.pending.map((c) => `${c.field}:${c.kind}`).sort(), ["commands:changed", "dependency_policy.unknown_age:loosened", "protected_paths:loosened"]);
  });
  it("applies everything once the user accepted the diff", () => {
    const next = with_({ protected_paths: [], dependency_policy: { min_release_age_days: 0, urgent_exception: "allow", unknown_age: "allow" } });
    const r = effectivePolicy(base, next, true);
    assert.deepEqual(r.policy, next);
    assert.deepEqual(r.pending, []);
  });
  it("never leaves the protected paths looser than before until accepted (any pulled policy)", () => {
    const paths = fc.array(fc.constantFrom("a/**", "b/**", "c/**", "d/**"), { maxLength: 4 }).map((l) => [...new Set(l)]);
    fc.assert(fc.property(paths, paths, (prev, next) => {
      const r = effectivePolicy({ protected_paths: prev }, { protected_paths: next }, false);
      return prev.every((p) => r.policy.protected_paths?.includes(p));
    }));
  });
  it("is stable: applying the same pulled policy twice changes nothing more", () => {
    const next = with_({ protected_paths: [".github/**", "infra/**"], dependency_policy: { ...base.dependency_policy!, unknown_age: "allow" } });
    const once = effectivePolicy(base, next, false);
    const twice = effectivePolicy(once.policy, next, false);
    assert.deepEqual(twice.policy, once.policy);
    assert.deepEqual(twice.applied, []);
  });
});
