import type { Dirent } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { compareUtf16, detectHosts } from "./hosts.js";
import { localProfileRoots, windowsCommandShimRequired } from "./environment.js";
import type {
  CiJobFact,
  HostContext,
  HostWritePlan,
  InitPlan,
  InstallFinding,
  PlannedBlock,
  PlannedKey,
  PlannedLocalKey,
  PreflightEnvironment,
  PreflightOptions,
  PreflightPrompt,
  PreflightResult,
  ProjectKind,
  RunnerFact,
  RunnerKind,
} from "./types.js";

type GitFacts = {
  version: string | null;
  head: string | null;
  branch: string | null;
  defaultBranch: string | null;
  remote: string | null;
  userName: string | null;
  empty: boolean;
  state: "committed" | "unborn";
};

const kinds: ProjectKind[] = ["service", "library", "data", "infrastructure", "ml", "other"];
const noReportFinding = "No machine-readable test report configured";

async function optionalRead(filename: string): Promise<string | null> {
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function diagnostic(code: "TN-ENV-GIT" | "TN-ENV-NOT-GIT", vars: Record<string, string> = {}) {
  const words = message(code, vars);
  return fail(code, words.message, words.fix);
}

async function gitValue(args: string[], cwd: string): Promise<string | null> {
  try {
    return (await git(args, { cwd })).trim();
  } catch {
    return null;
  }
}

async function discoverDefaultBranch(
  cwd: string,
  injectedBranch: string | undefined,
  currentBranch: string | null,
): Promise<string> {
  if (injectedBranch !== undefined) {
    return injectedBranch || "main";
  }
  const remoteHead = await gitValue(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], cwd);
  if (remoteHead) {
    const slash = remoteHead.indexOf("/");
    const candidate = slash >= 0 ? remoteHead.slice(slash + 1) : remoteHead;
    if (candidate) return candidate;
  }
  for (const candidate of ["main", "master"]) {
    if ((await gitValue(["rev-parse", "--verify", "--quiet", `refs/heads/${candidate}`], cwd)) !== null) {
      return candidate;
    }
  }
  const configured = await gitValue(["config", "init.defaultBranch"], cwd);
  if (configured) return configured;
  return currentBranch || "main";
}

async function discoverGit(cwd: string, environment: PreflightEnvironment): Promise<GitFacts | ReturnType<typeof diagnostic>> {
  const injected = environment.git;
  const injectedTool = environment.tools?.git;
  if (injected?.state === "tool-unavailable" || injectedTool === null) {
    return diagnostic("TN-ENV-GIT", { found: "not installed" });
  }
  if (injected?.state === "not-a-repository") return diagnostic("TN-ENV-NOT-GIT", { path: cwd });

  const suppliedVersion = injected?.version ?? injectedTool ?? null;
  let version = suppliedVersion;
  if (version === null) version = await gitValue(["--version"], cwd);
  if (version === null && injected?.state === undefined) return diagnostic("TN-ENV-GIT", { found: "not installed" });
  if (injected?.state === undefined) {
    const inside = await gitValue(["rev-parse", "--is-inside-work-tree"], cwd);
    if (inside !== "true") return diagnostic("TN-ENV-NOT-GIT", { path: cwd });
  }

  const rawHead = injected?.head !== undefined ? injected.head : await gitValue(["rev-parse", "--verify", "HEAD^{commit}"], cwd);
  const head = rawHead || null;
  const branch = injected?.branch ?? await gitValue(["branch", "--show-current"], cwd);
  const defaultBranch = await discoverDefaultBranch(cwd, injected?.branch, branch);
  let remote: string | null;
  if (injected && "remote" in injected) remote = injected.remote ?? null;
  else {
    remote = await gitValue(["remote", "get-url", "origin"], cwd);
    if (!remote) {
      const first = (await gitValue(["remote"], cwd))?.split(/\r?\n/).find(Boolean);
      remote = first ? await gitValue(["remote", "get-url", first], cwd) : null;
    }
  }
  const userName = injected?.userName ?? await gitValue(["config", "user.name"], cwd);
  const tracked = injected?.state === "unborn" ? 0 : Number((await gitValue(["ls-files", "-z"], cwd))?.includes("\0"));
  const listed = injected?.state === "unborn" ? "" : await gitValue(["ls-files", "-z"], cwd);
  const state = injected?.state === "unborn" || !head ? "unborn" : "committed";
  return {
    version,
    head,
    branch: branch || null,
    defaultBranch,
    remote,
    userName: userName || null,
    empty: state === "unborn" || (tracked === 0 && (listed ?? "").length === 0),
    state,
  };
}

function remoteForge(remote: string | null): "github" | "other" | "none" {
  if (!remote) return "none";
  return /(?:^|[@/:])github\.com(?::|\/|$)/i.test(remote) ? "github" : "other";
}

async function readJson(filename: string): Promise<Record<string, unknown>> {
  const source = await optionalRead(filename);
  if (source === null) return {};
  try {
    return object(JSON.parse(source));
  } catch {
    return {};
  }
}

function containsRunner(value: unknown, runner: RegExp): boolean {
  return typeof value === "string" && runner.test(value);
}

function dependenciesContain(pkg: Record<string, unknown>, name: string): boolean {
  return ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"].some((field) => name in object(pkg[field]));
}

function detectRunner(pkg: Record<string, unknown>, present: Set<string>): RunnerKind | null {
  const test = object(pkg.scripts).test;
  const manifest = JSON.stringify(pkg);
  if (dependenciesContain(pkg, "vitest") || containsRunner(test, /\bvitest\b/i) || present.has("vitest.config.ts") || present.has("vitest.config.js")) return "vitest";
  if (dependenciesContain(pkg, "jest") || containsRunner(test, /\bjest\b/i)) return "jest";
  if (containsRunner(test, /node(?:\s+\S+)*\s+--test\b|\bnode --test\b/i)) return "node:test";
  if (present.has("pyproject.toml") || present.has("requirements.txt") || present.has("pytest.ini") || present.has("setup.cfg")) return "pytest";
  if (present.has("go.mod")) return "go";
  if (dependenciesContain(pkg, "ctrf") || containsRunner(test, /\bctrf\b/i) || /\bctrf\b/i.test(manifest)) return "ctrf";
  return typeof test === "string" && test.trim() ? "other" : null;
}

function runnerCommand(kind: RunnerKind): Pick<RunnerFact, "command" | "report" | "report_from" | "report_path"> {
  switch (kind) {
    case "vitest":
      return {
        command: "npx vitest run --reporter=default --reporter=junit --outputFile.junit=.tenet/reports/test.xml",
        report: "junit", report_from: "file", report_path: ".tenet/reports/test.xml",
      };
    case "jest":
      return {
        command: "npx jest --ci --json --outputFile=.tenet/reports/test.json",
        report: "jest-json", report_from: "file", report_path: ".tenet/reports/test.json",
      };
    case "node:test":
      return {
        command: "node --test --test-reporter=spec --test-reporter-destination=stdout --test-reporter=junit --test-reporter-destination=.tenet/reports/test.xml",
        report: "junit", report_from: "file", report_path: ".tenet/reports/test.xml",
      };
    case "pytest":
      return {
        command: "python -m pytest --junitxml=.tenet/reports/test.xml",
        report: "junit", report_from: "file", report_path: ".tenet/reports/test.xml",
      };
    case "go":
      return { command: "go test -json ./...", report: "go-test-json", report_from: "stdout", report_path: null };
    case "ctrf":
      return {
        command: "npm test",
        report: "ctrf", report_from: "file", report_path: ".tenet/reports/test.json",
      };
    case "other":
      return { command: "npm test", report: "none", report_from: "file", report_path: null };
  }
}

async function packageManagerSetup(cwd: string): Promise<string[]> {
  for (const [filename, commands] of [
    ["package-lock.json", ["npm ci"]],
    ["pnpm-lock.yaml", ["corepack enable && pnpm install --frozen-lockfile"]],
    ["yarn.lock", ["corepack enable && yarn install --immutable"]],
    ["uv.lock", ["pip install uv && uv sync"]],
  ] as const) {
    if (await optionalRead(path.join(cwd, filename)) !== null) return [...commands];
  }
  if (await optionalRead(path.join(cwd, "pyproject.toml")) !== null) return ['pip install -e ".[test]"'];
  if (await optionalRead(path.join(cwd, "requirements.txt")) !== null) return ["pip install -r requirements.txt"];
  if (await optionalRead(path.join(cwd, "go.mod")) !== null) return ["go mod download"];
  return [];
}

function runnerPattern(kind: RunnerKind): RegExp {
  switch (kind) {
    case "vitest": return /\bvitest\b/i;
    case "jest": return /\bjest\b/i;
    case "node:test": return /\bnode\b[^\r\n]*--test\b/i;
    case "pytest": return /\bpytest\b/i;
    case "go": return /\bgo\s+test\b/i;
    case "ctrf": return /\bctrf\b/i;
    case "other": return /\b(?:npm|pnpm|yarn)\s+test\b/i;
  }
}

function testPattern(runner: RunnerFact): RegExp {
  const direct = runnerPattern(runner.kind);
  if (runner.kind === "other") return direct;
  return new RegExp(`${direct.source}|\\b(?:npm|pnpm)\\s+(?:run\\s+)?test\\b|\\byarn\\s+test\\b`, direct.flags);
}

function resolveTestScriptWrapper(command: string, packageTestScript: string | null): string | null {
  if (!packageTestScript) return null;
  const match = /^\s*(?:npm|pnpm)\s+(?:run\s+)?test\b([\s\S]*)$/i.exec(command) ??
    /^\s*yarn\s+test\b([\s\S]*)$/i.exec(command);
  if (!match) return null;
  let forwarded = (match[1] ?? "").trim();
  if (forwarded === "--") forwarded = "";
  else if (forwarded.startsWith("-- ")) forwarded = forwarded.slice(3).trimStart();
  return [packageTestScript, forwarded].filter(Boolean).join(" ");
}

function reportPath(command: string, kind: RunnerKind): { reports: boolean; path: string | null } {
  if (kind === "vitest") {
    const match = /--outputFile(?:\.junit)?=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(command);
    return { reports: /--reporter(?:=|\s+)junit\b/i.test(command) && Boolean(match), path: match?.[1] ?? match?.[2] ?? match?.[3] ?? null };
  }
  if (kind === "jest") {
    const match = /--outputFile=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(command);
    return { reports: /(?:^|\s)--json(?:\s|$)/i.test(command) && Boolean(match), path: match?.[1] ?? match?.[2] ?? match?.[3] ?? null };
  }
  if (kind === "node:test") {
    const match = /--test-reporter=junit(?:\s|$)[\s\S]*?--test-reporter-destination=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(command);
    return { reports: /--test-reporter=(?:junit)(?:\s|$)/i.test(command) && Boolean(match), path: match?.[1] ?? match?.[2] ?? match?.[3] ?? null };
  }
  if (kind === "pytest") {
    const match = /--junitxml=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i.exec(command);
    return { reports: Boolean(match), path: match?.[1] ?? match?.[2] ?? match?.[3] ?? null };
  }
  if (kind === "go") return { reports: /(?:^|\s)-json(?:\s|$)/i.test(command), path: null };
  return { reports: false, path: null };
}

function parseYaml(text: string): Record<string, unknown> {
  const document = parseDocument(text, { merge: false, prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) return {};
  return object(document.toJS({ maxAliasCount: 50 }));
}

async function inspectCi(cwd: string, runner: RunnerFact | null, packageTestScript: string | null): Promise<CiJobFact[]> {
  if (!runner) return [];
  const directory = path.join(cwd, ".github", "workflows");
  let names: string[];
  try {
    names = (await readdir(directory)).filter((name) => /\.ya?ml$/i.test(name)).sort(compareUtf16);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const pattern = testPattern(runner);
  const jobs: CiJobFact[] = [];
  for (const name of names) {
    const workflow = `.github/workflows/${name}`;
    const document = parseYaml((await readFile(path.join(directory, name), "utf8")));
    const jobEntries = Object.entries(object(document.jobs)).sort(([left], [right]) => compareUtf16(left, right));
    for (const [jobName, rawJob] of jobEntries) {
      const job = object(rawJob);
      const reusable = typeof job.uses === "string";
      const steps = Array.isArray(job.steps) ? job.steps.map(object) : [];
      const testStep = steps.findIndex((step) => {
        if (typeof step.run !== "string") return false;
        if (pattern.test(step.run) && !/\b(?:npm|pnpm)\s+(?:run\s+)?test\b|\byarn\s+test\b/i.test(step.run)) return true;
        return packageTestScript !== null &&
          /\b(?:npm|pnpm)\s+(?:run\s+)?test\b|\byarn\s+test\b/i.test(step.run) &&
          runnerPattern(runner.kind).test(packageTestScript);
      });
      if (testStep < 0 && !reusable) continue;
      const command = testStep >= 0 && typeof steps[testStep]?.run === "string" ? String(steps[testStep]?.run).trim() : null;
      const resolvedCommand = command === null ? null : resolveTestScriptWrapper(command, packageTestScript) ?? command;
      const reports = resolvedCommand ? reportPath(resolvedCommand, runner.kind) : { reports: false, path: null };
      const setup = testStep < 0 ? [] : steps.slice(0, testStep).flatMap((step) =>
        typeof step.run === "string" && step.run.trim() ? [step.run.trim()] : []);
      jobs.push({
        workflow,
        name: jobName,
        id: testStep >= 0 && typeof steps[testStep]?.id === "string" ? String(steps[testStep]?.id) : null,
        test_step: testStep >= 0 ? testStep : null,
        command,
        report_path: reports.path,
        reports: reports.reports,
        reusable,
        services: job.services !== undefined,
        matrix: object(job.strategy).matrix !== undefined,
        setup,
      });
    }
  }
  return jobs.sort((left, right) =>
    compareUtf16(left.workflow, right.workflow) || compareUtf16(left.name, right.name));
}

function selectedCiJob(jobs: CiJobFact[]): CiJobFact | null {
  return [...jobs].sort((left, right) => {
    const rank = (job: CiJobFact) => !job.reusable && job.reports ? 0 : !job.reusable ? 1 : 2;
    return rank(left) - rank(right) ||
      compareUtf16(left.workflow, right.workflow) ||
      compareUtf16(left.name, right.name);
  })[0] ?? null;
}

function normalizedOwnerId(value: string): string {
  return value.replace(/^@+/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function discoverOwners(cwd: string, gitUser: string | null, yes: boolean): Promise<PreflightResult["facts"]["owners"]> {
  const owners: PreflightResult["facts"]["owners"] = [];
  const add = (name: string) => {
    const id = normalizedOwnerId(name);
    if (id && !owners.some((owner) => owner.id === id)) owners.push({ id, name, roles: ["owner"] });
  };
  if (gitUser) add(gitUser);
  if (!yes) {
    for (const relative of [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]) {
      const text = await optionalRead(path.join(cwd, ...relative.split("/")));
      if (!text) continue;
      for (const line of text.split(/\r?\n/)) {
        const content = line.replace(/(?:^|\s)#.*$/, "").trim();
        if (!content || content.startsWith("!")) continue;
        for (const value of content.split(/\s+/).slice(1)) if (value.startsWith("@")) add(value);
      }
      break;
    }
  }
  return owners;
}

function mergeHostPlan(plan: HostWritePlan, next: HostWritePlan): void {
  plan.created.push(...next.created);
  plan.blocks.push(...next.blocks);
  plan.keys.push(...next.keys);
  plan.local_keys.push(...next.local_keys);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function sortedBlocks(values: PlannedBlock[]): PlannedBlock[] {
  const unique = new Map(values.map((value) => [`${value.path}\0${value.kind}`, value]));
  return [...unique.values()].sort((left, right) => compareUtf16(left.path, right.path) || compareUtf16(left.kind, right.kind));
}

function sortedKeys(values: PlannedKey[]): PlannedKey[] {
  const unique = new Map(values.map((value) => [`${value.path}\0${value.pointer}`, value]));
  return [...unique.values()].sort((left, right) => compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer));
}

function sortedLocalKeys(values: PlannedLocalKey[]): PlannedLocalKey[] {
  const unique = new Map(values.map((value) => [`${value.host}\0${value.path}\0${value.pointer}`, value]));
  return [...unique.values()].sort((left, right) =>
    compareUtf16(left.path, right.path) || compareUtf16(left.pointer, right.pointer) || compareUtf16(left.host, right.host));
}

async function emptyRootNames(cwd: string): Promise<Set<string>> {
  try {
    return new Set((await readdir(cwd)).sort(compareUtf16));
  } catch {
    return new Set();
  }
}

async function pullRequestTemplatePath(cwd: string): Promise<string> {
  const defaultName = "pull_request_template.md";
  let entries: Dirent[];
  try {
    entries = await readdir(path.join(cwd, ".github"), { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "ENOTDIR") {
      return `.github/${defaultName}`;
    }
    throw error;
  }
  const matches = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase() === defaultName)
    .map((entry) => entry.name)
    .sort(compareUtf16);
  return `.github/${matches.find((name) => name === defaultName) ?? matches[0] ?? defaultName}`;
}

async function listKitFiles(root: string, relative = ""): Promise<string[]> {
  const entries = await readdir(path.join(root, ...relative.split("/").filter(Boolean)), { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => compareUtf16(left.name, right.name))) {
    const name = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listKitFiles(root, name)));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

function customRunner(command: string, setup: string[]): RunnerFact {
  const kind: RunnerKind = /\bvitest\b/i.test(command) ? "vitest"
    : /\bjest\b/i.test(command) ? "jest"
      : /\bnode\b[^\r\n]*--test\b/i.test(command) ? "node:test"
        : /\bpytest\b/i.test(command) ? "pytest"
          : /\bgo\s+test\b/i.test(command) ? "go"
            : /\bctrf\b/i.test(command) ? "ctrf"
              : "other";
  const detectedReport = reportPath(command, kind);
  const report = detectedReport.reports
    ? runnerCommand(kind).report
    : "none";
  return {
    kind,
    command,
    report,
    report_from: kind === "go" && detectedReport.reports ? "stdout" : "file",
    report_path: detectedReport.path,
    package_manager_setup: setup,
  };
}

export async function preflight(options: PreflightOptions = {}): Promise<PreflightResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const environment = options.environment ?? {};
  const discovered = await discoverGit(cwd, environment);
  const emptyFacts = {
    repository: { cwd, git: false, head: null, branch: null, default_branch: null, remote: null, forge: "none" as const, empty: false },
    runner: null,
    ci: { jobs: [], selected: null },
    owners: [],
    purpose: null,
    kind: null,
  };
  if ("code" in discovered) {
    return { plan: null, findings: [], diagnostics: [discovered], prompts: [], facts: emptyFacts };
  }

  const gitFacts = discovered as GitFacts;
  const rootNames = await emptyRootNames(cwd);
  const pkg = await readJson(path.join(cwd, "package.json"));
  const runnerKind = detectRunner(pkg, rootNames);
  const setup = await packageManagerSetup(cwd);
  const ownCommand = typeof object(pkg.scripts).test === "string" ? String(object(pkg.scripts).test).trim() : null;
  const runnerBase = runnerKind ? runnerCommand(runnerKind) : null;
  const customTestCommand = options.answers?.testCommand?.trim();
  const runner = runnerKind && runnerBase ? {
    kind: runnerKind,
    ...runnerBase,
    ...((runnerKind === "ctrf" || runnerKind === "other") && ownCommand ? { command: ownCommand } : {}),
    package_manager_setup: setup,
  } : customTestCommand ? customRunner(customTestCommand, setup) : null;
  const jobs = await inspectCi(cwd, runner, ownCommand);
  const selected = selectedCiJob(jobs);
  const forge = remoteForge(gitFacts.remote);
  const reporterAccepted = options.answers?.allowReporterEdit;
  let ciMode: InitPlan["ci_mode"];
  let ciReason: string;
  if (forge !== "github") {
    ciMode = "none";
    ciReason = "non-GitHub remote: local checks and specifications are enabled; CI proof cards require GitHub in alpha.0";
  } else if (selected?.reusable) {
    ciMode = "tenet-workflow";
    ciReason = "reusable workflow cannot be edited in place";
  } else if (selected?.reports) {
    ciMode = "existing-ci";
    ciReason = "existing CI job writes a supported test report";
  } else if (selected && reporterAccepted === true) {
    ciMode = "existing-ci";
    ciReason = "existing CI reporter edit accepted";
  } else if (selected) {
    ciMode = "tenet-workflow";
    ciReason = "existing CI job does not write a test report";
  } else {
    ciMode = "tenet-workflow";
    ciReason = "no existing CI job runs the detected test command";
  }

  const prompts: PreflightPrompt[] = [];
  const isEmpty = gitFacts.empty;
  const purpose = options.answers?.purpose ?? (options.yes && isEmpty ? "Undecided · edit or run tenet onboard" : null);
  const kind = options.answers?.kind ?? (options.yes && isEmpty ? "other" : null);
  if (isEmpty && purpose === null) prompts.push({ key: "purpose", question: "What is this project for?" });
  if (isEmpty && kind === null) prompts.push({ key: "kind", question: "Project kind (service/library/data/infrastructure/ml/other) [other]:", options: kinds, default: "other" });
  if (!isEmpty && runnerKind === null && !options.yes && options.answers?.testCommand === undefined) {
    prompts.push({ key: "testCommand", question: "What command runs your tests? (blank to skip)", default: "" });
  }
  if (forge === "github" && selected && !selected.reports && !selected.reusable && reporterAccepted === undefined && !options.yes) {
    prompts.push({
      key: "reporterEdit",
      question: "Add a test reporter setting to the existing CI job?",
      default: false,
    });
  }

  const hostPlan: HostWritePlan = { created: [], blocks: [], keys: [], local_keys: [] };
  const detectedContext: HostContext = {
    cwd,
    platform: environment.platform ?? process.platform,
  };
  const descriptors = await detectHosts(detectedContext, options.hosts);
  const profileRoots = localProfileRoots(environment);
  const shimHosts = windowsCommandShimRequired(
    environment,
    descriptors
      .filter(({ capabilityLevel }) => capabilityLevel !== "instructions")
      .map(({ id }) => id),
  );
  const hostContext: HostContext = {
    ...detectedContext,
    ...(profileRoots === undefined ? {} : { localProfileRoots: profileRoots }),
    ...(shimHosts === undefined ? {} : { windowsCommandShimRequired: shimHosts }),
  };
  for (const descriptor of descriptors) mergeHostPlan(hostPlan, await descriptor.planWrites(hostContext));
  const candidateLocalKeys = sortedLocalKeys(hostPlan.local_keys);
  const localHostDecision = options.answers?.allowLocalHosts;
  const localHostsAuthorized =
    options.localHosts === true ||
    localHostDecision === true ||
    environment.localProfileRoot !== undefined;
  const localKeys = localHostsAuthorized ? candidateLocalKeys : [];
  if (
    candidateLocalKeys.length > 0 &&
    !options.yes &&
    localHostDecision === undefined &&
    environment.localProfileRoot === undefined
  ) {
    prompts.push({
      key: "localHosts",
      question: "Edit local host settings outside the repository?",
      default: false,
      local_keys: candidateLocalKeys,
    });
  }
  const hosts = descriptors.map((descriptor) => ({ id: descriptor.id, capability: descriptor.capabilityLevel }))
    .sort((left, right) => compareUtf16(left.id, right.id));

  const created = [
    "tenet.yaml",
    "tenet.lock",
    ".tenet/manifest.json",
    ...(localKeys.length > 0 ? [".tenet/manifest.local.json"] : []),
    ...hostPlan.created,
  ];
  if (options.vendor) {
    const kitRoot = environment.kitPath ?? path.resolve(fileURLToPath(new URL("../../kit/", import.meta.url)));
    for (const relative of await listKitFiles(kitRoot)) created.push(`.tenet/kit/${relative}`);
  }
  const blocks: PlannedBlock[] = [
    { path: ".gitignore", kind: "yaml" },
    { path: ".gitattributes", kind: "yaml" },
    ...hostPlan.blocks,
  ];
  if (forge === "github") {
    created.push(".github/workflows/tenet.yml");
    blocks.push({ path: await pullRequestTemplatePath(cwd), kind: "markdown" });
    if (ciMode === "tenet-workflow") created.push(".github/workflows/tenet-tests.yml");
    if (ciMode === "existing-ci" && selected) blocks.push({ path: selected.workflow, kind: "yaml" });
  }
  if (isEmpty) created.push("tenet/intent.md");
  const plan: InitPlan = {
    created: uniqueStrings(created),
    blocks: sortedBlocks(blocks),
    keys: sortedKeys(hostPlan.keys),
    local_keys: localKeys,
    hosts,
    ci_mode: ciMode,
    ci_reason: ciReason,
  };
  const owners = await discoverOwners(cwd, gitFacts.userName, options.yes === true);
  const findings: InstallFinding[] = [];
  if (!runner || runner.report === "none") {
    findings.push({ kind: "no-test-report", path: "tenet.yaml", message: noReportFinding });
  }
  findings.sort((left, right) =>
    compareUtf16(left.path, right.path) || compareUtf16(left.kind, right.kind) || compareUtf16(left.message, right.message));
  return {
    plan,
    findings,
    diagnostics: [],
    prompts,
    facts: {
      repository: {
        cwd,
        git: true,
        head: gitFacts.head,
        branch: gitFacts.branch,
        default_branch: gitFacts.defaultBranch,
        remote: gitFacts.remote,
        forge,
        empty: isEmpty,
      },
      runner,
      ci: { jobs, selected },
      owners,
      purpose,
      kind,
    },
  };
}

export const preflightInit = preflight;
