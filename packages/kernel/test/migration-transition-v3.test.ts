import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  privacyTransitionSchema, transitionHashes, admitPopulationPhase, PRIVACY_POPULATION,
  PrivacyMigrationTransitionV3, PrivateSnapshotRefV3,
} from "../src/core/migration-transition.ts";
import { DirectoryIdentity, MarkerV3 } from "../src/core/marker-identity.ts";
import type { PrivacyTransitionV3, PopulationObservation } from "../src/core/migration-transition.ts";
import { hashOf, sha256 } from "../src/core/ids.ts";
import { MAX_RECORD, parseUniqueRecord } from "../src/core/private-record.ts";

const Identity = z.strictObject({ owner: z.literal("synthetic-test-owner") });
const Marker = z.strictObject({ schema: z.literal(3), identity: Identity });
const schema = privacyTransitionSchema({ directoryIdentity: Identity, marker: Marker });
const operationId = "a".repeat(24);
const identity = (ino: string) => ({
  dev: "1", ino, type: "file" as const, links: 1 as const,
  objectGeneration: { version: 1 as const, domain: "store-object-generation-v1" as const, opaque: `gen-${ino}` },
});
const absent = (path: string) => ({
  presence: "absent" as const, path, identity: null, bytes: null, sha256: null, schema: null,
});
const present = (path: string, ino: string) => ({
  presence: "present" as const, path, identity: identity(ino), bytes: "1", sha256: hashOf(path), schema: 3 as const,
});
const privateSource = (path: string, ino: string) => ({
  presence: "present" as const, path, identity: identity(ino), schema: 2 as const, privateCopy: "required" as const,
});

function fresh(): PrivacyTransitionV3 {
  const targets = (["state.prev", "state", "marker", "summaries.json", "journal-index.json"] as const).map((path, index) => ({
    path, before: absent(path), after: present(path, String(index + 2)), tempPath: `${path}.tmp-${operationId}`,
  }));
  const before = absent("log");
  const privacy: PrivacyTransitionV3["privacy"] = {
    operation: "privacy-schema-3-fresh", beforeSchema: null, afterSchema: 3,
    populationVersion: 2, populationMembers: [...PRIVACY_POPULATION],
    populationHash: "", afterSnapshotHash: "",
    targets, journal: { path: "log", before, final: before },
    digestKeyId: "b".repeat(32),
    keyRecord: {
      path: "digest.key", before: { presence: "absent", identity: null, bytes: null },
      after: { presence: "present", identity: identity("8"), bytes: 84, magic: [84, 75, 49, 0], digestKeyId: "b".repeat(32) },
      tempPath: `digest.key.tmp-${operationId}`,
    },
  };
  Object.assign(privacy, transitionHashes(privacy));
  return {
    format: 3, protocol: "migration-transition-v3", protocolVersion: 2, operationId,
    kind: "fresh-init", phase: "prepared",
    root: { owner: "synthetic-test-owner" },
    marker: { schema: 3, identity: { owner: "synthetic-test-owner" } }, privacy,
  };
}
function observed(row: Pick<PrivacyTransitionV3, "privacy">, names: readonly string[]): PopulationObservation {
  return {
    targets: Object.fromEntries(row.privacy.targets.map(target => [
      target.path, names.includes(target.path) ? target.after : target.before,
    ])),
    key: names.includes("digest.key") ? row.privacy.keyRecord.after : row.privacy.keyRecord.before,
    journal: row.privacy.journal.before,
  };
}
function repair(): PrivacyTransitionV3 {
  const row = fresh();
  row.kind = "digest-key-repair";
  row.privacy.operation = "digest-key-repair-v3";
  row.privacy.beforeSchema = 3;
  row.privacy.targets.forEach((target, index) => {
    target.before = index < 3 ? present(target.path, String(index + 20)) : target.after;
  });
  const journal = present("log", "99");
  row.privacy.journal = { path: "log", before: journal, final: journal };
  Object.assign(row.privacy, transitionHashes(row.privacy));
  return row;
}
function forward(): PrivacyTransitionV3 {
  const row = fresh(), id = "c".repeat(32), dir = `migration-evidence-v2/${id}`;
  row.operationId = id;
  row.kind = "migration-forward";
  row.privacy.operation = "privacy-schema-3-migration";
  row.privacy.beforeSchema = 2;
  row.privacy.targets.forEach((target, index) => {
    target.before = index < 2 ? privateSource(target.path, String(index + 20))
      : index === 2 ? { ...present(target.path, "22"), schema: 2 } : absent(target.path);
    target.tempPath = `${target.path}.tmp-${id}`;
  });
  row.privacy.keyRecord.tempPath = `digest.key.tmp-${id}`;
  const journal = privateSource("log", "99");
  row.privacy.journal = { path: "log", before: journal, final: journal };
  const source = `${dir}/source.json`;
  row.snapshot = {
    sourceAttestationPath: source, sourceAttestationSha256: hashOf("source"),
    sourceAttestationProof: { ...present(source, "40"), sha256: hashOf("source") },
    privateSource: { provider: "store-private-snapshot-v1", handle: "synthetic-copy-set", copySetVersion: 1, capture: "reserved" },
  };
  row.evidence = {
    target: { path: `${dir}/target.json`, sha256: hashOf("target"), proof: null },
    evidence: { path: `${dir}/evidence.json`, sha256: hashOf("evidence"), proof: null },
    recovery: {
      path: "migration-recovery-v3.json", sha256: hashOf("recovery"), proof: null,
      tempPath: `migration-recovery-v3.json.tmp-${id}`,
    },
    previousBridgeDigest: hashOf("bridge"),
  };
  Object.assign(row.privacy, transitionHashes(row.privacy));
  return row;
}
function captured(phase: PrivacyTransitionV3["phase"]): PrivacyTransitionV3 {
  const row = forward();
  row.phase = phase;
  row.snapshot!.privateSource.capture = "complete";
  return row;
}
function evidenceProof(row: PrivacyTransitionV3, name: "target" | "evidence" | "recovery") {
  const file = row.evidence![name];
  file.proof = { ...present(file.path, name === "target" ? "41" : name === "evidence" ? "42" : "43"), sha256: file.sha256 };
}

describe("signed protocol/population-2 MigrationTransitionV3 privacy wire", () => {
  it("matches both signed path-free canonical hash vectors [AC-19] CT-33", () => {
    const p = forward().privacy;
    p.digestKeyId = p.keyRecord.after.digestKeyId = "0123456789abcdef0123456789abcdef";
    p.keyRecord.after.identity = identity("2");
    p.targets.forEach((target, index) => {
      target.after = {
        ...present(target.path, String(index + 3)), bytes: String(index + 11),
        sha256: "abcde"[index]!.repeat(64),
      };
    });
    const expected = {
      afterSnapshotHash: "7b927d11002e75c6c42137e566bbdf9f96716103af5156ade200d5a5e24703d1",
      populationHash: "2b2359962b9a1e948872d8a74baf67ff8e1b58ec44556ef0f337035a855999e0",
    };
    assert.deepEqual(transitionHashes(p), expected);
    const reorder = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(reorder);
      if (value === null || typeof value !== "object") return value;
      return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)]));
    };
    assert.deepEqual(transitionHashes(reorder(p) as typeof p), expected);
    const populationJson = `{"afterSnapshotHash":"${expected.afterSnapshotHash}","canonicalVersion":1,"members":["digest.key","state.prev","state","marker","summaries.json","journal-index.json"],"populationVersion":2,"protocolVersion":2}`;
    assert.equal(sha256(`tenet:migration-transition-v3:population:v2\0${populationJson}`), expected.populationHash);
    assert.notEqual(sha256(`tenet:migration-transition-v3:population:v1\0${populationJson}`), expected.populationHash);
    assert.notEqual(transitionHashes({ ...p, populationMembers: [...p.populationMembers].reverse() as typeof p.populationMembers }).populationHash, expected.populationHash);
    assert.notEqual(transitionHashes({ ...p, targets: [...p.targets].reverse() }).afterSnapshotHash, expected.afterSnapshotHash);
    assert.notEqual(transitionHashes({ ...p, operation: "privacy-schema-3-fresh" }).afterSnapshotHash, expected.afterSnapshotHash);
  });

  it("uses UTF8 canonical escaping and safe integers rather than the generic hash domain [AC-19] CT-33", () => {
    const p = fresh().privacy;
    const opaque = 'é😀"\\\b\t\n\f\r\u0000\u0001\u001f';
    p.keyRecord.after.identity.objectGeneration.opaque = opaque;
    const clean = {
      operation: p.operation, protocolVersion: 2, populationVersion: 2,
      key: { after: p.keyRecord.after },
      targets: p.targets.map(target => {
        const { path: _path, ...after } = target.after;
        return { after };
      }),
    };
    const asciiKeys = (value: unknown): string => {
      if (value === null || typeof value !== "object") return JSON.stringify(value);
      if (Array.isArray(value)) return `[${value.map(asciiKeys).join(",")}]`;
      return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b, "en")).map(([key, entry]) => `${JSON.stringify(key)}:${asciiKeys(entry)}`).join(",")}}`;
    };
    assert.equal(transitionHashes(p).afterSnapshotHash,
      sha256(`tenet:migration-transition-v3:after-snapshot:v2\0${asciiKeys(clean)}`));
    assert.notEqual(transitionHashes(p).afterSnapshotHash, hashOf(clean));
    for (const invalid of [NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1, -0]) {
      const damaged = structuredClone(p);
      damaged.keyRecord.after.bytes = invalid as 84;
      assert.throws(() => transitionHashes(damaged));
    }
  });

  it("never reads before tuples, journal, paths, temps or private snapshot data while hashing [SEC-11] CT-33", () => {
    const p = forward().privacy, expected = transitionHashes(p);
    Object.defineProperty(p.journal, "before", { get() { throw new Error("private journal read"); } });
    Object.defineProperty(p.keyRecord, "before", { get() { throw new Error("before read"); } });
    for (const target of p.targets) {
      Object.defineProperty(target, "before", { get() { throw new Error("private source read"); } });
      target.path = "other" as typeof target.path;
      target.after.path = "other";
      target.tempPath = "other";
    }
    p.keyRecord.path = "other" as "digest.key";
    assert.deepEqual(transitionHashes(p), expected);
    assert.equal(Object.hasOwn(expected, "beforeSnapshotHash"), false);
  });

  it("admits the published marker interfaces without activation or host authentication [AC-19] CT-33", () => {
    const root = DirectoryIdentity.parse({
      kind: "directory-v1", platform: "linux", architecture: "x64", filesystem: "ext4", dev: "1", ino: "2", birthNs: "3",
    });
    const marker = MarkerV3.parse({
      schema: 3, workspaceId: "ws_aaaaaaaaaa", tag: "aaaa", nonce: "a".repeat(12), dev: 1, ino: 2, identity: root,
      binding: { kind: "none", reason: "host-storage-verified-absent", capability: hashOf("synthetic-capability") },
    });
    const row = { ...fresh(), root, marker };
    assert.equal(PrivacyMigrationTransitionV3.safeParse(row).success, true);
    for (const damaged of [
      fresh(), { ...row, root: { ...root, extra: true } },
      { ...row, marker: { ...marker, schema: 2 } },
      { ...row, marker: { ...marker, binding: { kind: "none" } } },
    ]) assert.equal(PrivacyMigrationTransitionV3.safeParse(damaged).success, false);
    assert.equal(PrivacyMigrationTransitionV3.safeParse({
      ...row, marker: { ...marker, binding: { kind: "host-key-v1", keyId: "c".repeat(24), authenticator: hashOf("synthetic-authenticator") } },
    }).success, true);
  });

  it("preserves and refuses v1, missing v2 fields, string magic and all old source fingerprints [SEC-11] CT-33", () => {
    const row = fresh(), before = JSON.stringify(row);
    for (const damaged of [
      { ...row, protocolVersion: 1 }, { ...row, protocolVersion: undefined },
      { ...row, privacy: { ...row.privacy, populationVersion: 1 } },
      { ...row, privacy: { ...row.privacy, populationVersion: undefined } },
      { ...row, source: { marker: null, state: null } },
      { ...row, privacy: { ...row.privacy, beforeSnapshotHash: hashOf("legacy") } },
      { ...row, privacy: { ...row.privacy, keyRecord: { ...row.privacy.keyRecord, after: { ...row.privacy.keyRecord.after, magic: "TK1\\0" } } } },
      { ...row, privacy: { ...row.privacy, afterSnapshotHash: hashOf(row.privacy.targets) } },
      { ...row, kind: "quarantine" }, { ...row, kind: "migration-rollback" }, { ...row, recovery: {} },
    ]) assert.equal(schema.safeParse(damaged).success, false);
    assert.equal(JSON.stringify(row), before);
    assert.throws(() => parseUniqueRecord('{"protocolVersion":2,"protocolVersion":1}'));
  });

  it("validates fixed ordered paths separately from hashes and exact key proof [AC-19] CT-33", () => {
    const row = fresh();
    assert.equal(schema.safeParse(row).success, true);
    for (const mutate of [
      (r: PrivacyTransitionV3) => { r.privacy.populationMembers.reverse(); },
      (r: PrivacyTransitionV3) => { r.privacy.targets.reverse(); },
      (r: PrivacyTransitionV3) => { r.privacy.targets[0]!.after.path = "state"; },
      (r: PrivacyTransitionV3) => { r.privacy.targets[0]!.before.path = "state"; },
      (r: PrivacyTransitionV3) => { r.privacy.targets[0]!.tempPath = "outside"; },
      (r: PrivacyTransitionV3) => { r.privacy.keyRecord.path = "state" as "digest.key"; },
      (r: PrivacyTransitionV3) => { r.privacy.keyRecord.tempPath = "outside"; },
      (r: PrivacyTransitionV3) => { r.privacy.keyRecord.after.digestKeyId = "c".repeat(32); },
    ]) {
      const damaged = structuredClone(row);
      mutate(damaged);
      assert.equal(schema.safeParse(damaged).success, false);
    }
    const invalidMagic: Record<string, unknown> = structuredClone(row);
    invalidMagic.privacy = {
      ...row.privacy, keyRecord: {
        ...row.privacy.keyRecord, after: { ...row.privacy.keyRecord.after, magic: [84, 75, 49, 1] },
      },
    };
    assert.equal(schema.safeParse(invalidMagic).success, false);
  });

  it("requires provider-private state/previous/log sources and refuses byte/hash/count extras [SEC-11] CT-29 CT-33", () => {
    const row = forward();
    assert.equal(schema.safeParse(row).success, true);
    for (const path of ["state.prev", "state", "log"]) {
      const damaged = structuredClone(row);
      if (path === "log") damaged.privacy.journal.before = damaged.privacy.journal.final = { ...present(path, "99"), schema: 2 };
      else damaged.privacy.targets.find(target => target.path === path)!.before = { ...present(path, "20"), schema: 2 };
      assert.equal(schema.safeParse(damaged).success, false);
    }
    for (const extra of [{ bytes: "4" }, { sha256: hashOf("legacy") }, { raw: "synthetic-private-bytes" }, { privateCopy: "absent" }]) {
      const damaged = structuredClone(row);
      Object.assign(damaged.privacy.targets[0]!.before, extra);
      assert.equal(schema.safeParse(damaged).success, false);
    }
    const privateMetadata = structuredClone(row);
    privateMetadata.privacy.targets[2]!.before = privateSource("marker", "22");
    privateMetadata.privacy.targets[3]!.before = {
      presence: "absent", path: "summaries.json", identity: null, schema: null, privateCopy: "absent",
    };
    assert.equal(schema.safeParse(privateMetadata).success, true);
    assert.equal(schema.safeParse({ ...row, source: { marker: null, state: hashOf("legacy") } }).success, false);
  });

  it("refuses untrusted observations before serializing any private bytes [SEC-11] CT-33", () => {
    const row = schema.parse(forward());
    for (const source of ["journal", "state.prev", "state"] as const) {
      const observation = structuredClone(observed(row, []));
      const tuple = source === "journal" ? observation.journal : observation.targets[source]!;
      Object.defineProperty(tuple, "raw", {
        enumerable: true, get() { throw new Error("private bytes must not be inspected or serialized"); },
      });
      assert.equal(admitPopulationPhase(row, observation), false);
    }
  });

  it("requires stable object generations including UTF8 bounds [AC-19] CT-33 CT-36", () => {
    const row = fresh();
    for (const generation of [undefined, {}, { version: 2, domain: "store-object-generation-v1", opaque: "gen" },
      { version: 1, domain: "other", opaque: "gen" },
      { version: 1, domain: "store-object-generation-v1", opaque: "" },
      { version: 1, domain: "store-object-generation-v1", opaque: "é".repeat(513) }]) {
      const damaged = structuredClone(row);
      Object.assign(damaged.privacy.keyRecord.after.identity, { objectGeneration: generation });
      assert.equal(schema.safeParse(damaged).success, false);
    }
    row.privacy.keyRecord.after.identity.objectGeneration.opaque = "é".repeat(512);
    Object.assign(row.privacy, transitionHashes(row.privacy));
    assert.equal(schema.safeParse(row).success, true);
    const admitted = schema.parse(row), observation = observed(row, []);
    const before = observation.key;
    assert.equal(before.presence, "absent");
    const after = row.privacy.targets[3]!.after;
    if (after.presence !== "present") throw new Error("fixture requires a present after-image");
    observation.targets["summaries.json"] = {
      ...after, identity: { ...identity("5"), objectGeneration: { ...identity("5").objectGeneration, opaque: "replacement" } },
    };
    assert.equal(admitPopulationPhase(admitted, observation), false);
  });

  it("bounds opaque handles only by the shared private-record ceiling and preserves exact bytes [SEC-11] CT-33", () => {
    const ref = forward().snapshot!.privateSource;
    for (const handle of ["é".repeat(1024), "  e\u0301/opaque\\%2f\u0000  "]) {
      assert.equal(PrivateSnapshotRefV3.parse({ ...ref, handle }).handle, handle);
      const row = forward(), hashes = transitionHashes(row.privacy);
      row.snapshot!.privateSource.handle = handle;
      assert.equal(schema.safeParse(row).success, true);
      assert.deepEqual(transitionHashes(row.privacy), hashes);
    }
    const boundary = "é".repeat(MAX_RECORD / 2);
    assert.equal(PrivateSnapshotRefV3.safeParse({ ...ref, handle: boundary }).success, true);
    assert.equal(PrivateSnapshotRefV3.safeParse({ ...ref, handle: `${boundary}a` }).success, false);
    assert.equal(PrivateSnapshotRefV3.safeParse({ ...ref, handle: "" }).success, false);
  });

  it("requires reserved prepared and complete later capture plus exact attestation/evidence bindings [AC-19] CT-29 CT-33", () => {
    const row = forward();
    assert.equal(schema.safeParse(row).success, true);
    assert.equal(schema.safeParse(captured("snapshot")).success, true);
    for (const damaged of [
      { ...row, phase: "snapshot" }, captured("prepared"), { ...row, snapshot: undefined },
      { ...row, evidence: undefined }, { ...row, operationId: "d".repeat(32) },
      { ...row, snapshot: { ...row.snapshot, sourceManifestPath: "legacy" } },
      { ...row, snapshot: { ...row.snapshot, privateSource: { ...row.snapshot!.privateSource, provider: "other" } } },
      { ...row, snapshot: { ...row.snapshot, privateSource: { ...row.snapshot!.privateSource, handle: "" } } },
      { ...row, snapshot: { ...row.snapshot, privateSource: { ...row.snapshot!.privateSource, copySetVersion: 2 } } },
      { ...row, snapshot: { ...row.snapshot, sourceAttestationProof: present(row.snapshot!.sourceAttestationPath, "40") } },
    ]) assert.equal(schema.safeParse(damaged).success, false);
  });

  it("admits only ordered evidence prefixes and final recovery at remove [AC-19] CT-33", () => {
    for (const phase of ["snapshot", "key", "previous", "state"] as const) {
      const row = captured(phase);
      evidenceProof(row, "target");
      assert.equal(schema.safeParse(row).success, false);
    }
    const marker = captured("marker");
    assert.equal(schema.safeParse(marker).success, true);
    evidenceProof(marker, "evidence");
    assert.equal(schema.safeParse(marker).success, false);
    evidenceProof(marker, "target");
    assert.equal(schema.safeParse(marker).success, true);
    evidenceProof(marker, "recovery");
    assert.equal(schema.safeParse(marker).success, false);
    marker.phase = "migration-evidence-installed";
    assert.equal(schema.safeParse(marker).success, true);
    marker.phase = "remove";
    assert.equal(schema.safeParse(marker).success, true);
    marker.evidence!.recovery.proof = null;
    assert.equal(schema.safeParse(marker).success, false);
    marker.phase = "migration-evidence-installed";
    assert.equal(schema.safeParse(marker).success, true);
    marker.evidence!.target.proof = null;
    assert.equal(schema.safeParse(marker).success, false);
  });

  it("admits fresh and snapshot summary/index/key prefixes but no forward prepared publication [AC-19] CT-29", () => {
    const prefix = ["summaries.json", "journal-index.json", "digest.key"];
    for (const row of [fresh(), captured("snapshot")]) {
      const admitted = schema.parse(row);
      for (let count = 0; count <= 3; count++) {
        assert.equal(admitPopulationPhase(admitted, observed(row, prefix.slice(0, count))), true);
      }
      for (const names of [["digest.key"], ["journal-index.json"], ["summaries.json", "digest.key"], [...prefix, "state.prev"]]) {
        assert.equal(admitPopulationPhase(admitted, observed(row, names)), false);
      }
    }
    const row = forward(), prepared = schema.parse(row);
    assert.equal(admitPopulationPhase(prepared, observed(row, [])), true);
    assert.equal(admitPopulationPhase(prepared, observed(row, ["summaries.json"])), false);
  });

  it("does not infer later phases or accept same inode with another object generation [AC-19] CT-33 CT-36", () => {
    const base = ["summaries.json", "journal-index.json", "digest.key"], order = ["state.prev", "state", "marker"];
    for (const source of [fresh(), captured("snapshot"), repair()]) {
      const storage = source.kind === "digest-key-repair" ? ["digest.key"] : base;
      for (const [phase, count] of [["key", 0], ["previous", 1], ["state", 2], ["marker", 3], ["remove", 3]] as const) {
        const row = structuredClone(source);
        row.phase = phase;
        if (row.kind === "migration-forward" && phase === "remove") {
          evidenceProof(row, "target"); evidenceProof(row, "evidence"); evidenceProof(row, "recovery");
        }
        const admitted = schema.parse(row), names = [...storage, ...order.slice(0, count)];
        assert.equal(admitPopulationPhase(admitted, observed(row, names)), true);
        if (count < 3) {
          assert.equal(admitPopulationPhase(admitted, observed(row, [...storage, ...order.slice(0, count + 1)])), true);
          assert.equal(admitPopulationPhase(admitted, observed(row, [...storage, ...order.slice(0, count + 2)])), count === 2);
        }
        const changed = observed(row, names), tuple = changed.targets["state.prev"]!;
        if (tuple.presence === "present") {
          changed.targets["state.prev"] = {
            ...tuple, identity: { ...tuple.identity, objectGeneration: { ...tuple.identity.objectGeneration, opaque: "replaced" } },
          };
          assert.equal(admitPopulationPhase(admitted, changed), false);
        }
        changed.targets.extra = absent("extra");
        assert.equal(admitPopulationPhase(admitted, changed), false);
      }
    }
  });

  it("refuses cross-arm fields, missing existing sources and changed repair witnesses [AC-19] CT-36 CT-48", () => {
    const row = repair(), admitted = schema.parse(row);
    assert.equal(admitPopulationPhase(admitted, observed(row, [])), true);
    assert.equal(admitPopulationPhase(admitted, observed(row, ["digest.key"])), true);
    assert.equal(admitPopulationPhase(admitted, observed(row, ["digest.key", "state.prev"])), false);
    for (const path of ["summaries.json", "journal-index.json"]) {
      const damaged = repair();
      damaged.privacy.targets.find(target => target.path === path)!.after = present(path, "999");
      Object.assign(damaged.privacy, transitionHashes(damaged.privacy));
      assert.equal(schema.safeParse(damaged).success, false);
    }
    for (const path of ["state.prev", "state", "marker", "summaries.json", "journal-index.json"]) {
      const damaged = repair();
      damaged.privacy.targets.find(target => target.path === path)!.before = {
        ...privateSource(path, "20"), schema: 3,
      };
      assert.equal(schema.safeParse(damaged).success, false);
    }
    for (const source of [forward(), repair()]) {
      source.privacy.journal.before = source.privacy.journal.final = absent("log");
      assert.equal(schema.safeParse(source).success, false);
    }
    for (const source of [fresh(), repair()]) {
      for (const phase of ["snapshot", "migration-evidence-installed", "state-published", "rollback-prepared"]) {
        assert.equal(schema.safeParse({ ...source, phase }).success, false);
      }
      assert.equal(schema.safeParse({ ...source, snapshot: forward().snapshot }).success, false);
      assert.equal(schema.safeParse({ ...source, evidence: forward().evidence }).success, false);
      assert.equal(schema.safeParse({ ...source, kind: "migration-forward" }).success, false);
    }
    const damaged = fresh();
    damaged.privacy.journal.before = damaged.privacy.journal.final = present("log", "99");
    assert.equal(schema.safeParse(damaged).success, false);
  });
});
