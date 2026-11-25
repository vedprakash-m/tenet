import { execFile } from "node:child_process";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
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

async function processTools(scratch, runProcess) {
  const home = path.join(scratch, "home");
  const appData = path.join(home, "appdata");
  const localAppData = path.join(home, "localappdata");
  const config = path.join(home, "config");
  const temp = path.join(scratch, "tmp");
  await Promise.all([appData, localAppData, config, temp].map((folder) => mkdir(folder, { recursive: true })));
  const isolated = {
    HOME: home, USERPROFILE: home, APPDATA: appData, LOCALAPPDATA: localAppData, XDG_CONFIG_HOME: config,
    TMPDIR: temp, TEMP: temp, TMP: temp,
  };
  if (process.platform === "win32") {
    const root = path.parse(home).root;
    isolated.HOMEDRIVE = root.slice(0, -1);
    isolated.HOMEPATH = home.slice(root.length - 1);
  }
  const blocked = new Set([...Object.keys(isolated), "HOMEDRIVE", "HOMEPATH"]);
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    !blocked.has(key.toUpperCase()) && !/^GIT_|^npm_|^INIT_CWD$|^NODE_OPTIONS$/i.test(key)));
  const launch = (command, args, cwd, options = {}) => runProcess(command, args, cwd, {
    ...options, env: {
      ...inherited,
      ...gitEnv,
      ...options.env,
      ...isolated,
      TENET_TEST_REGISTRY_INTEGRITY: "not-found",
    },
  });
  const git = async (cwd, ...args) => requireExit(await launch("git", args, cwd), `git ${args[0]}`);
  const tenet = (cwd, ...args) => launch(process.execPath, [cli, ...args], cwd);
  return { execute: launch, git, tenet };
}

function requireExit(result, label, expected = 0) {
  if (result.exit !== expected) throw new Error(`${label} exited ${result.exit}: ${(result.stderr || result.stdout).trim().slice(0, 1800)}`);
  return result.stdout;
}

function assignmentPath(file) {
  if (typeof file !== "string" || !file.endsWith(".md") || file.startsWith("/") ||
      file.includes("\\") || file.split("/").some((part) => !part || part === "." || part === ".." || part.startsWith(".")) ||
      path.win32.isAbsolute(file)) throw new Error(`Invalid assigned path: ${file}`);
  return file;
}

async function stageDraft(cwd, targetPaths, date, { git, execute }) {
  await git(cwd, "add", "--", ...targetPaths);
  if (!(await git(cwd, "diff", "--cached", "--name-only")).trim()) return;
  const stamp = `${date}T00:00:00Z`;
  const result = await execute("git", ["commit", "-qm", "Record evaluation draft"], cwd,
    { env: { GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp } });
  requireExit(result, "git commit");
}

class InitFailure extends Error {
  constructor(code, exit) {
    super("init failed");
    this.code = code;
    this.exit = exit;
  }
}

async function setup(cwd, { git, tenet }) {
  let init;
  try {
    init = await tenet(cwd, "init", "--yes", "--json");
  } catch (error) {
    throw new InitFailure(error.cause?.code ?? "unavailable", null);
  }
  if (init.exit === 0) {
    await git(cwd, "add", "-A");
    if ((await git(cwd, "diff", "--cached", "--name-only")).trim()) await git(cwd, "commit", "-qm", "Install Tenet");
    return "tenet init";
  }
  let code;
  try {
    const { errors } = JSON.parse(init.stdout);
    code = errors?.find((finding) => finding.severity === "error")?.code ?? errors?.[0]?.code;
  } catch { /* A process failure may have no Tenet envelope. */ }
  if (init.exit !== 2 || code !== "TN-USAGE-COMMAND") throw new InitFailure(code ?? "unavailable", init.exit);
  await writeFile(path.join(cwd, "tenet.yaml"), "standard: 0.1.0-alpha.0\nkit_path: kit\nlevel: observe\nowners: [{id: owner, name: Owner, roles: [owner]}]\n", { flag: "wx" });
  await git(cwd, "add", "tenet.yaml");
  await git(cwd, "commit", "-qm", "Set up evaluation policy");
  return "minimal policy (init unavailable)";
}

async function untracked(cwd, git) {
  return splitZ(await git(cwd, "ls-files", "--others", "-z"));
}

async function checkAgentWrites(cwd, baseline, originals, assigned, git) {
  const allowed = new Set([...assigned, files.interview]);
  const changed = [
    ...splitZ(await git(cwd, "diff", "--name-only", "-z", baseline, "--")),
    ...splitZ(await git(cwd, "diff", "--cached", "--name-only", "-z", baseline, "--")),
  ];
  if ((await git(cwd, "ls-files", "--cached", "--", ".tenet/onboard")).trim()) {
    throw new Error("Agent staged or committed private onboarding files");
  }
  const read = safeReader(cwd);
  for (const file of await untracked(cwd, git)) {
    if (!originals.has(file) || originals.get(file) !== read(file)) changed.push(file);
  }
  for (const [file, text] of originals) if (read(file) !== text) changed.push(file);
  const outside = [...new Set(changed)].filter((file) => !allowed.has(file));
  if (outside.length) throw new Error(`Agent modified unassigned paths: ${outside.join(", ")}`);
}

async function launchAgent({ agent, adapter, fixture, cwd, scratch, payload, execute }) {
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
  const child = await execute(adapter.command, args, cwd, { input: `${JSON.stringify(payload)}\n`, timeout: 30 * 60_000 });
  requireExit(child, `agent ${agent}`);
  await writeFile(path.join(scratch, `${fixture}-agent.txt`), child.stdout);
}

async function evaluateFixture(name, run, adapter, scratch, tools) {
  const { execute, git, tenet } = tools;
  const cwd = path.join(scratch, name);
  const ref = {};
  try {
    requireExit(await execute(process.execPath, [path.join(evalRoot, "materialize.mjs"), name, cwd], scratch), "materialize");
    ref.revision = (await git(cwd, "rev-parse", "HEAD")).trim();
    const key = await json(path.join(evalRoot, name, "key.json"));
    const setupMode = await setup(cwd, tools);
    requireExit(await tenet(cwd, "onboard"), "tenet onboard");
    const assignment = await json(path.join(cwd, files.assignment));
    const assigned = [...new Set(assignment.output.paths.map(assignmentPath))];
    const baseline = (await git(cwd, "rev-parse", "HEAD")).trim();
    const read = safeReader(cwd);
    const originals = new Map((await untracked(cwd, git)).map((file) => [file, read(file)]));
    const policy = await loadPolicy({ cwd });
    await launchAgent({
      agent: run.agent, adapter, fixture: name, cwd, scratch, execute,
      payload: { assignment_path: files.assignment, assignment, answers: key.interview_answers },
    });
    await checkAgentWrites(cwd, baseline, originals, assigned, git);
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
    await stageDraft(cwd, drafts.map(({ file }) => file), run.date, tools);
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
    if (error instanceof InitFailure) return { name, revision: ref.revision, passed: false, initFailure: { code: error.code, exit: error.exit } };
    return { name, revision: ref.revision ?? "unavailable", passed: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function writeReport(run, scratch, out) {
  const dir = path.join(out, run.agent);
  await mkdir(dir, { recursive: true });
  const report = path.join(dir, `${run.date}.md`);
  const initFailures = run.cases.filter(({ initFailure }) => initFailure);
  const setupReport = initFailures.length ? [
    "", "## Init failures", "",
    "| Fixture | Revision | Status | Code | Exit |",
    "|---|---|---|---|---:|",
    ...initFailures.map(({ name, revision, initFailure }) =>
      `| ${name} | ${revision} | init failed | ${initFailure.code} | ${initFailure.exit ?? "unavailable"} |`),
    "",
  ].join("\n") : "";
  const next = scoreReport({ ...run, cases: run.cases.filter(({ initFailure }) => !initFailure) }) + setupReport;
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
  return {
    report, scratch, previousReport, automatic: run.cases.filter(({ passed }) => passed).length, fixtures: run.cases.length,
    scoredKept: run.cases.filter(({ measures }) => measures && measures.ratio !== null).length,
  };
}

function nameArgument(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error("Use a configured agent name with --agent");
  return value;
}

export async function main(args, runProcess = execute) {
  const { values: opts } = parseArgs({ args, options: {
    agent: { type: "string" }, fixture: { type: "string" }, out: { type: "string" },
    rescore: { type: "string" }, "fresh-session": { type: "boolean" }, worktree: { type: "string" },
    "drift-ref": { type: "string" }, transcript: { type: "string" }, response: { type: "string" },
  } });
  if (opts["fresh-session"] && !opts.worktree) return freshSession(opts, { project });
  const out = path.resolve(opts.out ?? path.join(evalRoot, "results"));
  if (opts.rescore) {
    const scratch = path.resolve(opts.rescore);
    const run = await json(path.join(scratch, "run.json"));
    nameArgument(run.agent);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(run.date)) throw new Error("Invalid saved report date");
    for (const entry of run.cases) {
      if (!entry.error && !entry.initFailure) entry.measures = await blessingMeasures(path.join(scratch, nameArgument(entry.name)), entry.records);
    }
    return writeReport(run, scratch, out);
  }
  if (opts["fresh-session"]) {
    const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-fresh-session-"));
    try {
      return await freshSession(opts, { ...await processTools(scratch, runProcess), project });
    } finally {
      await rm(scratch, { recursive: true, force: true });
    }
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
  const tools = await processTools(scratch, runProcess);
  const run = {
    agent, model: adapter.model ?? "unreported", effort: adapter.effort ?? "unreported",
    date: new Date().toISOString().slice(0, 10), harness: (await tools.git(project, "rev-parse", "HEAD")).trim(),
    cases: [],
  };
  for (const name of chosen) run.cases.push(await evaluateFixture(name, run, adapter, scratch, tools));
  return writeReport(run, scratch, out);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  await main(process.argv.slice(2)).then((report) => {
    if (!report) return;
    console.log(JSON.stringify(report));
    if (report.automatic !== report.fixtures) process.exitCode = 1;
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  });
}
