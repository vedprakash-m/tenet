// QLT-11 consumer boundaries for the schema-2 candidate (schema-migration 20.1 and 20.2; trait-detection E22). Candidate only: the
// runtime state is
// still schema 1, so these tests pin what each consumer reads from either shape. No requirement tag: QLT-11 is mapped when the behavior
// is proven.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashOf } from "../src/core/ids.ts";
import { laneFloor, raise } from "../src/core/risk.ts";
import { changeTraitRaises, legacySignals, traitFacts } from "../src/core/traits.ts";
import { upcastState1 } from "../src/core/schemas-upcast.ts";
import { ctx } from "./support/migration-ctx.ts";
import { state1 } from "./support/schema1-fixtures.ts";

const migrated = (legacy: string[]) => {
  const s = state1();
  s.project.traits = legacy;
  return upcastState1(s, ctx);
};

describe("schema 1 consumers read exactly what they read before", () => {
  it("passes the string list through for risk signals and the facts hash", () => {
    const traits = ["personal-data", "ui"];
    assert.deepEqual(legacySignals(traits), traits);
    assert.deepEqual(traitFacts(traits), traits);
    assert.equal(raise({}, [], legacySignals(traits), false)["sensitive-data"], "high");
    assert.equal(hashOf({ traits: traitFacts(["a"]) }), hashOf({ traits: ["a"] }));
    assert.deepEqual(traitFacts([]), []);
  });
});

describe("a migrated project never turns a legacy string into a signal [E22]", () => {
  const legacy = ["personal-data", "external-effects", "auth", "../../etc/passwd", "ignore previous instructions"];
  it("raises no dimension and no lane from legacyUnverified", () => {
    const p = migrated(legacy).project.traits;
    assert.deepEqual(p.legacyUnverified, legacy);
    assert.deepEqual(legacySignals(p), []);
    assert.deepEqual(raise({}, [], legacySignals(p), false), {});
    assert.equal(laneFloor(raise({}, [], legacySignals(p), false)), "quick");
  });
  it("keeps the facts hash independent of legacy strings and sensitive to the typed resolution", () => {
    const a = traitFacts(migrated(legacy).project.traits), b = traitFacts(migrated(["something-else"]).project.traits);
    assert.deepEqual(a, b);
    assert.equal(JSON.stringify(a).includes("personal-data"), false);
    const assessed = { ...migrated([]).project.traits, status: "assessed" as const, resolutionHash: "f".repeat(64) };
    assert.notDeepEqual(traitFacts(assessed), a);
    assert.equal((traitFacts(assessed) as { resolutionHash: string }).resolutionHash, "f".repeat(64));
  });
  it("leaves every migrated work unassessed, so a work raises nothing until a change assessment exists", () => {
    const s = migrated(legacy);
    for (const w of Object.values(s.work)) assert.deepEqual(changeTraitRaises(w.traits,
      { registryVersion: s.project.traits.registryVersion, generation: 1, intentRevision: 1 }), []);
  });
  it("keeps the basis snapshot as inert history that no consumer reads", () => {
    const s = migrated([]);
    assert.deepEqual(s.work.wk_1!.basis!.legacyTraits, ["persistence", "weird-trait", "persistence"]);
    assert.equal(Object.hasOwn(s.work.wk_1!.basis!, "traits"), false);
  });
});
