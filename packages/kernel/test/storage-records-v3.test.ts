import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  JournalIndexV1, SummaryV2, migrateLegacySummary, mergeStorageMonths,
} from "../src/core/storage-records.ts";
import { sha256 } from "../src/core/ids.ts";

const hash = "a".repeat(64), batchId = "b".repeat(32);
const identity = {
  dev: "1", ino: "2", type: "file", links: 1,
  objectGeneration: { version: 1, domain: "store-object-generation-v1", opaque: "synthetic-2" },
};
const proof = (path: string) => ({ path, identity, bytes: 0, sha256: hash });
const month = () => ({
  calls: { open: 1 }, exits: { "0": 1 }, intents: 0, results: 0, accounting: 0,
  workSeq: 3, generationSeq: 5,
});
const summary = () => ({ version: 2, batchId, from: hash, months: { "2026-01": month() }, legacyBase: null });
const index = () => ({
  version: 1, active: { path: "log", identity },
  summary: { ...proof("summaries.json"), batchId }, sealed: [],
});

describe("schema-3 storage record admission", () => {
  it("preserves strict legacy provenance and null unproved high-water marks [AC-19] CT-13", () => {
    const { workSeq: _work, generationSeq: _generation, ...oldMonth } = month();
    const raw = JSON.stringify({ version: 1, from: "legacy-input", months: { "2026-01": oldMonth } });
    const migrated = migrateLegacySummary(raw, batchId, false);
    assert.deepEqual(migrated.legacyBase, { kind: "legacy-v1", version: 1, sha256: sha256(raw) });
    assert.deepEqual(migrated.months["2026-01"], { ...oldMonth, workSeq: null, generationSeq: null });
    assert.deepEqual(migrateLegacySummary(null, batchId, false).legacyBase, { kind: "declared-absence" });
    assert.equal(migrateLegacySummary(null, batchId, true).legacyBase, null);
    assert.equal(SummaryV2.safeParse(migrated).success, true);
  });

  it("refuses malformed, future and contradictory summary shapes [AC-19] CT-13", () => {
    for (const candidate of [
      { ...summary(), version: 3 }, { ...summary(), legacyBase: {} },
      { ...summary(), legacyBase: { kind: "declared-absence", sha256: hash } },
      { ...summary(), legacyBase: { kind: "legacy-v1", version: 1, sha256: "wrong" } },
      { ...summary(), legacyBase: undefined }, { ...summary(), extra: true },
      { ...summary(), months: { "2026-13": month() } },
      { ...summary(), months: { "2026-01": { ...month(), workSeq: -1 } } },
      { ...summary(), months: { "2026-01": { ...month(), accounting: Number.MAX_SAFE_INTEGER + 1 } } },
    ]) assert.equal(SummaryV2.safeParse(candidate).success, false);
    for (const text of [
      "not JSON", '{"version":1,"version":1,"from":"x","months":{}}',
      JSON.stringify({ version: 2, from: "", months: {} }),
      JSON.stringify({ version: 1, from: "", months: {}, unrecognized: true }),
    ]) assert.throws(() => migrateLegacySummary(text, batchId, false));
  });

  it("uses maxima for exact high-water marks and never upgrades unknown legacy floors [AC-19]", () => {
    const merged = mergeStorageMonths({ "2026-01": month() }, {
      "2026-01": { ...month(), workSeq: 2, generationSeq: 7 },
    });
    assert.deepEqual(merged["2026-01"], { ...month(), calls: { open: 2 }, exits: { "0": 2 }, generationSeq: 7 });
    const legacy = { ...month(), workSeq: null, generationSeq: null };
    assert.deepEqual(mergeStorageMonths({ "2026-01": legacy }, { "2026-01": month() })["2026-01"],
      { ...legacy, calls: { open: 2 }, exits: { "0": 2 } });
    assert.equal(month().calls.open, 1);
    assert.throws(() => mergeStorageMonths({ "2026-01": { ...month(), intents: Number.MAX_SAFE_INTEGER } }, {
      "2026-01": { ...month(), intents: 1 },
    }));
  });

  it("admits only selected, unique, canonical journal leaves and stable file identities [AC-19] CT-37 CT-38 CT-42", () => {
    assert.equal(JournalIndexV1.safeParse(index()).success, true);
    const sealed = { ...proof(`log.sealed-${batchId}`), id: batchId, first: "2026-01-01", last: "2026-01-31" };
    assert.equal(JournalIndexV1.safeParse({ ...index(), sealed: [sealed] }).success, true);
    for (const candidate of [
      { ...index(), active: { path: "other", identity } },
      { ...index(), active: { path: "log", identity: { ...identity, ino: "02" } } },
      { ...index(), active: { path: "log", identity: { ...identity, links: 2 } } },
      { ...index(), sealed: [sealed, sealed] },
      { ...index(), sealed: [{ ...sealed, path: "..\\log" }] },
      { ...index(), summary: { ...proof("state"), batchId } },
    ]) assert.equal(JournalIndexV1.safeParse(candidate).success, false);
  });
});
