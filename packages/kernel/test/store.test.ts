import { spawn } from "node:child_process";
import { cpSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { KernelError } from "../src/core/errors.ts";
import { cleanup, initState, newStore, tmp } from "./helpers.ts";

const dirs: string[] = [];
const fresh = () => { const d = tmp(); dirs.push(d); return d; };
after(() => dirs.forEach(cleanup));

const bump = (root: string, n: number) => new Promise<number>((res) => {
  const c = spawn(process.execPath, [join(import.meta.dirname, "fixtures/bump.ts"), root, String(n)], { stdio: "inherit" });
  c.on("exit", (code) => res(code ?? -1));
});

describe("store: transactions", () => {
  it("publishes revisions atomically and keeps state.prev", async () => {
    const root = fresh();
    const store = await initState(root);
    await store.transaction("t", async (tx) => tx.publish({ ...tx.state!, workSeq: 7 }));
    const read = store.read()!;
    assert.equal(read.state.revision, 2);
    assert.equal(read.state.workSeq, 7);
    assert.equal(JSON.parse(readFileSync(join(root, ".tenet/state.prev"), "utf8")).revision, 1);
  });

  it("serializes competing writers across real processes: no lost update", async () => {
    const root = fresh();
    await initState(root);
    const codes = await Promise.all([bump(root, 15), bump(root, 15), bump(root, 15)]);
    assert.deepEqual(codes, [0, 0, 0]);
    const s = newStore(root).read()!.state;
    assert.equal(s.config.revision, 45);
    assert.equal(s.revision, 46);
  });

  it("breaks a lock whose holder is dead, and refuses while the holder is alive", async () => {
    const root = fresh();
    const store = await initState(root);
    writeFileSync(join(root, ".tenet/lock"), JSON.stringify({ pid: 2 ** 22 + 5, procStart: "Thu Jan  1 00:00:00 1970", nonce: "dead", verb: "x" }));
    await store.transaction("t", async (tx) => tx.publish({ ...tx.state!, workSeq: 1 }));
    assert.equal(store.read()!.state.workSeq, 1);
    assert.ok(!existsSync(join(root, ".tenet/lock")));

    const me = await import("../src/adapters/proc.ts");
    writeFileSync(join(root, ".tenet/lock"), JSON.stringify({ pid: process.pid, procStart: me.procStart(process.pid), nonce: "live", verb: "other" }));
    const quick = newStore(root, { lockWaitMs: 100 });
    await assert.rejects(quick.transaction("t", async () => 1), (e: unknown) => e instanceof KernelError && e.reasons[0]!.code === "kernel-busy");
  });

  it("treats a paused holder as alive: elapsed time never decides liveness", async () => {
    const root = fresh();
    const store = await initState(root);
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/hold-lock.ts"), root], { stdio: ["ignore", "pipe", "inherit"] });
    await new Promise((r) => child.stdout.once("data", r));
    child.kill("SIGSTOP");
    try {
      await new Promise((r) => setTimeout(r, 300));
      const quick = newStore(root, { lockWaitMs: 400 });
      await assert.rejects(quick.transaction("t", async () => 1), (e: unknown) => e instanceof KernelError && e.reasons[0]!.code === "kernel-busy");
      assert.ok(existsSync(join(root, ".tenet/lock")), "the paused holder's lock was not broken");
    } finally {
      child.kill("SIGCONT");
      child.kill("SIGKILL");
      await new Promise((r) => child.on("exit", r));
    }
    await store.transaction("t", async (tx) => tx.publish({ ...tx.state!, workSeq: 9 }));
    assert.equal(store.read()!.state.workSeq, 9, "once the holder is dead its lock is broken");
  });

  it("never breaks a dead lock.break automatically", async () => {
    const root = fresh();
    const store = await initState(root);
    const dead = JSON.stringify({ pid: 2 ** 22 + 5, procStart: "Thu Jan  1 00:00:00 1970", nonce: "dead", verb: "x" });
    writeFileSync(join(root, ".tenet/lock"), dead);
    writeFileSync(join(root, ".tenet/lock.break"), dead);
    await assert.rejects(store.transaction("t", async () => 1), (e: unknown) => e instanceof KernelError && e.reasons[0]!.code === "lock-recovery-needed");
    assert.deepEqual((await store.repairLock()).removed.sort(), ["lock", "lock.break"]);
    await store.transaction("t", async (tx) => tx.publish({ ...tx.state!, workSeq: 2 }));
  });

  it("falls back to state.prev when the document is corrupt", async () => {
    const root = fresh();
    const store = await initState(root);
    await store.transaction("t", async (tx) => tx.publish({ ...tx.state!, workSeq: 3 }));
    writeFileSync(join(root, ".tenet/state"), "{ torn");
    const r = store.read()!;
    assert.equal(r.recovered, true);
    assert.equal(r.state.revision, 1);
  });

  it("detects a copied .tenet directory by its inode", async () => {
    const root = fresh();
    await initState(root);
    const other = fresh();
    cpSync(join(root, ".tenet"), join(other, ".tenet"), { recursive: true });
    assert.throws(() => newStore(other).read(), (e: unknown) => e instanceof KernelError && e.reasons[0]!.code === "marker-mismatch");
  });
});

describe("store: effect log", () => {
  it("truncates a torn final line and reports intents without results as unresolved", async () => {
    const root = fresh();
    const store = await initState(root);
    await store.transaction("t", async (tx) => { tx.intent("commit", "c1", { parent: "a" }); });
    const log = join(root, ".tenet/log");
    writeFileSync(log, readFileSync(log, "utf8") + '{"t":"x","kind":"intent","effect":"co');
    await store.transaction("t", async (tx) => {
      assert.deepEqual(tx.unresolved().map((u) => u.id), ["c1"]);
      tx.result("commit", "c1", { ok: true });
      assert.deepEqual(tx.unresolved(), []);
    });
    assert.ok(readFileSync(log, "utf8").split("\n").filter(Boolean).every((l) => { JSON.parse(l); return true; }));
  });
});
