import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseBlessDocument } from "../../../dist/onboard/bless.js";
import { loadPolicy } from "../../../dist/policy/index.js";
import { blessingMeasures, draftEvidence, json, safeReader, scoreReport } from "./score.mjs";
import { freshSession } from "./fresh-session.mjs";

const evalRoot = fileURLToPath(new URL(".", import.meta.url));
const project = fileURLToPath(new URL("../../../", import.meta.url));
const cli = path.join(project, "dist", "cli.js");
const files = {
  assignment: ".tenet/onboard/assignment.json", inventory: ".tenet/onboard/inventory.json",
  interview: ".tenet/onboard/interview.json",
};
const gitEnv = {
  GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0", GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "core.fsmonitor", GIT_CONFIG_VALUE_0: "false",
  GIT_AUTHOR_NAME: "Tenet Evaluation", GIT_AUTHOR_EMAIL: "evaluation@example.invalid",
  GIT_COMMITTER_NAME: "Tenet Evaluation", GIT_COMMITTER_EMAIL: "evaluation@example.invalid",
};
const splitZ = (value) => value.split("\0").filter(Boolean);
const portable = (value) => value.replaceAll("\\", "/");

export function execute(command, args, cwd, { input, env = process.env, timeout = 120_000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { cwd, env, timeout, encoding: "utf8", windowsHide: true, maxBuffer: 16 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && typeof error.code !== "number") {
          reject(new Error(`${path.basename(command)} could not complete: ${error.message}`, { cause: error }));
        } else resolve({ exit: error?.code ?? 0, stdout, stderr });
      });
    child.stdin?.on("error", (error) => { if (error.code !== "EPIPE") reject(error); });
    child.stdin?.end(input);
  });
}

const env = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^GIT_|^npm_|^INIT_CWD$|^NODE_OPTIONS$/i.test(key))),
  ...gitEnv,
};

function requireExit(result, label, expected = 0) {
  if (result.exit !== expected) throw new Error(`${label} exited ${result.exit}: ${(result.stderr || result.stdout).trim().slice(0, 1800)}`);
  return result.stdout;
}

async function git(cwd, ...args) {
  return requireExit(await execute("git", args, cwd, { env }), `git ${args[0]}`);
}

async function tenet(cwd, ...args) {
  return execute(process.execPath, [cli, ...args], cwd, { env });
}

function assignmentPath(file) {
  if (typeof file !== "string" || !file.endsWith(".md") || file.startsWith("/") ||
      file.includes("\\") || file.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith(".")) ||
      path.win32.isAbsolute(file)) throw new Error(`Invalid assigned path: ${file}`);
  return file;
}

async function stageDraft(cwd, targetPaths, date) {
  await git(cwd, "add", "--", ...targetPaths);
  if (!(await git(cwd, "diff", "--cached", "--name-only")).trim()) return;
  const stamp = `${date}T00:00:00Z`;
  const result = await execute("git", ["commit", "-qm", "Record evaluation draft"], cwd,
    { env: { ...env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp } });
  requireExit(result, "git commit");
}

async function setup(cwd) {
  const init = await tenet(cwd, "init", "--yes", "--json");
  if (init.exit === 0) {
    await git(cwd, "add", "-A");
    if ((await git(cwd, "diff", "--cached", "--name-only")).trim()) await git(cwd, "commit", "-qm", "Install Tenet");
    return "tenet init";
  }
  let result;
  try { result = JSON.parse(init.stdout); } catch { requireExit(init, "tenet init"); }
  if (init.exit !== 2 || !result?.errors?.some(({ code }) => code === "TN-USAGE-COMMAND")) requireExit(init, "tenet init");
  await writeFile(path.join(cwd, "tenet.yaml"), "standard: 0.1.0-alpha.0\nkit_path: kit\nlevel: observe\nowners: [{id: owner, name: Owner, roles: [owner]}]\n", { flag: "wx" });
  await git(cwd, "add", "tenet.yaml");
  await git(cwd, "commit", "-qm", "Set up evaluation policy");
  return "minimal policy (init unavailable)";
}

async function untracked(cwd) {
  return splitZ(await git(cwd, "ls-files", "--others", "-z"));
}

async function checkAgentWrites(cwd, baseline, originals, assigned) {
  const allowed = new Set([...assigned, files.interview]);
  const changed = [
    ...splitZ(await git(cwd, "diff", "--name-only", "-z", baseline, "--")),
    ...splitZ(await git(cwd, "diff", "--cached", "--name-only", "-z", baseline, "--")),
  ];
  if ((await git(cwd, "ls-files", "--cached", "--", ".tenet/onboard")).trim()) {
    throw new Error("Agent staged or committed private onboarding files");
  }
  const read = safeReader(cwd);
  for (const file of await untracked(cwd)) {
    if (!originals.has(file) || originals.get(file) !== read(file)) changed.push(file);
  }
  for (const [file, text] of originals) if (read(file) !== text) changed.push(file);
  const outside = [...new Set(changed)].filter((file) => !allowed.has(file));
  if (outside.length) throw new Error(`Agent modified unassigned paths: ${outside.join(", ")}`);
}

async function launchAgent({ agent, adapter, fixture, cwd, scratch, payload }) {
  if (typeof adapter.command !== "string" || !adapter.command || !Array.isArray(adapter.args) ||
      adapter.args.some((value) => typeof value !== "string")) throw new Error(`Invalid command or args for ${agent}`);
  let args = adapter.args;
  if (agent === "replay") {
    const control = path.join(scratch, "replay", fixture);
    await mkdir(control, { recursive: true });
    await cp(path.join(evalRoot, "replay.mjs"), path.join(control, "replay.mjs"));
    await cp(path.join(evalRoot, "replay", fixture), path.join(control, "drafts"), { recursive: true });
    args = args.map((arg) => arg === "{replay_script}" ? path.join(control, "replay.mjs") :
      arg === "{replay_drafts}" ? path.join(control, "drafts") : arg);
  }
  const child = await execute(adapter.command, args, cwd, { input: `${JSON.stringify(payload)}\n`, env, timeout: 30 * 60_000 });
  requireExit(child, `agent ${agent}`);
  await writeFile(path.join(scratch, `${fixture}-agent.txt`), child.stdout);
}

async function evaluateFixture(name, run, adapter, scratch) {
  const cwd = path.join(scratch, name);
  const ref = {};
  try {
    requireExit(await execute(process.execPath, [path.join(evalRoot, "materialize.mjs"), name, cwd], scratch, { env }), "materialize");
    ref.revision = (await git(cwd, "rev-parse", "HEAD")).trim();
    const key = await json(path.join(evalRoot, name, "key.json"));
    const setupMode = await setup(cwd);
    requireExit(await tenet(cwd, "onboard"), "tenet onboard");
    const assignment = await json(path.join(cwd, files.assignment));
    const assigned = [...new Set(assignment.output.paths.map(assignmentPath))];
    const baseline = (await git(cwd, "rev-parse", "HEAD")).trim();
    const read = safeReader(cwd);
    const originals = new Map((await untracked(cwd)).map((file) => [file, read(file)]));
    const policy = await loadPolicy({ cwd });
    await launchAgent({
      agent: run.agent, adapter, fixture: name, cwd, scratch,
      payload: { assignment_path: files.assignment, assignment, answers: key.interview_answers },
    });
    await checkAgentWrites(cwd, baseline, originals, assigned);
    const drafts = [];
    for (const file of assigned) {
      const filename = path.join(cwd, file);
      const entry = await lstat(filename).catch((error) => {
        if (error.code !== "ENOENT") throw error;
        return null;
      });
      if (entry === null) continue;
      const text = entry.isFile() ? read(file) : null;
      if (text === null) throw new Error(`Draft is not a readable regular file: ${file}`);
      drafts.push({ text, file });
    }
    if (!drafts.length) throw new Error("Agent did not write an assigned draft");
    const sources = new Set(splitZ(await git(cwd, "ls-tree", "-r", "--name-only", "-z", ref.revision)));
    const evidence = draftEvidence(drafts, cwd, key, policy.specs.id_prefix, sources);
    await stageDraft(cwd, drafts.map(({ file }) => file), run.date);
    const draftRevision = (await git(cwd, "rev-parse", "HEAD")).trim();
    const card = await tenet(cwd, "onboard", "--card");
    const checked = await tenet(cwd, "check", "--json");
    if (checked.exit !== 0 && checked.exit !== 1) requireExit(checked, "tenet check");
    const findings = JSON.parse(checked.stdout).result?.findings;
    if (!Array.isArray(findings)) throw new Error("tenet check returned no findings list");
    await writeFile(path.join(scratch, `${name}-check.json`), checked.stdout);
    await writeFile(path.join(scratch, `${name}-card.md`), requireExit(card, "tenet onboard --card"));
    const findKey = ({ code, file, line, message }) => JSON.stringify([code, file, line, message]);
    evidence.citationFailures = new Set([
      ...evidence.citations, ...findings.filter(({ code }) => code.startsWith("TN-CITE-")),
    ].map(findKey)).size + evidence.uncited.length;
    const stampMatches = drafts.every(({ file }) =>
      parseBlessDocument(file, read(file) ?? "", policy.specs.id_prefix).front?.tenet?.drafted_at_rev === draftRevision);
    return {
      name, revision: ref.revision, setup: setupMode, stampMatches, records: portable(policy.paths.records), draftRevision,
      evidence, checkExit: checked.exit, checkCodes: [...new Set(findings.map(({ code }) => code))],
      measures: await blessingMeasures(cwd, policy.paths.records),
      passed: checked.exit === 0 && stampMatches && evidence.rows.length > 0 && evidence.citationFailures === 0 &&
        evidence.interviewValid && evidence.ungrounded.length === 0 && evidence.unauthorized.length === 0 &&
        evidence.settledConflicts.length === 0 && evidence.planted.every(({ reported }) => reported),
    };
  } catch (error) {
    return { name, revision: ref.revision ?? "unavailable", passed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function writeReport(run, scratch, out) {
  const dir = path.join(out, run.agent);
  await mkdir(dir, { recursive: true });
  const report = path.join(dir, `${run.date}.md`);
  const next = scoreReport(run);
  const previous = await readFile(report, "utf8").catch((error) => {
    if (error.code !== "ENOENT") throw error;
    return null;
  });
  let previousReport;
  if (previous !== null && previous !== next) {
    previousReport = path.join(await mkdtemp(path.join(scratch, "previous-report-")), path.basename(report));
    await writeFile(previousReport, previous, "utf8");
  }
  await writeFile(report, next, "utf8");
  await writeFile(path.join(scratch, "run.json"), `${JSON.stringify(run, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    report, scratch, previousReport, automatic: run.cases.filter(({ passed }) => passed).length, fixtures: run.cases.length,
    scoredKept: run.cases.filter(({ measures }) => measures && measures.ratio !== null).length,
  }));
  if (run.cases.some(({ passed }) => !passed)) process.exitCode = 1;
}

function nameArgument(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error("Use a configured agent name with --agent");
  return value;
}

async function main() {
  const { values: opts } = parseArgs({ options: {
    agent: { type: "string" }, fixture: { type: "string" }, out: { type: "string" },
    rescore: { type: "string" }, "fresh-session": { type: "boolean" }, worktree: { type: "string" },
    "drift-ref": { type: "string" }, transcript: { type: "string" }, response: { type: "string" },
  } });
  if (opts["fresh-session"]) return freshSession(opts, { execute, project, git, env });
  const out = path.resolve(opts.out ?? path.join(evalRoot, "results"));
  if (opts.rescore) {
    const scratch = path.resolve(opts.rescore);
    const run = await json(path.join(scratch, "run.json"));
    nameArgument(run.agent);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date)) throw new Error("Invalid saved report date");
    for (const entry of run.cases) {
      if (!entry.error) entry.measures = await blessingMeasures(path.join(scratch, nameArgument(entry.name)), entry.records);
    }
    return writeReport(run, scratch, out);
  }
  const agent = nameArgument(opts.agent);
  const adapters = await json(path.join(evalRoot, "agents.json"));
  if (!Object.hasOwn(adapters, agent)) throw new Error(`Agent ${agent} is not configured in agents.json`);
  const adapter = adapters[agent];
  const names = [];
  for (const entry of await readdir(evalRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const exists = await lstat(path.join(evalRoot, entry.name, "key.json")).catch((error) => {
      if (error.code !== "ENOENT") throw error;
      return null;
    });
    if (exists?.isFile()) names.push(entry.name);
  }
  names.sort();
  if (opts.fixture && !names.includes(opts.fixture)) throw new Error(`Unknown fixture ${opts.fixture}`);
  const chosen = opts.fixture ? [opts.fixture] : names;
  if (!chosen.length) throw new Error("No onboarding fixtures found");
  const tmp = await realpath(os.tmpdir());
  const relative = path.relative(await realpath(project), tmp);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
    throw new Error("The evaluation scratch directory must be outside the Tenet repository");
  }
  const scratch = await mkdtemp(path.join(tmp, "tenet-onboarding-"));
  const run = {
    agent, model: adapter.model ?? "unreported", effort: adapter.effort ?? "unreported",
    date: new Date().toISOString().slice(0, 10), harness: (await git(project, "rev-parse", "HEAD")).trim(),
    cases: [],
  };
  for (const name of chosen) run.cases.push(await evaluateFixture(name, run, adapter, scratch));
  return writeReport(run, scratch, out);
}

await main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 2;
});
