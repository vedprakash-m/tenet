// Temporary: profile the warm bookkeeping calls that miss NFR-01 on the large and long-history fixtures.
// Writes CPU profiles and Git trace2 timings per call, then a text summary. Removed once the profile is read.
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES, generateFixture, gitEnv } from "./bench-fixtures.ts";
import type { FixtureName } from "./bench-fixtures.ts";

const [bundle, out] = [process.argv[2]!, process.argv[3]!];
const ROUNDS = 8;
const BASIS = { outcome: "Return a greeting", scopePaths: ["src/"], elements: [
  { ref: "r", kind: "requirement", origin: "request", text: "greet returns Hello, Ada!" },
  { ref: "e", kind: "example", origin: "request", of: "r", text: "greet Ada", testFile: "src/greet.test.ts",
    test: "distinguishing", expect: "fail" },
] };

interface Sample { label: string; ms: number; git: Array<{ argv: string; ms: number }>; prof?: string }
const lines: string[] = [];
const log = (s: string) => { lines.push(s); console.log(s); };

function call(dir: string, cwd: string, label: string, argv: string[], body?: object, profile = false): Sample & { handle?: string } {
  const id = `${label.replace(/\W+/g, "-")}-${Date.now()}`;
  const trace = join(dir, `${id}.trace2.json`);
  const env: NodeJS.ProcessEnv = { ...gitEnv(), GIT_TRACE2_EVENT: trace };
  delete env.NODE_OPTIONS;
  const args = profile ? ["--cpu-prof", `--cpu-prof-dir=${dir}`, `--cpu-prof-name=${id}.cpuprofile`, bundle, ...argv] : [bundle, ...argv];
  const t = performance.now();
  const r = spawnSync(process.execPath, args, { cwd, env, input: body ? JSON.stringify(body) : "", encoding: "utf8", maxBuffer: 1 << 26 });
  const ms = performance.now() - t;
  let handle: string | undefined;
  try { handle = (JSON.parse(r.stdout) as { handle?: string }).handle; } catch { log(`  ${label}: no JSON (${r.stderr.slice(0, 120)})`); }
  return { label, ms, git: gitTimes(trace), handle, ...(profile ? { prof: join(dir, `${id}.cpuprofile`) } : {}) };
}

/** Git child processes from a trace2 event file: each top-level git's argv and elapsed time. */
function gitTimes(path: string): Array<{ argv: string; ms: number }> {
  let text = "";
  try { text = readFileSync(path, "utf8"); } catch { return []; }
  const starts = new Map<string, string>(), res: Array<{ argv: string; ms: number }> = [];
  for (const l of text.split("\n")) {
    if (!l) continue;
    const e = JSON.parse(l) as { event: string; sid: string; argv?: string[]; t_abs?: number };
    if (e.event === "start" && !e.sid.includes("/")) starts.set(e.sid, (e.argv ?? []).slice(1).join(" "));
    if (e.event === "exit" && starts.has(e.sid)) res.push({ argv: starts.get(e.sid)!, ms: (e.t_abs ?? 0) * 1000 });
  }
  return res;
}

/** Self time by function across CPU profiles, top N, plus total sampled ms. */
function topSelf(profiles: string[], n = 25): string[] {
  const self = new Map<string, number>();
  let total = 0;
  for (const p of profiles) {
    type Frame = { functionName: string; url: string; lineNumber: number };
    const prof = JSON.parse(readFileSync(p, "utf8")) as { nodes: Array<{ id: number; callFrame: Frame }>; 
      samples: number[]; timeDeltas: number[] };
    const byId = new Map(prof.nodes.map((x) => [x.id, x.callFrame]));
    prof.samples.forEach((s, i) => {
      const f = byId.get(s)!, d = (prof.timeDeltas[i] ?? 0) / 1000;
      const key = `${f.functionName || "(anon)"} ${f.url.split("/").pop()}:${f.lineNumber + 1}`;
      self.set(key, (self.get(key) ?? 0) + d); total += d;
    });
  }
  const per = profiles.length || 1;
  return [`sampled ${(total / per).toFixed(0)} ms per call`,
    ...[...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${(v / per).toFixed(1).padStart(7)} ms  ${k}`)];
}

function profileFixture(name: FixtureName): void {
  const dir = join(out, name), source = join(dir, "repo");
  mkdirSync(dir, { recursive: true });
  generateFixture(FIXTURES[name], source);
  const run = (label: string, argv: string[], body?: object, profile = false) => call(dir, source, label, argv, body, profile);
  const node = performance.now(); spawnSync(process.execPath, ["-e", "0"]); const nodeMs = performance.now() - node;
  const bare = run("unknown verb", ["nosuchverb"]);
  const h = run("open feature", ["open"], { profile: "feature", request: "bench", lane: "quick" }).handle ?? "";
  for (let i = 0; i < FIXTURES[name].contracts; i++) run("history", ["open"], { profile: "investigate", request: `history ${i}` });
  run("decide basis", ["decide"], { h, kind: "basis", propose: BASIS });
  run("status", ["inspect", "status", "--h", h]);
  const samples: Sample[] = [];
  for (let i = 0; i < ROUNDS; i++) {
    samples.push(run("status", ["inspect", "status", "--h", h], undefined, i % 2 === 0));
    samples.push(run("open investigate", ["open"], { profile: "investigate", request: `warm ${i}` }, i % 2 === 0));
  }
  log(`\n=== ${name}: node -e 0 ${nodeMs.toFixed(0)} ms; unknown verb (load bundle, no work) ${bare.ms.toFixed(0)} ms`);
  for (const label of ["status", "open investigate"]) {
    const s = samples.filter((x) => x.label === label), plain = s.filter((x) => !x.prof);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
    log(`\n--- ${label}: unprofiled mean ${avg(plain.map((x) => x.ms)).toFixed(0)} ms (n=${plain.length})`);
    const git = new Map<string, { n: number; ms: number }>();
    for (const x of plain) for (const g of x.git) {
      const k = g.argv.replace(/[0-9a-f]{40}/g, "<oid>").slice(0, 110), v = git.get(k) ?? { n: 0, ms: 0 };
      git.set(k, { n: v.n + 1, ms: v.ms + g.ms });
    }
    const gitMs = avg(plain.map((x) => x.git.reduce((a, g) => a + g.ms, 0))), gitN = avg(plain.map((x) => x.git.length));
    log(`git per call: ${gitMs.toFixed(0)} ms over ${gitN.toFixed(1)} processes`);
    for (const [k, v] of [...git.entries()].sort((a, b) => b[1].ms - a[1].ms).slice(0, 15)) {
      log(`  ${(v.ms / plain.length).toFixed(1).padStart(7)} ms  x${(v.n / plain.length).toFixed(1)}  git ${k}`);
    }
    for (const l of topSelf(s.filter((x) => x.prof).map((x) => x.prof!))) log(`  ${l}`);
  }
}

mkdirSync(out, { recursive: true });
for (const name of ["small", "large", "long-history"] as FixtureName[]) profileFixture(name);
writeFileSync(join(out, "summary.txt"), lines.join("\n") + "\n");
