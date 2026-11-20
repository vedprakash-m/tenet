import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { cleanup, initState, newStore, tmp } from "./helpers.ts";
import { BASIS, project, runCli } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const p = project(); roots.push(p.root); return p; };

describe("quarantine and a fresh start [CON-06, SEC-12]", () => {
  for (const schema of [0, 99]) it(`does not quarantine an owned marker with unsupported schema ${schema} [LFC-04]`, async () => {
    const p = fresh(); await p.call("open", { profile: "investigate", request: "original" });
    const marker = JSON.parse(readFileSync(join(p.root, ".tenet/marker"), "utf8"));
    writeFileSync(join(p.root, ".tenet/marker"), JSON.stringify({ ...marker, schema }));
    const before = readdirSync(join(p.root, ".tenet"));
    const r = await p.call("open", { profile: "investigate", request: "old kernel" });
    assert.equal(r.exit, 4, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === "unsupported-record"));
    assert.deepEqual(readdirSync(join(p.root, ".tenet")), before);
  });
  it("sets copied authority aside, offers a fresh start, and never restores it through review", async () => {
    const original = fresh(), copy = fresh();
    const old = await original.call("open", { profile: "feature", request: "untrusted imported request", lane: "quick" });
    await original.call("decide", { h: old.handle!, kind: "basis", propose: BASIS });
    await original.call("decide", { h: old.handle!, kind: "config", target: "style", propose: { value: "concise" } });
    cpSync(join(original.root, ".tenet"), join(copy.root, ".tenet"), { recursive: true });
    const prior = readFileSync(join(copy.root, ".tenet/state"), "utf8");
    const opened = await copy.call("open", { profile: "feature", request: "fresh request", lane: "quick" });
    assert.equal(opened.exit, 3, JSON.stringify(opened));
    assert.equal(opened.questions?.[0]?.id, "quarantine-review");
    assert.equal(opened.questions?.[0]?.channel, "chat");
    const state = copy.ports().store.read()!.state;
    const data = (opened.data as { quarantine: { path: string; entries: number } }).quarantine;
    assert.match(data.path, /^\.tenet\/quarantine-/);
    assert.equal(readFileSync(join(copy.root, data.path, "state"), "utf8"), prior);
    assert.notEqual(state.workspaceId, original.ports().store.read()!.state.workspaceId);
    assert.equal(Object.values(state.work).length, 1);
    assert.equal(Object.values(state.work)[0]!.request, "fresh request");
    assert.equal(Object.values(state.work)[0]!.basis, undefined);
    assert.deepEqual(state.config.local, {});
    assert.deepEqual(state.consents, []);
    assert.deepEqual(state.trust, []);
    assert.equal((await copy.call("decide", { h: old.handle!, kind: "basis", propose: BASIS })).reasons[0]?.code, "handle-unknown");
    const blocked = await copy.call("decide", { h: opened.handle!, kind: "basis", propose: BASIS });
    assert.equal(blocked.exit, 3);
    assert.ok(blocked.questions?.some(q => q.id === "quarantine-review"));
    const review = await copy.call("decide", { h: opened.handle!, kind: "adopt", target: "quarantine", answers: { "quarantine-review": "review" } });
    assert.equal(review.exit, 0, JSON.stringify(review));
    assert.deepEqual(copy.ports().store.read()!.state.config.local, {});
    assert.equal(Object.values(copy.ports().store.read()!.state.work)[0]!.basis, undefined);
    assert.equal(JSON.stringify(review).includes("untrusted imported request"), false);
    assert.equal(readFileSync(join(copy.root, data.path, "state"), "utf8"), prior);
  });

  it("quarantines markerless files and an imported live-looking lock without interpreting them", async () => {
    const p = fresh(); mkdirSync(join(p.root, ".tenet"));
    writeFileSync(join(p.root, ".tenet/state"), '{"commands":{"run":"do not execute"},"grant":"fake"}');
    writeFileSync(join(p.root, ".tenet/lock"), JSON.stringify({ pid: process.pid, procStart: "imported", nonce: "imported", verb: "imported" }));
    const r = await p.call("open", { profile: "investigate", request: "inspect safely" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    const kept = await p.call("decide", { h: r.handle!, kind: "adopt", target: "quarantine", answers: { "quarantine-review": "fresh" } });
    assert.equal(kept.exit, 0, JSON.stringify(kept));
    assert.equal(kept.next[0]?.action, "research");
    const state = p.ports().store.read()!.state;
    assert.equal(state.pending.some(q => q.id === "quarantine-review"), false);
    const quarantine = readdirSync(join(p.root, ".tenet")).find(n => n.startsWith("quarantine-"))!;
    assert.match(readFileSync(join(p.root, ".tenet", quarantine, "state"), "utf8"), /fake/);
    assert.ok(existsSync(join(p.root, ".tenet", quarantine, "lock")));
    assert.equal(readdirSync(join(p.root, ".tenet")).some(n => n.startsWith("quarantine-in-progress")), false);
  });

  it("preserves imported bootstrap-looking files instead of using them as its lock", async () => {
    const p = fresh(); mkdirSync(join(p.root, ".tenet"));
    writeFileSync(join(p.root, ".tenet/quarantine.lock"), "untrusted bootstrap-looking bytes");
    const opened = await p.call("open", { profile: "investigate", request: "fresh" });
    assert.equal(opened.exit, 3, JSON.stringify(opened)); assert.ok(opened.handle);
    const state = p.ports().store.read()!.state;
    assert.equal(readFileSync(join(p.root, ".tenet", state.quarantine!.path, "quarantine.lock"), "utf8"), "untrusted bootstrap-looking bytes");
  });

  it("does not quarantine or write during read-only inspection of copied state [CON-09]", async () => {
    const a = fresh(), b = fresh(); await a.call("open", { profile: "investigate", request: "original" });
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    const names = readdirSync(join(b.root, ".tenet"));
    const marker = readFileSync(join(b.root, ".tenet/marker"), "utf8");
    const r = await b.call("inspect", { view: "status" });
    assert.equal(r.reasons[0]?.code, "marker-mismatch");
    assert.deepEqual(readdirSync(join(b.root, ".tenet")), names);
    assert.equal(readFileSync(join(b.root, ".tenet/marker"), "utf8"), marker);
  });

  it("keeps the identity on a same-filesystem move [CON-11]", async () => {
    const a = tmp(), b = tmp(); roots.push(a, b);
    const store = await initState(a), id = store.read()!.state.workspaceId;
    renameSync(join(a, ".tenet"), join(b, ".tenet"));
    await newStore(b).transaction("open", async tx => { assert.equal(tx.state!.workspaceId, id); });
    assert.equal(newStore(b).read()!.state.workspaceId, id);
    assert.equal(readdirSync(join(b, ".tenet")).some(p => p.startsWith("quarantine-")), false);
  });

  for (const point of ["after-journal", "after-entry", "after-moves", "after-marker", "before-state", "after-state"]) it(`resumes after SIGKILL ${point} without losing entries or importing authority [CON-03]`, async () => {
    const a = fresh(), b = fresh(); await a.call("open", { profile: "investigate", request: "original" });
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    const prior = readFileSync(join(b.root, ".tenet/state"), "utf8");
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-quarantine.ts"), b.root, point], { stdio: ["ignore", "ignore", "inherit"] });
    assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL", point);
    const resumed = await b.call("open", { profile: "investigate", request: "fresh" });
    assert.equal(resumed.exit, 3, JSON.stringify(resumed));
    const state = b.ports().store.read()!.state;
    assert.equal(Object.values(state.work).length, 1);
    assert.equal(Object.values(state.work)[0]!.request, "fresh");
    assert.equal(readFileSync(join(b.root, ".tenet", state.quarantine!.path, "state"), "utf8"), prior);
    const retry = await b.call("open", { profile: "investigate", request: "fresh" });
    assert.equal(retry.handle, resumed.handle);
    assert.equal(readdirSync(join(b.root, ".tenet")).filter(n => /^quarantine-\d{4}/.test(n)).length, 1);
    const chosen = await b.call("decide", { h: resumed.handle!, kind: "adopt", target: "quarantine", answers: { "quarantine-review": "fresh" } });
    assert.equal(chosen.exit, 0, JSON.stringify(chosen));
  });

  it("serializes two fresh starts into one quarantine and one contract [CON-04]", async () => {
    const a = fresh(), b = fresh(); await a.call("open", { profile: "investigate", request: "original" });
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    const results = await Promise.all([runCli(b.root, ["open", "investigate", "--request", "fresh"]), runCli(b.root, ["open", "investigate", "--request", "fresh"])]);
    for (const r of results) assert.equal(r.code, 3, JSON.stringify(r));
    assert.equal(results[0]!.json?.handle, results[1]!.json?.handle);
    assert.equal(Object.values(b.ports().store.read()!.state.work).length, 1);
    assert.equal(readdirSync(join(b.root, ".tenet")).filter(n => /^quarantine-\d{4}/.test(n)).length, 1);
  });

  it("sets a previously quarantined workspace aside again when it is copied", async () => {
    const a = fresh(), b = fresh(), c = fresh(); await a.call("open", { profile: "investigate", request: "original" });
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    const bOpen = await b.call("open", { profile: "investigate", request: "first copy" });
    await b.call("decide", { h: bOpen.handle!, kind: "adopt", target: "quarantine", answers: { "quarantine-review": "fresh" } });
    cpSync(join(b.root, ".tenet"), join(c.root, ".tenet"), { recursive: true });
    const r = await c.call("open", { profile: "investigate", request: "second copy" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.ok(r.handle);
    assert.equal(Object.values(c.ports().store.read()!.state.work).length, 1);
    assert.equal(Object.values(c.ports().store.read()!.state.work)[0]!.request, "second copy");
  });

  it("allows confirmed abandonment while the imported-record question is pending", async () => {
    const a = fresh(), b = fresh(); await a.call("open", { profile: "investigate", request: "original" });
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    const opened = await b.call("open", { profile: "investigate", request: "fresh" });
    assert.equal((await b.call("stop", { h: opened.handle!, mode: "abandon" })).questions?.[0]?.id, "abandon-confirm");
    const r = await b.call("decide", { h: opened.handle!, kind: "abandon-confirm", answers: { "abandon-confirm": "abandon" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(Object.values(b.ports().store.read()!.state.work)[0]!.state, "cancelled");
  });

  it("refuses a changed source after a partial move without overwriting either copy [CON-03]", async () => {
    const a = fresh(), b = fresh(); await a.call("open", { profile: "investigate", request: "original" });
    cpSync(join(a.root, ".tenet"), join(b.root, ".tenet"), { recursive: true });
    const prior = readFileSync(join(b.root, ".tenet/state"), "utf8");
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-quarantine.ts"), b.root, "after-entry"], { stdio: "ignore" });
    await new Promise(resolve => child.on("exit", resolve));
    writeFileSync(join(b.root, ".tenet/state"), "a newer external file");
    const r = await b.call("open", { profile: "investigate", request: "fresh" });
    assert.equal(r.exit, 3, JSON.stringify(r)); assert.equal(r.handle, undefined);
    assert.equal(readFileSync(join(b.root, ".tenet/state"), "utf8"), "a newer external file");
    const folder = readdirSync(join(b.root, ".tenet")).find(n => /^quarantine-\d{4}/.test(n))!;
    assert.equal(readFileSync(join(b.root, ".tenet", folder, "state"), "utf8"), prior);
  });

  it("refuses linked imported entries and malformed/traversing journals before outside writes [SEC-06]", async () => {
    const p = fresh(), outside = fresh(); mkdirSync(join(p.root, ".tenet"));
    symlinkSync(join(outside.root, "private"), join(p.root, ".tenet/state"));
    const linked = await p.call("open", { profile: "investigate", request: "fresh" });
    assert.equal(linked.exit, 3); assert.equal(linked.handle, undefined);
    assert.equal(existsSync(join(outside.root, "private")), false);
    const q = fresh(); mkdirSync(join(q.root, ".tenet"));
    writeFileSync(join(q.root, ".tenet/quarantine-in-progress-aaaaaaaaaaaa"), JSON.stringify({ path: "../../outside", marker: { dev: 1, ino: 1 } }));
    const bad = await q.call("open", { profile: "investigate", request: "fresh" });
    assert.equal(bad.exit, 3); assert.equal(bad.handle, undefined);
    assert.equal(existsSync(join(q.root, ".tenet/marker")), false);
  });
});
