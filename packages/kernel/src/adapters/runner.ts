// Runs one command in its own process group with a minimal environment (TS §9.3). Never uses a shell or npx.
// The group id and start time are written to run.json at once so a crashed kernel's orphan can be found and stopped.
import { spawn } from "node:child_process";
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve, sep } from "node:path";
import type { Clock, RunResult, RunSpec, Runner } from "../ports/types.ts";
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
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > MAX_OUTPUT || st.mtimeMs < started) return null;
    const buf = Buffer.alloc(st.size + 1), n = readSync(fd, buf, 0, buf.length, 0);
    return n > st.size ? null : buf.subarray(0, n).toString("utf8");
  } catch { return null; }
  finally { if (fd >= 0) closeSync(fd); }
}

export class ProcessRunner implements Runner {
  private clock: Clock;
  private env: Record<string, string | undefined>;
  private admissions = new Map<string, (spawn: () => Promise<RunResult>) => Promise<RunResult>>();
  constructor(clock: Clock, env: Record<string, string | undefined>) { this.clock = clock; this.env = env; }
  guardRun(runDir: string, admit: (spawn: () => Promise<RunResult>) => Promise<RunResult>): void { this.admissions.set(resolve(runDir), admit); }

  async run(spec: RunSpec): Promise<RunResult> {
    const dir = resolve(spec.runDir);
    const scope = [...this.admissions.keys()].filter(p => dir === p || dir.startsWith(p + sep)).sort((a, b) => b.length - a.length)[0];
    return scope ? this.admissions.get(scope)!(() => this.execute(spec)) : this.execute(spec);
  }

  private async execute(spec: RunSpec): Promise<RunResult> {
    mkdirSync(join(spec.runDir, "tmp"), { recursive: true, mode: 0o700 });
    const started = this.clock.ms();
    const startedAt = this.clock.now();
    // Replace the prepared sentinel before spawn. A crash here is uncertain, never "not started".
    writeRecord(spec.runDir, { starting: true });
    return new Promise<RunResult>((resolve) => {
      const [cmd, ...args] = spec.argv;
      const child = spawn(cmd!, args, { cwd: spec.cwd, env: { ...checkEnv(this.env, spec.runDir), ...spec.env }, detached: true, stdio: ["ignore", "pipe", "pipe"] });
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
      fd = openSync(join(runDir, "run.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
      const st = fstatSync(fd);
      if (!st.isFile() || st.size > 64 * 1024) return "unknown";
      const buffer = Buffer.alloc(64 * 1024 + 1), n = readSync(fd, buffer, 0, buffer.length, 0);
      if (n > 64 * 1024) return "unknown";
      rec = JSON.parse(buffer.subarray(0, n).toString("utf8"));
      if (rec && Object.keys(rec).length === 1 && (rec as unknown as { prepared?: boolean }).prepared === true) return "gone";
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
