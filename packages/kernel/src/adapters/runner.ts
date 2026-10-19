// Runs one command in its own process group with a minimal environment (TS §9.3). Never uses a shell or npx.
// The group id and start time are written to run.json at once so a crashed kernel's orphan can be found and stopped.
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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

export class ProcessRunner implements Runner {
  private clock: Clock;
  private env: Record<string, string | undefined>;
  constructor(clock: Clock, env: Record<string, string | undefined>) { this.clock = clock; this.env = env; }

  async run(spec: RunSpec): Promise<RunResult> {
    mkdirSync(join(spec.runDir, "tmp"), { recursive: true, mode: 0o700 });
    const started = this.clock.ms();
    const startedAt = this.clock.now();
    return new Promise<RunResult>((resolve) => {
      const [cmd, ...args] = spec.argv;
      const child = spawn(cmd!, args, { cwd: spec.cwd, env: checkEnv(this.env, spec.runDir), detached: true, stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "", stderr = "", timedOut = false, done = false;
      if (child.pid) writeFileSync(join(spec.runDir, "run.json"), JSON.stringify({ pid: child.pid, procStart: procStart(child.pid), startedAt }));
      const cap = (cur: string, chunk: Buffer) => (cur.length < MAX_OUTPUT ? cur + chunk.toString("utf8") : cur);
      child.stdout.on("data", (c: Buffer) => { stdout = cap(stdout, c); });
      child.stderr.on("data", (c: Buffer) => { stderr = cap(stderr, c); });
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
        if (spec.report) { try { report = readFileSync(spec.report, "utf8"); } catch { /* no report written */ } }
        const r: RunResult = { timedOut, durationMs: this.clock.ms() - started, stdout, stderr, startedAt, report };
        if (exit !== null) r.exit = exit;
        if (signal) r.signal = signal;
        if (child.pid) r.pid = child.pid;
        resolve(r);
      };
      child.on("error", (e) => { stderr += String(e); finish(null, null); });
      child.on("close", finish);
    });
  }

  async stopRun(runDir: string): Promise<"stopped" | "gone" | "unknown"> {
    let rec: { pid: number; procStart: string | null };
    try { rec = JSON.parse(readFileSync(join(runDir, "run.json"), "utf8")); } catch { return "unknown"; }
    // The leader may be gone while grandchildren live on: the group id outlives it, so it is signalled either way,
    // but only when the recorded leader is dead or still has the recorded identity (never a recycled pid).
    const now = procStart(rec.pid);
    if (now !== null && now !== rec.procStart) return "gone";
    try { process.kill(-rec.pid, 0); } catch { return "gone"; }
    killGroup(rec.pid, "SIGTERM");
    await sleep(300);
    killGroup(rec.pid, "SIGKILL");
    return "stopped";
  }
}
