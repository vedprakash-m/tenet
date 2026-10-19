import { chmodSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli, gitBlob } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const dirs: string[] = [];
function repo() {
  const root = tmp();
  dirs.push(root);
  initRepo(root);
  write(root, "src/a.ts", "export const a = 1;\n");
  write(root, "src/b.ts", "export const b = 1;\n");
  write(root, "README.md", "# demo\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  return { root, g: new GitCli(root) };
}
after(() => dirs.forEach(cleanup));
const kind = (p: string) => (p.endsWith(".test.ts") ? "test" as const : "source" as const);

describe("git: probe and inventory", () => {
  it("reports repository state, and a non-repository", async () => {
    const { g, root } = repo();
    const p = await g.probe();
    assert.equal(p.isRepo, true);
    assert.equal(p.state, "ok");
    assert.equal(p.branch, "main");
    git(root, "checkout", "-q", "--detach");
    assert.equal((await g.probe()).state, "readonly");
    const bare = tmp(); dirs.push(bare);
    assert.equal((await new GitCli(bare).probe()).isRepo, false);
  });

  it("hashes dirty and untracked files like git and changes the digest with any edit", async () => {
    const { g, root } = repo();
    const clean = await g.inventory([]);
    write(root, "src/a.ts", "export const a = 2;\n");
    write(root, "src/new.ts", "export const n = 1;\n");
    const dirty = await g.inventory([]);
    assert.notEqual(clean.digest, dirty.digest);
    assert.equal(dirty.entries.get("src/new.ts")!.blob, git(root, "hash-object", "src/new.ts"));
    assert.equal(dirty.entries.get("src/a.ts")!.blob, gitBlob(Buffer.from("export const a = 2;\n")));
    assert.deepEqual(dirty.status.map((s) => s.path).sort(), ["src/a.ts", "src/new.ts"]);
    write(root, "src/a.ts", "export const a = 1;\n");
    rmFile(root, "src/new.ts");
    assert.equal((await g.inventory([])).digest, clean.digest);
  });

  it("never reads secret files, only their stat, and ignores .tenet", async () => {
    const { g, root } = repo();
    write(root, ".env", "TOKEN=abc\n");
    write(root, ".tenet/state", "{}");
    const inv = await g.inventory([]);
    assert.ok(!inv.entries.has(".tenet/state"));
    const d1 = inv.digest;
    write(root, ".env", "TOKEN=abcd\n");
    assert.notEqual((await g.inventory([])).digest, d1, "a stat change is a change");
  });
});

describe("git: changes", () => {
  it("returns hunks for modified, new and deleted files", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 2;\nexport const z = 3;\n");
    write(root, "src/new.test.ts", "it('x', () => {});\n");
    rmFile(root, "src/b.ts");
    const ch = await g.changes("HEAD", ["src/a.ts", "src/new.test.ts", "src/b.ts"], kind);
    const by = Object.fromEntries(ch.map((c) => [c.path, c]));
    assert.equal(by["src/a.ts"]!.added, 2);
    assert.equal(by["src/a.ts"]!.removed, 1);
    assert.equal(by["src/new.test.ts"]!.kind, "test");
    assert.equal(by["src/b.ts"]!.removed, 1);
  });
});

describe("git: commit through a temporary index", () => {
  it("commits only Tenet paths and preserves every human staged and unstaged entry byte for byte [GIT-03]", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 2;\n");            // Tenet
    write(root, "src/b.ts", "export const b = 'human staged';\n"); // human, staged
    git(root, "add", "src/b.ts");
    write(root, "src/b.ts", "export const b = 'human staged then edited';\n"); // human, unstaged on top
    write(root, "README.md", "# demo edited by human\n");          // human, unstaged
    const before = await g.inventory([]);
    const stagedBefore = git(root, "diff", "--cached", "--", "src/b.ts");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "tenet: change a", parent: before.head, timeoutMs: 60000 });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.foreign, []);
    assert.equal(out.indexSync, "synced");
    assert.equal(git(root, "show", "--name-only", "--format=", "HEAD"), "src/a.ts");
    assert.equal(git(root, "diff", "--cached", "--", "src/b.ts"), stagedBefore, "human staged hunk untouched");
    assert.equal(git(root, "diff", "--name-only"), "README.md\nsrc/b.ts");
    assert.equal(git(root, "status", "--porcelain", "src/a.ts"), "", "committed path is clean in index and tree");
    assert.equal(readFileSync(join(root, "README.md"), "utf8"), "# demo edited by human\n");
  });

  it("leaves a path the human staged differently untouched", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 'human';\n");
    git(root, "add", "src/a.ts");                                   // human staged content X
    write(root, "src/a.ts", "export const a = 'tenet';\n");        // Tenet's candidate is Y
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "m", parent: git(root, "rev-parse", "HEAD"), timeoutMs: 1000 });
    assert.equal(out.ok, true);
    assert.equal(git(root, "show", "HEAD:src/a.ts"), "export const a = 'tenet';");
    assert.equal(git(root, "show", ":src/a.ts"), "export const a = 'human';", "the user's staged entry is never changed");
  });

  it("does not sync, and reports untouched, while another process holds index.lock", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 2;\n");
    writeFileSync(join(root, ".git/index.lock"), "");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "m", parent: git(root, "rev-parse", "HEAD"), timeoutMs: 1000 });
    assert.equal(out.ok, true);
    assert.equal(out.indexSync, "untouched");
    assert.deepEqual(out.syncPaths, ["src/a.ts"]);
  });

  it("keeps the commit and reports a path a hook staged that is not Tenet's", async () => {
    const { g, root } = repo();
    write(root, ".git/hooks/pre-commit", "#!/bin/sh\necho x > hook-made.txt\ngit add hook-made.txt\n");
    chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
    write(root, "src/a.ts", "export const a = 2;\n");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "m", parent: git(root, "rev-parse", "HEAD"), timeoutMs: 1000 });
    assert.equal(out.ok, true);
    assert.deepEqual(out.foreign, ["hook-made.txt"]);
  });

  it("classifies a failing hook and leaves HEAD where it was", async () => {
    const { g, root } = repo();
    write(root, ".git/hooks/pre-commit", "#!/bin/sh\necho nope >&2\nexit 1\n");
    chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
    write(root, "src/a.ts", "export const a = 2;\n");
    const head = git(root, "rev-parse", "HEAD");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "m", parent: head, timeoutMs: 1000 });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "hook-failed");
    assert.equal(git(root, "rev-parse", "HEAD"), head);
  });

  it("reconciles a commit that landed before its result was recorded, and one that did not", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 2;\n");
    const parent = git(root, "rev-parse", "HEAD");
    const notYet = await g.reconcileCommit(parent, "deadbeef", ["src/a.ts"]);
    assert.equal(notYet.completed, false);
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "m", parent, timeoutMs: 1000 });
    const done = await g.reconcileCommit(parent, out.expectedTree!, ["src/a.ts"]);
    assert.deepEqual(done, { completed: true, commit: out.commit });
  });
});

const rmFile = (root: string, rel: string) => rmSync(join(root, rel), { force: true });
