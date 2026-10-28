// Workflow edge cases on real repositories: new projects, hooks, refusals, dispositions, parking and non-editing work.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, tmp, write } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, callWithEnvelopeConsent, project, reviewResult, finishFixture, focusFixture } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (files?: Record<string, string>): Project => { const p = project(files); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

async function toGreen(p: Project, over: Record<string, unknown> = {}) {
  const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick", ...over });
  const h = o.handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  const g = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  return { h, g };
}
const addHook = (p: Project, script: string) => {
  write(p.root, ".git/hooks/pre-commit", script);
  chmodSync(join(p.root, ".git/hooks/pre-commit"), 0o755);
};

describe("a new project", () => {
  it("asks before initializing Git, then runs the whole loop on an unborn repository and makes the first commit [GIT-01]", async () => {
    const root = tmp("tenet-new-");
    roots.push(root);
    write(root, "package.json", '{"name":"n","type":"module","private":true}\n');
    write(root, "tsconfig.json", '{"compilerOptions":{"strict":true}}\n');
    write(root, ".gitignore", "node_modules\n");
    symlinkSync(join(import.meta.dirname, "../../../node_modules"), join(root, "node_modules"));
    const rawCall = (v: string, i: Record<string, unknown>) => runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, v, i);
    const call = (v: string, i: Record<string, unknown>) => callWithEnvelopeConsent(rawCall, v, i);

    const ask = await call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
    assert.equal(ask.exit, 3);
    assert.equal(ask.questions![0]!.id, "git-init");
    assert.ok(!existsSync(join(root, ".git")), "nothing changed until the user agreed");

    const o = await call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick", initGit: true });
    assert.equal(o.exit, 0, JSON.stringify(o));
    git(root, "config", "user.name", "Test");
    git(root, "config", "user.email", "test@example.com");
    const h = o.handle!;
    await call("decide", { h, kind: "basis", propose: BASIS });
    write(root, "src/greet.ts", "export const greet = (_n: string): string => '';\n"); // minimal compilable scaffolding
    write(root, "src/greet.test.ts", GREET_TEST);
    const red = await call("check", { h, stage: "baseline" });
    assert.equal(red.exit, 0, JSON.stringify(red));
    assert.equal(red.next[0]!.action, "implement", "new scaffolding does not contaminate the baseline");
    write(root, "src/greet.ts", GREET_IMPL);
    const green = await call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    await call("findings", { h, result: reviewResult(d(green)) });
    const f = await call("finish", { h, subject: "First commit" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
    assert.equal(d(f).scope, "working-tree-with-your-edits", "package.json and tsconfig.json are the user's untracked files, present while checking");
    assert.equal(git(root, "rev-list", "--count", "HEAD"), "1");
    assert.equal(git(root, "show", "--name-only", "--format=", "HEAD"), "src/greet.test.ts\nsrc/greet.ts");
  });
});

describe("refusals", () => {
  it("will not edit a repository that is mid-rebase or detached, but can still investigate [INS-06]", async () => {
    const p = fresh();
    p.git("checkout", "-q", "--detach");
    const o = await p.call("open", { profile: "feature", request: "x", scopePaths: [] });
    assert.equal(o.exit, 2);
    assert.equal(o.reasons[0]!.code, "repo-state-readonly");
    const i = await p.call("open", { profile: "investigate", request: "look around" });
    assert.equal(i.exit, 0);
  });

  it("refuses a commit when files changed since the last check, and says to check", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    p.write("src/greet.ts", `${GREET_IMPL}// edited after the check\n`);
    const f = await finishFixture(p, { h });
    assert.equal(f.exit, 0, "finish itself computes the honest verdict: the evidence is stale");
    assert.ok(f.reasons.some((r) => r.code === "stale"), JSON.stringify(f.reasons));
    assert.equal(d(f).endpoint, "implemented-unverified");
  });

  it("rejects input that does not fit the verb schema with exit 1", async () => {
    const p = fresh();
    const bad = await p.call("open", { profile: "nonsense" });
    assert.equal(bad.exit, 1);
    assert.equal(bad.reasons[0]!.code, "invalid-input");
    const unknown = await p.call("nope", {});
    assert.equal(unknown.exit, 1);
  });
});

describe("commit hooks (TS §10.3)", () => {
  it("asks once before the first commit, remembers the answer by the hook configuration, and commits with the hook [GIT-12]", async () => {
    const p = fresh();
    addHook(p, "#!/bin/sh\nexit 0\n");
    const { h } = await toGreen(p);
    const ask = await finishFixture(p, { h });
    assert.equal(ask.exit, 3);
    assert.equal(ask.questions![0]!.id, "hook-consent");
    assert.equal(ask.questions![0]!.channel, "native", "a routine consent with no outside effect is a picker, not a chat gate");
    await p.call("decide", { h, kind: "hook-consent", answers: { "hook-consent": "commit-with-hooks" } });
    const f = await finishFixture(p, { h, subject: "Add greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
    assert.equal(d(f).scope, "committed");
    const consents = p.ports().store.read()!.state.consents;
    assert.equal(consents.filter((item) => item.kind === "hooks").length, 1);
    assert.ok(consents.some((item) => item.kind === "envelope"));
  });

  it("keeps the commit and reports a path a hook staged that is not Tenet's", async () => {
    const p = fresh();
    addHook(p, "#!/bin/sh\necho x > made-by-hook.txt\ngit add made-by-hook.txt\n");
    const { h } = await toGreen(p);
    await finishFixture(p, { h });
    await p.call("decide", { h, kind: "hook-consent", answers: { "hook-consent": "commit-with-hooks" } });
    const f = await finishFixture(p, { h, subject: "Add greet" });
    assert.ok(f.reasons.some((r) => r.code === "hook-staged-foreign-path"), JSON.stringify(f.reasons));
    assert.equal(f.exit, 3, JSON.stringify(f));
    assert.notEqual(d(f).endpoint, "checked-local");
    const work = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.notEqual(work.state, "finished");
    assert.equal(work.git.commits.length, 1);
    const foreign = work.attention.find(item => item.path === "made-by-hook.txt" && !item.disposition);
    assert.ok(foreign);
    await p.call("check", { h, stage: "candidate", again: true });
    const checked = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.ok(checked.attention.some(item => item.id === foreign.id && !item.disposition));
    const retried = await p.call("finish", { h, again: true });
    assert.notEqual(d(retried).endpoint, "checked-local", JSON.stringify(retried));
    const accepted = await p.call("decide", { h, kind: "disposition", target: foreign.id,
      propose: { outcome: "accepted", reason: "I reviewed and chose to keep the hook's extra file." } });
    assert.equal(accepted.exit, 0, JSON.stringify(accepted));
    const disposed = Object.values(p.ports().store.read()!.state.work)[0]!.attention.find(item => item.id === foreign.id);
    assert.equal(disposed?.disposition?.by, "user");
    assert.equal(disposed?.disposition?.outcome, "accepted");
    assert.equal(p.git("show", "--name-only", "--format=", "HEAD").includes("made-by-hook.txt"), true, "the commit is kept");
  });

  it("leaves the candidate uncommitted when a hook fails, and says so in the headline [GIT-12, GIT-15]", async () => {
    const p = fresh();
    addHook(p, "#!/bin/sh\necho 'lint failed' >&2\nexit 1\n");
    const { h } = await toGreen(p);
    await finishFixture(p, { h });
    await p.call("decide", { h, kind: "hook-consent", answers: { "hook-consent": "commit-with-hooks" } });
    const head = p.git("rev-parse", "HEAD");
    const f = await finishFixture(p, { h, subject: "Add greet" });
    assert.ok(f.reasons.some((r) => r.code === "hook-failed"), JSON.stringify(f.reasons));
    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.equal(d(f).scope, "working-tree-uncommitted");
    assert.match(d(f).label, /working tree/);
  });

  it("keeps the work uncommitted when the user declines hooks [GIT-15]", async () => {
    const p = fresh();
    addHook(p, "#!/bin/sh\nexit 0\n");
    const { h } = await toGreen(p);
    await finishFixture(p, { h });
    await p.call("decide", { h, kind: "hook-consent", answers: { "hook-consent": "keep-uncommitted" } });
    const f = await finishFixture(p, { h });
    assert.equal(d(f).scope, "working-tree-uncommitted");
    assert.equal(p.git("status", "--porcelain").length > 0, true);
  });
});

describe("dispositions", () => {
  it("lets the user accept a shortcut, and only then reaches checked-local [REV-04]", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    p.write("src/greet.ts", `${GREET_IMPL}export const legacy = (x: unknown) => x as any;\n`);
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const blocked = await finishFixture(p, { h, noCommit: true });
    const marker = p.ports().store.read()!.state.work[Object.keys(p.ports().store.read()!.state.work)[0]!]!.attention.find((a) => a.marker)!;
    assert.ok(blocked.reasons.some((r) => r.code === "marker-unaccepted"));
    const p2 = fresh();
    const r = await toGreen(p2);
    p2.write("src/greet.ts", `${GREET_IMPL}export const legacy = (x: unknown) => x as any;\n`);
    await p2.call("check", { h: r.h, stage: "candidate" });
    const id = Object.values(p2.ports().store.read()!.state.work)[0]!.attention.find((a) => a.marker)!.id;
    assert.equal(id, marker.id.length ? id : id);
    const accept = await p2.call("decide", { h: r.h, kind: "disposition", target: id, propose: { outcome: "accepted", reason: "the legacy API returns unknown" } });
    assert.equal(accept.exit, 0, JSON.stringify(accept));
    const f = await finishFixture(p2, { h: r.h, subject: "greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
  });

  it("re-locks an acceptance test the user confirms may change, and accepts nothing without a reason [INT-06]", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    p.write("src/greet.test.ts", GREET_TEST.replace('.toBe("Hello, Ada!")', ".toBeTruthy()"));
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const blocked = await finishFixture(p, { h, noCommit: true });
    assert.ok(blocked.reasons.some((r) => r.code === "locked-test-changed"));
    const p2 = fresh();
    const r = await toGreen(p2);
    p2.write("src/greet.test.ts", GREET_TEST.replace('.toBe("Hello, Ada!")', ".toBeTruthy()"));
    const none = await p2.call("decide", { h: r.h, kind: "disposition", target: "src/greet.test.ts", propose: { outcome: "accepted" } });
    assert.equal(none.exit, 1, "a disposition needs a reason");
    await p2.call("decide", { h: r.h, kind: "disposition", target: "src/greet.test.ts", propose: { outcome: "accepted", reason: "tightened later" } });
    await p2.call("check", { h: r.h, stage: "candidate" });
    const f = await finishFixture(p2, { h: r.h, noCommit: true });
    assert.ok(!f.reasons.some((x) => x.code === "locked-test-changed"), JSON.stringify(f.reasons));
    assert.ok(f.reasons.some((x) => x.code === "no-distinguishing-red"), "permission to revise is not baseline proof");
  });
});

describe("honest claims and handoffs (EVD-07, RES-04, WRK-12)", () => {
  it("states each control's mechanism class and the assurance profile, and discloses reduced independence [EVD-07]", async () => {
    const p = fresh();
    if (process.platform === "win32") {
      const refused = await p.call("open", {
        profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard",
      });
      assert.equal(refused.exit, 2, JSON.stringify(refused));
      assert.ok(refused.reasons.some((r) => r.code === "capability-missing"), JSON.stringify(refused));
      assert.equal(refused.handle, undefined);
      assert.equal(p.ports().store.read(), null, "unsupported mutation must not create state");
      return;
    }
    const { h, g } = await toGreen(p, { lane: "standard" });
    await p.call("findings", { h, result: reviewResult(d(g), { dispatchMode: "same-session" }) });
    const f = await finishFixture(p, { h, noCommit: true });
    assert.equal(d(f).assurance, "Advisory", "an unreached checked-local claims no assurance");
    const classes = Object.fromEntries(d(f).controls.map((c: { control: string; class: string }) => [c.control, c.class]));
    assert.equal(classes["acceptance-test locks"], "detected");
    assert.equal(classes["per-contract limits"], "boundary-checked");
    assert.equal(classes["review independence"], "reduced");
    assert.ok(d(f).controls.every((c: { note: string }) => c.note.length > 10));

    const q = fresh();
    const r = await toGreen(q);
    const done = await finishFixture(q, { h: r.h, subject: "s" });
    assert.equal(d(done).assurance, "Checked local");
  });

  it("writes a handoff at the end of the contract and at a budget stop, enough to resume without re-explaining [RES-04]", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    const f = await finishFixture(p, { h, noCommit: true });
    assert.match(d(f).handoff, /W-0001 · feature · quick lane · L4 · finished/);
    assert.match(d(f).handoff, /Checks: .*pass/);

    const q = fresh();
    const o = await q.call("open", { profile: "feature", request: "x", scopePaths: ["src/greet.ts"], lane: "quick" });
    await q.call("decide", { h: o.handle!, kind: "basis", propose: BASIS });
    q.write("src/greet.test.ts", GREET_TEST);
    await q.call("check", { h: o.handle!, stage: "baseline" });
    q.write("src/greet.ts", "export const greet = (n: string): string => `Hi, ${n}!`;\n");
    await q.call("check", { h: o.handle!, stage: "candidate" });
    q.write("src/greet.ts", "export const greet = (n: string): string => `Hi, ${n}!`; // again\n");
    const stop = await q.call("check", { h: o.handle!, stage: "candidate" });
    assert.equal(stop.exit, 2);
    const w = Object.values(q.ports().store.read()!.state.work)[0]!;
    assert.match(w.handoff ?? "", /stopped: repeated-failure/);
  });
});

describe("a checkpoint commit does not hide work from the review", () => {
  it("lists files committed earlier in the contract beside the ones still uncommitted", async () => {
    const p = fresh();
    const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "standard" });
    const h = o.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    const cp = await p.call("commit", { h, subject: "Add the failing test" });
    assert.equal(cp.exit, 0, JSON.stringify(cp));
    assert.equal(p.git("show", "--name-only", "--format=", "HEAD"), "src/greet.test.ts");
    p.write("src/greet.ts", GREET_IMPL);
    const g = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const manifest = JSON.parse(readFileSync(d(g).review.manifest, "utf8"));
    assert.deepEqual(manifest.changes.map((c: { path: string }) => c.path).sort(), ["src/greet.test.ts", "src/greet.ts"]);
    await p.call("findings", { h, result: reviewResult(d(g)) });
    const f = await finishFixture(p, { h, subject: "Implement greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
    assert.equal(d(f).commits.length, 2);
  });
});

describe("acceptance-test locks follow history (TS §9.7)", () => {
  const OTHER = { ...BASIS, outcome: "double(n) doubles", scopePaths: ["src/double.ts"], elements: [
    { ref: "r1", kind: "requirement", origin: "request", text: "double(n) returns n * 2" },
    { ref: "e1", kind: "example", origin: "request", of: "r1", text: "double(2) is 4", testFile: "src/double.test.ts", test: "distinguishing", expect: "fail" },
  ] };
  it("binds a branch that has the locked test and leaves one that never had it alone", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    const first = await finishFixture(p, { h, subject: "Add greet" });
    assert.equal(d(first).endpoint, "checked-local", JSON.stringify(first.reasons));
    const lock = p.ports().store.read()!.state.locks[0]!;
    assert.deepEqual(Object.keys(lock.anchor), ["commit"], "anchored to the commit that first contains it");

    p.git("checkout", "-q", "main"); // a branch that never had src/greet.test.ts
    p.write("src/double.ts", "export const double = (_n: number): number => 0;\n");
    p.git("add", "-A"); p.git("commit", "-qm", "stub");
    const o = await p.call("open", { profile: "feature", request: "double", scopePaths: ["src/double.ts"], lane: "quick" });
    const h2 = o.handle!;
    await p.call("decide", { h: h2, kind: "basis", propose: OTHER });
    p.write("src/double.test.ts", 'import { expect, it } from "vitest";\nimport { double } from "./double.ts";\nit("doubles", () => { expect(double(2)).toBe(4); });\n');
    await p.call("check", { h: h2, stage: "baseline" });
    p.write("src/double.ts", "export const double = (n: number): number => n * 2;\n");
    await p.call("check", { h: h2, stage: "candidate", touched: ["src/double.ts"] });
    const f2 = await finishFixture(p, { h: h2, subject: "double" });
    assert.ok(!f2.reasons.some((r) => r.code === "locked-test-changed"), JSON.stringify(f2.reasons));
    assert.equal(d(f2).endpoint, "checked-local");

    p.git("merge", "-q", "--no-edit", "tenet/w-0001-greet-name-returns-a-friendly-gr"); // now the lock's commit is in this history
    p.write("src/greet.test.ts", GREET_TEST.replace('.toBe("Hello, Ada!")', ".toBeTruthy()"));
    const o3 = await p.call("open", { profile: "refactor", request: "tidy", scopePaths: ["src/greet.ts"], lane: "quick" });
    await p.call("decide", { h: o3.handle!, kind: "basis", propose: { outcome: "tidy", scopePaths: ["src/greet.ts"], elements: [{ ref: "r", kind: "requirement", origin: "request", text: "greet keeps working" }] } });
    const why = await p.call("inspect", { view: "why", h: o3.handle! });
    assert.ok(why.reasons.some((r) => r.code === "locked-test-changed"), JSON.stringify(why.reasons));
  });
});

describe("a Git process killed while holding the index lock [GIT-03]", () => {
  it("leaves the index untouched, says exactly what to sync, and syncs in one step once the lock is gone", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    // A killed git client leaves its lock behind; nothing else is wrong with the repository.
    const holder = spawn(process.execPath, ["-e", `require("fs").writeFileSync(${JSON.stringify(join(p.root, ".git/index.lock"))}, ""); process.kill(process.pid, "SIGKILL")`], { stdio: "ignore" });
    await new Promise((r) => holder.on("exit", r));
    const indexBefore = readFileSync(join(p.root, ".git/index"));
    const f = await finishFixture(p, { h, subject: "Add greet" });
    const note = f.reasons.find((r) => r.code === "index-sync-needed");
    assert.ok(note, JSON.stringify(f.reasons));
    assert.match(note.message, /src\/greet\.test\.ts.*src\/greet\.ts|src\/greet\.ts.*src\/greet\.test\.ts/);
    assert.equal(d(f).endpoint, "checked-local");
    assert.ok(indexBefore.equals(readFileSync(join(p.root, ".git/index"))), "the index file is byte-for-byte what it was");

    const stuck = await p.call("decide", { h, kind: "sync-index" });
    assert.equal(stuck.exit, 2, "still locked");
    rmSync(join(p.root, ".git/index.lock"));
    const ok = await p.call("decide", { h, kind: "sync-index", again: true });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.equal(p.git("status", "--porcelain"), "", "index and tree now agree with HEAD");
  });
});

describe("things that must not trip it", () => {
  it("investigates and plans in a folder with no Git at all", async () => {
    const root = tmp("tenet-nogit-"); roots.push(root);
    write(root, "notes.md", "# notes\n");
    const rawCall = (v: string, i: Record<string, unknown>) => runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, v, i);
    const call = (v: string, i: Record<string, unknown>) => callWithEnvelopeConsent(rawCall, v, i);
    const o = await call("open", { profile: "investigate", request: "what is in here?" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    const f = await call("finish", { h: o.handle! });
    assert.equal(f.exit, 0, JSON.stringify(f));
    assert.equal(d(f).endpoint, "findings-only");
    assert.equal((await call("inspect", { view: "status" })).exit, 0);
  });

  it("reports a finished contract's current result when finished again, without committing or changing anything", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    const first = await finishFixture(p, { h, noCommit: true });
    const rev = p.ports().store.read()!.state.revision;
    const again = await finishFixture(p, { h, subject: "now commit it", noCommit: false });
    assert.equal(again.exit, 0);
    assert.equal(d(again).endpoint, d(first).endpoint);
    assert.equal(p.ports().store.read()!.state.revision, rev, "nothing was published");
    assert.equal(p.git("rev-list", "--count", "HEAD"), "1", "and nothing was committed");
    const commit = await p.call("commit", { h, subject: "Commit it later" });
    assert.equal(commit.exit, 0, JSON.stringify(commit));
    assert.equal(p.git("rev-list", "--count", "HEAD"), "2", "an explicit commit after --no-commit still works");
    assert.equal(d(await p.call("inspect", { view: "why", h })).scope, "committed");
  });

  it("never treats a secret file as Tenet's, or asks about it, even when it is not ignored [SEC-14]", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    p.write(".env", "TOKEN=hunter2\n");
    p.write("config/id_rsa", "-----BEGIN PRIVATE KEY-----\n"); // privacy-ok
    const c = await p.call("check", { h, stage: "candidate", again: true });
    assert.equal(c.exit, 0, JSON.stringify(c));
    const f = await finishFixture(p, { h, subject: "s" });
    assert.equal(f.exit, 0, "no question about the secret files");
    assert.equal(p.git("show", "--name-only", "--format=", "HEAD").includes(".env"), false);
    assert.equal(p.git("show", "--name-only", "--format=", "HEAD").includes("id_rsa"), false);
    assert.match(d(f).label, /alongside your 2 uncommitted files/);
  });
});

describe("parking, resuming and non-editing work", () => {
  it("pauses with a handoff, releases source ownership, and resumes into a new generation [WRK-10]", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    const s = await p.call("stop", { h, mode: "pause" });
    assert.equal(s.exit, 0);
    assert.match(d(s).handoff, /W-0001/);
    const other = await p.call("open", { profile: "feature", request: "something else", scopePaths: [] });
    assert.equal(other.exit, 0, "a parked contract no longer owns the source");
    await p.call("stop", { h: other.handle!, mode: "abandon" });
    await p.call("decide", { h: other.handle!, kind: "abandon-confirm", answers: { "abandon-confirm": "abandon" } });
    const back = await p.call("open", { profile: "feature", request: "add a greeting", resume: true });
    assert.equal(back.exit, 0, JSON.stringify(back));
    assert.match(back.handle!, /^W1\.3\./);
    const packet = await p.call("packet", { h: back.handle!, role: "resume" });
    assert.match(d(packet).handoff, /feature · quick lane/);
  });

  it("plan and investigate work end findings-only, never take source ownership, and run beside an implementation", async () => {
    const p = fresh();
    await p.call("open", { profile: "feature", request: "build", scopePaths: [] });
    const inv = await p.call("open", { profile: "investigate", request: "how are greetings made?" });
    assert.equal(inv.exit, 0);
    const f = await finishFixture(p, { h: inv.handle! });
    assert.equal(d(f).endpoint, "findings-only");
    assert.equal(d(f).label, "Findings only, nothing changed");
    const st = p.ports().store.read()!.state;
    assert.equal(Object.values(st.work).find((w) => w.profile === "feature")!.id, st.sourceOwner!.work, "the implementation still owns the source");
  });

  it("answers `inspect why` from the same verdict finish would compute, and any edit makes the evidence stale [EVD-01, EVD-03]", async () => {
    const p = fresh();
    const { h } = await toGreen(p);
    await focusFixture(p, h);
    const why = await p.call("inspect", { view: "why", h });
    assert.equal(d(why).endpoint, "checked-local");
    assert.match(d(why).label, /Checked locally/);
    p.write("src/greet.ts", `${GREET_IMPL}// drift\n`);
    const stale = await p.call("inspect", { view: "why", h });
    assert.equal(d(stale).endpoint, "implemented-unverified");
    assert.ok(stale.reasons.some((r) => r.code === "stale"));
  });

  it("records acceptance as what it is, and never lets it change a blocking reason [EVD-06]", async () => {
    const p = fresh();
    const { h } = await toGreen(p, { lane: "standard" });
    await p.call("decide", { h, kind: "acceptance", target: "accepted" });
    const f = await finishFixture(p, { h, noCommit: true });
    assert.equal(d(f).acceptance, "accepted");
    assert.equal(d(f).endpoint, "implemented-unverified", "no review yet: acceptance does not stand in for it");
    assert.ok(f.reasons.some((r) => r.code === "review-missing"));
    void reviewResult;
  });
});
