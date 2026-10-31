import { chmodSync, existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
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
  it("refuses a linked inverse-patch artifact without changing its target [SEC-06]", async () => {
    const { g, root } = repo(), runDir = tmp(); dirs.push(runDir);
    const target = join(root, "outside"); writeFileSync(target, "preserve me");
    symlinkSync(target, join(runDir, "inverse.patch"));
    await assert.rejects(g.applyPatch("not a patch", [], { runDir, timeoutMs: 1000 }));
    assert.equal(readFileSync(target, "utf8"), "preserve me");
  });
  it("uses custom operation exclusions and tracks excluded inputs by stat [SEC-14]", async () => {
    const { g, root } = repo();
    g.setExclusions([{ pattern: "private/", kinds: ["no-read"] }, { pattern: "src/a.ts", kinds: ["no-model-send"] }]);
    write(root, "private/customer.txt", "private contents");
    const before = await g.inventory([]);
    assert.notEqual(before.entries.get("private/customer.txt")?.blob, gitBlob(Buffer.from("private contents")));
    write(root, "private/customer.txt", "private contents changed");
    assert.notEqual((await g.inventory([])).digest, before.digest);
    write(root, "src/a.ts", "export const a = 9;\n");
    const changes = await g.changes("HEAD", ["src/a.ts", "private/customer.txt"], kind);
    assert.deepEqual(changes, []);
  });
  it("hashes assume-unchanged files instead of trusting the index [EVD-03]", async () => {
    const { g, root } = repo();
    const before = await g.inventory([]);
    git(root, "update-index", "--assume-unchanged", "src/a.ts");
    write(root, "src/a.ts", "export const a = 9;\n");
    const after = await g.inventory([]);
    assert.notEqual(after.digest, before.digest);
    assert.equal(after.entries.get("src/a.ts")?.blob, gitBlob(Buffer.from("export const a = 9;\n")));
  });
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

  it("never reads secret files, only their stat, and ignores .tenet [SEC-14]", async () => {
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
  it("does not read tracked files through a replaced parent-directory symlink [SEC-14]", async () => {
    const { g, root } = repo();
    const outside = tmp(); dirs.push(outside);
    write(outside, "a.ts", "outside private contents\n");
    write(outside, "b.ts", "more private contents\n");
    rmSync(join(root, "src"), { recursive: true });
    symlinkSync(outside, join(root, "src"));
    const inventory = await g.inventory([]);
    assert.notEqual(inventory.entries.get("src/a.ts")?.blob, gitBlob(Buffer.from("outside private contents\n")));
    const changes = await g.changes("HEAD", ["src/new.ts", "src/a.ts"], kind);
    assert.ok(!JSON.stringify(changes).includes("private contents"));
  });
  it("reads a new symlink as a link instead of reading its destination [SEC-14]", async () => {
    const { g, root } = repo();
    const outside = tmp(); dirs.push(outside);
    write(outside, "private", "outside private contents\n");
    symlinkSync(join(outside, "private"), join(root, "link.ts"));
    const changes = await g.changes("HEAD", ["link.ts"], kind);
    assert.ok(!JSON.stringify(changes).includes("outside private contents"));
  });
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
  it("refuses a hook-replaced merge commit before syncing the human index [GIT-03, GIT-12, CON-04]", async () => {
    const { g, root } = repo(), parent = git(root, "rev-parse", "HEAD");
    const side = git(root, "commit-tree", `${parent}^{tree}`, "-p", parent, "-m", "side history");
    write(root, "src/b.ts", "human staged\n"); git(root, "add", "src/b.ts");
    write(root, "src/b.ts", "human staged and unstaged\n");
    const index = readFileSync(join(root, ".git/index"));
    write(root, "src/a.ts", "export const a = 2;\n");
    write(root, ".git/hooks/post-commit", `#!/bin/sh\ncurrent=$(git rev-parse HEAD)\ntree=$(git rev-parse HEAD^{tree})\nreplacement=$(git commit-tree "$tree" -p ${parent} -p ${side} -m replacement)\ngit update-ref HEAD "$replacement" "$current"\n`);
    chmodSync(join(root, ".git/hooks/post-commit"), 0o755);
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "candidate", parent, timeoutMs: 5000 });
    assert.equal(git(root, "show", "-s", "--format=%P", "HEAD").split(" ").length, 2);
    assert.equal(out.ok, false, JSON.stringify(out));
    assert.equal(out.reason, "effect-uncertain");
    assert.equal(out.commit, git(root, "rev-parse", "HEAD"));
    assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    assert.equal(readFileSync(join(root, "src/b.ts"), "utf8"), "human staged and unstaged\n");
  });
  it("never reconciles an extra-parent commit as the planned single-parent effect [CON-03, GIT-03]", async () => {
    for (const changed of [false, true]) {
      const { g, root } = repo(), parent = git(root, "rev-parse", "HEAD");
      const side = git(root, "commit-tree", `${parent}^{tree}`, "-p", parent, "-m", "side history");
      write(root, "src/a.ts", "export const a = 2;\n");
      const expectedTree = await g.expectedTree({ paths: ["src/a.ts"], deleted: [], parent });
      if (changed) write(root, "src/a.ts", "export const a = 3;\n");
      const tree = changed ? await g.expectedTree({ paths: ["src/a.ts"], deleted: [], parent }) : expectedTree;
      const merge = git(root, "commit-tree", tree, "-p", parent, "-p", side, "-m", "Tenet-Work: W-0001");
      git(root, "update-ref", "HEAD", merge, parent);
      const index = readFileSync(join(root, ".git/index"));
      assert.deepEqual(await g.reconcileCommit(parent, expectedTree, ["src/a.ts"], "W-0001"), { completed: false });
      assert.equal(git(root, "rev-parse", "HEAD"), merge);
      assert.deepEqual(readFileSync(join(root, ".git/index")), index);
    }
  });
  it("does not trust replacement history that hides a hook-created extra parent [GIT-03, CON-03]", async () => {
    const { g, root } = repo(), parent = git(root, "rev-parse", "HEAD");
    const side = git(root, "commit-tree", `${parent}^{tree}`, "-p", parent, "-m", "side history");
    write(root, "src/a.ts", "export const a = 2;\n");
    write(root, ".git/hooks/post-commit", `#!/bin/sh\ncurrent=$(git rev-parse HEAD)\ntree=$(git rev-parse HEAD^{tree})\nreplacement=$(git commit-tree "$tree" -p ${parent} -p ${side} -m replacement)\ngit replace "$replacement" "$current"\ngit update-ref HEAD "$replacement" "$current"\n`);
    chmodSync(join(root, ".git/hooks/post-commit"), 0o755);
    const index = readFileSync(join(root, ".git/index"));
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "candidate", parent, timeoutMs: 5000 });
    assert.equal(git(root, "--no-replace-objects", "show", "-s", "--format=%P", "HEAD").split(" ").length, 2);
    assert.equal(out.ok, false, JSON.stringify(out));
    assert.equal(out.reason, "effect-uncertain");
    assert.deepEqual(await g.reconcileCommit(parent, out.expectedTree!, ["src/a.ts"]), { completed: false });
    assert.deepEqual(readFileSync(join(root, ".git/index")), index);
  });
  it("reports foreign committed paths even when replacement history hides their tree [GIT-03, GIT-12]", async () => {
    const { g, root } = repo(), parent = git(root, "rev-parse", "HEAD");
    write(root, "human.txt", "human uncommitted bytes\n");
    write(root, "src/a.ts", "export const a = 2;\n");
    const index = readFileSync(join(root, ".git/index"));
    write(root, ".git/hooks/post-commit", `#!/bin/sh\ncurrent=$(git rev-parse HEAD)\ngit add human.txt\ntree=$(git write-tree)\nreplacement=$(git commit-tree "$tree" -p ${parent} -m replacement)\ngit replace "$replacement" "$current"\ngit update-ref HEAD "$replacement" "$current"\n`);
    chmodSync(join(root, ".git/hooks/post-commit"), 0o755);
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "candidate", parent, timeoutMs: 5000 });
    assert.equal(git(root, "--no-replace-objects", "show", "HEAD:human.txt"), "human uncommitted bytes");
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.foreign, ["human.txt"]);
    assert.notEqual(out.tree, out.expectedTree);
    assert.equal(readFileSync(join(root, "human.txt"), "utf8"), "human uncommitted bytes\n");
    assert.equal(git(root, "show", ":src/b.ts"), "export const b = 1;");
    assert.equal(index.includes(Buffer.from("human.txt")), false);
    assert.equal(git(root, "ls-files", "--", "human.txt"), "");
    assert.deepEqual(await g.reconcileCommit(parent, out.expectedTree!, ["src/a.ts"]), { completed: false });
  });
  it("accepts and reconciles a genuine root commit with no parents [GIT-01, CON-03]", async () => {
    const root = tmp(); dirs.push(root); initRepo(root);
    const g = new GitCli(root);
    write(root, "src/a.ts", "export const a = 1;\n");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "first commit", parent: null, timeoutMs: 5000 });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(git(root, "show", "-s", "--format=%P", "HEAD"), "");
    assert.deepEqual(await g.reconcileCommit(null, out.expectedTree!, ["src/a.ts"]), { completed: true, commit: out.commit });
  });
  it("never removes a different process's index lock after publishing its own index [GIT-03, CON-04]", () => {
    const { root } = repo(), parent = git(root, "rev-parse", "HEAD");
    write(root, "src/a.ts", "export const a = 2;\n"); git(root, "add", "src/a.ts"); git(root, "commit", "-qm", "new HEAD");
    git(root, "read-tree", parent); // recreate the unchanged pre-commit index without moving HEAD or the working tree
    const result = execFileSync(process.execPath, [join(import.meta.dirname, "fixtures/race-index-sync.ts"), root, parent], { encoding: "utf8", env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } });
    assert.match(result, /synced/);
    assert.equal(readFileSync(join(root, ".git/index.lock"), "utf8"), "foreign lock");
  });
  it("refuses an unconsented configured signing program before invoking it [GIT-12]", async () => {
    const { g, root } = repo();
    write(root, "signer", "#!/bin/sh\necho invoked > SIGNER_RAN\nexit 1\n");
    chmodSync(join(root, "signer"), 0o755);
    git(root, "config", "commit.gpgsign", "true");
    git(root, "config", "gpg.program", join(root, "signer"));
    write(root, "src/a.ts", "export const a = 9;\n");
    const parent = git(root, "rev-parse", "HEAD");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "signing requires consent", parent, timeoutMs: 5000 });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "signing-unavailable");
    assert.equal(existsSync(join(root, "SIGNER_RAN")), false);
    assert.equal(git(root, "rev-parse", "HEAD"), parent);
  });
  it("reports a hook's foreign unstaged mutation without reverting it or losing the commit [GIT-12]", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 9;\n");
    write(root, ".git/hooks/pre-commit", "#!/bin/sh\necho 'changed by hook' > README.md\n");
    chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
    const parent = git(root, "rev-parse", "HEAD");
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "foreign hook edit", parent, timeoutMs: 5000 });
    assert.equal(out.ok, true);
    assert.deepEqual(out.foreign, ["README.md"]);
    assert.notEqual(git(root, "rev-parse", "HEAD"), parent);
    assert.equal(readFileSync(join(root, "README.md"), "utf8"), "changed by hook\n");
  });
  for (const path of ["src/line\nbreak.ts", "src/[x].ts"]) it(`syncs the exact literal index entry for ${JSON.stringify(path)} [GIT-03]`, async () => {
    const { g, root } = repo();
    write(root, path, "export const value = 1;\n");
    git(root, "add", "--", path); git(root, "commit", "-qm", "initial unusual path");
    write(root, path, "export const value = 2;\n");
    write(root, "src/b.ts", "export const b = 'human staged';\n");
    git(root, "add", "src/b.ts");
    const human = git(root, "diff", "--cached", "--", "src/b.ts");
    const parent = git(root, "rev-parse", "HEAD");
    const out = await g.commit({ paths: [path], deleted: [], message: "literal path", parent, timeoutMs: 5000 });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.equal(out.indexSync, "synced");
    const index = git(root, "ls-files", "-s", "-z", "--", `:(literal)${path}`);
    assert.equal(index.split(" ")[1], git(root, "hash-object", "--", path));
    assert.equal(git(root, "diff", "--cached", "--", "src/b.ts"), human);
  });
  it("bounds a hanging commit hook and leaves no live hook process [NFR-04, GIT-12]", async () => {
    const { g, root } = repo();
    write(root, "src/a.ts", "export const a = 2;\n");
    write(root, ".git/hooks/pre-commit", "#!/bin/sh\nexec sleep 30\n");
    chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
    const before = await g.inventory([]);
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "bounded", parent: before.head, timeoutMs: 80 });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "hook-failed");
    assert.match(out.detail ?? "", /timeout|timed out/);
    assert.equal(git(root, "rev-parse", "HEAD"), before.head);
  });
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
    assert.equal(out.ok, true, JSON.stringify(out));
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
