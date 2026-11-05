// The 1 -> 2 file protocol with real processes (schema-migration 16.5, 16.6, 16.8 M1, M4, M5, M6). Candidate only. It runs on a plain
// `.tenet`
// directory because FsStore, its lock and its POSIX admission are not called by the candidate and the mutating verbs refuse win32; the
// paired
// bridge/target competition, the waiting-writer race and directory fsync are therefore unobserved here (see the plan entry).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { acceptRollback, acceptUpgrade, forfeitRollback, previewRollback, previewUpgrade, resume,
  terminalMatches } from "../src/adapters/migration-fs.ts";
import { decodeState2 } from "../src/core/schemas-legacy.ts";
import { sha256 } from "../src/core/ids.ts";
import { journal1 } from "./support/schema1-fixtures.ts";
import { markerText, OPERATION, ROLLBACK, SEED, builds, ctx, seed, snapshot } from "./support/migration-ctx.ts";
import { tmp } from "./helpers.ts";

const fixture = join(import.meta.dirname, "fixtures/crash-migration.ts");
const fresh = (o?: Parameters<typeof seed>[1]) => { const d = tmp("tenet-mig-"); seed(d, o); return d; };
const yes = (dir: string) => ({ answer: "yes", factsHash: (previewUpgrade(dir, builds,
  ctx.registryVersion) as { factsHash: string }).factsHash });
const upgrade = (dir: string, steps?: string[]) => acceptUpgrade({ dir, id: OPERATION, builds, ctx, answer: yes(dir) },
  { at: (s) => { steps?.push(s); } });
const rollback = (dir: string, steps?: string[]) => {
  const p = previewRollback(dir);
  assert.equal(p.eligible, true, JSON.stringify(p));
  return acceptRollback({ dir, id: ROLLBACK, ctx, answer: { answer: "yes", factsHash: (p as { factsHash: string }).factsHash } },
    { at: (s) => { steps?.push(s); } });
};
const killed = (dir: string, mode: string, at: number) => spawnSync(process.execPath, [fixture, dir, mode, String(at)],
  { encoding: "utf8" });
const comparableSnapshot = (dir: string) => {
  const files = snapshot(dir);
  for (const [path, text] of Object.entries(files)) {
    if (path.endsWith("/marker") || path === "marker") {
      const marker = JSON.parse(text);
      marker.dev = 0;
      marker.ino = 0;
      files[path] = JSON.stringify(marker);
    } else if (path === "migration-transition.json") {
      const descriptor = JSON.parse(text);
      descriptor.factsHash = "<binding>";
      descriptor.plan.marker = { from: "<marker>", to: "<marker>" };
      if (descriptor.terminal) descriptor.terminal.bindingDigest = "<binding>";
      files[path] = JSON.stringify(descriptor) + "\n";
    } else if (path === "migration-terminal.json") {
      const terminal = JSON.parse(text);
      terminal.bindingDigest = "<binding>";
      files[path] = JSON.stringify(terminal) + "\n";
    }
  }
  return files;
};

describe("preview and consent write nothing", () => {
  it("leaves every byte and name unchanged for a preview, a decline, a stale hash and a missing answer", () => {
    const dir = fresh();
    const before = snapshot(dir);
    const p = previewUpgrade(dir, builds, ctx.registryVersion);
    assert.ok(p.ok);
    assert.deepEqual(p.revisions, { primary: 9, previous: 8 });
    assert.deepEqual(p.blockers, []);
    for (const answer of [{ answer: "no", factsHash: p.factsHash }, { answer: "yes", factsHash: "0".repeat(64) },
      { factsHash: p.factsHash }, {}]) {
      const r = acceptUpgrade({ dir, id: OPERATION, builds, ctx, answer });
      assert.equal(r.ok, false);
    }
    assert.deepEqual(snapshot(dir), before);
  });
  it("invalidates consent when a source changes after the preview", () => {
    const dir = fresh();
    const answer = yes(dir);
    writeFileSync(join(dir, "log"), SEED.log + "\n");
    const r = acceptUpgrade({ dir, id: OPERATION, builds, ctx, answer });
    assert.equal(r.ok, false);
    assert.ok(!existsSync(join(dir, "migration-transition.json")));
  });
  it("refuses unreadable sources without writing: unknown key, unresolved intent, torn tail, nonempty archive", () => {
    const edit = (f: (d: string) => void) => { const d = fresh(); f(d); const before = snapshot(d); const p = previewUpgrade(d,
      builds, ctx.registryVersion); assert.equal(p.ok, false); assert.deepEqual(snapshot(d), before); };
    edit((d) => { const s = JSON.parse(SEED.state); s.work.wk_1.git.surprise = 1; writeFileSync(join(d, "state"), JSON.stringify(s)); });
    edit((d) => { writeFileSync(join(d, "state.prev"), JSON.stringify({ ...JSON.parse(SEED.prev), surprise: 1 })); });
    edit((d) => { writeFileSync(join(d, "log"), SEED.log.slice(0, -1)); });
    edit((d) => { const s = JSON.parse(SEED.state); s.archive = [{ id: "a", label: "l", endpoint: "checked-local",
      blob: "a".repeat(64), finishedAt: "t" }]; writeFileSync(join(d, "state"), JSON.stringify(s)); });
  });
  it("refuses a missing primary and a migration already recorded", () => {
    const dir = fresh();
    rmSync(join(dir, "state"));
    assert.equal(previewUpgrade(dir, builds, ctx.registryVersion).ok, false);
    const other = fresh();
    assert.ok(upgrade(other).ok);
    assert.equal(previewUpgrade(other, builds, ctx.registryVersion).ok, false);
  });
  it("refuses unsupported markers, malformed JSON, and references it cannot preserve", () => {
    const unsupported = fresh();
    writeFileSync(join(unsupported, "marker"), markerText(unsupported, 3));
    assert.equal(previewUpgrade(unsupported, builds, ctx.registryVersion).ok, false);

    const malformedState = fresh();
    writeFileSync(join(malformedState, "state"), "{");
    assert.equal(previewUpgrade(malformedState, builds, ctx.registryVersion).ok, false);

    const referenced = fresh();
    writeFileSync(join(referenced, "log"), journal1());
    assert.equal(previewUpgrade(referenced, builds, ctx.registryVersion).ok, false);
  });
  it("does not follow a linked marker", (t) => {
    const dir = fresh();
    const marker = join(dir, "marker");
    const outside = join(dir, "outside-marker");
    writeFileSync(outside, SEED.marker);
    rmSync(marker);
    try { symlinkSync(outside, marker); } catch { t.skip("symbolic links are unavailable on this host"); return; }
    const before = readFileSync(outside, "utf8");
    assert.equal(previewUpgrade(dir, builds, ctx.registryVersion).ok, false);
    assert.equal(readFileSync(outside, "utf8"), before);
  });
  it("refuses a linked staging destination without changing its target", (t) => {
    const dir = fresh();
    const outside = join(dir, "outside-state");
    const target = join(dir, `migration-1-2-${OPERATION}`, "target");
    writeFileSync(outside, "preserve");
    mkdirSync(target, { recursive: true });
    try { symlinkSync(outside, join(target, "state")); } catch { t.skip("symbolic links are unavailable on this host"); return; }
    const result = acceptUpgrade({ dir, id: OPERATION, builds, ctx, answer: yes(dir) });
    assert.equal(result.ok, false);
    assert.equal(readFileSync(outside, "utf8"), "preserve");
  });
  it("does not resume a transition copied to another store identity", () => {
    const dir = fresh();
    assert.throws(() => acceptUpgrade({ dir, id: OPERATION, builds, ctx, answer: yes(dir) }, {
      at: (step) => { if (step === "fenced") throw new Error("stop after the fence"); },
    }), /stop after the fence/);
    const copied = tmp("tenet-mig-copy-");
    cpSync(dir, copied, { recursive: true });
    const before = snapshot(copied);
    assert.equal(resume(copied, ctx).ok, false);
    assert.deepEqual(snapshot(copied), before);
  });
});

describe("upgrade", () => {
  it("installs previous, primary and the marker last, keeps the log and summaries byte-exact, and keeps an independent source copy", () => {
    const dir = fresh({ summaries: '{"version":1,"from":"x","months":{}}' });
    const steps: string[] = [];
    const r = upgrade(dir, steps);
    assert.deepEqual(r, { ok: true, phase: "applied" });
    const order = steps.filter((s) => s.startsWith("after-rename:state") || s === "after-rename:marker");
    assert.deepEqual(order, ["after-rename:state.prev", "after-rename:state", "after-rename:marker"]);
    assert.equal(readFileSync(join(dir, "log"), "utf8"), SEED.log);
    assert.equal(readFileSync(join(dir, "summaries.json"), "utf8"), '{"version":1,"from":"x","months":{}}');
    const primary = decodeState2(JSON.parse(readFileSync(join(dir, "state"), "utf8")));
    const previous = decodeState2(JSON.parse(readFileSync(join(dir, "state.prev"), "utf8")));
    assert.ok(primary.ok && previous.ok);
    assert.equal(primary.value.revision, 9);
    assert.equal(previous.value.revision, 8);
    assert.equal(JSON.parse(readFileSync(join(dir, "marker"), "utf8")).schema, 2);
    const home = join(dir, `migration-1-2-${OPERATION}`);
    assert.equal(readFileSync(join(home, "state"), "utf8"), SEED.state);
    assert.equal(readFileSync(join(home, "state.prev"), "utf8"), SEED.prev);
    assert.equal(readFileSync(join(home, "marker"), "utf8"), markerText(dir));
    assert.equal(readFileSync(join(home, "log"), "utf8"), SEED.log);
    const d = JSON.parse(readFileSync(join(dir, "migration-transition.json"), "utf8"));
    assert.equal(d.phase, "applied");
    assert.deepEqual(Object.keys(d.terminal).sort(), ["bindingDigest", "operationId", "outcome", "protocolVersion", "versions"]);
  });
  it("never creates a previous the source did not have", () => {
    const dir = fresh({ previous: false });
    assert.ok(upgrade(dir).ok);
    assert.equal(existsSync(join(dir, "state.prev")), false);
  });
  it("repeats the same result for a retried acknowledgment and changes no byte", () => {
    const dir = fresh();
    upgrade(dir);
    const after = snapshot(dir);
    assert.deepEqual(resume(dir, ctx), { ok: true, phase: "applied" });
    assert.deepEqual(snapshot(dir), after);
  });
  it("refuses a tuple outside the recorded prefixes and writes nothing", () => {
    const dir = fresh();
    const steps: string[] = [];
    upgrade(fresh(), steps);
    const at = steps.indexOf("after-rename:state.prev") + 1;
    assert.ok(killed(dir, "upgrade", at).status !== 0);
    writeFileSync(join(dir, "marker"), readFileSync(join(dir, `migration-1-2-${OPERATION}`, "target", "marker"), "utf8")); // marker 2 beside primary 1
    const before = snapshot(dir);
    const r = resume(dir, ctx);
    assert.equal(r.ok, false);
    assert.deepEqual(snapshot(dir), before);
  });
});

describe("real SIGKILL at every durable step of the upgrade [M4]", () => {
  const steps: string[] = [];
  const reference = fresh();
  upgrade(reference, steps);
  const final = comparableSnapshot(reference);
  it("has a nontrivial step list", () => assert.ok(steps.length >= 25, String(steps.length)));
  for (let at = 1; at <= steps.length; at++) {
    it(`killed at step ${at} (${steps[at - 1]}): recovers to the same bytes after two restarts`, () => {
      const dir = fresh();
      const run = killed(dir, "upgrade", at);
      assert.notEqual(run.status, 0, run.stdout);
      let r = resume(dir, ctx);
      if (!r.ok) { // nothing was fenced yet: the original set is intact and a new preview and consent start over
        assert.ok(!existsSync(join(dir, "migration-transition.json")));
        assert.equal(readFileSync(join(dir, "state"), "utf8"), SEED.state);
        r = upgrade(dir);
      }
      assert.deepEqual(r, { ok: true, phase: "applied" });
      const settled = comparableSnapshot(dir);
      assert.deepEqual(resume(dir, ctx), { ok: true, phase: "applied" });
      assert.deepEqual(comparableSnapshot(dir), settled);
      assert.deepEqual(settled, final);
    });
  }
});

describe("rollback", () => {
  it("restores the exact source bytes, removes upgrade-created objects, keeps the copy and leaves only a terminal record", () => {
    const dir = fresh();
    upgrade(dir);
    assert.deepEqual(rollback(dir), { ok: true, phase: "rolled-back" });
    for (const [n, text] of [["marker", markerText(dir)], ["state", SEED.state], ["state.prev", SEED.prev], ["log",
      SEED.log]] as const) assert.equal(readFileSync(join(dir, n), "utf8"), text, n);
    assert.equal(existsSync(join(dir, "migration-transition.json")), false);
    assert.equal(existsSync(join(dir, `migration-1-2-${OPERATION}`, "target")), false);
    assert.equal(readFileSync(join(dir, `migration-1-2-${OPERATION}`, "state"), "utf8"), SEED.state);
    const t = JSON.parse(readFileSync(join(dir, "migration-terminal.json"), "utf8"));
    assert.equal(t.outcome, "rolled-back");
    assert.deepEqual(t.versions, { from: 2, to: 1 });
    assert.equal(terminalMatches(dir, t), true);
    assert.equal(terminalMatches(dir, { ...t, operationId: "3".repeat(32) }), false);
  });
  it("is refused after a later action forfeits it, after the floor moves, and when a live file changed", () => {
    const forfeited = fresh();
    upgrade(forfeited);
    forfeitRollback(forfeited);
    const f = previewRollback(forfeited);
    assert.equal(f.eligible, false);
    assert.equal(acceptRollback({ dir: forfeited, id: ROLLBACK, ctx, answer: { answer: "yes", factsHash: "0".repeat(64) } }).ok, false);

    const moved = fresh();
    upgrade(moved);
    const s = JSON.parse(readFileSync(join(moved, "state"), "utf8"));
    s.recovery.jobSeq = 1;
    writeFileSync(join(moved, "state"), JSON.stringify(s));
    assert.equal(previewRollback(moved).eligible, false);

    const changed = fresh();
    upgrade(changed);
    writeFileSync(join(changed, "log"), SEED.log + SEED.log.split("\n")[0] + "\n");
    assert.equal(previewRollback(changed).eligible, false);
  });
  it("refuses a rollback whose source copy was damaged", () => {
    const dir = fresh();
    upgrade(dir);
    writeFileSync(join(dir, `migration-1-2-${OPERATION}`, "state"), SEED.state + " ");
    assert.equal(previewRollback(dir).eligible, false);
  });
  it("refuses malformed live JSON and linked staged files without following either", (t) => {
    const malformed = fresh();
    upgrade(malformed);
    writeFileSync(join(malformed, "state"), "{");
    assert.equal(previewRollback(malformed).eligible, false);

    const linked = fresh();
    upgrade(linked);
    const targetState = join(linked, `migration-1-2-${OPERATION}`, "target", "state");
    const outside = join(linked, "outside-state");
    writeFileSync(outside, readFileSync(targetState, "utf8"));
    rmSync(targetState);
    try { symlinkSync(outside, targetState); } catch { t.skip("symbolic links are unavailable on this host"); return; }
    const before = readFileSync(outside, "utf8");
    assert.equal(previewRollback(linked).eligible, false);
    assert.equal(readFileSync(outside, "utf8"), before);
  });
  it("refuses rollback when the target contains an unlisted file", () => {
    const dir = fresh();
    upgrade(dir);
    const target = join(dir, `migration-1-2-${OPERATION}`, "target");
    writeFileSync(join(target, "unlisted"), "not part of the migration");
    const before = snapshot(dir);
    assert.equal(previewRollback(dir).eligible, false);
    assert.equal(acceptRollback({ dir, id: ROLLBACK, ctx, answer: { answer: "yes", factsHash: "0".repeat(64) } }).ok, false);
    assert.deepEqual(snapshot(dir), before);
  });
  it("does not recursively delete an entry added after rollback consent", () => {
    const dir = fresh();
    upgrade(dir);
    const target = join(dir, `migration-1-2-${OPERATION}`, "target");
    const p = previewRollback(dir);
    assert.equal(p.eligible, true);
    const answer = { answer: "yes", factsHash: (p as { factsHash: string }).factsHash };
    const result = acceptRollback({ dir, id: ROLLBACK, ctx, answer }, {
      at: (step) => { if (step === "rollback-fenced") writeFileSync(join(target, "raced-entry"), "preserve"); },
    });
    assert.equal(result.ok, false);
    assert.equal(readFileSync(join(target, "raced-entry"), "utf8"), "preserve");
  });
  it("allows a new upgrade only through a new preview, consent and id after a rollback", () => {
    const dir = fresh();
    upgrade(dir);
    rollback(dir);
    const again = acceptUpgrade({ dir, id: "4".repeat(32), builds, ctx, answer: yes(dir) });
    assert.deepEqual(again, { ok: true, phase: "applied" });
  });
});

describe("real SIGKILL at every durable step of the rollback [M4, M6]", () => {
  const steps: string[] = [];
  const base = fresh();
  upgrade(base);
  const reference = fresh();
  upgrade(reference);
  rollback(reference, steps);
  const final = comparableSnapshot(reference);
  it("has a nontrivial step list", () => assert.ok(steps.length >= 8, String(steps.length)));
  for (let at = 1; at <= steps.length; at++) {
    it(`killed at step ${at} (${steps[at - 1]}): recovers to the same bytes after two restarts`, () => {
      const dir = fresh();
      upgrade(dir);
      assert.deepEqual(comparableSnapshot(dir), comparableSnapshot(base));
      assert.notEqual(killed(dir, "rollback", at).status, 0);
      let r = resume(dir, ctx);
      if (r.ok && r.phase === "applied") r = rollback(dir); // killed before the rollback fence: still upgraded, consent starts over
      assert.deepEqual(r, { ok: true, phase: "rolled-back" });
      const settled = comparableSnapshot(dir);
      assert.deepEqual(resume(dir, ctx), { ok: true, phase: "rolled-back" }); // a retried acknowledgment reads the terminal record
      assert.deepEqual(comparableSnapshot(dir), settled);
      assert.deepEqual(settled, final);
    });
  }
  it("keeps the source copy intact whatever the kill point", () => assert.equal(sha256(final[`migration-1-2-${OPERATION}/state`]!), sha256(SEED.state)));
});
