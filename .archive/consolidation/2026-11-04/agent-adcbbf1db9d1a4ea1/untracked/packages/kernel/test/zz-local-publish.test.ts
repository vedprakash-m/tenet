// `publish push` (TS §6.5, §10.6, GIT-05) against a real local bare repository: remote actions only on explicit request,
// bound to remote URL, branch and exact commit, refused when any of them changed, and reconciled with `git ls-remote`.
// The contract's commits are recorded by the test, not produced by a check run: this file is about the remote, not about
// what makes work finishable.
import { spawn } from "node:child_process";
import { chmodSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, git, tmp } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const BRANCH = "tenet/w-0001-greet";
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const codes = (r: { reasons: Array<{ code: string }> }) => r.reasons.map((x) => x.code);

/** A project with a contract, a real bare repository as `origin`, and one commit that belongs to the contract. */
async function fresh() {
  const p = project(); roots.push(p.root);
  const bare = tmp("tenet-remote-"); roots.push(bare);
  git(bare, "init", "--bare", "-q", "-b", "main");
  p.git("remote", "add", "origin", bare);
  const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
  assert.equal(o.exit, 0, JSON.stringify(o));
  const h = o.handle!;
  const commit = await workCommit(p, "first");
  return { p, bare, h, commit };
}

/** A real commit in the project, recorded as a commit of the contract the way `commit` records its own. */
async function workCommit(p: Project, name: string): Promise<string> {
  p.write(`src/${name}.txt`, `${name}\n`);
  p.git("add", "-A"); p.git("commit", "-qm", name);
  const sha = p.git("rev-parse", "HEAD");
  await p.ports().store.transaction("test", async (tx) => {
    const st = tx.state!, w = Object.values(st.work)[0]!;
    tx.publish({ ...st, work: { ...st.work, [w.id]: { ...w, git: { ...w.git, commits: [...w.git.commits, sha] } } } });
  });
  return sha;
}

const remoteRef = (bare: string, branch = BRANCH): string | null => {
  try { return git(bare, "rev-parse", "--verify", "-q", `refs/heads/${branch}`); } catch { return null; }
};
const workOf = (p: Project) => Object.values(p.ports().store.read()!.state.work)[0]!;
const ask = (p: Project, h: string, extra: Record<string, unknown> = {}) =>
  p.call("decide", { h, kind: "remote", target: "origin", propose: { branch: BRANCH }, ...extra });
/** The user's whole decision: the kernel asks in chat, the user says "push". */
async function allow(p: Project, h: string) {
  const q = await ask(p, h);
  assert.equal(q.exit, 3, JSON.stringify(q));
  const a = await ask(p, h, { answers: { "remote-confirm": "push" }, quote: "push it" });
  assert.equal(a.exit, 0, JSON.stringify(a));
  return a;
}

describe("decide remote: the binding [GIT-05]", () => {
  it("asks in chat first, shows remote, branch and commit, and records nothing until the user answers [GIT-05]", async () => {
    const { p, h, commit, bare } = await fresh();
    const q = await ask(p, h);
    assert.equal(q.exit, 3, JSON.stringify(q));
    assert.equal(q.questions![0]!.id, "remote-confirm");
    assert.equal(q.questions![0]!.channel, "chat");
    assert.ok(codes(q).includes("approval-gate"), "approval mode is unknown, so the gate is labelled advisory");
    for (const fact of [commit.slice(0, 7), "origin", BRANCH, bare]) assert.ok(q.questions![0]!.question.includes(fact), fact);
    assert.deepEqual(workOf(p).grants.filter((g) => g.actions.includes("remote")), []);
    assert.equal(remoteRef(bare), null, "asking pushes nothing");
  });
  it("records a remote grant that holds the bound facts and the user's own words once the user says push [GIT-05]", async () => {
    const { p, h, commit, bare } = await fresh();
    const a = await allow(p, h);
    assert.deepEqual(d(a).remote, { name: "origin", url: bare, branch: BRANCH, commit });
    assert.equal(a.next[0]!.action, "publish");
    const g = workOf(p).grants.find((x) => x.actions.includes("remote"))!;
    assert.deepEqual(g.remote, { name: "origin", url: bare, branch: BRANCH, commit });
    assert.equal(g.quote, "push it");
    assert.equal(g.source, "decide");
    assert.equal(g.capture, "reported");
    assert.equal(p.ports().store.read()!.state.pending.length, 0);
  });
  it("records nothing when the user cancels [GIT-05]", async () => {
    const { p, h } = await fresh();
    await ask(p, h);
    const c = await ask(p, h, { answers: { "remote-confirm": "cancel" } });
    assert.equal(c.exit, 0, JSON.stringify(c));
    assert.deepEqual(workOf(p).grants.filter((g) => g.actions.includes("remote")), []);
    assert.equal(p.ports().store.read()!.state.pending.length, 0);
  });
  it("asks again instead of recording when a bound fact changed after the question was shown [GIT-05]", async () => {
    const { p, h } = await fresh();
    await ask(p, h);
    await workCommit(p, "second");
    const a = await ask(p, h, { answers: { "remote-confirm": "push" } });
    assert.equal(a.exit, 2, JSON.stringify(a));
    assert.ok(codes(a).includes("revision-conflict"));
    assert.deepEqual(workOf(p).grants.filter((g) => g.actions.includes("remote")), []);
  });
  it("answers with no question open as a conflict, and a wrong answer as a usage error [GIT-05]", async () => {
    const { p, h } = await fresh();
    assert.equal((await ask(p, h, { answers: { "remote-confirm": "push" } })).exit, 2);
    await ask(p, h);
    assert.equal((await ask(p, h, { answers: { "remote-confirm": "maybe" } })).exit, 1);
  });
  it("refuses a remote that does not exist, a missing target, and a branch name Git or an option parser could misread [GIT-05]", async () => {
    const { p, h } = await fresh();
    assert.equal((await ask(p, h, { target: "nowhere" })).exit, 2);
    assert.equal((await p.call("decide", { h, kind: "remote" })).exit, 1);
    for (const branch of ["-x", "a b", "x:y", "+main", "a..b"]) {
      const r = await ask(p, h, { propose: { branch } });
      assert.equal(r.exit, 2, `${branch}: ${JSON.stringify(r)}`);
    }
    assert.equal(p.ports().store.read()!.state.pending.length, 0);
  });
  it("refuses when the contract has no commit yet [GIT-05]", async () => {
    const p = project(); roots.push(p.root);
    p.git("remote", "add", "origin", tmp("tenet-remote-"));
    const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
    const r = await p.call("decide", { h: o.handle!, kind: "remote", target: "origin" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(codes(r).includes("continue-required"));
  });
  it("shows and records the remote URL without credentials [GIT-05]", async () => {
    const { p, h } = await fresh();
    p.git("remote", "add", "hosted", "https://alice:s3cretpassword@example.invalid/x.git"); // privacy-ok: synthetic URL credentials used only to test redaction
    const q = await ask(p, h, { target: "hosted" });
    assert.equal(q.exit, 3, JSON.stringify(q));
    assert.match(q.questions![0]!.question, /https:\/\/example\.invalid\/x\.git/);
    await ask(p, h, { target: "hosted", answers: { "remote-confirm": "push" } });
    assert.doesNotMatch(readFileSync(join(p.root, ".tenet/state"), "utf8"), /s3cretpassword|alice/);
    assert.doesNotMatch(JSON.stringify(q), /s3cretpassword|alice/);
  });
});

describe("publish push [GIT-05]", () => {
  it("refuses without a bound remote decision and pushes nothing [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.ok(codes(r).includes("authority-needed"));
    assert.equal(r.next[0]!.action, "decision");
    assert.equal(git(bare, "for-each-ref"), "", "the remote has no refs");
  });
  it("refuses while the question is only asked and not yet answered [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await ask(p, h);
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 3);
    assert.equal(git(bare, "for-each-ref"), "");
  });
  it("pushes exactly the bound commit to refs/heads/<branch> and nothing else [GIT-05]", async () => {
    const { p, h, commit, bare } = await fresh();
    await allow(p, h);
    const later = p.git("rev-parse", "HEAD");
    p.write("src/user-edit.txt", "mine\n"); p.git("add", "-A"); p.git("commit", "-qm", "the user's own commit");
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.deepEqual(d(r).pushed, { name: "origin", url: bare, branch: BRANCH, commit });
    assert.equal(remoteRef(bare), commit);
    assert.equal(commit, later, "the bound commit is the contract's, not the user's newer HEAD");
    assert.deepEqual(git(bare, "for-each-ref", "--format=%(refname)").split("\n"), [`refs/heads/${BRANCH}`]);
    assert.equal(workOf(p).session.inCall, undefined, "the run is closed");
  });
  it("journals the push as an intent and a completed result [GIT-05]", async () => {
    const { p, h, commit } = await fresh();
    await allow(p, h);
    await p.call("publish", { h, kind: "push" });
    const log = p.ports().store.readLog().filter((e) => e.effect === "publish");
    assert.deepEqual(log.map((e) => e.kind), ["intent", "result"]);
    assert.equal((log[0] as any).op.commit, commit);
    assert.equal((log[1] as any).outcome.completed, true);
  });
  it("answers an identical retry from the record, and pushes the same commit again as a no-op when asked to [GIT-05]", async () => {
    const { p, h, commit, bare } = await fresh();
    await allow(p, h);
    await p.call("publish", { h, kind: "push" });
    assert.equal((await p.call("publish", { h, kind: "push" })).historical, true);
    const again = await p.call("publish", { h, kind: "push", again: true });
    assert.equal(again.exit, 0, JSON.stringify(again));
    assert.equal(remoteRef(bare), commit);
  });
  it("refuses when the contract's commit changed since the user agreed, and says which commits [GIT-05]", async () => {
    const { p, h, commit, bare } = await fresh();
    await allow(p, h);
    const next = await workCommit(p, "second");
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.ok(codes(r).includes("authority-needed"));
    const why = r.reasons.map((x) => x.message).join(" ");
    assert.ok(why.includes(commit.slice(0, 7)) && why.includes(next.slice(0, 7)), why);
    assert.equal(remoteRef(bare), null);
  });
  it("refuses when the remote's URL changed since the user agreed [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    const other = tmp("tenet-remote-"); roots.push(other);
    git(other, "init", "--bare", "-q", "-b", "main");
    p.git("remote", "set-url", "origin", other);
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.match(r.reasons.map((x) => x.message).join(" "), /URL of origin/);
    assert.equal(git(other, "for-each-ref"), "");
    assert.equal(git(bare, "for-each-ref"), "");
  });
  it("refuses when the remote was removed since the user agreed [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    p.git("remote", "remove", "origin");
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(git(bare, "for-each-ref"), "");
  });
  it("refuses a different branch or remote than the one the user agreed to [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    p.git("remote", "add", "upstream", bare);
    const branch = await p.call("publish", { h, kind: "push", branch: "main" });
    assert.equal(branch.exit, 3, JSON.stringify(branch));
    assert.match(branch.reasons.map((x) => x.message).join(" "), /branch main/);
    const remote = await p.call("publish", { h, kind: "push", remote: "upstream" });
    assert.equal(remote.exit, 3, JSON.stringify(remote));
    assert.equal(git(bare, "for-each-ref"), "");
    const same = await p.call("publish", { h, kind: "push", remote: "origin", branch: BRANCH });
    assert.equal(same.exit, 0, "naming exactly what was agreed is allowed");
  });
  it("never forces: a branch the remote moved elsewhere is rejected and left as it was [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    const other = tmp("tenet-other-"); roots.push(other);
    git(other, "clone", "-q", bare, "x");
    const x = join(other, "x");
    git(x, "config", "user.name", "T"); git(x, "config", "user.email", "t@example.com"); git(x, "config", "commit.gpgsign", "false");
    git(x, "switch", "-q", "-c", BRANCH);
    git(x, "commit", "-q", "--allow-empty", "-m", "someone else");
    git(x, "push", "-q", "origin", BRANCH);
    const theirs = git(x, "rev-parse", "HEAD");
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.equal(remoteRef(bare), theirs, "the remote branch was not touched");
    const log = p.ports().store.readLog().filter((e) => e.effect === "publish");
    assert.equal((log.at(-1) as any).outcome.completed, false);
    assert.equal(workOf(p).session.inCall, undefined);
  });
  it("answers `pr` as not built and pushes nothing [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    const r = await p.call("publish", { h, kind: "pr" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(codes(r).includes("capability-missing"));
    assert.equal(git(bare, "for-each-ref"), "");
  });
  it("rejects an unknown kind of remote action as a usage error [GIT-05]", async () => {
    const { p, h } = await fresh();
    assert.equal((await p.call("publish", { h, kind: "merge" })).exit, 1);
    assert.equal((await p.call("publish", { h })).exit, 1);
  });
  it("refuses while Git hooks exist, because running them needs a consent path that is not built [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    p.write(".git/hooks/pre-push", "#!/bin/sh\nprintf ran > pre-push-ran\n");
    chmodSync(join(p.root, ".git/hooks/pre-push"), 0o755);
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(codes(r).includes("capability-missing"));
    assert.equal(existsSync(join(p.root, "pre-push-ran")), false);
    assert.equal(git(bare, "for-each-ref"), "");
  });
  it("gives a fresh answer after the facts change, not the record of an earlier call [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    await p.call("publish", { h, kind: "push" });
    const next = await workCommit(p, "second");
    const stale = await p.call("publish", { h, kind: "push" });
    assert.equal(stale.exit, 3, "the new commit is not covered by the old agreement");
    assert.equal(remoteRef(bare) === next, false);
    await allow(p, h);
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(remoteRef(bare), next);
  });
});

describe("an interrupted push is reconciled with git ls-remote [GIT-05]", () => {
  const crash = (p: Project, h: string, point: "before" | "after") =>
    new Promise<string | null>((resolve) => {
      const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-publish.ts"), p.root, JSON.stringify({ h, kind: "push" }), point], { stdio: "ignore" });
      child.on("exit", (_c, signal) => resolve(signal));
    });

  it("learns that a push which landed before the result was written is done, and does not push twice [GIT-05]", async () => {
    const { p, h, commit, bare } = await fresh();
    await allow(p, h);
    await crash(p, h, "after");
    assert.equal(remoteRef(bare), commit, "the push had reached the remote");
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(r.effects?.completed.some((e) => /had reached the remote/.test(e)), JSON.stringify(r.effects));
    const log = p.ports().store.readLog().filter((e) => e.effect === "publish");
    assert.deepEqual(log.map((e) => e.kind), ["intent", "result", "intent", "result"], "one recovery result, then the retry's own record");
    assert.equal((log[1] as any).outcome.completed, true);
  });
  it("learns that a push killed before it reached the remote did not happen [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    await crash(p, h, "before");
    assert.equal(remoteRef(bare), null);
    const retry = await p.call("publish", { h, kind: "push" });
    assert.equal(retry.exit, 0, JSON.stringify(retry));
    assert.ok(retry.effects?.completed.some((e) => /did not happen/.test(e)), JSON.stringify(retry.effects));
    assert.ok(remoteRef(bare), "the retry pushed it");
  });
  it("fences dependent work and keeps the intent open when the remote cannot be read [GIT-05]", async () => {
    const { p, h, bare } = await fresh();
    await allow(p, h);
    await crash(p, h, "after");
    p.git("remote", "set-url", "origin", join(bare, "gone"));
    const r = await p.call("publish", { h, kind: "push" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(codes(r).includes("effect-uncertain"));
    const log = p.ports().store.readLog().filter((e) => e.effect === "publish");
    assert.deepEqual(log.map((e) => e.kind), ["intent"], "the intent stays open until the remote can be read");
  });
});
