// The starter scaffold effect (TS §12.2): files written once and never over anything, a pinned install, honest failure.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { FAKE_LOCK, callWith, callWithEnvelopeConsent, fakeRecipe, fakeRecipes, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

/** An empty Git project with a feature contract and a basis whose one example is the starter's own test. */
async function empty(recipes = fakeRecipes(), lane = "quick") {
  const root = tmp("tenet-scaf-"); roots.push(root);
  initRepo(root);
  write(root, "NOTES.txt", "mine\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "initial");
  const rawCall = callWith(root, recipes);
  const call = (verb: string, input: Record<string, unknown> = {}) => callWithEnvelopeConsent(rawCall, verb, input);
  const o = await call("open", { profile: "feature", request: "a new app", scopePaths: [], lane });
  const h = o.handle!;
  const b = await call("decide", { h, kind: "basis", propose: {
    outcome: "The starter platform is in place and its own tests pass",
    elements: [
      { ref: "r", kind: "requirement", origin: "request", text: "the starter's platform tests pass" },
      { ref: "e", kind: "example", origin: "request", of: "r", text: "server/test/starter.test.ts passes", testFile: "server/test/starter.test.ts", test: "preservation", expect: "pass" },
    ],
  } });
  assert.equal(b.exit, 0, JSON.stringify(b));
  return { root, call, h };
}

describe("scaffold", () => {
  it("does not replay a published scaffold after commit clears transient touched paths [CON-03]", async () => {
    const { root, call, h } = await empty();
    assert.equal((await call("decide", { h, kind: "scaffold", propose: { name: "stable-scaffold" } })).exit, 0);
    const checked = await call("check", { h, stage: "candidate" });
    await call("findings", { h, result: reviewResult(d(checked)) });
    const finished = await call("finish", { h, subject: "Scaffold once" });
    assert.equal(d(finished).endpoint, "checked-local", JSON.stringify(finished));
    const before = JSON.parse(readFileSync(join(root, ".tenet/state"), "utf8"));
    const workId = Object.keys(before.work)[0];
    assert.ok(workId);
    assert.deepEqual(before.work[workId].touched, []);
    const head = git(root, "rev-parse", "HEAD");
    const opened = await call("open", { profile: "investigate", request: "leave published scaffold attribution unchanged" });
    assert.equal(opened.exit, 0, JSON.stringify(opened));
    const after = JSON.parse(readFileSync(join(root, ".tenet/state"), "utf8"));
    assert.deepEqual(after.work[workId], before.work[workId]);
    assert.deepEqual(after.project.recipe, before.project.recipe);
    assert.equal(git(root, "rev-parse", "HEAD"), head);
    assert.equal(opened.effects?.completed.some(effect => /scaffold.*not yet in the contract/.test(effect)) ?? false, false);
  });
  it("writes the template with the project name, protects the starter's paths, installs, and then the first check and commit work [GIT-01]", async () => {
    const { root, call, h } = await empty();
    const r = await call("decide", { h, kind: "scaffold", propose: { name: "loan-desk" } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(r.next[0]!.action, "check");
    assert.deepEqual(d(r).protected, ["server/migrations/*", "server/src/platform/auth/*"]);
    assert.match(readFileSync(join(root, "package.json"), "utf8"), /"name":"loan-desk"/);
    assert.equal(readFileSync(join(root, "README.md"), "utf8"), "# loan-desk\n");
    assert.ok(existsSync(join(root, "node_modules")), "the pinned install ran");

    const c = await call("check", { h, stage: "candidate" });
    assert.equal(c.exit, 0, JSON.stringify(c));
    assert.equal(c.next[0]!.action, "focused-review", "the recipe's own vetted files are not a change that raises the lane");
    await call("findings", { h, result: reviewResult(d(c)) });
    const f = await call("finish", { h, subject: "Scaffold the starter" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
    const committed = git(root, "show", "--name-only", "--format=", "HEAD").split("\n");
    assert.deepEqual(committed.sort(), [".gitignore", "README.md", "package-lock.json", "package.json", "server/test/starter.test.ts", "tsconfig.json"]);
    assert.ok(!committed.includes("NOTES.txt") && !committed.some((p) => p.startsWith("node_modules")));
    assert.equal(d(f).scope, "committed");
  });

  it("raises the lane for a recipe file only once someone changes it, and never for the recipe's own content [WRK-04]", async () => {
    const auth = { path: "server/src/platform/auth/passwords.ts", content: "export const hash = (s: string) => s;\n", mode: 0o644 };
    const recipe = fakeRecipe({ files: [...fakeRecipe().files, auth] });
    const { root, call, h } = await empty(fakeRecipes(recipe));
    await call("decide", { h, kind: "scaffold", propose: { name: "x" } });
    const unchanged = await call("check", { h, stage: "candidate" });
    assert.equal(unchanged.next[0]!.action, "focused-review", "the vetted auth file alone does not raise the lane");
    write(root, auth.path, "export const hash = (s: string) => s + '!';\n");
    const changed = await call("check", { h, stage: "candidate", touched: [auth.path], again: true });
    assert.notEqual(changed.exit, 0, "a change under a protected auth path needs its grant");
    assert.ok(changed.reasons.some((r) => r.code === "authority-needed"), JSON.stringify(changed.reasons));
    const st = JSON.parse(readFileSync(join(root, ".tenet/state"), "utf8"));
    assert.equal(Object.values(st.work as Record<string, { lane: string }>)[0]!.lane, "deep", "the edit raised the lane: an auth path, and a protected path, are two high dimensions");
  });

  it("can decline the protected-path defaults, and refuses to run twice", async () => {
    const { call, h } = await empty();
    const r = await call("decide", { h, kind: "scaffold", propose: { protectDefaults: false } });
    assert.deepEqual(d(r).protected, []);
    const again = await call("decide", { h, kind: "scaffold" });
    assert.equal(again.exit, 2);
    assert.equal(again.reasons[0]!.code, "scaffold-target-not-empty");
  });

  it("never overwrites: a file the starter would write that already exists stops it before anything is written", async () => {
    const { root, call, h } = await empty();
    write(root, "README.md", "# my own readme\n");
    const r = await call("decide", { h, kind: "scaffold" });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]!.code, "scaffold-target-not-empty");
    assert.match(r.reasons[0]!.message, /README\.md/);
    assert.equal(readFileSync(join(root, "README.md"), "utf8"), "# my own readme\n");
    assert.ok(!existsSync(join(root, "package.json")), "nothing else was written");
  });

  it("refuses a recipe whose lockfile is not the pinned one", async () => {
    const tampered = fakeRecipe({ files: fakeRecipe().files.map((f) => (f.path === "package-lock.json" ? { ...f, content: `${FAKE_LOCK}// changed\n` } : f)) });
    const { root, call, h } = await empty(fakeRecipes(tampered));
    const r = await call("decide", { h, kind: "scaffold" });
    assert.equal(r.exit, 4);
    assert.equal(r.reasons[0]!.code, "recipe-integrity-failed");
    assert.ok(!existsSync(join(root, "package.json")));
  });

  it("keeps the files when the install fails, says so, and retries only the install", async () => {
    const { root, call, h } = await empty();
    write(root, ".fail-install", "");
    const r = await call("decide", { h, kind: "scaffold" });
    assert.equal(r.exit, 2);
    assert.equal(r.reasons[0]!.code, "install-failed");
    assert.match(r.reasons[0]!.message, /network is down/);
    assert.ok(existsSync(join(root, "package.json")));
    assert.equal(Object.values((await import("../src/wire.ts")).createPorts(root).store.read()!.state.work)[0]!.session.inCall, undefined);

    (await import("node:fs")).rmSync(join(root, ".fail-install"));
    const retry = await call("decide", { h, kind: "scaffold", again: true });
    assert.equal(retry.exit, 0, JSON.stringify(retry));
    assert.ok(existsSync(join(root, "node_modules")));
    assert.equal(git(root, "status", "--porcelain", "--", "package.json"), "?? package.json");
  });

  it("needs a recorded basis, and a recipe that exists", async () => {
    const root = tmp("tenet-scaf-"); roots.push(root);
    initRepo(root); write(root, "x.txt", "x\n"); git(root, "add", "-A"); git(root, "commit", "-qm", "i");
    const call = callWith(root, fakeRecipes());
    const o = await call("open", { profile: "feature", request: "app", scopePaths: [] });
    assert.equal((await call("decide", { h: o.handle!, kind: "scaffold" })).reasons[0]!.code, "continue-required");
    const { call: c2, h } = await empty();
    assert.equal((await c2("decide", { h, kind: "scaffold", propose: { recipe: "nope" } })).reasons[0]!.code, "capability-missing");
  });
});

describe("scaffold crash recovery (the file-write effect has four steps)", () => {
  async function crashAt(point: string) {
    const { root, call, h } = await empty();
    const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-scaffold.ts"), root, JSON.stringify({ h, kind: "scaffold" }), point], { stdio: "ignore" });
    assert.equal(await new Promise((r) => child.on("exit", (_c, s) => r(s))), "SIGKILL", point);
    const r = await call("decide", { h, kind: "scaffold" });
    assert.equal(r.exit, 0, `${point}: ${JSON.stringify(r)}`);
    for (const p of ["package.json", "README.md", "server/test/starter.test.ts"]) assert.ok(existsSync(join(root, p)), `${point}: ${p}`);
    assert.ok(existsSync(join(root, "node_modules")), point);
    const c = await call("check", { h, stage: "candidate" });
    assert.equal(c.exit, 0, `${point}: ${JSON.stringify(c)}`);
    await call("findings", { h, result: reviewResult(d(c)) });
    const f = await call("finish", { h, subject: "Scaffold" });
    assert.equal(d(f).endpoint, "checked-local", `${point}: ${JSON.stringify(f.reasons)}`);
    assert.equal(git(root, "show", "--name-only", "--format=", "HEAD").split("\n").length, 6, `${point}: every starter file is committed once`);
    return r;
  }
  it("after the intent, before anything is written", async () => { await crashAt("after-intent"); });
  it("in the middle of the write: the partial write is rolled back, then it is written whole", async () => { await crashAt("mid-write"); });
  it("after every file is written, before the result record", async () => { await crashAt("after-write"); });
  it("after the result record, before the revision is published", async () => { await crashAt("after-result"); });
  for (const point of ["after-temp-fsync", "after-link", "after-file-dir-fsync"]) it(`recovers the exclusive file publication boundary ${point} [CON-03]`, async () => { await crashAt(point); });
});
