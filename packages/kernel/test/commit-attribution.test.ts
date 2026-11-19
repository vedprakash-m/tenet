import { after, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { GitCli } from "../src/adapters/git-cli.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
function repository() {
  const root = tmp("tenet-attribution-"); roots.push(root); initRepo(root);
  write(root, "a.txt", "initial\n"); git(root, "add", "a.txt"); git(root, "commit", "-qm", "initial");
  return { root, adapter: new GitCli(root) };
}

for (const message of [
  "Subject\n\nTenet-Work: W-0001\n\nNot a trailer",
  "Subject\nTenet-Work: W-0001",
  "Subject\n\nTenet-Work: W-0001\nTenet-Work: W-0001",
  "Subject\n\nTenet-Work: W-0001\nTenet-Work: W-0002",
  "Subject\n\nTenet-Work: W-0001\n continuation",
  "Tenet-Work: W-0001",
  "Subject\n\nTenet-Work: W-0001\nTENET-WORK: W-0001",
]) it(`rejects non-exact work trailer ${JSON.stringify(message)} [GIT-03]`, async () => {
  const { root, adapter } = repository();
  git(root, "commit", "--allow-empty", "--cleanup=verbatim", "-qm", message);
  assert.deepEqual((await adapter.workCommits("W-0001")).commits, []);
});

for (const label of ["W-[0001]", "W-.*", "W-0001"]) {
  it(`discovers literal ${label} with hostile trailer configuration [GIT-03]`, async () => {
    const { root, adapter } = repository();
    git(root, "config", "trailer.Tenet-Work.command", "touch SHOULD-NOT-RUN");
    git(root, "commit", "--allow-empty", "--cleanup=verbatim", "-qm",
      `Subject\n\nTenet-Work: ${label}\nTenet-Req: REQ-001\nCo-authored-by: Test <test@example.com>`);
    const own = git(root, "rev-parse", "HEAD");
    git(root, "commit", "--allow-empty", "-qm", "Different\n\nTenet-Work: W-9999");
    assert.deepEqual((await adapter.workCommits(label)).commits, [own]);
    assert.equal(existsSync(join(root, "SHOULD-NOT-RUN")), false);
  });
}

for (const suffix of [" ", "\t"]) {
  it(`physical verification rejects raw trailing ${JSON.stringify(suffix)} in a work value [GIT-03]`, async () => {
    const { root, adapter } = repository();
    const parent = git(root, "rev-parse", "HEAD"), tree = git(root, "rev-parse", "HEAD^{tree}");
    git(root, "commit", "--allow-empty", "--cleanup=verbatim", "-qm", `Subject\n\nTenet-Work: W-0001${suffix}`);
    assert.equal(await adapter.verifyCommit({
      version: 1, workspace: "parser", work: "parser", generation: 1, run: "parser", label: "W-0001",
      ref: "refs/heads/main", parent, parents: [parent], commit: git(root, "rev-parse", "HEAD"),
      expectedTree: tree, observedTree: tree, paths: [], foreign: [],
    }), false);
  });
}
