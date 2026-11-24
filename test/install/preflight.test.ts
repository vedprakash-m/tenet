import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { cleanupTestRoot, tmpRepo } from "../helpers/tmpRepo.ts";

const output = path.resolve(`.install-preflight-dist-${process.pid}`);
const compile = spawnSync(process.execPath, [
  path.resolve("node_modules/typescript/bin/tsc"),
  "--target", "ES2023",
  "--module", "NodeNext",
  "--moduleResolution", "NodeNext",
  "--strict",
  "--noUncheckedIndexedAccess",
  "--exactOptionalPropertyTypes",
  "--verbatimModuleSyntax",
  "--noEmitOnError",
  "--skipLibCheck",
  "--declaration",
  "--outDir", output,
  "--rootDir", "src",
  "src/install/index.ts",
], { encoding: "utf8", shell: false, windowsHide: true });
assert.equal(compile.status, 0, compile.stderr || compile.stdout);

const { detectHosts, hostDescriptors, preflight } = await import(
  pathToFileURL(path.join(output, "install", "index.js")).href
);

const githubEnvironment = {
  git: {
    state: "committed" as const,
    remote: "https://github.com/fixture/checkout.git",
    version: "2.49.0",
    branch: "main",
    userName: "Fixture Owner",
  },
};

function assertSorted(values: string[]): void {
  assert.deepEqual(values, [...values].sort((left, right) => left < right ? -1 : left > right ? 1 : 0));
}

async function commit(repo: Awaited<ReturnType<typeof tmpRepo>>): Promise<void> {
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);
}

test.after(async () => {
  await cleanupTestRoot();
  await rm(output, { recursive: true, force: true });
});

test("host descriptors detect markers and own their exact shared writes", async (t) => {
  const repo = await tmpRepo("install-hosts");
  t.after(repo.cleanup);
  await repo.write(".claude/settings.json", "{}\n");
  await repo.write(".cursor/extension.json", "{}\n");
  await repo.write(".github/copilot-instructions.md", "# Copilot\n");
  await repo.write(".vscode/settings.json", "{}\n");

  const hosts = await detectHosts({ cwd: repo.path, platform: "linux" });
  assert.deepEqual(hosts.map(({ id, capabilityLevel }) => ({ id, capabilityLevel })), [
    { id: "agents", capabilityLevel: "skills+mcp" },
    { id: "claude", capabilityLevel: "skills+mcp" },
    { id: "copilot", capabilityLevel: "instructions" },
    { id: "cursor", capabilityLevel: "mcp" },
    { id: "vscode", capabilityLevel: "mcp" },
  ]);
  const claude = hostDescriptors.find(({ id }) => id === "claude");
  assert.ok(claude);
  const writes = await claude.planWrites({ cwd: repo.path, platform: "linux" });
  assert.deepEqual(writes.blocks, [{ path: "CLAUDE.md", kind: "markdown" }]);
  assert.deepEqual(writes.keys, [{ path: ".mcp.json", pointer: "/mcpServers/tenet" }]);
  assert.deepEqual(writes.created, [
    ".claude/skills/tenet-draft-specs/SKILL.md",
    ".claude/skills/tenet-review-with-findings/SKILL.md",
    ".claude/skills/tenet-work-a-change/SKILL.md",
  ]);
});

test("Windows MCP descriptors plan only host-required local profile keys", async () => {
  const root = "C:/Users/fixture/AppData/Roaming";
  const context = {
    cwd: "C:/repo",
    platform: "linux",
    localProfileRoot: root,
    windowsCommandShimRequired: ["vscode"],
  };
  const localKeys = [];
  for (const descriptor of hostDescriptors.filter(({ id, capabilityLevel }) =>
    capabilityLevel !== "instructions" && descriptorHasMcp(id))) {
    localKeys.push(...(await descriptor.planWrites(context)).local_keys);
  }
  localKeys.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 :
      left.pointer < right.pointer ? -1 : left.pointer > right.pointer ? 1 :
        left.host < right.host ? -1 : left.host > right.host ? 1 : 0);
  assert.deepEqual(localKeys.map(({ host }) => host), ["vscode"]);
  assert.deepEqual(localKeys, [
    { host: "vscode", path: `${root}/Code/User/mcp.json`, pointer: "/servers/tenet" },
  ]);
});

function descriptorHasMcp(id: string): boolean {
  return id === "claude" || id === "cursor" || id === "vscode";
}

test("preflight detects Node Vitest, package setup, hosts and deterministic plan order", async (t) => {
  const repo = await tmpRepo("install-vitest");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    name: "checkout-fixture",
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".nvmrc", "22\n");
  await repo.write(".vscode/settings.json", "{}\n");
  repo.git(["remote", "add", "origin", "https://github.com/fixture/checkout.git"]);
  await commit(repo);

  const result = await preflight({ cwd: repo.path, yes: true });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.facts.runner?.kind, "vitest");
  assert.deepEqual(result.facts.runner?.package_manager_setup, ["npm ci"]);
  assert.equal(result.facts.runner?.report_path, ".tenet/reports/test.xml");
  assert.equal(result.plan?.ci_mode, "tenet-workflow");
  assert.equal(result.plan?.ci_reason, "no existing CI job runs the detected test command");
  assert.deepEqual(result.plan?.hosts, [
    { id: "agents", capability: "skills+mcp" },
    { id: "vscode", capability: "mcp" },
  ]);
  assertSorted(result.plan?.created ?? []);
  assertSorted(result.plan?.blocks.map(({ path }) => path) ?? []);
  assertSorted(result.plan?.keys.map(({ path }) => path) ?? []);
  assert.deepEqual(result.plan?.blocks.filter(({ path }) => path === ".gitignore" || path === ".gitattributes"), [
    { path: ".gitattributes", kind: "yaml" },
    { path: ".gitignore", kind: "yaml" },
  ]);
  assert.deepEqual(result.plan?.keys, [{ path: ".vscode/mcp.json", pointer: "/servers/tenet" }]);
});

test("preflight injects Windows shim requirements into detected hosts", async (t) => {
  const repo = await tmpRepo("install-local-host-selection");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({ scripts: { test: "vitest run" }, devDependencies: { vitest: "1.6.0" } }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".claude/settings.json", "{}\n");
  await repo.write(".cursor/settings.json", "{}\n");
  await repo.write(".vscode/settings.json", "{}\n");
  await commit(repo);

  const root = "C:/Users/fixture/AppData/Roaming";
  const result = await preflight({
    cwd: repo.path,
    yes: true,
    environment: {
      ...githubEnvironment,
      platform: "linux",
      localProfileRoot: root,
      windowsCommandShimRequired: ["vscode"],
    },
  });

  assert.deepEqual(result.plan?.local_keys, [
    { host: "vscode", path: `${root}/Code/User/mcp.json`, pointer: "/servers/tenet" },
  ]);
});

test("preflight requires explicit consent before production Windows host edits", async (t) => {
  const repo = await tmpRepo("install-windows-host-roots");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".claude/settings.json", "{}\n");
  await repo.write(".cursor/settings.json", "{}\n");
  await repo.write(".vscode/settings.json", "{}\n");
  await commit(repo);
  const oldHome = process.env.USERPROFILE;
  const oldAppData = process.env.APPDATA;
  const home = path.join(repo.path, "home").replaceAll("\\", "/");
  const appData = path.join(repo.path, "roaming").replaceAll("\\", "/");
  process.env.USERPROFILE = home;
  process.env.APPDATA = appData;
  t.after(() => {
    if (oldHome === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldHome;
    if (oldAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = oldAppData;
  });
  const result = await preflight({
    cwd: repo.path,
    yes: true,
    environment: { ...githubEnvironment, platform: "win32" },
  });
  assert.deepEqual(result.plan?.local_keys, []);
  assert.equal(result.plan?.created.includes(".tenet/manifest.local.json"), false);
  const authorized = await preflight({
    cwd: repo.path,
    yes: true,
    localHosts: true,
    environment: { ...githubEnvironment, platform: "win32" },
  });
  assert.deepEqual(authorized.plan?.local_keys.map(({ host, path: itemPath }) => ({ host, path: itemPath })), [
    { host: "claude", path: `${home}/.claude.json` },
    { host: "vscode", path: `${appData}/Code/User/mcp.json` },
    { host: "cursor", path: `${appData}/Cursor/User/mcp.json` },
  ]);
  assert.ok(authorized.plan?.created.includes(".tenet/manifest.local.json"));
});

test("interactive preflight exposes local host consent without authorizing it", async (t) => {
  const repo = await tmpRepo("install-local-host-prompt");
  t.after(repo.cleanup);
  await repo.write(".claude/settings.json", "{}\n");
  await commit(repo);
  const root = path.join(repo.path, "profile").replaceAll("\\", "/");
  const oldProfile = process.env.USERPROFILE;
  const oldAppData = process.env.APPDATA;
  process.env.USERPROFILE = root;
  process.env.APPDATA = root;
  t.after(() => {
    if (oldProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldProfile;
    if (oldAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = oldAppData;
  });
  const result = await preflight({
    cwd: repo.path,
    environment: {
      ...githubEnvironment,
      platform: "win32",
      windowsCommandShimRequired: ["claude"],
    },
  });
  assert.deepEqual(result.plan?.local_keys, []);
  const prompt = result.prompts.find(({ key }) => key === "localHosts");
  assert.deepEqual(prompt?.local_keys, [
    { host: "claude", path: `${root}/.claude.json`, pointer: "/mcpServers/tenet" },
  ]);
});

test("Windows profile planning never falls back to the real home directory", async () => {
  const oldHome = process.env.HOME;
  const oldUserProfile = process.env.USERPROFILE;
  const oldAppData = process.env.APPDATA;
  const oldLocalAppData = process.env.LOCALAPPDATA;
  delete process.env.HOME;
  delete process.env.USERPROFILE;
  delete process.env.APPDATA;
  delete process.env.LOCALAPPDATA;
  try {
    const repo = await tmpRepo("install-no-process-home");
    try {
      await repo.write(".claude/settings.json", "{}\n");
      await repo.write(".vscode/settings.json", "{}\n");
      await commit(repo);
      const result = await preflight({
        cwd: repo.path,
        yes: true,
        environment: { ...githubEnvironment, platform: "win32" },
      });
      assert.deepEqual(result.plan?.local_keys, []);
      assert.equal(result.plan?.created.includes(".tenet/manifest.local.json"), false);
    } finally {
      await repo.cleanup();
    }
  } finally {
    if (oldHome === undefined) delete process.env.HOME;
    else process.env.HOME = oldHome;
    if (oldUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = oldUserProfile;
    if (oldAppData === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = oldAppData;
    if (oldLocalAppData === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = oldLocalAppData;
  }
});

test("preflight uses an existing report-producing job and preserves service and matrix facts", async (t) => {
  const repo = await tmpRepo("install-existing-ci");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".github/workflows/ci.yml", [
    "name: Checkout CI",
    "on: [push, pull_request]",
    "jobs:",
    "  test:",
    "    runs-on: ubuntu-latest",
    "    services:",
    "      database:",
    "        image: postgres:16",
    "    strategy:",
    "      matrix:",
    "        node: [20, 22]",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - run: npm ci",
    "      - id: tests",
    "        run: npx vitest run --reporter=junit --outputFile.junit=artifacts/unit.xml",
    "",
  ].join("\n"));
  await commit(repo);

  const result = await preflight({ cwd: repo.path, yes: true, environment: githubEnvironment });
  assert.equal(result.plan?.ci_mode, "existing-ci");
  assert.equal(result.facts.ci.selected?.id, "tests");
  assert.equal(result.facts.ci.selected?.report_path, "artifacts/unit.xml");
  assert.equal(result.facts.ci.selected?.services, true);
  assert.equal(result.facts.ci.selected?.matrix, true);
  assert.deepEqual(result.facts.ci.selected?.setup, ["npm ci"]);
  assert.ok(result.plan?.blocks.some(({ path }) => path === ".github/workflows/ci.yml"));
  assert.equal(result.plan?.created.includes(".github/workflows/tenet-tests.yml"), false);
});

test("preflight resolves npm test wrappers through package.json", async (t) => {
  const repo = await tmpRepo("install-npm-wrapper");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "npx vitest run --reporter=junit --outputFile.junit=artifacts/unit.xml" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".github/workflows/ci.yml", [
    "name: Checkout CI",
    "jobs:",
    "  test:",
    "    steps:",
    "      - run: npm ci",
    "      - id: tests",
    "        run: npm test",
    "",
  ].join("\n"));
  await commit(repo);

  const result = await preflight({ cwd: repo.path, yes: true, environment: githubEnvironment });
  assert.equal(result.facts.runner?.kind, "vitest");
  assert.equal(result.facts.ci.selected?.command, "npm test");
  assert.equal(result.facts.ci.selected?.reports, true);
  assert.equal(result.facts.ci.selected?.report_path, "artifacts/unit.xml");
  assert.equal(result.plan?.ci_mode, "existing-ci");
});

test("preflight preserves arguments forwarded through package test wrappers", async (t) => {
  const repo = await tmpRepo("install-wrapper-args");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "npx vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".github/workflows/ci.yml", [
    "name: Checkout CI",
    "jobs:",
    "  npm:",
    "    steps:",
    "      - id: tests",
    "        run: npm test -- --reporter=junit --outputFile.junit=artifacts/npm.xml",
    "  pnpm:",
    "    steps:",
    "      - id: tests",
    "        run: pnpm test -- --reporter=junit --outputFile.junit=artifacts/pnpm.xml",
    "  yarn:",
    "    steps:",
    "      - id: tests",
    "        run: yarn test --reporter=junit --outputFile.junit=artifacts/yarn.xml",
    "",
  ].join("\n"));
  await commit(repo);

  const result = await preflight({ cwd: repo.path, yes: true, environment: githubEnvironment });
  assert.deepEqual(result.facts.ci.jobs.map(({ report_path }) => report_path), [
    "artifacts/npm.xml",
    "artifacts/pnpm.xml",
    "artifacts/yarn.xml",
  ]);
  assert.equal(result.facts.ci.selected?.command,
    "npm test -- --reporter=junit --outputFile.junit=artifacts/npm.xml");
  assert.equal(result.facts.ci.selected?.reports, true);
  assert.equal(result.facts.ci.selected?.report_path, "artifacts/npm.xml");
  assert.equal(result.plan?.ci_mode, "existing-ci");
});

test("preflight uses existing CI after explicit reporter consent", async (t) => {
  const repo = await tmpRepo("install-reporter-edit");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".github/workflows/ci.yml", [
    "name: Checkout CI",
    "jobs:",
    "  test:",
    "    steps:",
    "      - run: npm ci",
    "      - run: npx vitest run",
    "",
  ].join("\n"));
  await commit(repo);

  const declined = await preflight({ cwd: repo.path, yes: true, environment: githubEnvironment });
  assert.equal(declined.plan?.ci_mode, "tenet-workflow");
  assert.equal(declined.plan?.ci_reason, "existing CI job does not write a test report");

  const accepted = await preflight({
    cwd: repo.path,
    answers: { allowReporterEdit: true },
    environment: githubEnvironment,
  });
  assert.equal(accepted.plan?.ci_mode, "existing-ci");
  assert.equal(accepted.plan?.ci_reason, "existing CI reporter edit accepted");
  assert.ok(accepted.plan?.blocks.some(({ path }) => path === ".github/workflows/ci.yml"));
  assert.equal(accepted.facts.ci.selected?.services, false);
});

test("preflight prefers a matching report job over an unrelated reusable workflow", async (t) => {
  const repo = await tmpRepo("install-ci-selection");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".github/workflows/a-shared.yml", [
    "name: Shared",
    "jobs:",
    "  checks:",
    "    uses: example/shared/.github/workflows/checks.yml@main",
    "",
  ].join("\n"));
  await repo.write(".github/workflows/z-tests.yml", [
    "name: Tests",
    "jobs:",
    "  test:",
    "    steps:",
    "      - run: npx vitest run --reporter=junit --outputFile.junit=artifacts/unit.xml",
    "",
  ].join("\n"));
  await commit(repo);

  const result = await preflight({ cwd: repo.path, yes: true, environment: githubEnvironment });
  assert.equal(result.facts.ci.selected?.workflow, ".github/workflows/z-tests.yml");
  assert.equal(result.facts.ci.selected?.reports, true);
  assert.equal(result.plan?.ci_mode, "existing-ci");
  assert.equal(result.plan?.ci_reason, "existing CI job writes a supported test report");
});

test("preflight falls back for reusable workflows and exposes reporter consent without writes", async (t) => {
  const repo = await tmpRepo("install-reusable");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await repo.write(".github/workflows/ci.yml", [
    "name: Checkout CI",
    "jobs:",
    "  test:",
    "    uses: ./.github/workflows/reusable.yml",
    "",
  ].join("\n"));
  await commit(repo);

  const reusable = await preflight({ cwd: repo.path, environment: githubEnvironment });
  assert.equal(reusable.plan?.ci_mode, "tenet-workflow");
  assert.equal(reusable.plan?.ci_reason, "reusable workflow cannot be edited in place");
  assert.equal(reusable.facts.ci.selected?.reusable, true);
  assert.equal(reusable.prompts.some(({ key }) => key === "reporterEdit"), false);
  assert.equal(await preflight({ cwd: repo.path, yes: true, environment: githubEnvironment })
    .then((value) => value.plan?.ci_mode), "tenet-workflow");
});

test("preflight omits GitHub writes for a non-GitHub forge", async (t) => {
  const repo = await tmpRepo("install-gitlab");
  t.after(repo.cleanup);
  await repo.write("package.json", JSON.stringify({
    scripts: { test: "vitest run" },
    devDependencies: { vitest: "1.6.0" },
  }));
  await repo.write("package-lock.json", "{}\n");
  await commit(repo);

  const result = await preflight({
    cwd: repo.path,
    yes: true,
    environment: {
      git: { state: "committed", remote: "https://gitlab.com/fixture/checkout.git" },
    },
  });
  assert.equal(result.facts.repository.forge, "other");
  assert.equal(result.plan?.ci_mode, "none");
  assert.equal(result.plan?.ci_reason,
    "non-GitHub remote: local checks and specifications are enabled; CI proof cards require GitHub in alpha.0");
  assert.equal(result.plan?.created.some((filename) => filename.startsWith(".github/")), false);
  assert.equal(result.plan?.blocks.some(({ path }) => path.startsWith(".github/")), false);
});

test("empty repositories expose purpose and kind prompts and --yes metadata", async (t) => {
  const repo = await tmpRepo("install-empty");
  t.after(repo.cleanup);
  repo.git(["remote", "add", "origin", "https://github.com/fixture/empty.git"]);

  const interactive = await preflight({ cwd: repo.path });
  assert.deepEqual(interactive.prompts.map(({ key }) => key), ["purpose", "kind"]);
  assert.equal(interactive.facts.repository.empty, true);
  assert.equal(interactive.facts.kind, null);

  const automatic = await preflight({ cwd: repo.path, yes: true });
  assert.equal(automatic.facts.purpose, "Undecided · edit or run tenet onboard");
  assert.equal(automatic.facts.kind, "other");
  assert.deepEqual(automatic.findings, [{
    kind: "no-test-report",
    path: "tenet.yaml",
    message: "No machine-readable test report configured",
  }]);
  assert.ok(automatic.plan?.created.includes("tenet/intent.md"));
  assert.deepEqual(automatic.diagnostics, []);
});

test("missing Git and non-Git directories produce structured environment findings", async (t) => {
  const repo = await tmpRepo("install-environment");
  t.after(repo.cleanup);
  const missing = await preflight({
    cwd: repo.path,
    environment: { git: { state: "tool-unavailable", version: null } },
  });
  assert.equal(missing.plan, null);
  assert.equal(missing.diagnostics[0]?.code, "TN-ENV-GIT");
  assert.match(missing.diagnostics[0]?.message ?? "", /not installed/);

  const nonGit = await preflight({
    cwd: repo.path,
    environment: { git: { state: "not-a-repository" } },
  });
  assert.equal(nonGit.plan, null);
  assert.equal(nonGit.diagnostics[0]?.code, "TN-ENV-NOT-GIT");
});
