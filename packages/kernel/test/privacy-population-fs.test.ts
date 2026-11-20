import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { StorageV3Files } from "../src/adapters/storage-v3-write.ts";
import { DigestKeyFiles } from "../src/adapters/digest-key-fs.ts";
import { PrivacyPopulationWriter } from "../src/adapters/privacy-population-fs.ts";
import { PrivacyMigrationTransitionV3, transitionHashes, type PrivacyTransitionV3 } from "../src/core/migration-transition.ts";
import { sha256, stableStringify } from "../src/core/ids.ts";
import { KernelError } from "../src/core/errors.ts";
import { FileTupleV3 } from "../src/core/migration-transition.ts";
import type { z } from "zod";
import { supplementalGeneration, supplementalMove } from "./fixtures/supplemental-move.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const operationId = "a".repeat(24);
function fixture(repair = false) {
  const root = mkdtempSync(join(tmpdir(), "tenet-privacy-population-")); roots.push(root);
  const files = new StorageV3Files(root, {
    objectGeneration: supplementalGeneration,
    renameNoReplace: supplementalMove,
    assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
  });
  const keys = new DigestKeyFiles(root, {
    objectGeneration: supplementalGeneration,
    assertOwned: () => {}, syncDirectory: () => files.sync(), renameNoReplace: supplementalMove,
  });
  const keyRecord = keys.stage(operationId, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
  const directoryIdentity = {
    kind: "directory-v1", platform: "linux", architecture: "x64", filesystem: "ext4", dev: "1", ino: "2", birthNs: "3",
  };
  const marker = {
    schema: 3, workspaceId: "ws_aaaaaaaaaa", tag: "aaaa", nonce: "a".repeat(12), dev: 1, ino: 2,
    identity: directoryIdentity,
    binding: { kind: "none", reason: "host-storage-verified-absent", capability: sha256("synthetic-capability") },
  };
  const absent = (path: string) => ({ presence: "absent", path, identity: null, bytes: null, sha256: null, schema: null } as const);
  const targets: Array<{
    path: "state.prev" | "state" | "marker" | "summaries.json" | "journal-index.json";
    before: z.infer<typeof FileTupleV3>; after: z.infer<typeof FileTupleV3>; tempPath: string;
  }> =
    (["state.prev", "state", "marker", "summaries.json", "journal-index.json"] as const).map(path => {
    const tempPath = `${path}.tmp-${operationId}`;
    const beforeProof = repair ? files.create(path, Buffer.from(stableStringify({ schema: 3, before: path }) + "\n")) : null;
    const before: z.infer<typeof FileTupleV3> = beforeProof ? {
      presence: "present", path, identity: beforeProof.identity, bytes: String(beforeProof.bytes), sha256: beforeProof.sha256, schema: 3,
    } : absent(path);
    if (repair && (path === "summaries.json" || path === "journal-index.json")) return { path, before, after: before, tempPath };
    const bytes = Buffer.from(stableStringify(path === "marker" ? marker : { schema: 3, syntheticTarget: path }) + "\n");
    const proof = files.create(tempPath, bytes);
    return {
      path, before,
      after: { presence: "present", path, identity: proof.identity, bytes: String(proof.bytes), sha256: proof.sha256, schema: 3 },
      tempPath,
    };
  });
  const privacy: PrivacyTransitionV3["privacy"] = {
    ...(repair ? { operation: "digest-key-repair-v3" as const, beforeSchema: 3 as const }
      : { operation: "privacy-schema-3-fresh" as const, beforeSchema: null }), afterSchema: 3,
    populationVersion: 2,
    populationMembers: ["digest.key", "state.prev", "state", "marker", "summaries.json", "journal-index.json"],
    populationHash: "", afterSnapshotHash: "",
    targets, journal: { path: "log", before: absent("log"), final: absent("log") },
    digestKeyId: keyRecord.after.digestKeyId, keyRecord: {
      path: "digest.key", before: { presence: "absent", identity: null, bytes: null }, ...keyRecord,
    },
  };
  if (repair) {
    const proof = files.create("log", Buffer.from("unchanged journal\n"));
    const tuple: z.infer<typeof FileTupleV3> = {
      presence: "present", path: "log", identity: proof.identity, bytes: String(proof.bytes), sha256: proof.sha256, schema: 3,
    };
    privacy.journal = { path: "log", before: tuple, final: tuple };
  }
  const row = PrivacyMigrationTransitionV3.parse({
    format: 3, protocol: "migration-transition-v3", protocolVersion: 2, operationId,
    kind: repair ? "digest-key-repair" : "fresh-init", phase: "prepared",
    root: directoryIdentity, marker,
    privacy: { ...privacy, ...transitionHashes(privacy) },
  });
  const writer = new PrivacyPopulationWriter(files, keys, () => true);
  writer.prepare(row);
  return { root, files, keys, row, writer };
}
const refused = (error: unknown) => error instanceof KernelError &&
  error.reasons[0]?.code === "storage-accounting-unknown";
describe("coupled privacy population writer (schema-3 activation held)", () => {
  it("publishes all six after-image inodes in signed order and removes only the final fence [AC-19] CT-29 CT-33", () => {
    const f = fixture(), events: string[] = [];
    f.writer.resume(phase => events.push(phase));
    assert.deepEqual(events, [
      "summaries.json", "journal-index.json", "digest.key", "key", "state.prev", "previous",
      "state", "state-phase", "marker", "marker-phase", "remove", "removed",
    ]);
    assert.equal(f.files.read("migration-transition.json"), null);
    for (const target of f.row.privacy.targets) {
      assert.deepEqual(f.files.read(target.path)?.proof.identity, target.after.presence === "present" ? target.after.identity : null);
    }
    assert.equal(f.keys.read("digest.key")?.digestKeyId, f.row.privacy.digestKeyId);
    assert.equal(f.files.read("log"), null);
  });
  for (const cut of ["summaries.json", "journal-index.json", "digest.key", "key", "state.prev", "previous",
    "state", "state-phase", "marker", "marker-phase", "remove"] as const) {
    it(`restarts twice from the exact ${cut} population prefix [AC-19] CT-29`, () => {
      const f = fixture();
      assert.throws(() => f.writer.resume(phase => {
        if (phase === cut) throw new Error("synthetic interruption");
      }), /synthetic interruption/);
      const restart = new PrivacyPopulationWriter(f.files, f.keys, () => true);
      restart.resume();
      assert.equal(new PrivacyPopulationWriter(f.files, f.keys, () => true).load(), null);
      assert.equal(f.keys.read("digest.key")?.digestKeyId, f.row.privacy.digestKeyId);
    });
  }
  it("refuses a later-phase target at prepared and preserves every file [AC-19] CT-33", () => {
    const f = fixture(), target = f.row.privacy.targets[0]!;
    const staged = f.files.read(target.tempPath)!;
    f.files.move(staged.proof, target.path);
    const before = readFileSync(join(f.root, "migration-transition.json"));
    assert.throws(() => f.writer.resume(), refused);
    assert.deepEqual(readFileSync(join(f.root, "migration-transition.json")), before);
    assert.equal(f.keys.read("digest.key"), null);
  });
  it("refuses provider withdrawal or changed journal witness before publication [AC-19] CT-33", () => {
    const f = fixture(), denied = new PrivacyPopulationWriter(f.files, f.keys, () => false);
    assert.throws(() => denied.resume(), refused);
    writeFileSync(join(f.root, "log"), "unrelated");
    assert.throws(() => f.writer.resume(), refused);
    assert.equal(f.keys.read("digest.key"), null);
  });
  it("recovers actual killed processes across all coupled population boundaries [AC-19] CT-29", () => {
    for (const cut of ["summaries.json", "journal-index.json", "digest.key", "key", "state.prev", "previous",
      "state", "state-phase", "marker", "marker-phase", "remove", "removed"]) {
      const f = fixture();
      const child = spawnSync(process.execPath, [
        fileURLToPath(new URL("./fixtures/crash-privacy-population.ts", import.meta.url)), f.root, cut,
      ], { encoding: "utf8", timeout: 30_000 });
      assert.equal(child.error, undefined);
      assert.notEqual(child.status, 0, child.stderr);
      new PrivacyPopulationWriter(f.files, f.keys, () => true).resume();
      const settled = f.row.privacy.targets.map(target => f.files.read(target.path)?.proof);
      new PrivacyPopulationWriter(f.files, f.keys, () => true).resume();
      assert.deepEqual(f.row.privacy.targets.map(target => f.files.read(target.path)?.proof), settled);
      assert.equal(f.keys.read("digest.key")?.digestKeyId, f.row.privacy.digestKeyId);
    }
  });
  it("repairs key/state/marker as one population while preserving exact metadata and journal [SEC-11] CT-36", () => {
    const f = fixture(true);
    const unchanged = ["summaries.json", "journal-index.json", "log"].map(path => f.files.read(path));
    const events: string[] = [];
    f.writer.resume(boundary => events.push(boundary));
    assert.equal(events.includes("summaries.json"), false);
    assert.deepEqual(["summaries.json", "journal-index.json", "log"].map(path => f.files.read(path)), unchanged);
    assert.equal(f.keys.read("digest.key")?.digestKeyId, f.row.privacy.digestKeyId);
    assert.equal(f.files.read("migration-transition.json"), null);
  });
});
