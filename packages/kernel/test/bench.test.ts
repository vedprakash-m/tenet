// tools/bench.ts and tools/bench-fixtures.ts: the fixtures are reproducible, every PRD 4.4.3 row gets a status, and an
// unmeasured budget is never given a number. A stand-in bundle replaces the kernel, so these show the harness logic only;
// no kernel latency is measured here, and none of these tests carries a requirement tag.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS, MAX_INVALID_RUNS, STALL_THRESHOLD_MS, WARM_RUNS, attributeFsyncs, callKernel, classifyWarmRun, judgeLatency, judgeWarmRuns, measureFixture, measuredRows, parseTrace, percentile, render, runBench, startFsyncTracer } from "../../../tools/bench.ts";
import type { Call, Report, WarmRun } from "../../../tools/bench.ts";
import { FIXTURES, generateFixture } from "../../../tools/bench-fixtures.ts";
import { mergeBenchReports } from "../../../tools/merge-bench-reports.ts";
import { cleanup, tmp } from "./helpers.ts";

const dirs: string[] = [];
const scratch = () => { const d = tmp("tenet-bench-t-"); dirs.push(d); return d; };
after(() => dirs.forEach(cleanup));
const call = (ms: number, exit: number | null = 0): Call => ({ label: "x", ms, exit });

describe("benchmark statistics", () => {
  it("takes the nearest-rank percentile", () => {
    const xs = Array.from({ length: 20 }, (_, i) => (i + 1) * 10);
    assert.equal(percentile(xs, 95), 190);
    assert.equal(percentile(xs, 100), 200);
    assert.equal(percentile([5], 95), 5);
  });
  it("passes at the limit, fails above it, and says nothing when a call ended outside its expected exit", () => {
    assert.equal(judgeLatency([call(100), call(300)], [0], 300).status, "pass");
    assert.equal(judgeLatency([call(100), call(301)], [0], 300).status, "fail");
    assert.equal(judgeLatency([call(10), call(10, 2)], [0], 300).status, "inconclusive");
    assert.equal(judgeLatency([call(10, null)], [0], 300).status, "inconclusive");
    assert.equal(judgeLatency([], [0], 300).status, "inconclusive");
  });
});

describe("stall-aware warm runs (Tech Spec 14.1)", () => {
  // 43 calls like a real warm run: 40 status calls at 200 ms and three named opens. Nearest-rank p95 is the 3rd slowest.
  const run = (slow: number[], fsync: (i: number) => number[] | undefined = () => [1]): Call[] => [
    ...Array.from({ length: 40 }, () => ({ label: "status", ms: 200, exit: 0, fsyncMs: [] as number[] })),
    ...slow.map((ms, i) => ({ label: "open investigate", ms, exit: 0, fsyncMs: fsync(i) })),
  ];
  const untraced = (calls: Call[]) => calls.map(({ fsyncMs: _, ...c }) => c);

  it("fails a miss with no stall (E1)", () => {
    const r = classifyWarmRun(run([320, 330, 340]), true);
    assert.deepEqual([r.class, r.trace, r.p95Ms, r.adjustedP95Ms, r.fsync?.stalls], ["fail", "ok", 320, 320, 0]);
  });
  it("calls a miss environment-invalid when the stall time above 20 ms explains it (E2)", () => {
    const r = classifyWarmRun(run([320, 330, 340], () => [80]), true);
    assert.deepEqual([r.class, r.p95Ms, r.adjustedP95Ms, r.fsync?.stalls, r.fsync?.excessMs, r.fsync?.maxMs], ["environment-invalid", 320, 260, 3, 180, 80]);
  });
  it("fails a miss that the removed stall time does not explain (E3)", () => {
    const r = classifyWarmRun(run([320, 330, 340], () => [25]), true);
    assert.deepEqual([r.class, r.adjustedP95Ms, r.fsync?.stalls], ["fail", 315, 3]);
  });
  it("passes a run that met the budget despite a stall, and counts the stall (E4)", () => {
    const r = classifyWarmRun(run([260, 270, 280], (i) => (i === 0 ? [300] : [1])), true);
    assert.deepEqual([r.class, r.p95Ms, r.fsync?.stalls], ["pass", 260, 1]);
  });
  it("judges an untraced run on wall time only (E5)", () => {
    assert.deepEqual([classifyWarmRun(untraced(run([320, 330, 340], () => [80])), false).class, classifyWarmRun(untraced(run([260, 270, 280])), false).class], ["fail", "pass"]);
    assert.equal(classifyWarmRun(untraced(run([260, 270, 280])), false).trace, "off");
  });
  it("calls a run inconclusive when a call ended outside exit 0 (E6)", () => {
    const calls = run([320, 330, 340], () => [80]);
    calls[3] = { ...calls[3]!, exit: 2 };
    const r = classifyWarmRun(calls, true);
    assert.equal(r.class, "inconclusive");
    assert.match(r.observed ?? "", /exited 2/);
  });
  it("marks the trace missing when a successful mutating call shows no fsync, and then excuses nothing (E7)", () => {
    const r = classifyWarmRun(run([320, 330, 340], (i) => (i === 0 ? [] : [80])), true);
    assert.deepEqual([r.trace, r.class], ["missing", "fail"]);
  });
  it("judges the row: every valid run passes, at most 2 of 5 environment-invalid (E8)", () => {
    const of = (...classes: WarmRun["class"][]): WarmRun[] => classes.map((c) => ({ ...classifyWarmRun(run([260, 270, 280]), true), class: c }));
    assert.equal(judgeWarmRuns(of("pass", "pass", "pass", "pass", "environment-invalid")).status, "pass");
    assert.equal(judgeWarmRuns(of("pass", "pass", "environment-invalid", "pass", "environment-invalid")).status, "pass");
    const capped = judgeWarmRuns(of("pass", "environment-invalid", "pass", "environment-invalid", "environment-invalid"));
    assert.equal(capped.status, "inconclusive");
    assert.match(capped.observed, /runs 5: 2 pass, 0 fail, 3 environment-invalid \(cap 2\)/);
    assert.match(capped.detail, /More than 2 of 5 runs missed the budget only because of storage or scheduling stalls/);
    assert.equal(judgeWarmRuns(of("pass", "pass", "fail", "pass", "environment-invalid")).status, "fail");
    assert.equal(judgeWarmRuns(of("pass", "inconclusive", "fail", "pass", "pass")).status, "inconclusive");
    assert.match(judgeWarmRuns(of("pass", "pass", "pass", "pass", "pass")).observed, /^p95 260 ms \(worst valid run\), runs 5: 5 pass, 0 fail, 0 environment-invalid; stalls 0, max fsync 1 ms$/);
    const missing = of("pass", "pass").map((r, i) => (i ? { ...r, trace: "missing" as const } : r));
    assert.match(judgeWarmRuns(missing).observed, /; stalls 0, max fsync 1 ms, fsync trace missing in 1 of 2 runs \(judged on wall time\)$/);
  });
  it("attributes a traced fsync to the call by its process or a direct child, and to nothing once process IDs wrap (E9)", () => {
    const trace = parseTrace([
      "Attached 4 probes",
      "100 1 2000000",     // the call's own process
      "200 100 30000000",  // a Git child of the call
      "300 1 7000000",     // another process
      "@s[12]: 4",
    ].join("\n"));
    assert.equal(trace.length, 3);
    const calls: Call[] = [{ label: "open investigate", ms: 1, exit: 0, pid: 100 }, { label: "status", ms: 1, exit: 0, pid: 150 }];
    assert.deepEqual(attributeFsyncs(calls, trace).map((c) => c.fsyncMs), [[2, 30], []]);
    // A lower process ID after a higher one means the IDs wrapped, so a PID may name two processes: nothing is attributed.
    assert.deepEqual(attributeFsyncs([calls[1]!, calls[0]!], trace).map((c) => c.fsyncMs), [undefined, undefined]);
  });
  it("keeps the threshold, the run count and the cap equal to the Tech Spec text (E13)", () => {
    const ts = readFileSync(join(import.meta.dirname, "../../../specs/tech-spec.md"), "utf8");
    const para = ts.slice(ts.indexOf("**Warm bookkeeping latency measurement.**"), ts.indexOf("### 14.2 "));
    assert.ok(para.length > 100, "Tech Spec 14.1 has no warm bookkeeping latency measurement paragraph");
    assert.match(para, new RegExp(`in ${WARM_RUNS} runs, fixed in advance`));
    assert.match(para, new RegExp(`taking ${STALL_THRESHOLD_MS} ms or more is a storage stall`));
    assert.match(para, new RegExp(`more than ${MAX_INVALID_RUNS} of the ${WARM_RUNS} runs are environment-invalid`));
  });
});

// E12: needs Linux, passwordless sudo and bpftrace. The system-budgets workflow installs bpftrace and sets
// TENET_FSYNC_TRACE_REQUIRED=1, so there this never skips; elsewhere it skips and says why.
describe("fsync tracing with bpftrace (E12)", () => {
  const required = process.env.TENET_FSYNC_TRACE_REQUIRED === "1";
  const why = process.platform !== "linux" ? "not Linux" : execFileSyncOk("sudo", ["-n", "bpftrace", "--version"]) ? "" : "no passwordless bpftrace";
  const skip = !required && why ? `skipped: ${why}` : false;

  it("attributes a child's two fsyncs, and fsyncs to the real kernel's open, decide and stop", { skip }, () => {
    const dir = scratch(), child = join(dir, "child.mjs");
    writeFileSync(child, [
      'import { closeSync, fdatasyncSync, fsyncSync, openSync, writeSync } from "node:fs";',
      'const fd = openSync("f.tmp", "w"); writeSync(fd, "x"); fsyncSync(fd); fdatasyncSync(fd); closeSync(fd);',
      'console.log(JSON.stringify({ exit: 0 }));',
    ].join("\n"));
    const bundle = process.env.TENET_TEST_BUNDLE ?? join(import.meta.dirname, "../../../plugin/kernel/tenet.mjs");
    const repo = join(dir, "repo");
    generateFixture({ files: 20, commits: 2, contracts: 0 }, repo);
    const tracer = startFsyncTracer(dir);
    let calls: Call[];
    try {
      const fake = callKernel(child, dir, "open child", []);
      const open = callKernel(bundle, repo, "open feature", ["open"], { profile: "feature", request: "trace", lane: "quick" });
      const h = open.response?.handle ?? "";
      const decide = callKernel(bundle, repo, "decide basis", ["decide"], { h, kind: "basis", propose: { outcome: "x", scopePaths: ["src/"], elements: [{ ref: "r", kind: "requirement", origin: "request", text: "x" }] } });
      const stop = callKernel(bundle, repo, "stop pause", ["stop", "pause", "--h", h]);
      calls = [fake, open, decide, stop];
    } finally { tracer.stop(); }
    assert.equal(tracer.error, undefined, tracer.diagnostics());
    const events = tracer.events();
    const [fake, open, decide, stop] = attributeFsyncs(calls, events);
    assert.equal(fake!.fsyncMs?.length, 2, `child pid ${fake!.pid}; traced ${events.length} fsyncs from pids ${[...new Set(events.map((e) => `${e.pid}<${e.ppid}`))].slice(0, 12).join(" ")}`);
    for (const c of [open, decide, stop]) {
      assert.equal(c!.exit, 0, `${c!.label} exited ${c!.exit} (${c!.reason})`);
      assert.ok((c!.fsyncMs?.length ?? 0) >= 1, `${c!.label}: no fsync attributed`);
    }
  });
});

function execFileSyncOk(cmd: string, args: string[]): boolean {
  try { execFileSync(cmd, args, { stdio: "ignore", timeout: 10_000 }); return true; } catch { return false; }
}

describe("benchmark budgets", () => {
  it("merges five traced trials per fixture before applying the unchanged five-run judgment", () => {
    const fixtures = Object.keys(FIXTURES);
    const reports: Report[] = fixtures.flatMap((fixture) => Array.from({ length: WARM_RUNS }, (_, index) => {
      const trial = index + 1;
      const fixed = BUDGETS.filter((budget) => budget.fixed).map((budget) => ({
        id: budget.id, prd: budget.prd, target: budget.target, ...budget.fixed!,
      }));
      return {
        platform: "linux",
        trial,
        environment: { bundle: { sha256: "a".repeat(64) }, cpu: "reference" },
        rows: [
          ...fixed,
          {
            id: "bookkeeping-warm", prd: "Kernel bookkeeping call latency", target: "p95 <= 300 ms warm",
            fixture, status: "pass", observed: "p95 100 ms", detail: "one trial", trace: "ok",
            runs: [{ run: trial, class: "pass", trace: "ok", n: 43, p95Ms: 100, adjustedP95Ms: 100, maxMs: 110 }],
          },
          { id: "bookkeeping-cold", prd: "Kernel bookkeeping call latency", target: "p95 <= 1 s cold", fixture, status: "pass" as const, observed: "p95 100 ms", detail: "cold" },
          { id: "tenet-storage", prd: "`.tenet/` storage", target: "<= 50 MB", fixture, status: "pass" as const, observed: "1 MB", detail: "storage" },
          { id: "resume", prd: "Resume reconstruction", target: "<= 2 min", fixture, status: "pass" as const, observed: "1 ms", detail: "resume" },
        ],
        summary: { pass: 11, fail: 0, inconclusive: 0, "not-measurable": 4, unobservable: 0, delegated: 4 },
        environmentInvalidRuns: 0,
        fsyncTrace: "ok",
        exit: 0,
      };
    }));
    const merged = mergeBenchReports(reports);
    for (const fixture of fixtures) {
      const warm = merged.rows.find((row) => row.id === "bookkeeping-warm" && row.fixture === fixture)!;
      assert.deepEqual(warm.runs!.map((run) => run.run), [1, 2, 3, 4, 5]);
      assert.equal(warm.status, "pass");
    }
    reports[0] = {
      ...reports[0]!,
      rows: reports[0]!.rows.map((row) => row.id === "bookkeeping-warm"
        ? { ...row, runs: [{ ...row.runs![0]!, class: "fail" as const, p95Ms: 301 }] }
        : row),
    };
    assert.equal(mergeBenchReports(reports).exit, 1);
  });

  it("accounts for every row of the PRD 4.4.3 table", () => {
    const prd = readFileSync(join(import.meta.dirname, "../../../specs/PRD.md"), "utf8");
    const table = prd.slice(prd.indexOf("#### 4.4.3 System budgets"), prd.indexOf("### 4.5 "));
    const rows = table.split(/\r?\n/).filter((l) => l.startsWith("| ") && !l.startsWith("| Budget") && !l.startsWith("|---")).map((l) => l.split("|")[1]!.trim());
    assert.equal(rows.length, 9);
    for (const row of rows) assert.ok(BUDGETS.some((b) => row.startsWith(b.prd)), `no benchmark entry for: ${row}`);
    assert.equal(new Set(BUDGETS.map((b) => b.id)).size, BUDGETS.length);
  });
  it("lists the unbuilt pieces as not measurable and gives them no number", () => {
    for (const id of ["repository-map", "tenet-eviction", "call-timeout", "assignment-peak"]) {
      const b = BUDGETS.find((x) => x.id === id)!;
      assert.equal(b.fixed?.status, "not-measurable", id);
      assert.ok(b.fixed!.detail.length > 20, id);
    }
  });
  it("reports every measured row as unobservable on win32 without starting the kernel", () => {
    const report = runBench({ bundle: join(scratch(), "missing.mjs"), fixtures: ["small", "large"], platform: "win32" });
    assert.equal(report.exit, 3);
    const measured = report.rows.filter((r) => ["bookkeeping-warm", "bookkeeping-cold", "tenet-storage", "resume"].includes(r.id));
    assert.equal(measured.length, 8);
    assert.ok(measured.every((r) => r.status === "unobservable" && r.observed === undefined));
    assert.equal(report.summary.pass + report.summary.fail, 0);
    assert.match(render(report), /NFR-01 is not established/);
  });
});

describe("reference fixtures", () => {
  it("keep the shapes the budgets name", () => {
    assert.equal(FIXTURES.large.files, 10_000);
    assert.ok(FIXTURES.small.files < FIXTURES.large.files);
    assert.ok(FIXTURES["long-history"].commits > 10 * FIXTURES.large.commits);
    assert.ok(FIXTURES["long-history"].contracts > 0);
  });
  it("are generated, not committed, and the same spec gives the same history", () => {
    const spec = { files: 250, commits: 12, contracts: 0 };
    const a = generateFixture(spec, scratch()), b = generateFixture(spec, scratch());
    assert.equal(a.head, b.head);
    assert.deepEqual({ files: a.files, commits: a.commits }, { files: 254, commits: 12 });
    assert.notEqual(generateFixture({ ...spec, commits: 13 }, scratch()).head, a.head);
  });
  it("refuse a target that already holds files and leave it unchanged (P76)", () => {
    const dir = scratch();
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/greet.ts"), "// someone's work\n");
    assert.throws(() => generateFixture({ files: 10, commits: 2, contracts: 0 }, dir), /not empty/);
    assert.equal(readFileSync(join(dir, "src/greet.ts"), "utf8"), "// someone's work\n");
    assert.equal(existsSync(join(dir, ".git")), false);
    const fresh = join(scratch(), "new");
    assert.equal(generateFixture({ files: 10, commits: 2, contracts: 0 }, fresh).commits, 2);
  });
  it("leave a clean checkout without kernel state, ignoring .tenet/", () => {
    const dir = scratch();
    generateFixture({ files: 120, commits: 30, contracts: 0 }, dir);
    assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }), "");
    assert.equal(existsSync(join(dir, ".tenet")), false);
    assert.match(readFileSync(join(dir, ".gitignore"), "utf8"), /^\.tenet\/$/m);
    assert.equal(readFileSync(join(dir, "d0/f0.ts"), "utf8").startsWith("export const v0 = "), true);
  });
});

describe("benchmark harness with a stand-in kernel", () => {
  const stand = () => {
    const dir = scratch(), bundle = join(dir, "fake.mjs");
    writeFileSync(bundle, [
      'import { mkdirSync, writeFileSync } from "node:fs";',
      'const exit = Number(process.env.FAKE_EXIT ?? 0);',
      'if (process.argv[2] === "open") { mkdirSync(".tenet", { recursive: true }); writeFileSync(".tenet/state", "x".repeat(2048)); }',
      'console.log(JSON.stringify({ verb: process.argv[2], exit, handle: "W1.1.aaa", reasons: exit ? [{ code: "stand-in" }] : [] }));',
      "process.exitCode = exit;",
    ].join("\n"));
    return bundle;
  };
  const spec = { files: 50, commits: 3, contracts: 0 };
  const status = (rows: ReturnType<typeof measuredRows>) => Object.fromEntries(rows.map((r) => [r.id, r.status]));

  it("makes the planned calls and turns them into one row per measured budget", () => {
    const m = measureFixture(stand(), "tiny", spec, scratch(), 2, 1);
    assert.equal(m.cold.length, 1);
    assert.deepEqual(m.warm.map((c) => c.label), ["open feature", "decide basis", "status", "open investigate", "status", "open investigate", "stop pause"]);
    assert.deepEqual(m.resume.map((c) => c.label), ["open resume", "status after resume"]);
    assert.equal(m.storageBytes, 2048);
    assert.deepEqual(status(measuredRows("tiny", m)), { "bookkeeping-warm": "pass", "bookkeeping-cold": "pass", "tenet-storage": "pass", resume: "pass" });
  });
  it("judges the warm row on every run, reports each one, and takes the other rows from run 1", () => {
    const report = runBench({ bundle: stand(), fixtures: ["small"], platform: "linux", runs: 2, specs: { small: spec } });
    const warm = report.rows.find((r) => r.id === "bookkeeping-warm")!;
    assert.equal(warm.runs?.length, 2);
    assert.ok(warm.runs!.every((r) => r.class === "pass" && r.trace === "off" && r.n === 43 && r.fsync === undefined));
    assert.equal(warm.trace, "off");
    assert.equal(warm.stallThresholdMs, STALL_THRESHOLD_MS);
    assert.match(warm.observed ?? "", /runs 2: 2 pass, 0 fail, 0 environment-invalid; fsync not traced/);
    assert.equal(report.rows.filter((r) => r.id === "bookkeeping-cold").length, 1);
    assert.equal(report.environmentInvalidRuns, 0);
    const text = render(report);
    assert.match(text, /run 1 +pass +p95 \d+ ms/);
    assert.match(text, /run 2 +pass/);
    assert.doesNotMatch(text, /environmentInvalidRuns/);
  });
  it("calls the latency rows inconclusive when the kernel refuses the calls", () => {
    process.env.FAKE_EXIT = "2";
    try {
      const rows = measuredRows("tiny", measureFixture(stand(), "tiny", spec, scratch(), 1, 1));
      assert.equal(rows.find((r) => r.id === "bookkeeping-warm")!.status, "inconclusive");
      assert.match(rows.find((r) => r.id === "bookkeeping-cold")!.observed ?? "", /exited 2/);
      assert.equal(rows.find((r) => r.id === "resume")!.status, "inconclusive");
    } finally { delete process.env.FAKE_EXIT; }
  });
});
