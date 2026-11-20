import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, renameSync, rmSync, linkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { rotateBoundGeneration as rotateReserved, type RotationBoundary } from "../src/adapters/retention-rotation-fs.ts";
import { makeBoundFixture, openBoundStore } from "./fixtures/retention-bound-fixture.ts";
import { KernelError } from "../src/core/errors.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tenet-rotation-")); roots.push(root);
  return { root, ...makeBoundFixture(root) };
}
const rotateBoundGeneration = (
  files: ReturnType<typeof fixture>["files"], store: ReturnType<typeof fixture>["store"], after: Buffer,
  boundary?: (phase: RotationBoundary) => void,
) => rotateReserved(files, store, after, () => true, boundary);
const refusal = (error: unknown) => error instanceof KernelError &&
  error.reasons[0]?.code === "storage-accounting-unknown";
describe("bound journal rotation recovery (Windows is supplemental)", () => {
  it("preserves unproved, replaced or missing index temp prefixes across two restarts [AC-19] CT-57", () => {
    for (const damage of ["missing", "replacement", "changed", "after-with-new-temp", "same-byte-index"]) {
      const f = fixture(), temp = join(f.root, "rotation-index.tmp");
      if (damage === "missing") rmSync(temp);
      if (damage === "replacement") { renameSync(temp, temp + ".saved"); writeFileSync(temp, f.afterIndex); }
      if (damage === "changed") writeFileSync(temp, "changed");
      if (damage === "after-with-new-temp") {
        assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex, phase => {
          if (phase === "index-published") throw new Error("synthetic interruption");
        }), /synthetic interruption/);
        writeFileSync(temp, f.afterIndex);
      }
      if (damage === "same-byte-index") {
        const index = join(f.root, "journal-index.json"), bytes = readFileSync(index);
        renameSync(index, index + ".saved"); writeFileSync(index, bytes);
      }
      const progress = readFileSync(join(f.root, "compaction.retention.json"));
      const index = readFileSync(join(f.root, "journal-index.json"));
      const log = readFileSync(join(f.root, "log"));
      for (let restart = 0; restart < 2; restart++) {
        assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex), error => {
          assert.ok(refusal(error));
          const publicError = JSON.stringify((error as KernelError).reasons);
          assert.ok(!publicError.includes(f.row.rotation.indexTemp.exclusiveNameToken));
          assert.ok(!publicError.includes(f.row.rotation.indexTemp.mount.discriminator.opaque));
          assert.ok(!publicError.includes(f.row.rotation.indexTemp.sha256));
          return true;
        });
        assert.deepEqual(readFileSync(join(f.root, "compaction.retention.json")), progress);
        assert.deepEqual(readFileSync(join(f.root, "journal-index.json")), index);
        assert.deepEqual(readFileSync(join(f.root, "log")), log);
      }
    }
  });
  it("refuses changed provider mount proof with every recorded tuple preserved [AC-19] CT-59", () => {
    const f = fixture(), progress = readFileSync(join(f.root, "compaction.retention.json"));
    const next = readFileSync(join(f.root, "log.next")), temp = readFileSync(join(f.root, "rotation-index.tmp"));
    for (let restart = 0; restart < 2; restart++) {
      assert.throws(() => rotateReserved(f.files, f.store, f.afterIndex, () => false), refusal);
      assert.deepEqual(readFileSync(join(f.root, "compaction.retention.json")), progress);
      assert.deepEqual(readFileSync(join(f.root, "log.next")), next);
      assert.deepEqual(readFileSync(join(f.root, "rotation-index.tmp")), temp);
      assert.equal(f.files.read(f.row.rotation.sealedPath), null);
    }
  });
  it("promotes the exact reserved empty inode then rotates journal/index once [AC-19] CT-31", () => {
    const f = fixture();
    const result = rotateBoundGeneration(f.files, f.store, f.afterIndex);
    assert.equal(result.record.phase, "scan");
    assert.equal(result.record.sealGate.state, "rotated");
    assert.equal(readFileSync(join(f.root, "log")).length, 0);
    assert.deepEqual(readFileSync(join(f.root, f.row.rotation.sealedPath)), f.sourceBytes);
    assert.deepEqual(readFileSync(join(f.root, "journal-index.json")), f.afterIndex);
    assert.equal(f.files.read("log.next"), null);
    assert.deepEqual(result.record.originalAction, f.row.originalAction);
  });

  for (const phase of ["reservation-verified", "source-renamed", "next-renamed", "index-published", "gate-rotated"] as const) {
    it(`re-admits the exact ${phase} prefix across two restarts [AC-19] CT-30 CT-31`, () => {
      const f = fixture();
      assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex, boundary => {
        if (boundary === phase) throw new Error("simulated interruption");
      }), /simulated interruption/);
      const restart = openBoundStore(f.root);
      const result = rotateBoundGeneration(restart.files, restart.store, f.afterIndex);
      assert.equal(result.record.phase, "scan");
      const again = openBoundStore(f.root);
      assert.deepEqual(again.store.load()?.record, result.record);
      assert.deepEqual(readFileSync(join(f.root, f.row.rotation.sealedPath)), f.sourceBytes);
    });
    it(`recovers a real killed child at ${phase} without resealing or changing originalAction [AC-19] CT-30 CT-46`, () => {
      const f = fixture(), indexPath = join(f.root, "rotation-after.test");
      writeFileSync(indexPath, f.afterIndex);
      const child = spawnSync(process.execPath, [
        fileURLToPath(new URL("./fixtures/crash-retention-rotation.ts", import.meta.url)), f.root, indexPath, phase,
      ], { encoding: "utf8", timeout: 30_000 });
      assert.equal(child.error, undefined);
      assert.notEqual(child.status, 0, child.stderr);
      const stopped = openBoundStore(f.root).store.load();
      assert.ok(stopped);
      assert.deepEqual(stopped.record.originalAction, f.row.originalAction);
      const restart = openBoundStore(f.root);
      const result = rotateBoundGeneration(restart.files, restart.store, f.afterIndex);
      assert.equal(result.record.phase, "scan");
      const again = openBoundStore(f.root);
      assert.deepEqual(again.store.load()?.record, result.record);
    });
  }

  it("preserves wrong nonce, linked token and byte-identical substitute identity [AC-19] CT-31 CT-38", () => {
    for (const damage of ["nonce", "identity", "link"]) {
      const f = fixture(), path = join(f.root, "log.next"), before = readFileSync(path);
      if (damage === "nonce") writeFileSync(path, "nonempty");
      if (damage === "identity") { renameSync(path, path + ".saved"); writeFileSync(path, before); }
      if (damage === "link") linkSync(path, path + ".linked");
      const observed = readFileSync(path);
      assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex), refusal);
      assert.deepEqual(readFileSync(path), observed);
      assert.deepEqual(readFileSync(join(f.root, "log")), f.sourceBytes);
    }
  });

  it("does not truncate a token when the source changed or index is a third hash [AC-19] CT-30 CT-37", () => {
    for (const name of ["log", "journal-index.json"]) {
      const f = fixture(), token = readFileSync(join(f.root, "log.next"));
      writeFileSync(join(f.root, name), "unrelated");
      assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex), refusal);
      assert.deepEqual(readFileSync(join(f.root, "log.next")), token);
    }
  });
  it("preserves every byte for an after-index-before-promotion or unexpected-active mixed prefix [AC-19] CT-30 CT-31", () => {
    for (const damage of ["early-index", "unexpected-active"]) {
      const f = fixture();
      if (damage === "early-index") writeFileSync(join(f.root, "journal-index.json"), f.afterIndex);
      else {
        renameSync(join(f.root, "log"), join(f.root, f.row.rotation.sealedPath));
        writeFileSync(join(f.root, "log"), "unrelated");
      }
      const progress = readFileSync(join(f.root, "compaction.retention.json"));
      const next = readFileSync(join(f.root, "log.next"));
      assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex), refusal);
      assert.deepEqual(readFileSync(join(f.root, "compaction.retention.json")), progress);
      assert.deepEqual(readFileSync(join(f.root, "log.next")), next);
    }
  });
  it("re-syncs the admitted final seal before any source name change [AC-19] CT-56", () => {
    const f = fixture();
    f.files.sync = () => { throw new Error("directory sync unavailable"); };
    assert.throws(() => rotateBoundGeneration(f.files, f.store, f.afterIndex), /directory sync unavailable/);
    assert.deepEqual(readFileSync(join(f.root, "log")), f.sourceBytes);
    assert.equal(f.files.read(f.row.rotation.sealedPath), null);
  });
});
