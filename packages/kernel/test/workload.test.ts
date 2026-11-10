// The workload obligation end to end (QLT-05): a Deep contract in a project whose recipe lists "workload" runs the
// declared harness through the kernel's runner, the kernel judges its report, finish keeps one point per contract, and
// a trend that crosses its declared threshold over consecutive Deep contracts raises an attention item.
// Simplification: the harness is a tiny fake that prints a fixed-shape JSON report with a p95 read from a file the
// test controls; it measures nothing.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCOPE } from "../src/core/fitness.ts";
import { emptyState } from "../src/core/state.ts";
import type { KernelResponse } from "../src/core/schemas.ts";
import { cleanup, tmp } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const skip = { skip: process.platform === "win32" && "mutating work is refused on Windows" };
const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

const DECLARATION = {
  version: 1, run: ["node", "workload/run.mjs"], report: "stdout", timeoutMs: 60_000, minimumSamples: 10,
  samples: ["operations.list.successful.samples"],
  fitness: [{
    id: "list-p95-ms", measure: "operations.list.successful.p95", unit: "ms", better: "lower", target: 200,
    degradation: { percent: 20, consecutive: 3, floor: 0 },
  }],
};

function harness(valueFile: string): string {
  return `import { readFileSync } from "node:fs";
const p95 = Number(readFileSync(${JSON.stringify(valueFile)}, "utf8"));
const ok = p95 <= 200;
console.log(JSON.stringify({ mode: "reference", referencePass: ok, reasons: ok ? [] : ["list-p95-over-200ms"],
  operations: { list: { successful: { samples: 50, p95 } } },
  environment: { node: process.version, platform: process.platform, arch: process.arch } }));
process.exit(ok ? 0 : 1);
`;
}

/** A project whose recipe record lists the workload; `value` sets the p95 the harness reports next. */
async function workloadProject(declaration: unknown = DECLARATION, checks: Array<"tsc" | "workload"> = ["workload"]) {
  const dir = tmp("tenet-wl-");
  roots.push(dir);
  const valueFile = join(dir, "p95");
  const p = project({ "workload.json": JSON.stringify(declaration), "workload/run.mjs": harness(valueFile) });
  roots.push(p.root);
  await p.ports().store.transaction("fixture", async (tx) => {
    const ids = tx.state ? undefined : tx.ensure();
    const st = tx.state ?? emptyState(ids!.workspaceId, ids!.tag);
    tx.publish({ ...st, project: { ...st.project, recipe: { id: "fixture", version: "1.0.0", installed: true, checks } } });
  });
  return { p, value: (n: number) => writeFileSync(valueFile, String(n)) };
}

/** One contract: a new function with its distinguishing test, red then green. */
async function contract(p: Project, n: number, lane: "deep" | "standard" = "deep") {
  const file = `src/g${n}.ts`, test = `src/g${n}.test.ts`;
  const h = (await p.call("open", { profile: "feature", request: `add g${n}`, scopePaths: [file], lane })).handle!;
  await p.call("decide", { h, kind: "basis", propose: {
    outcome: `g${n}() returns ${n}`, scopePaths: [file],
    elements: [
      { ref: "r1", kind: "requirement", origin: "request", text: `g${n}() returns ${n}` },
      { ref: "e1", kind: "example", origin: "request", of: "r1", text: `g${n}() is ${n}`, testFile: test, test: "distinguishing", expect: "fail" },
    ],
  } });
  p.write(file, `export const g${n} = (): number => 0;\n`);
  p.write(test, `import { expect, it } from "vitest";\nimport { g${n} } from "./g${n}.ts";\nit("returns ${n}", () => { expect(g${n}()).toBe(${n}); });\n`);
  await p.call("check", { h, stage: "baseline" });
  p.write(file, `export const g${n} = (): number => ${n};\n`);
  const green = await p.call("check", { h, stage: "candidate", touched: [file] });
  const id = Object.values(p.ports().store.read()!.state.work).find((w) => w.request === `add g${n}`)!.id;
  return { h, green, id };
}

const workloadReceipt = (r: KernelResponse) => (d(r).receipts as Array<Record<string, any>>).find((x) => x.obligation === "OB-workload");
const state = (p: Project) => p.ports().store.read()!.state;

async function finishAndCommit(p: Project, h: string, id: string, n: number) {
  const f = await p.call("finish", { h, subject: `g${n}` });
  assert.equal(state(p).work[id]?.state, "finished", JSON.stringify(f));
  p.git("add", "-A");
  p.git("commit", "-qm", `g${n}`);
  return f;
}

describe("workload obligation [QLT-05]", () => {
  it("runs the declared workload in a Deep contract and judges its report against the declared target", skip, async () => {
    const { p, value } = await workloadProject();
    value(100);
    const { green } = await contract(p, 1);
    const r = workloadReceipt(green);
    assert.equal(r?.status, "pass", JSON.stringify(d(green).receipts));
    assert.equal(d(green).workload.scope, SCOPE);
    assert.deepEqual(d(green).workload.trends[0].values, [100]);
    const stored = Object.values(state(p).work)[0]!.receipts.find((x) => x.obligation === "OB-workload")!;
    assert.deepEqual(stored.workload?.measures, { "list-p95-ms": 100 });
    assert.equal(stored.kind, "workload");
  });

  it("fails a missed target, and owes nothing in a Standard contract or without the recipe listing it", skip, async () => {
    const { p, value } = await workloadProject();
    value(250);
    const { green } = await contract(p, 1);
    const r = workloadReceipt(green);
    assert.equal(r?.status, "fail");
    assert.match(r?.failures[0].message, /250 ms against the declared target 200/);
    const std = await contract(p, 2, "standard");
    assert.equal(workloadReceipt(std.green), undefined);
    const plain = await workloadProject(DECLARATION, ["tsc"]);
    assert.equal(workloadReceipt((await contract(plain.p, 1)).green), undefined);
  });

  it("is inconclusive with workload-declaration-invalid when the declaration is invalid, without aborting the check", skip, async () => {
    const { p, value } = await workloadProject({ ...DECLARATION, extra: true });
    value(100);
    const { h, green } = await contract(p, 1);
    const r = workloadReceipt(green);
    assert.equal(r?.status, "inconclusive");
    assert.deepEqual(r?.reasons, ["workload-declaration-invalid"]);
    assert.ok((d(green).receipts as Array<{ obligation: string; status: string }>).some((x) => x.obligation === "OB-suite" && x.status === "pass"));
    const why = await p.call("inspect", { h, view: "why" });
    assert.notEqual(d(why).endpoint, "checked-local");
  });

  it("raises an attention item when the trend degrades over three consecutive Deep contracts", skip, async () => {
    const { p, value } = await workloadProject();
    for (const [n, v] of [[1, 100], [2, 110]] as const) {
      value(v);
      const { h, green, id } = await contract(p, n);
      assert.equal(workloadReceipt(green)?.status, "pass");
      await finishAndCommit(p, h, id, n);
      assert.equal(state(p).project.fitness?.["list-p95-ms"]?.points.length, n);
    }
    value(121);
    const { h, green, id } = await contract(p, 3);
    assert.equal(workloadReceipt(green)?.status, "pass", "every run met its target; only the trend degraded");
    assert.deepEqual(d(green).workload.trends[0].values, [100, 110, 121]);
    assert.equal(d(green).workload.trends[0].runs, "the last 3 Deep contracts");
    const work = state(p).work[id]!;
    const item = work.attention.find((a) => a.pattern.startsWith("fitness-trend:"));
    assert.equal(item?.pattern, "fitness-trend:list-p95-ms 100 to 121 ms (+21%, 3 runs)");
    const why = await p.call("inspect", { h, view: "why" });
    assert.ok(why.reasons.some((r) => r.code === "fitness-trend-degraded"), JSON.stringify(why.reasons));
    await p.call("check", { h, stage: "candidate", again: true });
    assert.equal(state(p).work[id]!.attention.filter((a) => a.id === item!.id).length, 1, "a recheck of the same window adds none");
    await p.call("decide", { h, kind: "disposition", target: item!.id, propose: { outcome: "accepted", reason: "known cost of the new index" } });
    const after = await p.call("inspect", { h, view: "why" });
    assert.ok(!after.reasons.some((r) => r.code === "fitness-trend-degraded"), JSON.stringify(after.reasons));
    await p.call("finish", { h, subject: "g3" });
    const series = state(p).project.fitness!["list-p95-ms"]!;
    assert.equal(series.points.length, 3);
    assert.equal(series.raised, series.points.at(-1)!.receipt, "the next window starts at the newest run");
  });
});
