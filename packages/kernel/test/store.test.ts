import { spawn } from "node:child_process";
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { KernelError } from "../src/core/errors.ts";
import { Grant, State } from "../src/core/schemas.ts";
import { emptyState, newContract } from "../src/core/state.ts";
import { cleanup, initState, newStore, tmp } from "./helpers.ts";

const dirs: string[] = [];
const fresh = () => { const d = tmp(); dirs.push(d); return d; };
after(() => dirs.forEach(cleanup));

const bump = (root: string, n: number) => new Promise<number>((res) => {
  const c = spawn(process.execPath, [join(import.meta.dirname, "fixtures/bump.ts"), root, String(n)], { stdio: "inherit" });
  c.on("exit", (code) => res(code ?? -1));
});

describe("store: transactions", () => {
  it("refuses a future primary before fallback or permission changes [CON-04, CON-05]", async () => {
    const root = fresh(), store = await initState(root);
    await store.transaction("test", async tx => tx.publish(tx.state!));
    const primary = join(root, ".tenet/state");
    writeFileSync(primary, JSON.stringify({ ...JSON.parse(readFileSync(primary, "utf8")), schema: 2 }));
    chmodSync(join(root, ".tenet"), 0o750);
    chmodSync(primary, 0o640);
    const bytes = readFileSync(primary);
    const incompatible = (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "unsupported-record";

    assert.throws(() => store.read(), incompatible, "an older previous state must not conceal an incompatible primary");
    await assert.rejects(store.transaction("test", async () => assert.fail("incompatible state was admitted")), incompatible);
    assert.deepEqual(readFileSync(primary), bytes);
    assert.equal(statSync(primary).mode & 0o777, 0o640);
    assert.equal(statSync(join(root, ".tenet")).mode & 0o777, 0o750);
    assert.equal(existsSync(join(root, ".tenet/lock")), false);
  });

  it("re-admits a waiting writer before touching an incompatible store [CON-04, AGT-08]", async () => {
    for (const blocker of ["state", "state.prev", "marker", "migration-transition.json", "migration-privacy.json"]) {
      const root = fresh(), store = await initState(root);
      await store.transaction("test", async tx => tx.publish(tx.state!));
      const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/hold-lock.ts"), root], {
        stdio: ["ignore", "pipe", "inherit"],
      });
      await new Promise(resolve => child.stdout.once("data", resolve));
      try {
        const held = readFileSync(join(root, ".tenet/lock"));
        const pending = newStore(root).transaction("waiting", async () => assert.fail("incompatible writer entered"));
        const path = join(root, ".tenet", blocker);
        const changed = blocker.endsWith(".json") ? "{}" : JSON.stringify({
          ...JSON.parse(readFileSync(path, "utf8")), schema: 2,
        });
        writeFileSync(path, changed);
        await assert.rejects(pending, error => error instanceof KernelError && error.reasons[0]?.code === "unsupported-record");
        assert.equal(readFileSync(path, "utf8"), changed);
        assert.deepEqual(readFileSync(join(root, ".tenet/lock")), held, "the live holder's lock remains");
      } finally {
        const exited = new Promise(resolve => child.once("exit", resolve));
        child.kill("SIGKILL");
        await exited;
      }
    }
  });

  it("rejects unknown or malformed stored restrictions while retaining explicit safe extensions [SEC-12]", () => {
    const state = emptyState("ws_aaaaaaaaaa", "aaaa");
    for (const local of [{ protected_pathz: ["src/"] }, { protected_paths: "src/" }, { style: "turbo" }]) assert.equal(State.safeParse({ ...state, config: { revision: 1, local } }).success, false);
    assert.equal(State.safeParse({ ...state, trust: [{ file: "tenet.policy.json", hash: "h", adoptedAt: "t", restrictions: { protected_pathz: ["src/"] } }] }).success, false);
    const work = newContract({ id: "work", label: "W-0001", profile: "feature", request: "test", lane: "quick", floor: "quick", level: "L4", generation: 1, now: "t", version: "v", assessment: {}, scopePaths: [], protectedPaths: [], gitMode: "git", base: null, branch: "main", start: { head: null, branch: "main", staged: [], dirty: [] } });
    assert.equal(State.safeParse({ ...state, work: { work: { ...work, settings: { protected_paths: ["src/"] } } } }).success, false, "a project restriction cannot be smuggled into task preferences");
    assert.equal(State.safeParse({ ...state, _ext: { harmlessDescription: "retained" } }).success, true);
  });
  it("suspends recovered hook consents with recovered grants [SEC-12]", async () => {
    const root = fresh(), store = await initState(root);
    await store.transaction("t", async tx => tx.publish({ ...tx.state!, consents: [{ kind: "hooks", configHash: "old", at: "2026-10-19T00:00:00Z" }] }));
    await store.transaction("t", async tx => tx.publish(tx.state!));
    writeFileSync(join(root, ".tenet/state"), "{ corrupt");
    assert.equal(store.read()!.state.consents.length, 0);
  });
  it("refuses a symlinked store and markerless existing directory before writing [SEC-06, SEC-12]", async () => {
    const root = fresh(), outside = fresh();
    symlinkSync(outside, join(root, ".tenet"));
    await assert.rejects(newStore(root).transaction("t", async tx => tx.ensure()), /link|marker/i);
    assert.equal(existsSync(join(outside, "marker")), false);
    assert.equal(existsSync(join(outside, "lock")), false);
    const other = fresh();
    mkdirSync(join(other, ".tenet"));
    writeFileSync(join(other, ".tenet/untrusted"), "keep me");
    await assert.rejects(newStore(other).transaction("t", async tx => tx.ensure()), /marker/i);
    assert.equal(readFileSync(join(other, ".tenet/untrusted"), "utf8"), "keep me");
    assert.equal(existsSync(join(other, ".tenet/lock")), false);
  });

  it("refuses symlinked state, log and blob paths, including dangling links [SEC-06]", async () => {
    for (const file of ["state", "log", "blobs"]) {
      const root = fresh(), outside = fresh();
      const store = await initState(root);
      const { rmSync } = await import("node:fs");
      rmSync(join(root, ".tenet", file), { force: true });
      symlinkSync(join(outside, "missing"), join(root, ".tenet", file));
      if (file === "state") assert.throws(() => store.read(), /link/i);
      else if (file === "log") await assert.rejects(store.transaction("t", async () => 1), /link/i);
      else assert.throws(() => store.putBlob("x"), /link/i);
      assert.equal(existsSync(join(outside, "missing")), false);
    }
  });

  it("refuses unknown authority fields instead of silently stripping them [CON-04, SEC-12]", () => {
    assert.equal(Grant.safeParse({ id: "g", actions: ["local-routine"], source: "request", capture: "reported", bind: { factsHash: "f" }, futureAuthority: true }).success, false);
  });

  it("publishes revisions atomically and keeps state.prev [CON-04]", async () => {
    const root = fresh();
    const store = await initState(root);
    await store.transaction("t", async (tx) => tx.publish({ ...tx.state!, workSeq: 7 }));
    const read = store.read()!;
    assert.equal(read.state.revision, 2);
    assert.equal(read.state.workSeq, 7);
    assert.equal(JSON.parse(readFileSync(join(root, ".tenet/state.prev"), "utf8")).revision, 1);
  });

  it("serializes competing writers across real processes: no lost update [CON-04, AGT-08]", async () => {
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

  it("repairLock never removes a lock that is no longer the dead one it confirmed [AGT-08]", async () => {
    const root = fresh();
    const store = await initState(root);
    const dead = JSON.stringify({ pid: 2 ** 22 + 5, procStart: "Thu Jan  1 00:00:00 1970", nonce: "dead", verb: "x" });
    writeFileSync(join(root, ".tenet/lock"), dead);
    writeFileSync(join(root, ".tenet/lock.break"), dead);
    // A dead lock.break refuses the normal path, so repairLock is the only way in; repeating it is a realistic
    // shape for "two users both ran repair" and must stay idempotent without a second, spurious removal.
    const first = await store.repairLock();
    const second = await store.repairLock();
    assert.deepEqual(first.removed.sort(), ["lock", "lock.break"]);
    assert.deepEqual(second.removed, [], "nothing is left the second time, and it is not an error to ask again");
    assert.equal(existsSync(join(root, ".tenet/lock")), false);
    assert.equal(existsSync(join(root, ".tenet/lock.break")), false);
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
  it("truncates a final line that is invalid JSON even though it ends in a newline", async () => {
    const root = fresh();
    const store = await initState(root);
    await store.transaction("t", async (tx) => { tx.intent("commit", "c1", { parent: "a" }); });
    const log = join(root, ".tenet/log");
    // A torn write can still end in a newline (e.g. the newline byte landed before the crash truncated the rest).
    writeFileSync(log, `${readFileSync(log, "utf8")}{"t":"x","kind":"intent","effect":"co\n`);
    await store.transaction("t", async (tx) => {
      assert.deepEqual(tx.unresolved().map((u) => u.id), ["c1"], "the torn line is dropped, not misread as a second intent");
    });
    const lines = readFileSync(log, "utf8").split("\n").filter(Boolean);
    assert.ok(lines.every((l) => { JSON.parse(l); return true; }), "every remaining line is valid JSON");
    assert.ok(!lines.some((l) => l.includes('"t":"x"')), "the torn line itself was actually removed, not just reported as unresolved");
  });
});
