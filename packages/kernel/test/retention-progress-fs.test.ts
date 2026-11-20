import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";
import { StorageV3Files } from "../src/adapters/storage-v3-write.ts";
import { RetentionProgressStore } from "../src/adapters/retention-progress-fs.ts";
import { retentionProgressSchema, rotationIndexAuthorization } from "../src/core/retention-records.ts";
import { hashOf, sha256, stableStringify } from "../src/core/ids.ts";
import { KernelError } from "../src/core/errors.ts";
import { supplementalGeneration, supplementalMove, syntheticMount } from "./fixtures/supplemental-move.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const Projection = z.strictObject({ version: z.literal(1), verb: z.literal("integrate"), handle: z.literal("test-handle") });
const schema = retentionProgressSchema({
  projection: Projection, effect: z.literal("integration"), token: z.string(), runId: z.literal("test-run"),
});
const batchId = "a".repeat(24);
const identity = (ino: string) => ({
  dev: "1", ino, type: "file" as const, links: 1 as const,
  objectGeneration: { version: 1 as const, domain: "store-object-generation-v1" as const, opaque: `synthetic-${ino}` },
});
export function syntheticProgress() {
  const row = {
    version: 1, batchId, generationId: batchId,
    originalAction: {
      version: 1 as const, verb: "integrate" as const, projection: { version: 1 as const, verb: "integrate" as const, handle: "test-handle" as const },
      intent: { effect: "integration", token: "synthetic-token" }, runId: "test-run", // privacy-ok: synthetic test token
      progress: { batchId, generationId: batchId },
    },
    phase: "seal",
    sealGate: { state: "preparing", sourceIdentityBefore: identity("1"), sourceHashBefore: sha256("log"), rotateAfterHash: null },
    source: { identity: identity("1"), bytes: 100, sha256: sha256("log") },
    rotation: {
      sealedPath: `log.sealed-${batchId}`, indexBeforeHash: hashOf("index"), indexAfterHash: hashOf("index-after"),
      next: {
        version: 1 as const, exclusiveNameToken: batchId, path: "log.next" as const, bytes: 0 as const,
        sha256: sha256(""), identity: identity("4"), mount: syntheticMount,
      },
    },
    cursor: 0, chunk: 0, monthDelta: {}, outputs: [], outputOrigin: null,
    summary: { beforeHash: hashOf("summary"), afterHash: null, tempPath: `summary.tmp-${batchId}`, tempIdentity: null },
    retainedIndex: { beforeHash: hashOf("index-after"), afterHash: null, tempPath: `index.tmp-${batchId}`, tempIdentity: null },
    publisherProof: {
      current: { path: "state", identity: identity("2"), hash: hashOf("current"), revision: 10 },
      previous: { path: "state.prev", identity: identity("3"), hash: hashOf("previous"), revision: 9 },
      exactResults: [],
    }, finalState: null, report: null,
  };
  return schema.parse({ ...row, rotation: { ...row.rotation, indexTemp: {
    version: 1, exclusiveNameToken: "b".repeat(24), path: "rotation-index.tmp", mount: syntheticMount,
    identity: identity("8"), bytes: 200, sha256: row.rotation.indexAfterHash,
    authorization: rotationIndexAuthorization(row, {
      path: "journal-index.json", identity: identity("7"), bytes: 180, sha256: row.rotation.indexBeforeHash,
    }),
  } } });
}
function fixture(verify = () => true) {
  const root = mkdtempSync(join(tmpdir(), "tenet-progress-")); roots.push(root);
  const files = new StorageV3Files(root, {
    objectGeneration: supplementalGeneration,
    renameNoReplace: supplementalMove,
    assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
  });
  const store = new RetentionProgressStore(files, schema, verify);
  return { root, files, store };
}
const refusal = (error: unknown) => error instanceof KernelError &&
  error.reasons[0]?.code === "storage-accounting-unknown";
describe("durable retention progress store (Windows is supplemental)", () => {
  it("publishes strict canonical first-seal action and re-admits two independent restarts [AC-19] CT-46", () => {
    const f = fixture(), row = syntheticProgress();
    const published = f.store.create(row);
    assert.equal(readFileSync(join(f.root, "compaction.retention.json"), "utf8"), stableStringify(row) + "\n");
    const restart = new RetentionProgressStore(f.files, schema, () => true);
    const again = new RetentionProgressStore(f.files, schema, () => true);
    assert.deepEqual(restart.load()?.record, published.record);
    assert.deepEqual(again.load()?.record.originalAction, row.originalAction);
    assert.equal(f.files.read(`compaction.retention.json.tmp-${batchId}`), null);
  });
  it("refuses malformed or provider-unverified action before any progress publication [AC-19] CT-46", () => {
    const f = fixture(() => false), row = syntheticProgress();
    assert.throws(() => f.store.create(row), refusal);
    assert.equal(f.store.load(), null);
    const g = fixture();
    assert.throws(() => g.store.create({ ...row, originalAction: { ...row.originalAction, raw: "excluded" } }), refusal);
    assert.equal(g.store.load(), null);
  });
  it("does not replace an original action or an independently changed progress record [AC-19] CT-46", () => {
    const f = fixture(), row = syntheticProgress(), first = f.store.create(row);
    assert.throws(() => f.store.update(first, {
      ...row, originalAction: { ...row.originalAction, intent: { ...row.originalAction.intent, token: "other-token" } }, // privacy-ok: synthetic mismatch token
    }), refusal);
    writeFileSync(join(f.root, "compaction.retention.json"), stableStringify({ ...row, chunk: 1 }));
    assert.throws(() => f.store.update(first, row), refusal);
  });
  it("never upgrades a pre-amendment row or deletes progress without report admission [AC-19] CT-18 CT-46", () => {
    const f = fixture(), { originalAction: _action, ...legacy } = syntheticProgress();
    writeFileSync(join(f.root, "compaction.retention.json"), JSON.stringify(legacy));
    assert.throws(() => f.store.load(), refusal);
    assert.equal(readFileSync(join(f.root, "compaction.retention.json"), "utf8"), JSON.stringify(legacy));
    const g = fixture(), first = g.store.create(syntheticProgress());
    assert.throws(() => g.store.complete(first, () => true), refusal);
    assert.ok(g.files.read("compaction.retention.json"));
  });
  it("refuses a changed/occupied progress temporary without overwriting it [AC-19] CT-41", () => {
    const f = fixture(), row = syntheticProgress();
    writeFileSync(join(f.root, `compaction.retention.json.tmp-${batchId}`), "unproved");
    assert.throws(() => f.store.create(row), refusal);
    assert.equal(readFileSync(join(f.root, `compaction.retention.json.tmp-${batchId}`), "utf8"), "unproved");
    assert.equal(f.store.load(), null);
  });
  it("never rolls back committed cursors, counts, outputs or a rotated seal gate [AC-19] CT-40 CT-41", () => {
    const f = fixture(), row = syntheticProgress(), first = f.store.create(row);
    const rotated = f.store.update(first, {
      ...row, sealGate: { ...row.sealGate, state: "rotated", rotateAfterHash: row.rotation.indexAfterHash },
    });
    const scan = f.store.update(rotated, { ...rotated.record, phase: "scan" });
    const output = {
      ordinal: 0, path: `log.retained-${batchId}-0`, identity: identity("6"),
      sourceStart: 0, sourceEnd: 10, bytes: 5, sha256: hashOf("retained"),
    };
    const origin = f.store.update(scan, {
      ...scan.record, phase: "retained-output", outputOrigin: {
        ordinal: 0, tempPath: `retained.tmp-${batchId}`, finalPath: output.path,
        sourceStart: 0, sourceEnd: 10, bytes: 5, sha256: output.sha256, tempIdentity: null,
      },
    });
    const bound = f.store.update(origin, {
      ...origin.record, outputOrigin: { ...origin.record.outputOrigin!, tempIdentity: output.identity },
    });
    const advanced = f.store.update(bound, {
      ...scan.record, cursor: 10, chunk: 1, outputs: [output],
      monthDelta: { "2026-01": { calls: { check: 1 }, exits: { "0": 1 }, intents: 0, results: 0, accounting: 0, workSeq: 0, generationSeq: 0 } },
    });
    for (const damaged of [
      scan.record, row, { ...advanced.record, outputs: [] }, { ...advanced.record, monthDelta: {} },
      { ...advanced.record, source: { ...row.source, bytes: 101 } },
      { ...advanced.record, rotation: { ...row.rotation, indexBeforeHash: hashOf("other") } },
      { ...advanced.record, chunk: 2 }, { ...advanced.record, cursor: 11, chunk: 3 },
    ]) assert.throws(() => f.store.update(advanced, damaged), refusal);
    assert.deepEqual(f.store.load()?.record, advanced.record);
  });
});
