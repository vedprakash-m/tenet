import assert from "node:assert/strict";
import { Readable } from "node:stream";
import test from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { readFile } from "node:fs/promises";
import { makeDoctorCommand } from "../../dist/commands/doctor.js";
import { makeInitCommand } from "../../dist/commands/init.js";
import { makeRemoveCommand } from "../../dist/commands/remove.js";
import { makeUpgradeCommand } from "../../dist/commands/upgrade.js";
import { packageVersion } from "../helpers/packageVersion.ts";

function writer() {
  let text = "";
  return {
    output: { write(value: string | Uint8Array) { text += String(value); } },
    text: () => text,
  };
}

function context(overrides: Record<string, unknown> = {}) {
  const stdout = writer();
  const stderr = writer();
  return {
    args: [],
    options: {},
    cwd: process.cwd(),
    stdin: Readable.from([]),
    stdout: stdout.output,
    stderr: stderr.output,
    now: () => new Date("2026-11-23T10:00:00Z"),
    json: true,
    quiet: false,
    verbose: false,
    offline: false,
    ...overrides,
    captures: { stdout, stderr },
  };
}

const plan = {
  created: ["tenet.yaml"],
  blocks: [{ path: "AGENTS.md", kind: "markdown" as const }],
  keys: [],
  local_keys: [],
  hosts: [{ id: "agents", capability: "skills+mcp" as const }],
  ci_mode: "none" as const,
  ci_reason: "local only",
};

test("init command prompts, collects answers and returns the exact install result", async () => {
  const value = {
    plan,
    wrote: { created: ["tenet.yaml"], blocks: [], keys: [], local_keys: [] },
    findings: [],
  };
  const acceptedPlan = {
    ...plan,
    created: [".github/workflows/ci.yml", "tenet.yaml"],
    ci_mode: "existing-ci" as const,
    ci_reason: "existing CI reporter edit accepted",
  };
  let preflightCalls = 0;
  const preflight = async (options: Record<string, unknown>) => ({
    plan: options.answers ? acceptedPlan : plan,
    findings: [],
    diagnostics: [],
    prompts: [
      { key: "purpose" as const, question: "What is this project for?" },
      {
        key: "kind" as const,
        question: "Project kind (service/library/data/infrastructure/ml/other) [other]:",
        options: ["other" as const],
        default: "other",
      },
      ...(!options.answers ? [{
        key: "reporterEdit" as const,
        question: "Add a test reporter setting to the existing CI job?",
        default: false,
      }] : []),
    ],
    facts: {
      repository: { cwd: ".", git: true, head: null, branch: "main", remote: null, forge: "other" as const, empty: true },
      runner: null,
      ci: { jobs: [], selected: null },
      owners: [],
      purpose: null,
      kind: null,
    },
  });
  const preflightWithCount = async (options: Record<string, unknown>) => {
    preflightCalls += 1;
    return preflight(options);
  };
  let received: Record<string, unknown> | undefined;
  const command = makeInitCommand({
    terminal: true,
    preflight: preflightWithCount as never,
    init: async (options) => {
      received = options;
      return value;
    },
  });
  const request = context({ stdin: Readable.from(["y\n", "An example\n", "\n", "y\n"]) });
  const outcome = await command.run?.(request) as { result: unknown; findings: unknown[] };
  assert.deepEqual(outcome, { result: value, findings: [] });
  assert.deepEqual(received?.answers, {
    purpose: "An example",
    kind: "other",
    continue: true,
    allowReporterEdit: true,
  });
  assert.equal(preflightCalls, 2);
  assert.match(request.captures.stdout.text(),
    /Add a test reporter[\s\S]*Will edit: \.github\/workflows\/ci\.yml, tenet\.yaml/);
  assert.match(request.captures.stdout.text(), /Continue\? \[Y\/n\]/);
});

test("init command requires --yes when no terminal is available", async () => {
  const command = makeInitCommand({ terminal: false });
  const outcome = await command.run?.(context()) as { findings: Array<{ code: string }> };
  assert.equal(outcome.findings[0]?.code, "TN-BLESS-NO-TTY");
});

test("init preflight text lists local host keys exactly", async () => {
  const command = makeInitCommand({
    terminal: false,
    preflight: async () => ({
      plan: {
        ...plan,
        local_keys: [{
          host: "vscode",
          path: "C:/Users/fixture/AppData/Roaming/Code/User/mcp.json",
          pointer: "/servers/tenet",
        }],
      },
      findings: [],
      diagnostics: [],
      prompts: [],
      facts: {
        repository: { cwd: ".", git: true, head: "abc", branch: "main", remote: "https://github.com/x/y", forge: "github" as const, empty: false },
        runner: null,
        ci: { jobs: [], selected: null },
        owners: [],
        purpose: null,
        kind: null,
      },
    }),
    init: async () => ({
      plan,
      wrote: { created: [], blocks: [], keys: [], local_keys: [] },
      findings: [],
    }),
  });
  const request = context({ options: { "--yes": true } });
  await command.run?.(request);
  assert.match(request.captures.stdout.text(),
    /Will edit locally \(outside repository\): vscode: C:\/Users\/fixture\/AppData\/Roaming\/Code\/User\/mcp\.json\/servers\/tenet/);
});

test("init command asks before authorizing local host edits", async () => {
  let received: Record<string, unknown> | undefined;
  const candidate = {
    host: "claude",
    path: "C:/Users/fixture/.claude.json",
    pointer: "/mcpServers/tenet",
  };
  const preflight = async (options: Record<string, unknown>) => ({
    plan: {
      ...plan,
      local_keys: (options.answers as { allowLocalHosts?: boolean } | undefined)?.allowLocalHosts
        ? [candidate]
        : [],
    },
    findings: [],
    diagnostics: [],
    prompts: [{
      key: "localHosts" as const,
      question: "Edit local host settings outside the repository?",
      default: false,
      local_keys: [candidate],
    }],
    facts: {
      repository: { cwd: ".", git: true, head: "abc", branch: "main", remote: null, forge: "none" as const, empty: false },
      runner: null,
      ci: { jobs: [], selected: null },
      owners: [],
      purpose: "fixture",
      kind: "service",
    },
  });
  const command = makeInitCommand({
    terminal: true,
    preflight: preflight as never,
    init: async (options) => {
      received = options;
      return {
        plan: { ...plan, local_keys: [] },
        wrote: { created: [], blocks: [], keys: [], local_keys: [] },
        findings: [],
      };
    },
  });
  const request = context({ stdin: Readable.from(["n\n", "\n"]) });
  await command.run?.(request);
  assert.ok(received);
  assert.equal((received.answers as { allowLocalHosts?: boolean }).allowLocalHosts, false);
  assert.equal((received?.localHosts as boolean), false);
  assert.match(request.captures.stdout.text(), /Edit local host settings outside the repository\? \[y\/N\]/);
  assert.match(request.captures.stdout.text(), /No local host settings changed/);
});

test("[AB-B4] [F-12] init explains every Claude Code host write in its plan", async () => {
  const command = makeInitCommand({
    terminal: false,
    preflight: async () => ({
      plan: {
        ...plan,
        created: [
          ".claude/skills/tenet-draft-specs/SKILL.md",
          ...plan.created,
        ],
        blocks: [
          { path: "CLAUDE.md", kind: "markdown" as const },
          ...plan.blocks,
        ],
        keys: [{ path: ".mcp.json", pointer: "/mcpServers/tenet" }],
        hosts: [
          { id: "agents", capability: "skills+mcp" as const },
          { id: "claude", capability: "skills+mcp" as const },
        ],
      },
      findings: [],
      diagnostics: [],
      prompts: [],
      facts: {
        repository: { cwd: ".", git: true, head: "abc", branch: "main", remote: null, forge: "none" as const, empty: false },
        runner: null,
        ci: { jobs: [], selected: null },
        owners: [],
        purpose: "fixture",
        kind: "service",
      },
    }),
    init: async () => ({
      plan,
      wrote: { created: [], blocks: [], keys: [], local_keys: [] },
      findings: [],
    }),
  });
  const request = context({ options: { "--yes": true } });
  await command.run?.(request);
  const output = request.captures.stdout.text();
  assert.match(output, /\.claude\/skills\/tenet-draft-specs\/SKILL\.md — Claude Code skill/);
  assert.match(output, /CLAUDE\.md — points Claude Code to AGENTS\.md/);
  assert.match(output, /\.mcp\.json\/mcpServers\/tenet — registers the Tenet MCP server/);
});

test("[AB-B4] [F-21] init passes repeated --host selections and explains a host-neutral plan", async () => {
  let preflightHosts: unknown;
  let initHosts: unknown;
  const command = makeInitCommand({
    terminal: false,
    preflight: async (options) => {
      preflightHosts = options.hosts;
      return {
        plan,
        findings: [],
        diagnostics: [],
        prompts: [],
        facts: {
          repository: { cwd: ".", git: true, head: "abc", branch: "main", remote: null, forge: "none" as const, empty: false },
          runner: null,
          ci: { jobs: [], selected: null },
          owners: [],
          purpose: "fixture",
          kind: "service",
        },
      };
    },
    init: async (options) => {
      initHosts = options.hosts;
      return {
        plan,
        wrote: { created: [], blocks: [], keys: [], local_keys: [] },
        findings: [],
      };
    },
  });
  const request = context({ options: {
    "--yes": true,
    "--host": ["claude", "vscode"],
  } });
  await command.run?.(request);
  assert.deepEqual(preflightHosts, ["claude", "vscode"]);
  assert.deepEqual(initHosts, ["claude", "vscode"]);
  assert.match(
    request.captures.stdout.text(),
    /No agent host found; skills are in \.agents\/skills\/\. Rerun with `--host claude` to set up Claude Code\./,
  );

  const invalid = await command.run?.(context({
    options: { "--yes": true, "--host": "unknown" },
  })) as { findings: Array<{ code: string }> };
  assert.equal(invalid.findings[0]?.code, "TN-USAGE-INIT");
});

test("init command turns policy failures into canonical findings", async () => {
  const command = makeInitCommand({
    preflight: async () => ({
      plan: null,
      findings: [],
      diagnostics: [{
        code: "TN-ENV-NOT-GIT",
        severity: "error",
        rule: null,
        file: null,
        line: null,
        message: "Directory fixture is not a Git repository.",
        fix: "Run `git init`.",
      }],
      prompts: [],
      facts: {
        repository: { cwd: ".", git: false, head: null, branch: null, remote: null, forge: "none" as const, empty: false },
        runner: null,
        ci: { jobs: [], selected: null },
        owners: [],
        purpose: null,
        kind: null,
      },
    }),
  });
  const outcome = await command.run?.(context({ options: { "--yes": true } })) as {
    findings: Array<{ code: string }>;
  };
  assert.equal(outcome.findings[0]?.code, "TN-ENV-NOT-GIT");
});

test("upgrade, remove and doctor wrappers preserve their public results", async () => {
  const upgradeValue = {
    from: packageVersion,
    to: "0.1.0-alpha.1",
    changed: [{ path: "tenet.lock", action: "replaced" as const }],
  };
  const removeValue = {
    removed: [{ path: "tenet.lock", kind: "file" as const }],
    kept: [{ path: "tenet", reason: "spec-or-records" as const }],
    reminder: "Remove the branch rule.",
  };
  const checks = [
    { name: "node" as const, ok: true, detail: "Node.js 22.15.0" },
  ];
  const upgrade = await makeUpgradeCommand({ upgrade: async () => upgradeValue })
    .run?.(context()) as { result: unknown };
  const remove = await makeRemoveCommand({ remove: async () => removeValue })
    .run?.(context()) as { result: unknown };
  const doctor = await makeDoctorCommand({
    doctor: async () => ({ checks, findings: [], exitCode: 0 }),
  }).run?.(context()) as { result: unknown; exitCode: number };
  assert.deepEqual(upgrade.result, upgradeValue);
  assert.deepEqual(remove.result, removeValue);
  assert.deepEqual(doctor, { result: { checks }, findings: [], exitCode: 0 });
});

test("install result schemas accept the exact public shapes", async () => {
  const ajv = new Ajv2020({ strict: true });
  const examples = {
    init: {
      plan,
      wrote: { created: ["tenet.yaml"], blocks: [], keys: [], local_keys: [] },
      findings: [],
    },
    upgrade: { from: "1.0.0", to: "1.0.1", changed: [] },
    remove: { removed: [], kept: [], reminder: null },
    doctor: { checks: [{ name: "node", ok: true, detail: "Node.js 22.15.0" }] },
  };
  for (const [name, example] of Object.entries(examples)) {
    const schema = JSON.parse(await readFile(`kit/schemas/results/${name}.json`, "utf8"));
    assert.equal(ajv.compile(schema)(example), true, name);
  }
});
