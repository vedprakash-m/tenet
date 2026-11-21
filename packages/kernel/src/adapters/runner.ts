// Runs one command in its own process group with a minimal environment (TS §9.3). Never uses a shell or npx.
// The group id and start time are written to run.json at once so a crashed kernel's orphan can be found and stopped.
import { execFileSync, spawn } from "node:child_process";
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { createServer } from "node:net";
import type { Writable } from "node:stream";
import { delimiter, dirname, join, resolve, sep } from "node:path";
import type { Clock, RunResult, RunSpec, Runner } from "../ports/types.ts";
import type { EnvelopePlanInput } from "../ports/types.ts";
import { makeExecutionEnvelope, type EnvelopeCommand } from "../core/execution-envelope.ts";
import type { StaticTool } from "../ports/types.ts";
import { procStart } from "./proc.ts";
import { KernelError } from "../core/errors.ts";

const MAX_OUTPUT = 10 * 1024 * 1024;
const MAX_STDIN = 50 * 1024 * 1024;
/** Only these variables reach a check; anything secret-shaped is absent by construction (never passed, TS §8.8). */
const PASS = ["PATH", "HOME", "LANG", "LC_ALL", "USER", "SHELL"];

function checkEnv(from: Record<string, string | undefined>, runDir: string): Record<string, string> {
  const env: Record<string, string> = { CI: "1", NO_COLOR: "1", FORCE_COLOR: "0", TERM: "dumb", TMPDIR: join(runDir, "tmp") };
  for (const k of PASS) if (from[k] !== undefined) env[k] = from[k]!;
  return env;
}

type SignalResult = "signalled" | "gone" | "unknown";
const killGroup = (pid: number, sig: NodeJS.Signals): SignalResult => {
  try { process.kill(-pid, sig); return "signalled"; }
  catch (error) { return (error as NodeJS.ErrnoException).code === "ESRCH" ? "gone" : "unknown"; }
};
const leaderState = (pid: number): string | null | undefined => {
  try {
    const state = execFileSync("ps", ["-o", "stat=", "-p", String(pid)],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return state || null;
  } catch {
    return undefined;
  }
};
const groupAlive = (pid: number): "alive" | "gone" | "unknown" => {
  try {
    process.kill(-pid, 0);
    const state = leaderState(pid);
    if (state === undefined || (state !== null && !state.startsWith("Z"))) return state === undefined ? "unknown" : "alive";
    try {
      const rows = execFileSync("ps", ["-A", "-o", "pgid=,stat="],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim().split("\n");
      const members = rows.map((row) => row.trim().match(/^(\d+)\s+(\S+)/))
        .filter((match): match is RegExpMatchArray => !!match && Number(match[1]) === pid);
      return members.length && members.some((match) => !match[2]!.startsWith("Z")) ? "alive" : "gone";
    } catch {
      return "unknown";
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") return "unknown";
    return "gone";
  }
};
const waitForGroup = async (pid: number, timeoutMs: number): Promise<"gone" | "alive" | "unknown"> => {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const state = groupAlive(pid);
    if (state !== "alive") return state;
    await sleep(50);
  }
  return "alive";
};

type RunIdentity = { pid: number; procStart: string; prepared?: boolean };
function readRunIdentity(runDir: string): RunIdentity | "gone" | "unknown" {
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
    if (count !== st.size || after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs)
      return "unknown";
    const bytes = buffer.subarray(0, count);
    if (!isUtf8(bytes)) return "unknown";
    const record = JSON.parse(bytes.toString("utf8")) as Partial<RunIdentity> | null;
    if (record && Object.keys(record).length === 1 && record.prepared === true) return "gone";
    if (!record || !Number.isSafeInteger(record.pid) || record.pid! <= 1 ||
      typeof record.procStart !== "string" || !record.procStart.trim()) return "unknown";
    return record as RunIdentity;
  } catch {
    return "unknown";
  } finally {
    if (fd >= 0) closeSync(fd);
  }
}

async function stopOwnedGroup(record: RunIdentity): Promise<"stopped" | "gone" | "unknown"> {
  const now = procStart(record.pid);
  if (now === null) {
    try { process.kill(record.pid, 0); return "unknown"; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ESRCH") return "unknown"; }
  }
  if (now !== null && now !== record.procStart) return "gone";
  const before = groupAlive(record.pid);
  if (before !== "alive") return before === "gone" ? "gone" : "unknown";
  const term = killGroup(record.pid, "SIGTERM");
  if (term !== "signalled") return term === "gone" ? "gone" : "unknown";
  const graceful = await waitForGroup(record.pid, 5000);
  if (graceful !== "alive") return graceful === "gone" ? "stopped" : "unknown";
  const forced = killGroup(record.pid, "SIGKILL");
  if (forced !== "signalled") return forced === "gone" ? "stopped" : "unknown";
  return await waitForGroup(record.pid, 1000) === "gone" ? "stopped" : "unknown";
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function writableEvent(stream: Writable, ready: "drain" | "finish"): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      stream.off(ready, onReady);
      stream.off("error", onError);
      stream.off("close", onClose);
    };
    const onReady = () => { cleanup(); resolve(); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const onClose = () => { cleanup(); reject(new Error("stdin closed before delivery")); };
    stream.once(ready, onReady);
    stream.once("error", onError);
    stream.once("close", onClose);
  });
}

async function deliverBoundedStdin(stream: Writable, bytes: Buffer, stopped: () => boolean): Promise<boolean> {
  const chunkSize = 64 * 1024;
  try {
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      if (stream.destroyed || stopped()) return false;
      if (!stream.write(bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))))
        await writableEvent(stream, "drain");
    }
    const finished = writableEvent(stream, "finish");
    stream.end();
    await finished;
    return true;
  } catch {
    return false;
  }
}

function captureOutput() {
  const sizes = { stdout: 0, stderr: 0 };
  const decoders = {
    stdout: new TextDecoder("utf-8", { fatal: true }),
    stderr: new TextDecoder("utf-8", { fatal: true }),
  };
  const current = { stdout: "", stderr: "" };
  let truncated = false;
  return {
    append(stream: "stdout" | "stderr", chunk: Buffer) {
      const left = Math.max(0, MAX_OUTPUT - sizes[stream]);
      sizes[stream] += chunk.length;
      if (chunk.length > left) truncated = true;
      try {
        current[stream] += decoders[stream].decode(chunk.subarray(0, left), { stream: true });
      } catch {
        truncated = true;
      }
    },
    finish() {
      try {
        current.stdout += decoders.stdout.decode();
        current.stderr += decoders.stderr.decode();
      } catch {
        truncated = true;
      }
      return { ...current, outputTruncated: truncated };
    },
  };
}

function terminationSignals(pid: number | undefined): () => void {
  const onSignal = (signal: NodeJS.Signals) => {
    if (pid) killGroup(pid, "SIGKILL");
    process.exit(128 + (signal === "SIGINT" ? 2 : signal === "SIGHUP" ? 1 : 15));
  };
  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM", "SIGHUP"];
  for (const signal of signals) process.on(signal, onSignal);
  return () => {
    for (const signal of signals) process.off(signal, onSignal);
  };
}

function optionalResult(
  exit: number | null,
  signal: NodeJS.Signals | null,
  pid: number | undefined,
): Partial<RunResult> {
  return {
    ...(exit !== null ? { exit } : {}),
    ...(signal ? { signal } : {}),
    ...(pid ? { pid } : {}),
  };
}

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
    const add = (
      kind: EnvelopeCommand["kind"], argv: string[], extra: Record<string, string>, outputs: string[],
      limits: { maxAttempts?: number; maxPortAttempts?: number } = {},
    ) => {
      commands.push({
        kind, argv: argv.map(relative), cwd: ".", environment: this.environmentNames(extra), outputs: outputs.map(relative),
        ...limits,
      });
    };
    if (input.toExecute === "all" || input.toExecute.length) {
      const report = join(runDir, "vitest.json");
      add("tests", input.stack.argv(input.toExecute, report), {}, [report], { maxAttempts: 3 });
    }
    for (const ob of input.obligations.filter((item) => item.kind === "static" && item.tool !== "playwright")) {
      const tool = ob.tool as StaticTool, report = join(runDir, `${tool}.json`);
      const argv = input.stack.staticArgv(input.root, tool, report);
      if (Array.isArray(argv)) add("static", argv, {}, [report]);
    }
    if (input.obligations.some((item) => item.tool === "playwright")) {
      const report = join(runDir, "playwright.json"), argv = input.stack.e2eArgv(input.root, report);
      if (argv)       add("e2e", argv, {
        PORT: "<allocated-port>", DATABASE_URL: join(runDir, "e2e.db"), TENET_RUN_TOKEN: "<generated>",
        PLAYWRIGHT_JSON_OUTPUT_NAME: report,
      }, [report, join(runDir, "e2e.db")], { maxAttempts: 3, maxPortAttempts: 3 });
    }
    for (const mapping of input.coverage ?? []) {
      const primaryReport = join(runDir, `coverage-${mapping.id}-primary-1.json`);
      const primary = input.stack.coverageArgv(input.root, mapping.primary, primaryReport);
      if (primary) add("tests", primary, {}, [primaryReport], { maxAttempts: 3 });
      const alternativeReport = join(runDir, `coverage-${mapping.id}-alternative-1.json`);
      const alternative = input.stack.coverageArgv(input.root, mapping.alternative, alternativeReport);
      if (alternative) {
        const database = join(runDir, `coverage-${mapping.id}-alternative-1.db`);
        add("e2e", alternative, {
          PORT: "<allocated-port>", DATABASE_URL: database, TENET_RUN_TOKEN: "<generated>",
          PLAYWRIGHT_JSON_OUTPUT_NAME: alternativeReport,
        }, [alternativeReport, database], { maxAttempts: 3, maxPortAttempts: 3 });
      }
    }
    if (input.workload?.build) add("workload", input.workload.build, {}, []);
    if (input.workload) add("workload", input.workload.run, {}, []);
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
    if (spec.stdin && spec.stdin.bytes.length > MAX_STDIN)
      throw new KernelError("capability-missing", "bounded stdin exceeds the 50 MiB blob limit", { exit: 2 });
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
      const child = spawn(cmd!, args, {
        cwd: spec.cwd,
        env,
        detached: true,
        stdio: [spec.stdin ? "pipe" : "ignore", "pipe", "pipe"],
      });
      let stderr = "", timedOut = false, done = false;
      let termSentAt: number | undefined;
      let stdinDelivery: RunResult["stdinDelivery"];
      let stdinSpawnFailed = false;
      const stream = child.stdin;
      const input = spec.stdin;
      const sending = input && stream
        ? deliverBoundedStdin(stream, input.bytes, () => timedOut || done).then(delivered => {
          stdinDelivery = delivered ? "delivered" : stdinSpawnFailed ? "spawn-failed" : "write-failed";
        })
        : Promise.resolve();
      if (input && !stream) stdinDelivery = "spawn-failed";
      const output = captureOutput();
      child.stdout!.on("data", (chunk: Buffer) => output.append("stdout", chunk));
      child.stderr!.on("data", (chunk: Buffer) => output.append("stderr", chunk));
      const removeSignals = terminationSignals(child.pid);
      const timer = setTimeout(async () => {
        timedOut = true;
        if (child.pid) {
          termSentAt = this.clock.ms();
          killGroup(child.pid, "SIGTERM");
          const gone = await waitForGroup(child.pid, 5000);
          if (!done && gone === "alive") killGroup(child.pid, "SIGKILL");
        }
      }, spec.timeoutMs);
      const finish = async (exit: number | null, signal: NodeJS.Signals | null) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        await sending;
        removeSignals();
        if (child.pid) {
          if (timedOut) {
            const remaining = Math.max(0, 5000 - (this.clock.ms() - (termSentAt ?? this.clock.ms())));
            const gone = await waitForGroup(child.pid, remaining);
            if (gone === "alive") killGroup(child.pid, "SIGKILL");
          } else killGroup(child.pid, "SIGKILL");
        }
        const captured = output.finish();
        const r: RunResult = {
          timedOut,
          outputTruncated: captured.outputTruncated,
          durationMs: this.clock.ms() - started,
          stdout: captured.stdout,
          stderr: captured.stderr + stderr,
          startedAt,
          report: spec.report ? reportFrom(spec.report, spec.runDir, started) : null,
          ...optionalResult(exit, signal, child.pid),
          ...(stdinDelivery ? { stdinDelivery } : {}),
        };
        resolve(r);
      };
      child.on("error", (e) => { stdinSpawnFailed = true; stdinDelivery = spec.stdin ? "spawn-failed" : undefined; stderr += String(e); finish(null, null); });
      child.on("close", finish);
      if (child.pid) {
        try { writeRecord(spec.runDir, { pid: child.pid, procStart: procStart(child.pid), startedAt }); }
        catch (e) { stderr += `could not record process identity: ${String(e)}`; killGroup(child.pid, "SIGKILL"); }
      }
    });
  }

  async stopRun(runDir: string): Promise<"stopped" | "gone" | "unknown"> {
    const record = readRunIdentity(runDir);
    return record === "gone" || record === "unknown" ? record : stopOwnedGroup(record);
  }
}
