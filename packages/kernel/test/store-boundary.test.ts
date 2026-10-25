import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, closeSync, constants, existsSync, ftruncateSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { cleanup, initState, tmp } from "./helpers.ts";
import { KernelError } from "../src/core/errors.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const root = tmp(); roots.push(root); return root; };

describe("private store boundaries", () => {
  for (const completed of ["commit", "commit:extra"]) {
    it(`keeps an unrelated pending intent when ${completed} completes a colliding text key [CON-03]`, async () => {
      const root = fresh(), store = await initState(root);
      const pending = completed === "commit" ? { effect: "commit:extra", id: "shared" } : { effect: "commit", id: "extra:shared" };
      await store.transaction("test", async tx => {
        tx.intent("commit", "extra:shared", { work: "first" });
        tx.intent("commit:extra", "shared", { work: "second" });
        tx.result(completed, completed === "commit" ? "extra:shared" : "shared", { completed: false });
        assert.deepEqual(tx.unresolved(), [{ ...pending, op: { work: pending.effect === "commit" ? "first" : "second" } }]);
      });
      await store.transaction("test", async tx => {
        assert.deepEqual(tx.unresolved().map(({ effect, id }) => ({ effect, id })), [pending]);
        tx.result(pending.effect, pending.id, { completed: false });
        assert.deepEqual(tx.unresolved(), []);
      });
    });
  }
  it("pairs pending effects by both effect name and ID without changing matching result behavior [CON-03]", async () => {
    const root = fresh(), store = await initState(root);
    await store.transaction("test", async tx => {
      tx.intent("commit", "shared", { work: "first" });
      tx.intent("index-sync", "shared", { work: "second" });
      tx.result("commit", "shared", { completed: false });
      assert.deepEqual(tx.unresolved(), [{ effect: "index-sync", id: "shared", op: { work: "second" } }]);
      tx.result("index-sync", "shared", { completed: true });
      assert.deepEqual(tx.unresolved(), []);
    });
  });
  for (const record of ["state", "marker", "log"] as const) {
    it(`refuses malformed UTF-8 in complete private ${record} without replacing stored bytes [CON-03, CON-04, SEC-06]`, async () => {
      for (const invalid of [[0xff], [0xc3, 0x28], [0xed, 0xa0, 0x80]]) {
        const root = fresh(), store = await initState(root);
        if (record === "state") {
          await store.transaction("test", async tx => tx.publish({ ...tx.state!, _ext: { note: "encoding-canary" } }));
          rmSync(join(root, ".tenet/state.prev"));
        }
        if (record === "log") await store.transaction("test", async tx => tx.intent("commit", "c1", { note: "encoding-canary" }));
        const path = join(root, ".tenet", record), original = readFileSync(path);
        const offset = record === "marker" ? original.indexOf('"nonce":"') + '"nonce":"'.length : original.indexOf("encoding-canary");
        assert.ok(offset >= 0);
        const bytes = Buffer.concat([original.subarray(0, offset), Buffer.from(invalid), original.subarray(offset + 1)]);
        writeFileSync(path, bytes);
        const state = readFileSync(join(root, ".tenet/state"));
        assert.throws(() => record === "log" ? store.readLog() : store.read(),
          error => error instanceof KernelError && error.reasons[0]?.code === (record === "marker" ? "marker-mismatch" : "unsupported-record"));
        if (record === "log") {
          await assert.rejects(store.transaction("test", async () => undefined), /unsupported|record/i);
          assert.deepEqual(readFileSync(join(root, ".tenet/state")), state);
        }
        assert.deepEqual(readFileSync(path), bytes);
        assert.equal(existsSync(join(root, ".tenet/lock")), false);
      }
    });
  }
  it("preserves valid Unicode and literal replacement characters in private records [CON-03, CON-04]", async () => {
    const root = fresh(), store = await initState(root), text = "\u00e9\u4e2d\ud83d\ude80\ufffd";
    await store.transaction("test", async tx => {
      tx.intent("commit", "c1", { text });
      tx.publish({ ...tx.state!, _ext: { text } });
    });
    assert.equal(store.read()!.state._ext!.text, text);
    assert.deepEqual(store.readLog().find(entry => entry.kind === "intent")!.op, { text });
    assert.equal(store.readBlob(store.putBlob(text)), text);
  });
  it("ignores and transactionally repairs a torn multibyte journal tail [CON-03, CON-04]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    await store.transaction("test", async tx => tx.intent("commit", "c1", { note: "valid" }));
    const prefix = readFileSync(path), bytes = Buffer.concat([prefix, Buffer.from('{"note":"'), Buffer.from([0xe2, 0x82])]);
    writeFileSync(path, bytes);
    assert.equal(store.readLog().length, 1);
    assert.deepEqual(readFileSync(path), bytes);
    await store.transaction("test", async tx => assert.equal(tx.unresolved().length, 1));
    assert.deepEqual(readFileSync(path), prefix);
  });
  it("uses the previous revision rather than replacement-decoding a corrupt primary state [CON-03, CON-04]", async () => {
    const root = fresh(), store = await initState(root);
    await store.transaction("test", async tx => tx.publish({ ...tx.state!, _ext: { note: "encoding-canary" } }));
    const path = join(root, ".tenet/state"), original = readFileSync(path), offset = original.indexOf("encoding-canary");
    const bytes = Buffer.concat([original.subarray(0, offset), Buffer.from([0xff]), original.subarray(offset + 1)]);
    writeFileSync(path, bytes);
    const read = store.read()!;
    assert.equal(read.recovered, true);
    assert.equal(read.state._ext?.note, undefined);
    assert.deepEqual(readFileSync(path), bytes);
  });
  for (const operation of ["state", "marker", "log"] as const) {
    for (const mode of ["store-overwrite", "short", "metadata-only"] as const) {
      it(`${mode === "short" ? "accepts stable short reads of" : mode === "metadata-only" ? "accepts permission-only metadata changes to" : "refuses concurrent same-size changes to"} private ${operation} [CON-03, CON-04, SEC-06]`, async () => {
        const root = fresh(), store = await initState(root);
        if (operation === "log") await store.transaction("test", async tx => tx.intent("commit", "c1", { note: "a" }));
        const path = join(root, ".tenet", operation), before = readFileSync(path, "utf8");
        const result = JSON.parse(execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, mode, operation], { encoding: "utf8" }));
        if (mode !== "store-overwrite") {
          assert.equal(result.value, 1, JSON.stringify(result));
          assert.equal(readFileSync(path, "utf8"), before);
        } else {
          assert.equal(result.code, operation === "marker" ? "marker-mismatch" : "unsupported-record", JSON.stringify(result));
          assert.equal(result.value, undefined);
          const expected = operation === "state" ? before.replace('"revision":1', '"revision":2') : operation === "marker" ?
            before.replace(/("nonce":")(.)/, (_match, prefix: string, first: string) => prefix + (first === "a" ? "b" : "a")) :
            before.replace('"note":"a"', '"note":"b"');
          assert.equal(readFileSync(path, "utf8"), expected);
        }
      });
    }
  }
  it("refuses oversized logs before reads or tail repair without changing stored bytes [CON-04, SEC-06]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    const descriptor = openSync(path, "w");
    try { ftruncateSync(descriptor, 50 * 1024 * 1024 + 1); }
    finally { closeSync(descriptor); }
    const state = readFileSync(join(root, ".tenet/state"));
    assert.throws(() => store.readLog(), /unsupported|bound|large/i);
    await assert.rejects(store.transaction("test", async tx => tx.publish(tx.state!)), /unsupported|bound|large/i);
    assert.equal(statSync(path).size, 50 * 1024 * 1024 + 1);
    assert.deepEqual(readFileSync(join(root, ".tenet/state")), state);
    assert.equal(existsSync(join(root, ".tenet/lock")), false);
  });
  it("refuses oversized blobs rather than allocating or reporting them missing [SEC-06]", async () => {
    const root = fresh(), store = await initState(root), hash = store.putBlob("original");
    const descriptor = openSync(join(root, ".tenet/blobs", hash), "w");
    try { ftruncateSync(descriptor, 50 * 1024 * 1024 + 1); }
    finally { closeSync(descriptor); }
    assert.throws(() => store.readBlob(hash), /unsupported|bound|large/i);
    assert.equal(statSync(join(root, ".tenet/blobs", hash)).size, 50 * 1024 * 1024 + 1);
  });
  it("refuses oversized journal appends and blob writes before changing storage [CON-04, SEC-06]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    const content = "\u00e9".repeat(25 * 1024 * 1024 + 1);
    assert.throws(() => store.putBlob(content), /unsupported|bound|large/i);
    assert.equal(existsSync(join(root, ".tenet/blobs")), false);
    await assert.rejects(store.transaction("test", async tx => {
      tx.call({ verb: "inspect", exit: 0, revision: 1, content });
    }), /unsupported|bound|large|storage/i);
    assert.equal(existsSync(path), false);
    assert.equal(store.read()!.state.revision, 1);
  });
  it("verifies blob identities and distinguishes missing blobs from corrupt or non-file records [CON-04, SEC-06]", async () => {
    const root = fresh(), store = await initState(root), hash = store.putBlob("original");
    assert.equal(store.readBlob(hash), "original");
    assert.equal(store.readBlob("0".repeat(64)), null);
    writeFileSync(join(root, ".tenet/blobs", hash), "changed");
    assert.throws(() => store.readBlob(hash), /unsupported|hash|identity/i);
    assert.throws(() => store.putBlob("original"), /unsupported|hash|identity/i);
    assert.throws(() => store.readBlob("../state"), /unsupported|hash|identity/i);
    rmSync(join(root, ".tenet/blobs", hash));
    mkdirSync(join(root, ".tenet/blobs", hash));
    assert.throws(() => store.readBlob(hash), /unsupported|file/i);
  });
  it("refuses malformed complete journal records without erasing recovery evidence [CON-03, CON-04]", async () => {
    const invalidRecords = [null, [], "record", { kind: "future", t: "t" },
      { kind: "intent", t: "t", effect: "commit", op: {} },
      { kind: "result", t: "t", effect: "commit", id: "c1" },
      { kind: "call", t: "t", verb: "check", exit: "0", revision: 1 }];
    for (const record of invalidRecords) {
      const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
      const bytes = `${JSON.stringify(record)}\n`;
      writeFileSync(path, bytes);
      const state = readFileSync(join(root, ".tenet/state"));
      assert.throws(() => store.readLog(), /unsupported|journal|record/i);
      await assert.rejects(store.transaction("test", async tx => tx.publish(tx.state!)), /unsupported|journal|record/i);
      assert.equal(readFileSync(path, "utf8"), bytes);
      assert.deepEqual(readFileSync(join(root, ".tenet/state")), state);
    }
  });
  it("never silently skips interior journal corruption or repairs past it [CON-03, CON-04]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    await store.transaction("test", async tx => tx.intent("commit", "c1", { parent: "a" }));
    const valid = readFileSync(path, "utf8"), bytes = `${valid}{ broken\n${valid}{ torn`;
    writeFileSync(path, bytes);
    assert.throws(() => store.readLog(), /unsupported|journal|record/i);
    await assert.rejects(store.transaction("test", async () => undefined), /unsupported|journal|record/i);
    assert.equal(readFileSync(path, "utf8"), bytes);
  });
  it("records kernel-error exit 5 but refuses exits outside the documented range [CON-04]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    await store.transaction("test", async tx => tx.call({ verb: "check", exit: 5, revision: tx.state!.revision }));
    assert.equal(store.readLog().at(-1)?.exit, 5);
    const bytes = readFileSync(path, "utf8");
    for (const exit of [-1, 6, 0.5]) {
      await assert.rejects(store.transaction("test", async tx => tx.call({ verb: "check", exit, revision: tx.state!.revision })),
        /unsupported|journal|record/i);
      assert.equal(readFileSync(path, "utf8"), bytes);
    }
  });
  it("refuses deeply nested journal payloads before recovery [CON-03, SEC-06]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    let payload: unknown = "leaf";
    for (let depth = 0; depth < 70; depth++) payload = { next: payload };
    const bytes = `${JSON.stringify({ t: "t", kind: "intent", effect: "commit", id: "c1", op: payload })}\n`;
    writeFileSync(path, bytes);
    assert.throws(() => store.readLog(), /unsupported|journal|depth|record/i);
    await assert.rejects(store.transaction("test", async () => undefined), /unsupported|journal|depth|record/i);
    assert.equal(readFileSync(path, "utf8"), bytes);
  });
  it("leaves torn final writes untouched on read and repairs them only inside a transaction [CON-03]", async () => {
    const root = fresh(), store = await initState(root), path = join(root, ".tenet/log");
    await store.transaction("test", async tx => tx.intent("commit", "c1", { parent: "a" }));
    const valid = readFileSync(path, "utf8");
    for (const tail of ['{"kind":"res', '{"kind":"res\n']) {
      const bytes = valid + tail;
      writeFileSync(path, bytes);
      assert.equal(store.readLog().length, 1);
      assert.equal(readFileSync(path, "utf8"), bytes);
      await store.transaction("test", async tx => assert.deepEqual(tx.unresolved().map(entry => entry.id), ["c1"]));
      assert.equal(readFileSync(path, "utf8"), valid);
    }
  });
  it("never breaks or repairs a malformed lock based on an invalid process identity [CON-04]", async () => {
    for (const pid of [-1, "42", null]) {
      const root = fresh(), store = await initState(root);
      const bytes = JSON.stringify({ pid, procStart: "unknown", nonce: "untrusted", verb: "untrusted" });
      writeFileSync(join(root, ".tenet/lock"), bytes);
      await assert.rejects(store.transaction("test", async () => undefined), /recovery|identity/i);
      await assert.rejects(store.repairLock(), /recovery|identity/i);
      assert.equal(readFileSync(join(root, ".tenet/lock"), "utf8"), bytes);
    }
  });
  it("refuses a transaction when this process's start identity cannot be inspected [CON-04]", async () => {
    const root = fresh(); await initState(root);
    const result = execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/store-no-ps.ts"), root], { env: { ...process.env, PATH: "/nonexistent" }, encoding: "utf8" });
    assert.deepEqual(JSON.parse(result), { refused: true, code: "capability-missing" });
    assert.equal(existsSync(join(root, ".tenet/lock")), false);
  });
  for (const kind of ["fifo", "fifo-reader", "directory", "link", "regular"]) {
    it(`admits artifact writes only to regular leaves (${kind}) without blocking or changing foreign content [CON-04, SEC-06]`, async () => {
      const root = fresh(), store = await initState(root), dir = store.tempDir("run-artifact-write");
      const path = join(dir, "packet.json"), original = join(root, "original.txt");
      writeFileSync(original, "preserve original content");
      if (kind.startsWith("fifo")) execFileSync("mkfifo", [path]);
      else if (kind === "directory") { mkdirSync(path); writeFileSync(join(path, "notes.txt"), "preserve directory content"); }
      else if (kind === "link") symlinkSync(original, path);
      else writeFileSync(path, "a longer previous artifact that must be replaced completely");
      const reader = kind === "fifo-reader" ? openSync(path, constants.O_RDONLY | constants.O_NONBLOCK) : -1;
      try {
        const result = JSON.parse(execFileSync(process.execPath,
          [join(import.meta.dirname, "fixtures/race-project-read.ts"), root, "write", "artifact"], { encoding: "utf8", timeout: 10_000 }));
        if (kind === "regular") {
          assert.equal(result.value, path, JSON.stringify(result));
          assert.equal(readFileSync(path, "utf8"), "replacement");
          assert.equal(statSync(path).mode & 0o777, 0o600);
        } else {
          assert.equal(result.value, undefined, JSON.stringify(result));
          assert.equal(typeof result.message, "string", JSON.stringify(result));
          if (kind.startsWith("fifo")) assert.equal(lstatSync(path).isFIFO(), true);
          if (kind === "directory") assert.equal(readFileSync(join(path, "notes.txt"), "utf8"), "preserve directory content");
          if (kind === "link") assert.equal(lstatSync(path).isSymbolicLink(), true);
          if (reader >= 0) assert.equal(readSync(reader, Buffer.alloc(64), 0, 64, null), 0, "a non-file must receive no artifact bytes");
        }
        assert.equal(readFileSync(original, "utf8"), "preserve original content");
      } finally {
        if (reader >= 0) closeSync(reader);
        rmSync(join(dir, ".."), { recursive: true, force: true });
      }
    });
  }
  it("refuses a linked artifact leaf without changing its target [SEC-06]", async () => {
    const root = fresh(), store = await initState(root), dir = store.tempDir("manifests");
    const outside = join(root, "outside"); writeFileSync(outside, "preserve me"); symlinkSync(outside, join(dir, "packet.json"));
    assert.throws(() => store.writeArtifact(dir, "packet.json", "unsafe"));
    assert.equal(readFileSync(outside, "utf8"), "preserve me");
  });
  it("restores private directory and record modes at a mutating boundary [SEC-12]", async () => {
    const root = fresh(), store = await initState(root);
    chmodSync(join(root, ".tenet"), 0o755);
    for (const name of ["marker", "state"]) chmodSync(join(root, ".tenet", name), 0o644);
    await store.transaction("test", async tx => tx.publish(tx.state!));
    assert.equal(statSync(join(root, ".tenet")).mode & 0o777, 0o700);
    for (const name of ["marker", "state", "state.prev"]) assert.equal(statSync(join(root, ".tenet", name)).mode & 0o777, 0o600);
  });
  it("refuses excessive record depth before schema traversal [SEC-06]", async () => {
    const root = fresh(), store = await initState(root);
    const state = JSON.parse(readFileSync(join(root, ".tenet/state"), "utf8"));
    let extension: unknown = "leaf";
    for (let i = 0; i < 70; i++) extension = { next: extension };
    writeFileSync(join(root, ".tenet/state"), JSON.stringify({ ...state, _ext: { extension } }));
    assert.throws(() => store.read(), /cannot be read|unsupported/i);
  });
  it("refuses linked workspace temp storage before artifact writes [SEC-06]", async () => {
    const root = fresh(), outside = fresh(), store = await initState(root);
    const id = store.read()!.state.workspaceId, base = join(tmpdir(), `tenet-${id}`);
    rmSync(base, { recursive: true, force: true });
    symlinkSync(outside, base);
    try {
      assert.throws(() => store.tempDir("run-unsafe"), /link|temp/i);
      assert.equal(existsSync(join(outside, "run-unsafe")), false);
    } finally { rmSync(base); }
    mkdirSync(base, { mode: 0o700 });
    symlinkSync(outside, join(base, "manifests"));
    try {
      assert.throws(() => store.tempDir("manifests/new"), /link|temp/i);
      assert.equal(existsSync(join(outside, "new")), false);
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
  it("never sweeps human files through a linked workspace temp root [SEC-06, CON-04]", async () => {
    const root = fresh(), outside = fresh(), store = await initState(root);
    const base = join(tmpdir(), `tenet-${store.read()!.state.workspaceId}`);
    const human = join(outside, "run-human");
    mkdirSync(human);
    writeFileSync(join(human, "notes.txt"), "preserve human work");
    utimesSync(human, 1, 1);
    symlinkSync(outside, base);
    try {
      assert.equal(store.sweepTemp(1000, []), 0);
      assert.equal(readFileSync(join(human, "notes.txt"), "utf8"), "preserve human work");
    } finally { rmSync(base, { force: true }); }
  });
  it("never sweeps human files through linked manifest or review groups [SEC-06, CON-04]", async () => {
    for (const group of ["manifests", "review"]) {
      const root = fresh(), outside = fresh(), store = await initState(root);
      const base = join(store.tempDir("run-active"), "..");
      const human = join(outside, "notes.txt");
      writeFileSync(human, "preserve human work");
      utimesSync(human, 1, 1);
      symlinkSync(outside, join(base, group));
      try {
        assert.equal(store.sweepTemp(1000, []), 0);
        assert.equal(readFileSync(human, "utf8"), "preserve human work");
      } finally { rmSync(base, { recursive: true, force: true }); }
    }
  });
  it("sweeps expired owned artifacts while keeping live run and reservation paths [CON-04]", async () => {
    const root = fresh(), store = await initState(root), active = store.tempDir("run-active");
    const base = join(active, "..");
    const expired = store.tempDir("run-expired"), manifests = store.tempDir("manifests");
    const packet = store.writeArtifact(manifests, "active.json", "{}");
    const oldPacket = store.writeArtifact(manifests, "expired.json", "{}");
    writeFileSync(join(active, "run.json"), "{}");
    for (const path of [active, expired, packet, oldPacket]) utimesSync(path, 1, 1);
    try {
      assert.equal(store.sweepTemp(1000, [join(active, "run.json"), packet]), 2);
      assert.equal(existsSync(expired), false);
      assert.equal(existsSync(oldPacket), false);
      assert.equal(readFileSync(join(active, "run.json"), "utf8"), "{}");
      assert.equal(readFileSync(packet, "utf8"), "{}");
    } finally { rmSync(base, { recursive: true, force: true }); }
  });
});
