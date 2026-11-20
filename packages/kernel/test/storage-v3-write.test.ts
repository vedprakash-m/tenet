import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync, linkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { StorageV3Files } from "../src/adapters/storage-v3-write.ts";
import { KernelError } from "../src/core/errors.ts";
import { supplementalGeneration, supplementalMove } from "./fixtures/supplemental-move.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
const refusal = (error: unknown) => error instanceof KernelError &&
  error.reasons[0]?.code === "storage-accounting-unknown";
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tenet-v3-write-")); roots.push(root);
  let admissions = 0, syncs = 0;
  // Windows supplements real file/rename checks, not directory durability qualification.
  const files = new StorageV3Files(root, {
    assertOwned: () => { admissions++; },
    renameNoReplace: supplementalMove,
    objectGeneration: supplementalGeneration,
    ...(process.platform === "win32" ? { syncDirectory: () => { syncs++; } } : {}),
  });
  return { root, files, admissions: () => admissions, syncs: () => syncs };
}
describe("schema-3 durable file writer (Windows is supplemental)", () => {
  it("preserves a native tuple when the provider reports a fresh object generation [AC-19] CT-58", () => {
    const f = fixture(), proof = f.files.create("record", Buffer.from("unchanged"));
    const replaced = new StorageV3Files(f.root, {
      assertOwned: () => {}, syncDirectory: () => {}, renameNoReplace: supplementalMove,
      objectGeneration: () => ({ version: 1, domain: "store-object-generation-v1", opaque: "synthetic-replacement" }),
    });
    for (let restart = 0; restart < 2; restart++) {
      assert.throws(() => replaced.move(proof, "destination"), refusal);
      assert.equal(readFileSync(join(f.root, "record"), "utf8"), "unchanged");
      assert.equal(replaced.read("destination"), null);
    }
  });
  it("refuses missing provider object generation before creating a file [AC-19] CT-58", () => {
    const root = mkdtempSync(join(tmpdir(), "tenet-generation-unavailable-")); roots.push(root);
    const files = new StorageV3Files(root, {
      assertOwned: () => {}, syncDirectory: () => {}, renameNoReplace: supplementalMove,
    });
    assert.throws(() => files.create("record", Buffer.from("unchanged")), refusal);
    assert.equal(files.read("record"), null);
  });
  it("refuses an unavailable atomic no-replace primitive before moving either name [AC-19] CT-31 CT-56", () => {
    const root = mkdtempSync(join(tmpdir(), "tenet-no-replace-")); roots.push(root);
    const files = new StorageV3Files(root, {
      objectGeneration: supplementalGeneration,
      assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
    });
    const source = files.create("log.next", Buffer.alloc(0));
    assert.throws(() => files.move(source, "log"), refusal);
    assert.ok(files.read("log.next"));
    assert.equal(files.read("log"), null);
  });
  it("never falls back to replacement when the no-replace provider reports a target race [AC-19] CT-31", () => {
    const f = fixture(), source = f.files.create("log.next", Buffer.alloc(0));
    const raced = new StorageV3Files(f.root, {
      objectGeneration: supplementalGeneration,
      assertOwned: () => {}, ...(process.platform === "win32" ? { syncDirectory: () => {} } : {}),
      renameNoReplace: (_source, target) => {
        writeFileSync(target, "unrelated");
        throw new KernelError("storage-accounting-unknown", "synthetic atomic no-replace race");
      },
    });
    assert.throws(() => raced.move(source, "log"), refusal);
    assert.equal(readFileSync(join(f.root, "log"), "utf8"), "unrelated");
    assert.deepEqual(raced.read("log.next")?.proof, source);
  });
  it("exclusively creates and atomically replaces exact admitted private files [AC-19] CT-41", () => {
    const f = fixture();
    const first = f.files.create("record", Buffer.from("before"));
    assert.equal(first.bytes, 6);
    const next = f.files.replace("record", first, Buffer.from("after"), "record.tmp");
    assert.equal(readFileSync(join(f.root, "record"), "utf8"), "after");
    assert.notDeepEqual(next.identity, first.identity);
    assert.equal(f.files.read("record.tmp"), null);
    assert.ok(f.admissions() > 2);
  });

  it("preserves a same-byte replacement inode and a same-size content edit [AC-19] CT-37 CT-42", () => {
    for (const substituted of [false, true]) {
      const f = fixture(), proof = f.files.create("record", Buffer.from("before"));
      if (substituted) {
        renameSync(join(f.root, "record"), join(f.root, "saved"));
        writeFileSync(join(f.root, "record"), "before");
      } else writeFileSync(join(f.root, "record"), "edited");
      assert.throws(() => f.files.replace("record", proof, Buffer.from("after"), "record.tmp"), refusal);
      assert.equal(readFileSync(join(f.root, "record"), "utf8"), substituted ? "before" : "edited");
      assert.equal(f.files.read("record.tmp"), null);
    }
  });

  it("never overwrites an occupied or linked temporary [AC-19] CT-41", () => {
    const f = fixture(), proof = f.files.create("record", Buffer.from("before"));
    writeFileSync(join(f.root, "record.tmp"), "human");
    assert.throws(() => f.files.replace("record", proof, Buffer.from("after"), "record.tmp"), refusal);
    assert.equal(readFileSync(join(f.root, "record.tmp"), "utf8"), "human");
    rmSync(join(f.root, "record.tmp"));
    linkSync(join(f.root, "record"), join(f.root, "record.tmp"));
    assert.throws(() => f.files.replace("record", proof, Buffer.from("after"), "record.tmp"), refusal);
    assert.equal(readFileSync(join(f.root, "record"), "utf8"), "before");
  });

  it("requires explicit absent targets and exact proofs for moves/removal [AC-19] CT-31 CT-42", () => {
    const f = fixture(), proof = f.files.create("log", Buffer.from("source"));
    f.files.create("sealed", Buffer.from("unrelated"));
    assert.throws(() => f.files.move(proof, "sealed"), refusal);
    f.files.remove(f.files.read("sealed")!.proof);
    const moved = f.files.move(proof, "sealed");
    assert.deepEqual(moved.identity, proof.identity);
    assert.equal(f.files.read("log"), null);
    f.files.remove(moved);
    assert.equal(f.files.read("sealed"), null);
    assert.throws(() => f.files.remove(moved), refusal);
  });

  it("does not bypass ownership admission or normalize unsafe paths [SEC-11] CT-42", () => {
    const f = fixture();
    for (const path of ["../outside", "a\\b", "a/b", "."]) assert.throws(() => f.files.create(path, Buffer.from("x")));
    const denied = new StorageV3Files(f.root, {
      objectGeneration: supplementalGeneration,
      assertOwned: () => { throw new KernelError("marker-mismatch", "synthetic ownership refusal"); },
    });
    assert.throws(() => denied.create("record", Buffer.from("x")), (error: unknown) =>
      error instanceof KernelError && error.reasons[0]?.code === "marker-mismatch");
    assert.equal(f.files.read("record"), null);
  });

  it("surfaces directory-sync failure rather than reporting a durable write [AC-19]", () => {
    const f = fixture();
    const failed = new StorageV3Files(f.root, {
      objectGeneration: supplementalGeneration,
      assertOwned: () => {},
      syncDirectory: () => { throw new Error("synthetic directory-sync failure"); },
    });
    assert.throws(() => failed.create("record", Buffer.from("x")), /synthetic directory-sync failure/);
    assert.equal(readFileSync(join(f.root, "record"), "utf8"), "x");
  });
});
