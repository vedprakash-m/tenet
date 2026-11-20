import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { hashOf, sha256 } from "../src/core/ids.ts";
import { retentionProgressSchema, rotationIndexAuthorization } from "../src/core/retention-records.ts";
import { syntheticMount } from "./fixtures/supplemental-move.ts";

const Projection = z.strictObject({
  version: z.literal(1), verb: z.literal("integrate"), handle: z.literal("test-handle"),
});
const schema = retentionProgressSchema({
  projection: Projection, effect: z.literal("integration"),
  token: z.string().regex(/^sha256:[0-9a-f]{64}$/), runId: z.literal("test-reserved-run"),
});
const batchId = "a".repeat(24);
const identity = (ino: string) => ({
  dev: "1", ino, type: "file" as const, links: 1 as const,
  objectGeneration: { version: 1 as const, domain: "store-object-generation-v1" as const, opaque: `synthetic-${ino}` },
});
function progress() {
  const projection = Projection.parse({ version: 1, verb: "integrate", handle: "test-handle" });
  const row = {
    version: 1 as const, batchId, generationId: batchId,
    originalAction: {
      version: 1 as const, verb: "integrate" as const, projection,
      intent: { effect: "integration", token: `sha256:${hashOf(projection)}` },
      runId: "test-reserved-run", progress: { batchId, generationId: batchId },
    },
    phase: "seal" as const,
    sealGate: {
      state: "preparing" as const, sourceIdentityBefore: identity("1"),
      sourceHashBefore: hashOf("source"), rotateAfterHash: null,
    },
    source: { identity: identity("1"), bytes: 100, sha256: hashOf("source") },
    rotation: {
      sealedPath: `log.sealed-${batchId}`,
      next: {
        version: 1 as const, exclusiveNameToken: batchId, path: "log.next" as const, bytes: 0 as const,
        sha256: sha256(""), identity: identity("4"), mount: syntheticMount,
      },
      indexBeforeHash: hashOf("old-index"), indexAfterHash: hashOf("rotated-index"),
    },
    cursor: 0, chunk: 0, monthDelta: {}, outputs: [], outputOrigin: null,
    summary: { beforeHash: hashOf("old-summary"), afterHash: null, tempPath: `summary.tmp-${batchId}`, tempIdentity: null },
    retainedIndex: {
      beforeHash: hashOf("rotated-index"), afterHash: null, tempPath: `index.tmp-${batchId}`, tempIdentity: null,
    },
    publisherProof: {
      current: { path: "state", identity: identity("2"), hash: hashOf("current-state"), revision: 10 },
      previous: { path: "state.prev", identity: identity("3"), hash: hashOf("previous-state"), revision: 9 },
      exactResults: [],
    },
    finalState: null, report: null,
  };
  const indexBefore = { path: "journal-index.json", identity: identity("7"), bytes: 200, sha256: row.rotation.indexBeforeHash };
  return { ...row, rotation: { ...row.rotation, indexTemp: {
    version: 1 as const, exclusiveNameToken: "b".repeat(24), path: "rotation-index.tmp" as const,
    mount: syntheticMount, identity: identity("8"), bytes: 220, sha256: row.rotation.indexAfterHash,
    authorization: rotationIndexAuthorization(row, indexBefore),
  } } };
}

function scanning() {
  const row = progress();
  return {
    ...row, phase: "retained-output" as const,
    sealGate: { ...row.sealGate, state: "rotated" as const, rotateAfterHash: row.rotation.indexAfterHash },
    rotation: row.rotation,
  };
}

describe("retention progress wire admission (not durable continuation)", () => {
  it("refuses every mutated duplicated index authorization leaf without re-binding the seal [AC-19] CT-57", () => {
    const row = progress();
    const visit = (value: unknown, path: string[] = []): string[][] => {
      if (!value || typeof value !== "object") return [path];
      return Object.entries(value).flatMap(([key, child]) => visit(child, [...path, key]));
    };
    for (const path of visit(row.rotation.indexTemp.authorization)) {
      if (path[0] === "indexBefore" && !["path", "sha256"].includes(path[1]!)) continue;
      const damaged = structuredClone(row);
      damaged.rotation.indexTemp.authorization = structuredClone(damaged.rotation.indexTemp.authorization);
      let cursor: Record<string, unknown> = damaged.rotation.indexTemp.authorization;
      for (const key of path.slice(0, -1)) cursor = cursor[key] as Record<string, unknown>;
      const key = path.at(-1)!;
      cursor[key] = typeof cursor[key] === "number" ? Number(cursor[key]) + 1 : "different";
      assert.equal(schema.safeParse(damaged).success, false, path.join("."));
    }
    for (const indexTemp of [
      { ...row.rotation.indexTemp, exclusiveNameToken: row.rotation.next.exclusiveNameToken },
      { ...row.rotation.indexTemp, extra: true },
      { ...row.rotation.indexTemp, version: 2 },
      { ...row.rotation.indexTemp, sha256: hashOf("changed") },
      { ...row.rotation.indexTemp, mount: { ...row.rotation.indexTemp.mount, discriminator: {
        ...row.rotation.indexTemp.mount.discriminator, opaque: "different-mounted-directory",
      } } },
    ]) assert.equal(schema.safeParse({ ...row, rotation: { ...row.rotation, indexTemp } }).success, false);
  });
  it("refuses a seal without the provider-bound rotation index temporary [AC-19] CT-57", () => {
    const row = progress();
    const rotation = Object.fromEntries(Object.entries(row.rotation).filter(([key]) => key !== "indexTemp"));
    assert.equal(schema.safeParse({ ...row, rotation }).success, false);
  });
  it("admits first-seal originalAction only with its exact enclosing batch and generation [AC-19] CT-46", () => {
    const row = progress();
    assert.deepEqual(schema.parse(row), row);
    for (const damaged of [
      { ...row, batchId: "c".repeat(24) },
      { ...row, generationId: "c".repeat(24) },
      { ...row, originalAction: { ...row.originalAction, progress: { batchId: "c".repeat(24), generationId: "c".repeat(24) } } },
      { ...row, originalAction: { ...row.originalAction, verb: "undo" } },
      { ...row, originalAction: { ...row.originalAction, projection: { ...row.originalAction.projection, raw: "excluded" } } },
    ]) assert.equal(schema.safeParse(damaged).success, false);
    const { originalAction: _action, ...oldRow } = row;
    assert.equal(schema.safeParse(oldRow).success, false);
  });

  it("refuses unsupported fields and phases without stripping or synthesizing progress [AC-19] CT-6 CT-46", () => {
    const row = progress();
    for (const damaged of [
      { ...row, version: 2 }, { ...row, phase: "complete" }, { ...row, argv: ["excluded"] },
      { ...row, source: { ...row.source, path: "log" } },
      { ...row, rotation: { ...row.rotation, nextPath: "other-next" } },
      { ...row, rotation: { ...row.rotation, unused: true } },
      { ...row, sealGate: { ...row.sealGate, state: "unknown" } },
    ]) assert.equal(schema.safeParse(damaged).success, false);
  });

  it("refuses cross-bound source, rotation identity and cursor observations [AC-19] CT-31 CT-41", () => {
    const row = progress();
    for (const damaged of [
      { ...row, source: { ...row.source, identity: identity("99") } },
      { ...row, source: { ...row.source, sha256: hashOf("different-source") } },
      { ...row, cursor: 101 }, { ...row, cursor: -1 }, { ...row, chunk: 1.5 },
      { ...row, rotation: { ...row.rotation, nextIdentity: identity("4") } },
      { ...row, rotation: { ...row.rotation, nextSha256: hashOf("") } },
      { ...row, rotation: { ...row.rotation, sealedPath: "../outside" } },
    ]) assert.equal(schema.safeParse(damaged).success, false);
  });

  it("requires the rotated gate before scans and an exact final state pair before removal [AC-19] CT-41 CT-42", () => {
    const row = progress();
    assert.equal(schema.safeParse({ ...row, phase: "scan" }).success, false);
    const rotated = {
      ...row, phase: "scan",
      sealGate: { ...row.sealGate, state: "rotated", rotateAfterHash: row.rotation.indexAfterHash },
      rotation: row.rotation,
    };
    assert.equal(schema.safeParse(rotated).success, true);
    assert.equal(schema.safeParse({ ...rotated, phase: "remove" }).success, false);
    const finalState = {
      current: { identity: row.publisherProof.current.identity, hash: row.publisherProof.current.hash },
      previous: { identity: row.publisherProof.previous.identity, hash: row.publisherProof.previous.hash },
    };
    assert.equal(schema.safeParse({ ...rotated, phase: "remove", cursor: row.source.bytes, chunk: 1, finalState }).success, true);
    assert.equal(schema.safeParse({
      ...rotated, phase: "remove", cursor: row.source.bytes, chunk: 1,
      finalState: { ...finalState, current: { ...finalState.current, identity: identity("99") } },
    }).success, false);
  });

  it("accepts report-pending only with exact original-action binding when a report is present [AC-19] CT-18 CT-46", () => {
    const row = progress();
    const report = {
      inputHash: hashOf("admitted-input"), responseHash: hashOf("response"),
      stateBeforeIdentity: identity("2"), stateBeforeHash: row.publisherProof.current.hash,
      stateAfterIdentity: identity("5"), stateAfterHash: hashOf("after-state"), callHash: hashOf("call"),
      logBeforeHash: hashOf("log-before"), logAfterHash: hashOf("log-after"),
      originalActionHash: hashOf(row.originalAction),
    };
    const pending = {
      ...row, phase: "report", cursor: row.source.bytes, chunk: 1,
      sealGate: { ...row.sealGate, state: "rotated", rotateAfterHash: row.rotation.indexAfterHash },
      rotation: row.rotation,
      finalState: {
        current: { identity: identity("2"), hash: row.publisherProof.current.hash },
        previous: { identity: identity("3"), hash: row.publisherProof.previous.hash },
      },
    };
    assert.equal(schema.safeParse({ ...pending, report: null }).success, true);
    assert.equal(schema.safeParse({ ...pending, report }).success, true);
    assert.equal(schema.safeParse({ ...pending, report: { ...report, originalActionHash: hashOf("other-action") } }).success, false);
    assert.equal(schema.safeParse({ ...pending, report: { ...report, stateBeforeIdentity: identity("99") } }).success, false);
    assert.equal(schema.safeParse({ ...pending, report: { ...report, stateBeforeHash: hashOf("other-state") } }).success, false);
    const { originalActionHash: _binding, ...oldReport } = report;
    assert.equal(schema.safeParse({ ...pending, report: oldReport }).success, false);
    assert.equal(schema.safeParse({ ...pending, phase: "scan", report }).success, false);
  });

  it("refuses progress paths that alias another owned record or selected output [AC-19] CT-41", () => {
    const row = scanning();
    const output = {
      ordinal: 0, path: `log.retained-${batchId}-0`, identity: identity("6"),
      sourceStart: 0, sourceEnd: 30, bytes: 30, sha256: hashOf("retained"),
    };
    for (const damaged of [
      { ...row, rotation: { ...row.rotation, sealedPath: "state" } },
      { ...row, summary: { ...row.summary, tempPath: "state.prev" } },
      { ...row, retainedIndex: { ...row.retainedIndex, tempPath: row.summary.tempPath.toUpperCase() } },
      { ...row, cursor: 30, chunk: 1, outputs: [output], summary: { ...row.summary, tempPath: output.path } },
      { ...row, cursor: 30, chunk: 2, outputs: [output, { ...output, ordinal: 1 }] },
    ]) assert.equal(schema.safeParse(damaged).success, false);
  });

  it("binds completed outputs to ordered admitted source ranges and the committed cursor [AC-19] CT-41", () => {
    const row = scanning();
    const output = {
      ordinal: 0, path: `log.retained-${batchId}-0`, identity: identity("6"),
      sourceStart: 0, sourceEnd: 30, bytes: 20, sha256: hashOf("retained"),
    };
    const withOutput = { ...row, cursor: 30, chunk: 1, outputs: [output] };
    assert.equal(schema.safeParse(withOutput).success, true);
    for (const damaged of [
      { ...withOutput, cursor: 29 },
      { ...withOutput, outputs: [{ ...output, sourceStart: 31 }] },
      { ...withOutput, outputs: [{ ...output, bytes: 31 }] },
      { ...withOutput, outputs: [{ ...output, sourceEnd: 101 }] },
      { ...withOutput, outputs: [output, { ...output, ordinal: 1, path: `log.retained-${batchId}-1` }] },
    ]) assert.equal(schema.safeParse(damaged).success, false);
  });

  it("keeps origin at the old cursor and refuses publisherless exact-result assertions [AC-19] CT-23 CT-41", () => {
    const row = scanning();
    const outputOrigin = {
      ordinal: 0, tempPath: `retained.tmp-${batchId}`, finalPath: `log.retained-${batchId}-0`,
      sourceStart: 0, sourceEnd: 30, bytes: 20, sha256: hashOf("retained"), tempIdentity: null,
    };
    assert.equal(schema.safeParse({ ...row, outputOrigin }).success, true);
    for (const damaged of [
      { ...row, outputOrigin: { ...outputOrigin, sourceStart: 1 } },
      { ...row, outputOrigin: { ...outputOrigin, sourceEnd: 101 } },
      { ...row, outputOrigin: { ...outputOrigin, bytes: 31 } },
      { ...row, outputOrigin: { ...outputOrigin, tempPath: "marker" } },
      { ...row, publisherProof: {
        ...row.publisherProof, exactResults: [{ generation: batchId, offset: 0, effect: "index-sync", id: "test-id" }],
      } },
    ]) assert.equal(schema.safeParse(damaged).success, false);
  });

  it("does not enter publication before scanning finishes or admit scan output during sealing [AC-19] CT-41", () => {
    const row = scanning();
    assert.equal(schema.safeParse({ ...row, phase: "summary" }).success, false);
    assert.equal(schema.safeParse({ ...row, phase: "index" }).success, false);
    assert.equal(schema.safeParse({ ...row, phase: "summary", cursor: row.source.bytes, chunk: 1 }).success, true);
    const output = {
      ordinal: 0, path: `log.retained-${batchId}-0`, identity: identity("6"),
      sourceStart: 0, sourceEnd: 30, bytes: 20, sha256: hashOf("retained"),
    };
    assert.equal(schema.safeParse({ ...progress(), cursor: 30, outputs: [output] }).success, false);
  });

  it("requires bound empty next-log proof at the rotated seal boundary [AC-19] CT-31 CT-41", () => {
    const row = scanning(), sealed = { ...row, phase: "seal" };
    assert.equal(schema.safeParse(sealed).success, true);
    assert.equal(schema.safeParse({
      ...sealed, rotation: { ...sealed.rotation, nextIdentity: null, nextSha256: null },
    }).success, false);
    assert.equal(schema.safeParse({
      ...sealed, rotation: { ...sealed.rotation, nextSha256: hashOf("nonempty") },
    }).success, false);
    assert.equal(schema.safeParse({
      ...sealed, sealGate: { ...sealed.sealGate, state: "cancelled" },
      rotation: { ...sealed.rotation, next: { ...sealed.rotation.next, sha256: hashOf("token") } },
    }).success, false);
  });

  it("binds output ordinals to committed chunks without reusing no-output gaps [AC-19] CT-40 CT-41", () => {
    const row = scanning();
    const output = {
      ordinal: 0, path: `log.retained-${batchId}-0`, identity: identity("6"),
      sourceStart: 0, sourceEnd: 30, bytes: 20, sha256: hashOf("retained"),
    };
    const withOutput = { ...row, cursor: 30, chunk: 1, outputs: [output] };
    assert.equal(schema.safeParse(withOutput).success, true);
    assert.equal(schema.safeParse({ ...withOutput, outputs: [{ ...output, ordinal: 9 }] }).success, false);
    assert.equal(schema.safeParse({ ...withOutput, chunk: 0 }).success, false);
    assert.equal(schema.safeParse({ ...row, cursor: 1, chunk: 0 }).success, false);
    const later = { ...output, ordinal: 2, path: `log.retained-${batchId}-2`, sourceStart: 60, sourceEnd: 80 };
    assert.equal(schema.safeParse({ ...row, cursor: 80, chunk: 3, outputs: [output, later] }).success, true);
    assert.equal(schema.safeParse({
      ...row, cursor: 80, chunk: 3, outputs: [{ ...output, ordinal: 2 }, { ...later, ordinal: 1 }],
    }).success, false);
    const origin = {
      ordinal: 9, tempPath: `retained.tmp-${batchId}`, finalPath: `log.retained-${batchId}-9`,
      sourceStart: 0, sourceEnd: 30, bytes: 20, sha256: hashOf("retained"), tempIdentity: null,
    };
    assert.equal(schema.safeParse({ ...row, outputOrigin: origin }).success, false);
  });

  it("never declares an empty retained output or pending output origin [AC-19] CT-41", () => {
    const row = scanning();
    const output = {
      ordinal: 0, path: `log.retained-${batchId}-0`, identity: identity("6"),
      sourceStart: 0, sourceEnd: 30, bytes: 0, sha256: sha256(""),
    };
    assert.equal(schema.safeParse({ ...row, cursor: 30, chunk: 1, outputs: [output] }).success, false);
    assert.equal(schema.safeParse({ ...row, outputOrigin: {
      ordinal: 0, tempPath: `retained.tmp-${batchId}`, finalPath: output.path,
      sourceStart: 0, sourceEnd: 30, bytes: 0, sha256: sha256(""), tempIdentity: null,
    } }).success, false);
  });
  it("admits only the signed empty mounted reservation and refuses old token rows [AC-19] CT-25 CT-31 CT-56", () => {
    const row = progress();
    const rotation = row.rotation;
    assert.equal(schema.safeParse({ ...row, rotation }).success, true);
    for (const next of [
      { ...rotation.next, exclusiveNameToken: "b".repeat(24) }, { ...rotation.next, bytes: 1 },
      { ...rotation.next, sha256: hashOf("nonempty") }, { ...rotation.next, identity: null },
      { ...rotation.next, mount: { ...rotation.next.mount, root: { ...rotation.next.mount.root, ino: "0" } } },
    ]) assert.equal(schema.safeParse({ ...row, rotation: { ...rotation, next } }).success, false);
  });
});
