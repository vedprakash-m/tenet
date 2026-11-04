// tools/bench.ts and tools/bench-fixtures.ts: the fixtures are reproducible, every PRD 4.4.3 row gets a status, and an
// unmeasured budget is never given a number. A stand-in bundle replaces the kernel, so these show the harness logic only;
// no kernel latency is measured here, and none of these tests carries a requirement tag.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { BUDGETS, judgeLatency, measureFixture, measuredRows, percentile, render, runBench } from "../../../tools/bench.ts";
import type { Call } from "../../../tools/bench.ts";
import { FIXTURES, generateFixture } from "../../../tools/bench-fixtures.ts";
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

describe("benchmark budgets", () => {
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
