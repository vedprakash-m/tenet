import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, unlinkSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmp, cleanup } from "./helpers.ts";
import { sha256 } from "../src/core/ids.ts";
import { migrationSnapshotIdentity } from "../src/core/migration-identity.ts";
import { preparePrivacySnapshot } from "../src/adapters/privacy-snapshot-writer.ts";
import { attestationDirectory, publishAttestation, publishSnapshotTransition } from "../src/adapters/privacy-snapshot-records.ts";
import { ProviderSnapshotAttestationV3 } from "../src/core/schemas-migrate.ts";
import { parseUniqueRecord } from "../src/adapters/private-record-fs.ts";
import { KernelError } from "../src/core/errors.ts";
import { mock } from "node:test";
import type { PrivateSnapshots } from "../src/ports/private-snapshot.ts";
import type { PrivateSnapshotRequestV1, PrivateSnapshotRefV3 } from "../src/core/schemas-migrate.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const operationId = "a".repeat(32);
function fileIdentity(path: string) {
  const stat = lstatSync(path, { bigint: true });
  return { dev: String(stat.dev), ino: String(stat.ino), type: "file" as const, links: 1 as const };
}
function fixture() {
  const root = tmp(); roots.push(root);
  const dir = join(root, ".tenet"); mkdirSync(dir);
  const marker = { schema: 2 as const, workspaceId: "ws_aaaaaaaaaa", tag: "abcd", nonce: "aaaaaaaaaaaa", dev: 1, ino: 2 };
  for (const [name, body] of Object.entries({
    marker: JSON.stringify(marker), state: "synthetic private source primary",
    "state.prev": "synthetic private source previous", log: "synthetic private journal",
  })) writeFileSync(join(dir, name), body);
  const stat = lstatSync(dir, { bigint: true });
  const identity = {
    kind: "directory-v1" as const, platform: process.platform as "win32" | "linux" | "darwin",
    architecture: process.arch as "arm64" | "x64", filesystem: "qualified-test-fs",
    dev: String(stat.dev), ino: String(stat.ino), birthNs: String(stat.birthtimeNs),
  };
  const witness = {
    witnessVersion: 1 as const, protocol: "p91-completion-v1" as const, sourceSchema: 2 as const, storeRoot: identity,
    marker: { workspaceId: marker.workspaceId, tag: marker.tag, nonce: marker.nonce },
    state: {
      primary: { identity: fileIdentity(join(dir, "state")), revision: 7 },
      previous: { identity: fileIdentity(join(dir, "state.prev")), revision: 6 }, generationSeq: 1, workSeq: 2,
    },
    fences: { history: "complete" as const, reconstructionPending: false as const,
      p91Transition: "absent" as const, p91Recovery: "absent" as const }, bridgeDigest: "f".repeat(64),
  };
  const request: PrivateSnapshotRequestV1 = { operationId, storeRoot: identity, p91Completion: witness, copySetVersion: 1 };
  const targets = ["state.prev", "state", "marker", "summaries.json", "journal-index.json"].map(path => {
    const tempPath = `${path}.tmp-${operationId}`, bytes = JSON.stringify({ schema: 3, role: path });
    writeFileSync(join(dir, tempPath), bytes);
    const fd = openSync(join(dir, tempPath), "r+"); try { fsyncSync(fd); } finally { closeSync(fd); }
    return {
      path, tempPath,
      before: existsSync(join(dir, path)) ? {
        presence: "present", path, identity: fileIdentity(join(dir, path)), schema: 2, privateCopy: "required",
      } : { presence: "absent", path, identity: null, schema: null, privateCopy: "absent" },
      after: { path, presence: "present", identity: fileIdentity(join(dir, tempPath)),
        bytes: String(Buffer.byteLength(bytes)), sha256: sha256(bytes), schema: 3 },
    };
  });
  const key = Buffer.alloc(84); key.write("TK1\0"); key.write("b".repeat(32), 4);
  const keyTemp = `digest.key.tmp-${operationId}`; writeFileSync(join(dir, keyTemp), key);
  const keyAfter = {
    presence: "present" as const, identity: fileIdentity(join(dir, keyTemp)), bytes: 84 as const,
    magic: "TK1\0" as const, digestKeyId: "b".repeat(32),
  };
  const hashes = migrationSnapshotIdentity({
    operation: "privacy-schema-3-migration", populationVersion: 2,
    key: { path: "digest.key", after: keyAfter },
    targets: targets.map(target => { const { path, ...after } = target.after; return { path, after }; }),
  });
  const journal = {
    presence: "present", path: "log", identity: fileIdentity(join(dir, "log")), schema: null, privateCopy: "required",
  };
  const draft = {
    format: 3, protocol: "migration-transition-v3", protocolVersion: 2, operationId, kind: "migration-forward",
    phase: "prepared", root: identity, marker,
    privacy: {
      operation: "privacy-schema-3-migration", beforeSchema: 2, afterSchema: 3, populationVersion: 2,
      populationMembers: ["digest.key", "state.prev", "state", "marker", "summaries.json", "journal-index.json"],
      populationHash: hashes.populationHash, afterSnapshotHash: hashes.afterSnapshotHash, targets,
      journal: { path: "log", before: journal, final: journal }, digestKeyId: keyAfter.digestKeyId,
      keyRecord: { path: "digest.key", before: { presence: "absent", identity: null, bytes: null },
        after: keyAfter, tempPath: keyTemp },
    },
    evidence: {
      target: { path: `migration-evidence-v2/${operationId}/target.json`, sha256: "c".repeat(64), proof: null },
      evidence: { path: `migration-evidence-v2/${operationId}/evidence.json`, sha256: "d".repeat(64), proof: null },
      recovery: { path: "migration-recovery-v3.json", tempPath: `migration-recovery-v3.json.tmp-${operationId}`,
        sha256: "e".repeat(64), proof: null }, previousBridgeDigest: witness.bridgeDigest,
    },
  };
  const snapshot: PrivateSnapshotRefV3 = {
    provider: "store-private-snapshot-v1", handle: "opaque fixture token", copySetVersion: 1, capture: "reserved",
  };
  let captures = 0;
  const provider: PrivateSnapshots = {
    reserve: () => snapshot,
    capture: () => { captures++; return { ...snapshot, capture: "complete" }; },
    compare: () => "exact", orphan: () => ({ kind: "none" }),
  };
  const synced: string[] = [];
  const gate = {
    authorize: () => {}, admitTargets: () => {},
    // Windows does not qualify directory fsync. Its branch is an explicit protocol-order test seam.
    syncDirectory: (path: string) => {
      synced.push(path);
      if (process.platform !== "win32") {
        const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); }
      }
    },
  };
  return { root, dir, request, draft, snapshot, provider, gate, captures: () => captures, synced };
}

test("[CON-03] [SEC-11] durable snapshot preparation captures one opaque handle and publishes no target", () => {
  const f = fixture(), source = ["state", "state.prev", "marker", "log"].map(name => readFileSync(join(f.dir, name)));
  const result = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  assert.equal(result.phase, "snapshot");
  assert.equal(result.snapshot.privateSource.capture, "complete");
  assert.equal(f.captures(), 1);
  assert.deepEqual(["state", "state.prev", "marker", "log"].map(name => readFileSync(join(f.dir, name))), source);
  assert.equal(existsSync(join(f.dir, "digest.key")), false);
  assert.equal(existsSync(join(f.dir, "migration-recovery-v3.json")), false);
  const attestation = JSON.parse(readFileSync(join(f.dir, result.snapshot.sourceAttestationPath), "utf8"));
  assert.equal(attestation.snapshot.capture, "reserved");
  assert.deepEqual(attestation.p91Completion, f.request.p91Completion);
  assert.equal(JSON.stringify(result).includes("synthetic private"), false);
  assert.ok(f.synced.includes(f.dir));
  assert.equal(readdirSync(f.dir).some(name => name.startsWith("migration-transition.json.tmp-")), false);
});

test("[CON-03] copy-time capacity refusal retains prepared and resumes only the same handle", () => {
  const f = fixture(); f.provider.capture = () => { throw new KernelError("storage-reserve-full", "fixture capacity"); };
  assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate), KernelError);
  const before = JSON.parse(readFileSync(join(f.dir, "migration-transition.json"), "utf8"));
  assert.equal(before.phase, "prepared");
  assert.equal(before.snapshot.privateSource.handle, f.snapshot.handle);
  f.provider.capture = (_request, snapshot) => ({ ...snapshot, capture: "complete" });
  const first = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  const second = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  assert.deepEqual(first, second);
  assert.equal(first.snapshot.privateSource.handle, before.snapshot.privateSource.handle);
});

test("[SEC-11] malformed or unapproved preparation creates no reservation, attestation or transition", () => {
  const f = fixture(); f.provider.reserve = () => assert.fail("invalid preparation reserved storage");
  for (const draft of [{ ...f.draft, source: { state: "a".repeat(64) } }, { ...f.draft, phase: "key" }])
    assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, draft, f.gate), KernelError);
  assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, f.draft,
    { ...f.gate, authorize: () => { throw new KernelError("capability-missing", "fixture"); } }), KernelError);
  assert.equal(existsSync(join(f.dir, "migration-transition.json")), false);
  assert.equal(existsSync(join(f.dir, "migration-evidence-v2")), false);
});

test("[CON-03] a missing attestation under a retained transition is refused rather than recreated", () => {
  const f = fixture(), result = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  const path = join(f.dir, result.snapshot.sourceAttestationPath), before = readFileSync(join(f.dir, "migration-transition.json"));
  unlinkSync(path);
  assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate), KernelError);
  assert.equal(existsSync(path), false);
  assert.deepEqual(readFileSync(join(f.dir, "migration-transition.json")), before);
});

test("[SEC-11] an unadmitted attestation body is refused without serializing the substituted legacy text", () => {
  const f = fixture(), result = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  writeFileSync(join(f.dir, result.snapshot.sourceAttestationPath), '{"schema":2,"body":"private legacy substitution"}');
  let legacySerializations = 0;
  const original = JSON.stringify.bind(JSON);
  const stringify = mock.method(JSON, "stringify", (...args: Parameters<typeof JSON.stringify>) => {
    const text = original(...args);
    if (text?.includes("private legacy substitution")) legacySerializations++;
    return text;
  });

  try {
    assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate), KernelError);
    assert.equal(legacySerializations, 0);
  } finally { stringify.mock.restore(); }
});

test("[CON-05] unknown publication temps and false before identities refuse before provider reserve", () => {
  const f = fixture(); let reservations = 0;
  f.provider.reserve = () => { reservations++; return f.snapshot; };
  const wrong = {
    ...f.draft, privacy: { ...f.draft.privacy, targets: f.draft.privacy.targets.map((target, i) =>
      i === 2 ? { ...target, before: { ...target.before, identity: { dev: "1", ino: "2", type: "file", links: 1 } } } : target) },
  };
  assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, wrong, f.gate), KernelError);
  writeFileSync(join(f.dir, `state.tmp-${"c".repeat(32)}`), "unknown temp");
  assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate), KernelError);
  assert.equal(reservations, 0);
  assert.equal(existsSync(join(f.dir, "migration-transition.json")), false);
});

test("[CON-03] directory creation replay repeats interrupted parent-entry syncs", () => {
  const f = fixture();
  assert.throws(() => attestationDirectory(f.dir, operationId, () => { throw new Error("fixture interrupted sync"); }));
  const synced: string[] = [];
  attestationDirectory(f.dir, operationId, path => synced.push(path));
  assert.deepEqual(synced, [f.dir, join(f.dir, "migration-evidence-v2")]);
});

test("[CON-03] attestation replay syncs the admitted file after an interrupted file sync", () => {
  const f = fixture(), source = join(f.dir, "migration-evidence-v2", operationId, "source.json");
  const original = fs.fsyncSync.bind(fs);
  const failed = mock.method(fs, "fsyncSync", (fd: number) => {
    const stat = lstatSync(source, { bigint: true, throwIfNoEntry: false });
    if (stat && fs.fstatSync(fd, { bigint: true }).ino === stat.ino) throw new Error("fixture interrupted file sync");
    original(fd);
  });
  syncBuiltinESMExports();
  try { assert.throws(() => preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate)); }
  finally { failed.mock.restore(); syncBuiltinESMExports(); }
  assert.equal(existsSync(source), true);
  const identity = lstatSync(source, { bigint: true }); let sourceSyncs = 0;
  const replay = mock.method(fs, "fsyncSync", (fd: number) => {
    if (fs.fstatSync(fd, { bigint: true }).ino === identity.ino) sourceSyncs++;
    original(fd);
  });
  syncBuiltinESMExports();
  try {
    preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
    assert.ok(sourceSyncs > 0);
  } finally { replay.mock.restore(); syncBuiltinESMExports(); }
});

test("[CON-03] an exact retained transition temp is synced again before publication", () => {
  const f = fixture(), result = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  const temp = join(f.dir, `migration-transition.json.tmp-${operationId}`); writeFileSync(temp, JSON.stringify(result));
  const identity = lstatSync(temp, { bigint: true }), original = fs.fsyncSync.bind(fs); let tempSyncs = 0;
  const replay = mock.method(fs, "fsyncSync", (fd: number) => {
    if (fs.fstatSync(fd, { bigint: true }).ino === identity.ino) tempSyncs++;
    original(fd);
  });
  syncBuiltinESMExports();
  try {
    publishSnapshotTransition(f.dir, result, f.gate.syncDirectory);
    assert.ok(tempSyncs > 0);
  } finally { replay.mock.restore(); syncBuiltinESMExports(); }
});

test("[SEC-11] the final attestation proof never hashes substituted unadmitted bytes", () => {
  const f = fixture(), result = preparePrivacySnapshot(f.root, f.request, f.provider, f.draft, f.gate);
  const source = join(f.dir, result.snapshot.sourceAttestationPath);
  const expected = ProviderSnapshotAttestationV3.parse(JSON.parse(readFileSync(source, "utf8")));
  const original = fs.openSync.bind(fs); let reads = 0;
  const raced = mock.method(fs, "openSync", (...args: Parameters<typeof fs.openSync>) => {
    if (args[0] === source && ++reads === 3)
      writeFileSync(source, '{"schema":2,"body":"private legacy proof sentinel"}');
    return original(...args);
  });
  const hash = mock.method(crypto, "createHash", () => assert.fail("unadmitted proof bytes reached hashing"));
  syncBuiltinESMExports();
  try {
    assert.throws(() => publishAttestation(source, expected, f.gate.syncDirectory), KernelError);
    assert.equal(hash.mock.callCount(), 0);
  } finally { raced.mock.restore(); hash.mock.restore(); syncBuiltinESMExports(); }
});

test("[SEC-11] private record admission never serializes legacy text and still rejects duplicate keys", () => {
  const stringify = mock.method(JSON, "stringify", () => assert.fail("private reader serialized a legacy body"));
  try {
    assert.deepEqual(parseUniqueRecord('{"body":"private legacy reader sentinel"}'), { body: "private legacy reader sentinel" });
    assert.throws(() => parseUniqueRecord('{"body":"first","body":"second"}'), KernelError);
    assert.equal(stringify.mock.callCount(), 0);
  } finally { stringify.mock.restore(); }
});
