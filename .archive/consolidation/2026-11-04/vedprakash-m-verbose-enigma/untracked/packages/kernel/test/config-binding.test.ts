// Configuration evidence binding, candidate slice (config-completion 16.2, 16.3, 16.5). Pure rules plus the check identity.
// Candidate only: no schema-2 work exists at runtime, so these tests are the only path that produces a stamp. No requirement tag is
// claimed.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { advance, configHash, configProjection, configValueEqual, refreshWorks, MAX_SERIAL } from "../src/core/config-binding.ts";
import { baselineDefinitionMatches } from "../src/core/obligations.ts";
import { layersOf } from "../src/core/config.ts";
import { checkInputId } from "../src/verbs/facts.ts";
import { upcastState1 } from "../src/core/schemas-upcast.ts";
import type { ConfigStamp, Obligation } from "../src/core/schemas.ts";
import { ctx } from "./support/migration-ctx.ts";
import { H, state1 } from "./support/schema1-fixtures.ts";

const layers = (local: Record<string, unknown> = {}, shared: Record<string, unknown> = {}) =>
  layersOf({ config: { local }, project: { adoption: { intent: "undecided", policy: "undecided" } } }, undefined, shared as never);
const work = (o: Partial<{ lane: "quick" | "standard" | "deep"; floor: "quick" | "standard" | "deep"; protectedPaths: string[]; recipeChecks: string[]; obligations: Obligation[] }> = {}) => ({
  lane: o.lane ?? "standard", floor: o.floor ?? "quick", protectedPaths: o.protectedPaths ?? ["src/auth/**"],
    recipeChecks: o.recipeChecks ?? ["tsc"],
  obligations: o.obligations ?? [{ id: "OB-1", kind: "test" as const, category: "acceptance" as const, testFile: "a.test.ts",
    support: ["h.ts", "g.ts"], outputs: ["out.json"] }],
});
const hash = (l = layers(), w = work()) => configHash(l, w);

describe("the projection changes exactly when evidence-relevant input changes", () => {
  it("is stable across key order, set order and duplicate set members", () => {
    const base = hash();
    assert.equal(hash(layers(), work({ obligations: [{ id: "OB-1", kind: "test", category: "acceptance", outputs: ["out.json",
      "out.json"], support: ["g.ts", "h.ts"], testFile: "a.test.ts" }] })), base);
    assert.equal(hash(layers({ exclusions: [{ pattern: "a/**", kinds: ["no-read"] }, { pattern: "b/**", kinds: ["no-read"] }] })),
      hash(layers({ exclusions: [{ pattern: "b/**", kinds: ["no-read"] }, { pattern: "a/**", kinds: ["no-read"] },
        { pattern: "a/**", kinds: ["no-read"] }] })));
  });
  it("canonicalizes repeated exclusion patterns/kinds and check alternatives without changing argv order", () => {
    const first = layers({
      exclusions: [{ pattern: "src/**", kinds: ["no-read", "no-edit"] }, { pattern: "src/**", kinds: ["no-read"] }],
      required_checks: [{ id: "RC-1", property: "types", alternatives: ["tsc", "eslint"] }],
      commands: { build: { argv: ["node", "build"], env: { Z: "z", A: "a" } } },
    });
    const reordered = layers({
      exclusions: [{ pattern: "src/**", kinds: ["no-edit", "no-read"] }],
      required_checks: [{ alternatives: ["eslint", "tsc", "tsc"], property: "types", id: "RC-1" }],
      commands: { build: { env: { A: "a", Z: "z" }, argv: ["node", "build"] } },
    });
    assert.equal(hash(first), hash(reordered));
    assert.notEqual(hash(first), hash(layers({ commands: { build: { argv: ["build", "node"], env: { A: "a", Z: "z" } } } })));
  });
  it("changes for every relevant setting, source, lane, floor, protected path, recipe check and obligation field", () => {
    const base = hash();
    const changed: string[] = [
      hash(layers({ exclusions: [{ pattern: "x/**", kinds: ["no-read"] }] })), hash(layers({ protected_paths: ["p/**"] })),
        hash(layers({ required_checks: [{ id: "RC-1", property: "types", tool: "tsc" }] })),
      hash(layers({ commands: { build: { argv: ["x"], cwd: ".", env: {} } } })),
        hash(layers({ dependency_policy: { min_release_age_days: 3, urgent_exception: "allow", unknown_age: "require-approval" } })),
      hash(layers(), work({ lane: "deep" })), hash(layers(), work({ floor: "standard" })), hash(layers(),
        work({ protectedPaths: [] })), hash(layers(), work({ recipeChecks: [] })),
    ];
    for (const field of ["kind", "category", "targeted", "tool", "example", "testFile", "support", "outputs", "test", "expectation",
      "alongsideReason"] as const) {
      const ob: Record<string, unknown> = { id: "OB-1", kind: "test", category: "acceptance", testFile: "a.test.ts",
        support: ["h.ts", "g.ts"], outputs: ["out.json"] };
      ob[field] = { kind: "static", category: "boundary", targeted: true, tool: "x", example: "e", testFile: "b.test.ts",
        support: ["z.ts"], outputs: ["o2.json"], test: "boundary", expectation: "fail", alongsideReason: "why" }[field];
      changed.push(hash(layers(), work({ obligations: [ob as unknown as Obligation] })));
    }
    assert.equal(new Set(changed).size, changed.length);
    assert.ok(!changed.includes(base));
  });
  it("ignores presentation and scheduling preferences and proof bookkeeping", () => {
    const base = hash();
    assert.equal(hash(layers({ style: "concise", checkpoints: "minimal", resource_mode: "serial" })), base);
    const w = work();
    w.obligations = [{ ...w.obligations[0]!, state: "locked", baselineMatched: true, baselineTestHash: H("a"),
      baselineInputs: { "a.ts": H("b") } }];
    assert.equal(hash(layers(), w), base);
  });
  it("counts a masked contribution: a source-only change changes the projection even when the effective value is the same", () => {
    const shared = { exclusions: [{ pattern: "a/**", kinds: ["no-read"] }] };
    const local = { exclusions: [{ pattern: "a/**", kinds: ["no-read"] }] };
    assert.notEqual(hash(layers(local, shared)), hash(layers({}, shared)));
    assert.equal(configProjection(layers(local, shared), work()).version, 1);
  });
  it("makes an unavailable consumer part of the identity", () => {
    assert.notEqual(hash(layers({ commands: { build: { argv: ["x"], cwd: ".", env: {} } } })), hash(layers()));
  });
});

describe("candidate configuration equality", () => {
  it("shows JSON-string equality is red for a set permutation while candidate equality is green", () => {
    const previous = ["src/**", "test/**"];
    const proposed = ["test/**", "src/**", "src/**"];
    assert.notEqual(JSON.stringify(previous), JSON.stringify(proposed));
    assert.equal(configValueEqual("protected_paths", previous, proposed), true);
  });
  it("treats designated collections and object keys as sets while preserving submitted order", () => {
    assert.equal(configValueEqual("protected_paths", ["a/**", "b/**"], ["b/**", "a/**", "a/**"]), true);
    assert.equal(configValueEqual("exclusions", [
      { pattern: "src/**", kinds: ["no-read"] }, { pattern: "src/**", kinds: ["no-edit"] },
    ], [{ pattern: "src/**", kinds: ["no-edit", "no-read"] }]), true);
    assert.equal(configValueEqual("required_checks", [
      { id: "RC-1", property: "types", alternatives: ["tsc", "eslint"] },
    ], [{ alternatives: ["eslint", "tsc", "tsc"], property: "types", id: "RC-1" }]), true);
    assert.equal(configValueEqual("commands", { build: { argv: ["node", "build"], env: { Z: "z", A: "a" } } },
      { build: { env: { A: "a", Z: "z" }, argv: ["node", "build"] } }), true);
    assert.equal(configValueEqual("commands", { build: { argv: ["node", "build"] } },
      { build: { argv: ["build", "node"] } }), false);
    assert.equal(configValueEqual("protected_paths", undefined, []), false);
  });
  it("does not sort or rewrite the stored setting when two values compare equal", () => {
    const stored = ["b/**", "a/**"];
    assert.equal(configValueEqual("protected_paths", stored, ["a/**", "b/**"]), true);
    assert.deepEqual(stored, ["b/**", "a/**"]);
  });
});

describe("serials move only on a durably admitted change", () => {
  const s = (hash: string, serial: number): ConfigStamp => ({ hash, serial });
  it("keeps the stamp when the projection is unchanged and adds one when it changed", () => {
    assert.deepEqual(advance(s("a".repeat(64), 4), "a".repeat(64)), s("a".repeat(64), 4));
    assert.deepEqual(advance(s("a".repeat(64), 4), "b".repeat(64)), s("b".repeat(64), 5));
  });
  it("gives A -> B -> A a different serial so old evidence is not revived", () => {
    const a = s("a".repeat(64), 0), b = advance(a, "b".repeat(64)), again = advance(b, "a".repeat(64));
    assert.equal(again.hash, a.hash);
    assert.notEqual(again.serial, a.serial);
    assert.equal(again.serial, 2);
  });
  it("allocates above a recovered floor and refuses at the end of the serial space", () => {
    assert.equal(advance(s("a".repeat(64), 1), "b".repeat(64), 9).serial, 10);
    assert.throws(() => advance(s("a".repeat(64), MAX_SERIAL), "b".repeat(64)), /serial space/);
  });
  it("does not keep an unchanged hash below a recovered high-water floor", () => {
    assert.deepEqual(advance(s("a".repeat(64), 2), "a".repeat(64), 9), s("a".repeat(64), 10));
  });
  it("refreshes every held work in one pass and leaves unchanged works alone", () => {
    const t = upcastState1(state1(), ctx);
    const next = { wk_1: "c".repeat(64), wk_2: t.work.wk_2!.configEvidence.hash };
    const out = refreshWorks(t.work, next, {});
    assert.deepEqual(out.wk_1!.configEvidence, { hash: "c".repeat(64), serial: 1 });
    assert.deepEqual(out.wk_2!.configEvidence, t.work.wk_2!.configEvidence);
    assert.equal(t.work.wk_1!.configEvidence.serial, 0);
  });
  it("refuses a pass that omits a held work, so no work keeps a stale binding", () => {
    const t = upcastState1(state1(), ctx);
    assert.throws(() => refreshWorks(t.work, { wk_1: "c".repeat(64) }, {}), /wk_2/);
  });
});

describe("the check identity", () => {
  const ports = { root: "/p", stack: { fingerprint: () => ({ node: "24", tool: "v", reporter: "r", adapter: "a", static: {} }) } } as never;
  const w1 = () => state1().work.wk_1!;
  it("is unchanged for schema-1 work, so no existing receipt is invalidated", () => {
    assert.equal(checkInputId(ports, w1(), "cand"), "9682076af8b40227f3cc088d" /* recorded from the unmodified schema-1 function */);
  });
  it("includes the full binding for schema-2 work: hash, serial and every definition field", () => {
    const stamped = (stamp: ConfigStamp, ob: Partial<Obligation> = {}) => ({ ...w1(), obligations: [{ id: "OB-1", kind: "test",
      category: "acceptance", ...ob } as Obligation], configEvidence: stamp });
    const a = { hash: "a".repeat(64), serial: 0 };
    const base = checkInputId(ports, stamped(a), "cand");
    assert.notEqual(base, checkInputId(ports, { ...w1(), obligations: [{ id: "OB-1", kind: "test",
      category: "acceptance" } as Obligation] }, "cand"));
    assert.notEqual(base, checkInputId(ports, stamped({ ...a, serial: 1 }), "cand"));
    assert.notEqual(base, checkInputId(ports, stamped({ hash: "b".repeat(64), serial: 0 }), "cand"));
    assert.notEqual(base, checkInputId(ports, stamped(a, { alongsideReason: "x" }), "cand"));
    assert.notEqual(base, checkInputId(ports, stamped(a, { targeted: true }), "cand"));
    assert.equal(checkInputId(ports, stamped(a, { state: "locked" }), "cand"), base);
  });
});

describe("a baseline is current only under the work's current binding", () => {
  const ob = (stamp?: ConfigStamp): Obligation & { baselineConfigEvidence?: ConfigStamp } => ({
    id: "OB-1", kind: "test", category: "acceptance", testFile: "a.test.ts", baselineMatched: true, baselineTestHash: H("a"),
      baselineInputs: {},
    ...(stamp ? { baselineConfigEvidence: stamp } : {}),
  });
  const here = (p: string) => (p === "a.test.ts" ? H("a") : undefined);
  const cur = { hash: "a".repeat(64), serial: 2 };
  it("keeps schema-1 behavior when no binding is supplied", () => assert.equal(baselineDefinitionMatches(ob(), here), true));
  it("requires the exact stamp, so a legacy or older baseline proves nothing", () => {
    assert.equal(baselineDefinitionMatches(ob(cur), here, cur), true);
    assert.equal(baselineDefinitionMatches(ob(), here, cur), false);
    assert.equal(baselineDefinitionMatches(ob({ ...cur, serial: 1 }), here, cur), false);
    assert.equal(baselineDefinitionMatches(ob({ hash: "b".repeat(64), serial: 2 }), here, cur), false);
  });
  it("still applies every existing file check under a matching stamp", () => {
    assert.equal(baselineDefinitionMatches(ob(cur), () => H("z"), cur), false);
  });
});
