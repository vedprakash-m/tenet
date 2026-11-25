import { spawn } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import { message } from "../core/messages.js";
import { errorFinding, exitCodeFor, fail, type Finding } from "../core/output.js";
import { verifyLock as verifyPackageLock } from "../policy/index.js";
import { installedLocalIntegrity, installedPackageVersion, localIntegrityWarning } from "./integrity.js";
import type {
  DoctorCheck,
  DoctorDependencies,
  DoctorEvaluation,
  DoctorLockVerifier,
  DoctorOptions,
  DoctorResult,
  DoctorTool,
  PreflightEnvironment,
} from "./types.js";

const minimumVersions = {
  node: "22.0.0",
  git: "2.40.0",
  ssh: "8.9.0",
} as const;

function versionParts(value: string): number[] | null {
  const match = /(?:^|\s)(?:v|version\s+)?(\d+)\.(\d+)(?:\.(\d+))?/i.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3] ?? "0")];
}

function versionAtLeast(actual: string, required: string): boolean {
  const left = versionParts(actual);
  const right = versionParts(required);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

function cleanVersion(tool: DoctorTool, output: string): string | null {
  const patterns: Partial<Record<DoctorTool, RegExp>> = {
    node: /v?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/i,
    git: /git version\s+(\d+\.\d+(?:\.\d+)?(?:[^\s]*)?)/i,
    ssh: /OpenSSH(?:_for_Windows)?[ _-](\d+\.\d+(?:\.\d+)?(?:p\d+)?)/i,
    gh: /gh version\s+(\S+)/i,
  };
  const match = (patterns[tool] ?? /(\d+\.\d+(?:\.\d+)?)/).exec(output);
  return match?.[1] ?? null;
}

function displayVersion(tool: DoctorTool, output: string): string {
  return cleanVersion(tool, output) ?? output.trim();
}

function defaultRunner(tool: DoctorTool, args: string[], options: { cwd: string }): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(tool, args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      const text = `${Buffer.concat(stdout).toString("utf8")}${Buffer.concat(stderr).toString("utf8")}`.trim();
      if (code === 0) resolve(text);
      else reject(Object.assign(new Error(text || `${tool} exited with code ${String(code)}`), { code }));
    });
  });
}

function canonical(
  code: "TN-ENV-NODE" | "TN-ENV-GIT" | "TN-ENV-NOT-GIT",
  variables: Record<string, string>,
): Finding {
  const text = message(code, variables);
  return fail(code, text.message, text.fix);
}

function injectedTool(environment: PreflightEnvironment | undefined, tool: DoctorTool): string | null | undefined {
  return environment?.tools?.[tool];
}

async function toolOutput(
  tool: DoctorTool,
  args: string[],
  cwd: string,
  environment: PreflightEnvironment | undefined,
  dependencies: DoctorDependencies,
): Promise<string | null> {
  const injected = injectedTool(environment, tool);
  if (injected === null) return null;
  if (injected !== undefined) return injected;
  const runner = dependencies.runners?.[tool] ?? dependencies.runTool ?? defaultRunner;
  try {
    return await runner(tool, args, { cwd });
  } catch {
    return null;
  }
}

async function insideRepository(
  cwd: string,
  environment: PreflightEnvironment | undefined,
  dependencies: DoctorDependencies,
): Promise<boolean> {
  const state = environment?.git?.state;
  if (state === "not-a-repository" || state === "tool-unavailable") return false;
  if (state === "committed" || state === "unborn") return true;
  const runner = dependencies.runners?.git ?? dependencies.runTool ?? defaultRunner;
  try {
    return (await runner("git", ["rev-parse", "--is-inside-work-tree"], { cwd })).trim() === "true";
  } catch {
    return false;
  }
}

function gitOutput(environment: PreflightEnvironment | undefined, discovered: string | null): string | null {
  if (environment?.tools?.git === null || environment?.git?.state === "tool-unavailable") return null;
  const version = environment?.git?.version;
  return version !== undefined ? version : discovered;
}

function lockFinding(error: unknown): Finding {
  const found = errorFinding(error);
  if (found?.code === "TN-LOCK-MISSING") {
    return canonicalLock("TN-LOCK-MISSING");
  }
  if (found?.code === "TN-LOCK-INVALID") {
    const text = message("TN-LOCK-INVALID", { detail: found.message });
    return { ...found, ...text };
  }
  if (found?.code === "TN-LOCK-MISMATCH" &&
    found.message.startsWith("Vendored kit digest differs from tenet.lock")) {
    return { ...found, code: "TN-KIT-EDITED" };
  }
  if (found?.code === "TN-KIT-MISSING") {
    const kitPath = found.file ?? ".tenet/kit";
    const text = message("TN-KIT-MISSING", { path: kitPath });
    return { ...found, file: kitPath, ...text };
  }
  if (found?.code === "TN-KIT-INVALID") {
    const text = message("TN-KIT-INVALID", {
      path: found.file ?? ".tenet/kit",
      detail: found.message,
    });
    return { ...found, ...text };
  }
  if (found) return found;
  const detail = error instanceof Error ? error.message : String(error);
  const text = message("TN-LOCK-INVALID", { detail });
  return fail("TN-LOCK-INVALID", text.message, text.fix);
}

function canonicalLock(code: "TN-LOCK-MISSING"): Finding {
  const text = message(code, {});
  return fail(code, text.message, text.fix);
}

type LocalLockIntegrity = {
  matches: boolean;
  mismatchFinding: Finding | null;
  warning: string | null;
};

async function localLockIntegrity(
  cwd: string,
  compute: () => Promise<string>,
): Promise<LocalLockIntegrity | null> {
  try {
    const filename = path.join(cwd, "tenet.lock");
    const document = parseDocument(await readFile(filename, "utf8"), {
      merge: false,
      prettyErrors: true,
      uniqueKeys: true,
    });
    if (document.errors.length > 0) return null;
    const lock = document.toJS({ maxAliasCount: 100 }) as Record<string, unknown> | null;
    if (!lock || typeof lock !== "object") return null;
    if (lock["x-integrity-source"] !== "local") return null;
    const installedVersion = await installedPackageVersion();
    if (lock.version !== installedVersion) return null;
    const actual = await compute();
    if (actual === lock.integrity) {
      return {
        matches: true,
        mismatchFinding: null,
        warning: typeof lock.package === "string"
          ? localIntegrityWarning(lock.package, installedVersion)
          : null,
      };
    }
    const text = message("TN-LOCK-INVALID", {
      detail: "installed package integrity does not match the local integrity recorded in tenet.lock",
    });
    return {
      matches: false,
      mismatchFinding: {
        ...fail("TN-LOCK-INVALID", text.message, text.fix),
        file: "tenet.lock",
      },
      warning: null,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

type WorkflowConfiguration = {
  ci: boolean;
  testWorkflow: string | null;
};

async function workflowConfiguration(cwd: string): Promise<WorkflowConfiguration> {
  let source: string;
  try {
    source = await readFile(path.join(cwd, "tenet.yaml"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ci: false, testWorkflow: null };
    throw error;
  }
  const document = parseDocument(source, { merge: false, prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) return { ci: false, testWorkflow: null };
  const data = document.toJS({ maxAliasCount: 100 }) as { ci?: unknown } | null;
  if (!data || typeof data !== "object" || !data.ci || typeof data.ci !== "object") {
    return { ci: false, testWorkflow: null };
  }
  const ci = data.ci as Record<string, unknown>;
  return {
    ci: ci.mode !== "none",
    testWorkflow: typeof ci.test_workflow === "string"
      ? ci.test_workflow
      : ".github/workflows/tenet-tests.yml",
  };
}

async function workflowCheck(cwd: string): Promise<{
  check: DoctorCheck;
  finding: Finding | null;
  ci: boolean;
}> {
  const configuration = await workflowConfiguration(cwd);
  if (!configuration.ci) {
    return {
      check: { name: "workflows", ok: true, detail: "No workflows configured (ci_mode none)" },
      finding: null,
      ci: false,
    };
  }
  const required = [".github/workflows/tenet.yml", configuration.testWorkflow]
    .filter((value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index);
  for (const relative of required) {
    try {
      const info = await stat(path.resolve(cwd, ...relative.replaceAll("\\", "/").split("/")));
      if (!info.isFile()) throw Object.assign(new Error("not a file"), { code: "ENOENT" });
    } catch {
      const text = message("TN-KIT-MISSING", { path: relative });
      return {
        check: { name: "workflows", ok: false, detail: `missing workflow ${relative}` },
        finding: { ...fail("TN-KIT-MISSING", text.message, text.fix), file: relative },
        ci: true,
      };
    }
  }
  return {
    check: { name: "workflows", ok: true, detail: "configured workflows found" },
    finding: null,
    ci: true,
  };
}

function doctorDependencies(options: DoctorOptions, supplied: DoctorDependencies): DoctorDependencies {
  const platform = supplied.platform ?? options.platform ?? options.environment?.platform;
  return {
    ...(platform !== undefined ? { platform } : {}),
    ...(supplied.runTool || options.runTool ? { runTool: supplied.runTool ?? options.runTool } : {}),
    ...(supplied.runners || options.runners
      ? { runners: { ...(options.runners ?? {}), ...(supplied.runners ?? {}) } }
      : {}),
    ...(supplied.verifyLock || options.verifyLock
      ? { verifyLock: supplied.verifyLock ?? options.verifyLock }
      : {}),
  };
}

export async function doctorEvaluation(
  options: DoctorOptions = {},
  supplied: DoctorDependencies = {},
): Promise<DoctorEvaluation> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const environment = options.environment;
  const dependencies = doctorDependencies(options, supplied);
  const findings: Finding[] = [];

  const nodeRaw = await toolOutput("node", ["--version"], cwd, environment, dependencies);
  const nodeVersion = nodeRaw === null ? null : displayVersion("node", nodeRaw);
  const nodeOk = nodeVersion !== null && versionAtLeast(nodeVersion, minimumVersions.node);
  if (!nodeOk) {
    findings.push(canonical("TN-ENV-NODE", { found: nodeVersion ?? "not installed" }));
  }

  const discoveredGit = environment?.git?.state === "tool-unavailable"
    ? null
    : await toolOutput("git", ["--version"], cwd, environment, dependencies);
  const rawGit = gitOutput(environment, discoveredGit);
  const gitVersion = rawGit === null ? null : displayVersion("git", rawGit);
  let gitOk = gitVersion !== null && versionAtLeast(gitVersion, minimumVersions.git);
  if (!gitOk) findings.push(canonical("TN-ENV-GIT", { found: gitVersion ?? "not installed" }));
  if (gitOk && !(await insideRepository(cwd, environment, dependencies))) {
    gitOk = false;
    findings.push(canonical("TN-ENV-NOT-GIT", { path: cwd }));
  }

  const sshRaw = await toolOutput("ssh", ["-V"], cwd, environment, dependencies);
  const sshVersion = sshRaw === null ? null : displayVersion("ssh", sshRaw);
  const sshOk = sshVersion === null || versionAtLeast(sshVersion, minimumVersions.ssh);

  const ghRaw = await toolOutput("gh", ["--version"], cwd, environment, dependencies);
  const ghAvailable = ghRaw !== null;

  let lockOk = false;
  let lockDetail = "";
  let localWarning: string | null = null;
  const packageVerify: DoctorLockVerifier = dependencies.verifyLock ?? verifyPackageLock;
  try {
    const verified = await packageVerify({ cwd });
    lockOk = true;
    const relativeKit = path.relative(cwd, verified.path).replaceAll("\\", "/");
    lockDetail = relativeKit === ".tenet/kit"
      ? "vendored kit matches tenet.lock"
      : "tenet.lock and kit match";
    const localIntegrity = await localLockIntegrity(cwd, installedLocalIntegrity);
    if (localIntegrity?.matches === false && localIntegrity.mismatchFinding) {
      findings.push(localIntegrity.mismatchFinding);
      lockOk = false;
      lockDetail = localIntegrity.mismatchFinding.message;
    } else if (localIntegrity?.matches) {
      localWarning = localIntegrity.warning;
      lockDetail +=
        " (local integrity; CI treats it as advisory until the package is published and re-pinned with `tenet upgrade`)";
    }
  } catch (error) {
    const finding = lockFinding(error);
    findings.push(finding);
    lockDetail = finding.message;
  }

  const workflow = await workflowCheck(cwd);
  if (workflow.finding) findings.push(workflow.finding);

  const checks: DoctorCheck[] = [
    {
      name: "node",
      ok: nodeOk,
      detail: `Node.js ${nodeVersion ?? "not installed"}`,
    },
    {
      name: "git",
      ok: gitOk,
      detail: gitVersion === null
        ? "Git not installed"
        : gitOk
          ? `Git ${gitVersion}`
          : environment?.git?.state === "not-a-repository"
            ? "not a Git repository"
            : `Git ${gitVersion}`,
    },
    {
      name: "ssh",
      ok: sshOk,
      detail: sshVersion === null
        ? "OpenSSH not found (optional until assure)"
        : `OpenSSH ${sshVersion}`,
    },
    {
      name: "gh",
      ok: true,
      detail: ghAvailable ? `gh CLI ${displayVersion("gh", ghRaw)}` : "gh CLI not found (optional)",
    },
    { name: "lock", ok: lockOk, detail: lockDetail },
    workflow.check,
  ];

  const diagnosticExit = exitCodeFor(findings);
  return {
    checks,
    findings,
    notices: localWarning !== null && workflow.ci ? [localWarning] : [],
    exitCode: diagnosticExit === 3 ? 3 : checks.some((check) =>
      !check.ok && (check.name === "lock" || check.name === "workflows")) ? 1 :
      diagnosticExit === 1 ? 1 : 0,
  };
}

export async function doctor(options: DoctorOptions = {}, supplied: DoctorDependencies = {}): Promise<DoctorResult> {
  const { checks } = await doctorEvaluation(options, supplied);
  return { checks };
}
