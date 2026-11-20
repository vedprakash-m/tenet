import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, renameSync, linkSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DigestKeyFiles } from "../src/adapters/digest-key-fs.ts";
import { parseDigestKey } from "../src/core/digest-key.ts";
import { StorageV3Files } from "../src/adapters/storage-v3-write.ts";
import { KernelError } from "../src/core/errors.ts";
import { supplementalGeneration, supplementalMove } from "./fixtures/supplemental-move.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const operationId = "a".repeat(24);
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tenet-key-writer-")); roots.push(root);
  const files = new StorageV3Files(root, {
    objectGeneration: supplementalGeneration,
    assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
  });
  const keys = new DigestKeyFiles(root, {
    objectGeneration: supplementalGeneration,
    assertOwned: () => {}, syncDirectory: () => files.sync(), renameNoReplace: supplementalMove,
  });
  return { root, keys };
}
describe("P87 coupled key file interface (not standalone epoch repair)", () => {
  it("stages a private checked 84-byte record and exposes only its nonsecret descriptor [SEC-11]", () => {
    const f = fixture(), proof = f.keys.stage(operationId, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
    const bytes = readFileSync(join(f.root, proof.tempPath));
    assert.equal(bytes.length, 84);
    assert.equal(parseDigestKey(bytes)?.id, proof.after.digestKeyId);
    assert.deepEqual(Object.keys(proof.after).sort(), ["bytes", "digestKeyId", "identity", "magic", "presence"]);
    assert.equal(readFileSync(join(f.root, proof.tempPath)).equals(bytes), true);
  });
  it("publishes only after a mandatory coupled-transaction admission and replays the exact inode [SEC-11]", () => {
    const f = fixture(), proof = f.keys.stage(operationId, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
    let admissions = 0;
    const published = f.keys.install(proof, () => { admissions++; return true; });
    assert.deepEqual(published, proof.after);
    assert.equal(admissions, 2);
    assert.deepEqual(f.keys.install(proof, () => true), proof.after);
    assert.equal(f.keys.read(proof.tempPath), null);
  });
  it("refuses unapproved publication, occupied key and malformed/substituted temp without replacement [SEC-11]", () => {
    for (const damage of ["unapproved", "occupied", "malformed", "identity", "linked"]) {
      const f = fixture(), proof = f.keys.stage(operationId, new Uint8Array(16).fill(1), new Uint8Array(32).fill(2));
      const path = join(f.root, proof.tempPath), bytes = readFileSync(path);
      if (damage === "occupied") writeFileSync(join(f.root, "digest.key"), bytes);
      if (damage === "malformed") writeFileSync(path, Buffer.alloc(84));
      if (damage === "identity") { renameSync(path, path + ".saved"); writeFileSync(path, bytes); }
      if (damage === "linked") linkSync(path, path + ".linked");
      const observed = readFileSync(path);
      assert.throws(() => f.keys.install(proof, () => damage !== "unapproved"), (error: unknown) =>
        error instanceof KernelError && error.reasons[0]?.code === "unsupported-record");
      assert.deepEqual(readFileSync(path), observed);
    }
  });
  it("never stages over an unproved temp or bypasses ownership admission [SEC-11]", () => {
    const f = fixture(), name = `digest.key.tmp-${operationId}`;
    writeFileSync(join(f.root, name), "unproved");
    assert.throws(() => f.keys.stage(operationId, new Uint8Array(16), new Uint8Array(32)));
    assert.equal(readFileSync(join(f.root, name), "utf8"), "unproved");
    const denied = new DigestKeyFiles(f.root, {
      objectGeneration: supplementalGeneration,
      assertOwned: () => { throw new KernelError("marker-mismatch", "synthetic marker refusal"); },
      syncDirectory: () => {},
    });
    assert.throws(() => denied.read("digest.key"), /synthetic marker refusal/);
  });
  it("refuses the key namespace in generic content-hashing file operations [SEC-11]", () => {
    const f = fixture(), files = new StorageV3Files(f.root, {
      objectGeneration: supplementalGeneration, assertOwned: () => {}, syncDirectory: () => {},
    });
    const proof = f.keys.stage(operationId, new Uint8Array(16), new Uint8Array(32));
    for (const name of ["digest.key", proof.tempPath]) {
      assert.throws(() => files.read(name));
      assert.throws(() => files.create(name, Buffer.alloc(84)));
    }
  });
  it("never installs a key without the coupled atomic no-replace capability [SEC-11]", () => {
    const f = fixture(), staged = f.keys.stage(operationId, new Uint8Array(16), new Uint8Array(32));
    const unavailable = new DigestKeyFiles(f.root, {
      objectGeneration: supplementalGeneration, assertOwned: () => {}, syncDirectory: () => {},
    });
    assert.throws(() => unavailable.install(staged, () => true));
    assert.equal(unavailable.read("digest.key"), null);
    assert.deepEqual(unavailable.read(staged.tempPath), staged.after);
  });
});
