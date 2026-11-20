import { after, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
function repository() {
  const root = tmp("tenet-recovery-"); roots.push(root); initRepo(root);
  write(root, "a.txt", "initial\n"); git(root, "add", "a.txt"); git(root, "commit", "-qm", "initial");
  return { root, adapter: new GitCli(root) };
}
it("proves only a complete unchanged named-ref interval, never moved-and-returned [CON-12]", async () => {
  const { root, adapter } = repository();
  const captured = await adapter.commitContext();
  const parent = git(root, "rev-parse", "HEAD");
  const intent = { ...captured, parent };
  assert.equal(await adapter.commitUnmoved(intent), true);
  git(root, "commit", "--allow-empty", "-qm", "human\n\nTenet-Work: W-0001");
  const candidate = git(root, "rev-parse", "HEAD");
  assert.equal(await adapter.commitUnmoved(intent), false);
  git(root, "update-ref", captured.ref, parent, candidate);
  assert.equal(await adapter.commitUnmoved(intent), false);
});
it("inspects the origin ref without switching the checkout [CON-12]", async () => {
  const { root, adapter } = repository();
  const captured = await adapter.commitContext(), parent = git(root, "rev-parse", "HEAD");
  git(root, "checkout", "-qb", "elsewhere");
  const index = readFileSync(join(root, ".git", "index"));
  assert.equal(await adapter.commitUnmoved({ ...captured, parent }), true);
  assert.equal(git(root, "branch", "--show-current"), "elsewhere");
  assert.deepEqual(readFileSync(join(root, ".git", "index")), index);
});
it("refuses a no-move conclusion after reflog expiry [CON-12]", async () => {
  const { root, adapter } = repository();
  const captured = await adapter.commitContext(), parent = git(root, "rev-parse", "HEAD");
  git(root, "reflog", "expire", "--expire=all", "--all");
  assert.equal(await adapter.commitUnmoved({ ...captured, parent }), false);
});
it("does not admit detached commits or invent unborn reflog evidence [GIT-03, CON-12]", async () => {
  const { root, adapter } = repository();
  git(root, "checkout", "--detach", "-q");
  await assert.rejects(adapter.commitContext(), /detached/);
  git(root, "checkout", "--orphan", "newborn", "-q");
  const captured = await adapter.commitContext();
  assert.equal(captured.ref, "refs/heads/newborn");
  assert.equal(await adapter.commitUnmoved({ ...captured, parent: null }), false);
});
for (const damage of ["missing", "rewritten", "bounded"]) {
  it(`refuses ${damage} reflog history even at the original parent [CON-12]`, async () => {
    const { root, adapter } = repository();
    const captured = await adapter.commitContext(), parent = git(root, "rev-parse", "HEAD");
    const log = join(root, ".git", "logs", "refs", "heads", "main");
    if (damage === "missing") rmSync(log);
    if (damage === "rewritten") writeFileSync(log, readFileSync(log, "utf8").replace("initial", "changed"));
    if (damage === "bounded") writeFileSync(log, "x".repeat(1_048_577));
    assert.equal(await adapter.commitUnmoved({ ...captured, parent }), false);
    assert.equal(git(root, "rev-parse", "HEAD"), parent);
  });
}
it("refuses a reflog change between its two immediate observations [CON-12]", async () => {
  const { root, adapter } = repository();
  const captured = await adapter.commitContext(), parent = git(root, "rev-parse", "HEAD");
  const observe = adapter.observeCommit.bind(adapter);
  let reads = 0;
  adapter.observeCommit = async intent => {
    const seen = await observe(intent);
    if (++reads === 1) git(root, "reflog", "expire", "--expire=all", "--all");
    return seen;
  };
  assert.equal(await adapter.commitUnmoved({ ...captured, parent }), false);
  assert.equal(reads, 2);
});
