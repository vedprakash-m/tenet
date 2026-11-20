// Benchmarks for the PRD §4.4.3 system budgets (NFR-01, AC-19) against the built kernel bundle:
//   node tools/bench.ts [--fixture small|large|long-history|all] [--bundle <path>] [--json] [--fsync-trace]
//   node tools/bench.ts fixture <name> <dir>      generate one reference fixture and stop
// Every row of the §4.4.3 table gets a status. A budget this tool cannot measure is listed as such with the reason; it
// is never given a number. The kernel refuses mutating verbs on win32, so there nothing is observable and the run
// reports `unobservable` for every measured row (exit 3). Exit 0: no measured row failed; 1: a row failed or was
// inconclusive; 2: usage. Exit 0 does not establish NFR-01 while any row is not measurable. Not part of CI.
// The warm row is judged on WARM_RUNS runs (Tech Spec 14.1). With --fsync-trace (Linux, passwordless sudo, bpftrace) the
// fsync system calls of each kernel process and its direct children are traced from outside the process; a run that misses
// the budget only because of fsyncs of STALL_THRESHOLD_MS or more is environment-invalid: reported, not judged.
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { cpus, platform as osPlatform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { FIXTURES, configureRepo, generateFixture, gitEnv, linkFixtureDependencies } from "./bench-fixtures.ts";
import type { FixtureName, FixtureSpec } from "./bench-fixtures.ts";
import { repositoryFixtureMetadataEnv } from "../packages/kernel/src/adapters/installed-metadata.ts";

export type Status = "pass" | "fail" | "inconclusive" | "not-measurable" | "unobservable" | "delegated";
export interface Row { id: string; prd: string; target: string; status: Status; fixture?: string; observed?: string; detail: string; stallThresholdMs?: number; trace?: Trace; runs?: WarmRun[] }
/** `fsyncMs`: durations of the traced fsyncs attributed to this call; absent when not traced. */
export interface Call { label: string; ms: number; exit: number | null; reason?: string; pid?: number; fsyncMs?: number[] }
export type Trace = "ok" | "missing" | "off";
export interface FsyncStats { count: number; totalMs: number; p50Ms: number; p99Ms: number; maxMs: number; stalls: number; excessMs: number }
export interface WarmRun { run: number; class: "pass" | "fail" | "inconclusive" | "environment-invalid"; trace: Trace; n: number; p95Ms: number; adjustedP95Ms: number; maxMs: number; fsync?: FsyncStats; observed?: string; detail?: string }
export interface TraceEvent { pid: number; ppid: number; durMs: number }

/** Tech Spec 14.1; a test keeps these equal to its text. */
export const STALL_THRESHOLD_MS = 20, WARM_RUNS = 5, MAX_INVALID_RUNS = 2;

/** `prd` is the start of the §4.4.3 row's first column; tests compare these against the PRD table. */
export const BUDGETS: Array<{ id: string; prd: string; target: string; fixed?: { status: Status; detail: string } }> = [
  { id: "always-loaded", prd: "Always-loaded Tenet context", target: "<= 2,000 tokens", fixed: { status: "delegated", detail: "Deterministic; tools/lint-skills.ts checks it on every CI run, so it is not re-measured here." } },
  { id: "coordinator", prd: "Coordinator agent instructions", target: "<= 1,000 tokens", fixed: { status: "delegated", detail: "Deterministic; tools/lint-skills.ts." } },
  { id: "single-skill", prd: "Single skill loaded on demand", target: "<= 5,000 tokens", fixed: { status: "delegated", detail: "Deterministic; tools/lint-skills.ts." } },
  { id: "assignment-peak", prd: "Peak Tenet-injected context per assignment", target: "<= 20,000 tokens", fixed: { status: "not-measurable", detail: "Observed budget: it needs real assignments on a host and a calibrated estimator (SP-02). No fixture here produces one." } },
  { id: "bookkeeping-warm", prd: "Kernel bookkeeping call latency", target: "p95 <= 300 ms warm", },
  { id: "bookkeeping-cold", prd: "Kernel bookkeeping call latency", target: "p95 <= 1 s cold" },
  { id: "call-timeout", prd: "Kernel bookkeeping call latency", target: "5 s timeout with a defined outcome", fixed: { status: "not-measurable", detail: "No whole-call timeout exists in packages/kernel/src: only the lock wait (kernel-busy) and the stdin body deadline are bounded." } },
  { id: "check-execution", prd: "Check execution", target: "obligation timeout; expiry is inconclusive", fixed: { status: "delegated", detail: "Deterministic and bounded by each obligation's declared timeout; covered by runner tests, not benchmarked." } },
  { id: "repository-map", prd: "Repository map for", target: "<= 30 s for <= 10,000 files", fixed: { status: "not-measurable", detail: "Not built: the host's language services are the repository map (tech-spec 8.7). Tenet has no component to time. Inventory latency at 10,000 files is bench-inventory.ts, a different thing." } },
  { id: "tenet-storage", prd: "`.tenet/` storage", target: "<= 50 MB", },
  { id: "tenet-eviction", prd: "`.tenet/` storage", target: "managed by 5.15", fixed: { status: "not-measurable", detail: "Aggregate eviction is not built (storage-retention is partial), so growth beyond the sizes observed here is not shown." } },
  { id: "resume", prd: "Resume reconstruction", target: "<= 2 min" },
];

const MB = 1024 * 1024;
export const percentile = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil((p / 100) * xs.length) - 1)]!;

/** A latency row: every call must have ended in an allowed exit, otherwise the number says nothing about the budget. */
export function judgeLatency(calls: Call[], expect: number[], limitMs: number, percentileOf = 95): { status: Status; observed: string; detail: string } {
  const bad = calls.find((c) => c.exit === null || !expect.includes(c.exit));
  if (!calls.length) return { status: "inconclusive", observed: "no samples", detail: "No call ran." };
  if (bad) return { status: "inconclusive", observed: `${bad.label} exited ${bad.exit}`, detail: `A call ended outside its expected exit ${expect.join("/")}${bad.reason ? ` (${bad.reason})` : ""}; its time is not a bookkeeping time.` };
  const value = percentile(calls.map((c) => c.ms), percentileOf);
  return { status: value <= limitMs ? "pass" : "fail", observed: `p${percentileOf} ${value.toFixed(0)} ms, max ${Math.max(...calls.map((c) => c.ms)).toFixed(0)} ms, n=${calls.length}`, detail: "" };
}

const CHECKED_WORKSPACE = join(import.meta.dirname, "..");
const kernelEnv = (): NodeJS.ProcessEnv => {
  const env = repositoryFixtureMetadataEnv(CHECKED_WORKSPACE, gitEnv());
  delete env.NODE_OPTIONS;
  return env as NodeJS.ProcessEnv;
};

/** One kernel process, timed as the host would see it: spawn, Node start and the call itself. */
export function callKernel(bundle: string, cwd: string, label: string, argv: string[], body?: object): Call & { response?: { handle?: string } } {
  const t = performance.now();
  const r = spawnSync(process.execPath, [bundle, ...argv], { cwd, env: kernelEnv(), input: body ? JSON.stringify(body) : "", encoding: "utf8", timeout: 120_000, maxBuffer: 1 << 26 });
  const ms = performance.now() - t, at = { pid: r.pid };
  try {
    const response = JSON.parse(r.stdout) as { exit: number; handle?: string; reasons?: Array<{ code: string }> };
    return { label, ms, exit: response.exit, reason: response.reasons?.[0]?.code, response, ...at };
  } catch { return { label, ms, exit: null, reason: (r.stderr || "no JSON on stdout").slice(0, 80), ...at }; }
}

const r1 = (x: number): number => Math.round(x * 10) / 10;
const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

/** bpftrace lines "pid ppid duration-ns". Other lines (the attach message, maps printed at exit) are ignored. */
export function parseTrace(text: string): TraceEvent[] {
  return text.split(/\r?\n/).map((l) => /^(\d+) (\d+) (\d+)$/.exec(l.trim())).filter((m) => m !== null)
    .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), durMs: Number(m[3]) / 1e6 }));
}

/** True while each call's process ID is higher than the one before: Linux hands out IDs in increasing order until they
 *  wrap at pid_max, so increasing IDs mean no ID named two processes during these calls. */
export const pidsIncrease = (calls: Call[]): boolean => calls.every((c, i) => i === 0 || (c.pid ?? 0) > (calls[i - 1]!.pid ?? 0));

/** An fsync belongs to a call when the call's process or a direct child of it made it. If the IDs wrapped, a PID may name
 *  two processes, so nothing is attributed and the run's trace counts as missing. */
export function attributeFsyncs(calls: Call[], events: TraceEvent[]): Call[] {
  if (!pidsIncrease(calls)) return calls.map(({ fsyncMs: _, ...c }) => c);
  return calls.map((c) => ({ ...c, fsyncMs: c.pid === undefined ? [] : events.filter((e) => e.pid === c.pid || e.ppid === c.pid).map((e) => e.durMs) }));
}

const mutating = (c: Call): boolean => /^(open|decide|stop)\b/.test(c.label);

/** One warm run (Tech Spec 14.1). Removing only f - T from a stalled fsync of f ms keeps the adjusted time an upper bound for
 *  the call without the stall; the adjusted p95 only decides the class and is never reported as the latency. */
export function classifyWarmRun(calls: Call[], traced: boolean, run = 1): WarmRun {
  const judged = judgeLatency(calls, [0], 300);
  const ms = calls.map((c) => c.ms);
  const trace: Trace = !traced ? "off" : calls.some((c) => c.fsyncMs === undefined || (mutating(c) && c.exit === 0 && !c.fsyncMs.length)) ? "missing" : "ok";
  const excess = (c: Call) => sum((c.fsyncMs ?? []).filter((f) => f >= STALL_THRESHOLD_MS).map((f) => f - STALL_THRESHOLD_MS));
  const all = calls.flatMap((c) => c.fsyncMs ?? []);
  const fsync: FsyncStats | undefined = trace === "off" ? undefined : {
    count: all.length, totalMs: r1(sum(all)), p50Ms: all.length ? r1(percentile(all, 50)) : 0, p99Ms: all.length ? r1(percentile(all, 99)) : 0,
    maxMs: all.length ? r1(Math.max(...all)) : 0, stalls: all.filter((f) => f >= STALL_THRESHOLD_MS).length, excessMs: r1(sum(calls.map(excess))),
  };
  const p95 = calls.length ? percentile(ms, 95) : 0;
  const adjusted = trace === "ok" && calls.length ? percentile(calls.map((c) => c.ms - excess(c)), 95) : p95;
  const cls: WarmRun["class"] = judged.status === "inconclusive" ? "inconclusive" : p95 <= 300 ? "pass"
    : trace === "ok" && fsync!.stalls > 0 && adjusted <= 300 ? "environment-invalid" : "fail";
  return {
    run, class: cls, trace, n: calls.length, p95Ms: r1(p95), adjustedP95Ms: r1(adjusted), maxMs: calls.length ? r1(Math.max(...ms)) : 0,
    ...(fsync ? { fsync } : {}), ...(cls === "inconclusive" ? { observed: judged.observed, detail: judged.detail } : {}),
  };
}

/** A fixture's warm row: every valid run must pass, and more than `cap` environment-invalid runs leave it unestablished. */
export function judgeWarmRuns(runs: WarmRun[], cap = MAX_INVALID_RUNS): { status: Status; observed: string; detail: string } {
  const first = runs.find((r) => r.class === "inconclusive");
  if (first) return { status: "inconclusive", observed: `run ${first.run}: ${first.observed}`, detail: first.detail ?? "" };
  const n = (k: WarmRun["class"]) => runs.filter((r) => r.class === k).length;
  const invalid = n("environment-invalid"), stats = runs.flatMap((r) => (r.trace === "ok" && r.fsync ? [r.fsync] : []));
  const counts = `runs ${runs.length}: ${n("pass")} pass, ${n("fail")} fail, ${invalid} environment-invalid`;
  const missing = runs.filter((r) => r.trace === "missing").length;
  const stalls = [stats.length ? `stalls ${sum(stats.map((s) => s.stalls))}, max fsync ${Math.max(...stats.map((s) => s.maxMs)).toFixed(0)} ms` : "",
    missing ? `fsync trace missing in ${missing} of ${runs.length} runs (judged on wall time)` : ""].filter(Boolean).join(", ") || "fsync not traced";
  const valid = runs.filter((r) => r.class === "pass" || r.class === "fail");
  if (invalid > cap || !valid.length) return { status: "inconclusive", observed: `${counts} (cap ${cap}); ${stalls}`,
    detail: `More than ${cap} of ${runs.length} runs missed the budget only because of storage or scheduling stalls; the budget is not established by this measurement.` };
  return { status: n("fail") ? "fail" : "pass", observed: `p95 ${Math.max(...valid.map((r) => r.p95Ms)).toFixed(0)} ms (worst valid run), ${counts}; ${stalls}`,
    detail: "Each run on a freshly generated fixture, pooled over open, decide, inspect status and stop; check and finish are not timed. Environment-invalid runs are listed and not judged (Tech Spec 14.1)." };
}

/** `diagnostics`: trace line count and the tail of bpftrace's own messages, for the report. */
export interface FsyncTracer { stop(): void; events(): TraceEvent[]; error?: string; diagnostics(): string }
const sleep = (ms: number) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
// Only the benchmark process ($1), its children (kernel calls) and grandchildren (their Git processes) are traced, so other
// load on the machine cannot fill bpftrace's event buffer; a lost event makes the whole trace missing.
const BPF = [
  "tracepoint:syscalls:sys_enter_fsync, tracepoint:syscalls:sys_enter_fdatasync",
  "/pid == $1 || curtask->real_parent->tgid == $1 || curtask->real_parent->real_parent->tgid == $1/ { @s[tid] = nsecs; }",
  "tracepoint:syscalls:sys_exit_fsync, tracepoint:syscalls:sys_exit_fdatasync /@s[tid]/ {",
  '  printf("%d %d %d\\n", pid, curtask->real_parent->tgid, nsecs - @s[tid]); delete(@s, tid);',
  "}",
  "END { clear(@s); }",
  "",
].join("\n");

/** Starts bpftrace under passwordless sudo and waits until it has attached. */
export function startFsyncTracer(dir: string): FsyncTracer {
  const out = join(dir, "fsync.trace"), log = join(dir, "fsync.log"), prog = join(dir, "fsync.bt");
  writeFileSync(prog, BPF);
  let list: TraceEvent[] = [];
  const text = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
  const tracer: FsyncTracer = { events: () => list, stop: () => {},
    diagnostics: () => `${parseTrace(text(out)).length} trace lines; bpftrace said: ${(text(log) + text(out)).split(/\r?\n/).filter((l) => l && !/^\d+ \d+ \d+$/.test(l)).slice(-5).join(" | ").slice(0, 400)}` };
  const started = spawnSync("sh", ["-c", 'sudo -n bpftrace -o "$1" "$2" "$4" < /dev/null > "$3" 2>&1 & echo $!', "sh", out, prog, log, String(process.pid)], { encoding: "utf8" });
  const pid = Number(started.stdout?.trim());
  const alive = () => pid > 0 && existsSync(`/proc/${pid}`);
  const attached = () => /Attached/.test(text(log) + text(out));
  for (let i = 0; i < 600 && alive() && !attached(); i++) sleep(100);
  if (!attached()) {
    tracer.error = `bpftrace did not attach: ${`${started.stderr ?? ""}${text(log)}`.trim().slice(0, 300) || "no output"}`;
    if (alive()) spawnSync("sudo", ["-n", "pkill", "-INT", "-f", `^bpftrace -o ${out}`]);
    return tracer;
  }
  sleep(250);
  tracer.stop = () => {
    if (!alive()) { tracer.error = `bpftrace exited before the measurement ended: ${text(log).trim().slice(-300) || "no output"}`; return; }
    spawnSync("sudo", ["-n", "pkill", "-INT", "-f", `^bpftrace -o ${out}`]);
    for (let i = 0; i < 300 && alive(); i++) sleep(100);
    if (alive()) { tracer.error = "bpftrace did not exit within 30 s of SIGINT"; return; }
    const lost = /Lost \d+ events/i.exec(text(log) + text(out));
    if (lost) { tracer.error = `bpftrace reported "${lost[0]}", so some fsyncs are not in the trace`; return; }
    list = parseTrace(text(out));
  };
  return tracer;
}

export const dirSize = (dir: string): number => readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
  const p = join(dir, e.name);
  return sum + (e.isDirectory() ? dirSize(p) : lstatSync(p).size);
}, 0);
const tenetSize = (root: string): number | null => (existsSync(join(root, ".tenet")) ? dirSize(join(root, ".tenet")) : null);

const BASIS = { outcome: "Return a greeting", scopePaths: ["src/"], elements: [
  { ref: "r", kind: "requirement", origin: "request", text: "greet returns Hello, Ada!" },
  { ref: "e", kind: "example", origin: "request", of: "r", text: "greet Ada", testFile: "src/greet.test.ts", test: "distinguishing", expect: "fail" },
] };
const WARM_ROUNDS = 20, COLD_CLONES = 5;

export interface Measured { cold: Call[]; warm: Call[]; resume: Call[]; storageBytes: number | null }

/** Cold: the first kernel call in each of several fresh clones. The OS file cache is not dropped, so this is not an OS-cold start. */
export function measureFixture(bundle: string, name: string, spec: FixtureSpec, scratch: string, rounds = WARM_ROUNDS, clones = COLD_CLONES): Measured {
  const source = join(scratch, `${name}-source`);
  generateFixture(spec, source);
  const cold: Call[] = [];
  for (let i = 0; i < clones; i++) {
    const clone = join(scratch, `${name}-cold-${i}`);
    execFileSync("git", ["clone", "-q", "--local", "--no-hardlinks", source, clone], { env: gitEnv(), stdio: "pipe" });
    configureRepo(clone);
    linkFixtureDependencies(clone);
    cold.push(callKernel(bundle, clone, "open (first call)", ["open"], { profile: "investigate", request: "bench cold" }));
    rmSync(clone, { recursive: true, force: true });
  }
  const run = (label: string, argv: string[], body?: object) => callKernel(bundle, source, label, argv, body);
  const first = run("open feature", ["open"], { profile: "feature", request: "bench", lane: "quick" });
  const h = first.response?.handle ?? "";
  for (let i = 0; i < spec.contracts; i++) run("history", ["open"], { profile: "investigate", request: `bench history ${i}` });
  const warm: Call[] = [first, run("decide basis", ["decide"], { h, kind: "basis", propose: BASIS })];
  for (let i = 0; i < 2; i++) run("status (discarded)", ["inspect", "status", "--h", h]);
  for (let i = 0; i < rounds; i++) warm.push(run("status", ["inspect", "status", "--h", h]), run("open investigate", ["open"], { profile: "investigate", request: `bench warm ${i}` }));
  warm.push(run("stop pause", ["stop", "pause", "--h", h]));
  const reopened = run("open resume", ["open"], { profile: "feature", resume: true });
  const resume = [reopened];
  if (reopened.response?.handle) resume.push(run("status after resume", ["inspect", "status", "--h", reopened.response.handle]));
  return { cold, warm, resume, storageBytes: tenetSize(source) };
}

/** `warmRuns`, when given, replaces the single-run warm judgment with the Tech Spec 14.1 judgment over every run. */
export function measuredRows(name: string, m: Measured, warmRuns?: WarmRun[]): Row[] {
  const row = (id: string, status: Status, observed: string, detail: string): Row => {
    const b = BUDGETS.find((x) => x.id === id)!;
    return { id, prd: b.prd, target: b.target, status, fixture: name, observed, detail };
  };
  const warm = judgeLatency(m.warm, [0], 300), cold = judgeLatency(m.cold, [0], 1000);
  const resumeMs = m.resume.reduce((s, c) => s + c.ms, 0), resumeOk = m.resume.every((c) => c.exit !== null && [0, 3].includes(c.exit));
  const runs = warmRuns && judgeWarmRuns(warmRuns);
  const trace: Trace | undefined = warmRuns && (warmRuns.every((r) => r.trace === "off") ? "off" : warmRuns.every((r) => r.trace === "ok") ? "ok" : "missing");
  return [
    runs ? { ...row("bookkeeping-warm", runs.status, runs.observed, runs.detail), stallThresholdMs: STALL_THRESHOLD_MS, trace, runs: warmRuns }
      : row("bookkeeping-warm", warm.status, warm.observed, warm.detail || "Pooled over open, decide, inspect status and stop; check and finish are not timed (see notes)."),
    row("bookkeeping-cold", cold.status, cold.observed, cold.detail || "First kernel call in a fresh clone; the OS file cache is not dropped, so a true cold start is unobserved."),
    row("tenet-storage", m.storageBytes === null ? "inconclusive" : m.storageBytes <= 50 * MB ? "pass" : "fail", m.storageBytes === null ? "no .tenet/ directory" : `${(m.storageBytes / MB).toFixed(2)} MB`, "Size after this workload only; whether growth stays under the cap depends on eviction, which is not built."),
    row("resume", resumeOk ? (resumeMs <= 120_000 ? "pass" : "fail") : "inconclusive", `${resumeMs.toFixed(0)} ms`, "Kernel side only: `open --resume` and the first status. Host re-orientation and an abrupt-kill resume are unobserved."),
  ];
}

/** `environmentInvalidRuns` counts warm runs across fixtures; it is not a row status, so it sits outside `summary`. */
export interface Report { platform: string; environment: Record<string, unknown>; rows: Row[]; summary: Record<Status, number>; environmentInvalidRuns: number; fsyncTrace: string; exit: 0 | 1 | 3 }

function bundleInfo(path: string): Record<string, unknown> {
  try { const b = readFileSync(path); return { path, bytes: b.length, sha256: createHash("sha256").update(b).digest("hex") }; }
  catch { return { path, missing: true }; }
}

const environment = (bundle: string): Record<string, unknown> => ({
  os: `${osPlatform()} ${release()}`, arch: process.arch, cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length, memoryMB: Math.round(totalmem() / MB),
  node: process.version, git: execFileSync("git", ["--version"], { encoding: "utf8" }).trim(),
  bundle: bundleInfo(bundle),
  referenceHardware: "not defined (PRD 4.4.3 names none); results are for this machine only",
});

/** Every fixture is measured `runs` times (Tech Spec 14.1), each on a freshly generated fixture; only the warm row uses
 *  every run, the other rows come from run 1. With `trace`, bpftrace runs for the whole measurement. */
export function runBench(opts: { bundle: string; fixtures: FixtureName[]; platform?: string; runs?: number; trace?: boolean; specs?: Partial<Record<FixtureName, FixtureSpec>> }): Report {
  const platform = opts.platform ?? process.platform;
  const rows: Row[] = [];
  const unobservable = platform === "win32";
  const scratch = unobservable ? "" : mkdtempSync(join(tmpdir(), "tenet-nfr01-"));
  let fsyncTrace = "off", environmentInvalidRuns = 0;
  try {
    for (const b of BUDGETS) {
      if (b.fixed) rows.push({ id: b.id, prd: b.prd, target: b.target, ...b.fixed });
      else if (unobservable) for (const name of opts.fixtures) rows.push({ id: b.id, prd: b.prd, target: b.target, status: "unobservable", fixture: name, detail: "The kernel refuses mutating verbs on win32 (capability-missing), so these calls cannot be made here." });
    }
    if (!unobservable) {
      const tracer = opts.trace ? startFsyncTracer(scratch) : undefined;
      const measured: Array<[FixtureName, Measured[]]> = [];
      try {
        for (const name of opts.fixtures) {
          const list: Measured[] = [];
          for (let i = 1; i <= (opts.runs ?? WARM_RUNS); i++) {
            const dir = join(scratch, `${name}-run-${i}`);
            mkdirSync(dir);
            list.push(measureFixture(opts.bundle, name, opts.specs?.[name] ?? FIXTURES[name], dir));
            rmSync(dir, { recursive: true, force: true });
          }
          measured.push([name, list]);
        }
      } finally { tracer?.stop(); }
      const all = measured.flatMap(([, list]) => list.flatMap((m) => m.warm));
      if (tracer && !tracer.error && !pidsIncrease(all)) tracer.error = "process IDs wrapped during the measurement, so a PID may name two processes";
      const events = tracer && !tracer.error ? tracer.events() : undefined;
      if (tracer) fsyncTrace = `${tracer.error ? `missing: ${tracer.error}` : "ok"}; ${tracer.diagnostics()}`;
      for (const [name, list] of measured) {
        const runs = list.map((m, i) => classifyWarmRun(events ? attributeFsyncs(m.warm, events) : m.warm, Boolean(tracer), i + 1));
        environmentInvalidRuns += runs.filter((r) => r.class === "environment-invalid").length;
        rows.push(...measuredRows(name, list[0]!, runs));
      }
    }
  } finally { if (scratch) rmSync(scratch, { recursive: true, force: true }); }
  const summary = { pass: 0, fail: 0, inconclusive: 0, "not-measurable": 0, unobservable: 0, delegated: 0 } as Record<Status, number>;
  for (const r of rows) summary[r.status]++;
  const exit = unobservable ? 3 : summary.fail || summary.inconclusive ? 1 : 0;
  return { platform, environment: environment(opts.bundle), rows, summary, environmentInvalidRuns, fsyncTrace, exit };
}

const runLine = (r: WarmRun): string => `${" ".repeat(15)}run ${r.run} ${r.class.padEnd(20)} p95 ${r.p95Ms.toFixed(0)} ms, adjusted ${r.adjustedP95Ms.toFixed(0)} ms, max ${r.maxMs.toFixed(0)} ms, n=${r.n}; `
  + (r.fsync ? `fsync ${r.fsync.count}, p50 ${r.fsync.p50Ms} ms, p99 ${r.fsync.p99Ms} ms, max ${r.fsync.maxMs} ms, stalls ${r.fsync.stalls}, trace ${r.trace}` : `trace ${r.trace}`);

export function render(report: Report): string {
  const lines = report.rows.map((r) => [`${r.status.padEnd(14)} ${r.id.padEnd(17)} ${(r.fixture ?? "-").padEnd(13)} ${r.target.padEnd(38)} ${r.observed ?? ""}`, `${" ".repeat(15)}${r.detail}`, ...(r.runs ?? []).map(runLine)].join("\n"));
  const s = report.summary;
  return [`environment: ${JSON.stringify(report.environment)}`, `fsync trace: ${report.fsyncTrace}`, ...lines,
    `rows: ${Object.entries(s).map(([k, v]) => `${v} ${k}`).join(", ")}; environment-invalid warm runs: ${report.environmentInvalidRuns} (listed above, not judged)`,
    s["not-measurable"] || s.unobservable ? "NFR-01 is not established by this run: some budgets were not measurable or not observable." : "All measurable rows passed."].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { fixture: { type: "string", default: "all" }, bundle: { type: "string" }, json: { type: "boolean", default: false }, "fsync-trace": { type: "boolean", default: false } } });
  const names = Object.keys(FIXTURES) as FixtureName[];
  if (positionals[0] === "fixture") {
    const name = positionals[1] as FixtureName, dir = positionals[2];
    if (!names.includes(name) || !dir) { console.error("usage: node tools/bench.ts fixture <small|large|long-history> <dir>"); process.exit(2); }
    console.log(JSON.stringify(generateFixture(FIXTURES[name], dir)));
  } else {
    const fixtures = values.fixture === "all" ? names : names.filter((n) => n === values.fixture);
    const bundle = values.bundle ?? process.env.TENET_TEST_BUNDLE ?? join(import.meta.dirname, "../plugin/kernel/tenet.mjs");
    if (!fixtures.length) { console.error(`unknown fixture "${values.fixture}"; use ${names.join(", ")} or all`); process.exit(2); }
    if (process.platform !== "win32" && bundleInfo(bundle).missing) { console.error(`no bundle at ${bundle}; run npm run build`); process.exit(2); }
    const report = runBench({ bundle, fixtures, trace: values["fsync-trace"] });
    console.log(values.json ? JSON.stringify(report, null, 2) : render(report));
    process.exit(report.exit);
  }
}
