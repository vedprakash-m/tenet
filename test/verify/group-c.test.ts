import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import { parse } from "yaml";
import { fakeTty } from "../helpers/fakeTty.ts";
import { packageVersion } from "../helpers/packageVersion.ts";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const cli = path.resolve("dist/cli.js");

function runCli(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cli, "--cwd", cwd, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      TENET_TEST_REGISTRY_INTEGRITY: "not-found",
      ...env,
    },
  });
}

test("[AB-C1] [F-11] [F-41] init never writes npm test without package.json, prompts interactively, and getting-started documents test configuration", async (t) => {
  const autoRepo = await tmpRepo("c1-python-yes");
  t.after(autoRepo.cleanup);
  autoRepo.git(["config", "user.name", "Fixture Owner"]);
  autoRepo.git(["config", "user.email", "fixture@example.invalid"]);
  autoRepo.git(["remote", "add", "origin", "https://github.com/fixture/py-notes.git"]);
  await autoRepo.write("README.md", "# Notes\n");
  await autoRepo.write("script.py", "def add(a, b):\n    return a + b\n");
  autoRepo.git(["add", "-A"]);
  autoRepo.git(["commit", "-qm", "initial"]);

  const yesResult = runCli(autoRepo.path, ["init", "--yes", "--offline"]);
  assert.equal(yesResult.status, 0, yesResult.stderr);
  assert.match(yesResult.stdout, /Add checks\.test in tenet\.yaml/);
  const yesPolicy = parse(await readFile(path.join(autoRepo.path, "tenet.yaml"), "utf8")) as Record<string, unknown>;
  assert.equal("checks" in yesPolicy, false);

  const { run } = await import("../../dist/cli.js");
  const skipRepo = await tmpRepo("c1-python-skip");
  t.after(skipRepo.cleanup);
  skipRepo.git(["config", "user.name", "Fixture Owner"]);
  skipRepo.git(["config", "user.email", "fixture@example.invalid"]);
  await skipRepo.write("README.md", "# Notes\n");
  await skipRepo.write("script.py", "def add(a, b):\n    return a + b\n");
  skipRepo.git(["add", "-A"]);
  skipRepo.git(["commit", "-qm", "initial"]);

  const skipIo = fakeTty("\n\n");
  const skipExit = await run(["--offline", "init"], { cwd: skipRepo.path, ...skipIo, checkEnvironment: false });
  assert.equal(skipExit, 0, skipIo.stderr.text);
  assert.match(skipIo.stdout.text, /What command runs your tests\? \(blank to skip\)/);
  const skipPolicy = parse(await readFile(path.join(skipRepo.path, "tenet.yaml"), "utf8")) as Record<string, unknown>;
  assert.equal("checks" in skipPolicy, false);

  const customRepo = await tmpRepo("c1-python-custom");
  t.after(customRepo.cleanup);
  customRepo.git(["config", "user.name", "Fixture Owner"]);
  customRepo.git(["config", "user.email", "fixture@example.invalid"]);
  await customRepo.write("README.md", "# Notes\n");
  await customRepo.write("script.py", "def add(a, b):\n    return a + b\n");
  customRepo.git(["add", "-A"]);
  customRepo.git(["commit", "-qm", "initial"]);

  const customIo = fakeTty("python -m pytest\n\n");
  const customExit = await run(["--offline", "init"], { cwd: customRepo.path, ...customIo, checkEnvironment: false });
  assert.equal(customExit, 0, customIo.stderr.text);
  assert.match(customIo.stdout.text, /What command runs your tests\? \(blank to skip\)/);
  const customPolicy = parse(await readFile(path.join(customRepo.path, "tenet.yaml"), "utf8")) as {
    checks?: { test?: { run?: string; report?: string } };
  };
  assert.equal(customPolicy.checks?.test?.run, "python -m pytest");
  assert.equal(customPolicy.checks?.test?.report, "none");

  const gettingStarted = await readFile("docs/getting-started.md", "utf8");
  assert.match(gettingStarted, /^## Configure your tests$/m);
  for (const needle of ["run", "report", "report_from", "report_path", "junit", "ctrf", "go-test-json", "jest-json", "none", "vitest", "jest", "node:test", "pytest", "go"]) {
    assert.ok(gettingStarted.includes(needle), `getting-started.md should document ${needle}`);
  }
});

test("[AB-C2] [F-54] verify --local runs working-tree checks against default branch merge base with no CI event or network", async (t) => {
  const repo = await tmpRepo("c2-verify-local");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  const checkCmd = "node check.mjs";
  await repo.write("check.mjs", "console.log('ok');\n");
  await repo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: checkCmd, report: "none", report_from: "file" },
    },
  }, null, 2));
  await repo.write("kit/TENET.md", "# Kit\n");
  await repo.write("tenet/intent.md", "---\ntenet: {\"spec\":1,\"doc\":\"intent\",\"level\":\"L1\",\"version\":\"0.1\",\"owner\":\"owner\"}\nsections:\n  vision: {\"state\":\"draft\",\"digest\":null,\"flags\":[]}\n---\n## Vision\n- V-1 Local preview works. {origin: asked}\n");
  await repo.write("app.txt", "base\n");
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "base"]);
  repo.git(["branch", "-M", "main"]);
  const baseSha = repo.git(["rev-parse", "HEAD"]).trim();

  repo.git(["checkout", "-b", "feat/local-preview"]);
  await repo.write("app.txt", "working-tree-edit\n");

  const envWithoutGithub: NodeJS.ProcessEnv = { ...process.env };
  delete envWithoutGithub.GITHUB_EVENT_PATH;
  delete envWithoutGithub.GITHUB_REPOSITORY;
  delete envWithoutGithub.GITHUB_TOKEN;

  const human = runCli(repo.path, ["--offline", "verify", "--local"], envWithoutGithub);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /^### Tenet proof · [0-9a-f]{6} \(head\) · local preview/m);

  const jsonRun = runCli(repo.path, ["--offline", "--json", "verify", "--local"], envWithoutGithub);
  assert.equal(jsonRun.status, 0, jsonRun.stderr);
  const envelope = JSON.parse(jsonRun.stdout) as {
    ok: boolean;
    result: {
      card: { tested: { base: string; commit: string }; "x-local-preview": boolean };
      markdown: string;
      bundle: { checks: Array<{ name: string; outcome: string }> };
    };
  };
  assert.equal(envelope.ok, true);
  assert.equal(envelope.result.card.tested.base, baseSha);
  assert.notEqual(envelope.result.card.tested.commit, baseSha);
  assert.equal(envelope.result.card["x-local-preview"], true);
  assert.equal(envelope.result.bundle.checks[0]?.outcome, "success");
  assert.match(envelope.result.markdown, /local preview/);

  // Failing working-tree check exits 1 while still printing the preview card.
  await repo.write("check.mjs", "process.exit(2);\n");
  const failing = runCli(repo.path, ["--offline", "verify", "--local"], envWithoutGithub);
  assert.equal(failing.status, 1);
  assert.match(failing.stdout, /local preview/);

  const commandsDoc = await readFile("docs/commands.md", "utf8");
  const contractsDoc = await readFile("tenet/specs/tech-spec/contracts.md", "utf8");
  const uxDoc = await readFile("tenet/specs/ux-spec.md", "utf8");
  assert.match(commandsDoc, /verify --local/);
  assert.match(contractsDoc, /verify --local/);
  assert.match(uxDoc, /verify --local/);
});

test("[AB-C3] [F-55] card notes when head changes a failing base check command and getting-started explains setup PR configuration", async (t) => {
  const repo = await tmpRepo("c3-check-changed");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  await repo.write("kit/TENET.md", "# Kit\n");
  await repo.write("tenet/intent.md", "---\ntenet: {\"spec\":1,\"doc\":\"intent\",\"level\":\"L1\",\"version\":\"0.1\",\"owner\":\"owner\"}\nsections:\n  vision: {\"state\":\"draft\",\"digest\":null,\"flags\":[]}\n---\n## Vision\n- V-1 Check command stays pinned to base. {origin: asked}\n");
  await repo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      test: { run: "broken-command", report: "none", report_from: "file" },
    },
  }, null, 2));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "base"]);
  repo.git(["branch", "-M", "main"]);
  const baseSha = repo.git(["rev-parse", "HEAD"]).trim();

  repo.git(["checkout", "-b", "fix/test-cmd"]);
  await repo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      test: { run: `node -e "console.log('head')"`, report: "none", report_from: "file" },
    },
  }, null, 2));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fix check command"]);
  const headSha = repo.git(["rev-parse", "HEAD"]).trim();

  const { record } = await import("../../dist/verify/record.js");
  const { renderCheckSummary } = await import("../../dist/verify/card.js");
  const { touched } = await import("../../dist/specs/touched.js");
  const { deltas } = await import("../../dist/specs/deltas.js");
  const { parseDoc } = await import("../../dist/specs/parse.js");
  const { sectionDigest } = await import("../../dist/specs/sections.js");
  const { loadPolicy } = await import("../../dist/policy/index.js");

  const bundle = {
    schema_version: 1 as const,
    "x-repository": "fixture/repo",
    run: { id: "1", attempt: 1, workflow: "Tenet tests", job: "test", index: 0 },
    pr: 1,
    tested: { commit: headSha, kind: "head" as const, head: headSha, base: baseSha },
    checks: [{
      name: "test",
      exit_code: 127,
      outcome: "failure" as const,
      duration_ms: 10,
      report: "none",
      report_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      inputs: [],
    }],
  };
  let rendered = "";
  const recorded = await record({
    kind: "workflow_run",
    repository: "fixture/repo",
    base: baseSha,
    run: { id: "1", attempt: 1, workflow: "Tenet tests", head: headSha, repository: "fixture/repo", startedAt: "2026-11-26T00:00:00Z" },
    pulls: [1],
  }, {
    check: async () => ({ findings: [] }),
    policy: async (ref, cwd) => loadPolicy({ ref, cwd }),
    verifyLock: async () => {},
    touched,
    deltas,
    parseDoc,
    sectionDigest,
  }, {
    cwd: repo.path,
    version: packageVersion,
    now: () => new Date("2026-11-26T00:00:00Z"),
    render: renderCheckSummary,
    checkout: async () => ({ cwd: repo.path, stale: false, close: async () => {} }),
    forge: {
      getPullRequest: async (number) => ({ number, base: baseSha, head: headSha, body: "" }),
      findPullRequests: async () => [],
      latestRun: async () => null,
      downloadBundles: async () => ({
        total: 1,
        missing: 0,
        bundles: [{ bundle, files: new Map([["bundle.json", Buffer.from(JSON.stringify(bundle))]]) }],
      }),
      upsertCheckRun: async (payload) => { rendered = payload.summary; },
    },
    records: { read: async () => ({ tip: null, files: {} }), write: async () => true },
  });
  assert.ok(recorded.card.degraded.some((line) => line.includes("takes effect after merge")));
  assert.match(rendered, /check command changed for test; runs base policy \(takes effect after merge\)/);

  const gettingStarted = await readFile("docs/getting-started.md", "utf8");
  assert.match(gettingStarted, /setup pull request/i);
});

test("[AB-C2] [AB-C3] verify --local runs base check command on working tree when base has tenet.yaml and falls back only when absent", async (t) => {
  // 1. Failing base command + head override -> runs base's command and notes takes effect after merge.
  const failingBaseRepo = await tmpRepo("c2-c3-base-fail");
  t.after(failingBaseRepo.cleanup);
  failingBaseRepo.git(["config", "user.name", "Fixture Owner"]);
  failingBaseRepo.git(["config", "user.email", "fixture@example.invalid"]);
  await failingBaseRepo.write("kit/TENET.md", "# Kit\n");
  await failingBaseRepo.write("tenet/intent.md", "---\ntenet: {\"spec\":1,\"doc\":\"intent\",\"level\":\"L1\",\"version\":\"0.1\",\"owner\":\"owner\"}\nsections:\n  vision: {\"state\":\"draft\",\"digest\":null,\"flags\":[]}\n---\n## Vision\n- V-1 Preview runs base checks. {origin: asked}\n");
  await failingBaseRepo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','base');process.exit(127)"`, report: "none", report_from: "file" },
    },
  }, null, 2));
  failingBaseRepo.git(["add", "-A"]);
  failingBaseRepo.git(["commit", "-qm", "base"]);
  failingBaseRepo.git(["branch", "-M", "main"]);

  failingBaseRepo.git(["checkout", "-b", "fix/check-cmd"]);
  await failingBaseRepo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','head')"`, report: "none", report_from: "file" },
    },
  }, null, 2));
  const localFail = runCli(failingBaseRepo.path, ["--offline", "verify", "--local"]);
  assert.equal(localFail.status, 1);
  assert.equal(await readFile(path.join(failingBaseRepo.path, "ran.txt"), "utf8"), "base");
  assert.match(localFail.stdout, /check command changed for unit; runs base policy \(takes effect after merge\)/);

  // 2. Passing base command + head override -> base's command is still the one executed and recorded.
  const passingBaseRepo = await tmpRepo("c2-c3-base-pass");
  t.after(passingBaseRepo.cleanup);
  passingBaseRepo.git(["config", "user.name", "Fixture Owner"]);
  passingBaseRepo.git(["config", "user.email", "fixture@example.invalid"]);
  await passingBaseRepo.write("kit/TENET.md", "# Kit\n");
  await passingBaseRepo.write("tenet/intent.md", "---\ntenet: {\"spec\":1,\"doc\":\"intent\",\"level\":\"L1\",\"version\":\"0.1\",\"owner\":\"owner\"}\nsections:\n  vision: {\"state\":\"draft\",\"digest\":null,\"flags\":[]}\n---\n## Vision\n- V-1 Preview runs base checks. {origin: asked}\n");
  await passingBaseRepo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','base-pass')"`, report: "none", report_from: "file" },
    },
  }, null, 2));
  passingBaseRepo.git(["add", "-A"]);
  passingBaseRepo.git(["commit", "-qm", "base"]);
  passingBaseRepo.git(["branch", "-M", "main"]);
  passingBaseRepo.git(["checkout", "-b", "chore/edit-check"]);
  await passingBaseRepo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','head-override')"`, report: "none", report_from: "file" },
    },
  }, null, 2));
  const localPass = runCli(passingBaseRepo.path, ["--offline", "verify", "--local"]);
  assert.equal(localPass.status, 0, localPass.stderr);
  assert.equal(await readFile(path.join(passingBaseRepo.path, "ran.txt"), "utf8"), "base-pass");
  assert.match(localPass.stdout, /check command changed for unit; runs base policy \(takes effect after merge\)/);

  // 3. Base without tenet.yaml -> falls back to the working tree's policy.
  const noBaseRepo = await tmpRepo("c2-c3-no-base-policy");
  t.after(noBaseRepo.cleanup);
  noBaseRepo.git(["config", "user.name", "Fixture Owner"]);
  noBaseRepo.git(["config", "user.email", "fixture@example.invalid"]);
  await noBaseRepo.write("README.md", "# Setup\n");
  noBaseRepo.git(["add", "-A"]);
  noBaseRepo.git(["commit", "-qm", "base"]);
  noBaseRepo.git(["branch", "-M", "main"]);
  noBaseRepo.git(["checkout", "-b", "setup/tenet"]);
  await noBaseRepo.write("kit/TENET.md", "# Kit\n");
  await noBaseRepo.write("tenet/intent.md", "---\ntenet: {\"spec\":1,\"doc\":\"intent\",\"level\":\"L1\",\"version\":\"0.1\",\"owner\":\"owner\"}\nsections:\n  vision: {\"state\":\"draft\",\"digest\":null,\"flags\":[]}\n---\n## Vision\n- V-1 Setup fallback works. {origin: asked}\n");
  await noBaseRepo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','working')"`, report: "none", report_from: "file" },
    },
  }, null, 2));
  const localFallback = runCli(noBaseRepo.path, ["--offline", "verify", "--local"]);
  assert.equal(localFallback.status, 0, localFallback.stderr);
  assert.equal(await readFile(path.join(noBaseRepo.path, "ran.txt"), "utf8"), "working");
});

test("[AB-C3] card notes check command change without degrading card or changing conclusion when base check passes", async (t) => {
  const repo = await tmpRepo("c3-passing-base");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  await repo.write("kit/TENET.md", "# Kit\n");
  await repo.write("tenet/intent.md", "---\ntenet: {\"spec\":1,\"doc\":\"intent\",\"level\":\"L1\",\"version\":\"0.1\",\"owner\":\"owner\"}\nsections:\n  vision: {\"state\":\"draft\",\"digest\":null,\"flags\":[]}\n---\n## Vision\n- V-1 Passing base check still notes command change. {origin: asked}\n");
  await repo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','base')"`, report: "junit", report_path: ".tenet/reports/unit.xml", report_from: "file" },
    },
    protect: [],
  }, null, 2));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "base"]);
  repo.git(["branch", "-M", "main"]);
  const baseSha = repo.git(["rev-parse", "HEAD"]).trim();

  repo.git(["checkout", "-b", "chore/tweak-check"]);
  await repo.write("tenet.yaml", JSON.stringify({
    standard: "~0.1",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
    owners: [{ id: "owner", name: "Owner", roles: ["owner"] }],
    checks: {
      unit: { run: `node -e "require('node:fs').writeFileSync('ran.txt','head')"`, report: "junit", report_path: ".tenet/reports/unit.xml", report_from: "file" },
    },
    protect: [],
  }, null, 2));
  await repo.write("test/app.test.js", "import { test } from \"node:test\";\ntest(\"[AB-1] passes\", () => {});\n");
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "change check command"]);
  const headSha = repo.git(["rev-parse", "HEAD"]).trim();

  // 1. CI record() path with passing base check: note appears in why without degrading or changing conclusion.
  const junitXml = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<testsuites>\n  <testsuite name=\"suite\" file=\"test/app.test.js\">\n    <testcase name=\"[AB-1] passes\" time=\"0.010\"/>\n  </testsuite>\n</testsuites>\n";
  const { createHash } = await import("node:crypto");
  const reportSha = createHash("sha256").update(junitXml, "utf8").digest("hex");
  const { record } = await import("../../dist/verify/record.js");
  const { renderCheckSummary } = await import("../../dist/verify/card.js");
  const { touched } = await import("../../dist/specs/touched.js");
  const { deltas } = await import("../../dist/specs/deltas.js");
  const { parseDoc } = await import("../../dist/specs/parse.js");
  const { sectionDigest } = await import("../../dist/specs/sections.js");
  const { loadPolicy } = await import("../../dist/policy/index.js");

  const bundle = {
    schema_version: 1 as const,
    "x-repository": "fixture/repo",
    run: { id: "1", attempt: 1, workflow: "Tenet tests", job: "test", index: 0 },
    pr: 1,
    tested: { commit: headSha, kind: "head" as const, head: headSha, base: baseSha },
    checks: [{
      name: "unit",
      exit_code: 0,
      outcome: "success" as const,
      duration_ms: 10,
      report: "reports/unit.xml",
      report_sha256: reportSha,
      inputs: [],
    }],
  };
  let rendered = "";
  let recordedConclusion = "";
  const recorded = await record({
    kind: "workflow_run",
    repository: "fixture/repo",
    base: baseSha,
    run: { id: "1", attempt: 1, workflow: "Tenet tests", head: headSha, repository: "fixture/repo", startedAt: "2026-11-26T00:00:00Z" },
    pulls: [1],
  }, {
    check: async () => ({ findings: [], summary: { errors: 0, warnings: 0, advises: 0 } }),
    policy: async (ref, cwd) => loadPolicy({ ref, cwd }),
    verifyLock: async () => {},
    touched,
    deltas,
    parseDoc,
    sectionDigest,
  }, {
    cwd: repo.path,
    version: packageVersion,
    now: () => new Date("2026-11-26T00:00:00Z"),
    render: renderCheckSummary,
    checkout: async () => ({ cwd: repo.path, stale: false, close: async () => {} }),
    forge: {
      getPullRequest: async (number) => ({ number, base: baseSha, head: headSha, body: "## Acceptance\n- [AB-1] passes\n" }),
      findPullRequests: async () => [],
      latestRun: async () => null,
      downloadBundles: async () => ({
        total: 1,
        missing: 0,
        bundles: [{
          bundle,
          files: new Map([
            ["bundle.json", Buffer.from(JSON.stringify(bundle))],
            ["reports/unit.xml", Buffer.from(junitXml)],
          ]),
        }],
      }),
      upsertCheckRun: async (payload) => {
        rendered = payload.summary;
        recordedConclusion = payload.conclusion;
      },
    },
    records: { read: async () => ({ tip: null, files: {} }), write: async () => true },
  });
  assert.deepEqual(recorded.card.degraded, []);
  assert.deepEqual(recorded.card.rules.map((entry) => entry.rule), ["protected-surfaces"]);
  assert.equal(recorded.conclusion, "neutral");
  assert.equal(recordedConclusion, "neutral");
  assert.ok(recorded.card.why.some((entry) => entry.text === "check command changed for unit; runs base policy (takes effect after merge)" && entry.class === "host"));
  assert.doesNotMatch(rendered, /^Degraded:/m);
  assert.match(rendered, /^Why: .*check command changed for unit; runs base policy \(takes effect after merge\) \[host\]$/m);

  // 2. verify --local path with passing base check: base runs and card notes change without degrading.
  await repo.write(".tenet/reports/unit.xml", junitXml);
  const localRes = runCli(repo.path, ["--offline", "--json", "verify", "--local"]);
  assert.equal(localRes.status, 0, localRes.stderr);
  assert.equal(await readFile(path.join(repo.path, "ran.txt"), "utf8"), "base");
  const envelope = JSON.parse(localRes.stdout) as {
    result: {
      conclusion: string;
      markdown: string;
      card: { degraded: string[]; rules: Array<{ rule: string }>; why: Array<{ text: string; class: string }> };
    };
  };
  assert.deepEqual(envelope.result.card.degraded, []);
  assert.deepEqual(envelope.result.card.rules.map((entry) => entry.rule), ["protected-surfaces", "acceptance-passed"]);
  assert.equal(envelope.result.conclusion, "neutral");
  assert.ok(envelope.result.card.why.some((entry) => entry.text === "check command changed for unit; runs base policy (takes effect after merge)"));
  assert.doesNotMatch(envelope.result.markdown, /^Degraded:/m);
  assert.match(envelope.result.markdown, /takes effect after merge/);
});

test("[AB-C4] [F-36] [F-42] init uses default branch instead of setup branch and upgrade rewrites generated workflows", async (t) => {
  const repo = await tmpRepo("c4-workflow-branch");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  repo.git(["remote", "add", "origin", "https://github.com/fixture/checkout.git"]);
  await repo.write("package.json", JSON.stringify({
    name: "fixture",
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "base"]);
  repo.git(["branch", "-M", "main"]);
  repo.git(["checkout", "-b", "setup/tenet"]);

  const { init } = await import("../../dist/install/init.js");
  const { upgrade } = await import("../../dist/install/upgrade.js");
  const environment = {
    registry: {
      package: "@vedprakash-m/tenet",
      releases: {
        [packageVersion]: { integrity: `sha512-${"A".repeat(86)}==` },
      },
    },
  };
  await init({ cwd: repo.path, yes: true, environment });
  const workflowPath = path.join(repo.path, ".github", "workflows", "tenet-tests.yml");
  const generated = await readFile(workflowPath, "utf8");
  assert.match(generated, /push:\s*\{branches:\s*\[main\]\}/);
  assert.doesNotMatch(generated, /setup\/tenet/);

  // Simulate an older generated workflow that pinned setup/tenet, and confirm upgrade rewrites it.
  const staleWorkflow = generated.replace("branches: [main]", "branches: [setup/tenet]");
  await repo.write(".github/workflows/tenet-tests.yml", staleWorkflow);
  const { createHash } = await import("node:crypto");
  const manifestPath = path.join(repo.path, ".tenet", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    created: Array<{ path: string; sha256: string }>;
  };
  const wfEntry = manifest.created.find((item) => item.path === ".github/workflows/tenet-tests.yml");
  assert.ok(wfEntry);
  wfEntry.sha256 = createHash("sha256").update(staleWorkflow, "utf8").digest("hex");
  await repo.write(".tenet/manifest.json", `${JSON.stringify(manifest, null, 2)}\n`);

  const upgraded = await upgrade({ cwd: repo.path, yes: true, environment });
  assert.ok(upgraded.changed.some((item) => item.path === ".github/workflows/tenet-tests.yml" && item.action === "replaced"));
  const repaired = await readFile(workflowPath, "utf8");
  assert.match(repaired, /push:\s*\{branches:\s*\[main\]\}/);
  assert.doesNotMatch(repaired, /setup\/tenet/);

  const { preflight } = await import("../../dist/install/preflight.js");
  const injectedPreflight = await preflight({
    cwd: repo.path,
    environment: {
      ...environment,
      git: {
        version: "2.45.0",
        head: "a".repeat(40),
        branch: "trunk",
        remote: "https://github.com/fixture/checkout.git",
        userName: "Fixture Owner",
      },
    },
  });
  assert.equal(injectedPreflight.facts.repository.default_branch, "trunk");
});

test("[AB-C5] [F-58] review-with-findings skill covers reviewing when no proof card exists", async () => {
  const skill = await readFile("kit/skills/review-with-findings/SKILL.md", "utf8");
  assert.match(skill, /no proof card/i);
  assert.match(skill, /tenet context --ids/);
  assert.match(skill, /verify --local/);
});
