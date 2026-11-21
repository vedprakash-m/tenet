// Direct Git integration controls for pinned tips, expected conflict images and durable proof.
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, it } from "node:test";
import { GitCli } from "../src/adapters/git-cli.ts";
import { writeIntegrationProof } from "../src/adapters/git-integrate.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fixture = () => {
  const root = tmp();
  roots.push(root);
  initRepo(root);
  write(root, "INTENT.md", "base\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "base");
  return { root, adapter: new GitCli(root) };
};

it("pins base/work tips and publishes a durable proof before ref publication [GIT-09, CON-12]", async () => {
  const { root, adapter } = fixture();
  const baseTip = git(root, "rev-parse", "main");
  git(root, "switch", "-qc", "tenet/work");
  write(root, "INTENT.md", "work\n");
  git(root, "commit", "-qam", "work");
  const workTip = git(root, "rev-parse", "HEAD");
  const runDir = tmp();
  roots.push(runDir);
  const result = await adapter.integrate("main", "tenet/work", { baseTip, workTip, runDir, timeoutMs: 30_000 });
  assert.deepEqual([result.ok, result.mode], [true, "fast-forward"]);
  assert.equal(git(root, "branch", "--show-current"), "main");
  const proof = JSON.parse(readFileSync(join(runDir, "integration.json"), "utf8"));
  assert.deepEqual(
    { baseTip: proof.baseTip, workTip: proof.workTip, commit: proof.commit, branch: git(root, "branch", "--show-current") },
    { baseTip, workTip, commit: result.commit, branch: "main" },
  );
});

it("accepts Git's exact conflicted result, not a human-modified surrogate, before writing the proposal [GIT-09]", async () => {
  const { root, adapter } = fixture();
  git(root, "switch", "-qc", "tenet/work");
  write(root, "INTENT.md", "work\n");
  git(root, "commit", "-qam", "work");
  const workTip = git(root, "rev-parse", "HEAD");
  git(root, "switch", "-q", "main");
  write(root, "INTENT.md", "target\n");
  git(root, "commit", "-qam", "target");
  const baseTip = git(root, "rev-parse", "HEAD");
  git(root, "switch", "-q", "tenet/work");
  const runDir = tmp();
  roots.push(runDir);
  const result = await adapter.integrate("main", "tenet/work", {
    baseTip, workTip, runDir, timeoutMs: 30_000,
    resolved: { files: { "INTENT.md": "confirmed merge\n" }, conflicted: ["INTENT.md"] },
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.mode, "merge");
  assert.equal(readFileSync(join(root, "INTENT.md"), "utf8"), "confirmed merge\n");
  assert.equal(existsSync(join(runDir, "integration.json")), true);
});

it("reconciles a detached proven commit as uncertain until the base branch is published [CON-12]", async () => {
  const { root, adapter } = fixture();
  const baseTip = git(root, "rev-parse", "main");
  git(root, "switch", "-qc", "tenet/work");
  write(root, "INTENT.md", "work\n");
  git(root, "commit", "-qam", "work");
  const workTip = git(root, "rev-parse", "HEAD");
  const runDir = tmp();
  roots.push(runDir);
  writeIntegrationProof(runDir, {
    base: "main", baseTip, work: "tenet/work", workTip, commit: workTip,
    tree: git(root, "rev-parse", `${workTip}^{tree}`),
  });
  git(root, "switch", "-qd", workTip);
  const before = await adapter.reconcileIntegration("main", baseTip, workTip, runDir, undefined, "tenet/work", "tenet/work", workTip);
  assert.equal(before.completed, false);
  assert.equal(before.merging, true);
  git(root, "update-ref", "refs/heads/main", workTip, baseTip);
  git(root, "switch", "-q", "main");
  const after = await adapter.reconcileIntegration("main", baseTip, workTip, runDir, undefined, "tenet/work", "tenet/work", workTip);
  assert.deepEqual([after.completed, after.mode], [true, "fast-forward"]);
});
