// Runs one command in its own process group with a minimal environment (TS §9.3). Never uses a shell or npx.
// The group id and start time are written to run.json at once so a crashed kernel's orphan can be found and stopped.
import { spawn } from "node:child_process";
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { createServer } from "node:net";
import { delimiter, dirname, join, resolve, sep } from "node:path";
import type { Clock, RunResult, RunSpec, Runner } from "../ports/types.ts";
import type { EnvelopePlanInput } from "../ports/types.ts";
import { makeExecutionEnvelope, type EnvelopeCommand } from "../core/execution-envelope.ts";
import type { StaticTool } from "../ports/types.ts";
import { procStart } from "./proc.ts";

const MAX_OUTPUT = 10 * 1024 * 1024;
/** Only these variables reach a check; anything secret-shaped is absent by construction (never passed, TS §8.8). */
const PASS = ["PATH", "HOME", "LANG", "LC_ALL", "USER", "SHELL"];

function checkEnv(from: Record<string, string | undefined>, runDir: string): Record<string, string> {
  const env: Record<string, string> = { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0", TERM: "dumb", TMPDIR: join(runDir, "tmp") };
  for (const k of PASS) if (from[k] !== undefined) env[k] = from[k]!;
  return env;
}

const killGroup = (pid: number, sig: NodeJS.Signals) => { try { process.kill(-pid, sig); } catch { /* group already gone */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function writeRecord(runDir: string, record: object): void {
  const target = join(runDir, "run.json");
  try { if (lstatSync(target).isSymbolicLink()) throw new Error("linked process record"); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
  const temp = join(runDir, `run-${randomUUID()}.tmp`);
  const fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { fchmodSync(fd, 0o600); writeFileSync(fd, JSON.stringify(record)); fsyncSync(fd); }
  finally { closeSync(fd); }
  try { renameSync(temp, target); } finally { rmSync(temp, { force: true }); }
}

/** Read only a fresh regular report inside this run, with a bounded allocation even if another writer grows it. */
function reportFrom(path: string, runDir: string, started: number): string | null {
  let fd = -1;
  try {
    if (!lstatSync(path).isFile()) return null;
    const root = realpathSync(runDir), file = realpathSync(path);
    if (!file.startsWith(root + sep)) return null;
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > MAX_OUTPUT || st.mtimeMs < started) return null;
    const buf = Buffer.alloc(st.size + 1);
    let count = 0;
    while (count < buf.length) {
      const size = readSync(fd, buf, count, buf.length - count, count);
      if (!size) break;
      count += size;
    }
    const after = fstatSync(fd);
    if (count !== st.size || after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) return null;
    const content = buf.subarray(0, count);
    return isUtf8(content) ? content.toString("utf8") : null;
  } catch { return null; }
  finally { if (fd >= 0) closeSync(fd); }
}

export class ProcessRunner implements Runner {
  private clock: Clock;
  private env: Record<string, string | undefined>;
  private admissions = new Map<string, (spawn: () => Promise<RunResult>) => Promise<RunResult>>();
  constructor(clock: Clock, env: Record<string, string | undefined>) { this.clock = clock; this.env = env; }
  guardRun(runDir: string, admit: (spawn: () => Promise<RunResult>) => Promise<RunResult>): void { this.admissions.set(resolve(runDir), admit); }

  environmentNames(extra: Record<string, string> = {}): { passed: string[]; dropped: string[] } {
    const passed = new Set([
      "CI", "NO_COLOR", "FORCE_COLOR", "TERM", "TMPDIR", "PATH", ...PASS.filter((key) => this.env[key] !== undefined), ...Object.keys(extra),
    ]);
    const overridden = new Set(Object.keys(extra));
    return {
      passed: [...passed].sort(),
      dropped: Object.keys(this.env).filter((key) => !PASS.includes(key) && !overridden.has(key)).sort(),
    };
  }

  planEnvelope(input: EnvelopePlanInput) {
    const runDir = "<runDir>";
    const commands: EnvelopeCommand[] = [];
    const relative = (value: string) => {
      if (value === input.root) return ".";
      return value.startsWith(`${input.root}${sep}`) ? `.${value.slice(input.root.length)}` : value;
    };
    const add = (kind: EnvelopeCommand["kind"], argv: string[], extra: Record<string, string>, outputs: string[]) => {
      commands.push({
        kind, argv: argv.map(relative), cwd: ".", environment: this.environmentNames(extra), outputs: outputs.map(relative),
      });
    };
    if (input.toExecute === "all" || input.toExecute.length) {
      const report = join(runDir, "vitest.json");
      add("tests", input.stack.argv(input.toExecute, report), {}, [report]);
    }
    for (const ob of input.obligations.filter((item) => item.kind === "static" && item.tool !== "playwright")) {
      const tool = ob.tool as StaticTool, report = join(runDir, `${tool}.json`);
      const argv = input.stack.staticArgv(input.root, tool, report);
      if (argv) add("static", argv, {}, [report]);
    }
    if (input.obligations.some((item) => item.tool === "playwright")) {
      const report = join(runDir, "playwright.json"), argv = input.stack.e2eArgv(input.root, report);
      if (argv) add("e2e", argv, {
        PORT: "<allocated-port>", DATABASE_URL: join(runDir, "e2e.db"), TENET_RUN_TOKEN: "<generated>",
        PLAYWRIGHT_JSON_OUTPUT_NAME: report,
      }, [report, join(runDir, "e2e.db")]);
    }
    return makeExecutionEnvelope(input.projectId, commands);
  }

  /** Bind 0 on 127.0.0.1, read the assigned port, release it (EVD-13, TS §9.3 Servers). A real socket, not a guess. */
  allocatePort(): Promise<number> {
    return new Promise((resolvePort, reject) => {
      const srv = createServer();
      srv.on("error", reject);
      srv.listen(0, "127.0.0.1", () => {
        const addr = srv.address();
        srv.close(() => (addr && typeof addr === "object" ? resolvePort(addr.port) : reject(new Error("no port assigned"))));
      });
    });
  }

  async run(spec: RunSpec): Promise<RunResult> {
    const dir = resolve(spec.runDir);
    const scope = [...this.admissions.keys()].filter(p => dir === p || dir.startsWith(p + sep)).sort((a, b) => b.length - a.length)[0];
    return scope ? this.admissions.get(scope)!(() => this.execute(spec)) : this.execute(spec);
  }

  private async execute(spec: RunSpec): Promise<RunResult> {
    mkdirSync(join(spec.runDir, "tmp"), { recursive: true, mode: 0o700 });
    const env = { ...checkEnv(this.env, spec.runDir), ...spec.env };
    env.PATH = [...new Set([dirname(process.execPath), join(spec.cwd, "node_modules", ".bin"),
      ...(env.PATH ?? "").split(delimiter).filter(Boolean)])].join(delimiter);
    const started = this.clock.ms();
    const startedAt = this.clock.now();
    // Replace the prepared sentinel before spawn. A crash here is uncertain, never "not started".
    writeRecord(spec.runDir, { starting: true });
    return new Promise<RunResult>((resolve) => {
      const [cmd, ...args] = spec.argv;
      const child = spawn(cmd!, args, { cwd: spec.cwd, env, detached: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "", timedOut = false, done = false;
      const sizes = { stdout: 0, stderr: 0 };
      const decoders = { stdout: new TextDecoder("utf-8", { fatal: true }), stderr: new TextDecoder("utf-8", { fatal: true }) };
      let outputTruncated = false;
      const cap = (cur: string, chunk: Buffer, stream: keyof typeof sizes) => {
        const left = Math.max(0, MAX_OUTPUT - sizes[stream]);
        sizes[stream] += chunk.length;
        if (chunk.length > left) outputTruncated = true;
        try { return cur + decoders[stream].decode(chunk.subarray(0, left), { stream: true }); }
        catch { outputTruncated = true; return cur; }
      };
      child.stdout.on("data", (c: Buffer) => { stdout = cap(stdout, c, "stdout"); });
      child.stderr.on("data", (c: Buffer) => { stderr = cap(stderr, c, "stderr"); });
      // Told to stop (the host cancelled, the terminal closed): take the check's whole process group down first.
      const onSignal = (sig: NodeJS.Signals) => { if (child.pid) killGroup(child.pid, "SIGKILL"); process.exit(128 + (sig === "SIGINT" ? 2 : sig === "SIGHUP" ? 1 : 15)); };
      const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
      for (const sig of signals) process.on(sig, onSignal);
      const timer = setTimeout(async () => {
        timedOut = true;
        if (child.pid) { killGroup(child.pid, "SIGTERM"); await sleep(1500); if (!done) killGroup(child.pid, "SIGKILL"); }
      }, spec.timeoutMs);
      const finish = (exit: number | null, signal: NodeJS.Signals | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        for (const sig of signals) process.off(sig, onSignal);
        if (child.pid) killGroup(child.pid, "SIGKILL"); // the whole tree dies with the check, not just the leader
        let report: string | null = null;
        if (spec.report) report = reportFrom(spec.report, spec.runDir, started);
        try { stdout += decoders.stdout.decode(); stderr += decoders.stderr.decode(); } catch { outputTruncated = true; }
        const r: RunResult = { timedOut, outputTruncated, durationMs: this.clock.ms() - started, stdout, stderr, startedAt, report };
        if (exit !== null) r.exit = exit;
        if (signal) r.signal = signal;
        if (child.pid) r.pid = child.pid;
        resolve(r);
      };
      child.on("error", (e) => { stderr += String(e); finish(null, null); });
      child.on("close", finish);
      if (child.pid) {
        try { writeRecord(spec.runDir, { pid: child.pid, procStart: procStart(child.pid), startedAt }); }
        catch (e) { stderr += `could not record process identity: ${String(e)}`; killGroup(child.pid, "SIGKILL"); }
      }
    });
  }

  async stopRun(runDir: string): Promise<"stopped" | "gone" | "unknown"> {
    let rec: { pid: number; procStart: string | null };
    let fd = -1;
    try {
      fd = openSync(join(runDir, "run.json"), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const st = fstatSync(fd);
      if (!st.isFile() || st.size > 64 * 1024) return "unknown";
      const buffer = Buffer.alloc(st.size + 1);
      let count = 0;
      while (count < buffer.length) {
        const size = readSync(fd, buffer, count, buffer.length - count, count);
        if (!size) break;
        count += size;
      }
      const after = fstatSync(fd);
      if (count !== st.size || after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs) return "unknown";
      const content = buffer.subarray(0, count);
      if (!isUtf8(content)) return "unknown";
      rec = JSON.parse(content.toString("utf8"));
      if (Object.keys(rec).length === 1 && (rec as unknown as { prepared?: boolean }).prepared === true) return "gone";
      if (!rec || !Number.isSafeInteger(rec.pid) || rec.pid <= 1 || typeof rec.procStart !== "string" || !rec.procStart.trim()) return "unknown";
    } catch { return "unknown"; }
    finally { if (fd >= 0) closeSync(fd); }
    // The leader may be gone while grandchildren live on: the group id outlives it, so it is signalled either way,
    // but only when the recorded leader is dead or still has the recorded identity (never a recycled pid).
    const now = procStart(rec.pid);
    if (now === null) {
      try { process.kill(rec.pid, 0); return "unknown"; } // alive but identity inspection failed
      catch (e) { if ((e as NodeJS.ErrnoException).code !== "ESRCH") return "unknown"; }
    }
    if (now !== null && now !== rec.procStart) return "gone";
    try { process.kill(-rec.pid, 0); } catch { return "gone"; }
    killGroup(rec.pid, "SIGTERM");
    await sleep(300);
    killGroup(rec.pid, "SIGKILL");
    return "stopped";
  }
}
