import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, lstatSync, renameSync, rmSync, linkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Schema3StorageReader } from "../src/adapters/storage-v3-fs.ts";
import { encodeDigestKey } from "../src/core/digest-key.ts";
import { sha256 } from "../src/core/ids.ts";
import { KernelError } from "../src/core/errors.ts";
import { supplementalGeneration } from "./fixtures/supplemental-move.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const batchId = "a".repeat(32);
const identity = (path: string) => {
  const stat = lstatSync(path, { bigint: true });
  return {
    dev: String(stat.dev), ino: String(stat.ino), type: "file", links: Number(stat.nlink),
    objectGeneration: { version: 1, domain: "store-object-generation-v1", opaque: `synthetic-${stat.dev}-${stat.ino}` },
  };
};
const proof = (root: string, path: string) => {
  const bytes = readFileSync(join(root, path));
  return { path, identity: identity(join(root, path)), bytes: bytes.length, sha256: sha256(bytes) };
};
const refusal = (error: unknown) => error instanceof KernelError &&
  error.reasons[0]?.code === "storage-accounting-unknown";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tenet-v3-reader-")); roots.push(root);
  const sealed = `log.sealed-${batchId}`;
  const text = '{"kind":"call","verb":"check","exit":0}\n';
  writeFileSync(join(root, "log"), text);
  writeFileSync(join(root, sealed), text.repeat(3));
  writeFileSync(join(root, "summaries.json"), JSON.stringify({
    version: 2, batchId, from: sha256(""), months: {}, legacyBase: null,
  }));
  const index = {
    version: 1, active: { path: "log", identity: identity(join(root, "log")) },
    summary: { ...proof(root, "summaries.json"), batchId },
    sealed: [{ ...proof(root, sealed), id: batchId, first: "2026-01-01", last: "2026-01-31" }],
  };
  writeFileSync(join(root, "journal-index.json"), JSON.stringify(index));
  let admitted = 0;
  const reader = new Schema3StorageReader(root, () => { admitted++; }, supplementalGeneration);
  return { root, sealed, text, index, reader, admissions: () => admitted };
}
describe("schema-3 settled-store byte admission (not host qualification)", () => {
  it("reads only selected sealed generations then the append-growing active journal [AC-19]", () => {
    const f = fixture();
    writeFileSync(join(f.root, "unselected"), "not history");
    const admitted = f.reader.admitSettled();
    assert.deepEqual(admitted.journals.map(journal => journal.text), [f.text.repeat(3), f.text]);
    writeFileSync(join(f.root, "log"), f.text.repeat(2));
    assert.equal(f.reader.admitSettled().journals.at(-1)?.text, f.text.repeat(2));
    assert.ok(f.admissions() > 0);
  });

  it("refuses a same-size middle-byte mutation before any parsing [AC-19] CT-37", () => {
    const f = fixture(), path = join(f.root, f.sealed);
    const before = readFileSync(path, "utf8"), changed = before.replace("check", "other");
    writeFileSync(path, changed);
    assert.throws(() => f.reader.admitSettled(), refusal);
    assert.equal(readFileSync(path, "utf8"), changed);
  });

  for (const selected of ["sealed", "log"] as const) {
    it(`refuses byte-identical ${selected} replacement at another identity [AC-19] CT-38 CT-42`, () => {
      const f = fixture(), path = join(f.root, selected === "sealed" ? f.sealed : "log");
      const text = readFileSync(path);
      renameSync(path, path + ".saved"); writeFileSync(path, text);
      assert.throws(() => f.reader.admitSettled(), refusal);
      assert.equal(readFileSync(path).equals(text), true);
    });
  }

  it("preserves old pending compaction, orphan next files and in-flight transitions [AC-19] CT-27 CT-31", () => {
    for (const name of ["compaction.pending.json", "log.next", "migration-transition.json",
      "compaction.retention.json", "cleanup.retention.json"]) {
      const f = fixture(), path = join(f.root, name);
      writeFileSync(path, "not assumed to be a valid record");
      assert.throws(() => f.reader.admitSettled(), refusal);
      assert.equal(readFileSync(path, "utf8"), "not assumed to be a valid record");
    }
  });

  it("refuses missing, duplicate-key, contradictory and hash-changed summaries [AC-19] CT-13", () => {
    for (const damage of [
      (root: string) => rmSync(join(root, "summaries.json")),
      (root: string) => writeFileSync(join(root, "summaries.json"), '{"version":2,"version":2}'),
      (root: string) => writeFileSync(join(root, "summaries.json"), "{}"),
      (root: string) => writeFileSync(join(root, "summaries.json"), new Uint8Array([0xff])),
    ]) {
      const f = fixture(); damage(f.root);
      assert.throws(() => f.reader.admitSettled(), refusal);
    }
  });

  it("admits a checked key only in the matching epoch and never replaces an invalid key [SEC-11]", () => {
    const f = fixture(), path = join(f.root, "digest.key"), keyId = Buffer.alloc(16, 1).toString("hex");
    assert.equal(f.reader.digestKey(keyId), null);
    writeFileSync(path, encodeDigestKey(new Uint8Array(16).fill(1), new Uint8Array(32).fill(2)), { mode: 0o600 });
    assert.equal(f.reader.digestKey(keyId)?.id, keyId);
    assert.throws(() => f.reader.digestKey("f".repeat(32)));
    writeFileSync(path, "malformed");
    assert.throws(() => f.reader.digestKey(keyId));
    assert.equal(readFileSync(path, "utf8"), "malformed");
  });

  it("refuses multiple-link private records and a failed marker admission [SEC-11]", () => {
    const f = fixture(), path = join(f.root, "digest.key");
    writeFileSync(path, encodeDigestKey(new Uint8Array(16).fill(1), new Uint8Array(32).fill(2)), { mode: 0o600 });
    linkSync(path, join(f.root, "linked-key"));
    assert.throws(() => f.reader.digestKey("01".repeat(16)));
    const reader = new Schema3StorageReader(f.root, () => { throw new KernelError("marker-mismatch", "test"); });
    assert.throws(() => reader.admitSettled(), error =>
      error instanceof KernelError && error.reasons[0]?.code === "marker-mismatch");
  });
});
