// Repository layouts Tenet must name before implementing (GIT-13, TS §10.8): shallow clones, submodules, LFS, linked worktrees.
// Real Git repositories. The other states (detached HEAD, rebase, merge, conflicts) are covered in git.test.ts and refusals.test.ts.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { cleanup, initRepo, tmp, write } from "./helpers.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const ENV = { PATH: process.env.PATH, HOME: process.env.HOME, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const g = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "protocol.file.allow=always", "-c", "user.name=t", "-c", "user.email=t@example.com", ...args], { cwd, encoding: "utf8", env: ENV }).trim();
const repo = (): string => {
  const root = tmp("tenet-layout-");
  roots.push(root);
  initRepo(root);
  write(root, "package.json", '{"name":"fx","type":"module","private":true}\n');
  write(root, "a.ts", "export const a = 1;\n");
  g(root, "add", "-A");
  g(root, "commit", "-qm", "init");
  return root;
};
const open = (root: string, input: Record<string, unknown> = {}) =>
  runVerb(createPorts(root, { PATH: process.env.PATH, HOME: process.env.HOME }), VERBS, "open", { profile: "plan", request: "plan the work", ...input });
const layout = (r: { reasons: Array<{ code: string }> }) => r.reasons.map((x) => x.code).filter((c) => c.startsWith("repo-") && c !== "repo-state-readonly");

describe("repository layouts are named, not guessed [GIT-13]", () => {
  it("a plain repository carries none of the layout notes", async () => {
    assert.deepEqual(layout(await open(repo())), []);
  });

  it("a shallow clone is allowed and says its history is incomplete", async () => {
    const origin = repo();
    write(origin, "b.ts", "export const b = 2;\n");
    g(origin, "add", "-A"); g(origin, "commit", "-qm", "second");
    const parent = tmp("tenet-shallow-");
    roots.push(parent);
    g(parent, "clone", "-q", "--depth", "1", `file://${origin}`, "c");
    const r = await open(join(parent, "c"));
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.deepEqual(layout(r), ["repo-shallow"]);
    assert.match(r.reasons.find((x) => x.code === "repo-shallow")!.message, /undo/i);
  });

  it("a repository with submodules names them, and refuses an editing contract scoped inside one", async () => {
    const lib = repo();
    const root = repo();
    g(root, "submodule", "add", "-q", `file://${lib}`, "vendor/lib");
    g(root, "commit", "-qm", "add submodule");
    const plan = await open(root);
    assert.deepEqual(layout(plan), ["repo-submodule"]);
    assert.match(plan.reasons.find((x) => x.code === "repo-submodule")!.message, /vendor\/lib/);
    const inside = await open(root, { profile: "feature", request: "change the vendored library", scopePaths: ["vendor/lib/a.ts"] });
    assert.equal(inside.exit, 1, JSON.stringify(inside));
    assert.equal(inside.reasons[0]!.code, "capability-missing");
    assert.match(inside.reasons[0]!.message, /submodule/);
    const outside = await open(root, { profile: "feature", request: "change our code", scopePaths: ["a.ts"] });
    assert.notEqual(outside.reasons[0]?.code, "capability-missing", JSON.stringify(outside.reasons));
  });

  it("LFS-tracked files are named, with the consequence for commits", async () => {
    const root = repo();
    write(root, ".gitattributes", "*.bin filter=lfs diff=lfs merge=lfs -text\n");
    g(root, "add", "-A"); g(root, "commit", "-qm", "lfs");
    const r = await open(root);
    assert.ok(layout(r).includes("repo-lfs"), JSON.stringify(r.reasons));
  });

  it("a linked worktree is named as experimental, scoped to that worktree", async () => {
    const root = repo();
    const linked = join(tmp("tenet-wt-"), "wt");
    roots.push(linked);
    g(root, "worktree", "add", "-q", "-b", "side", linked);
    const r = await open(linked);
    assert.deepEqual(layout(r), ["repo-linked-worktree"]);
    assert.deepEqual(layout(await open(root)), [], "the main worktree is not linked");
  });
});
