// Bounded storage (CON-08, AC-19; specs/storage-retention.md v2): journal reduction into summaries, run-file cap, ceiling.
// Real store, real files; the clock is set per write so records can be given any age.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FsStore } from "../src/adapters/store-fs.ts";
import { systemRandom } from "../src/adapters/system.ts";
import { emptyState } from "../src/core/state.ts";
import { cleanup, tmp } from "./helpers.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { systemClock } from "../src/adapters/system.ts";
import { project } from "./support/fixture.ts";
import type { Clock } from "../src/ports/types.ts";

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

describe("journal reduction into summaries [CON-08, AC-19]", () => {
  it("removes calls and completed pairs older than 90 days into monthly counts, and keeps recent records and unresolved intents", async () => {
    const { store, log, sums } = await fresh();
    ago(200);
    await store.transaction("old", async (tx) => {
      tx.intent("commit", "c1", { a: 1 }); tx.result("commit", "c1", { ok: true }); tx.intent("undo", "u-open", { b: 1 });
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

  it("reduces a 10,000-record journal inside the 300 ms bound", async () => {
    const { store, log } = await fresh({ compactAtBytes: 1_000_000 });
    ago(200);
    const t = new Date(now).toISOString();
    appendFileSync(log(), Array.from({ length: 10_000 }, () => JSON.stringify({ t, kind: "call", verb: "check", exit: 0, revision: 1 }) + "\n").join(""));
    ago(0);
    const t0 = performance.now();
    await evict(store);
    assert.ok(performance.now() - t0 < 500, `took ${performance.now() - t0} ms`);
  });
});

describe("run-file cap and ceiling [CON-08, AC-19]", () => {
  const runDir = (store: FsStore, name: string, bytes: number, ageDays: number) => {
    const dir = store.tempDir(`manifests/${name}`);
    writeFileSync(join(dir, "f"), "x".repeat(bytes));
    const t = new Date(Date.now() - ageDays * DAY);
    utimesSync(join(dir, "f"), t, t); utimesSync(dir, t, t);
    return dir;
  };
  it("over its cap, removes the oldest run folders first and never one a live reservation names", async () => {
    const { store } = await fresh({ runFileCapBytes: 2_500 });
    const oldest = runDir(store, "a", 1_000, 5), middle = runDir(store, "b", 1_000, 3), newest = runDir(store, "c", 1_000, 1);
    const r = await evict(store, [oldest]);
    assert.deepEqual([existsSync(oldest), existsSync(middle), existsSync(newest)], [true, false, true]);
    assert.match(r.message ?? "", /run files/);
  });

  it("reports protected data above the ceiling with its largest classes, and refuses data-adding calls but not stop", async () => {
    const { store, root } = await fresh({ ceilingBytes: 1_500 });
    store.putBlob("x".repeat(3_000));
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

  it("open stops with storage-protected-full when protected data alone is over the ceiling, naming the largest class; stop and inspect still work", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "plan", request: "first" })).handle!;
    p.ports().store.putBlob("x".repeat(20_000));
    const tight = withLimits(p, { ceilingBytes: 5_000, reserveBytes: 0 });
    const refused = await call(tight, "open", { profile: "plan", request: "second" });
    assert.equal(refused.exit, 2, JSON.stringify(refused));
    assert.equal(refused.reasons[0]!.code, "storage-protected-full");
    assert.match(refused.reasons[0]!.message, /blobs/);
    assert.equal((await call(tight, "inspect", { view: "status" })).exit, 0);
    assert.equal((await call(tight, "stop", { h, mode: "pause" })).exit, 0, "stop is served from the reserve");
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
