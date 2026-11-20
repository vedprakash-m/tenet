import { z } from "zod";
import { StorageV3Files } from "../../src/adapters/storage-v3-write.ts";
import { RetentionProgressStore } from "../../src/adapters/retention-progress-fs.ts";
import { retentionProgressSchema, rotationIndexAuthorization } from "../../src/core/retention-records.ts";
import { sha256, stableStringify } from "../../src/core/ids.ts";
import { JournalIndexV1 } from "../../src/core/storage-records.ts";
import { supplementalGeneration, supplementalMove, syntheticMount } from "./supplemental-move.ts";

const Projection = z.strictObject({ version: z.literal(1), verb: z.literal("integrate"), handle: z.literal("test-handle") });
export const boundSchema = retentionProgressSchema({
  projection: Projection, effect: z.literal("integration"), token: z.literal("synthetic-token"), runId: z.literal("test-run"),
});
export const batchId = "a".repeat(24);
export function openBoundStore(root: string) {
  const files = new StorageV3Files(root, {
    objectGeneration: supplementalGeneration,
    renameNoReplace: supplementalMove,
    assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
  });
  const store = new RetentionProgressStore(files, boundSchema, () => true);
  return { files, store };
}
export function makeBoundFixture(root: string) {
  const { files, store } = openBoundStore(root);
  const sourceBytes = Buffer.from('{"t":"2026-01-01T00:00:00.000Z","kind":"call","verb":"check","exit":0,"revision":1}\n');
  const source = files.create("log", sourceBytes);
  const current = files.create("state", Buffer.from('{"schema":3,"revision":10}'));
  const previous = files.create("state.prev", Buffer.from('{"schema":3,"revision":9}'));
  const summary = files.create("summaries.json", Buffer.from(stableStringify({
    version: 2, batchId, from: sha256(""), months: {}, legacyBase: null,
  }) + "\n"));
  const index = JournalIndexV1.parse({
    version: 1, active: { path: "log", identity: source.identity }, summary: { ...summary, batchId }, sealed: [],
  });
  const before = files.create("journal-index.json", Buffer.from(stableStringify(index) + "\n"));
  const next = files.create("log.next", Buffer.alloc(0));
  const afterIndex = Buffer.from(stableStringify({
    ...index, active: { path: "log", identity: next.identity },
    sealed: [{ ...source, path: `log.sealed-${batchId}`, id: batchId, first: "2026-01-01", last: "2026-01-01" }],
  }) + "\n");
  const proposed = {
    version: 1, batchId, generationId: batchId,
    originalAction: {
      version: 1 as const, verb: "integrate" as const, projection: { version: 1 as const, verb: "integrate" as const, handle: "test-handle" as const },
      intent: { effect: "integration", token: "synthetic-token" }, runId: "test-run", progress: { batchId, generationId: batchId }, // privacy-ok: synthetic test token
    },
    phase: "seal",
    sealGate: { state: "preparing", sourceIdentityBefore: source.identity, sourceHashBefore: source.sha256, rotateAfterHash: null },
    source: { identity: source.identity, bytes: source.bytes, sha256: source.sha256 },
    rotation: {
      sealedPath: `log.sealed-${batchId}`, indexBeforeHash: before.sha256, indexAfterHash: sha256(afterIndex),
      next: {
        version: 1 as const, exclusiveNameToken: batchId, path: "log.next" as const, bytes: 0 as const,
        sha256: sha256(""), identity: next.identity, mount: syntheticMount,
      },
    },
    cursor: 0, chunk: 0, monthDelta: {}, outputs: [], outputOrigin: null,
    summary: { beforeHash: summary.sha256, afterHash: null, tempPath: `summary.tmp-${batchId}`, tempIdentity: null },
    retainedIndex: { beforeHash: sha256(afterIndex), afterHash: null, tempPath: `index.tmp-${batchId}`, tempIdentity: null },
    publisherProof: {
      current: { path: "state", identity: current.identity, hash: current.sha256, revision: 10 },
      previous: { path: "state.prev", identity: previous.identity, hash: previous.sha256, revision: 9 },
      exactResults: [],
    }, finalState: null, report: null,
  };
  const temp = files.create("rotation-index.tmp", afterIndex);
  const row = boundSchema.parse({ ...proposed, rotation: { ...proposed.rotation, indexTemp: {
    version: 1, exclusiveNameToken: "b".repeat(24), ...temp, mount: syntheticMount,
    authorization: rotationIndexAuthorization(proposed, before),
  } } });
  store.create(row);
  return { files, store, row, afterIndex, sourceBytes };
}
