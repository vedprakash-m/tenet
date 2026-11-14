import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { after, it } from "node:test";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const grader = resolve(import.meta.dirname, "../../../eval/golden/lib/grade.mjs");
const task = resolve(import.meta.dirname, "../../../eval/golden/resume-config-preserve-staging");
const human = 'export const preferences = { theme: "dark", contrast: "high" };\n';
const env = { PATH: process.env.PATH ?? "", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null", GIT_CONFIG_NOSYSTEM: "1" };
const git = (cwd: string, args: string[], extra: Record<string, string> = {}) => execFileSync("git", args, { cwd, env: { ...env, ...extra }, encoding: "utf8" }).trim();

function workdir() {
  const dir = tmp("tenet-grader-git-"); roots.push(dir);
  mkdirSync(join(dir, "src"));
  writeFileSync(join(dir, "src/preferences.mjs"), 'export const preferences = { theme: "light" };\n');
  git(dir, ["init", "-q", "-b", "main"]);
  git(dir, ["-c", "user.name=T", "-c", "user.email=t@example.test", "add", "."]);
  git(dir, ["-c", "user.name=T", "-c", "user.email=t@example.test", "commit", "-qm", "base"]);
  writeFileSync(join(dir, "src/preferences.mjs"), human);
  return dir;
}
function staging(dir: string, extra: Record<string, string>) {
  const r = spawnSync(process.execPath, [grader, task, dir, "--base", git(dir, ["rev-parse", "HEAD"])], { env: { ...process.env, ...extra }, encoding: "utf8" });
  return JSON.parse(r.stdout).checks.find((c: { id: string }) => c.id === "human-staging-preserved").pass;
}

it("grader Git checks read the requested repository's own index, not an inherited GIT_INDEX_FILE (P89)", () => {
  const dir = workdir(), other = tmp("tenet-grader-index-"), alt = join(other, "index");
  roots.push(other);
  git(dir, ["read-tree", "HEAD"], { GIT_INDEX_FILE: alt });
  git(dir, ["add", "src/preferences.mjs"], { GIT_INDEX_FILE: alt });
  assert.equal(staging(dir, { GIT_INDEX_FILE: alt }), false);
  git(dir, ["add", "src/preferences.mjs"]);
  assert.equal(staging(dir, {}), true);
});
