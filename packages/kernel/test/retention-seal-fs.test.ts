import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { sealGeneration } from "../src/adapters/retention-seal-fs.ts";
import { makeBoundFixture } from "./fixtures/retention-bound-fixture.ts";
import { sha256, stableStringify } from "../src/core/ids.ts";
import { JournalIndexV1 } from "../src/core/storage-records.ts";
import { StorageV3Files } from "../src/adapters/storage-v3-write.ts";
import type { RotationReservation } from "../src/adapters/retention-rotation-fs.ts";
import { rotateBoundGeneration } from "../src/adapters/retention-rotation-fs.ts";

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "tenet-first-seal-")); roots.push(root);
  const f = makeBoundFixture(root);
  f.files.remove(f.store.load()!.proof);
  f.files.remove(f.files.read("log.next")!.proof);
  f.files.remove(f.files.read("rotation-index.tmp")!.proof);
  const build = (next: RotationReservation) => {
    const after = JournalIndexV1.parse(JSON.parse(f.afterIndex.toString("utf8")));
    const afterIndex = Buffer.from(stableStringify({ ...after, active: { path: "log", identity: next.identity } }) + "\n");
    return { record: {
      ...f.row, rotation: { ...f.row.rotation, next, indexAfterHash: sha256(afterIndex) },
      retainedIndex: { ...f.row.retainedIndex, beforeHash: sha256(afterIndex) },
    }, afterIndex };
  };
  const admission = {
    root: f.row.rotation.next.mount.root, exclusiveNameToken: f.row.batchId, indexExclusiveNameToken: "b".repeat(24),
    captureMount: () => f.row.rotation.next.mount, verifyReservation: () => true, verifyIndexTemp: () => true,
  };
  return { root, ...f, build, admission };
}
describe("reservation-first seal (mount/root provider is injected; Windows supplemental)", () => {
  it("preserves both reservations on temp-proof failure and cleans only a verified live pair [AC-19] CT-56", () => {
    const f = fixture();
    assert.throws(() => sealGeneration(f.files, f.store, { ...f.admission, verifyIndexTemp: () => false }, f.build));
    assert.ok(f.files.read("log.next"));
    assert.ok(f.files.read("rotation-index.tmp"));
    assert.equal(f.store.load(), null);
    const g = fixture();
    assert.throws(() => sealGeneration(g.files, g.store, g.admission, g.build, boundary => {
      if (boundary === "index-reserved") throw new Error("synthetic pair interruption");
    }), /synthetic pair interruption/);
    assert.equal(g.files.read("log.next"), null);
    assert.equal(g.files.read("rotation-index.tmp"), null);
    assert.equal(g.store.load(), null);
  });
  it("refuses an unavailable promotion primitive before reserving or sealing [AC-19] CT-56", () => {
    const f = fixture(), unavailable = new StorageV3Files(f.root, { assertOwned: () => {} });
    assert.throws(() => sealGeneration(unavailable, f.store, f.admission, f.build));
    assert.equal(f.files.read("log.next"), null);
    assert.equal(f.store.load(), null);
  });
  it("fsyncs an empty held reservation before durable seal without publishing a source rename [AC-19] CT-25 CT-56", () => {
    const f = fixture(), events: string[] = [];
    const sealed = sealGeneration(f.files, f.store, f.admission, f.build, boundary => {
      events.push(boundary);
      if (boundary === "reserved") assert.equal(f.store.load(), null);
    });
    assert.deepEqual(events, ["reserved", "index-reserved", "seal-started", "sealed"]);
    assert.equal(sealed.progress.record.rotation.next.exclusiveNameToken, f.row.batchId);
    assert.equal(sealed.progress.record.rotation.next.sha256, sha256(""));
    assert.equal(readFileSync(join(f.root, "log.next")).length, 0);
    assert.deepEqual(readFileSync(join(f.root, "log")), f.sourceBytes);
    assert.equal(f.files.read(f.row.rotation.sealedPath), null);
  });
  it("preserves log.next when an index reservation pair has not been proved [AC-19] CT-56", () => {
    const f = fixture();
    assert.throws(() => sealGeneration(f.files, f.store, f.admission, () => { throw new Error("builder failed"); }), /builder failed/);
    assert.ok(f.files.read("log.next"));
    assert.equal(f.store.load(), null);
    assert.deepEqual(readFileSync(join(f.root, "log")), f.sourceBytes);
  });
  it("preserves an unadmitted mount/alias reservation or uncertainty after seal starts [AC-19] CT-31 CT-56", () => {
    for (const phase of ["mount", "seal-started"]) {
      const f = fixture();
      assert.throws(() => sealGeneration(f.files, f.store, {
        ...f.admission, verifyReservation: () => phase !== "mount",
      }, f.build, boundary => { if (boundary === phase) throw new Error("publication interrupted"); }));
      assert.equal(readFileSync(join(f.root, "log.next")).length, 0);
      assert.equal(f.store.load(), null);
      assert.deepEqual(readFileSync(join(f.root, "log")), f.sourceBytes);
    }
  });
  it("never adopts an orphan or a wrong provider-token/action binding [AC-19] CT-31 CT-46 CT-56", () => {
    const f = fixture();
    writeFileSync(join(f.root, "log.next"), "orphan");
    assert.throws(() => sealGeneration(f.files, f.store, f.admission, f.build));
    assert.equal(readFileSync(join(f.root, "log.next"), "utf8"), "orphan");
    const g = fixture();
    assert.throws(() => sealGeneration(g.files, g.store, g.admission, next => {
      const proposed = g.build(next);
      return { ...proposed, record: { ...proposed.record, rotation: {
        ...proposed.record.rotation, next: { ...next, exclusiveNameToken: "b".repeat(24) },
      } } };
    }));
    assert.equal(g.store.load(), null);
    assert.equal(g.files.read("log.next"), null);
  });
  it("distinguishes real preseal orphan crashes from an exact final seal across two restarts [AC-19] CT-25 CT-56", () => {
    for (const cut of ["reserved", "index-reserved", "seal-started", "sealed"]) {
      const f = fixture(), rowPath = join(f.root, "seal-row.test"), indexPath = join(f.root, "seal-index.test");
      writeFileSync(rowPath, stableStringify(f.row));
      writeFileSync(indexPath, f.afterIndex);
      const child = spawnSync(process.execPath, [
        fileURLToPath(new URL("./fixtures/crash-retention-seal.ts", import.meta.url)), f.root, rowPath, indexPath, cut,
      ], { encoding: "utf8", timeout: 30_000 });
      assert.equal(child.error, undefined);
      assert.notEqual(child.status, 0, child.stderr);
      if (cut !== "sealed") {
        assert.equal(f.store.load(), null);
        for (let attempt = 0; attempt < 2; attempt++) assert.throws(() =>
          sealGeneration(f.files, f.store, f.admission, f.build));
        assert.equal(readFileSync(join(f.root, "log.next")).length, 0);
        assert.deepEqual(readFileSync(join(f.root, "log")), f.sourceBytes);
      } else {
        const sealed = f.store.load()!;
        const built = f.build(sealed.record.rotation.next);
        const scan = rotateBoundGeneration(f.files, f.store, built.afterIndex, () => true);
        assert.equal(scan.record.phase, "scan");
        assert.deepEqual(f.store.load()?.record, scan.record);
        assert.deepEqual(f.store.load()?.record, scan.record);
      }
    }
  });
});
