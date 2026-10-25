// Runs the Copilot CLI headlessly against a fixture and records what happened (SP-11 feasibility, harness-eval.md HE-03).
// An observation states the tuple, the arguments, the exit, the time and where the raw transcript is. It carries no verdict:
// a test decides from evidence the kernel wrote itself, never from what the model says it did. Live runs spend credits, so
// each needs a run budget (TENET_HOST_RUNS) and is counted in a ledger; with none left the run is refused, not skipped.
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { arch, platform, release } from "node:os";
import { join } from "node:path";

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

const versionOf = (bin: string, args: string[]): string => {
  const r = spawnSync(bin, args, { encoding: "utf8" });
  return r.status === 0 ? `${r.stdout}${r.stderr}`.trim().split("\n")[0]!.slice(0, 80) : "unavailable";
};

/** Counts a live run against the budget in the ledger; refuses when none is left (never silently skips). */
export function reserveRun(outDir: string, budget: number): number {
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, "ledger.json");
  let used = 0;
  try { used = (JSON.parse(readFileSync(file, "utf8")) as { used: number }).used; } catch { /* first run */ }
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
  let stopped = false, partial = "";
  const kill = () => { try { process.kill(-child.pid!, "SIGKILL"); } catch { child.kill("SIGKILL"); } };
  child.stdout.on("data", (c: Buffer) => {
    chunks.push(c);
    if (!run.stopWhen || stopped) return;
    const lines = (partial + c.toString("utf8")).split("\n");
    partial = lines.pop() ?? "";
    if (lines.some(run.stopWhen)) { stopped = true; kill(); }
  });
  child.stderr.on("data", (c: Buffer) => chunks.push(c));
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; kill(); }, run.timeoutMs);
  const end = await new Promise<{ exit: number | null; signal: string | null }>((resolve) => {
    child.on("close", (exit, signal) => resolve({ exit, signal }));
    child.on("error", () => resolve({ exit: null, signal: null }));
  });
  clearTimeout(timer);
  writeFileSync(transcript, Buffer.concat(chunks));
  const text = Buffer.concat(chunks).toString("utf8");
  const obs: Observation = {
    id: run.id, at: new Date().toISOString(), argv: argv.map((a) => (a === run.prompt ? "<prompt>" : a)),
    tuple: { ...(run.home ? { isolatedHome: "yes" } : {}), copilot: versionOf(bin, ["--version"]), node: process.version, git: versionOf("git", ["--version"]), os: `${platform()} ${release()} ${arch()}`, ...(run.model ? { model: run.model } : {}) },
    exit: end.exit, signal: end.signal, timedOut, stopped, durationMs: Date.now() - started, transcript, bytes: statSync(transcript).size, summary: summarize(text),
  };
  writeFileSync(join(dir, "observation.json"), JSON.stringify(obs, null, 2));
  return obs;
}
