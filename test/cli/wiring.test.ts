import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { sectionDigest } from "../../dist/specs/sections.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cli = path.join(root, "dist", "cli.js");

function specification(): string {
  const body = "- R-1 Retry once. {origin: asked}\n";
  const front = {
    tenet: { spec: 1, doc: "intent", level: "L1", version: "0.1", owner: "owner" },
    sections: {
      requirements: {
        state: "draft",
        digest: sectionDigest(body),
        flags: [],
      },
    },
  };
  return `---\n${JSON.stringify(front, null, 2)}\n---\n## Requirements\n${body}`;
}

async function seedRepository(label: string) {
  const repository = await tmpRepo(label);
  await repository.write("tenet.yaml", [
    "standard: 0.1.0-alpha.0",
    "kit_path: kit",
    "paths: {records: tenet}",
    "level: observe",
    "specs:",
    "  id_prefix: R",
    "checks: {}",
    "",
  ].join("\n"));
  await repository.write("tenet/intent.md", specification());
  await repository.write("src/retry.ts", "export const retries = 1;\n");
  await repository.write("kit/TENET.md", "# Tenet test kit\n");
  repository.git(["add", "."]);
  repository.git(["commit", "-qm", "fixture"]);
  return repository;
}

function runCli(
  cwd: string,
  args: string[],
  environment: NodeJS.ProcessEnv = {},
): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(
    process.execPath,
    [cli, "--json", "--cwd", cwd, ...args],
    {
      cwd,
      encoding: "utf8",
      env: { ...process.env, ...environment },
      shell: false,
      windowsHide: true,
    },
  );
  return {
    code: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function envelope(result: ReturnType<typeof runCli>) {
  assert.equal(result.code, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout) as { command: string; result: Record<string, unknown> };
}

async function assertMissingPolicy(command: string): Promise<void> {
  const repository = await tmpRepo(`wiring-${command}-missing-policy`);
  try {
    const output = runCli(repository.path, [command]);
    assert.equal(output.code, 3, output.stderr || output.stdout);
    const value = JSON.parse(output.stdout) as {
      ok: boolean;
      errors: Array<Record<string, unknown>>;
    };
    assert.equal(value.ok, false);
    assert.deepEqual(value.errors, [{
      code: "TN-POLICY-MISSING",
      severity: "error",
      rule: null,
      file: "tenet.yaml",
      line: null,
      message: "Policy file tenet.yaml was not found.",
      fix: "Run `tenet init` to create tenet.yaml.",
    }]);
  } finally {
    await repository.cleanup();
  }
}

test("wiring: check reports missing policy as a registered diagnostic", async () => {
  await assertMissingPolicy("check");
});

test("wiring: board reports missing policy as a registered diagnostic", async () => {
  await assertMissingPolicy("board");
});

test("wiring: context reports missing policy as a registered diagnostic", async () => {
  await assertMissingPolicy("context");
});

test("wiring: dist/cli.js runs check", async () => {
  const repository = await seedRepository("wiring-check");
  try {
    const output = envelope(runCli(repository.path, ["check", "tenet/intent.md"]));
    assert.equal(output.command, "check");
    assert.deepEqual(output.result.summary, { errors: 0, warnings: 0, advises: 0 });
  } finally {
    await repository.cleanup();
  }
});

test("wiring: dist/cli.js runs fix", async () => {
  const repository = await seedRepository("wiring-fix");
  try {
    const output = envelope(runCli(repository.path, ["fix", "--dry-run"]));
    assert.equal(output.command, "fix");
    assert.ok(Array.isArray(output.result.changes));
  } finally {
    await repository.cleanup();
  }
});

test("wiring: dist/cli.js runs split", async () => {
  const repository = await seedRepository("wiring-split");
  try {
    const output = envelope(runCli(repository.path, ["split", "tenet/intent.md", "requirements"]));
    assert.equal(output.command, "split");
    assert.equal(output.result.moved, "tenet/intent/requirements.md");
    assert.equal((await stat(path.join(repository.path, "tenet", "intent", "requirements.md"))).isFile(), true);
  } finally {
    await repository.cleanup();
  }
});

test("wiring: dist/cli.js runs context", async () => {
  const repository = await seedRepository("wiring-context");
  try {
    const output = envelope(runCli(repository.path, ["context", "--include-drafts", "--paths", "src/retry.ts"]));
    assert.equal(output.command, "context");
    assert.equal(Array.isArray(output.result.drafts), true);
  } finally {
    await repository.cleanup();
  }
});

test("wiring: dist/cli.js runs board", async () => {
  const repository = await seedRepository("wiring-board");
  try {
    const output = envelope(runCli(repository.path, ["board"]));
    assert.equal(output.command, "board");
    assert.equal(Array.isArray(output.result.specs), true);
  } finally {
    await repository.cleanup();
  }
});

test("wiring: dist/cli.js runs onboard refresh with the real check", async () => {
  const repository = await seedRepository("wiring-onboard");
  try {
    const output = envelope(runCli(repository.path, ["onboard", "--refresh", "--inventory-only"]));
    assert.equal(output.command, "onboard");
    const result = output.result as { assignment?: Record<string, unknown> };
    assert.equal(typeof result.assignment, "object");
    assert.equal(Boolean(output.result && Object.hasOwn(output.result, "inventory")), true);
  } finally {
    await repository.cleanup();
  }
});

test("wiring: dist/cli.js runs verify --run-checks", async () => {
  const repository = await seedRepository("wiring-verify");
  try {
    const commit = repository.git(["rev-parse", "HEAD"]).trim();
    const event = path.join(repository.path, "event.json");
    await repository.write("event.json", JSON.stringify({
      action: "opened",
      repository: { full_name: "example/wiring" },
      number: 1,
      pull_request: {
        number: 1,
        head: { sha: commit },
        base: { sha: commit },
      },
    }));
    const output = envelope(runCli(repository.path, ["verify", "--run-checks"], {
      GITHUB_REPOSITORY: "example/wiring",
      GITHUB_EVENT_NAME: "pull_request",
      GITHUB_EVENT_PATH: event,
      GITHUB_SHA: commit,
      GITHUB_RUN_ID: "7",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_WORKFLOW: "Tenet tests",
      GITHUB_JOB: "test",
      TENET_JOB_INDEX: "0",
    }));
    assert.equal(output.command, "verify");
    const bundle = JSON.parse(await readFile(path.join(repository.path, "tenet-bundle", "bundle.json"), "utf8"));
    assert.equal(bundle.tested.commit, commit);
    assert.deepEqual(bundle.checks, []);
  } finally {
    await repository.cleanup();
  }
});
