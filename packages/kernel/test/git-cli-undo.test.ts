// The Git side of undo against real Git (GIT-04, undo-confirmation §7): rename endpoints, affected-path admission,
// fixed patch prefixes and the checked apply's refusal and uncertain outcomes.
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const dirs: string[] = [];
after(() => {
  for (const dir of dirs) {
    try { chmodSync(join(dir, "b"), 0o755); } catch { /* absent */ }
    cleanup(dir);
  }
});
const posixUser = process.platform !== "win32" && process.getuid?.() !== 0;

function repo(files: Record<string, string>, change: (root: string) => void) {
  const root = tmp();
  dirs.push(root);
  initRepo(root);
  for (const [path, content] of Object.entries(files)) write(root, path, content);
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");
  change(root);
  git(root, "add", "-A");
  git(root, "commit", "-qm", "work\n\nTenet-Work: W-0001");
  return { root, git: new GitCli(root), work: git(root, "rev-parse", "HEAD").trim() };
}

async function plan(git: GitCli, work: string) {
  const { head, branch } = await git.pinHead();
  const planned = await git.planUndo([work], head);
  assert.ok(planned.ok, JSON.stringify(planned));
  const pre = await git.blobsAt(head, planned.paths);
  const post = await git.blobsAt(planned.tree, planned.paths);
  const runDir = tmp();
  dirs.push(runDir);
  return { ...planned, head, branch, pre, post, runDir, timeoutMs: 30_000 };
}

const renamed = () => repo({ "a.ts": "export const a = 1;\n" }, (root) => git(root, "mv", "a.ts", "b.ts"));

describe("undo paths and checks [GIT-04]", () => {
  it("[GIT-04] E3/E4: both rename endpoints are affected, whatever diff.renames says", async () => {
    const { root, git: adapter, work } = renamed();
    git(root, "config", "diff.renames", "true");
    assert.deepEqual(await adapter.undoNames([work]), ["a.ts", "b.ts"]);
    const planned = await plan(adapter, work);
    assert.deepEqual(planned.paths, ["a.ts", "b.ts"]);
    writeFileSync(join(root, "b.ts"), "export const a = 2;\n");
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["b.ts"]);
    git(root, "add", "b.ts");
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["b.ts"]);
  });

  it("[GIT-04] E5: a staged rename plus a recreated ignored old path refuses without effects", async () => {
    const { root, git: adapter, work } = renamed();
    const planned = await plan(adapter, work);
    git(root, "mv", "b.ts", "c.ts");
    writeFileSync(join(root, "b.ts"), "export const a = 1;\n");
    writeFileSync(join(root, ".git", "info", "exclude"), "b.ts\n", { flag: "a" });
    const index = readFileSync(join(root, ".git", "index"));
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["b.ts"]);
    const result = await adapter.applyUndo(planned);
    assert.deepEqual({ ok: result.ok, uncertain: !!result.uncertain }, { ok: false, uncertain: false });
    assert.equal(readFileSync(join(root, "b.ts"), "utf8"), "export const a = 1;\n");
    assert.ok(existsSync(join(root, "c.ts")));
    assert.equal(existsSync(join(root, "a.ts")), false);
    assert.deepEqual(readFileSync(join(root, ".git", "index")), index);
  });

  it("[GIT-04] P117: a linked run-directory ancestor cannot receive an inverse patch",
    { skip: process.platform === "win32" }, async () => {
      const { root, git: adapter, work } = renamed();
      const planned = await plan(adapter, work);
      const outside = tmp();
      dirs.push(outside);
      const linkedRunDir = join(root, "linked-run");
      symlinkSync(outside, linkedRunDir);
      const result = await adapter.applyUndo({ ...planned, runDir: linkedRunDir });
      assert.deepEqual({ ok: result.ok, uncertain: !!result.uncertain }, { ok: false, uncertain: false });
      assert.match(result.detail ?? "", /linked|directory identity/);
      assert.equal(existsSync(join(outside, "inverse.patch")), false);
    });

  it("[GIT-04] E8: a created path whose parent is an untracked file refuses", async () => {
    const { root, git: adapter, work } = repo(
      { "src/x.ts": "x\n", "keep.ts": "k\n" }, (path) => rmSync(join(path, "src"), { recursive: true }),
    );
    const planned = await plan(adapter, work);
    writeFileSync(join(root, "src"), "a file where the folder was\n");
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["src/x.ts"]);
  });

  it("[GIT-04] refuses a tracked symlink during preview because recovery cannot admit its post-image",
    { skip: process.platform === "win32" }, async () => {
      const { git: adapter, work } = repo({}, (path) => symlinkSync("target", join(path, "link")));
      const planned = await plan(adapter, work);
      assert.deepEqual(planned.paths, ["link"]);
      assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["link"]);
    });

  it("[GIT-04] refuses an inverse whose target tree recreates a tracked symlink",
    { skip: process.platform === "win32" }, async () => {
      const root = tmp();
      dirs.push(root);
      initRepo(root);
      symlinkSync("target", join(root, "link"));
      git(root, "add", "link");
      git(root, "commit", "-qm", "base");
      rmSync(join(root, "link"));
      writeFileSync(join(root, "link"), "regular\n");
      git(root, "add", "link");
      git(root, "commit", "-qm", "work\n\nTenet-Work: W-0001");
      const work = git(root, "rev-parse", "HEAD").trim();
      const adapter = new GitCli(root);
      const planned = await adapter.planUndo([work], (await adapter.pinHead()).head);
      assert.equal(planned.ok, false);
      if (!planned.ok) assert.match(planned.detail, /symlink|unsupported mode/);
    });

  it("[GIT-04] E9/E20: assume-unchanged, skip-worktree, linked and ignored ancestors refuse", async () => {
    const files = { "src/a.ts": "a\n", "src/b.ts": "b\n", "gen/c.ts": "c\n", "lib/d.ts": "d\n" };
    const { root, git: adapter, work } = repo(files, (path) => {
      for (const file of Object.keys(files)) writeFileSync(join(path, file), "changed\n");
      rmSync(join(path, "gen"), { recursive: true });
      rmSync(join(path, "lib"), { recursive: true });
    });
    const planned = await plan(adapter, work);
    git(root, "update-index", "--assume-unchanged", "src/a.ts");
    writeFileSync(join(root, "src/a.ts"), "mine\n");
    git(root, "update-index", "--skip-worktree", "src/b.ts");
    if (process.platform !== "win32") {
      mkdirSync(join(root, "elsewhere"));
      symlinkSync(join(root, "elsewhere"), join(root, "gen"));
    }
    mkdirSync(join(root, "lib"));
    writeFileSync(join(root, "lib/d.ts"), "mine\n");
    writeFileSync(join(root, ".git", "info", "exclude"), "lib/\n", { flag: "a" });
    const expected = [
      "lib/d.ts", "src/a.ts", "src/b.ts", ...(process.platform === "win32" ? [] : ["gen/c.ts"]),
    ].sort();
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), expected);
  });

  it("[GIT-04] E16: a human commit between owned commits is disclosed", async () => {
    const root = tmp();
    dirs.push(root);
    initRepo(root);
    write(root, "f.ts", "1\n2\n3\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "base");
    const commit = (text: string, message: string) => {
      write(root, "f.ts", text);
      git(root, "commit", "-qam", message);
      return git(root, "rev-parse", "HEAD").trim();
    };
    const first = commit("one\n2\n3\n", "w1\n\nTenet-Work: W-0001");
    commit("one\ntwo\n3\n", "human");
    const second = commit("one\ntwo\nthree\n", "w2\n\nTenet-Work: W-0001");
    const adapter = new GitCli(root);
    const later = await adapter.laterCommits([second, first], first, (await adapter.pinHead()).head, ["f.ts"]);
    assert.equal(later.length, 1);
    assert.match(later[0]!, / human$/);
  });

  it("[GIT-04] E18: user diff prefixes and context settings cannot move the patch", async () => {
    const { root, git: adapter, work } = repo(
      { "src/a/x.ts": "export const x = 1;\n" },
      (path) => writeFileSync(join(path, "src/a/x.ts"), "export const x = 2;\n"),
    );
    writeFileSync(join(root, "a"), "untracked file named like the stripped path\n");
    for (const [key, value] of [
      ["diff.noprefix", "true"], ["diff.srcPrefix", "x/y/"], ["diff.context", "0"],
    ] as const) {
      git(root, "config", key, value);
      const planned = await plan(adapter, work);
      assert.match(planned.patch, /^diff --git a\/src\/a\/x\.ts b\/src\/a\/x\.ts$/m, key);
      git(root, "config", "--unset", key);
    }
    const result = await adapter.applyUndo(await plan(adapter, work));
    assert.ok(result.ok, JSON.stringify(result));
    assert.equal(readFileSync(join(root, "src/a/x.ts"), "utf8"), "export const x = 1;\n");
    assert.equal(readFileSync(join(root, "a"), "utf8"), "untracked file named like the stripped path\n");
  });

  it("[GIT-04] E19: a write failure after an earlier path is uncertain", { skip: !posixUser }, async () => {
    const { root, git: adapter, work } = repo(
      { "a/1.txt": "1\n", "b/2.txt": "2\n", "b/keep.txt": "k\n" },
      (path) => { rmSync(join(path, "a/1.txt")); rmSync(join(path, "b/2.txt")); },
    );
    const planned = await plan(adapter, work);
    const run = adapter["runner"].run.bind(adapter["runner"]);
    adapter["runner"].run = async (spec: Parameters<typeof run>[0]) => {
      chmodSync(join(root, "b"), 0o555);
      return run(spec);
    };
    try {
      const result = await adapter.applyUndo(planned);
      assert.deepEqual(
        { ok: result.ok, uncertain: result.uncertain }, { ok: false, uncertain: true }, JSON.stringify(result),
      );
    } finally {
      chmodSync(join(root, "b"), 0o755);
    }
    assert.ok(existsSync(join(root, "a/1.txt")), "the earlier write landed");
  });

  it("[GIT-04] E23/E25: conversion/filter attributes refuse before the filter runs", async () => {
    const { root, git: adapter, work } = repo(
      { "f.txt": "1\n", "t.txt": "1\n" },
      (path) => { writeFileSync(join(path, "f.txt"), "2\n"); writeFileSync(join(path, "t.txt"), "2\n"); },
    );
    const canary = join(root, "..", `smudge-ran-${process.pid}`);
    git(root, "config", "filter.mark.smudge", `sh -c 'touch ${canary}; cat'`);
    writeFileSync(join(root, ".git", "info", "attributes"), "f.txt filter=mark\nt.txt text eol=crlf\n");
    const planned = await plan(adapter, work);
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["f.txt", "t.txt"]);
    const result = await adapter.applyUndo(planned);
    assert.equal(result.ok, false);
    assert.equal(existsSync(canary), false);
    writeFileSync(join(root, ".git", "info", "attributes"), "");
    git(root, "config", "core.autocrlf", "true");
    assert.deepEqual(await adapter.undoObstructions(planned.head, planned.paths), ["f.txt", "t.txt"]);
  });

  it("[GIT-04] E24: an out-of-context edit at spawn is preserved and makes the result uncertain", async () => {
    const lines = Array.from({ length: 30 }, (_, i) => `${i + 1}`);
    const { root, git: adapter, work } = repo(
      { "n.txt": `${lines.join("\n")}\n` },
      (path) => writeFileSync(join(path, "n.txt"), `${lines.map((line) => line === "5" ? "five" : line).join("\n")}\n`),
    );
    const planned = await plan(adapter, work);
    const run = adapter["runner"].run.bind(adapter["runner"]);
    adapter["runner"].run = async (spec: Parameters<typeof run>[0]) => {
      const now = readFileSync(join(root, "n.txt"), "utf8").replace("\n25\n", "\nUSER-EDIT\n");
      writeFileSync(join(root, "n.txt"), now);
      return run(spec);
    };
    const result = await adapter.applyUndo(planned);
    assert.deepEqual({ ok: result.ok, uncertain: result.uncertain }, { ok: false, uncertain: true });
    assert.match(readFileSync(join(root, "n.txt"), "utf8"), /\nUSER-EDIT\n/);
    assert.equal(git(root, "rev-parse", "HEAD").trim(), work);
  });
});
