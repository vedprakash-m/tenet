import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { hashOf, stableStringify } from "../src/core/ids.ts";
import { KernelError } from "../src/core/errors.ts";
import { parseUniqueRecord } from "../src/core/private-record.ts";
import {
  retentionOriginalActionSchema, admitRetentionOriginalAction, retentionRequiredAction,
} from "../src/core/retention-original-action.ts";

// Synthetic privacy interface: this is not P93's production registry or token encoding.
const Projection = z.discriminatedUnion("verb", [
  z.strictObject({ version: z.literal(1), verb: z.literal("integrate"), handle: z.literal("test-handle") }),
  z.strictObject({ version: z.literal(1), verb: z.literal("undo"), handle: z.literal("test-handle") }),
]);
const schema = retentionOriginalActionSchema({
  projection: Projection,
  effect: z.enum(["integration", "undo"]),
  token: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  runId: z.literal("test-reserved-run"),
});
const batchId = "a".repeat(24);
const binding = { batchId, generationId: batchId };
function original() {
  const projection = Projection.parse({ version: 1, verb: "integrate", handle: "test-handle" });
  return {
    version: 1 as const, verb: "integrate" as const, projection,
    intent: { effect: "integration", token: `sha256:${hashOf(projection)}` },
    runId: "test-reserved-run", progress: { ...binding },
  };
}
const verify = (row: ReturnType<typeof schema.parse>) =>
  row.intent.effect === "integration" && row.intent.token === `sha256:${hashOf(row.projection)}` &&
  row.runId === "test-reserved-run";
const refused = (run: () => unknown) => assert.throws(run, (error: unknown) =>
  error instanceof KernelError && error.reasons[0]?.code === "storage-accounting-unknown");

describe("retained original-action storage boundary", () => {
  it("admits only strict correlated P93 rows without normalizing retained input [AC-19] CT-46", () => {
    const row = original();
    assert.deepEqual(schema.parse(row), row);
    for (const damaged of [
      { ...row, version: 2 },
      { ...row, verb: "commit" },
      { ...row, verb: "undo" },
      { ...row, argv: ["excluded-input"] },
      { ...row, projection: { ...row.projection, request: "excluded-input" } },
      { ...row, projection: { version: 1, verb: "integrate" } },
      { ...row, intent: { ...row.intent, raw: "excluded-input" } },
      { ...row, progress: { ...binding, generationId: "b".repeat(24) } },
      { ...row, progress: { ...binding, source: "excluded-input" } },
    ]) assert.equal(schema.safeParse(damaged).success, false);
    const { projection: _projection, ...missing } = row;
    assert.equal(schema.safeParse(missing).success, false);
  });

  it("does not accept an injected projection parser that strips excluded bytes [AC-19] CT-46", () => {
    const stripping = retentionOriginalActionSchema({
      projection: z.object({ version: z.literal(1), verb: z.literal("integrate"), handle: z.literal("test-handle") }),
      effect: z.literal("integration"), token: z.string(), runId: z.literal("test-reserved-run"),
    });
    const row = original();
    assert.equal(stripping.safeParse({ ...row, projection: { ...row.projection, request: "excluded-input" } }).success, false);
  });

  it("does not accept normalization of an injected token, effect or run reference [AC-19] CT-46", () => {
    const normalizing = retentionOriginalActionSchema({
      projection: Projection, effect: z.string().trim(), token: z.string().trim(), runId: z.string().trim(),
    });
    const row = original();
    for (const damaged of [
      { ...row, intent: { ...row.intent, effect: " integration " } },
      { ...row, intent: { ...row.intent, token: ` ${row.intent.token} ` } },
      { ...row, runId: " test-reserved-run " },
    ]) assert.equal(normalizing.safeParse(damaged).success, false);
  });

  it("binds the exact enclosing batch and generation before consulting privacy proofs [AC-19] CT-46", () => {
    let proofs = 0;
    const prove = () => { proofs++; return true; };
    const row = original();
    refused(() => admitRetentionOriginalAction(schema, row, { ...binding, batchId: "b".repeat(24) }, prove));
    refused(() => admitRetentionOriginalAction(schema, row, { ...binding, generationId: "b".repeat(24) }, prove));
    refused(() => admitRetentionOriginalAction(schema, { ...row, raw: "excluded" }, binding, prove));
    assert.equal(proofs, 0);
  });

  it("requires the owning privacy interface to prove token, effect and reserved-run bindings [AC-19] CT-46", () => {
    const row = original();
    assert.deepEqual(admitRetentionOriginalAction(schema, row, binding, verify).action, row);
    for (const damaged of [
      { ...row, intent: { ...row.intent, token: `sha256:${"0".repeat(64)}` } },
      { ...row, intent: { ...row.intent, effect: "undo" } },
      { ...row, runId: null },
    ]) refused(() => admitRetentionOriginalAction(schema, damaged, binding, verify));
    refused(() => admitRetentionOriginalAction(schema, row, binding, () => false));
  });

  it("checks a present report hash against the exact admitted canonical row [AC-19] CT-46", () => {
    const row = original(), admitted = admitRetentionOriginalAction(schema, row, binding, verify);
    assert.equal(admitted.originalActionHash, hashOf(row));
    assert.deepEqual(admitRetentionOriginalAction(schema, row, {
      ...binding, reportOriginalActionHash: admitted.originalActionHash,
    }, verify), admitted);
    refused(() => admitRetentionOriginalAction(schema, row, {
      ...binding, reportOriginalActionHash: "0".repeat(64),
    }, verify));
    refused(() => admitRetentionOriginalAction(schema, row, {
      ...binding, reportOriginalActionHash: "",
    }, verify));
  });

  it("refuses a verifier that changes the original row while proving it [AC-19] CT-46", () => {
    refused(() => admitRetentionOriginalAction(schema, original(), binding, row => {
      row.runId = null;
      return true;
    }));
    refused(() => admitRetentionOriginalAction(schema, original(), binding, row => {
      row.projection.verb = "undo";
      return true;
    }));
  });

  it("isolates admitted action from later caller and verifier alias mutations [AC-19] CT-46", async () => {
    const row = original(), bytes = stableStringify(row);
    const admitted = admitRetentionOriginalAction(schema, row, binding, action => {
      queueMicrotask(() => { action.runId = null; });
      return verify(action);
    });
    row.projection.verb = "undo";
    await Promise.resolve();
    assert.equal(stableStringify(admitted.action), bytes);
    assert.equal(admitted.originalActionHash, hashOf(admitted.action));
    assert.deepEqual(retentionRequiredAction(admitted), { verb: "integrate", projection: original().projection });
  });

  it("prevents consumers from changing an admitted projection or its report binding [AC-19] CT-46", () => {
    const admitted = admitRetentionOriginalAction(schema, original(), binding, verify);
    assert.throws(() => { admitted.action.projection.verb = "undo"; }, TypeError);
    assert.throws(() => { admitted.action.progress.batchId = "b".repeat(24); }, TypeError);
    assert.throws(() => { admitted.originalActionHash = "0".repeat(64); }, TypeError);
    assert.equal(admitted.originalActionHash, hashOf(admitted.action));
  });

  it("re-admits two serialized restarts without changing the retained action or next projection [AC-19] CT-46", () => {
    const row = original(), bytes = stableStringify(row);
    const first = admitRetentionOriginalAction(schema, parseUniqueRecord(bytes), binding, verify);
    const second = admitRetentionOriginalAction(schema, parseUniqueRecord(stableStringify(first.action)), binding, verify);
    assert.equal(stableStringify(first.action), bytes);
    assert.equal(stableStringify(second.action), bytes);
    assert.equal(first.originalActionHash, second.originalActionHash);
    assert.deepEqual(retentionRequiredAction(second), { verb: row.verb, projection: row.projection });
    const next = retentionRequiredAction(second);
    next.projection.verb = "undo";
    assert.equal(second.action.projection.verb, "integrate");
  });
});
