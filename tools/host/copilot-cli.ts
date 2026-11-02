// Runs the Copilot CLI headlessly against a fixture and records what happened (SP-11 feasibility, harness-eval.md HE-03).
// An observation states the tuple, the arguments, the exit, the time and where the raw transcript is. It carries no verdict:
// a test decides from evidence the kernel wrote itself, never from what the model says it did. Live runs spend credits, so
// each needs a run budget (TENET_HOST_RUNS) and is counted in a ledger; with none left the run is refused, not skipped.
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { join } from "node:path";
import { StringDecoder } from "node:string_decoder";

export interface HostRun {
  id: string; prompt: string; cwd: string; pluginDir?: string; model?: string; timeoutMs: number; extraArgs?: string[];
  /** An empty configuration directory (COPILOT_HOME), so the owner's other plugins and MCP servers do not load. */
  home?: string;
  /** Kills the run (whole process group) at the first output line this returns true for, to model a cancelled child. */
  stopWhen?: (line: string) => boolean;
}
export interface Observation {
  id: string; at: string; tuple: Record<string, string>; argv: string[]; exit: number | null; signal: string | null;
  timedOut: boolean; stopped: boolean; durationMs: number; transcript: string; bytes: number; summary: Summary;
}
/** What a headless transcript shows, from its event stream (shapes observed on Copilot CLI 1.0.104, HC-01). */
export interface Summary {
  skills: string[]; subagents: Array<{ name: string; tools: string[] }>; tools: Record<string, number>;
  denied: number; premiumRequests: number | null; model: string | null; finalExit: number | null;
}
export function summarize(jsonl: string): Summary {
  const out: Summary = { skills: [], subagents: [], tools: {}, denied: 0, premiumRequests: null, model: null, finalExit: null };
  for (const line of jsonl.split("\n")) {
    let e: { type?: string; data?: Record<string, any>; exitCode?: number; usage?: { premiumRequests?: number } };
    try { e = JSON.parse(line); } catch { continue; }
    const d = e.data ?? {};
    if (e.type === "tool.execution_start") {
      out.tools[d.toolName] = (out.tools[d.toolName] ?? 0) + 1;
      if (d.toolName === "skill" && d.arguments?.skill) out.skills.push(String(d.arguments.skill));
    } else if (e.type === "tool.execution_complete" && d.error?.code === "denied") out.denied++;
    else if (e.type === "subagent.selected") out.subagents.push({ name: String(d.agentName), tools: d.tools ?? [] });
    else if (e.type === "assistant.message" && d.model) out.model = String(d.model);
    else if (e.type === "result") { out.finalExit = e.exitCode ?? null; out.premiumRequests = e.usage?.premiumRequests ?? null; }
  }
  return out;
}

export interface HostOptions { bin?: string; outDir: string; env?: NodeJS.ProcessEnv }

function killOwned(child: ChildProcess) {
  if (!child.pid) return;
  if (platform() === "win32") { child.kill("SIGKILL"); return; }
  try { process.kill(-child.pid, "SIGKILL"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
    child.kill("SIGKILL");
  }
}

async function versionOf(bin: string, args: string[], deadline: number): Promise<string> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return "unavailable (deadline exhausted)";
  const child = spawn(bin, args, { detached: true, stdio: ["ignore", "pipe", "pipe"] });
  const stdout: Buffer[] = [], stderr: Buffer[] = [];
  let unavailable: string | undefined;
  const capture = (chunks: Buffer[]) => {
    let bytes = 0;
    return (chunk: Buffer) => {
      if (unavailable) return;
      bytes += chunk.length;
      if (bytes > 1024 * 1024) { unavailable = "output limit"; killOwned(child); }
      else chunks.push(chunk);
    };
  };
  child.stdout.on("data", capture(stdout)); child.stderr.on("data", capture(stderr));
  const timer = setTimeout(() => { unavailable = "timeout"; killOwned(child); }, remaining);
  child.once("exit", () => killOwned(child));
  child.once("error", (error: NodeJS.ErrnoException) => { unavailable = error.code ?? "spawn error"; });
  return new Promise(resolve => child.once("close", exit => {
    clearTimeout(timer);
    resolve(unavailable ? `unavailable (${unavailable})` : exit === 0
      ? `${Buffer.concat(stdout).toString("utf8")}${Buffer.concat(stderr).toString("utf8")}`.trim().split("\n")[0]!.slice(0, 80)
      : "unavailable");
  }));
}

/** Counts a live run against the budget in the ledger; refuses when none is left (never silently skips). */
export function reserveRun(outDir: string, budget: number): number {
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error("invalid host run budget: expected a positive safe integer");
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, "ledger.json");
  let used = 0;
  let raw: string | undefined;
  try { raw = readFileSync(file, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw new Error("invalid host run ledger: cannot read usage", { cause: error });
  }
  if (raw !== undefined) {
    let count: unknown;
    try { count = JSON.parse(raw)?.used; } catch (error) {
      throw new Error("invalid host run ledger: cannot parse usage", { cause: error });
    }
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) throw new Error("invalid host run ledger: expected nonnegative safe-integer usage");
    used = count;
  }
  if (used >= budget) throw new Error(`host run budget spent (${used} of ${budget}); raise TENET_HOST_RUNS only with the owner's authorization`);
  writeFileSync(file, JSON.stringify({ used: used + 1 }));
  return used + 1;
}

export function argvFor(run: HostRun, logDir: string): string[] {
  return [
    "-p", run.prompt, "--allow-all-tools", "--output-format", "json", "--log-dir", logDir, "--disable-client-telemetry",
    ...(run.pluginDir ? ["--plugin-dir", run.pluginDir, "--add-dir", run.pluginDir] : []),
    ...(run.model ? ["--model", run.model] : []), ...(run.extraArgs ?? []),
  ];
}

export async function runCopilot(run: HostRun, opts: HostOptions): Promise<Observation> {
  const bin = opts.bin ?? "copilot";
  const dir = join(opts.outDir, run.id);
  mkdirSync(dir, { recursive: true });
  const argv = argvFor(run, join(dir, "logs"));
  const transcript = join(dir, "transcript.jsonl");
  const started = Date.now();
  const child = spawn(bin, argv, { cwd: run.cwd, env: { ...process.env, ...(run.home ? { COPILOT_HOME: run.home } : {}), ...opts.env }, stdio: ["ignore", "pipe", "pipe"], detached: true });
  const chunks: Buffer[] = [];
  const decoder = new StringDecoder("utf8");
  let stopped = false, partial = "";
  const kill = () => killOwned(child);
  child.stdout.on("data", (c: Buffer) => {
    chunks.push(c);
    if (!run.stopWhen || stopped) return;
    const lines = (partial + decoder.write(c)).split("\n");
    partial = lines.pop() ?? "";
    if (lines.some(run.stopWhen)) { stopped = true; kill(); }
  });
  child.stderr.on("data", (c: Buffer) => chunks.push(c));
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; kill(); }, run.timeoutMs);
  // A fork racing the first group signal can keep stdout open after its leader dies.
  let exitCleanup: NodeJS.Timeout | undefined;
  child.once("exit", () => {
    if (!stopped && !timedOut) return;
    exitCleanup = setTimeout(() => {
      if (!child.stdout?.destroyed || !child.stderr?.destroyed) kill();
    }, 10);
  });
  let end: { exit: number | null; signal: string | null };
  try {
    end = await new Promise<{ exit: number | null; signal: string | null }>((resolve, reject) => {
      child.on("close", (exit, signal) => {
        if (exitCleanup) clearTimeout(exitCleanup);
        resolve({ exit, signal });
      });
      child.on("error", reject);
    });
  } finally {
    clearTimeout(timer);
  }
  writeFileSync(transcript, Buffer.concat(chunks));
  const text = Buffer.concat(chunks).toString("utf8");
  const [copilot, git] = await Promise.all([
    versionOf(bin, ["--version"], started + run.timeoutMs),
    versionOf("git", ["--version"], started + run.timeoutMs),
  ]);
  const obs: Observation = {
    id: run.id, at: new Date().toISOString(), argv: argv.map((a) => (a === run.prompt ? "<prompt>" : a)),
    tuple: { ...(run.home ? { isolatedHome: "yes" } : {}), copilot, node: process.version, git, os: `${platform()} ${release()} ${arch()}`, ...(run.model ? { model: run.model } : {}) },
    exit: end.exit, signal: end.signal, timedOut, stopped, durationMs: Date.now() - started, transcript, bytes: statSync(transcript).size, summary: summarize(text),
  };
  writeFileSync(join(dir, "observation.json"), JSON.stringify(obs, null, 2));
  return obs;
}
