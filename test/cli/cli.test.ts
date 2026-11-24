import assert from "node:assert/strict";
import test from "node:test";
import { registerCommand, run } from "../../dist/cli.js";
import { version } from "../../dist/core/output.js";
import { fakeTty } from "../helpers/fakeTty.ts";

test("version and help use the public CLI entry points", async () => {
  const terminal = fakeTty();
  assert.equal(await run(["--version"], { ...terminal, checkEnvironment: false }), 0);
  assert.equal(terminal.stdout.text.trim(), version);
  const help = fakeTty();
  assert.equal(await run(["--help"], { ...help, checkEnvironment: false }), 0);
  assert.match(help.stdout.text, /Usage: tenet/);
});

test("unknown flags exit with usage code 2", async () => {
  const terminal = fakeTty();
  registerCommand({ name: "flag-test", run: () => ({ value: true }) });
  assert.equal(await run(["flag-test", "--not-a-flag"], { ...terminal, checkEnvironment: false }), 2);
  assert.match(terminal.stderr.text, /Unknown flag/);
});

test("usage validation precedes environment and offline checks", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "usage-first",
    network: true,
    options: ["--token <token>"],
    run: () => ({ value: true }),
  });
  assert.equal(
    await run(["--offline", "usage-first", "--token"], {
      ...terminal,
      nodeVersion: "20.0.0",
      gitVersion: "2.39.0",
    }),
    2,
  );
  assert.match(terminal.stderr.text, /needs a value/);
  assert.doesNotMatch(terminal.stderr.text, /TN-ENV-NODE/);

  const special = fakeTty();
  assert.equal(
    await run(["--version", "--not-global"], {
      ...special,
      nodeVersion: "20.0.0",
      gitVersion: "2.39.0",
    }),
    2,
  );
  assert.match(special.stderr.text, /Unknown flag/);
});

test("option parsing distinguishes boolean and value-taking options", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "option-shapes",
    options: ["-v, --verbose-output", "--name <name>", "--label [label]"],
    run: (context) => ({ value: { args: context.args, options: context.options } }),
  });
  assert.equal(
    await run(["--json", "option-shapes", "--verbose-output", "positional", "--name", "café menu"], {
      ...terminal,
      checkEnvironment: false,
    }),
    0,
  );
  const envelope = JSON.parse(terminal.stdout.text);
  assert.deepEqual(envelope.result.args, ["positional"]);
  assert.equal(envelope.result.options["--verbose-output"], true);
  assert.equal(envelope.result.options["--name"], "café menu");
});

test("required command option values cannot be omitted or empty", async () => {
  registerCommand({
    name: "required-option",
    options: ["--input <path>"],
    run: () => ({ value: true }),
  });
  for (const argument of [["--input"], ["--input="], ["--input", "--other"]]) {
    const terminal = fakeTty();
    assert.equal(
      await run(["required-option", ...argument], { ...terminal, checkEnvironment: false }),
      2,
    );
    assert.match(terminal.stderr.text, /needs a value|Unknown flag/);
  }
});

test("old Node and Git report environment code 3", async () => {
  const node = fakeTty();
  assert.equal(
    await run(["--version"], { ...node, nodeVersion: "20.19.0", gitVersion: "2.56.0" }),
    3,
  );
  assert.match(node.stderr.text, /TN-ENV-NODE/);

  const git = fakeTty();
  assert.equal(
    await run(["--version"], { ...git, nodeVersion: "22.0.0", gitVersion: "git version 2.39.9" }),
    3,
  );
  assert.match(git.stderr.text, /TN-ENV-GIT/);
});

test("offline refuses a self-registered network command before execution", async () => {
  const terminal = fakeTty();
  let called = false;
  registerCommand({ name: "network-test", network: true, run: () => (called = true) });
  assert.equal(
    await run(["--offline", "network-test"], { ...terminal, checkEnvironment: false }),
    3,
  );
  assert.equal(called, false);
});

test("JSON mode reserves stdout for one envelope and sends human output to stderr", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "json-test",
    run: (context) => {
      context.stdout.write("human progress");
      return { value: { completed: true }, findings: [] };
    },
  });
  assert.equal(await run(["--json", "json-test"], { ...terminal, checkEnvironment: false }), 0);
  const envelope = JSON.parse(terminal.stdout.text);
  assert.equal(terminal.stdout.text.trim().split(/\r?\n/).length, 1);
  assert.deepEqual(envelope.result, { completed: true });
  assert.equal(terminal.stderr.text, "human progress");
});

test("exit precedence is usage over environment over policy over gate failures", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "precedence-test",
    run: () => ({
      findings: [
        {
          code: "TN-GATE-CLAIM",
          severity: "error",
          rule: null,
          file: null,
          line: null,
          message: "gate",
          fix: "fix",
        },
        {
          code: "TN-POLICY-RULE",
          severity: "error",
          rule: null,
          file: null,
          line: null,
          message: "policy",
          fix: "fix",
        },
        {
          code: "TN-ENV-GIT",
          severity: "error",
          rule: null,
          file: null,
          line: null,
          message: "environment",
          fix: "fix",
        },
        {
          code: "TN-USAGE-X",
          severity: "error",
          rule: null,
          file: null,
          line: null,
          message: "usage",
          fix: "fix",
        },
      ],
    }),
  });
  assert.equal(await run(["precedence-test"], { ...terminal, checkEnvironment: false }), 2);
});

test("human findings include location, rule, why and fix", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "finding-text",
    run: () => ({
      findings: [
        {
          code: "TN-SCHEMA",
          severity: "error",
          rule: "schema-valid",
          file: "tenet/example.md",
          line: 12,
          message: "missing title",
          fix: "add a title",
        },
      ],
    }),
  });
  assert.equal(await run(["finding-text"], { ...terminal, checkEnvironment: false }), 1);
  assert.match(terminal.stderr.text, /missing title at tenet\/example\.md:12/);
  assert.match(terminal.stderr.text, /why: schema-valid/);
  assert.match(terminal.stderr.text, /→ add a title/);
});

test("unexpected exceptions are complete internal failures, not usage errors", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "internal-test",
    run: () => {
      throw new Error("boom");
    },
  });
  assert.equal(await run(["--json", "internal-test"], { ...terminal, checkEnvironment: false }), 1);
  const envelope = JSON.parse(terminal.stdout.text);
  assert.equal(envelope.result, null);
  assert.deepEqual(envelope.errors, [
    {
      code: "TN-INTERNAL",
      severity: "error",
      rule: null,
      file: null,
      line: null,
      message: "Internal failure: boom.",
      fix: "Report this defect with the command and error details.",
    },
  ]);
});

test("objects resembling findings need the complete finding shape", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "incomplete-finding",
    run: () => {
      throw { code: "TN-USAGE-BAD", message: "not complete" };
    },
  });
  assert.equal(await run(["incomplete-finding"], { ...terminal, checkEnvironment: false }), 1);
  assert.match(terminal.stderr.text, /TN-INTERNAL/);
  assert.doesNotMatch(terminal.stderr.text, /TN-USAGE-BAD/);
});

test("non-error findings thrown as exceptions are internal failures", async () => {
  const terminal = fakeTty();
  registerCommand({
    name: "thrown-warning",
    run: () => {
      throw {
        code: "TN-WARNING",
        severity: "warning",
        rule: null,
        file: null,
        line: null,
        message: "not fatal",
        fix: "continue",
      };
    },
  });
  assert.equal(await run(["thrown-warning"], { ...terminal, checkEnvironment: false }), 1);
  assert.match(terminal.stderr.text, /TN-INTERNAL/);
});
