import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);
const harness = fileURLToPath(new URL("../../../pkg/evals/onboarding/run.mjs", import.meta.url));

async function run(...args: string[]) {
  const isolatedHome = process.env.TENET_TEST_HOME;
  const { stdout } = await execute(process.execPath, [harness, ...args], {
    encoding: "utf8",
    timeout: 120_000,
    env: {
      ...process.env,
      ...(isolatedHome ? {
        HOME: isolatedHome,
        USERPROFILE: isolatedHome,
        APPDATA: path.join(isolatedHome, "AppData", "Roaming"),
      } : {}),
      TENET_INSTALL_INTEGRITY: `sha512-${"A".repeat(86)}==`,
    },
  });
  return stdout;
}

test("replay evaluates a materialized fixture and leaves semantic scores for people", async (t) => {
  const out = await mkdtemp(path.join(os.tmpdir(), "tenet-eval-report-test-"));
  const home = await mkdtemp(path.join(os.tmpdir(), "tenet-eval-home-"));
  const previous = process.env.TENET_TEST_HOME;
  process.env.TENET_TEST_HOME = home;
  t.after(() => {
    if (previous === undefined) delete process.env.TENET_TEST_HOME;
    else process.env.TENET_TEST_HOME = previous;
    return Promise.all([
      rm(out, { recursive: true, force: true }),
      rm(home, { recursive: true, force: true }),
    ]).then(() => undefined);
  });
  const result = JSON.parse(await run("--agent", "replay", "--fixture", "node-service", "--out", out));
  t.after(() => rm(result.scratch, { recursive: true, force: true }));
  assert.equal(result.automatic, 1);
  assert.equal(result.fixtures, 1);
  assert.equal(result.scoredKept, 0);

  const manifest = JSON.parse(await readFile(path.join(result.scratch, "run.json"), "utf8"));
  const row = manifest.cases[0];
  assert.equal(row.name, "node-service");
  assert.equal(row.evidence.citationFailures, 0);
  assert.equal(row.evidence.grounded, 1);
  assert.equal(row.evidence.asked, 1);
  assert.equal(row.evidence.planted.filter(({ reported }) => reported).length, 4);
  assert.equal(row.evidence.obligations.length, 7);
  assert.deepEqual(row.measures, { drafted: null, kept: null, ratio: null, deferred: 0, minutes: null });

  const report = await readFile(result.report, "utf8");
  assert.match(report, /\| 4\/4 \| 1\/1 \| 0 \| unavailable \| unavailable \| {2}\| {2}\|/);
  const selected = report.split("\n").filter((line) => line.startsWith("| tenet/") && line.includes("| sample |"));
  assert.equal(selected.length, Math.ceil(row.evidence.rows.length / 5));
  assert.match(report, /\| OB-1 \| [^|]*\| sample \| {2}\| {2}\|/);
  await assert.rejects(readFile(path.join(result.scratch, "node-service", "key.json")), { code: "ENOENT" });
  const draft = await readFile(path.join(result.scratch, "node-service", "tenet", "intent.md"), "utf8");
  assert.ok(draft.includes(row.draftRevision));
  assert.equal(await readFile(path.join(home, ".claude.json"), "utf8").then(() => true, () => false), false);
  assert.match(await readFile(path.join(result.scratch, "node-service-card.md"), "utf8"), /Tenet onboarding/);

  // Scoring after a human session reads the action log. This test supplies
  // known rows in the disposable fixture to verify the aggregation.
  const blessed = path.join(result.scratch, "node-service", "tenet", "blessed");
  const make = (section: string, action: string, minutes: number, drafted: number, kept: number) => ({
    doc: "tenet/intent.md", section, action, minutes,
    by: "owner", at: `2026-11-24T12:0${minutes}:00Z`, session_id: "test-session",
    statements: { drafted, kept, edited: drafted - kept, adopted: 0, added: 0 },
  });
  const log = [
    make("requirements", "bless", 1, 5, 4), make("vision", "reject", 2, 1, 1), make("design", "defer", 3, 2, 2),
  ];
  await mkdir(blessed);
  await writeFile(path.join(blessed, "log.jsonl"), `${log.map((line) => JSON.stringify(line)).join("\n")}\n`);
  const rescored = JSON.parse(await run("--rescore", result.scratch, "--out", path.join(out, "rescored")));
  assert.equal(rescored.scoredKept, 1);
  const scored = await readFile(rescored.report, "utf8");
  assert.match(scored, /Scored log counts 4\/6\. Deferred sections 1\./);
  assert.match(scored, /\| 66\.7% \| 3 \|/);
  assert.deepEqual(scored.split("\n").filter((line) => line.startsWith("| tenet/") && line.includes("| sample |")), selected);
});

test("fresh-session mode prints how to gather and check independent evidence", async () => {
  const plan = await run("--fresh-session");
  assert.match(plan, /tenet bless --doc intent\.md --section requirements/);
  assert.match(plan, /--drift-ref <git-ref> --transcript <rpc\.jsonl> --response <agent\.txt>/);
  assert.match(plan, /sources-changed.*restores one retry.*unchanged blessed copies/);
});

test("fresh-session verification checks retry behavior, MCP evidence, and blessed-copy changes", async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-fresh-test-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const cwd = path.join(scratch, "repo");
  const retry = path.join(cwd, "src", "payments", "retry.js");
  const blessed = path.join(cwd, "tenet", "blessed", "requirements.md");
  await mkdir(path.dirname(retry), { recursive: true });
  await mkdir(path.dirname(blessed), { recursive: true });
  const drift = `export async function sendWithRetry(fn) {
    for (let turn = 0;; turn++) {
      try { return await fn(); }
      catch (error) { if (error.code !== "ETIMEDOUT" || turn === 2) throw error; }
    }
  }`;
  await writeFile(retry, drift);
  await writeFile(path.join(cwd, "package.json"), '{"type":"module"}\n');
  await writeFile(blessed, "Retry once.\n");
  const git = (...args: string[]) => execute("git", ["-c", "core.autocrlf=false", "-c", "core.safecrlf=false", "-c", "core.fsmonitor=false",
    "-c", "user.name=Eval test", "-c", "user.email=eval@example.invalid", ...args], { cwd });
  await git("init", "-q");
  await git("add", ".");
  await git("commit", "-qm", "Retry drift");
  const transcript = path.join(scratch, "mcp.jsonl");
  await writeFile(transcript, [
    { jsonrpc: "2.0", id: 8, method: "tools/call", params: { name: "tenet_context" } },
    { jsonrpc: "2.0", id: 8, result: { structuredContent: { blessed: [{ text: "Retry once.", flags: ["sources-changed"] }] } } },
  ].map((value) => JSON.stringify(value)).join("\n"));
  const response = path.join(scratch, "agent.txt");
  await writeFile(response, "Fixed the retry drift. The blessed spec still requires one retry.");
  await writeFile(retry, drift.replace("turn === 2", "turn === 1"));

  const args = ["--fresh-session", "--worktree", cwd, "--drift-ref", "HEAD", "--transcript", transcript, "--response", response];
  const outcome = JSON.parse(await run(...args));
  assert.equal(outcome.passed, true);
  assert.deepEqual(outcome.checks, {
    retrievedBlessedContext: true, restoredSingleRetry: true, reportedDrift: true, unchangedBlessing: true,
  });

  await writeFile(blessed, "Retry twice.\n");
  await assert.rejects(run(...args), (error: unknown) => {
    assert.ok(error && typeof error === "object" && "code" in error && "stdout" in error);
    assert.equal(error.code, 1);
    assert.equal(JSON.parse(String(error.stdout)).checks.unchangedBlessing, false);
    return true;
  });
});

test("every evaluation subprocess resolves home and temp inside scratch and init failures bypass scoring", async (t) => {
  const { main, execute: launch } = await import("../../../pkg/evals/onboarding/run.mjs");
  const out = await mkdtemp(path.join(os.tmpdir(), "tenet-eval-isolation-test-"));
  t.after(() => rm(out, { recursive: true, force: true }));
  const observed = new Set<string>();
  const probe = `
    const { ok, notEqual } = require("node:assert/strict");
    const { existsSync, writeFileSync } = require("node:fs");
    const os = require("node:os");
    const path = require("node:path");
    const roots = ["HOME", "USERPROFILE", "APPDATA", "XDG_CONFIG_HOME", "TMPDIR"];
    const scratch = path.dirname(process.env.HOME);
    ok(path.basename(scratch).startsWith("tenet-onboarding-"));
    for (const name of roots) {
      const value = process.env[name];
      const relative = path.relative(scratch, value);
      ok(relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative), name);
      ok(existsSync(value), name);
      notEqual(value, process.argv[1], name);
    }
    notEqual(os.homedir(), process.argv[1]);
    notEqual(os.tmpdir(), process.argv[2]);
    ok(path.relative(process.env.HOME, os.homedir()) === "");
    ok(path.relative(process.env.TMPDIR, os.tmpdir()) === "");
    if (process.argv[3] === "init") writeFileSync(path.join(os.homedir(), ".claude.json"), "{}");
  `;
  const args = ["--agent", "replay", "--fixture", "node-service", "--out", out];
  const exercise = (failInit: boolean) => main(args, async (command: string, argv: string[], cwd: string, options: {
    env: NodeJS.ProcessEnv; input?: string; timeout?: number;
  }) => {
    const kind = path.basename(argv[0] ?? "") === "cli.js" ? (argv.includes("--card") ? "card" : argv[1]) :
      path.basename(argv[0] ?? "") === "replay.mjs" ? "agent" : "other";
    const result = await launch(process.execPath, ["-e", probe, os.homedir(), os.tmpdir(), kind], cwd, { env: options.env });
    assert.equal(result.exit, 0, result.stderr);
    observed.add(kind);
    if (failInit && kind === "init") {
      return launch(process.execPath, ["-e",
        'console.log(JSON.stringify({errors:[{code:"TN-PATH-ESCAPE",severity:"error"}]})); process.exitCode=4;'],
        cwd, { env: options.env });
    }
    return launch(command, argv, cwd, options);
  });

  const good = await exercise(false);
  t.after(() => rm(good.scratch, { recursive: true, force: true }));
  assert.equal(good.automatic, 1);
  assert.deepEqual([...observed].sort(), ["agent", "card", "check", "init", "onboard", "other"]);
  assert.equal(await readFile(path.join(good.scratch, "home", ".claude.json"), "utf8"), "{}");

  observed.clear();
  const failed = await exercise(true);
  t.after(() => rm(failed.scratch, { recursive: true, force: true }));
  assert.equal(failed.automatic, 0);
  assert.deepEqual([...observed].sort(), ["init", "other"]);
  const manifest = JSON.parse(await readFile(path.join(failed.scratch, "run.json"), "utf8"));
  assert.deepEqual(manifest.cases[0].initFailure, { code: "TN-PATH-ESCAPE", exit: 4 });
  assert.equal(manifest.cases[0].evidence, undefined);
  const report = await readFile(failed.report, "utf8");
  assert.match(report, /## Init failures[\s\S]*\| node-service \| [^|]+ \| init failed \| TN-PATH-ESCAPE \| 4 \|/);
  assert.doesNotMatch(report, /Execution failure/);
});
