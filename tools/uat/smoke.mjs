import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, spawnSync } from "node:child_process";

const source = fileURLToPath(new URL("../../", import.meta.url));
const staged = mkdtempSync(join(tmpdir(), "tenet-uat-payload-"));
const selected = process.env.TENET_TEST_BUNDLE;
if (!selected) cpSync(join(source, "plugin"), staged, {
  recursive: true,
  filter: (path) => !path.split(/[\\/]/).includes("node_modules"),
});
const bundle = selected ?? join(staged, "kernel/tenet.mjs");
const roots = [staged];
const env = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  TENET_TEST_INSTALLED_METADATA: "github-actions-posix-v1",
  TENET_TEST_INSTALLED_METADATA_WORKSPACE: source,
};
delete env.NODE_OPTIONS;
const call = (root, verb, body = {}) => {
  const readsBody = ["open", "decide", "findings"].includes(verb);
  const args = readsBody ? [] : Object.entries(body).flatMap(([key, value]) => [
    `--${key.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`)}`,
    typeof value === "object" ? JSON.stringify(value) : String(value),
  ]);
  const run = spawnSync(process.execPath, [bundle, verb, ...args], { cwd: root, env, input: readsBody ? JSON.stringify(body) : "", encoding: "utf8" });
  assert.equal(run.signal, null, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(run.status, result.exit, run.stderr);
  return result;
};

try {
  const root = mkdtempSync(join(tmpdir(), "tenet-uat-smoke-"));
  roots.push(root);
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: root, env });
  execFileSync("git", ["config", "user.name", "Test"], { cwd: root, env });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: root, env });
  execFileSync("git", ["config", "commit.gpgsign", "false"], { cwd: root, env });
  writeFileSync(join(root, "package.json"), '{"name":"smoke","type":"module","private":true}\n');
  writeFileSync(join(root, "tsconfig.json"), '{"compilerOptions":{"strict":true}}\n');
  writeFileSync(join(root, ".gitignore"), "node_modules\n.tenet/\n");
  symlinkSync(join(source, "node_modules"), join(root, "node_modules"));
  execFileSync("git", ["add", "-A"], { cwd: root, env });
  execFileSync("git", ["commit", "-qm", "initial"], { cwd: root, env });
  const help = call(root, "inspect", { view: "help" });
  assert.equal(help.exit, 0);
  const doctor = call(root, "inspect", { view: "doctor" });
  assert.ok([0, 2].includes(doctor.exit), JSON.stringify(doctor));
  if (doctor.exit === 2) {
    assert.ok(typeof doctor.data.readiness.plugin.ready === "boolean");
    assert.ok(typeof doctor.data.readiness.project.ready === "boolean");
  }
  const artifact = readFileSync(bundle);
  assert.equal(dirname(bundle).length > 0, true);
  process.stdout.write(`${JSON.stringify({
    version: 1,
    runtime: process.version,
    source: {
      commit: process.env.GITHUB_SHA ?? null,
      workflow: process.env.GITHUB_WORKFLOW ?? null,
      workflowRef: process.env.GITHUB_WORKFLOW_REF ?? null,
      runId: process.env.GITHUB_RUN_ID ?? null,
      runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      ref: process.env.GITHUB_REF ?? null,
    },
    bundle: { bytes: artifact.length, sha256: createHash("sha256").update(artifact).digest("hex") },
    observations: [
      { id: "bundle-help", status: "pass" },
      { id: "bundle-doctor", status: "pass" },
    ],
  }, null, 2)}\n`);
} finally {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
}
