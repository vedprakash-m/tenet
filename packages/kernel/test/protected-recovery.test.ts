import assert from "node:assert/strict";
import fs, { existsSync, fstatSync, readFileSync, utimesSync } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { join } from "node:path";
import { it, type TestContext } from "node:test";
import { FsStore } from "../src/adapters/store-fs.ts";
import { systemRandom } from "../src/adapters/system.ts";
import { sha256 } from "../src/core/ids.ts";
import { emptyState } from "../src/core/state.ts";
import { recover } from "../src/verbs/recover.ts";
import { configurePolicy } from "../src/verbs/reconcile.ts";
import { cleanup } from "./helpers.ts";
import { contractFixture, project } from "./support/fixture.ts";

const DAY = 86_400_000;
const limits = { compactAtBytes: 1, ceilingBytes: 10_000_000, reserveBytes: 0, runFileCapBytes: 1_500 };

async function fixture(t: TestContext) {
  // Windows cannot qualify directory durability; supported POSIX runs use real fsync unchanged.
  if (process.platform === "win32") {
    const fsync = fs.fsyncSync;
    t.mock.method(fs, "fsyncSync", (fd: number) => { if (!fstatSync(fd).isDirectory()) fsync(fd); });
    syncBuiltinESMExports();
    t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  }
  const p = project();
  t.after(() => cleanup(p.root));
  let now = Date.parse("2026-01-01T00:00:00Z");
  const clock = { now: () => new Date(now).toISOString(), ms: () => now };
  const store = (runFileCapBytes = limits.runFileCapBytes) => {
    const value = new FsStore(p.root, clock, systemRandom, { ...limits, runFileCapBytes });
    if (process.platform === "win32") value.self = () => ({ pid: process.pid, procStart: "synthetic" });
    return value;
  };
  const initial = store();
  await initial.transaction("seed", async tx => {
    const identity = tx.ensure(), work = contractFixture();
    tx.publish({ ...emptyState(identity.workspaceId, identity.tag), work: { [work.id]: work } });
  });
  const tempRoot = initial.retentionScope().path;
  t.after(() => cleanup(tempRoot));
  return { p, store, later: () => { now += 400 * DAY; } };
}

for (const reversed of [false, true]) {
  for (const kind of ["no-read", "no-edit", "no-routine-scan"] as const) {
    it(`preflights the entire mixed scaffold before reading or rolling back (${kind}, reversed=${reversed}) [AC-16, AC-17, AC-25]`, async t => {
      const { p, store, later } = await fixture(t);
      p.write("allowed.txt", "confirmed partial effect\n");
      p.write("PRIVATE/file", "protected fixture\n");
      p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "private/**", kinds: [kind] }] }));
      const paths = ["allowed.txt", "PRIVATE/file", "missing.txt"];
      if (reversed) paths.reverse();
      const expected = Object.fromEntries(paths.map(path => [path, sha256(path === "allowed.txt"
        ? "confirmed partial effect\n" : path === "PRIVATE/file" ? "protected fixture\n" : "not written\n")]));
      let seed = store(10_000);
      const runDir = seed.tempDir("mixed-recovery");
      const proof = '{"confirmed":"allowed.txt"}'.padEnd(2_000, " ");
      await seed.transaction("partial-effect", async tx => {
        seed.writeArtifact(runDir, "run.json", proof);
        tx.intent("branch", "confirmed-step", { work: "W1", from: null, to: null, runDir });
        tx.result("branch", "confirmed-step", { completed: true });
        tx.intent("scaffold", "mixed", { work: "W1", expected, runDir });
        for (let i = 0; i < 105; i++) tx.call({ verb: "inspect", exit: 0, revision: 0 });
      });
      const protectedLines = () => readFileSync(join(p.root, ".tenet", "log"), "utf8").split("\n")
        .filter(line => /"id":"(?:mixed|confirmed-step)"/.test(line));
      const original = protectedLines();
      assert.equal(original.length, 3);
      const restricted = readFileSync(join(p.root, "PRIVATE", "file"));
      later();
      for (let restart = 0; restart < 2; restart++) {
        seed = store();
        const ports = { ...p.ports(), store: seed };
        let reads = 0, removals = 0;
        const hashes = ports.project.hashes.bind(ports.project);
        ports.project.hashes = (...args) => { reads++; return hashes(...args); };
        const remove = ports.project.remove.bind(ports.project);
        ports.project.remove = paths => { removals++; return remove(paths); };
        await seed.transaction("recover", async tx => {
          configurePolicy(ports, tx.state);
          const result = await recover(ports, tx, tx.state!);
          assert.ok(result.uncertain.length);
          assert.equal(reads, 0, "no earlier allowed path is read before full-set admission");
          assert.equal(removals, 0, "no part of the rollback starts");
          assert.ok(tx.unresolved().some(entry => entry.id === "mixed"));
        });
        const old = new Date(Date.now() - 3 * DAY);
        utimesSync(join(runDir, "run.json"), old, old); utimesSync(runDir, old, old);
        // Cleanup is intentionally invoked without a caller-supplied keep list.
        await seed.transaction("cleanup", async tx => { tx.evict([]); seed.sweepTemp(DAY, []); });
        assert.deepEqual(protectedLines(), original, "intent and confirmed-result bytes survive compaction/restarts");
        assert.equal(readFileSync(join(runDir, "run.json"), "utf8"), proof);
        assert.equal(readFileSync(join(p.root, "allowed.txt"), "utf8"), "confirmed partial effect\n");
        assert.deepEqual(readFileSync(join(p.root, "PRIVATE", "file")), restricted);
        assert.equal(existsSync(join(p.root, "missing.txt")), false);
      }
    });
  }
}

it("revalidates the whole scaffold before rollback after a policy change during observation [AC-16, AC-25]", async t => {
  const { p, store } = await fixture(t);
  p.write("allowed.txt", "partial\n");
  const ports = { ...p.ports(), store: store() };
  const hashes = ports.project.hashes.bind(ports.project);
  ports.project.hashes = (...args) => {
    const observed = hashes(...args);
    p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "allowed.txt", kinds: ["no-edit"] }] }));
    return observed;
  };
  await ports.store.transaction("recover-tightening", async tx => {
    tx.intent("scaffold", "tightened", {
      work: "W1", expected: { "allowed.txt": sha256("partial\n"), "missing.txt": sha256("missing\n") },
    });
    configurePolicy(ports, tx.state);
    const recovered = await recover(ports, tx, tx.state!);
    assert.ok(recovered.uncertain.length);
    assert.ok(tx.unresolved().some(entry => entry.id === "tightened"));
  });
  assert.equal(readFileSync(join(p.root, "allowed.txt"), "utf8"), "partial\n");
});

for (const kind of ["no-read", "no-edit", "no-routine-scan"] as const) {
  it(`preflights every undo path before inventory, patch reads or effects (${kind}) [AC-16, AC-25]`, async t => {
    const { p, store } = await fixture(t);
    p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "private/**", kinds: [kind] }] }));
    const ports = { ...p.ports(), store: store() };
    const calls: string[] = [];
    ports.git.inventory = async () => { calls.push("inventory"); throw new Error("forbidden inventory"); };
    ports.store.readBlob = () => { calls.push("patch"); throw new Error("forbidden patch read"); };
    ports.git.applyPatch = async () => { calls.push("apply"); throw new Error("forbidden effect"); };
    await ports.store.transaction("recover-undo", async tx => {
      tx.intent("undo", "mixed", {
        work: "W1", paths: ["allowed.txt", "PRIVATE/file"], pre: { "allowed.txt": null, "PRIVATE/file": null },
        post: { "allowed.txt": "a".repeat(40), "PRIVATE/file": "b".repeat(40) }, patch: "fixture",
      });
      configurePolicy(ports, tx.state);
      assert.ok((await recover(ports, tx, tx.state!)).uncertain.length);
      assert.ok(tx.unresolved().some(entry => entry.id === "mixed"));
    });
    assert.deepEqual(calls, []);
  });
}

it("keeps an unresolved run and its completed dependent pair without a caller keep list [AC-17, AC-25]", async t => {
  const { p, store, later } = await fixture(t);
  const seed = store(10_000), runDir = seed.tempDir("protected-run"), proof = "retained partial-effect proof".padEnd(2_000, " ");
  await seed.transaction("partial", async tx => {
    seed.writeArtifact(runDir, "run.json", proof);
    tx.intent("branch", "done", { work: "W1", to: null, runDir });
    tx.result("branch", "done", { completed: true });
    tx.intent("scaffold", "pending", { work: "W1", expected: { "private/file": sha256("private") }, runDir });
    for (let i = 0; i < 105; i++) tx.call({ verb: "inspect", exit: 0, revision: 0 });
  });
  const lines = () => readFileSync(join(p.root, ".tenet", "log"), "utf8").split("\n")
    .filter(line => /"id":"(?:done|pending)"/.test(line));
  const original = lines();
  later();
  const old = new Date(Date.now() - 3 * DAY);
  utimesSync(join(runDir, "run.json"), old, old); utimesSync(runDir, old, old);
  const restarted = store();
  await restarted.transaction("cleanup", async tx => { tx.evict([]); restarted.sweepTemp(DAY, []); });
  assert.deepEqual(lines(), original);
  assert.equal(readFileSync(join(runDir, "run.json"), "utf8"), proof);
});

it("leaves a malformed affected set unresolved rather than proving an empty operation [AC-16, AC-25]", async t => {
  const { p, store } = await fixture(t), ports = { ...p.ports(), store: store() };
  await ports.store.transaction("recover-malformed", async tx => {
    tx.intent("scaffold", "empty", { work: "W1", expected: {} });
    tx.intent("undo", "incomplete", { work: "W1", paths: ["allowed.txt"], pre: {}, post: {}, patch: "fixture" });
    configurePolicy(ports, tx.state);
    const recovered = await recover(ports, tx, tx.state!);
    assert.equal(recovered.uncertain.length, 2);
    assert.equal(tx.unresolved().length, 2);
  });
});

it("still reconciles permitted partial scaffolds and an already-applied undo [AC-16, AC-25]", async t => {
  const { p, store } = await fixture(t), ports = { ...p.ports(), store: store() };
  p.write("partial.txt", "partial\n");
  const path = "src/greet.ts", blob = p.git("hash-object", path);
  await ports.store.transaction("recover-permitted", async tx => {
    tx.intent("scaffold", "partial", {
      work: "W1", expected: { "partial.txt": sha256("partial\n"), "missing.txt": sha256("missing\n") },
    });
    tx.intent("undo", "applied", { work: "W1", paths: [path], pre: { [path]: null }, post: { [path]: blob }, patch: "unused" });
    configurePolicy(ports, tx.state);
    const recovered = await recover(ports, tx, tx.state!);
    assert.deepEqual(recovered.uncertain, []);
    assert.equal(tx.unresolved().length, 0);
    assert.ok(tx.recent().some(entry => entry.kind === "result" && entry.id === "partial"
      && (entry.outcome as { completed: boolean }).completed === false));
    assert.ok(tx.recent().some(entry => entry.kind === "result" && entry.id === "applied"
      && (entry.outcome as { completed: boolean }).completed === true));
  });
  assert.equal(existsSync(join(p.root, "partial.txt")), false);
  assert.equal(p.git("hash-object", path), blob);
});

it("reconciles a literal __proto__ scaffold path without losing its observed hash [AC-16, AC-25]", async t => {
  const { p, store } = await fixture(t), ports = { ...p.ports(), store: store() };
  p.write("__proto__", "partial\n");
  await ports.store.transaction("recover-literal-path", async tx => {
    tx.intent("scaffold", "literal", {
      work: "W1", expected: Object.fromEntries([["__proto__", sha256("partial\n")], ["missing.txt", sha256("missing\n")]]),
    });
    configurePolicy(ports, tx.state);
    assert.deepEqual((await recover(ports, tx, tx.state!)).uncertain, []);
    assert.equal(tx.unresolved().length, 0);
  });
  assert.equal(existsSync(join(p.root, "__proto__")), false);
});

it("revalidates undo before opening its patch after inventory tightens policy [AC-16, AC-25]", async t => {
  const { p, store } = await fixture(t), ports = { ...p.ports(), store: store() };
  const path = "src/greet.ts", blob = p.git("hash-object", path), inventory = ports.git.inventory.bind(ports.git);
  ports.git.inventory = async (...args) => {
    const here = await inventory(...args);
    p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: path, kinds: ["no-edit"] }] }));
    return here;
  };
  let patchReads = 0;
  ports.store.readBlob = () => { patchReads++; throw new Error("forbidden patch read"); };
  await ports.store.transaction("recover-undo-tightening", async tx => {
    tx.intent("undo", "tightened", {
      work: "W1", paths: [path], pre: { [path]: blob }, post: { [path]: "a".repeat(40) }, patch: "fixture",
    });
    configurePolicy(ports, tx.state);
    assert.ok((await recover(ports, tx, tx.state!)).uncertain.length);
    assert.equal(tx.unresolved().length, 1);
  });
  assert.equal(patchReads, 0);
  assert.equal(p.git("hash-object", path), blob);
});
