import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readlink, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { cleanupTestRoot, tmpRepo, type TemporaryRepository } from "../helpers/tmpRepo.ts";

import { packageVersion } from "../helpers/packageVersion.ts";

const output = path.resolve(`.install-conformance-dist-${process.pid}`);
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

const { init, planWriteSet, preflight, remove, upgrade } = await import(
  pathToFileURL(path.join(output, "install", "index.js")).href
);
const { exitCodeFor } = await import(pathToFileURL(path.join(output, "core", "output.js")).href);

const casesRoot = path.resolve("pkg/conformance/install");
const kitPath = path.resolve("kit");
const baseEnvironment = JSON.parse(
  (await readFile(path.join(casesRoot, "environment.json"), "utf8")).replaceAll("{{version}}", packageVersion),
) as Record<string, unknown>;

type CaseArguments = {
  schema: number;
  platform?: string;
  hostProfile?: {
    windowsCommandShimRequired?: string[];
    settingsScope?: string;
  };
  links?: Array<{ path: string; fixtureTarget: string; kind: string }>;
  outsideFiles?: Record<string, string>;
  steps: Array<{
    run: string[];
    installedVersion?: string;
    answers?: Record<string, unknown>;
    interrupt?: {
      at: string;
      oneFreshCopyPerPoint?: boolean;
    };
    beforeRun?: {
      write: Record<string, string>;
    };
  }>;
  git?: Record<string, unknown>;
};

type CaseSetup = {
  repo: TemporaryRepository;
  options: Record<string, unknown>;
  args: CaseArguments;
  sandbox: string;
};

function merge(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const output = { ...left };
  for (const [key, value] of Object.entries(right)) {
    const old = output[key];
    if (old && value && typeof old === "object" && typeof value === "object" &&
      !Array.isArray(old) && !Array.isArray(value)) {
      output[key] = merge(old as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}

async function copyFixture(caseName: string, repo: TemporaryRepository): Promise<void> {
  const before = path.join(casesRoot, caseName, "before");
  for (const entry of await readdir(before, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") continue;
    await cp(path.join(before, entry.name), path.join(repo.path, entry.name), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }
}

async function makeCase(caseName: string): Promise<CaseSetup> {
  const repo = await tmpRepo(`install-${caseName}`);
  const args = JSON.parse(
    await readFile(path.join(casesRoot, caseName, "args.json"), "utf8"),
  ) as CaseArguments;
  await copyFixture(caseName, repo);
  const sandbox = await mkdtemp(path.join(path.dirname(repo.path), `${caseName}-sandbox-`));
  for (const [relative, contents] of Object.entries(args.outsideFiles ?? {})) {
    const filename = path.join(sandbox, ...relative.split("/"));
    await mkdir(path.dirname(filename), { recursive: true });
    await writeFile(filename, contents);
  }
  for (const link of args.links ?? []) {
    const target = path.join(sandbox, ...link.fixtureTarget.split("/"));
    await mkdir(target, { recursive: true });
    await symlink(target, path.join(repo.path, ...link.path.split("/")), "junction");
  }
  const environment = merge(baseEnvironment, {
    ...(args.git ? { git: args.git } : {}),
    ...(args.platform ? { platform: args.platform } : {}),
    kitPath,
  });
  const git = environment.git as Record<string, unknown>;
  if (git.state === "not-a-repository" || git.state === "tool-unavailable") {
    if (git.state === "not-a-repository") await rm(path.join(repo.path, ".git"), { recursive: true, force: true });
  } else if (git.state === "committed") {
    repo.git(["add", "-A"]);
    repo.git(["commit", "-qm", "fixture"]);
  }
  const step = args.steps[0];
  if (!step) throw new Error(`Missing first step for ${caseName}.`);
  const yes = step.run.includes("--yes");
  const vendor = step.run.includes("--vendor");
  const force = step.run.includes("--force");
  const profileRoot = args.hostProfile?.settingsScope === "isolated-user-profile"
    ? path.join(sandbox, "profile")
    : undefined;
  if (profileRoot) await mkdir(profileRoot, { recursive: true });
  const options = {
    cwd: repo.path,
    yes,
    vendor,
    force,
    answers: step.answers ?? {},
    environment: {
      ...environment,
      ...(profileRoot ? { localProfileRoot: profileRoot } : {}),
      ...(args.hostProfile?.windowsCommandShimRequired
        ? { windowsCommandShimRequired: args.hostProfile.windowsCommandShimRequired }
        : {}),
    },
  };
  return { repo, options, args, sandbox };
}

async function dispose(setup: CaseSetup): Promise<void> {
  await setup.repo.cleanup();
  await rm(setup.sandbox, { recursive: true, force: true });
}

async function tree(root: string): Promise<Record<string, string>> {
  const output: Record<string, string> = {};
  async function visit(directory: string, relative = ""): Promise<void> {
    for (const entry of await readdir(path.join(directory, ...relative.split("/").filter(Boolean)), {
      withFileTypes: true,
    })) {
      if (entry.name === ".git") continue;
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) output[name] = `link:${await readlink(path.join(directory, ...name.split("/")))}`;
      else if (entry.isDirectory()) await visit(directory, name);
      else output[name] = (await readFile(path.join(directory, ...name.split("/")))).toString("base64");
    }
  }
  await visit(root);
  return output;
}

async function optionsForStep(setup: CaseSetup, index: number): Promise<Record<string, unknown>> {
  const step = setup.args.steps[index];
  if (!step) throw new Error(`Missing step ${index + 1}.`);
  const environment = {
    ...(setup.options.environment as Record<string, unknown>),
    ...(step.installedVersion
      ? { installedVersion: step.installedVersion }
      : {}),
  };
  return {
    ...setup.options,
    yes: step.run.includes("--yes"),
    vendor: step.run.includes("--vendor"),
    force: step.run.includes("--force"),
    answers: step.answers ?? {},
    environment,
    check: async () => ({
      findings: [],
      summary: { errors: 0, warnings: 0, advises: 0 },
    }),
  };
}

async function applyStepEdit(setup: CaseSetup, index: number): Promise<void> {
  const edit = setup.args.steps[index]?.beforeRun?.write;
  for (const [relative, contents] of Object.entries(edit ?? {})) {
    await setup.repo.write(relative, contents);
  }
}

function findingCode(error: unknown): string | undefined {
  return (error as { finding?: { code?: string } })?.finding?.code;
}

async function expectedError(caseName: string, step: string): Promise<(error: unknown) => boolean> {
  const expected = JSON.parse(await readFile(
    path.join(casesRoot, caseName, "expected", step, "result.json"),
    "utf8",
  )) as { exitCode: number; findingCode: string };
  return (error: unknown) => {
    const finding = (error as { finding?: Parameters<typeof exitCodeFor>[0][number] }).finding;
    assert.equal(finding?.code, expected.findingCode);
    assert.equal(finding ? exitCodeFor([finding]) : undefined, expected.exitCode);
    return true;
  };
}

test.after(async () => {
  await cleanupTestRoot();
  await rm(output, { recursive: true, force: true });
});

const positiveCases = [
  "p01-empty",
  "p02-node-vitest",
  "p03-node-existing-ci",
  "p04-node-matrix",
  "p05-python-pytest",
  "p06-go",
  "p07-existing-agents-md",
  "p08-existing-mcp",
  "p09-init-repeat-upgrade-remove",
  "p10-remove-keeps-user-edits",
  "p12-windows-local-host",
  "p13-existing-ci-with-services",
  "p14-reusable-workflow",
  "p15-non-github-forge",
  "p16-vendor-fresh-clone",
  "p17-upgrade-pins-and-policy",
  "p18-accepted-reporter-edit",
];

for (const caseName of positiveCases) {
  test(`init conformance: ${caseName}`, async (t) => {
    const setup = await makeCase(caseName);
    t.after(() => dispose(setup));
    const result = await init(setup.options);
    assert.equal(result.cancelled, undefined);
    assert.ok(result.plan);
    await readFile(path.join(setup.repo.path, "tenet.yaml"));
    await readFile(path.join(setup.repo.path, "tenet.lock"));
    const manifestPath = path.join(setup.repo.path, ".tenet", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { version: string };
    assert.equal(manifest.version, packageVersion);
    await assert.rejects(readFile(path.join(setup.repo.path, ".tenet", "manifest.pending.json")));
    assert.ok(result.plan.created
      .filter((itemPath) => /^\.(?:agents|claude)\/skills\//.test(itemPath))
      .every((itemPath) => /\/skills\/tenet-[^/]+\/SKILL\.md$/.test(itemPath)));
    await readFile(path.join(setup.repo.path, ".agents", "skills", "tenet-draft-specs", "SKILL.md"));
    await assert.rejects(readFile(path.join(setup.repo.path, ".agents", "skills", "draft-specs", "SKILL.md")));

    const first = await tree(setup.repo.path);
    if (caseName === "p07-existing-agents-md") {
      const before = await readFile(path.join(casesRoot, caseName, "before", "AGENTS.md"), "utf8");
      const after = await readFile(path.join(setup.repo.path, "AGENTS.md"), "utf8");
      const start = before.indexOf("<!-- tenet:begin");
      const end = before.indexOf("<!-- tenet:end -->") + "<!-- tenet:end -->".length;
      assert.ok(after.startsWith(before.slice(0, start)));
      assert.ok(after.endsWith(before.slice(end)));
      const installed = JSON.parse(await readFile(manifestPath, "utf8")) as {
        blocks: Array<{ path: string; previous_block: string | null }>;
      };
      assert.equal(
        installed.blocks.find((block) => block.path === "AGENTS.md")?.previous_block,
        before.slice(start, end),
      );
    }
    if (caseName === "p08-existing-mcp") {
      const before = await readFile(path.join(casesRoot, caseName, "before", ".mcp.json"), "utf8");
      const after = JSON.parse(await readFile(path.join(setup.repo.path, ".mcp.json"), "utf8")) as {
        mcpServers: Record<string, unknown>;
      };
      assert.deepEqual(after.mcpServers.search, JSON.parse(before).mcpServers.search);
      const installed = JSON.parse(await readFile(manifestPath, "utf8")) as {
        keys: Array<{ path: string; previous_raw?: string }>;
      };
      assert.equal(
        installed.keys.find((key) => key.path === ".mcp.json")?.previous_raw,
        before,
      );
    }
    if (caseName === "p12-windows-local-host") {
      assert.deepEqual(result.wrote.local_keys, result.plan.local_keys);
      assert.ok(setup.repo.git(["ls-files", "--others", "--exclude-standard"]).split(/\r?\n/)
        .includes(".tenet/manifest.local.json"));
      const localRoot = (
        setup.options.environment as { localProfileRoot: string }
      ).localProfileRoot;
      const local = JSON.parse(await readFile(path.join(localRoot, "Code", "User", "mcp.json"), "utf8")) as {
        servers: { tenet: { command: string; args: string[] } };
      };
      assert.equal(local.servers.tenet.command, "cmd");
      assert.deepEqual(local.servers.tenet.args.slice(0, 3), ["/c", "npx", "-y"]);
      const shared = JSON.parse(await readFile(path.join(setup.repo.path, ".vscode", "mcp.json"), "utf8")) as {
        servers: { tenet: { command: string } };
      };
      assert.equal(shared.servers.tenet.command, "npx");
    }
    if (caseName === "p03-node-existing-ci") {
      const policy = await readFile(path.join(setup.repo.path, "tenet.yaml"), "utf8");
      const workflow = await readFile(path.join(setup.repo.path, ".github", "workflows", "ci.yml"), "utf8");
      assert.match(policy, /mode: existing-job/);
      const original = await readFile(
        path.join(casesRoot, caseName, "before", ".github", "workflows", "ci.yml"),
        "utf8",
      );
      assert.ok(workflow.startsWith(original));
      assert.ok(workflow.includes(`# tenet:begin v${packageVersion}\n`));
      assert.match(workflow, /outputFile\.junit=artifacts\/unit\.xml/);
    }
    if (caseName === "p04-node-matrix") {
      const workflow = await readFile(path.join(setup.repo.path, ".github", "workflows", "ci.yml"), "utf8");
      assert.match(workflow, /matrix:/);
      assert.match(workflow, /node: \[20, 22\]/);
    }
    if (caseName === "p13-existing-ci-with-services") {
      const workflow = await readFile(path.join(setup.repo.path, ".github", "workflows", "ci.yml"), "utf8");
      assert.match(workflow, /services:/);
      assert.match(workflow, /image: postgres:16/);
      assert.match(workflow, /POSTGRES_PASSWORD: test-only/);
    }
    if (caseName === "p14-reusable-workflow") {
      const caller = await readFile(path.join(setup.repo.path, ".github", "workflows", "ci.yml"), "utf8");
      assert.equal(caller, await readFile(
        path.join(casesRoot, caseName, "before", ".github", "workflows", "ci.yml"),
        "utf8",
      ));
      const policy = await readFile(path.join(setup.repo.path, "tenet.yaml"), "utf8");
      assert.match(policy, /mode: existing-job/);
      assert.match(policy, /test_workflow: \.github\/workflows\/reusable\.yml/);
    }
    if (caseName === "p18-accepted-reporter-edit") {
      const workflow = await readFile(path.join(setup.repo.path, ".github", "workflows", "ci.yml"), "utf8");
      assert.match(workflow, /- id: tenet-tests/);
      assert.match(workflow, /--outputFile\.junit=\.tenet\/reports\/test\.xml/);
      assert.match(workflow, /TENET_TEST_OUTCOME: "\$\{\{ steps\.tenet-tests\.outcome \}\}"/);
    }
    const testWorkflow = path.join(setup.repo.path, ".github", "workflows", "tenet-tests.yml");
    if (caseName === "p02-node-vitest") {
      const workflow = await readFile(testWorkflow, "utf8");
      assert.match(workflow, /node-version: "22"/);
      assert.doesNotMatch(workflow, /<toolchain step>/);
    }
    if (caseName === "p05-python-pytest") {
      const workflow = await readFile(testWorkflow, "utf8");
      assert.match(workflow, /actions\/setup-python@[0-9a-f]{40} # v5\.6\.0/);
      assert.match(workflow, /python-version: "3\.12"/);
      assert.doesNotMatch(workflow, /<toolchain step>/);
    }
    if (caseName === "p06-go") {
      const workflow = await readFile(testWorkflow, "utf8");
      assert.match(workflow, /actions\/setup-go@[0-9a-f]{40} # v5\.0\.2/);
      assert.match(workflow, /go-version: "1\.23"/);
      assert.doesNotMatch(workflow, /<toolchain step>/);
    }
    const repeat = await init(setup.options);
    assert.deepEqual(repeat.wrote, { created: [], blocks: [], keys: [], local_keys: [] });
    assert.deepEqual(await tree(setup.repo.path), first);

    if (caseName === "p15-non-github-forge") {
      await assert.rejects(readFile(path.join(setup.repo.path, ".github", "workflows", "tenet.yml")));
      assert.equal(result.plan.ci_mode, "none");
    }
  });
}

test("p11 interruption checkpoints replay to the clean tree", async (t) => {
  const clean = await makeCase("p11-interrupted-install-resumes");
  t.after(() => dispose(clean));
  const checked = await preflight(clean.options);
  const planned = await planWriteSet(checked, clean.options);
  const cleanResult = await init(clean.options);
  const expected = await tree(clean.repo.path);
  const checkpoints: Array<"pending" | string> = ["pending", ...planned.writes.map((write) => write.id)];
  for (const checkpoint of checkpoints) {
    const replay = await makeCase("p11-interrupted-install-resumes");
    await assert.rejects(
      init({ ...replay.options, fault: { after: checkpoint } }),
      (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
    );
    await readFile(path.join(replay.repo.path, ".tenet", "manifest.pending.json"));
    const resumed = await init(replay.options);
    assert.deepEqual(resumed, cleanResult, checkpoint);
    assert.deepEqual(await tree(replay.repo.path), expected, checkpoint);
    await dispose(replay);
  }
});

test("resumed init keeps the clean local-integrity finding", async (t) => {
  const clean = await makeCase("p11-interrupted-install-resumes");
  const interrupted = await makeCase("p11-interrupted-install-resumes");
  t.after(async () => {
    await dispose(clean);
    await dispose(interrupted);
  });
  const expected = await init(clean.options);
  await assert.rejects(
    init({ ...interrupted.options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  const resumed = await init(interrupted.options);
  assert.deepEqual(resumed.findings, expected.findings);
});

test("resumed init reconstructs created files separately from blocks", async (t) => {
  const clean = await makeCase("p11-interrupted-install-resumes");
  const interrupted = await makeCase("p11-interrupted-install-resumes");
  t.after(async () => {
    await dispose(clean);
    await dispose(interrupted);
  });
  const expected = await init(clean.options);
  const checked = await preflight(interrupted.options);
  const planned = await planWriteSet(checked, interrupted.options);
  const checkpoint = planned.writes.find((write) =>
    write.kind === "block" && write.path === ".gitignore")?.id;
  assert.ok(checkpoint);
  await assert.rejects(
    init({ ...interrupted.options, fault: { after: checkpoint } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  const resumed = await init(interrupted.options);
  assert.deepEqual(resumed.plan, expected.plan);
  assert.ok(!resumed.plan.created.includes(".gitignore"));
  assert.ok(!resumed.plan.created.includes(".gitattributes"));
});

test("p09 loader runs init, repeat, upgrade and byte-exact remove", async (t) => {
  const setup = await makeCase("p09-init-repeat-upgrade-remove");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  const installed = await tree(setup.repo.path);
  await init(await optionsForStep(setup, 1));
  assert.deepEqual(await tree(setup.repo.path), installed);
  const upgraded = await upgrade(await optionsForStep(setup, 2));
  assert.deepEqual(
    upgraded.changed,
    [...upgraded.changed].sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
  );
  const result = await remove(await optionsForStep(setup, 3));
  assert.equal(result.reminder,
    "If you made the Tenet check required in branch protection or rulesets, remove that rule in your forge settings.");
  assert.deepEqual(await tree(setup.repo.path), await tree(
    path.join(casesRoot, "p09-init-repeat-upgrade-remove", "expected", "04-remove", "tree"),
  ));
});

test("p10 loader keeps user-edited created files and owned keys", async (t) => {
  const setup = await makeCase("p10-remove-keeps-user-edits");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  await applyStepEdit(setup, 1);
  const result = await remove(await optionsForStep(setup, 1));
  assert.deepEqual(result.kept, [
    { path: ".mcp.json", reason: "edited-by-you" },
    { path: "tenet", reason: "spec-or-records" },
    { path: "tenet.yaml", reason: "edited-by-you" },
  ]);
  assert.deepEqual(await tree(setup.repo.path), await tree(
    path.join(casesRoot, "p10-remove-keeps-user-edits", "expected", "02-remove", "tree"),
  ));
});

test("p12 loader upgrades shared and Windows local MCP pins", async (t) => {
  const setup = await makeCase("p12-windows-local-host");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  await upgrade(await optionsForStep(setup, 1));
  for (const relative of [".mcp.json", ".vscode/mcp.json"]) {
    const source = await readFile(path.join(setup.repo.path, relative), "utf8");
    assert.match(source, /@vedprakash-m\/tenet@0\.1\.0-alpha\.1/);
  }
  const localRoot = (setup.options.environment as { localProfileRoot: string }).localProfileRoot;
  const local = JSON.parse(await readFile(
    path.join(localRoot, "Code", "User", "mcp.json"),
    "utf8",
  )) as { servers: { tenet: { args: string[] } } };
  assert.ok(local.servers.tenet.args.includes("@vedprakash-m/tenet@0.1.0-alpha.1"));
  assert.equal(local.servers.tenet.args[0], "/c");
});

test("local manifest durably restores and removes local host keys", async (t) => {
  const setup = await makeCase("p12-windows-local-host");
  t.after(() => dispose(setup));
  const localRoot = (setup.options.environment as { localProfileRoot: string }).localProfileRoot;
  const localPath = path.join(localRoot, "Code", "User", "mcp.json");
  const original = "{\r\n  \"servers\": {\r\n    \"search\": {\"command\":\"node\"}\r\n  }\r\n}\r\n";
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, original);
  await init(await optionsForStep(setup, 0));
  const durable = JSON.parse(await readFile(
    path.join(setup.repo.path, ".tenet", "manifest.local.json"),
    "utf8",
  )) as {
    profile_roots: Record<string, string>;
    keys: Array<{ host: string; path: string; pointer: string; previous_raw?: string }>;
  };
  assert.equal(durable.profile_roots.vscode, localRoot);
  assert.equal(durable.keys[0]?.previous_raw, original);
  await remove(await optionsForStep(setup, 1));
  assert.equal(await readFile(localPath, "utf8"), original);
  await assert.rejects(readFile(path.join(setup.repo.path, ".tenet", "manifest.local.json")));
});

test("remove keeps a user-edited local key and deletes an untouched newly created one", async (t) => {
  const setup = await makeCase("p12-windows-local-host");
  t.after(() => dispose(setup));
  const options = await optionsForStep(setup, 0);
  await init(options);
  const localRoot = (setup.options.environment as { localProfileRoot: string }).localProfileRoot;
  const localPath = path.join(localRoot, "Code", "User", "mcp.json");
  const source = JSON.parse(await readFile(localPath, "utf8")) as {
    servers: { tenet: { command: string; args: string[] } };
  };
  source.servers.tenet.command = "owner-command";
  await writeFile(localPath, `${JSON.stringify(source, null, 2)}\n`);
  const result = await remove(options);
  assert.ok(result.kept.some((item) =>
    item.path === localPath.replaceAll("\\", "/") && item.reason === "edited-by-you"));
  assert.equal((JSON.parse(await readFile(localPath, "utf8")) as {
    servers: { tenet: { command: string } };
  }).servers.tenet.command, "owner-command");
});

test("remove deletes JSON wrappers and local files created only for owned keys", async (t) => {
  const setup = await makeCase("p12-windows-local-host");
  t.after(() => dispose(setup));
  const options = await optionsForStep(setup, 0);
  await init(options);
  const localRoot = (setup.options.environment as { localProfileRoot: string }).localProfileRoot;
  const localPath = path.join(localRoot, "Code", "User", "mcp.json");
  await remove(options);
  await assert.rejects(readFile(path.join(setup.repo.path, ".mcp.json")));
  await assert.rejects(readFile(localPath));
});

test("remove restores a pre-existing zero-byte managed block file", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await setup.repo.write(".github/pull_request_template.md", "");
  await init(await optionsForStep(setup, 0));
  const manifest = JSON.parse(await readFile(
    path.join(setup.repo.path, ".tenet", "manifest.json"),
    "utf8",
  )) as { blocks: Array<{ path: string; previous_block: string | null }> };
  assert.equal(manifest.blocks.find((item) =>
    item.path === ".github/pull_request_template.md")?.previous_block, "");
  const result = await remove(await optionsForStep(setup, 0));
  assert.equal(await readFile(path.join(setup.repo.path, ".github", "pull_request_template.md"), "utf8"), "");
  assert.ok(result.removed.some((item) =>
    item.path === ".github/pull_request_template.md" && item.kind === "block"));
});

test("init and remove preserve the exact existing pull-request template name", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  const expected = "# Existing pull request template\n";
  await setup.repo.write(".github/PULL_REQUEST_TEMPLATE.md", expected);

  const result = await init(setup.options);
  assert.ok(result.plan.blocks.some((block) =>
    block.path === ".github/PULL_REQUEST_TEMPLATE.md" && block.kind === "markdown"));
  assert.ok(!result.plan.blocks.some((block) =>
    block.path === ".github/pull_request_template.md"));
  await remove(setup.options);
  assert.equal(
    await readFile(path.join(setup.repo.path, ".github", "PULL_REQUEST_TEMPLATE.md"), "utf8"),
    expected,
  );
  const names = await readdir(path.join(setup.repo.path, ".github"));
  assert.ok(names.includes("PULL_REQUEST_TEMPLATE.md"));
  assert.ok(!names.includes("pull_request_template.md"));
});

test("remove preserves pre-existing empty ancestor objects during JSON key restoration", async (t) => {
  const setup = await makeCase("p08-existing-mcp");
  t.after(() => dispose(setup));
  const original = "{\n  \"mcpServers\": {},\n  \"unowned\": {}\n}\n";
  await setup.repo.write(".mcp.json", original);
  await init(await optionsForStep(setup, 0));
  await remove(await optionsForStep(setup, 0));
  assert.equal(await readFile(path.join(setup.repo.path, ".mcp.json"), "utf8"), original);
});

test("remove deletes created directories but keeps pre-existing empty directories", async (t) => {
  const created = await makeCase("p01-empty");
  const existing = await makeCase("p01-empty");
  t.after(async () => {
    await dispose(created);
    await dispose(existing);
  });
  await mkdir(path.join(existing.repo.path, "tenet"));

  await init(created.options);
  await remove(created.options);
  await assert.rejects(lstat(path.join(created.repo.path, "tenet")), { code: "ENOENT" });

  await init(existing.options);
  await remove(existing.options);
  assert.equal((await lstat(path.join(existing.repo.path, "tenet"))).isDirectory(), true);
});

test("remove deletes known generated .tenet state but preserves user state", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await init(setup.options);
  await setup.repo.write(".tenet/onboard/inventory.json", "{}\n");
  await setup.repo.write(".tenet/onboard/assignment.json", "{}\n");
  await setup.repo.write(".tenet/onboard/interview.json", "{\"answers\":[\"keep\"]}\n");
  await setup.repo.write(".tenet/cache/item.json", "{}\n");
  await setup.repo.write(".tenet/runs/session/output.txt", "generated\n");
  await setup.repo.write(".tenet/reports/test.xml", "<testsuite/>\n");
  await setup.repo.write(".tenet/reports/custom.json", "{\"keep\":true}\n");
  const outside = path.join(setup.sandbox, "outside-cache");
  await mkdir(outside, { recursive: true });
  await writeFile(path.join(outside, "sentinel.txt"), "keep\n");
  await symlink(outside, path.join(setup.repo.path, ".tenet", "cache", "external"), "junction");

  const result = await remove(setup.options);
  for (const filename of [
    ".tenet/onboard/inventory.json",
    ".tenet/onboard/assignment.json",
    ".tenet/cache/item.json",
    ".tenet/cache/external",
    ".tenet/runs/session/output.txt",
    ".tenet/reports/test.xml",
  ]) {
    await assert.rejects(readFile(path.join(setup.repo.path, ...filename.split("/"))), { code: "ENOENT" });
    assert.ok(result.removed.some((item) => item.path === filename && item.kind === "file"));
  }
  assert.equal(
    await readFile(path.join(setup.repo.path, ".tenet/onboard/interview.json"), "utf8"),
    "{\"answers\":[\"keep\"]}\n",
  );
  assert.equal(
    await readFile(path.join(setup.repo.path, ".tenet/reports/custom.json"), "utf8"),
    "{\"keep\":true}\n",
  );
  assert.equal(await readFile(path.join(outside, "sentinel.txt"), "utf8"), "keep\n");
  await assert.rejects(lstat(path.join(setup.repo.path, ".tenet", "cache")), { code: "ENOENT" });
  await assert.rejects(lstat(path.join(setup.repo.path, ".tenet", "runs", "session")), { code: "ENOENT" });
  await assert.rejects(lstat(path.join(setup.repo.path, ".tenet", "runs")), { code: "ENOENT" });
});

test("remove unlinks symlinked .tenet parents without touching their targets", async (t) => {
  for (const location of ["inside", "outside"] as const) {
    const setup = await makeCase("p02-node-vitest");
    t.after(() => dispose(setup));
    await init(setup.options);
    const target = location === "inside"
      ? path.join(setup.repo.path, "owner-notes")
      : path.join(setup.sandbox, "outside-onboard");
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, "inventory.json"), `keep-${location}\n`);
    await writeFile(path.join(target, "sentinel.txt"), "keep\n");
    await symlink(target, path.join(setup.repo.path, ".tenet", "onboard"), "junction");

    await remove(setup.options);

    await assert.rejects(lstat(path.join(setup.repo.path, ".tenet", "onboard")), { code: "ENOENT" });
    assert.equal(await readFile(path.join(target, "inventory.json"), "utf8"), `keep-${location}\n`);
    assert.equal(await readFile(path.join(target, "sentinel.txt"), "utf8"), "keep\n");
  }
});

test("remove validates generated report paths before changing the tree", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await init(setup.options);
  const policyPath = path.join(setup.repo.path, "tenet.yaml");
  const policy = await readFile(policyPath, "utf8");
  const edited = policy.replace(
    "report_path: .tenet/reports/test.xml",
    "report_path: .tenet/reports/../secrets.json",
  );
  assert.notEqual(edited, policy);
  await writeFile(policyPath, edited);
  await writeFile(path.join(setup.repo.path, ".tenet", "secrets.json"), "keep\n");
  const before = await tree(setup.repo.path);

  await assert.rejects(remove(setup.options), (error: unknown) =>
    (error as { code?: string }).code === "TN-PATH-ESCAPE");

  assert.deepEqual(await tree(setup.repo.path), before);
});

test("remove matches configured reports but preserves case-mismatched standard reports", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await init(setup.options);
  const policyPath = path.join(setup.repo.path, "tenet.yaml");
  const policy = await readFile(policyPath, "utf8");
  await writeFile(
    policyPath,
    policy.replace(
      "report_path: .tenet/reports/test.xml",
      "report_path: .tenet/Reports/CUSTOM.XML",
    ),
  );
  await setup.repo.write(".tenet/Reports/CUSTOM.XML", "<testsuite/>\n");
  await setup.repo.write(".tenet/reports/TEST.XML", "keep\n");

  await remove({
    ...setup.options,
    environment: {
      ...(setup.options.environment as Record<string, unknown>),
      platform: "win32",
    },
  });

  await assert.rejects(readFile(path.join(
    setup.repo.path,
    ".tenet",
    "Reports",
    "CUSTOM.XML",
  )), { code: "ENOENT" });
  assert.equal(
    await readFile(path.join(setup.repo.path, ".tenet", "reports", "TEST.XML"), "utf8"),
    "keep\n",
  );
});

test("remove rejects a recorded file under a symlinked parent before any deletion", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await init(setup.options);
  const target = path.join(setup.sandbox, "recorded-parent");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "secret.txt"), "keep\n");
  await symlink(target, path.join(setup.repo.path, "recorded-link"), "junction");
  const manifestPath = path.join(setup.repo.path, ".tenet", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    created: Array<{ path: string; sha256: string }>;
  };
  manifest.created.push({
    path: "recorded-link/secret.txt",
    sha256: "0".repeat(64),
  });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const before = await tree(setup.repo.path);

  await assert.rejects(remove(setup.options), (error: unknown) =>
    (error as { code?: string }).code === "TN-PATH-ESCAPE");

  assert.deepEqual(await tree(setup.repo.path), before);
  assert.equal(await readFile(path.join(target, "secret.txt"), "utf8"), "keep\n");
});

test("remove preserves pre-existing empty generated-state directories", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  for (const relative of [".tenet/onboard", ".tenet/reports", ".tenet/cache", ".tenet/runs"]) {
    await mkdir(path.join(setup.repo.path, ...relative.split("/")), { recursive: true });
  }
  await init(setup.options);

  await remove(setup.options);

  for (const relative of [".tenet/onboard", ".tenet/reports", ".tenet/cache", ".tenet/runs", ".tenet"]) {
    const stat = await lstat(path.join(setup.repo.path, ...relative.split("/")));
    assert.equal(stat.isDirectory(), true);
    if (relative !== ".tenet") {
      assert.deepEqual(await readdir(path.join(setup.repo.path, ...relative.split("/"))), []);
    }
  }
});

test("remove clears known generated state without a manifest", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await setup.repo.write(".tenet/onboard/inventory.json", "{}\n");
  await setup.repo.write(".tenet/onboard/assignment.json", "{}\n");
  await setup.repo.write(".tenet/cache/session/output.txt", "generated\n");
  await setup.repo.write(".tenet/runs/session/output.txt", "generated\n");

  const result = await remove(setup.options);

  assert.ok(result.removed.some((item) => item.path === ".tenet/onboard/inventory.json"));
  assert.ok(result.removed.some((item) => item.path === ".tenet/onboard/assignment.json"));
  await assert.rejects(lstat(path.join(setup.repo.path, ".tenet")), { code: "ENOENT" });
});

test("[AC-C2] [R2-21] remove keeps Owner interview answers and lists every generated file it deletes", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  const generated = [
    ".tenet/onboard/inventory.json",
    ".tenet/onboard/assignment.json",
    ".tenet/onboard/scratch/unit.json",
    ".tenet/reports/test.xml",
    ".tenet/cache/session/output.txt",
    ".tenet/runs/session/output.txt",
  ];
  for (const filename of generated) await setup.repo.write(filename, "generated\n");
  await setup.repo.write(".tenet/onboard/interview.json", '{"questions":[]}\n');

  const result = await remove(setup.options);

  assert.deepEqual(result.kept, [{
    path: ".tenet/onboard/interview.json",
    reason: "Owner interview answers",
  }]);
  assert.equal(
    await readFile(path.join(setup.repo.path, ".tenet/onboard/interview.json"), "utf8"),
    '{"questions":[]}\n',
  );
  for (const filename of generated) {
    assert.ok(result.removed.some(({ path: itemPath, kind }) =>
      itemPath === filename && kind === "file"), `${filename} is listed as removed`);
    await assert.rejects(lstat(path.join(setup.repo.path, ...filename.split("/"))), {
      code: "ENOENT",
    });
  }
});

test("p17 loader upgrades owned pins without changing policy", async (t) => {
  const setup = await makeCase("p17-upgrade-pins-and-policy");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  await applyStepEdit(setup, 1);
  const policy = await readFile(path.join(setup.repo.path, "tenet.yaml"), "utf8");
  await upgrade(await optionsForStep(setup, 1));
  assert.equal(await readFile(path.join(setup.repo.path, "tenet.yaml"), "utf8"), policy);
  for (const relative of [".mcp.json", ".cursor/mcp.json"]) {
    const source = await readFile(path.join(setup.repo.path, relative), "utf8");
    assert.match(source, /@vedprakash-m\/tenet@0\.1\.0-alpha\.1/);
  }
});

test("[AB-E1] [F-56] same-version upgrade leaves an edited integrity pin untouched", async (t) => {
  const setup = await makeCase("p01-empty");
  t.after(() => dispose(setup));
  const firstIntegrity = `sha512-${"A".repeat(86)}==`;
  const editedIntegrity = `sha512-${"B".repeat(86)}==`;
  const refreshedIntegrity = `sha512-${"C".repeat(86)}==`;
  const initial = {
    ...setup.options,
    environment: {
      ...(setup.options.environment as Record<string, unknown>),
      registry: {
        package: "@vedprakash-m/tenet",
        releases: { [packageVersion]: { integrity: firstIntegrity } },
      },
    },
  };
  await init(initial);
  const lockPath = path.join(setup.repo.path, "tenet.lock");
  const lock = JSON.parse(await readFile(lockPath, "utf8")) as Record<string, unknown>;
  lock.integrity = editedIntegrity;
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);

  const upgraded = await upgrade({
    ...setup.options,
    environment: {
      ...(setup.options.environment as Record<string, unknown>),
      registry: {
        package: "@vedprakash-m/tenet",
        releases: { [packageVersion]: { integrity: refreshedIntegrity } },
      },
    },
  });
  assert.deepEqual(upgraded.changed, []);
  assert.equal(
    (JSON.parse(await readFile(lockPath, "utf8")) as { integrity: string }).integrity,
    editedIntegrity,
  );
});

test("[AB-E1] [F-56] same-version offline upgrade preserves the install manifest and remove set", async (t) => {
  const setup = await makeCase("p09-init-repeat-upgrade-remove");
  t.after(() => dispose(setup));
  await init(setup.options);
  const before = await tree(setup.repo.path);
  const manifestPath = path.join(setup.repo.path, ".tenet", "manifest.json");
  const manifest = await readFile(manifestPath, "utf8");
  const result = await upgrade({
    ...setup.options,
    offline: true,
    environment: {
      ...(setup.options.environment as Record<string, unknown>),
      installedVersion: packageVersion,
    },
  });
  assert.equal(result.from, packageVersion);
  assert.equal(result.to, packageVersion);
  assert.deepEqual(result.changed, []);
  assert.equal(await readFile(manifestPath, "utf8"), manifest);
  assert.deepEqual(await tree(setup.repo.path), before);
  const removed = await remove(setup.options);
  for (const expected of [
    ".github/pull_request_template.md",
    ".github/workflows/tenet.yml",
    ".github/workflows/tenet-tests.yml",
  ]) {
    assert.ok(removed.removed.some(({ path: itemPath }) => itemPath === expected));
  }
});

test("[AB-E2] [F-47] same-version upgrade migrates legacy anchor text to hashes and ranges", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  const revision = setup.repo.git(["rev-parse", "HEAD"]).trim();
  const body = "- R-1 Retry once. {origin: observed; cites: src/retry.ts:1}\n";
  const copyPath = "tenet/blessed/intent/requirements.md";
  await setup.repo.write("tenet/intent.md", [
    "---",
    `tenet: {spec: 1, doc: intent, level: L1}`,
    `sections: {requirements: {state: blessed, digest: "sha256:copy", blessed_digest: "sha256:copy", blessed_at_rev: "${revision}", blessed_copy: "${copyPath}", anchors: {"src/retry.ts:1": "sha256:9a74cf030d03b1a7ce2bb020957fe891795bd801afad57ba43ed64776d2afced"}, flags: []}}`,
    "---",
    "## Requirements",
    body,
  ].join("\n"));
  await setup.repo.write(copyPath, body);
  await setup.repo.write(`${copyPath}.anchors.json`, '{"src/retry.ts:1":"export const retries = 1;"}\n');
  await init(setup.options);
  const result = await upgrade({
    ...setup.options,
    offline: true,
    environment: {
      ...(setup.options.environment as Record<string, unknown>),
      installedVersion: packageVersion,
    },
  });
  assert.deepEqual(result.changed, [{ path: `${copyPath}.anchors.json`, action: "replaced" }]);
  const migrated = JSON.parse(await readFile(
    path.join(setup.repo.path, ...`${copyPath}.anchors.json`.split("/")),
    "utf8",
  ));
  assert.deepEqual(Object.keys(migrated["src/retry.ts:1"]).sort(), [
    "blessed_at_rev", "end", "hash", "start",
  ]);
  assert.equal(migrated["src/retry.ts:1"].start, 1);
  assert.equal(migrated["src/retry.ts:1"].end, 1);
  assert.equal(migrated["src/retry.ts:1"].blessed_at_rev, revision);
  assert.doesNotMatch(JSON.stringify(migrated), /export const retries/);
});

test("[AB-E2] [F-47] legacy migration keeps the stored hash when the blessing commit is unavailable", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  const missingRevision = "0123456789012345678901234567890123456789";
  const storedHash = "sha256:9a74cf030d03b1a7ce2bb020957fe891795bd801afad57ba43ed64776d2afced";
  const body = "- R-1 Retry once. {origin: observed; cites: src/retry.ts:1-1}\n";
  const copyPath = "tenet/blessed/intent/requirements.md";
  await setup.repo.write("tenet/intent.md", [
    "---",
    "tenet: {spec: 1, doc: intent, level: L1}",
    `sections: {requirements: {state: blessed, digest: "sha256:copy", blessed_digest: "sha256:copy", blessed_at_rev: "${missingRevision}", blessed_copy: "${copyPath}", anchors: {"src/retry.ts:1-1": "${storedHash}"}, flags: []}}`,
    "---",
    "## Requirements",
    body,
  ].join("\n"));
  await setup.repo.write(copyPath, body);
  await setup.repo.write(
    `${copyPath}.anchors.json`,
    '{"src/retry.ts:1-1":"export const retries = 1;"}\n',
  );
  await setup.repo.write("src/retry.ts", "export const retries = 2;\n");
  await init(setup.options);
  const result = await upgrade({
    ...setup.options,
    offline: true,
    environment: {
      ...(setup.options.environment as Record<string, unknown>),
      installedVersion: packageVersion,
    },
  });
  assert.deepEqual(result.changed, [{ path: `${copyPath}.anchors.json`, action: "replaced" }]);
  const migrated = JSON.parse(await readFile(
    path.join(setup.repo.path, ...`${copyPath}.anchors.json`.split("/")),
    "utf8",
  ));
  assert.deepEqual(migrated["src/retry.ts:1-1"], {
    hash: storedHash,
    start: 1,
    end: 1,
    blessed_at_rev: missingRevision,
  });
  assert.doesNotMatch(JSON.stringify(migrated), /export const retries = 1;/);
});

test("p17 lexical JSON formatting survives owned pin replacement", async (t) => {
  const setup = await makeCase("p17-upgrade-pins-and-policy");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  const lexical = [
    "{\r\n",
    "\t\"mcpServers\": {\r\n",
    "\t\t\"search\"  :  { \"command\" : \"node\", \"args\" : [\"search.js\"] },\r\n",
    `\t\t\"tenet\": {\"command\":\"npx\",\"args\":[\"-y\",\"@vedprakash-m/tenet@${packageVersion}\",\"mcp\"]}\r\n`,
    "\t}\r\n",
    "}\r\n",
  ].join("");
  await setup.repo.write(".mcp.json", lexical);
  await upgrade(await optionsForStep(setup, 1));
  assert.equal(
    await readFile(path.join(setup.repo.path, ".mcp.json"), "utf8"),
    lexical.replace(`@vedprakash-m/tenet@${packageVersion}`, "@vedprakash-m/tenet@0.1.0-alpha.1"),
  );
});

test("remove deletes a newly owned MCP key without rewriting sibling JSON", async (t) => {
  const setup = await makeCase("p10-remove-keeps-user-edits");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  const lexical = [
    "{\r\n",
    "  \"mcpServers\": { \"tenet\":",
    ` {\"command\":\"npx\",\"args\":[\"-y\",\"@vedprakash-m/tenet@${packageVersion}\",\"mcp\"]},`,
    " \"owner\" : { \"command\" : \"node\" } }\r\n",
    "}\r\n",
  ].join("");
  await setup.repo.write(".mcp.json", lexical);
  const manifestPath = path.join(setup.repo.path, ".tenet", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    keys: Array<{ path: string; previous: unknown; previous_raw?: string }>;
  };
  const key = manifest.keys.find((item) => item.path === ".mcp.json");
  assert.ok(key);
  key.previous = null;
  key.previous_raw = "{\r\n  \"mcpServers\": { \"owner\" : { \"command\" : \"node\" } }\r\n}\r\n";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await remove(await optionsForStep(setup, 1));
  assert.equal(
    await readFile(path.join(setup.repo.path, ".mcp.json"), "utf8"),
    "{\r\n  \"mcpServers\": { \"owner\" : { \"command\" : \"node\" } }\r\n}\r\n",
  );
});

test("upgrade resumes from the original manifest and excludes pending bookkeeping", async (t) => {
  const setup = await makeCase("p12-windows-local-host");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  const options = await optionsForStep(setup, 1);
  await assert.rejects(
    upgrade({ ...options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  const pending = await readFile(
    path.join(setup.repo.path, ".tenet", "manifest.pending.json"),
    "utf8",
  );
  assert.match(pending, /0\.1\.0-alpha\.1/);
  const resumed = await upgrade(options);
  assert.equal(resumed.from, packageVersion);
  assert.equal(resumed.to, "0.1.0-alpha.1");
  assert.ok(resumed.changed.every((item) => item.path !== ".tenet/manifest.pending.json"));
});

test("upgrade resume returns exact uninterrupted rows after pending save", async (t) => {
  const clean = await makeCase("p17-upgrade-pins-and-policy");
  const interrupted = await makeCase("p17-upgrade-pins-and-policy");
  t.after(async () => {
    await dispose(clean);
    await dispose(interrupted);
  });
  for (const setup of [clean, interrupted]) {
    await init(await optionsForStep(setup, 0));
    await applyStepEdit(setup, 1);
    const owned = JSON.parse(await readFile(
      path.join(setup.repo.path, ".mcp.json"),
      "utf8",
    )) as { mcpServers: Record<string, unknown> };
    owned.mcpServers.tenet = { command: "node", args: ["owner-tenet.js"] };
    await setup.repo.write(".mcp.json", `${JSON.stringify(owned, null, 2)}\n`);
  }
  const uninterrupted = await upgrade(await optionsForStep(clean, 1));
  assert.ok(uninterrupted.changed.some((row) =>
    row.path === "tenet.yaml" && row.action === "kept"));
  assert.ok(uninterrupted.changed.some((row) =>
    row.path === ".mcp.json" && row.action === "kept"));
  const options = await optionsForStep(interrupted, 1);
  await assert.rejects(
    upgrade({ ...options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  const pending = JSON.parse(await readFile(
    path.join(interrupted.repo.path, ".tenet", "manifest.pending.json"),
    "utf8",
  )) as { upgrade?: unknown };
  assert.deepEqual(pending.upgrade, {
    from: uninterrupted.from,
    to: uninterrupted.to,
    changed: uninterrupted.changed,
  });
  assert.deepEqual(await upgrade(options), uninterrupted);
});

test("upgrade resume returns exact uninterrupted rows after a write", async (t) => {
  const clean = await makeCase("p17-upgrade-pins-and-policy");
  const interrupted = await makeCase("p17-upgrade-pins-and-policy");
  t.after(async () => {
    await dispose(clean);
    await dispose(interrupted);
  });
  for (const setup of [clean, interrupted]) {
    await init(await optionsForStep(setup, 0));
    await applyStepEdit(setup, 1);
  }
  const uninterrupted = await upgrade(await optionsForStep(clean, 1));
  const options = await optionsForStep(interrupted, 1);
  await assert.rejects(
    upgrade({ ...options, fault: { after: 1 } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  assert.deepEqual(await upgrade(options), uninterrupted);
});

test("upgrade rejects an unrecorded installation when no pending upgrade exists", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await assert.rejects(upgrade(await optionsForStep(setup, 0)), (error: unknown) =>
    findingCode(error) === "TN-INIT-EXISTS");
  await assert.rejects(readFile(path.join(setup.repo.path, ".tenet", "manifest.json")));
  await assert.rejects(readFile(path.join(setup.repo.path, ".tenet", "manifest.pending.json")));
});

test("upgrade resumes a valid pending plan after the active manifest is missing", async (t) => {
  const setup = await makeCase("p17-upgrade-pins-and-policy");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  const options = await optionsForStep(setup, 1);
  await assert.rejects(
    upgrade({ ...options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  await rm(path.join(setup.repo.path, ".tenet", "manifest.json"));
  const result = await upgrade(options);
  assert.equal(result.from, packageVersion);
  assert.equal(result.to, "0.1.0-alpha.1");
  await readFile(path.join(setup.repo.path, ".tenet", "manifest.json"));
});

test("resume confines local paths before replay mutation", async (t) => {
  const setup = await makeCase("p12-windows-local-host");
  t.after(() => dispose(setup));
  await init(await optionsForStep(setup, 0));
  const options = await optionsForStep(setup, 1);
  await assert.rejects(
    upgrade({ ...options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  const pendingPath = path.join(setup.repo.path, ".tenet", "manifest.pending.json");
  const pending = JSON.parse(await readFile(pendingPath, "utf8")) as {
    writes: Array<{ kind: string; path: string }>;
  };
  const local = pending.writes.find((write) => write.kind === "local_key");
  assert.ok(local);
  local.path = path.join(setup.sandbox, "outside-local.json");
  await writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`);
  const before = await tree(setup.repo.path);
  await assert.rejects(upgrade(options), (error: unknown) => findingCode(error) === "TN-PATH-ESCAPE");
  assert.deepEqual(await tree(setup.repo.path), before);
});

test("n04 confined planning rejects an outside symlink before any write", async (t) => {
  const setup = await makeCase("n04-init-symlink-outside");
  t.after(() => dispose(setup));
  const before = await tree(setup.repo.path);
  await assert.rejects(init(setup.options),
    await expectedError("n04-init-symlink-outside", "01-init"));
  assert.deepEqual(await tree(setup.repo.path), before);
  assert.equal(
    await readFile(path.join(setup.sandbox, "github-sibling", "workflows", "sentinel.yml"), "utf8"),
    "name: Outside fixture\n",
  );
});

test("accepted reporter edit appends flags inside a multiline YAML run block", async (t) => {
  const setup = await makeCase("p18-accepted-reporter-edit");
  t.after(() => dispose(setup));
  await setup.repo.write(".github/workflows/ci.yml", [
    "name: Checkout CI",
    "on: [push, pull_request]",
    "jobs:",
    "  test:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - run: npm ci",
    "      - run: |",
    "          npx vitest run",
    "          echo tests-finished",
    "",
  ].join("\n"));
  const result = await init(setup.options);
  assert.equal(result.plan.ci_mode, "existing-ci");
  const workflow = await readFile(path.join(setup.repo.path, ".github", "workflows", "ci.yml"), "utf8");
  assert.match(workflow, /- id: tenet-tests\n {8}run: \|\n {10}npx vitest run --reporter=default --reporter=junit --outputFile\.junit=\.tenet\/reports\/test\.xml\n {10}echo tests-finished\n/);
  assert.doesNotMatch(workflow, /run: \| --reporter/);
  assert.equal((workflow.match(/\n {10}echo tests-finished\n/) ?? []).length, 1);
});

test("Tenet test workflow binds the Node toolchain from .nvmrc", async (t) => {
  const setup = await makeCase("p02-node-vitest");
  t.after(() => dispose(setup));
  await setup.repo.write(".nvmrc", "20.11.1\n");
  await init(setup.options);
  const workflow = await readFile(
    path.join(setup.repo.path, ".github", "workflows", "tenet-tests.yml"),
    "utf8",
  );
  assert.match(workflow, /node-version: "20\.11\.1"/);
  assert.doesNotMatch(workflow, /<toolchain step>/);
});

test("n05 refuses an unmanaged created workflow without leaving a pending plan", async (t) => {
  const setup = await makeCase("n05-conflicting-created-workflow");
  t.after(() => dispose(setup));
  const before = await tree(setup.repo.path);
  await assert.rejects(init(setup.options),
    await expectedError("n05-conflicting-created-workflow", "01-init"));
  assert.deepEqual(await tree(setup.repo.path), before);
});

test("n03 remove rejects a recorded parent path before every write", async (t) => {
  const setup = await makeCase("n03-remove-recorded-parent-path");
  t.after(() => dispose(setup));
  const before = await tree(setup.repo.path);
  await assert.rejects(remove(setup.options),
    await expectedError("n03-remove-recorded-parent-path", "01-remove"));
  assert.deepEqual(await tree(setup.repo.path), before);
  assert.equal(await readFile(path.join(setup.sandbox, "outside-sentinel.txt"), "utf8"),
    "Keep this fixture sentinel.\n");
});

test("resume validates every pending path before applying an earlier write", async (t) => {
  const setup = await makeCase("p11-interrupted-install-resumes");
  t.after(() => dispose(setup));
  await assert.rejects(
    init({ ...setup.options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  const pendingPath = path.join(setup.repo.path, ".tenet", "manifest.pending.json");
  const pending = JSON.parse(await readFile(pendingPath, "utf8")) as {
    writes: Array<Record<string, unknown>>;
  };
  pending.writes.push({
    id: "escape",
    kind: "file",
    path: "../outside.txt",
    before_sha256: null,
    after_sha256: "a".repeat(64),
    content: "outside\n",
  });
  await writeFile(pendingPath, `${JSON.stringify(pending, null, 2)}\n`);
  const before = await tree(setup.repo.path);
  await assert.rejects(init(setup.options), (error: unknown) => findingCode(error) === "TN-PATH-ESCAPE");
  assert.deepEqual(await tree(setup.repo.path), before);
});

test("n06 keeps a pending plan and refuses drift during replay", async (t) => {
  const setup = await makeCase("n06-interrupted-plan-drift");
  t.after(() => dispose(setup));
  await assert.rejects(
    init({ ...setup.options, fault: { after: "pending" } }),
    (error: unknown) => (error as { code?: string }).code === "INSTALL_INTERRUPTED",
  );
  await setup.repo.write("AGENTS.md", "# Owner edit since planning\n");
  await assert.rejects(init(setup.options), (error: unknown) => findingCode(error) === "TN-INIT-EXISTS");
  await readFile(path.join(setup.repo.path, ".tenet", "manifest.pending.json"));
  assert.equal(await readFile(path.join(setup.repo.path, "AGENTS.md"), "utf8"), "# Owner edit since planning\n");
});

test("n08 cancellation preserves the exact repository tree", async (t) => {
  const setup = await makeCase("n08-preflight-declined");
  t.after(() => dispose(setup));
  const before = await tree(setup.repo.path);
  const result = await init(setup.options);
  assert.equal(result.cancelled, true);
  assert.deepEqual(result.wrote, { created: [], blocks: [], keys: [], local_keys: [] });
  assert.deepEqual(await tree(setup.repo.path), before);
  assert.deepEqual(await tree(setup.repo.path), await tree(
    path.join(casesRoot, "n08-preflight-declined", "expected", "01-init", "tree"),
  ));
});

test("n01 and n02 expose structured preflight findings without writes", async () => {
  for (const [caseName, code] of [
    ["n01-git-executable-missing", "TN-ENV-GIT"],
    ["n02-not-a-git-repository", "TN-ENV-NOT-GIT"],
  ] as const) {
    const setup = await makeCase(caseName);
    if (caseName === "n02-not-a-git-repository") {
      await assert.rejects(init(setup.options), await expectedError(caseName, "01-init"));
    } else {
      await assert.rejects(init(setup.options), (error: unknown) => findingCode(error) === code);
    }
    assert.deepEqual(await tree(setup.repo.path), { "README.md": (await readFile(
      path.join(casesRoot, caseName, "before", "README.md"),
    )).toString("base64") });
    await dispose(setup);
  }
});
