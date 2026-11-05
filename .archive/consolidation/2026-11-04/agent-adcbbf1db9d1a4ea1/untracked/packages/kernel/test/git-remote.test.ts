// The Git adapter's remote commands (TS §10.6, GIT-05) against a real local bare repository: no mocks, no network.
import { chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { ProcessRunner } from "../src/adapters/runner.ts";
import { systemClock } from "../src/adapters/system.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const dir = (prefix: string) => { const d = tmp(prefix); roots.push(d); return d; };
const opts = () => ({ runDir: dir("tenet-run-"), timeoutMs: 60_000 });
const refOf = (repo: string, ref: string): string | null => { try { return git(repo, "rev-parse", "--verify", "-q", ref); } catch { return null; } };

describe("remote commands of the Git adapter [GIT-05]", () => {
  let repo = "", bare = "", first = "", second = "", port: GitCli;
  before(() => {
    repo = dir("tenet-g-");
    initRepo(repo);
    write(repo, "a.txt", "one\n");
    git(repo, "add", "-A"); git(repo, "commit", "-qm", "one");
    first = git(repo, "rev-parse", "HEAD");
    write(repo, "a.txt", "two\n");
    git(repo, "commit", "-qam", "two");
    second = git(repo, "rev-parse", "HEAD");
    bare = dir("tenet-bare-");
    git(bare, "init", "--bare", "-q", "-b", "main");
    git(repo, "remote", "add", "origin", bare);
    port = new GitCli(repo, new ProcessRunner(systemClock, { PATH: process.env.PATH, HOME: process.env.HOME }));
  });

  it("reads the URL a push would use, and nothing for a remote that does not exist [GIT-05]", async () => {
    assert.equal(await port.pushUrl("origin"), bare);
    assert.equal(await port.pushUrl("nowhere"), null);
  });
  it("removes credentials from the URL it reports [GIT-05]", async () => {
    git(repo, "remote", "add", "hosted", "https://alice:s3cretpassword@example.invalid/x.git"); // privacy-ok: synthetic URL credentials used only to test redaction
    const url = await port.pushUrl("hosted");
    assert.equal(url, "https://example.invalid/x.git");
    assert.doesNotMatch(String(url), /s3cret|alice/);
  });
  it("shows no branch for a remote that has none, and a branch it cannot read as unreadable [GIT-05]", async () => {
    assert.deepEqual(await port.remoteBranch("origin", "feature", opts()), { commit: null });
    assert.equal(await port.remoteBranch("nowhere", "feature", opts()), null);
  });
  it("pushes exactly the named commit to refs/heads/<branch>, not HEAD, and reads it back [GIT-05]", async () => {
    const r = await port.push("origin", first, "feature", opts());
    assert.equal(r.result, "ok", r.detail);
    assert.equal(refOf(bare, "refs/heads/feature"), first, "the older commit arrived, not HEAD");
    assert.equal(refOf(bare, `${second}^{commit}`), null, "the newer commit was not sent");
    assert.deepEqual(await port.remoteBranch("origin", "feature", opts()), { commit: first });
    assert.deepEqual(git(bare, "for-each-ref", "--format=%(refname)").split("\n"), ["refs/heads/feature"], "no other ref was created");
  });
  it("pushes a descendant as a fast-forward and repeats a push that is already there [GIT-05]", async () => {
    assert.equal((await port.push("origin", second, "feature", opts())).result, "ok");
    assert.equal(refOf(bare, "refs/heads/feature"), second);
    assert.equal((await port.push("origin", second, "feature", opts())).result, "ok", "an identical push is a no-op");
  });
  it("never forces: a push that would rewrite the remote branch is rejected and the branch stays [GIT-05]", async () => {
    const r = await port.push("origin", first, "feature", opts());
    assert.equal(r.result, "rejected");
    assert.ok(r.detail, "git's own words are kept");
    assert.equal(refOf(bare, "refs/heads/feature"), second);
  });
  it("does not run a pre-push hook, which nobody consented to [GIT-05]", async () => {
    write(repo, ".git/hooks/pre-push", "#!/bin/sh\nprintf ran > pre-push-ran\nexit 1\n");
    chmodSync(join(repo, ".git/hooks/pre-push"), 0o755);
    const r = await port.push("origin", second, "other", opts());
    assert.equal(r.result, "ok", r.detail);
    assert.equal(existsSync(join(repo, "pre-push-ran")), false);
    assert.equal(existsSync(join(repo, ".git", "pre-push-ran")), false);
  });
  it("reports a remote it cannot reach as rejected, never as ok [GIT-05]", async () => {
    git(repo, "remote", "add", "gone", join(bare, "does-not-exist"));
    assert.equal((await port.push("gone", second, "feature", opts())).result, "rejected");
  });
});
