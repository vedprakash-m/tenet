import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { KernelError } from "../src/core/errors.ts";
import { emptyState } from "../src/core/state.ts";
import { Terminal, matchTerminal } from "../src/core/migration-terminal.ts";
import { FsStore } from "../src/adapters/store-fs.ts";
import { systemClock, systemRandom } from "../src/adapters/system.ts";
import { cleanup, NO_POSIX_PROCESSES, tmp } from "./helpers.ts";

const roots: string[] = [], temps: string[] = [];
after(() => { roots.forEach(cleanup); temps.forEach(path => rmSync(path, { recursive: true, force: true })); });
const terminal = () => ({
  operationId: "a".repeat(32), protocolVersion: 1, versions: { from: 2, to: 1 },
  outcome: "rolled-back", bindingDigest: "b".repeat(64),
});
function fixture() {
  const root = tmp(), dir = join(root, ".tenet");
  roots.push(root); mkdirSync(dir);
  const { dev, ino } = lstatSync(dir), workspaceId = `ws_${systemRandom.base32(10)}`;
  writeFileSync(join(dir, "marker"), JSON.stringify({ workspaceId, tag: "test", nonce: "bridge", schema: 1, dev, ino }));
  writeFileSync(join(dir, "state"), JSON.stringify(emptyState(workspaceId, "test")));
  writeFileSync(join(dir, "state.prev"), readFileSync(join(dir, "state")));
  const base = join(tmpdir(), `tenet-${workspaceId}`);
  temps.push(base);
  return { root, dir, base, store: new FsStore(root, systemClock, systemRandom) };
}
function snapshot(path: string, excludeLocks = false): unknown {
  if (!existsSync(path)) return null;
  const st = lstatSync(path);
  return { mode: st.mode & 0o777, content: st.isDirectory()
    ? readdirSync(path).sort().filter(name => !excludeLocks || !name.startsWith("lock")).map(name => [name, snapshot(join(path, name))])
    : readFileSync(path).toString("hex") };
}
const unsupported = (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "unsupported-record";

describe("schema-1 rollback bridge [LFC-04, CON-05]", () => {
  const invalid = [
    { ...terminal(), protocolVersion: 2 },
    { ...terminal(), operationId: "A".repeat(32) },
    { ...terminal(), bindingDigest: "b".repeat(63) },
    { ...terminal(), versions: { from: 1, to: 1 } },
    { ...terminal(), versions: { from: 3, to: 1 } },
    { ...terminal(), versions: { from: 2, to: 1, extra: true } },
    { ...terminal(), outcome: "upgraded" },
    { ...terminal(), quote: "must not persist" },
    { ...terminal(), versions: { from: 1, to: 2 }, outcome: "upgraded" },
  ];
  for (const [index, value] of invalid.entries()) {
    it(`refuses invalid or target-schema terminal ${index} before any direct writer`, async () => {
      const { dir, base, store } = fixture();
      writeFileSync(join(dir, "migration-terminal.json"), JSON.stringify(value));
      const before = snapshot(dir);
      for (const write of [
        () => store.putBlob("no"), () => store.tempDir("run-new"), () => store.writeArtifact(join(base, "run-new"), "x", "no"),
        () => store.evict([]), () => store.sweepTemp(0, []), () => store.purge(["no"]), () => store.cleanTemp("machine", 0, true),
      ]) assert.throws(write, unsupported);
      await assert.rejects(store.repairLock(), unsupported);
      await assert.rejects(store.transaction("test", async () => assert.fail("callback entered")), unsupported);
      assert.deepEqual(snapshot(dir), before);
      assert.equal(existsSync(base), false);
    });
  }
  for (const content of ["", "{", JSON.stringify(terminal()).replace('"protocolVersion":1', '"protocolVersion":2,"protocolVersion":1'),
    JSON.stringify(terminal()).replace('"from":2', '"from":1,"from":2'),
    JSON.stringify(terminal()).replace('"from":2', '"fr\\u006fm":1,"from":2')]) {
    it(`refuses malformed/duplicate terminal: ${content.slice(0, 50)}`, () => {
      const { dir, store } = fixture();
      writeFileSync(join(dir, "migration-terminal.json"), content);
      assert.throws(() => store.read(), unsupported);
    });
  }
  it("matches all terminal facts, without exposing a schema-2 writer", () => {
    const stored = Terminal.parse(terminal());
    assert.equal(matchTerminal(stored, Terminal.parse(terminal())), true);
    for (const asked of [
      { ...terminal(), operationId: "c".repeat(32) }, { ...terminal(), bindingDigest: "c".repeat(64) },
      { ...terminal(), versions: { from: 1, to: 2 }, outcome: "upgraded" },
    ]) assert.equal(matchTerminal(stored, Terminal.parse(asked)), false);
    for (const key of Object.keys(terminal())) {
      const raw = { ...terminal() } as Record<string, unknown>; delete raw[key];
      assert.equal(Terminal.safeParse(raw).success, false);
    }
  });
  it("admits a strict rolled-back fact without rewriting it or granting recovery", () => {
    const { dir, store } = fixture(), text = JSON.stringify(terminal());
    writeFileSync(join(dir, "migration-terminal.json"), text);
    const before = snapshot(dir);
    assert.equal(store.read()!.state.schema, 1);
    assert.deepEqual(snapshot(dir), before);
    assert.equal(readFileSync(join(dir, "migration-terminal.json"), "utf8"), text);
    for (const fence of ["migration-transition.json", "migration-privacy.json"]) {
      writeFileSync(join(dir, fence), "{}");
      assert.throws(() => store.read(), unsupported);
      rmSync(join(dir, fence));
    }
  });
  for (const name of ["state", "state.prev"]) {
    for (const schema of [2, 3, null, "1", undefined]) {
      it(`refuses ${name} schema ${String(schema)} without old-state fallback`, () => {
        const { dir, store } = fixture();
        const raw = JSON.parse(readFileSync(join(dir, name), "utf8"));
        if (schema === undefined) delete raw.schema; else raw.schema = schema;
        writeFileSync(join(dir, name), JSON.stringify(raw));
        const before = snapshot(dir);
        assert.throws(() => store.read(), unsupported);
        assert.deepEqual(snapshot(dir), before);
      });
    }
    for (const name of ["marker", "state", "state.prev"]) {
      it(`refuses duplicate raw schema declarations in ${name}`, () => {
        const { dir, store } = fixture(), path = join(dir, name);
        writeFileSync(path, readFileSync(path, "utf8").replace('"schema":1', '"schema":2,"schema":1'));
        const before = snapshot(dir);
        assert.throws(() => store.read(), error => error instanceof KernelError
          && ["unsupported-record", "marker-mismatch"].includes(error.reasons[0]!.code));
        assert.deepEqual(snapshot(dir), before);
      });
    }
  }
  it("keeps readArtifact absent and existing directories byte/mode identical", () => {
    const { dir, base, store } = fixture();
    const run = join(base, "run-diagnostic");
    assert.equal(store.readArtifact(run, "absent.json"), null);
    assert.equal(existsSync(base), false, "a diagnostic read must not mkdir");
    mkdirSync(run, { recursive: true }); chmodSync(run, 0o755);
    writeFileSync(join(run, "present.json"), "{}");
    const before = snapshot(base), state = snapshot(dir);
    assert.equal(store.readArtifact(run, "present.json"), "{}");
    assert.deepEqual(snapshot(base), before, "a diagnostic read must not chmod");
    assert.deepEqual(snapshot(dir), state);
  });
  it("diagnostic log/blob/residue reads remain fenced", () => {
    const { dir, store } = fixture();
    writeFileSync(join(dir, "migration-transition.json"), "{}");
    for (const read of [() => store.readLog(), () => store.readBlob("c".repeat(64)), () => store.residue()]) {
      assert.throws(read, unsupported);
    }
  });
  it("preserves stateless unbound artifact writes without creating a store", () => {
    const root = tmp(); roots.push(root);
    const store = new FsStore(root, systemClock, systemRandom);
    const dir = store.tempDir(`run-bridge-${systemRandom.base32(10)}`); temps.push(dir);
    const file = store.writeArtifact(dir, "packet.json", "{}");
    assert.equal(readFileSync(file, "utf8"), "{}");
    assert.equal(existsSync(join(root, ".tenet")), false);
  });
  it("does not let an unbound blob write create an unowned store", () => {
    const root = tmp(); roots.push(root);
    const store = new FsStore(root, systemClock, systemRandom);
    assert.throws(() => store.putBlob("unbound"), error => error instanceof KernelError
      && error.reasons[0]?.code === "marker-mismatch");
    assert.equal(existsSync(join(root, ".tenet")), false);
  });
  it("does not turn copied terminal metadata into ownership", () => {
    const { dir, store } = fixture();
    const marker = JSON.parse(readFileSync(join(dir, "marker"), "utf8"));
    writeFileSync(join(dir, "marker"), JSON.stringify({ ...marker, ino: marker.ino + 1 }));
    writeFileSync(join(dir, "migration-terminal.json"), JSON.stringify(terminal()));
    const before = snapshot(dir);
    assert.throws(() => store.putBlob("foreign"), error =>
      error instanceof KernelError && error.reasons[0]?.code === "marker-mismatch");
    assert.deepEqual(snapshot(dir), before);
  });
  it("serializes direct writers, reuses nested context and rejects retired Tx writers", { skip: NO_POSIX_PROCESSES }, async () => {
    const { dir, store, root } = fixture();
    let retired: (() => void) | undefined;
    await store.transaction("test", async tx => {
      const run = store.tempDir("run-nested");
      store.writeArtifact(run, "packet", "nested");
      assert.equal(store.readBlob(store.putBlob("nested")), "nested");
      const other = new FsStore(root, systemClock, systemRandom);
      assert.throws(() => other.putBlob("contending"), error =>
        error instanceof KernelError && error.reasons[0]?.code === "kernel-busy");
      retired = () => tx.call({ verb: "retired", exit: 0, revision: 0 });
    });
    assert.throws(() => retired!(), unsupported);
    assert.equal(existsSync(join(dir, "lock")), false);
    assert.equal(store.readBlob(store.putBlob("direct")), "direct");
    assert.equal(readdirSync(dir).some(name => name.startsWith("lock")), false);
  });
    it("does not share a transaction context with a competing operation on the same Store", { skip: NO_POSIX_PROCESSES }, async () => {
      const { store } = fixture();
      let release!: () => void, entered!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; });
      const held = new Promise<void>(resolve => { release = resolve; });
      const operation = store.transaction("held", async () => { entered(); await held; });
      try {
        await started;
        assert.throws(() => store.putBlob("outside-operation"), error =>
          error instanceof KernelError && error.reasons[0]?.code === "kernel-busy");
      } finally { release(); await operation; }
    });
    for (const point of ["direct-initial", "direct-post-claim", "waiting"]) {
      it(`real ${point} writer refuses a transition before protected writes`, { skip: NO_POSIX_PROCESSES, timeout: 15_000 }, async () => {
        const { root, dir, store } = fixture();
        const script = join(import.meta.dirname, "fixtures/store-admission-barrier.ts");
        let child: ReturnType<typeof spawn> | undefined, exited: ReturnType<typeof once> | undefined, output = "";
        const start = async () => {
          child = spawn(process.execPath, [script, root, point], { stdio: ["ignore", "pipe", "inherit"] });
          exited = once(child, "exit");
          child.stdout!.on("data", chunk => { output += chunk; });
          await new Promise<void>((resolve, reject) => {
            child!.stdout!.once("data", () => resolve()); child!.once("error", reject);
            child!.once("exit", () => reject(new Error(`barrier exited: ${output}`)));
          });
          assert.match(output, /paused/);
        };
        try {
          if (point === "waiting") {
            await store.transaction("publisher", async () => {
              await start();
              writeFileSync(join(dir, "migration-transition.json"), "{}");
            });
          } else {
            await start();
            if (point === "direct-initial") {
              await store.transaction("publisher", async () => writeFileSync(join(dir, "migration-transition.json"), "{}"));
            }
            writeFileSync(join(root, "resume"), "go");
          }
          const before = snapshot(dir, true);
          assert.equal((await exited!)[0], 0);
          assert.equal(JSON.parse(output.trim().split("\n").at(-1)!).code, "unsupported-record");
          assert.deepEqual(snapshot(dir, true), before);
          assert.equal(existsSync(join(dir, "blobs")), false);
          assert.equal(readdirSync(dir).some(name => name.startsWith("lock")), false);
        } finally { if (child && child.exitCode === null) { child.kill("SIGKILL"); await exited; } }
      });
    }
  for (const point of ["before-terminal", "after-terminal", "after-fence-removal"]) {
    it(`real interruption at ${point} and two bridge restarts`, { skip: NO_POSIX_PROCESSES, timeout: 15_000 }, async () => {
      const { root, dir } = fixture();
      const script = join(import.meta.dirname, "fixtures/bridge-terminal.ts");
      const child = spawn(process.execPath, [script, root, point], { stdio: ["ignore", "pipe", "pipe"] });
      const exit = once(child, "exit");
      try {
        await new Promise<void>((resolve, reject) => {
          child.stdout!.once("data", () => resolve()); child.once("error", reject);
          child.once("exit", () => reject(new Error("publisher exited before barrier")));
        });
        child.kill("SIGKILL"); assert.equal((await exit)[1], "SIGKILL");
        const before = snapshot(dir, true);
        for (let restart = 0; restart < 2; restart++) {
          const result = spawnSync(process.execPath, [script, root, "bridge"], { encoding: "utf8", timeout: 5000 });
          assert.equal(result.status, 0, result.stderr);
          const response = JSON.parse(result.stdout);
          assert.equal(response.code, point === "after-fence-removal" ? "admitted" : "unsupported-record");
          assert.deepEqual(snapshot(dir, true), before);
          assert.equal(existsSync(join(dir, "lock")), point !== "after-fence-removal");
        }
      } finally { if (child.exitCode === null && child.signalCode === null) { child.kill("SIGKILL"); await exit; } }
    });
  }
});
