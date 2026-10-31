// Approved MC-2 contract: real processes, real locks and protected byte/mode snapshots.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, initState, tmp } from "./helpers.ts";
const roots: string[] = [];
const fresh = () => { const r = tmp(); roots.push(r); return r; };
after(() => { for (const root of roots) { if (existsSync(join(root, ".tenet"))) chmodSync(join(root, ".tenet"), 0o700); cleanup(root); } });
const fixture = join(import.meta.dirname, "fixtures/store-admission-barrier.ts");
const snapshot = (dir: string): unknown => readdirSync(dir).sort().filter(n => !n.startsWith("lock")).map(name => {
  const path = join(dir, name), st = lstatSync(path);
  return { name, mode: st.mode & 0o777, content: st.isFile() ? readFileSync(path).toString("hex") : snapshot(path) };
});
const broad = (dir: string) => {
  chmodSync(dir, 0o755);
  for (const name of ["marker", "state", "state.prev", "log"]) if (existsSync(join(dir, name))) chmodSync(join(dir, name), 0o644);
};
const run = (root: string, mode: string) => JSON.parse(execFileSync(process.execPath, [fixture, root, mode], { encoding: "utf8", timeout: 10_000 }));
const released = (dir: string) => assert.deepEqual(readdirSync(dir).filter(n => n.startsWith("lock") || n.startsWith("quarantine-bootstrap-")), []);

describe("lock-bound private store maintenance [CON-04, CON-05, SEC-12]", () => {
  for (const point of ["initial", "last"]) for (const fence of ["migration-transition.json", "migration-privacy.json"]) {
    it(`LA-1/2 preserves modes, bytes and missing ignore after ${point} admission and ${fence}`, { timeout: 15_000 }, async () => {
      const root = fresh(), dir = join(root, ".tenet"), store = await initState(root);
      await store.transaction("seed", async tx => tx.publish(tx.state!));
      const child = spawn(process.execPath, [fixture, root, point], { stdio: ["ignore", "pipe", "inherit"] });
      const exited = once(child, "exit");
      let output = "";
      child.stdout.on("data", chunk => { output += chunk; });
      try {
        await new Promise<void>((resolve, reject) => {
          child.stdout.once("data", () => resolve());
          child.once("error", reject);
          child.once("exit", () => reject(new Error(`barrier exited: ${output}`)));
        });
        assert.match(output, /paused/);
        // The cooperating publisher holds the actual transaction lock while installing its fence.
        await store.transaction("fence", async () => { writeFileSync(join(dir, fence), "{}"); broad(dir); rmSync(join(dir, ".gitignore"), { force: true }); });
        const before = { mode: lstatSync(dir).mode & 0o777, records: snapshot(dir) };
        writeFileSync(join(root, "resume"), "go");
        assert.equal((await exited)[0], 0);
        const result = JSON.parse(output.trim().split("\n").at(-1)!);
        assert.equal(result.code, "unsupported-record", output);
        assert.equal(result.callback, false);
        assert.deepEqual({ mode: lstatSync(dir).mode & 0o777, records: snapshot(dir) }, before);
        released(dir);
      } finally { if (child.exitCode === null) { child.kill("SIGKILL"); await exited; } }
    });
  }
  it("LA-3 refuses a post-claim fence before maintenance and releases only its own lock", async () => {
    const root = fresh(), store = await initState(root), dir = join(root, ".tenet");
    await store.transaction("seed", async tx => tx.publish(tx.state!));
    rmSync(join(dir, ".gitignore"));
    const records = snapshot(dir);
    assert.deepEqual(run(root, "post-claim"), { code: "unsupported-record", callback: false, injected: true, uid: process.geteuid!(), owner: lstatSync(dir).uid });
    assert.equal(lstatSync(dir).mode & 0o777, 0o755);
    for (const record of records as any[]) record.mode = 0o644;
    assert.deepEqual((snapshot(dir) as any[]).filter((r: any) => r.name !== "migration-transition.json"), records);
    released(dir);
  });
  it("LA-4 restores privacy before the callback and still publishes", async () => {
    const root = fresh(), store = await initState(root), dir = join(root, ".tenet");
    await store.transaction("seed", async tx => { tx.intent("example", "one", {}); tx.publish(tx.state!); });
    broad(dir); rmSync(join(dir, ".gitignore"));
    await store.transaction("test", async tx => {
      assert.equal(lstatSync(dir).mode & 0o777, 0o700);
      for (const n of ["marker", "state", "state.prev", "log"]) assert.equal(lstatSync(join(dir, n)).mode & 0o777, 0o600);
      assert.equal(readFileSync(join(dir, ".gitignore"), "utf8"), "*\n");
      tx.publish(tx.state!);
    });
    assert.equal(store.read()!.state.revision, 3);
  });
  for (const mode of ["chmod-failure", "ignore-failure"]) {
    it(`LA-5 releases after ${mode}, without tail repair/publication/callback, then retries`, async () => {
      const root = fresh(), store = await initState(root), dir = join(root, ".tenet");
      writeFileSync(join(dir, "log"), '{"kind":');
      rmSync(join(dir, ".gitignore"));
      const state = readFileSync(join(dir, "state"));
      const result = run(root, mode);
      assert.equal(result.code, "EIO"); assert.equal(result.callback, false);
      assert.equal(readFileSync(join(dir, "log"), "utf8"), '{"kind":');
      assert.deepEqual(readFileSync(join(dir, "state")), state);
      released(dir);
      await store.transaction("retry", async tx => tx.publish(tx.state!));
      assert.equal(store.read()!.state.revision, 2);
    });
  }
  for (const imported of [false, true]) {
    it(`LA-6 unprivileged ${imported ? "imported" : "owned"} unwritable store refuses without mutation`, async () => {
      const root = fresh(), dir = join(root, ".tenet");
      assert.notEqual(process.geteuid!(), 0, "criterion needs a genuine unprivileged owned fixture");
      if (imported) { mkdirSync(dir); writeFileSync(join(dir, "notes"), "keep imported bytes"); }
      else await initState(root);
      chmodSync(dir, 0o500);
      const before = snapshot(dir), result = run(root, imported ? "unwritable-import" : "unwritable");
      assert.equal(result.uid, result.owner);
      assert.equal(result.code, "EACCES"); assert.equal(result.callback, false);
      assert.equal(lstatSync(dir).mode & 0o777, 0o500);
      assert.deepEqual(snapshot(dir), before);
      released(dir);
    });
  }
  for (const fail of [false, true]) {
    it(`LA-7 ${fail ? "releases failed bootstrap chmod before any move" : "holds bootstrap lock and tightens permissions before the quarantine journal"}`, () => {
      const root = fresh(), dir = join(root, ".tenet");
      mkdirSync(dir); writeFileSync(join(dir, "notes"), "preserve imported bytes"); broad(dir);
      const before = snapshot(dir), result = run(root, fail ? "bootstrap-failure" : "bootstrap");
      assert.equal(result.callback, !fail);
      if (fail) {
        assert.equal(result.code, "EIO"); assert.equal(lstatSync(dir).mode & 0o777, 0o755);
        assert.deepEqual(snapshot(dir), before);
      } else assert.equal(result.injected, true);
      released(dir);
    });
  }
});
