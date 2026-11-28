import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { sha256 } from "../../dist/core/hash.js";
import type { Envelope } from "../../dist/core/output.js";
import type { OnboardResult } from "../../dist/onboard/assignment.js";
import { onboardingCard } from "../../dist/onboard/card.js";
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

test("onboarding counts only guidance outside versioned AGENTS.md blocks", async (t) => {
  const repo = await tmpRepo("onboard-agents-block");
  t.after(repo.cleanup);
  const managed = "<!-- tenet:begin v0.1.0-alpha.0 -->\nGenerated Tenet instructions.\n<!-- tenet:end -->\n";
  await repo.write("AGENTS.md", managed);
  await repo.write("packages/service/AGENTS.md", "# Project guidance\n\n" + managed);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "record managed and user guidance"]);

  const { status, envelope } = inventoryOnly(repo.path);
  assert.equal(status, 0);
  assert.deepEqual(envelope.result.inventory.sources.files.map(({ path, kind }) => [path, kind]), [
    ["AGENTS.md", "config"],
    ["packages/service/AGENTS.md", "instructions"],
  ]);
});

test("installed skills and manifest-owned files stay out of docs, findings, and the card", async (t) => {
  const repo = await tmpRepo("onboard-installed-files");
  t.after(repo.cleanup);
  const skill = ".agents/skills/tenet-draft-specs/SKILL.md";
  const installed = "docs/tenet-setup.md";
  const edited = "docs/maintainer.md";
  const intent = "tenet/intent.md";
  const stock = "# Installed instructions\n[Not generated yet](.tenet/onboard/assignment.json)\n";
  const draft = [
    "---",
    'tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: owner}',
    "sections:",
    "  requirements: {state: draft, digest: null, flags: []}",
    "---",
    "## Requirements",
    "- R-1 Apply the repository policy. {origin: asked}",
    "",
  ].join("\n");
  await repo.write("tenet.yaml", "{}\n");
  await repo.write(skill, stock);
  await repo.write(".claude/skills/tenet-draft-specs/SKILL.md", stock);
  await repo.write(installed, stock);
  await repo.write(edited, "# Maintainer guidance\n[Project link](missing-project-file.md)\n");
  await repo.write(intent, draft);
  await repo.write(".tenet/manifest.json", JSON.stringify({
    schema_version: 1,
    version: "0.1.0-alpha.0",
    created: [
      { path: installed, sha256: sha256(stock) },
      { path: edited, sha256: sha256(stock) },
      { path: intent, sha256: sha256(draft) },
    ],
    blocks: [],
    keys: [],
  }));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "commit installed and project content"]);

  const { status, envelope } = inventoryOnly(repo.path);
  assert.equal(status, 0);
  const { inventory, findings } = envelope.result;
  assert.deepEqual(inventory.docs.map(({ path }) => path), [edited, intent]);
  assert.deepEqual(findings.filter(({ kind }) => kind === "dead-path").map(({ path }) => path), [edited]);
  const card = await onboardingCard({ cwd: repo.path });
  const readLine = card.split("\n").find((line) => line.startsWith("Available to the drafter:"));
  assert.equal(readLine, "Available to the drafter: docs/maintainer.md, tenet/intent.md, 0 source files, 0 test files, 0 instruction files · Skipped: none");
  assert.match(card, /^Cited: 0 distinct files$/m);
});
