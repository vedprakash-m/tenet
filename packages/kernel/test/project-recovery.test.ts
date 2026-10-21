import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { createPorts } from "../src/wire.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { BASIS, callWith, fakeRecipes, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function killAt(file: string, root: string, input: object, point: string) {
  const child = spawn(process.execPath, [join(import.meta.dirname, `fixtures/${file}.ts`), root, JSON.stringify(input), point], { stdio: ["ignore", "ignore", "inherit"] });
  assert.equal(await new Promise(resolve => child.on("exit", (_code, signal) => resolve(signal))), "SIGKILL");
}
async function partialScaffold(adoptPolicy = false) {
  const root = tmp(); roots.push(root); initRepo(root); write(root, "NOTES.txt", "mine\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "initial");
  const call = callWith(root, fakeRecipes()), h = (await call("open", { profile: "feature", request: "a new app", lane: "quick" })).handle!;
  await call("decide", { h, kind: "basis", propose: { ...BASIS, elements: BASIS.elements.filter(e => e.kind !== "example") } });
  if (adoptPolicy) {
    write(root, "tenet.policy.json", "{}");
    await call("decide", { h, kind: "adopt", target: "policy" });
    const accepted = await call("decide", { h, kind: "adopt", target: "policy", answers: { "adopt-confirm": "confirm" } });
    assert.equal(accepted.exit, 0, JSON.stringify(accepted));
  }
  await killAt("crash-scaffold", root, { h, kind: "scaffold" }, "mid-write");
  assert.equal(existsSync(join(root, "package.json")), true);
  return { root, call, h, ports: createPorts(root) };
}
describe("unreadable project effect recovery [CON-03, SEC-06, SEC-14]", () => {
  it("keeps orphaned atomic temporary files out of source identities and content access", async () => {
    const p = project(); roots.push(p.root);
    const ports = p.ports(), before = await ports.git.inventory([]);
    const path = ".tenet-write-00000000-0000-4000-8000-000000000000.tmp";
    p.write(path, "PRIVATE_ATOMIC_TEMP_CANARY");
    const after = await ports.git.inventory([], [path]);
    assert.equal(after.entries.has(path), false); assert.equal(after.status.some(s => s.path === path), false);
    assert.equal(after.digest, before.digest);
    assert.throws(() => ports.project.read(path), /policy|forbid/);
  });
  for (const kind of ["linked", "excluded"]) it(`keeps an adoption ${kind} postcondition unresolved rather than calling it absent`, async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "intent adoption", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    await killAt("crash-adopt", p.root, { h, kind: "adopt", target: "intent", answers: { "adopt-confirm": "confirm" } }, "after-intent");
    const outside = tmp(); roots.push(outside); write(outside, "private", "UNTRUSTED_RECOVERY_CANARY");
    if (kind === "linked") symlinkSync(join(outside, "private"), join(p.root, "INTENT.md"));
    else p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "INTENT.md", kinds: ["no-read"] }] }));
    const r = await p.call("open", { profile: "investigate", request: "recover" });
    assert.equal(r.exit, 2, JSON.stringify(r)); assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
    assert.equal(JSON.stringify(r).includes("UNTRUSTED_RECOVERY_CANARY"), false);
    assert.equal(readFileSync(join(outside, "private"), "utf8"), "UNTRUSTED_RECOVERY_CANARY");
    await p.ports().store.transaction("test", async tx => { assert.ok(tx.unresolved().some(e => e.effect === "adopt")); });
  });
  it("does not roll back known scaffold files when another postcondition is a directory", async () => {
    const p = await partialScaffold(), initial = readFileSync(join(p.root, "package.json"));
    mkdirSync(join(p.root, "README.md"));
    const r = await p.call("open", { profile: "investigate", request: "recover" });
    assert.equal(r.exit, 2, JSON.stringify(r)); assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
    assert.deepEqual(readFileSync(join(p.root, "package.json")), initial);
    await p.ports.store.transaction("test", async tx => assert.ok(tx.unresolved().some(e => e.effect === "scaffold")));
  });
  for (const verb of ["open", "stop"]) it(`${verb} never rolls back scaffold files excluded by current policy`, async () => {
    const p = await partialScaffold(), initial = readFileSync(join(p.root, "package.json"));
    write(p.root, "tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "package.json", kinds: ["no-read", "no-edit"] }] }));
    const r = await p.call(verb, verb === "open" ? { profile: "investigate", request: "recover" } : { h: p.h, mode: "pause" });
    assert.equal(r.exit, 2, JSON.stringify(r)); assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
    assert.deepEqual(readFileSync(join(p.root, "package.json")), initial);
    await p.ports.store.transaction("test", async tx => { assert.ok(tx.unresolved().some(e => e.effect === "scaffold")); assert.ok(tx.state!.sourceOwner); });
  });
  it("applies tightened adopted restrictions before reconciling a killed scaffold [SEC-08, SEC-12]", async () => {
    const p = await partialScaffold(true), path = join(p.root, "package.json");
    const initial = readFileSync(path);
    write(p.root, "tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "package.json", kinds: ["no-read", "no-edit"] }] }));
    const r = await p.call("open", { profile: "investigate", request: "recover with tightened adopted policy" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === "effect-uncertain"));
    assert.deepEqual(readFileSync(path), initial);
    await p.ports.store.transaction("test", async tx => assert.ok(tx.unresolved().some(e => e.effect === "scaffold")));
  });
});
