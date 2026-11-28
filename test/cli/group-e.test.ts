import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PassThrough, Readable } from "node:stream";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { run } from "../../dist/cli.js";
import { makeInitCommand } from "../../dist/commands/init.js";
import { init } from "../../dist/install/init.js";
import { preflightInitIntegrity } from "../../dist/install/preflight.js";
import { fakeTty } from "../helpers/fakeTty.ts";
import { tmpRepo } from "../helpers/tmpRepo.ts";

test("[AC-E1] [F-06] init offers local integrity before confirmation when npm times out", async (t) => {
  const repo = await tmpRepo("group-e-init");
  t.after(repo.cleanup);
  // npm scripts can export a registry. The injected npm command owns this fixture.
  const registryVariables = ["npm_config_registry", "NPM_CONFIG_REGISTRY"] as const;
  const priorRegistry = registryVariables.map((key) => [key, process.env[key]] as const);
  for (const key of registryVariables) delete process.env[key];
  t.after(() => {
    for (const [key, value] of priorRegistry) {
      if (value !== undefined) process.env[key] = value;
    }
  });
  const calls: string[] = [];
  const command = makeInitCommand({
    integrity: (options) => preflightInitIntegrity(options, {
      npmView: async (args, { cwd }) => {
        calls.push(args[0]!);
        if (args[0] === "config") {
          assert.equal(cwd, repo.path);
          return { status: 0, stdout: "https://npm.example.invalid/\n", stderr: "" };
        }
        assert.ok(args.includes("--registry=https://registry.npmjs.org/"));
        assert.notEqual(cwd, repo.path);
        return { status: 1, stdout: "Synthetic npm stdout", stderr: "npm error ETIMEDOUT\nSynthetic verbose detail" };
      },
    }),
  });
  const lockPath = path.join(repo.path, "tenet.lock");
  for (const [fallback, verbose] of [["n", true], ["y", false]] as const) {
    const io = fakeTty();
    const stdin = Object.assign(new PassThrough(), { isTTY: true });
    const write = io.stdout.write.bind(io.stdout);
    io.stdout.write = (value) => {
      const recorded = write(value);
      const text = String(value);
      if (text.startsWith("Record local")) stdin.write(fallback + "\n");
      else if (text.startsWith("Continue?")) stdin.write("y\n");
      else if (text.endsWith(" ")) stdin.write("\n");
      return recorded;
    };
    t.after(() => { stdin.destroy(); });
    const outcome = await command.run?.({
      ...io, stdin, cwd: repo.path, args: [], options: {}, now: () => new Date(),
      verbose, offline: false, json: false, quiet: false,
    });
    assert.deepEqual(outcome, { result: null, findings: [] });
    assert.match(io.stdout.text, /Tenet checks the public npm registry for the published package integrity that CI verifies/);
    assert.match(io.stdout.text, /the npm request timed out\.\n/);
    assert.equal(io.stdout.text.includes("Synthetic verbose detail"), verbose);
    assert.equal(io.stdout.text.includes("Synthetic npm stdout"), verbose);
    const prompt = io.stdout.text.indexOf("Record local package integrity instead");
    assert.ok(prompt > io.stdout.text.indexOf("the npm request timed out"));
    if (fallback === "n") {
      assert.doesNotMatch(io.stdout.text, /Continue\?/);
      await assert.rejects(readFile(lockPath), { code: "ENOENT" });
    } else {
      assert.ok(io.stdout.text.indexOf("Continue?") > prompt);
      const lock = JSON.parse(await readFile(lockPath, "utf8"));
      assert.equal(lock["x-integrity-source"], "local");
    }
  }
  assert.deepEqual(calls, ["config", "view", "config", "view"]);
});

test("[AC-E1] [F-06] init --yes resumes a confirmed plan without another registry check", async (t) => {
  const repo = await tmpRepo("group-e-init-resume");
  t.after(repo.cleanup);
  await assert.rejects(init({ cwd: repo.path, yes: true, offline: true, fault: { after: "pending" } }), {
    code: "INSTALL_INTERRUPTED",
  });
  const io = fakeTty();
  const command = makeInitCommand({ integrity: async () => assert.fail("the pending plan already pins integrity") });
  const outcome = await command.run?.({
    ...io, cwd: repo.path, args: [], options: { "--yes": true }, now: () => new Date(),
    verbose: false, offline: false, json: false, quiet: false,
  });
  assert.deepEqual(outcome, { result: null, findings: [] });
  const lock = JSON.parse(await readFile(path.join(repo.path, "tenet.lock"), "utf8"));
  assert.equal(lock["x-integrity-source"], "local");
});

test("[AC-E2] [F-57] remove previews ownership and waits for consent", async (t) => {
  const repo = await tmpRepo("group-e-remove");
  t.after(repo.cleanup);
  const config = { cwd: repo.path, checkEnvironment: false };
  await repo.write("AGENTS.md", "# Existing project rules\n");
  const init = fakeTty();
  assert.equal(await run(["init", "--offline", "--yes"], { ...config, ...init }), 0, init.stderr.text);
  await repo.write(".tenet/onboard/interview.json", "{}\n");
  const lockPath = path.join(repo.path, "tenet.lock");
  const lock = await readFile(lockPath, "utf8");
  const piped = fakeTty();
  piped.stdin = Readable.from([]);
  assert.equal(await run(["remove", "--json"], { ...config, ...piped }), 2);
  const envelope = JSON.parse(piped.stdout.text);
  assert.equal(envelope.errors[0].code, "TN-REMOVE-NO-TTY");
  assert.match(envelope.errors[0].message, /tenet remove/);
  assert.equal(await readFile(lockPath, "utf8"), lock);

  const decline = fakeTty("\n");
  assert.equal(await run(["remove"], { ...config, ...decline }), 0, decline.stderr.text);
  assert.match(decline.stdout.text, /Will delete:[\s\S]*AGENTS\.md — remove the Tenet block/);
  assert.match(decline.stdout.text, /tenet\.lock — delete \(Tenet created it\)/);
  assert.match(decline.stdout.text, /Will keep:[\s\S]*interview\.json — Owner interview answers[\s\S]*Continue\? \[y\/N\]/);
  assert.equal(await readFile(lockPath, "utf8"), lock);

  const accept = fakeTty();
  accept.stdin = Readable.from([]);
  assert.equal(await run(["remove", "--yes"], { ...config, ...accept }), 0, accept.stderr.text);
  assert.match(accept.stdout.text, /Kept: .+interview\.json — Owner interview answers/);
  assert.doesNotMatch(accept.stdout.text, /Continue\?/);
  await assert.rejects(readFile(lockPath), { code: "ENOENT" });
  assert.equal(await readFile(path.join(repo.path, "AGENTS.md"), "utf8"), "# Existing project rules\n");
});

test("[AC-E3] [F-05] help and version load no command modules", () => {
  const entry = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
  const loader = "export async function load(url, context, next) {" +
    "if (url.includes('/dist/commands/')) throw Error('Command loaded: ' + url);" +
    "return next(url, context) }";
  const bootstrap = "import { register } from 'node:module'; register(" +
    JSON.stringify("data:text/javascript," + encodeURIComponent(loader)) + ");";
  const call = (...args: string[]) => execFileSync(process.execPath, [
    "--import", "data:text/javascript," + encodeURIComponent(bootstrap), entry, ...args,
  ], { encoding: "utf8" });
  assert.match(call("--version"), /^\d+\.\d+\.\d+/);
  assert.match(call("fix", "--help"), /Usage: tenet fix \[--dry-run\] \[--diff\]/);
  const descriptions = call("--help").split("Commands:\n")[1]?.trimEnd().split("\n") ?? [];
  assert.ok(descriptions.length > 10);
  for (const line of descriptions) assert.match(line, /^\s{2}\S+ +[A-Z].*[^.]$/);
});

test("[AC-E10] [F-27] fix previews the repairs and preserves flow and block front matter", async (t) => {
  const repo = await tmpRepo("group-e-fix");
  t.after(repo.cleanup);
  const call = async (...args: string[]) => {
    const io = fakeTty();
    assert.equal(await run(args, { ...io, cwd: repo.path, checkEnvironment: false }), 0, io.stderr.text);
    return io.stdout.text;
  };
  await call("init", "--offline", "--yes");
  const relative = "tenet/intent.md";
  const file = path.join(repo.path, relative);
  const body = "\n# Intent\n\n## Requirements\n\n- Track a widget. {origin: asked; cites: []; serves: []}\n";
  const flow = "tenet: {spec: 1, doc: intent, level: L1, version: 'draft', owner: owner} # Keep this style";
  const block = "tenet:\n    spec: 1\n    doc: intent\n    level: L1\n    version: 'draft'\n    owner:  owner   # Keep this spacing";
  for (const header of [flow, block]) {
    const original = "---\n" + header + "\nsections: {}\n---\n" + body;
    await repo.write(relative, original);
    const summary = await call("fix", "--dry-run");
    assert.match(summary, /^tenet\/intent\.md: add IDs to 1 statement; add section digests/);
    assert.equal(summary.trimEnd().split("\n").length, 1);
    assert.equal(await readFile(file, "utf8"), original);
    const diff = await call("fix", "--diff");
    assert.match(diff, /^--- a\/tenet\/intent\.md\n\+\+\+ b\/tenet\/intent\.md\n@@/);
    assert.equal(await readFile(file, "utf8"), original);
    repo.git(["apply", "-"], diff);
    const applied = await readFile(file, "utf8");
    assert.ok(applied.startsWith("---\n" + header + "\n"));
    assert.match(applied, /\n---\n\n# Intent\n/);
    assert.match(applied, /- R-1 Track a widget/);
    await repo.write(relative, original);
    assert.deepEqual(JSON.parse(await call("fix", "--dry-run", "--json")).result, {
      changes: [{ path: relative, action: "repair" }],
    });
    assert.match(await call("fix"), /^tenet\/intent\.md: add IDs to 1 statement/);
    assert.equal(await readFile(file, "utf8"), applied);
    assert.equal(await call("fix", "--dry-run"), "No specification changes.\n");
  }
});
