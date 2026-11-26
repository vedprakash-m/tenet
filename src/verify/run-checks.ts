import { spawn, spawnSync } from "node:child_process";
import { mkdir, readFile, lstat, writeFile } from "node:fs/promises";
import path from "node:path";
import { confine } from "../core/fs.js";
import { sha256 } from "../core/hash.js";
import type { Policy } from "../policy/index.js";
import {
  bundleLimit, parseBundledReport, safeEntry, writeBundle,
  type BundleData, type CheckEntry, type CommandRun, type ReportKind, type VerificationBundle, type VerifyDeps,
} from "./bundle.js";

type Production = {
  cwd: string;
  run: VerificationBundle["run"];
  tested: VerificationBundle["tested"];
  repository: string;
  pr?: number;
  proposed?: Policy["checks"];
  directory?: string;
  ci?: boolean;
  outcome?: "success" | "failure" | "cancelled" | "skipped";
  elapsed?: () => number;
};

const extensions: Record<ReportKind, string> = {
  junit: "xml", ctrf: "json", "go-test-json": "json", "jest-json": "json", none: "txt",
};

export function executeCommand(
  command: string,
  options: { cwd: string; timeoutMs: number; ci: boolean },
): Promise<CommandRun> {
  const bash = options.ci || process.platform !== "win32" || spawnSync("bash", ["--version"], { stdio: "ignore" }).status === 0;
  const program = bash ? "bash" : process.env.ComSpec ?? "cmd.exe";
  const args = bash ? ["-eo", "pipefail", "-c", command] : ["/d", "/s", "/c", `"${command}"`];
  return new Promise((resolve, reject) => {
    const detached = process.platform !== "win32";
    const child = spawn(program, args, {
      cwd: options.cwd,
      detached,
      stdio: ["ignore", "pipe", "inherit"],
      windowsHide: true,
      ...(bash ? {} : { windowsVerbatimArguments: true }),
    });
    const chunks: Buffer[] = [];
    let size = 0;
    let timedOut = false;
    let oversized = false;
    function stop(): void {
      if (child.pid === undefined) return;
      if (detached) {
        try { process.kill(-child.pid, "SIGKILL"); } catch { child.kill(); }
      } else {
        spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
        child.kill();
      }
    }
    const timer = setTimeout(() => { timedOut = true; stop(); }, options.timeoutMs);
    child.stdout.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > bundleLimit) { oversized = true; stop(); }
      else chunks.push(chunk);
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (oversized) reject(new Error("check output exceeds 50 MB"));
      else resolve({ exitCode: code, stdout: Buffer.concat(chunks), timedOut });
    });
  });
}

async function produce(policy: Policy, options: Production, deps: VerifyDeps, execute: boolean): Promise<BundleData> {
  const directory = await confine(options.directory ?? "tenet-bundle", options.cwd);
  await mkdir(await confine(".tenet/reports", options.cwd), { recursive: true });
  const clock = options.elapsed ?? (() => performance.now());
  const checks = new Map(Object.entries(policy.checks ?? {}).map(([name, check]) => [name, { check, proposed: false }]));
  if (policy.level === "observe" || policy.level === "protect") {
    for (const [name, check] of Object.entries(options.proposed ?? {})) {
      if (!checks.has(name)) checks.set(name, { check, proposed: true });
    }
  }
  const entries: CheckEntry[] = [];
  const files = new Map<string, Buffer>();
  for (const [name, { check, proposed }] of checks) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name) || name === "." || name === "..") throw new Error("invalid check name");
    const kind = check.report;
    const ext = extensions[kind];
    const reportPath = await confine(check.report_path ?? `.tenet/reports/${name}.${ext}`, options.cwd);
    const start = clock();
    let outcome: string = options.outcome ?? "success";
    let exit: number | null = options.outcome === "success" ? 0 : options.outcome === "failure" ? 1 : null;
    let stdout: Buffer | undefined;
    if (execute) {
      const commands = [...(check.setup ?? []), check.run];
      const deadline = start + (check.timeout_minutes ?? 30) * 60_000;
      for (const [index, command] of commands.entries()) {
        const remaining = Math.floor(deadline - clock());
        if (remaining <= 0) { outcome = "timeout"; exit = null; break; }
        const result = await (deps.execute ?? executeCommand)(command, { cwd: options.cwd, timeoutMs: remaining, ci: options.ci ?? false });
        exit = result.exitCode;
        outcome = result.timedOut ? "timeout" : exit === 0 ? "success" : "failure";
        if (index === commands.length - 1) stdout = result.stdout;
        if (outcome !== "success") break;
      }
    }
    let report: Buffer | undefined;
    if (kind !== "none") {
      if (execute && check.report_from === "stdout" && stdout) {
        await mkdir(path.dirname(reportPath), { recursive: true });
        await writeFile(await confine(path.relative(options.cwd, reportPath), options.cwd), stdout);
      }
      try {
        const confined = await confine(path.relative(options.cwd, reportPath), options.cwd);
        const details = await lstat(confined);
        if (!details.isFile() || details.size > bundleLimit) throw new Error("invalid report file");
        report = await readFile(confined);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      if (!report && outcome !== "timeout") outcome = "report-missing";
      if (report && outcome !== "timeout") {
        try {
          const parsed = await parseBundledReport(kind, report, policy.specs.id_prefix);
          if (parsed.teardown_failed || parsed.cases.some((item) => item.status === "error" || item.status === "fail")) outcome = "failure";
        } catch {
          outcome = "report-malformed";
        }
      }
    }
    const entryPath = report === undefined ? "none" : safeEntry(`reports/${name}.${ext}`);
    if (report !== undefined) files.set(entryPath, report);
    entries.push({
      name, exit_code: exit, outcome, duration_ms: execute ? Math.max(0, Math.round(clock() - start)) : null,
      report: entryPath, report_sha256: sha256(report ?? Buffer.alloc(0)), inputs: check.inputs ?? [],
      "x-report-kind": kind, ...(proposed ? { "x-proposed": true } : {}),
    });
  }
  return writeBundle(directory, {
    schema_version: 1, run: options.run, ...(options.pr === undefined ? {} : { pr: options.pr }),
    tested: options.tested, checks: entries, "x-repository": options.repository,
  }, files);
}

export function runChecks(policy: Policy, options: Production, deps: VerifyDeps): Promise<BundleData> {
  return produce(policy, options, deps, true);
}

export function bundleExisting(policy: Policy, options: Production, deps: VerifyDeps): Promise<BundleData> {
  return produce(policy, options, deps, false);
}
export type { Production as RunChecksOptions };
