import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import type { Envelope } from "../../dist/core/output.js";
import type { OnboardResult } from "../../dist/onboard/assignment.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

function inventoryOnly(cwd: string) {
  const child = spawnSync(process.execPath, [cli, "onboard", "--inventory-only", "--json"], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
  assert.ifError(child.error);
  return { status: child.status, envelope: JSON.parse(child.stdout) as Envelope<OnboardResult> };
}

test("inventory-only JSON agrees with the process exit status", async (t) => {
  const repo = await tmpRepo("onboard-status");
  t.after(repo.cleanup);
  await repo.write("tenet.yaml", "{}\n");
  repo.git(["add", "tenet.yaml"]);
  repo.git(["commit", "-qm", "configure onboarding"]);

  const success = inventoryOnly(repo.path);
  assert.equal(success.status, 0);
  assert.equal(success.envelope.ok, true);
  assert.deepEqual(success.envelope.errors, []);

  await repo.write("tenet.yaml", "[]\n");
  const failure = inventoryOnly(repo.path);
  assert.equal(failure.status, 1);
  assert.equal(failure.envelope.ok, false);
  assert.deepEqual(failure.envelope.errors.map(({ code, message, fix }) => ({ code, message, fix })), [{
    code: "TN-POLICY-SCHEMA",
    message: "tenet.yaml does not match the alpha.0 schema: / must be object.",
    fix: "Fix tenet.yaml or remove fields that are not available in alpha.0.",
  }]);
});

test("inventory-only uses onboarding defaults before tenet.yaml exists", async (t) => {
  const repo = await tmpRepo("onboard-defaults");
  t.after(repo.cleanup);
  await repo.write("src/ready.ts", "export const ready = true;\n");
  repo.git(["add", "src/ready.ts"]);
  repo.git(["commit", "-qm", "first source"]);

  const { status, envelope } = inventoryOnly(repo.path);
  assert.equal(status, 0);
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.errors, []);
  assert.deepEqual(envelope.result.inventory.sources.files.map(({ path }) => path), ["src/ready.ts"]);
  assert.ok(envelope.result.findings.some(({ kind, path }) => kind === "no-test-report" && path === "tenet.yaml"));
  const output = await readFile(path.join(repo.path, envelope.result.assignment.inventory), "utf8");
  assert.deepEqual(JSON.parse(output), envelope.result.inventory);
  await assert.rejects(readFile(path.join(repo.path, "tenet.yaml")), { code: "ENOENT" });
});
