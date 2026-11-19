// Bounded storage (CON-08, AC-19; specs/storage-retention.md v2): journal reduction into summaries, run-file cap, ceiling.
// Real store, real files; the clock is set per write so records can be given any age.
import { after, describe, it, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs, { appendFileSync, existsSync, fstatSync, lstatSync, mkdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FsStore } from "../src/adapters/store-fs.ts";
import { systemRandom } from "../src/adapters/system.ts";
import { emptyState } from "../src/core/state.ts";
import { cleanup, tmp } from "./helpers.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { reclaim } from "../src/verbs/common.ts";
import { systemClock } from "../src/adapters/system.ts";
import { contractFixture, project } from "./support/fixture.ts";
import type { Clock, Ports, Tx } from "../src/ports/types.ts";
import type { State } from "../src/core/schemas.ts";
import { KernelError } from "../src/core/errors.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const DAY = 86400_000;
let now = Date.parse("2026-10-24T12:00:00Z");
const clock: Clock = { now: () => new Date(now).toISOString(), ms: () => now };
const ago = (days: number) => { now = Date.parse("2026-10-24T12:00:00Z") - days * DAY; };
const LOW = { compactAtBytes: 2_000, ceilingBytes: 10_000_000, reserveBytes: 0, runFileCapBytes: 10_000_000 };

async function fresh(limits: Record<string, unknown> = {}) {
  const root = tmp("tenet-ev-");
  roots.push(root);
  const store = new FsStore(root, clock, systemRandom, { ...LOW, ...limits });
  ago(200);
  await store.transaction("seed", async (tx) => { const i = tx.ensure(); tx.publish(emptyState(i.workspaceId, i.tag)); });
  return { root, store, log: () => join(root, ".tenet", "log"), sums: () => join(root, ".tenet", "summaries.json") };
}
const calls = async (store: FsStore, n: number, verb = "open") => {
  await store.transaction("w", async (tx) => { for (let i = 0; i < n; i++) tx.call({ verb, exit: 0, revision: 1 }); });
};
const evict = (store: FsStore, keep: string[] = []) => store.transaction("e", async (tx) => tx.evict(keep));
const lines = (path: string) => readFileSync(path, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l) as Record<string, any>);

describe("storage publication regression controls (synthetic, not durability qualification)", () => {
  const MB = 1024 * 1024;
  const windowsFilesystem = (t: TestContext) => {
    if (process.platform !== "win32") return;
    const fsync = fs.fsyncSync;
    t.mock.method(fs, "fsyncSync", (fd: number) => {
      if (!fstatSync(fd).isDirectory()) fsync(fd);
    });
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  };
  const testIdentity = (store: FsStore) => {
    if (process.platform === "win32") store.self = () => ({ pid: process.pid, procStart: "synthetic" });
    return store;
  };
  const context = () => ({
    lock: { pid: process.pid, procStart: "synthetic", nonce: "regression", verb: "test" },
    active: true, transactional: true, staged: [] as Parameters<FsStore["assertStagedGrowth"]>[0]["staged"],
  });
  const fixture = (limits = {}) => {
    const root = tmp("tenet-storage-regression-"), dir = join(root, ".tenet");
    roots.push(root); mkdirSync(dir);
    const { dev, ino } = lstatSync(dir), workspaceId = `ws_${systemRandom.base32(10)}`;
    writeFileSync(join(dir, "marker"), JSON.stringify({
      workspaceId, tag: "test", nonce: "regression", schema: 2, dev, ino,
    }));
    writeFileSync(join(dir, "state"), JSON.stringify(emptyState(workspaceId, "test")));
    writeFileSync(join(dir, "log"), "");
    writeFileSync(join(dir, "lock"), JSON.stringify(context().lock));
    const base = join(tmpdir(), `tenet-${workspaceId}`);
    mkdirSync(base); roots.push(base);
    return { root, dir, base, store: new FsStore(root, clock, systemRandom, { ...LOW, ...limits }) };
  };
  const reserved = (state: State) => {
    const work = contractFixture({});
    work.session.inCall = {
      runId: "job", verb: "check", since: clock.now(),
      storageReservedBytes: MB,
    };
    return { ...state, work: { [work.id]: work }, _ext: { padding: "x".repeat(1.1 * MB) } };
  };
  const finalized = (state: State) => ({
    ...state,
    work: Object.fromEntries(Object.entries(state.work).map(([id, work]) => [
      id, { ...work, session: { ...work.session, inCall: undefined } },
    ])),
  });
  const storageRefusal = (code: string) => (error: unknown) =>
    error instanceof KernelError && error.reasons[0]?.code === code;

  it("does not reserve writes for an empty transaction above the ceiling [AC-17, P106]", async (t) => {
    windowsFilesystem(t);
    const { dir, root } = fixture();
    rmSync(join(dir, "lock"));
    const store = testIdentity(new FsStore(root, clock, systemRandom, { ceilingBytes: 1 }));
    await assert.doesNotReject(store.transaction("inspect-storage", async () => store.storageBytes()));
  });

  it("creates a complete empty journal and permits admitted artifacts before first state publication [AC-17, P91]", async (t) => {
    windowsFilesystem(t);
    const root = tmp("tenet-initial-storage-"); roots.push(root);
    const store = testIdentity(new FsStore(root, clock, systemRandom));
    await store.transaction("initialize", async (tx) => {
      const { workspaceId, tag } = tx.ensure();
      roots.push(join(tmpdir(), `tenet-${workspaceId}`));
      store.writeArtifact(store.tempDir("run-initial"), "data", "first artifact");
      tx.publish(emptyState(workspaceId, tag));
    });
    assert.equal(store.history(), "complete");
    assert.equal(readFileSync(join(root, ".tenet", "log"), "utf8"), "");
  });

  it("distinguishes a completed quarantine from unexplained missing history [AC-17, P91]", async (t) => {
    windowsFilesystem(t);
    const root = tmp("tenet-quarantine-storage-"); roots.push(root);
    mkdirSync(join(root, ".tenet"));
    writeFileSync(join(root, ".tenet", "imported"), "preserve imported bytes");
    const store = testIdentity(new FsStore(root, clock, systemRandom));
    await store.transaction("open", async (tx) => {
      assert.ok(tx.quarantined);
      assert.equal(tx.history, "newly-created");
      const { workspaceId, tag } = tx.ensure();
      roots.push(join(tmpdir(), `tenet-${workspaceId}`));
      tx.publish({ ...emptyState(workspaceId, tag), quarantine: { ...tx.quarantined!, choice: "pending" } });
    });
    assert.equal(store.history(), "complete");
  });

  it("finalizes an unchanged large state without charging unrelated growth to its job [AC-17, P106]", () => {
    const { store } = fixture();
    const state = reserved(store.read()!.state);
    store.read = () => ({ state, recovered: false });
    store.storageBytes = () => 4 * MB;
    store["measure"] = () => ({
      bytes: 4 * MB, at: 0, newestAt: 0, identity: "synthetic", accounting: "known",
    });
    assert.doesNotThrow(() => store["assertStagedGrowth"](context(), finalized(state)));
  });

  it("reserves the existing state rewrite against concurrent ordinary growth [AC-17, P106]", () => {
    const { store } = fixture({ ceilingBytes: 6 * MB });
    const state = reserved(store.read()!.state);
    store.read = () => ({ state, recovered: false });
    store["measure"] = () => ({
      bytes: 3 * MB, at: 0, newestAt: 0, identity: "synthetic", accounting: "known",
    });
    assert.throws(() => store["assertStagedGrowth"](context(), state),
      storageRefusal("storage-protected-full"));
  });

  it("refuses finalization growth beyond the admitted job allowance [AC-17, P106]", () => {
    const { store } = fixture();
    const state = reserved(store.read()!.state);
    store.read = () => ({ state, recovered: false });
    store.storageBytes = () => 3 * MB;
    assert.throws(() => store["assertStagedGrowth"](context(), {
      ...finalized(state), _ext: { padding: "x".repeat(2.2 * MB) },
    }), storageRefusal("storage-reserve-full"));
  });

  it("does not reserve a journal rewrite when no record can be reduced [AC-17, P106]", () => {
    const { dir, store } = fixture({ compactAtBytes: 1 });
    ago(0);
    writeFileSync(join(dir, "log"), Array.from({ length: 110 }, () => JSON.stringify({
      t: clock.now(), kind: "call", verb: "check", exit: 0, revision: 1,
    }) + "\n").join(""));
    assert.deepEqual(store["projectedReduction"](now, {
      protectedIds: new Set(), protectedPaths: new Set(),
    }), { savings: 0, transientBytes: 0 });
  });

  it("replays interrupted compaction through transaction startup after the cutoff advances [AC-17, P106]", async (t) => {
    windowsFilesystem(t);
    const { root, dir, store } = fixture({ compactAtBytes: 1, afterSummaries: () => { throw new Error("interrupted"); } });
    ago(0);
    const cutoff = now - 90 * DAY;
    const times = [cutoff - 1_000, cutoff + 1_000, ...Array.from({ length: 100 }, () => now)];
    writeFileSync(join(dir, "log"), times.map((t) => JSON.stringify({
      t: new Date(t).toISOString(), kind: "call", verb: "check", exit: 0, revision: 1,
    }) + "\n").join(""));
    rmSync(join(dir, "lock"));
    if (process.platform === "win32") store.self = () => ({ pid: process.pid, procStart: "synthetic" });
    await assert.rejects(store.transaction("compact", async (tx) => tx.evict([])), /interrupted/);
    const summary = readFileSync(join(dir, "summaries.json"), "utf8");
    now += 2_000;
    const restarted = new FsStore(root, clock, systemRandom, { ...LOW, compactAtBytes: 1 });
    if (process.platform === "win32") restarted.self = () => ({ pid: process.pid, procStart: "synthetic" });
    await assert.doesNotReject(restarted.transaction("replay", async (tx) => tx.evict([])));
    assert.deepEqual(JSON.parse(readFileSync(join(dir, "summaries.json"), "utf8")), JSON.parse(summary));
    assert.equal(lines(join(dir, "log")).length, 101, "replay must use the original cutoff");
    assert.equal(existsSync(join(dir, "compaction.pending.json")), false);
    const again = new FsStore(root, clock, systemRandom, { ...LOW, compactAtBytes: 1 });
    if (process.platform === "win32") again.self = () => ({ pid: process.pid, procStart: "synthetic" });
    await again.transaction("later", async (tx) => tx.evict([]));
    assert.equal(lines(join(dir, "log")).length, 100, "a later distinct batch may use the new cutoff");
  });

  it("refuses staged run growth without removing eligible bytes when protected bytes cannot fit [AC-17, P106]", () => {
    const { base, dir, store } = fixture({ runFileCapBytes: 200 });
    const live = join(base, "run-live"), old = join(base, "run-old"), target = join(base, "run-new");
    for (const path of [live, old, target]) mkdirSync(path);
    writeFileSync(join(live, "data"), "x".repeat(199));
    writeFileSync(join(old, "data"), "eligible");
    const state = store.read()!.state, work = contractFixture({});
    work.session.inCall = { runId: "live", verb: "check", since: clock.now(), runDir: live };
    writeFileSync(join(dir, "state"), JSON.stringify({ ...state, work: { [work.id]: work } }));
    store["writes"].run(context(), () => {
      assert.throws(() => store.writeArtifact(target, "new", "xx"), storageRefusal("storage-run-cap-full"));
    });
    assert.equal(readFileSync(join(old, "data"), "utf8"), "eligible");
    assert.equal(existsSync(join(target, "new")), false);
  });

  it("includes staged bytes in cleanup and publishes only after eligible cleanup fits [AC-17, P106]", () => {
    const { base, store } = fixture({ runFileCapBytes: 200 });
    const old = join(base, "run-old"), target = join(base, "run-new");
    mkdirSync(old); mkdirSync(target);
    writeFileSync(join(old, "data"), "x".repeat(199));
    const active = context();
    store["writes"].run(active, () => {
      store.writeArtifact(target, "new", "xx");
      const report = store.evict([]);
      assert.match(report.message ?? "", /Removed 1/);
      store["commitStaged"](active);
    });
    assert.equal(existsSync(old), false);
    assert.equal(readFileSync(join(target, "new"), "utf8"), "xx");
  });

  it("rechecks staged run capacity before any publication after concurrent growth [AC-17, P106]", () => {
    const { base, store } = fixture({ runFileCapBytes: 200 });
    const target = join(base, "run-new"); mkdirSync(target);
    writeFileSync(join(target, "data"), "x".repeat(198));
    const active = context();
    store["writes"].run(active, () => {
      store.writeArtifact(target, "new", "xx");
      store.writeArtifact(target, "new", "xx");
      store.writeArtifact(target, "data", "x".repeat(198));
      writeFileSync(join(target, "data"), "x".repeat(199));
      assert.throws(() => store["commitStaged"](active), storageRefusal("storage-run-cap-full"));
    });
    assert.equal(existsSync(join(target, "new")), false);
  });

  it("keeps staged artifact folders through the age sweep before publication [AC-17, P106]", () => {
    const { base, store } = fixture({ runFileCapBytes: 200 });
    const target = join(base, "run-staged"); mkdirSync(target);
    utimesSync(target, new Date(0), new Date(0));
    store["writes"].run(context(), () => {
      store.writeArtifact(target, "new", "xx");
      assert.equal(store.sweepTemp(DAY, []), 0);
    });
    assert.equal(existsSync(target), true);
  });

  it("keeps previous-state evidence through the age sweep before publication [AC-17, P106]", () => {
    const { base, dir, store } = fixture();
    const target = join(base, "run-backup"); mkdirSync(target);
    utimesSync(target, new Date(0), new Date(0));
    const state = store.read()!.state, work = contractFixture({});
    work.session.inCall = { runId: "backup", verb: "check", since: clock.now(), runDir: target };
    writeFileSync(join(dir, "state.prev"), JSON.stringify({ ...state, work: { [work.id]: work } }));
    store["writes"].run(context(), () => assert.equal(store.sweepTemp(DAY, []), 0));
    assert.equal(existsSync(target), true);
  });
});

describe("journal reduction into summaries [CON-08, AC-19]", () => {
  it("removes calls and completed pairs older than 90 days into monthly counts, and keeps recent records and unresolved intents", async () => {
    const { store, log, sums } = await fresh();
    ago(200);
    await store.transaction("old", async (tx) => {
      tx.intent("commit", "c1", { a: 1 }); tx.result("commit", "c1", { completed: true }); tx.intent("undo", "u-open", { b: 1 });
      for (let i = 0; i < 300; i++) tx.call({ verb: "check", exit: i % 2, revision: 1 });
    });
    ago(5);
    await calls(store, 3, "finish");
    const before = statSync(log()).size;
    ago(0);
    const r = await evict(store);
    assert.ok(statSync(log()).size < before, JSON.stringify(r));
    const kept = lines(log());
    assert.ok(kept.some((e) => e.kind === "intent" && e.effect === "undo" && e.id === "u-open"), "an intent without a result is never removed");
    assert.ok(!kept.some((e) => e.effect === "commit"), "a completed pair that is old goes");
    assert.equal(kept.filter((e) => e.kind === "call" && e.verb === "finish").length, 3, "recent calls stay");
    const month = Object.values(JSON.parse(readFileSync(sums(), "utf8")).months as Record<string, any>)[0];
    assert.deepEqual([month.intents, month.results], [1, 1]);
    assert.equal(month.calls.check + kept.filter((e) => e.kind === "call" && e.verb === "check").length, 300, "every old call is either kept or counted");
    assert.equal(month.exits["0"] + month.exits["1"], month.calls.check);
  });

  it("reports the reduction once and nothing when there is nothing to reduce", async () => {
    const { store } = await fresh();
    ago(200); await calls(store, 300);
    ago(0);
    const first = await evict(store);
    assert.match(first.message ?? "", /older than 90 days/);
    assert.equal((await evict(store)).message, undefined);
  });

  it("does nothing under the size threshold", async () => {
    const { store, log } = await fresh({ compactAtBytes: 10_000_000 });
    ago(200); await calls(store, 20); ago(0);
    const before = readFileSync(log(), "utf8");
    await evict(store);
    assert.equal(readFileSync(log(), "utf8"), before);
  });

  it("a rerun after a crash between the summaries write and the journal replacement does not count twice", async () => {
    const { root, store, log, sums } = await fresh();
    ago(200); await calls(store, 300); ago(0);
    const crashing = new FsStore(root, clock, systemRandom, { ...LOW, afterSummaries: () => { throw new Error("killed"); } });
    await assert.rejects(crashing.transaction("e", async (tx) => tx.evict([])), /killed/);
    const summarized = JSON.parse(readFileSync(sums(), "utf8"));
    assert.ok(lines(log()).length >= 300, "the journal was not replaced yet");
    await evict(store);
    const after = JSON.parse(readFileSync(sums(), "utf8"));
    const total = (s: any) => Object.values(s.months as Record<string, any>).reduce((n: number, m: any) => n + Object.values(m.calls as Record<string, number>).reduce((a, b) => a + b, 0), 0);
    const counted = total(summarized);
    assert.ok(counted > 0 && counted <= 200);
    assert.equal(total(after), counted, "counted once, not twice");
  });

  it("a real SIGKILL right after the summaries are written leaves a journal the next call reduces without counting twice", async () => {
    const { root, store, log, sums } = await fresh();
    ago(200); await calls(store, 300); ago(0);
    const killed = spawnSync(process.execPath, [join(import.meta.dirname, "fixtures", "crash-evict.ts"), root], { encoding: "utf8" });
    assert.equal(killed.signal, "SIGKILL", killed.stderr);
    const counted = (s: any) => Object.values(s.months as Record<string, any>).reduce((n: number, m: any) => n + (m.calls.open ?? 0), 0);
    const first = counted(JSON.parse(readFileSync(sums(), "utf8")));
    assert.ok(first > 0 && lines(log()).filter((e) => e.kind === "call").length >= 300, "summaries written, journal not yet replaced");
    await evict(store);
    assert.equal(counted(JSON.parse(readFileSync(sums(), "utf8"))), first);
    assert.ok(lines(log()).filter((e) => e.kind === "call").length < 300);
  });

  it("keeps every accounting record at or above the older of state and state.prev, however old", async () => {
    const { store, log } = await fresh();
    ago(200);
    await store.transaction("w1", async (tx) => { const s = tx.state!; tx.publish({ ...s, workSeq: 1 }); });
    await store.transaction("w2", async (tx) => { const s = tx.state!; tx.publish({ ...s, workSeq: 2 }); });
    await calls(store, 300);
    ago(0);
    await evict(store);
    const revs = lines(log()).filter((e) => e.kind === "accounting").map((e) => e.revision);
    assert.ok(revs.length >= 2 && revs.includes(store.read()!.state.revision), `kept ${revs}`);
  });

  it("a clock that ran backwards ages nothing, and one that jumped forward spares the newest 100 records", async () => {
    const { store, log } = await fresh();
    ago(0); await calls(store, 300);
    ago(100);
    const before = lines(log()).length;
    await evict(store);
    assert.equal(lines(log()).length, before, "nothing is older than the window relative to a clock that ran back");
    now += 400 * DAY;
    await evict(store);
    assert.equal(lines(log()).length, 100, "a forward jump removes all but the newest 100");
  });

  it("refuses to reduce a journal that holds a record it does not recognize (pure rule)", async () => {
    const { reduceJournal } = await import("../src/core/journal-reduce.ts");
    const old = '{"t":"2020-01-01T00:00:00.000Z","kind":"call","verb":"open","exit":0,"revision":1}\n';
    assert.equal(reduceJournal(`${old}{"t":"2020-01-01T00:00:00.000Z","kind":"bogus"}\n`, { nowMs: Date.now(), days: 90, protectFromRevision: 0 }), null);
    assert.equal(reduceJournal(`${old}not json\n`, { nowMs: Date.now(), days: 90, protectFromRevision: 0 }), null);
  });

  it("keeps an old intent/result pair until its result explicitly completes [AC-17, P101]", async () => {
    const { reduceJournal } = await import("../src/core/journal-reduce.ts");
    const old = "2020-01-01T00:00:00.000Z";
    const rows = [
      { t: old, kind: "intent", effect: "undo", id: "u1", op: { runDir: "run-u1" } },
      { t: old, kind: "result", effect: "undo", id: "u1", outcome: { completed: false } },
      ...Array.from({ length: 101 }, () => ({ t: old, kind: "call", verb: "check", exit: 0, revision: 1 })),
    ];
    const reduced = reduceJournal(`${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, {
      nowMs: Date.now(), days: 90, protectFromRevision: 0,
    });
    assert.ok(reduced);
    const remaining = reduced.text.split("\n").filter(Boolean).map((line) => JSON.parse(line));
    assert.ok(remaining.some((r) => r.kind === "intent" && r.id === "u1"));
    assert.ok(remaining.some((r) => r.kind === "result" && r.id === "u1"));
  });

  it("keeps completed effect history referenced by active state or run paths [AC-17, P100]", async () => {
    const { reduceJournal } = await import("../src/core/journal-reduce.ts");
    const old = "2020-01-01T00:00:00.000Z";
    const intent = { t: old, kind: "intent", effect: "undo", id: "u1", op: { runDir: "live-run" } };
    const result = { t: old, kind: "result", effect: "undo", id: "u1", outcome: { completed: true } };
    const rows = [intent, result, ...Array.from(
      { length: 101 }, () => ({ t: old, kind: "call", verb: "check", exit: 0, revision: 1 }),
    )];
    const reduced = reduceJournal(`${rows.map((r) => JSON.stringify(r)).join("\n")}\n`, {
      nowMs: Date.now(),
      days: 90,
      protectFromRevision: 0,
      protectedPaths: new Set(["live-run"]),
    });
    assert.ok(reduced?.text.includes('"effect":"undo","id":"u1","op"'));
    assert.ok(reduced?.text.includes('"effect":"undo","id":"u1","outcome"'));
  });

  it("counts identical journal bytes as a distinct durable batch [AC-17, P103]", async () => {
    const { store, log, sums } = await fresh();
    ago(200);
    await calls(store, 300);
    const original = readFileSync(log(), "utf8");
    ago(0);
    await evict(store);
    const first = JSON.parse(readFileSync(sums(), "utf8"));
    writeFileSync(log(), original);
    await evict(store);
    const second = JSON.parse(readFileSync(sums(), "utf8"));
    const total = (summary: any) => Object.values(summary.months as Record<string, any>)
      .reduce((n: number, month: any) => n + Number(month.calls.open ?? 0), 0);
    assert.notEqual(second.batchId, first.batchId);
    assert.ok(total(second) > total(first));
  });

  it("reduces a 10,000-record journal inside the 300 ms bound", async () => {
    const { store, log } = await fresh({ compactAtBytes: 1_000_000 });
    ago(200);
    const t = new Date(now).toISOString();
    appendFileSync(log(), Array.from({ length: 10_000 }, () => JSON.stringify({ t, kind: "call", verb: "check", exit: 0, revision: 1 }) + "\n").join(""));
    ago(0);
    const t0 = performance.now();
    await evict(store);
    assert.ok(performance.now() - t0 < 300, `took ${performance.now() - t0} ms`);
  });
});

describe("run-file cap and ceiling [CON-08, AC-19]", () => {
  const runDir = (store: FsStore, name: string, bytes: number, ageDays: number) => {
    const dir = store.tempDir(name);
    writeFileSync(join(dir, "f"), "x".repeat(bytes));
    const t = new Date(Date.now() - ageDays * DAY);
    utimesSync(join(dir, "f"), t, t); utimesSync(dir, t, t);
    return dir;
  };
  it("over its cap, removes the oldest run folders first and never one a live reservation names", async () => {
    const { store } = await fresh({ runFileCapBytes: 2_500 });
    const oldest = runDir(store, "manifests/a", 1_000, 5), middle = runDir(store, "manifests/b", 1_000, 3), newest = runDir(store, "manifests/c", 1_000, 1);
    const r = await evict(store, [oldest]);
    assert.deepEqual([existsSync(oldest), existsSync(middle), existsSync(newest)], [true, false, true]);
    assert.match(r.message ?? "", /run files/);
  });

  it("includes unresolved recovery run directories in both retention keep lists [AC-17]", async () => {
    const referenced = "pending-undo-run";
    let swept: readonly string[] = [];
    let evicted: readonly string[] = [];
    const ports = { store: { sweepTemp: (_age: number, keep: readonly string[]) => { swept = keep; return 0; } } } as unknown as Ports;
    const tx = {
      unresolved: () => [{ effect: "undo", id: "pending", op: { runDir: referenced } }],
      evict: (keep: readonly string[]) => { evicted = keep; return { overCeiling: false, largest: [] }; },
    } as unknown as Tx;
    reclaim(ports, tx, emptyState("workspace", "tag"));
    assert.deepEqual(swept, [referenced]);
    assert.deepEqual(evicted, [referenced]);
  });

  it("keeps live run and review paths alongside valid unresolved recovery paths [AC-17]", () => {
    const work = contractFixture({});
    const reservation = {
      id: "review", role: "reviewer" as const, manifest: "reserved-manifest", manifestHash: "hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full" as const, files: {},
    };
    work.session.inCall = { runId: "run", verb: "check", since: "t", runDir: "live-run" };
    work.focusedReview = { ...reservation, id: "focused", manifest: "focused-manifest" };
    work.budget.reservations = [reservation];
    const state = { ...emptyState("workspace", "tag"), work: { [work.id]: work } };
    const expected = ["live-run", "focused-manifest", "reserved-manifest", "pending-run"];
    let swept: readonly string[] = [];
    let evicted: readonly string[] = [];
    const ports = { store: { sweepTemp: (_age: number, keep: readonly string[]) => { swept = keep; return 0; } } } as unknown as Ports;
    const tx = {
      unresolved: () => [
        { effect: "undo", id: "pending", op: { runDir: "pending-run" } },
        { effect: "commit", id: "empty", op: { runDir: "" } },
        { effect: "commit", id: "missing", op: {} },
        { effect: "commit", id: "null", op: null },
        { effect: "commit", id: "number", op: { runDir: 1 } },
      ],
      evict: (keep: readonly string[]) => { evicted = keep; return { overCeiling: false, largest: [] }; },
    } as unknown as Tx;
    reclaim(ports, tx, state);
    assert.deepEqual(swept, expected);
    assert.deepEqual(evicted, expected);
  });

  for (const { name, age, cap } of [
    { name: "age-based cleanup", age: 2, cap: 10_000_000 },
    { name: "size-cap eviction", age: 0.5, cap: 1_500 },
  ]) {
    it(`retains unresolved recovery files through ${name} and removes them after resolution [AC-17]`, async () => {
      const { store, root } = await fresh({ runFileCapBytes: cap });
      ago(0);
      const pending = runDir(store, "run-pending", 1_000, age);
      const other = runDir(store, "run-other", 1_000, age);
      const record = '{"prepared":true}';
      writeFileSync(join(pending, "run.json"), record);
      const t = new Date(Date.now() - age * DAY);
      utimesSync(join(pending, "run.json"), t, t); utimesSync(pending, t, t);
      await store.transaction("intent", async (tx) => tx.intent("undo", "pending", { runDir: pending }));
      const ports = { store };

      await store.transaction("reclaim-pending", async (tx) => reclaim(ports, tx, tx.state!));
      assert.equal(existsSync(pending), true);
      assert.equal(readFileSync(join(pending, "run.json"), "utf8"), record);
      assert.equal(existsSync(other), false);

      const resolved = name === "size-cap eviction"
        ? new FsStore(root, clock, systemRandom, { ...LOW, runFileCapBytes: 500 })
        : store;
      await resolved.transaction("reclaim-resolved", async (tx) => {
        tx.result("undo", "pending", { ok: true });
        reclaim({ store: resolved }, tx, tx.state!);
      });
      assert.equal(existsSync(pending), false);
    });
  }

  it("reports protected data above the ceiling with its largest classes [AC-17, P106]", async () => {
    const { root } = await fresh();
    new FsStore(root, clock, systemRandom, LOW).putBlob("x".repeat(3_000));
    const store = new FsStore(root, clock, systemRandom, { ...LOW, ceilingBytes: 1_500 });
    const r = await evict(store);
    assert.equal(r.overCeiling, true, JSON.stringify(r));
    assert.equal(r.largest[0]!.name, "blobs");
    assert.ok(existsSync(join(root, ".tenet", "state")));
  });
});

describe("the verbs at a storage boundary [CON-08, AC-19]", () => {
  const withLimits = (p: ReturnType<typeof project>, limits: Record<string, unknown>) =>
    ({ ...p.ports(), store: new FsStore(p.root, systemClock, systemRandom, limits) });
  const call = (ports: ReturnType<typeof p0>, verb: string, input: Record<string, unknown>) => runVerb(ports, VERBS, verb, input);
  const p0 = () => withLimits(project(), {});

  it("publishes only a recovery question for uncertain history, then retains the legacy scope on start-fresh [AC-17, P91]", async () => {
    const scope = { path: "/tmp/tenet-ws_legacy", identity: "1:2:3", exists: true };
    const ports = {
      clock,
      host: { capabilities: () => ({}) },
      store: { retentionScope: () => scope, history: () => "complete" },
      project: { readBounded: () => ({ status: "missing" }) },
      git: {
        probe: async () => ({ isRepo: false, shadow: false }),
        tenetHistory: async () => null,
      },
    } as unknown as Ports;
    const tx = {
      history: "uncertain",
      ensure: () => ({ workspaceId: "ws_aaaaaaaaaa", tag: "abcd" }),
    } as unknown as Tx;
    const recovery = await VERBS.open!.run(ports, null, { profile: "plan", request: "second" }, tx);

    assert.equal(recovery.resp.exit, 3, JSON.stringify(recovery));
    assert.equal(recovery.resp.reasons?.[0]?.code, "state-history-unknown");
    assert.equal(Object.keys(recovery.state?.work ?? {}).length, 0);
    assert.deepEqual(recovery.state?.project.retention?.legacyTemp, {
      ...scope, at: clock.now(), pending: true,
    });
    const stopped = await VERBS.stop!.run(ports, recovery.state!, { mode: "pause" }, tx);
    assert.equal(stopped.resp.reasons?.[0]?.code, "state-history-unknown");
    assert.match(stopped.resp.reasons?.[0]?.message ?? "", /no process was signaled/);
    const status = await VERBS.inspect!.run(ports, recovery.state!, { view: "status" });
    assert.equal((status.resp.data as { history: string }).history, "uncertain");

    const answer = await VERBS.decide!.run(ports, recovery.state!, {
      kind: "adopt",
      target: "reconstruction",
      answers: { "reconstruction-review": "fresh" },
    }, { ...tx, state: recovery.state! });

    assert.equal(answer.resp.exit, 0, JSON.stringify(answer));
    assert.equal(answer.state?.project.retention?.legacyTemp.pending, false);
    assert.equal(Object.keys(answer.state?.work ?? {}).length, 0);
  });

  it("does not sweep when a storage refusal is returned [AC-17, P91]", () => {
    for (const code of [
      "storage-accounting-unknown",
      "storage-protected-full",
      "storage-reserve-full",
      "storage-run-cap-full",
    ] as const) {
      let swept = false;
      const ports = {
        store: { sweepTemp: () => { swept = true; return 0; } },
      } as unknown as Ports;
      const tx = {
        unresolved: () => [],
        evict: () => ({ overCeiling: true, largest: [], refusal: { code, message: code } }),
      } as unknown as Tx;
      assert.throws(() => reclaim(ports, tx, emptyState("workspace", "tag")), (error: unknown) => {
        assert.equal((error as { reasons?: Array<{ code: string }> }).reasons?.[0]?.code, code);
        return true;
      });
      assert.equal(swept, false, code);
    }
  });

  it("preserves an existing marker-only run scope and refuses to initialize ordinary work [AC-17, P91]", {
    skip: process.platform === "win32" ? "mutating real-store qualification requires directory fsync on supported POSIX" : false,
  }, async () => {
    const p = project(); roots.push(p.root);
    await p.call("open", { profile: "plan", request: "first" });
    const oldRun = p.ports().store.tempDir("run-ambiguous");
    writeFileSync(join(oldRun, "artifact"), "keep");
    const old = new Date(Date.now() - 2 * DAY);
    utimesSync(oldRun, old, old);
    rmSync(join(p.root, ".tenet", "state"), { force: true });
    rmSync(join(p.root, ".tenet", "state.prev"), { force: true });

    const response = await p.call("open", { profile: "plan", request: "second" });

    assert.equal(response.exit, 3, JSON.stringify(response));
    assert.equal(response.reasons[0]?.code, "state-history-unknown", JSON.stringify(response));
    assert.equal(response.handle, undefined, JSON.stringify(response));
    assert.equal(existsSync(oldRun), true, "ambiguous project run bytes must be preserved");
    const state = p.ports().store.read()?.state;
    assert.equal(Object.keys(state?.work ?? {}).length, 0, "recovery must not initialize ordinary work");
  });

  it("refuses ordinary open and an unreserved stop above the hard ceiling while inspect stays available [AC-17, P106]", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "plan", request: "first" })).handle!;
    p.ports().store.putBlob("x".repeat(20_000));
    const tight = withLimits(p, { ceilingBytes: 5_000, reserveBytes: 0 });
    const refused = await call(tight, "open", { profile: "plan", request: "second" });
    assert.equal(refused.exit, 2, JSON.stringify(refused));
    assert.equal(refused.reasons[0]!.code, "storage-protected-full");
    assert.match(refused.reasons[0]!.message, /50 MB ceiling/);
    assert.equal((await call(tight, "inspect", { view: "status" })).exit, 0);
    const stopped = await call(tight, "stop", { h, mode: "pause" });
    assert.equal(stopped.exit, 2, JSON.stringify(stopped));
    assert.equal(stopped.reasons[0]!.code, "storage-protected-full");
  });

  it("open reports a journal reduction in its completed effects", async () => {
    const p = project(); roots.push(p.root);
    await p.call("open", { profile: "plan", request: "first" });
    const log = join(p.root, ".tenet", "log");
    const t = "2026-01-01T00:00:00.000Z";
    appendFileSync(log, Array.from({ length: 400 }, () => JSON.stringify({ t, kind: "call", verb: "check", exit: 0, revision: 1 }) + "\n").join(""));
    const small = withLimits(p, { compactAtBytes: 2_000 });
    const first = await call(small, "open", { profile: "plan", request: "second" });
    assert.equal(first.exit, 0, JSON.stringify(first));
    assert.match(JSON.stringify(first.effects), /older than 90 days/);
  });
});
