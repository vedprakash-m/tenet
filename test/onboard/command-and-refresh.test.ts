import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { Ajv2020 } from "ajv/dist/2020.js";
import { run } from "../../dist/cli.js";
import {
  interviewQuestions,
  onboard,
} from "../../dist/onboard/assignment.js";
import type { OnboardDeps } from "../../dist/onboard/refresh.js";
import { tmpRepo } from "../helpers/tmpRepo.ts";

const clean = { findings: [], summary: { errors: 0, warnings: 0, advises: 0 } };
const config = `standard: 0.1.0-alpha.0
level: observe
specs:
  documents:
    - path: intent.md
      level: L1
`;

test("refresh assigns only a changed unit and preserves drafts byte for byte", async (t) => {
  const repo = await tmpRepo("refresh");
  t.after(repo.cleanup);
  await repo.write("api/service.ts", "const api = 1;\n".repeat(2100));
  await repo.write("cli/main.ts", "const cli = 1;\n".repeat(2100));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "sources"]);
  const source = repo.git(["rev-parse", "HEAD"]).trim();
  const draft = (ref: string) => `---
tenet:
  drafted_at_rev: ${ref}
sections:
  billing:
    state: blessed
  retries:
    state: rejected
---
# Requirements
R-18 A human edit stays.
`;
  await repo.write("tenet/intent.md", draft(source));
  await repo.write("tenet.yaml", config);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "first draft"]);
  const draftedAt = repo.git(["rev-parse", "HEAD"]).trim();
  await repo.write("tenet/intent.md", draft(draftedAt));
  repo.git(["add", "tenet/intent.md"]);
  repo.git(["commit", "-qm", "record draft anchor"]);
  const calls: string[] = [];
  const deps: OnboardDeps = { check: async (options) => {
    calls.push(options?.cwd ?? "");
    return clean;
  } };
  const options = { cwd: repo.path, refresh: true, layout: "separate" } as const;
  const unchanged = await onboard(options, deps);
  assert.deepEqual(unchanged.assignment.units, []);

  await repo.write("api/service.ts", "const api = 2;\n".repeat(2100));
  repo.git(["add", "api/service.ts"]);
  repo.git(["commit", "-qm", "change API"]);
  const changed = await onboard(options, deps);
  assert.deepEqual(changed.inventory.units.map(({ id }) => id), ["api", "cli"]);
  assert.deepEqual(changed.assignment.units.map(({ id }) => id), ["api"]);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((entry) => path.resolve(entry)), [repo.path, repo.path]);
  assert.equal(await readFile(path.join(repo.path, "tenet/intent.md"), "utf8"), draft(draftedAt));
});

test("onboard with an empty commit writes repeatable outputs and reads working policy", async (t) => {
  const repo = await tmpRepo("empty");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "empty"]);
  const initial = await onboard({ cwd: repo.path, inventoryOnly: true });
  assert.equal(initial.inventory.size.source_lines, 0);
  assert.equal(initial.preflight.dirty_warning, false);
  const second = await onboard({ cwd: repo.path });
  assert.deepEqual(second, initial);

  await repo.write("src/service.ts", "export const ready = true;\n");
  repo.git(["add", "src/service.ts"]);
  repo.git(["commit", "-qm", "add source"]);
  await repo.write("tenet.yaml", `${config}onboard:\n  exclude: [src/**]\n`);
  const result = await onboard({ cwd: repo.path });
  assert.deepEqual(result.inventory.sources, { files: [], skipped: [{ path: "src/service.ts", reason: "excluded" }] });
  assert.equal(result.preflight.dirty_warning, true);
});

test("onboard recognizes Python and Go modules and scans their real tests", async (t) => {
  const repo = await tmpRepo("languages");
  t.after(repo.cleanup);
  const files = {
    "python/pyproject.toml": "[project]\nname = 'tools'\nversion = '1.0.0'\n",
    "python/tool.py": "def add(a, b):\n    return a + b\n",
    "python/tests/test_tool.py": "def test_add():\n    assert True\n",
    "go/go.mod": "module example.test/tool\n",
    "go/cmd/tool/main.go": "package main\nfunc main() {}\n",
    "go/cmd/tool/main_test.go": "package main\nfunc TestTool(t *testing.T) { t.Skip(\"pending\") }\n",
  };
  for (const [file, content] of Object.entries(files)) await repo.write(file, content);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "languages"]);
  const result = await onboard({ cwd: repo.path });
  assert.equal(result.assignment.project_kind, "cli");
  assert.deepEqual(result.inventory.modules, [
    { id: "go", roots: ["go"], languages: ["go"] },
    { id: "python", roots: ["python"], languages: ["python"] },
  ]);
  assert.deepEqual(result.inventory.tests.map(({ runner, cases }) => [runner, cases]), [["go", 1], ["pytest", 1]]);
  assert.ok(result.findings.some(({ kind }) => kind === "skipped-tests"));
});

test("[AC-E4] [F-16] documentation tokens select separate layout and [AC-E5] [F-18] keeps a docs unit", async (t) => {
  const repo = await tmpRepo("docs-heavy-layout");
  t.after(repo.cleanup);
  await repo.write("src/app.ts", "export const app = true;\n");
  await repo.write("lib/shared.ts", "export const shared = true;\n");
  await repo.write("docs/guide.md", "# Guide\n\n" + "documentation ".repeat(3_700));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "docs-heavy"]);

  const result = await onboard({ cwd: repo.path, inventoryOnly: true });
  assert.equal(result.inventory.layout, "separate");
  assert.ok(result.inventory.size.documentation_tokens >= 12_000);
  assert.ok(result.inventory.units.some(({ id, paths }) =>
    id === "docs" && paths.includes("docs")));

  const human = await cli(["onboard", "--inventory-only"], repo.path);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /Layout: separate \(because documentation reached 12,000 estimated tokens\)/);
  assert.match(human.stdout, /^Units:$/m);
  assert.match(human.stdout, /^- docs: docs$/m);

  const override = await cli(["onboard", "--inventory-only", "--layout", "one-file"], repo.path);
  assert.equal(override.code, 0, override.stderr);
  assert.match(override.stdout, /Layout: one-file \(because --layout one-file was requested\)/);
});

test("[AC-E4] [F-16] Tenet specification outputs do not count as project documentation", async (t) => {
  const repo = await tmpRepo("onboard-own-specs");
  t.after(repo.cleanup);
  await repo.write("src/app.ts", "export const app = true;\n");
  await repo.write("tenet/intent.md", "x".repeat(50_000));
  await repo.write("tenet/vision.md", "x".repeat(50_000));
  await repo.write(
    "tenet/blessed/tenet__vision.md/vision.md",
    "x".repeat(50_000),
  );
  await repo.write(
    "tenet/packets/CP-TEST/definition.md",
    "x".repeat(50_000),
  );
  await repo.write(
    "tenet/ledger/L-9999-record.md",
    "x".repeat(50_000),
  );
  await repo.write("tenet.yaml", `standard: 0.1.0-alpha.0
level: observe
paths:
  records: tenet
specs:
  documents:
    - {path: vision.md, level: L0}
`);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "large Tenet specs"]);

  const result = await onboard({ cwd: repo.path, inventoryOnly: true });
  assert.equal(result.inventory.size.documentation_tokens, 0);
  assert.equal(result.inventory.layout, "one-file");
});

test("[AC-E5] [F-18] the docs unit keeps root files by path instead of using the repository root", async (t) => {
  const repo = await tmpRepo("onboard-root-doc");
  t.after(repo.cleanup);
  await repo.write("src/app.ts", "export const app = true;\n");
  await repo.write("README.md", "Project documentation\n".repeat(3_000));
  await repo.write("docs/guide.md", "Nested documentation\n".repeat(3_000));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "root and nested docs"]);

  const result = await onboard({ cwd: repo.path });
  const docs = result.inventory.units.find(({ id }) => id === "docs");
  assert.deepEqual(docs?.paths, ["README.md", "docs"]);
  assert.equal(docs?.paths.includes("."), false);
});

test("[AC-D2] [R2-12] assignments carry kind and generic interview question sets", async (t) => {
  const repo = await tmpRepo("onboard-questions");
  t.after(repo.cleanup);
  await repo.write("index.html", "<main>Application</main>\n");
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "application"]);

  const result = await onboard({ cwd: repo.path });
  assert.equal(result.assignment.project_kind, "application");
  assert.deepEqual(
    result.assignment.questions,
    interviewQuestions("application"),
  );
  for (const kind of [
    "cli",
    "service",
    "library",
    "data",
    "infrastructure",
    "application",
  ]) {
    const questions = interviewQuestions(kind);
    assert.ok(questions.project_kind.length > 0);
    assert.ok(questions.project_kind.length <= 10);
    assert.ok(questions.generic.length > 0);
    assert.ok(questions.generic.length <= 10);
  }
  assert.deepEqual(interviewQuestions("unknown"), {
    project_kind: [],
    generic: interviewQuestions("application").generic,
  });
});

async function cli(args: string[], cwd: string) {
  let stdout = "";
  let stderr = "";
  const code = await run(args, {
    cwd, checkEnvironment: false,
    stdout: { write: (piece) => { stdout += piece; } },
    stderr: { write: (piece) => { stderr += piece; } },
  });
  return { code, stdout, stderr };
}

test("onboard uses the public CLI, emits a schema-valid result, and declares no card flag", async (t) => {
  const repo = await tmpRepo("onboard-cli");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "empty"]);
  const success = await cli(["onboard", "--json", "--inventory-only", "--layout", "separate", "--offline"], repo.path);
  assert.equal(success.code, 0, success.stderr);
  const envelope = JSON.parse(success.stdout);
  assert.equal(envelope.command, "onboard");
  assert.equal(envelope.result.assignment.layout, "separate");
  const ajv = new Ajv2020({ strict: true });
  for (const filename of ["inventory.json", "assignment.json", "results/onboard.json"]) {
    ajv.addSchema(JSON.parse(await readFile(new URL(`../../kit/schemas/${filename}`, import.meta.url), "utf8")));
  }
  const conforms = ajv.getSchema("https://vedprakash-m.github.io/tenet/schemas/0.1/results/onboard.json");
  assert.ok(conforms);
  assert.equal(conforms(envelope.result), true, JSON.stringify(conforms.errors));
  const human = await cli(["onboard", "--inventory-only"], repo.path);
  assert.match(human.stdout, /Drafting sends project content/);
  assert.match(human.stdout, /First findings: 1 total \(no-test-report 1\)/);
  assert.match(human.stdout, /- No machine-readable test report configured/);
  assert.match(human.stdout, /Use the `tenet-draft-specs` skill/);
  assert.equal((await cli(["onboard", "--card"], repo.path)).code, 2);
  assert.equal((await cli(["onboard", "--layout", "invalid"], repo.path)).code, 2);
});

test("[AB-D6] [F-14] onboard findings are capped and skipped paths are counted by reason", async (t) => {
  const repo = await tmpRepo("onboard-findings-limit");
  t.after(repo.cleanup);
  await repo.write("tenet.yaml", `${config}onboard:\n  exclude: ["private/**"]\n`);
  for (let index = 0; index < 6; index += 1) {
    await repo.write(`docs/page-${index}.md`, `# Page ${index}\n\nSee [missing](missing-${index}.md).\n`);
  }
  for (let index = 0; index < 11; index += 1) {
    await repo.write(`private/file-${index}.txt`, `${index}\n`);
  }
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "findings"]);
  const human = await cli(["onboard", "--inventory-only"], repo.path);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /First findings: 7 total \(dead-path 6 · no-test-report 1\)/);
  const displayed = [...human.stdout.matchAll(/^- docs\/page-/gm)].length;
  assert.equal(displayed, 5);
  assert.match(human.stdout, /- 2 more findings; see \.tenet\/onboard\/inventory\.json/);
  assert.match(human.stdout, /Skipped files: excluded 11 \(/);
});

test("[AC-D3] [R2-08] onboard skips archive folders and shows the negated opt-in pattern", async (t) => {
  const repo = await tmpRepo("onboard-archive-hint");
  t.after(repo.cleanup);
  await repo.write("tenet.yaml", config);
  await repo.write("archive/root.ts", "export const root = true;\n");
  await repo.write("src/.archive/nested.ts", "export const nested = true;\n");
  await repo.write("legacy/old/retired.ts", "export const retired = true;\n");
  await repo.write("src/live.ts", "export const live = true;\n");
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "archive"]);
  const human = await cli(["onboard", "--inventory-only"], repo.path);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /Skipped files: archive 3/);
  assert.ok(human.stdout.includes(
    "add `!**/{.archive,archive,old}/**` to `onboard.exclude`",
  ));
  assert.doesNotMatch(human.stdout, /inventoried files are under/);
  const result = JSON.parse((await cli(["onboard", "--json", "--inventory-only"], repo.path)).stdout);
  assert.deepEqual(result.result.inventory.sources.skipped, [
    { path: "archive/root.ts", reason: "archive" },
    { path: "legacy/old/retired.ts", reason: "archive" },
    { path: "src/.archive/nested.ts", reason: "archive" },
  ]);

  await repo.write(
    "tenet.yaml",
    `${config}onboard:\n  exclude: ["!**/{.archive,archive,old}/**"]\n`,
  );
  const included = await onboard({ cwd: repo.path });
  assert.deepEqual(
    included.inventory.sources.skipped.filter(({ reason }) => reason === "archive"),
    [],
  );
  assert.ok(included.inventory.sources.files.some(({ path }) => path === "archive/root.ts"));
  assert.ok(included.inventory.sources.files.some(({ path }) => path === "src/.archive/nested.ts"));
  assert.ok(included.inventory.sources.files.some(({ path }) => path === "legacy/old/retired.ts"));
});

test("onboard refuses directories outside Git and repositories with no HEAD", async (t) => {
  const nonGit = await mkdtemp(path.join(os.tmpdir(), "tenet-onboard-"));
  t.after(() => rm(nonGit, { recursive: true, force: true }));
  const repo = await tmpRepo("unborn");
  t.after(repo.cleanup);
  for (const [cwd, code] of [[nonGit, "TN-ENV-NOT-GIT"], [repo.path, "TN-ENV-NO-COMMIT"]] as const) {
    const result = await cli(["onboard", "--json"], cwd);
    assert.equal(result.code, 3);
    assert.equal(JSON.parse(result.stdout).errors[0].code, code);
  }
});

test("generated and binary classifications precede oversize without reading excluded test declarations", async (t) => {
  const repo = await tmpRepo("skip-precedence");
  t.after(repo.cleanup);
  await repo.write("large.ts", `${"x".repeat(1_100_000)} @generated\n`);
  await repo.write("binary.ts", `\0${"x".repeat(1_100_000)}`);
  await repo.write("secret.test.ts", 'test.skip("secret", () => {});\n');
  await repo.write("large.txt", "x".repeat(1_100_000));
  repo.git(["add", "-A", "-f"]);
  repo.git(["commit", "-qm", "mixed paths"]);
  const result = await onboard({ cwd: repo.path });
  assert.deepEqual(result.inventory.sources.skipped, [
    { path: "binary.ts", reason: "binary" },
    { path: "large.ts", reason: "generated" },
    { path: "large.txt", reason: "oversize" },
    { path: "secret.test.ts", reason: "credentials" },
  ]);
  assert.deepEqual(result.inventory.tests, []);
  assert.equal(result.findings.some(({ kind }) => kind === "skipped-tests"), false);
});

test("[AC-B3] [R2-09] first findings count missing paths without counting symbols or URLs", async (t) => {
  const repo = await tmpRepo("path-shaped-findings");
  t.after(repo.cleanup);
  await repo.write("tenet.yaml", config);
  await repo.write("docs/queue.md", [
    "# Queue",
    "`@Name.member`, `Name.member`, `module.func()`, `EventName`, and `https://example.invalid/queue`.",
    "See [web](https://example.invalid/queue), [missing](missing.md), and `src/missing.ts:7`.",
    "",
  ].join("\n"));
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "docs"]);
  const result = await onboard({ cwd: repo.path, inventoryOnly: true });
  assert.deepEqual(result.findings.filter(({ kind }) => kind === "dead-path").map(({ message }) => message), [
    "docs/queue.md links missing path missing.md",
    "docs/queue.md links missing path src/missing.ts",
  ]);
  const human = await cli(["onboard", "--inventory-only"], repo.path);
  assert.equal(human.code, 0, human.stderr);
  assert.match(human.stdout, /First findings: 3 total \(dead-path 2 · no-test-report 1\)/);
});
