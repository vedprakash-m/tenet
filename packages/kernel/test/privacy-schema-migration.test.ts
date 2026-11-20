import { test } from "node:test";
import assert from "node:assert/strict";
import { privacyPublicationStep } from "../src/core/privacy-migration.ts";
import { LegacyReceiptV3, projectLegacyReceipt } from "../src/core/schemas-migrate.ts";
import { KernelError } from "../src/core/errors.ts";
import { mock } from "node:test";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { migrationSnapshotIdentity } from "../src/core/migration-identity.ts";

function cleanAfterProjection() {
  return {
    operation: "privacy-schema-3-migration", populationVersion: 2,
    key: { path: "digest.key", after: {
      presence: "present", identity: { dev: "1", ino: "2", type: "file", links: 1 },
      bytes: 84, magic: "TK1\0", digestKeyId: "0123456789abcdef0123456789abcdef",
    } },
    targets: ["state.prev", "state", "marker", "summaries.json", "journal-index.json"].map((path, i) => ({
      path, after: {
        presence: "present", identity: { dev: "1", ino: String(i + 3), type: "file", links: 1 },
        bytes: String(i + 11), sha256: String.fromCharCode(97 + i).repeat(64), schema: 3,
      },
    })),
  };
}

test("[CON-03] [SEC-11] clean migration identities reproduce the amended canonical vectors independent of object key order", () => {
  const projection = cleanAfterProjection(), before = structuredClone(projection);
  const result = migrationSnapshotIdentity(projection);
  const after = '{"key":{"after":{"bytes":84,"digestKeyId":"0123456789abcdef0123456789abcdef",' +
    '"identity":{"dev":"1","ino":"2","links":1,"type":"file"},"magic":"TK1\\u0000","presence":"present"},' +
    '"path":"digest.key"},"operation":"privacy-schema-3-migration","populationVersion":2,"targets":[' +
    projection.targets.map((target, i) => '{"after":{"bytes":"' + String(i + 11) + '",' +
      '"identity":{"dev":"1","ino":"' + String(i + 3) + '","links":1,"type":"file"},' +
      '"presence":"present","schema":3,"sha256":"' + String.fromCharCode(97 + i).repeat(64) +
      '"},"path":"' + target.path + '"}').join(",") + "]}";
  assert.equal(result.afterSnapshotCanonical, after);
  assert.equal(result.afterSnapshotHash, "a20678cdceaad2edaed99e49cba0aea04ca88c5f2b9a8ad881a391a2f0f8e1a7");
  assert.equal(result.populationCanonical, '{"afterSnapshotHash":"' + result.afterSnapshotHash +
    '","canonicalVersion":1,"members":["digest.key","state.prev","state","marker","summaries.json",' +
    '"journal-index.json"],"populationVersion":2}');
  assert.equal(result.populationHash, "698bbf583a4d8ae9857ade39964f7c96f8cf11c338ace0ca56ddae592cff8d0c");
  const reordered = {
    targets: projection.targets.map(target => ({
      after: { schema: target.after.schema, sha256: target.after.sha256, bytes: target.after.bytes,
        identity: { links: 1, type: "file", ino: target.after.identity.ino, dev: "1" }, presence: "present" },
      path: target.path,
    })),
    key: projection.key, populationVersion: 2, operation: projection.operation,
  };
  assert.deepEqual(migrationSnapshotIdentity(reordered), result);
  assert.deepEqual(projection, before);
});

test("[SEC-11] migration identities reject legacy authority tuples and every source field before hashing", () => {
  const projection = cleanAfterProjection(), before = structuredClone(projection);
  const invalid: unknown[] = [];
  for (const index of [0, 1, 2]) {
    for (const schema of [1, 2, null]) invalid.push({
      ...projection,
      targets: projection.targets.map((target, i) => i === index ? { ...target, after: { ...target.after, schema } } : target),
    });
  }
  invalid.push(
    { ...projection, source: { state: "synthetic legacy text" } },
    { ...projection, beforeSnapshotHash: "a".repeat(64) },
    { ...projection, snapshot: { handle: "synthetic opaque handle" } },
    { ...projection, journal: { path: "log", before: "synthetic legacy text" } },
    { ...projection, populationVersion: 1 },
    { ...projection, targets: [...projection.targets].reverse() },
    { ...projection, targets: [...projection.targets, projection.targets[0]] },
    { ...projection, targets: projection.targets.slice(1) },
    { ...projection, key: { ...projection.key, after: { ...projection.key.after, key: "synthetic private bytes" } } },
    { ...projection, targets: projection.targets.map(target => ({
      ...target, before: { sha256: "a".repeat(64), schema: 2 },
    })) },
  );
  for (const change of [
    { bytes: "01" }, { bytes: "1".repeat(41) }, { sha256: "synthetic unadmitted text" },
    { presence: "absent" }, { identity: { dev: "1", ino: "2", type: "file", links: 2 } },
    { path: "state.prev" },
  ]) invalid.push({
    ...projection, targets: projection.targets.map((target, i) =>
      i === 0 ? { ...target, after: { ...target.after, ...change } } : target),
  });
  const hash = mock.method(crypto, "createHash", () => assert.fail("legacy or undeclared migration content reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const value of invalid) assert.throws(() => migrationSnapshotIdentity(value),
      (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "unsupported-record");
    assert.equal(hash.mock.callCount(), 0);
    assert.deepEqual(projection, before);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[CON-05] migration after identities bind the exact key epoch, target identity, bytes and operation", () => {
  const projection = cleanAfterProjection(), original = migrationSnapshotIdentity(projection);
  const changed: unknown[] = [
    { ...projection, operation: "privacy-schema-3-fresh" },
    { ...projection, operation: "digest-key-repair-v3" },
    { ...projection, key: { ...projection.key, after: { ...projection.key.after, digestKeyId: "f".repeat(32) } } },
  ];
  for (const change of [
    { bytes: "12" }, { sha256: "f".repeat(64) },
    { identity: { dev: "1", ino: "999", type: "file", links: 1 } },
  ]) changed.push({
    ...projection, targets: projection.targets.map((target, i) =>
      i === 0 ? { ...target, after: { ...target.after, ...change } } : target),
  });
  for (const value of changed) {
    const result = migrationSnapshotIdentity(value);
    assert.notEqual(result.afterSnapshotHash, original.afterSnapshotHash);
    assert.notEqual(result.populationHash, original.populationHash);
  }
});

const refused = { kind: "refuse", code: "storage-accounting-unknown" };
const migrationPhases = ["prepared", "snapshot", "key", "previous", "state", "marker",
  "migration-evidence-installed", "remove"] as const;
function publication(phase: typeof migrationPhases[number], mask = 0) {
  const names = ["digest.key", "state.prev", "state", "marker", "summaries.json", "journal-index.json"] as const;
  return {
    operation: "privacy-schema-3-migration", phase, extraTemps: false,
    privateSource: phase === "prepared" ? "reserved" : "complete-exact",
    positions: Object.fromEntries(names.map((name, i) => [name, (mask & (1 << i)) !== 0 ? "after" : "before"])),
    evidence: "none", recovery: "none",
  };
}

test("[CON-03] [CON-05] snapshot migration permits only the reviewed target prefix at every persisted phase without hashing", () => {
  const expected: Record<string, Record<number, unknown>> = {
    prepared: { 0: { kind: "capture" } },
    snapshot: { 0: { kind: "publish", target: "summaries.json" }, 16: { kind: "publish", target: "journal-index.json" },
      48: { kind: "publish", target: "digest.key" }, 49: { kind: "advance", phase: "key" } },
    key: { 49: { kind: "publish", target: "state.prev" }, 51: { kind: "advance", phase: "previous" } },
    previous: { 51: { kind: "publish", target: "state" }, 55: { kind: "advance", phase: "state" } },
    state: { 55: { kind: "publish", target: "marker" }, 63: { kind: "advance", phase: "marker" } },
    marker: { 63: { kind: "publish-evidence", target: "target" } },
    "migration-evidence-installed": {}, remove: {},
  };
  const hash = mock.method(crypto, "createHash", () => assert.fail("publication ordering hashed a source observation"));
  syncBuiltinESMExports();
  try {
    for (const phase of migrationPhases) for (let mask = 0; mask < 64; mask++) {
      const observed = publication(phase, mask), before = structuredClone(observed);
      assert.deepEqual(privacyPublicationStep(observed), expected[phase]![mask] ?? refused, `${phase}, mask ${mask}`);
      assert.deepEqual(observed, before);
    }
    assert.deepEqual(privacyPublicationStep({ ...publication("prepared"), privateSource: "complete-exact" }),
      { kind: "advance", phase: "snapshot" });
    assert.equal(hash.mock.callCount(), 0);
  } finally { hash.mock.restore(); syncBuiltinESMExports(); }
});

test("[CON-05] fresh and repair never inherit the forward snapshot or evidence phases", () => {
  for (const operation of ["privacy-schema-3-fresh", "digest-key-repair-v3"]) {
    const observed = { ...publication("prepared"), operation, privateSource: "not-required" };
    if (operation === "digest-key-repair-v3") {
      observed.positions["summaries.json"] = "unchanged";
      observed.positions["journal-index.json"] = "unchanged";
    }
    assert.deepEqual(privacyPublicationStep(observed),
      { kind: "publish", target: operation === "privacy-schema-3-fresh" ? "summaries.json" : "digest.key" });
    for (const phase of ["snapshot", "migration-evidence-installed"] as const)
      assert.deepEqual(privacyPublicationStep({ ...observed, phase }), refused);
    assert.deepEqual(privacyPublicationStep({ ...observed, privateSource: "complete-exact" }), refused);
    const complete = { ...publication("marker", 63), operation, privateSource: "not-required" };
    if (operation === "digest-key-repair-v3") {
      complete.positions["summaries.json"] = "unchanged";
      complete.positions["journal-index.json"] = "unchanged";
    }
    assert.deepEqual(privacyPublicationStep(complete), { kind: "advance", phase: "remove" });
    assert.deepEqual(privacyPublicationStep({ ...complete, phase: "remove" }), { kind: "remove" });
    assert.deepEqual(privacyPublicationStep({ ...complete, evidence: "target" }), refused);
  }
});

test("[CON-03] forward evidence and recovery prefixes complete before exact transition removal", () => {
  const observed = publication("marker", 63);
  assert.deepEqual(privacyPublicationStep({ ...observed, evidence: "target" }), { kind: "publish-evidence", target: "evidence" });
  assert.deepEqual(privacyPublicationStep({ ...observed, evidence: "target-and-evidence" }),
    { kind: "advance", phase: "migration-evidence-installed" });
  const evidence = { ...observed, phase: "migration-evidence-installed", evidence: "target-and-evidence" };
  assert.deepEqual(privacyPublicationStep(evidence), { kind: "stage-recovery" });
  assert.deepEqual(privacyPublicationStep({ ...evidence, recovery: "temp" }), { kind: "publish-recovery" });
  assert.deepEqual(privacyPublicationStep({ ...evidence, recovery: "final" }), { kind: "advance", phase: "remove" });
  assert.deepEqual(privacyPublicationStep({ ...evidence, phase: "remove", recovery: "final" }), { kind: "remove" });
  assert.deepEqual(privacyPublicationStep({ ...evidence, phase: "remove", recovery: "temp" }), refused);
  assert.deepEqual(privacyPublicationStep({ ...observed, recovery: "final" }), refused);
});

test("[SEC-11] missing private equality, unrecorded temps and legacy source tuples never select a publication", () => {
  const observed = publication("snapshot");
  for (const value of [
    null, {}, { ...observed, extraTemps: true }, { ...observed, privateSource: "reserved" },
    { ...observed, privateSource: "mismatch" }, { ...observed, privateSource: "unknown" },
    { ...observed, source: { hash: "a".repeat(64), bytes: 20 } },
    { ...observed, positions: { ...observed.positions, state: "unknown" } },
    { ...observed, positions: { ...observed.positions, state: "unchanged" } },
    { ...observed, positions: { ...observed.positions, log: "before" } },
    { ...observed, evidence: "target" }, { ...observed, recovery: "temp" },
  ]) assert.deepEqual(privacyPublicationStep(value), refused);
});

function legacyReceipt() {
  const raw = "synthetic legacy failure body";
  return {
    id: raw, obligation: raw, kind: "test", stage: "candidate", source: "kernel-run", scope: "full",
    checkInputId: `sig:${"a".repeat(64)}`, candidate: "b".repeat(64), argv: [raw], cwd: raw,
    durationMs: 20, exit: 1, signal: raw, versions: { tool: raw, reporter: raw, adapter: raw },
    provenance: { runId: raw, runDir: raw, startedAt: raw }, status: "fail", qualifiers: [],
    counts: { discovered: 2, executed: 2, passed: 1, failed: 1, skipped: 0, focused: 0 },
    failures: [{ test: raw, kind: "assertion", message: raw }], failureKinds: ["assertion", raw],
    failureIds: [raw], startAbsent: [raw], limitations: [raw], analyzedFiles: [raw],
    history: [{ status: "fail", failed: [raw], at: "2026-11-19T00:00:00.000Z" }],
    reasons: ["evidence-failed", raw],
  };
}

test("[SEC-11] schema-3 legacy receipt projection retains closed history without hashing or copying unproven text", () => {
  const source = legacyReceipt(), before = structuredClone(source);
  const hash = mock.method(crypto, "createHash", () => assert.fail("legacy receipt text reached hashing"));
  syncBuiltinESMExports();
  try {
    const result = projectLegacyReceipt(source);
    assert.deepEqual(result, {
      kind: "test", stage: "candidate", source: "kernel-run", scope: "full", status: "fail",
      durationMs: 20, exit: 1, counts: source.counts, failures: [], failureKinds: ["assertion"],
      checkInputId: "legacy-unavailable", candidate: "legacy-unavailable",
      qualifiers: ["history-unavailable"], reasons: ["evidence-failed"],
      history: [{ status: "fail", at: "2026-11-19T00:00:00.000Z" }],
      privacy: { identity: "legacy-unproven", messages: "none" },
    });
    assert.equal(JSON.stringify(result).includes("synthetic legacy"), false);
    assert.equal(JSON.stringify(result).includes(source.checkInputId), false);
    assert.equal(LegacyReceiptV3.safeParse(result).success, true);
    assert.deepEqual(source, before);
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[CON-03] schema-3 legacy receipt projection rejects malformed accounting and undeclared target fields", () => {
  const unsupported = (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "unsupported-record";
  const source = legacyReceipt();
  for (const value of [
    { ...source, extra: true }, { ...source, counts: { ...source.counts, failed: -1 } },
    { ...source, durationMs: -1 }, { ...source, status: "synthetic arbitrary status" },
  ]) assert.throws(() => projectLegacyReceipt(value), unsupported);
  const projected = projectLegacyReceipt({
    ...source, kind: "synthetic arbitrary kind", history: [{ status: "pass", failed: [], at: "synthetic arbitrary date" }],
  });
  assert.equal(Object.hasOwn(projected, "kind"), false);
  assert.deepEqual(projected.history, [{ status: "pass" }]);
  assert.equal(LegacyReceiptV3.safeParse({ ...projected, limitations: ["synthetic legacy text"] }).success, false);
  assert.equal(LegacyReceiptV3.safeParse({ ...projected, privacy: { identity: "admitted-v1", messages: "none" } }).success, false);
});
