// Real hook managers (husky and lint-staged, which stashes and rewrites files) beside a person's staged and unstaged work.
// Needs the network to install them; set TENET_OFFLINE=1 to skip.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("husky and lint-staged [GIT-03]", { skip: process.env.TENET_OFFLINE === "1" && "offline", timeout: 180_000 }, () => {
  it("run on the temporary index: the commit holds only Tenet's file, and the person's staged and unstaged edits are untouched", async () => {
    const root = tmp("tenet-hooks-"); roots.push(root);
    initRepo(root);
    write(root, "package.json", JSON.stringify({ name: "hk", private: true, scripts: { prepare: "husky" }, "lint-staged": { "*.txt": "node fmt.cjs" } }));
    write(root, "fmt.cjs", 'const fs=require("fs");for(const f of process.argv.slice(2))fs.writeFileSync(f,fs.readFileSync(f,"utf8").toUpperCase());\n');
    write(root, ".gitignore", "node_modules\n");
    execFileSync("npm", ["install", "-D", "husky@9", "lint-staged@16"], { cwd: root, stdio: "pipe" });
    execFileSync("npx", ["husky", "init"], { cwd: root, stdio: "pipe" });
    writeFileSync(join(root, ".husky/pre-commit"), "npx lint-staged\n");
    for (const f of ["a.txt", "b.txt", "c.txt"]) write(root, f, "base\n");
    git(root, "add", "-A");
    git(root, "commit", "-qm", "init");

    write(root, "a.txt", "tenet\n");            // Tenet's
    write(root, "b.txt", "human unstaged\n");   // the person's, unstaged
    write(root, "c.txt", "human staged\n");     // the person's, staged ...
    git(root, "add", "c.txt");
    write(root, "c.txt", "human staged\nhuman unstaged on top\n"); // ... with more on top
    const stagedBefore = git(root, "diff", "--cached", "--", "c.txt");

    const g = new GitCli(root);
    assert.equal((await g.probe()).hooks !== null, true, "the hook configuration is seen");
    const out = await g.commit({ paths: ["a.txt"], deleted: [], message: "tenet: a", parent: git(root, "rev-parse", "HEAD"), timeoutMs: 60000 });
    assert.equal(out.ok, true, JSON.stringify(out));
    assert.deepEqual(out.foreign, []);
    assert.equal(git(root, "show", "--name-only", "--format=", "HEAD"), "a.txt");
    assert.equal(git(root, "show", "HEAD:a.txt"), "TENET", "the hook's formatting is in the commit");
    assert.notEqual(out.tree, out.expectedTree, "and the commit differs from the planned tree on Tenet's file, which is how the kernel knows to recheck");
    assert.equal(readFileSync(join(root, "b.txt"), "utf8"), "human unstaged\n");
    assert.equal(readFileSync(join(root, "c.txt"), "utf8"), "human staged\nhuman unstaged on top\n");
    assert.equal(git(root, "diff", "--cached", "--", "c.txt"), stagedBefore, "the person's staged hunk is unchanged");
    assert.equal(git(root, "stash", "list"), "", "no stash is left behind");
  });
});
