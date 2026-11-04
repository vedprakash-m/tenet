// Benchmarks for the PRD §4.4.3 system budgets (NFR-01, AC-19) against the built kernel bundle:
//   node tools/bench.ts [--fixture small|large|long-history|all] [--bundle <path>] [--json]
//   node tools/bench.ts fixture <name> <dir>      generate one reference fixture and stop
// Every row of the §4.4.3 table gets a status. A budget this tool cannot measure is listed as such with the reason; it
// is never given a number. The kernel refuses mutating verbs on win32, so there nothing is observable and the run
// reports `unobservable` for every measured row (exit 3). Exit 0: no measured row failed; 1: a row failed or was
// inconclusive; 2: usage. Exit 0 does not establish NFR-01 while any row is not measurable. Not part of CI.
import { spawnSync, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { cpus, platform as osPlatform, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { FIXTURES, configureRepo, generateFixture, gitEnv } from "./bench-fixtures.ts";
import type { FixtureName, FixtureSpec } from "./bench-fixtures.ts";

export type Status = "pass" | "fail" | "inconclusive" | "not-measurable" | "unobservable" | "delegated";
export interface Row { id: string; prd: string; target: string; status: Status; fixture?: string; observed?: string; detail: string }
export interface Call { label: string; ms: number; exit: number | null; reason?: string }

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

const kernelEnv = (): NodeJS.ProcessEnv => { const env = gitEnv(); delete env.NODE_OPTIONS; return env; };

/** One kernel process, timed as the host would see it: spawn, Node start and the call itself. */
export function callKernel(bundle: string, cwd: string, label: string, argv: string[], body?: object): Call & { response?: { handle?: string } } {
  const t = performance.now();
  const r = spawnSync(process.execPath, [bundle, ...argv], { cwd, env: kernelEnv(), input: body ? JSON.stringify(body) : "", encoding: "utf8", timeout: 120_000, maxBuffer: 1 << 26 });
  const ms = performance.now() - t;
  try {
    const response = JSON.parse(r.stdout) as { exit: number; handle?: string; reasons?: Array<{ code: string }> };
    return { label, ms, exit: response.exit, reason: response.reasons?.[0]?.code, response };
  } catch { return { label, ms, exit: null, reason: (r.stderr || "no JSON on stdout").slice(0, 80) }; }
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

export function measuredRows(name: string, m: Measured): Row[] {
  const row = (id: string, status: Status, observed: string, detail: string): Row => {
    const b = BUDGETS.find((x) => x.id === id)!;
    return { id, prd: b.prd, target: b.target, status, fixture: name, observed, detail };
  };
  const warm = judgeLatency(m.warm, [0], 300), cold = judgeLatency(m.cold, [0], 1000);
  const resumeMs = m.resume.reduce((s, c) => s + c.ms, 0), resumeOk = m.resume.every((c) => c.exit !== null && [0, 3].includes(c.exit));
  return [
    row("bookkeeping-warm", warm.status, warm.observed, warm.detail || "Pooled over open, decide, inspect status and stop; check and finish are not timed (see notes)."),
    row("bookkeeping-cold", cold.status, cold.observed, cold.detail || "First kernel call in a fresh clone; the OS file cache is not dropped, so a true cold start is unobserved."),
    row("tenet-storage", m.storageBytes === null ? "inconclusive" : m.storageBytes <= 50 * MB ? "pass" : "fail", m.storageBytes === null ? "no .tenet/ directory" : `${(m.storageBytes / MB).toFixed(2)} MB`, "Size after this workload only; whether growth stays under the cap depends on eviction, which is not built."),
    row("resume", resumeOk ? (resumeMs <= 120_000 ? "pass" : "fail") : "inconclusive", `${resumeMs.toFixed(0)} ms`, "Kernel side only: `open --resume` and the first status. Host re-orientation and an abrupt-kill resume are unobserved."),
  ];
}

export interface Report { platform: string; environment: Record<string, unknown>; rows: Row[]; summary: Record<Status, number>; exit: 0 | 1 | 3 }

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

export function runBench(opts: { bundle: string; fixtures: FixtureName[]; platform?: string }): Report {
  const platform = opts.platform ?? process.platform;
  const rows: Row[] = [];
  const unobservable = platform === "win32";
  const scratch = unobservable ? "" : mkdtempSync(join(tmpdir(), "tenet-nfr01-"));
  try {
    for (const b of BUDGETS) {
      if (b.fixed) rows.push({ id: b.id, prd: b.prd, target: b.target, ...b.fixed });
      else if (unobservable) for (const name of opts.fixtures) rows.push({ id: b.id, prd: b.prd, target: b.target, status: "unobservable", fixture: name, detail: "The kernel refuses mutating verbs on win32 (capability-missing), so these calls cannot be made here." });
    }
    if (!unobservable) for (const name of opts.fixtures) rows.push(...measuredRows(name, measureFixture(opts.bundle, name, FIXTURES[name], scratch)));
  } finally { if (scratch) rmSync(scratch, { recursive: true, force: true }); }
  const summary = { pass: 0, fail: 0, inconclusive: 0, "not-measurable": 0, unobservable: 0, delegated: 0 } as Record<Status, number>;
  for (const r of rows) summary[r.status]++;
  const exit = unobservable ? 3 : summary.fail || summary.inconclusive ? 1 : 0;
  return { platform, environment: environment(opts.bundle), rows, summary, exit };
}

export function render(report: Report): string {
  const lines = report.rows.map((r) => `${r.status.padEnd(14)} ${r.id.padEnd(17)} ${(r.fixture ?? "-").padEnd(13)} ${r.target.padEnd(38)} ${r.observed ?? ""}\n${" ".repeat(15)}${r.detail}`);
  const s = report.summary;
  return [`environment: ${JSON.stringify(report.environment)}`, ...lines,
    `rows: ${Object.entries(s).map(([k, v]) => `${v} ${k}`).join(", ")}`,
    s["not-measurable"] || s.unobservable ? "NFR-01 is not established by this run: some budgets were not measurable or not observable." : "All measurable rows passed."].join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { fixture: { type: "string", default: "all" }, bundle: { type: "string" }, json: { type: "boolean", default: false } } });
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
    const report = runBench({ bundle, fixtures });
    console.log(values.json ? JSON.stringify(report, null, 2) : render(report));
    process.exit(report.exit);
  }
}
