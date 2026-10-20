import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createPorts } from "../src/wire.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function fixture() {
  const root = tmp(); roots.push(root); initRepo(root);
  write(root, ".gitignore", ".tenet/\n"); write(root, "src/a.ts", "export const a = 1;\n"); write(root, "src/b.ts", "export const b = 1;\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "initial"); const parent = git(root, "rev-parse", "HEAD");
  write(root, "src/a.ts", "export const a = 2;\n"); git(root, "add", "src/a.ts"); git(root, "commit", "-qm", "new HEAD");
  git(root, "read-tree", parent);
  write(root, "src/b.ts", "export const b = 'human staged';\n"); git(root, "add", "src/b.ts");
  const ports = createPorts(root);
  await runVerb(ports, VERBS, "open", { profile: "investigate", request: "index recovery" });
  return { root, ports, parent, human: git(root, "diff", "--cached", "--", "src/b.ts") };
}
async function crash(root: string, parent: string, point: string) {
  const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-index-sync.ts"), root, parent, point], { stdio: ["ignore", "ignore", "inherit"] });
  assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
}
describe("index-sync crash recovery [GIT-03, CON-03, CON-04]", () => {
  for (const point of ["before-lock", "after-lock", "before-rename", "after-rename"]) it(`recovers ${point}, preserving the person's staged entries`, async () => {
    const { root, ports, parent, human } = await fixture();
    await crash(root, parent, point);
    assert.ok(ports.store.readLog().some(e => e.effect === "index-sync" && e.kind === "intent"));
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "recover" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(existsSync(join(root, ".git/index.lock")), false);
    assert.equal(git(root, "diff", "--cached", "--", "src/a.ts"), "");
    assert.equal(git(root, "diff", "--cached", "--", "src/b.ts"), human);
    assert.deepEqual(readdirSync(join(root, ".git")).filter(p => p.startsWith("tenet-index-")), []);
    const index = readFileSync(join(root, ".git/index"));
    await runVerb(ports, VERBS, "open", { profile: "investigate", request: "recover again" });
    assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    await ports.store.transaction("test", async tx => assert.equal(tx.unresolved().filter(e => e.effect === "index-sync").length, 0));
  });
  it("leaves a competing client's replacement lock and all staging untouched", async () => {
    const { root, ports, parent, human } = await fixture(); await crash(root, parent, "after-lock");
    const lock = join(root, ".git/index.lock"); rmSync(lock); writeFileSync(lock, "foreign lock", { flag: "wx" });
    const index = readFileSync(join(root, ".git/index"));
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "foreign lock" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(readFileSync(lock, "utf8"), "foreign lock"); assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    assert.equal(git(root, "diff", "--cached", "--", "src/b.ts"), human);
    assert.ok(r.effects?.completed.some(e => e.includes("index") && e.includes("untouched")));
  });
  it("never breaks a live paused owner's lock; a real stager fails visibly until recovery [AGT-08]", async () => {
    const { root, ports, parent, human } = await fixture();
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-index-sync.ts"), root, parent, "pause-after-lock"], { stdio: ["ignore", "pipe", "inherit"] });
    const exited = new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal)));
    try {
      await new Promise((resolve, reject) => { child.stdout!.once("data", resolve); child.once("exit", () => reject(new Error("child ended before lock publication"))); });
      const stager = spawnSync("git", ["add", "src/b.ts"], { cwd: root, encoding: "utf8" });
      assert.notEqual(stager.status, 0); assert.match(stager.stderr, /index.lock|File exists/);
      const index = readFileSync(join(root, ".git/index"));
      const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "live owner" });
      assert.equal(r.exit, 2, JSON.stringify(r)); assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
      assert.equal(existsSync(join(root, ".git/index.lock")), true); assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    } finally { child.kill("SIGKILL"); await exited; }
    assert.equal((await runVerb(ports, VERBS, "open", { profile: "investigate", request: "dead owner" })).exit, 0);
    assert.equal(git(root, "diff", "--cached", "--", "src/b.ts"), human);
  });
  it("retains newly staged content on a synced path after the crashed rename", async () => {
    const { root, ports, parent } = await fixture(); await crash(root, parent, "after-rename");
    write(root, "src/a.ts", "export const a = 'human replacement';\n"); git(root, "add", "src/a.ts");
    const staged = git(root, "diff", "--cached"), index = readFileSync(join(root, ".git/index"));
    assert.equal((await runVerb(ports, VERBS, "open", { profile: "investigate", request: "new staging" })).exit, 0);
    assert.equal(git(root, "diff", "--cached"), staged); assert.deepEqual(readFileSync(join(root, ".git/index")), index);
  });
  it("recognizes a landed sync while preserving a newer client's lock", async () => {
    const { root, ports, parent } = await fixture(); await crash(root, parent, "after-rename");
    writeFileSync(join(root, ".git/index.lock"), "new client", { flag: "wx" });
    const index = readFileSync(join(root, ".git/index"));
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "landed plus new lock" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(r.effects?.completed.some(e => e.includes("index sync was reconciled")), JSON.stringify(r.effects));
    assert.equal(readFileSync(join(root, ".git/index.lock"), "utf8"), "new client");
    assert.deepEqual(readFileSync(join(root, ".git/index")), index);
  });
  it("leaves a landed rename unresolved when directory sync fails, then reconciles its postcondition", async () => {
    const { root, ports, parent, human } = await fixture();
    const child = spawnSync(process.execPath, [join(import.meta.dirname, "fixtures/crash-index-sync.ts"), root, parent, "failed-directory-sync"], { encoding: "utf8" });
    assert.equal(child.status, 2, child.stdout + child.stderr);
    assert.equal(JSON.parse(child.stdout).error, "effect-uncertain");
    await ports.store.transaction("test", async tx => assert.ok(tx.unresolved().some(e => e.effect === "index-sync")));
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "sync failure" });
    assert.equal(r.exit, 0, JSON.stringify(r)); assert.ok(r.effects?.completed.some(e => e.includes("index sync was reconciled")));
    assert.equal(git(root, "diff", "--cached", "--", "src/a.ts"), ""); assert.equal(git(root, "diff", "--cached", "--", "src/b.ts"), human);
  });
  it("leaves the index untouched if HEAD moved after the interrupted sync", async () => {
    const { root, ports, parent } = await fixture(); await crash(root, parent, "after-rename");
    git(root, "commit", "-qm", "human checkpoint");
    const index = readFileSync(join(root, ".git/index")), head = git(root, "rev-parse", "HEAD");
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "new HEAD" });
    assert.equal(r.exit, 0, JSON.stringify(r)); assert.ok(r.effects?.completed.some(e => e.includes("untouched")));
    assert.equal(git(root, "rev-parse", "HEAD"), head); assert.deepEqual(readFileSync(join(root, ".git/index")), index);
  });
  it("keeps the documented split-index fallback after an interrupted sync", async () => {
    const { root, ports, parent } = await fixture(); await crash(root, parent, "after-rename");
    git(root, "update-index", "--split-index");
    const index = readFileSync(join(root, ".git/index")), staged = git(root, "diff", "--cached");
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "split index" });
    assert.equal(r.exit, 0, JSON.stringify(r)); assert.ok(r.effects?.completed.some(e => e.includes("untouched")));
    assert.deepEqual(readFileSync(join(root, ".git/index")), index); assert.equal(git(root, "diff", "--cached"), staged);
  });
  for (const change of ["bad-pid", "bad-temp", "bad-envelope"]) it(`refuses ${change} in the durable record without removing the lock [SEC-06]`, async () => {
    const { root, ports, parent } = await fixture(); await crash(root, parent, "after-lock");
    const path = join(root, ".tenet/log");
    const records = readFileSync(path, "utf8").trim().split("\n").map(line => JSON.parse(line));
    const intent = records.find(e => e.effect === "index-sync" && e.kind === "intent");
    if (change === "bad-pid") intent.op.sync.pid = -1; else if (change === "bad-temp") intent.op.sync.temp = "../../outside"; else intent.op = null;
    writeFileSync(path, records.map(e => JSON.stringify(e)).join("\n") + "\n");
    const index = readFileSync(join(root, ".git/index")), lock = readFileSync(join(root, ".git/index.lock"));
    const r = await runVerb(ports, VERBS, "open", { profile: "investigate", request: "malformed record" });
    assert.equal(r.exit, 2, JSON.stringify(r)); assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
    assert.deepEqual(readFileSync(join(root, ".git/index")), index); assert.deepEqual(readFileSync(join(root, ".git/index.lock")), lock);
  });
  it("never follows a replacement index-lock symlink [SEC-06]", async () => {
    const { root, ports, parent } = await fixture(); await crash(root, parent, "after-lock");
    const outside = tmp(); roots.push(outside); write(outside, "private", "preserve me");
    rmSync(join(root, ".git/index.lock")); symlinkSync(join(outside, "private"), join(root, ".git/index.lock"));
    const index = readFileSync(join(root, ".git/index"));
    assert.equal((await runVerb(ports, VERBS, "open", { profile: "investigate", request: "linked lock" })).exit, 0);
    assert.equal(readFileSync(join(outside, "private"), "utf8"), "preserve me"); assert.deepEqual(readFileSync(join(root, ".git/index")), index);
  });
});
