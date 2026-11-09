// Inherited Git repository variables (GIT_DIR, GIT_WORK_TREE, GIT_INDEX_FILE, ...) never redirect the kernel or its tools.
import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { realpathSync } from "node:fs";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { withoutGitLocalVars } from "../src/adapters/git-env.ts";
import { GitCli } from "../src/adapters/git-cli.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));
function repo(file: string, content: string): string {
  const root = tmp();
  dirs.push(root);
  initRepo(root);
  write(root, file, content);
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  return root;
}

describe("inherited Git repository variables", () => {
  it("are removed whatever their case; other variables are kept", () => {
    const env = { GIT_DIR: "x", git_work_tree: "y", Git_Index_File: "z", GIT_CONFIG_PARAMETERS: "'a.b'='c'", GIT_CONFIG_GLOBAL: "g", PATH: "p" };
    assert.deepEqual(withoutGitLocalVars(env), { GIT_CONFIG_GLOBAL: "g", PATH: "p" });
  });

  it("do not move GitCli to another repository", async () => {
    const a = repo("a.txt", "a\n");
    const b = repo("b.txt", "b\n");
    const headA = git(a, "rev-parse", "HEAD");
    const saved = { dir: process.env.GIT_DIR, tree: process.env.GIT_WORK_TREE };
    process.env.GIT_DIR = join(b, ".git");
    process.env.GIT_WORK_TREE = b;
    try {
      const probe = await new GitCli(a).probe();
      assert.equal(realpathSync(probe.top!), realpathSync(a));
      assert.equal(probe.head, headA);
    } finally {
      if (saved.dir === undefined) delete process.env.GIT_DIR; else process.env.GIT_DIR = saved.dir;
      if (saved.tree === undefined) delete process.env.GIT_WORK_TREE; else process.env.GIT_WORK_TREE = saved.tree;
    }
  });

  it("do not give the privacy check a clean result from another repository", () => {
    const a = repo("a.txt", "a\n");
    const b = repo("b.txt", "b\n");
    write(a, "leak.ts", `export const t = "${"ghp_" + "x".repeat(30)}";\n`);
    git(a, "add", "leak.ts");
    const tool = join(import.meta.dirname, "..", "..", "..", "tools", "privacy-check.ts");
    const r = spawnSync(process.execPath, [tool], {
      cwd: a, encoding: "utf8", env: { ...process.env, GIT_DIR: join(b, ".git"), GIT_WORK_TREE: b, GIT_INDEX_FILE: join(b, ".git", "index") },
    });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stderr, /leak\.ts:1: a token/);
  });
});
