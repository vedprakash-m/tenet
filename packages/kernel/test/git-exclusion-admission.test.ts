import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { GitCli } from "../src/adapters/git-cli.ts";
import { KernelError } from "../src/core/errors.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const repo = () => {
  const root = tmp(); roots.push(root); initRepo(root);
  write(root, "public", "permitted file\n");
  git(root, "add", "."); git(root, "commit", "-qm", "initial");
  return { root, adapter: new GitCli(root) };
};

describe("Git exclusion admission", () => {
  it("refuses a restricted link identity rather than reading or hashing its target [SEC-08, SEC-14]", async () => {
    const { root, adapter } = repo();
    write(root, "private-target", "synthetic restricted fixture");
    symlinkSync("private-target", join(root, ".ENV"));
    const index = readFileSync(join(root, ".git", "index"));
    await assert.rejects(adapter.inventory([]),
      error => error instanceof KernelError && error.reasons[0]?.code === "capability-missing");
    assert.deepEqual(readFileSync(join(root, ".git", "index")), index);
    assert.equal(readFileSync(join(root, "private-target"), "utf8"), "synthetic restricted fixture");
  });

  it("omits model-ineligible case aliases before generating whole-file or diff content [SEC-08]", async () => {
    const { root, adapter } = repo();
    adapter.setExclusions([{ pattern: "private/**", kinds: ["no-model-send"] }]);
    write(root, "PRIVATE/file", "synthetic restricted fixture");
    write(root, ".ENV", "synthetic restricted fixture");
    const index = readFileSync(join(root, ".git", "index"));
    assert.deepEqual(await adapter.changes("HEAD", ["PRIVATE/file", ".ENV"], () => "source"), []);
    assert.deepEqual(readFileSync(join(root, ".git", "index")), index);
  });

  it("keeps a real unmerged path unresolved without retaining conflict-stage OIDs [GIT-03]", async () => {
    const { root, adapter } = repo();
    const oid = git(root, "rev-parse", "HEAD:public");
    git(root, "update-index", "--force-remove", "public");
    execFileSync("git", ["update-index", "--index-info"], {
      cwd: root, input: [1, 2, 3].map(stage => `100644 ${oid} ${stage}\tpublic\n`).join(""),
    });
    const index = readFileSync(join(root, ".git", "index"));
    const inventory = await adapter.inventory([]);
    assert.equal(inventory.status.find(row => row.path === "public")?.indexBlob, "");
    assert.equal((await adapter.probe()).state, "readonly");
    assert.deepEqual(readFileSync(join(root, ".git", "index")), index);
  });
});
