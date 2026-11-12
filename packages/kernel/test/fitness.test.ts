// The pure workload core (QLT-05): the strict declaration, the kernel's judgement of a report, the trend rule and the series.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { appendSeries, degraded, judgeReport, parseWorkload, SCOPE, trendOf, UNAVAILABLE } from "../src/core/fitness.ts";
import type { FitnessSeries, WorkloadDeclaration } from "../src/core/fitness.ts";
import { withWorkload, wantsWorkload } from "../src/core/obligations.ts";

const DECL = {
  version: 1, run: ["node", "workload/run.mjs"], report: "stdout", timeoutMs: 60_000, minimumSamples: 10,
  samples: ["operations.list.successful.samples"],
  fitness: [
    { id: "list-p95-ms", measure: "operations.list.successful.p95", unit: "ms", better: "lower", target: 200,
      degradation: { percent: 20, consecutive: 3, floor: 0 } },
    { id: "duplicate-items", measure: "database.duplicates", unit: "", better: "lower", target: 0, trend: false },
  ],
};
const decl = (over: Record<string, unknown> = {}) => {
  const r = parseWorkload(JSON.stringify({ ...DECL, ...over }));
  assert.ok(r.ok, JSON.stringify(r));
  return r.decl;
};
const report = (over: Record<string, unknown> = {}, p95 = 100) => JSON.stringify({
  mode: "reference", referencePass: true, reasons: [], operations: { list: { successful: { samples: 50, p95 } } },
  database: { duplicates: 0 }, environment: { node: "v24.1.0", platform: "linux", arch: "x64" }, ...over,
});

describe("workload declaration [QLT-05]", () => {
  it("is strict: missing, unparseable, unknown keys, shell launchers, bad ids and bad windows are named problems", () => {
    assert.deepEqual(parseWorkload(null), { ok: false, problem: "workload.json is missing" });
    assert.equal(parseWorkload("{").ok, false);
    const bad = (over: Record<string, unknown>) => {
      const r = parseWorkload(JSON.stringify({ ...DECL, ...over }));
      assert.equal(r.ok, false, JSON.stringify(over));
      return r.ok ? "" : r.problem;
    };
    assert.match(bad({ extra: 1 }), /workload\.json/);
    assert.match(bad({ run: "node workload/run.mjs" }), /run/);
    assert.match(bad({ run: ["npx", "tsx", "run.ts"] }), /launcher/);
    assert.match(bad({ run: ["/bin/sh", "-c", "node run.mjs"] }), /launcher/);
    const fn = DECL.fitness[0]!;
    assert.match(bad({ fitness: [{ ...fn, id: "__proto__" }] }), /fitness\.0\.id/);
    assert.match(bad({ fitness: [fn, fn] }), /unique/);
    assert.match(bad({ fitness: [{ ...fn, degradation: { ...fn.degradation, consecutive: 1 } }] }), /consecutive/);
    assert.match(bad({ fitness: [{ ...fn, degradation: undefined }] }), /degradation/);
    assert.match(bad({ fitness: [{ ...fn, target: "200" }] }), /target/);
  });

  it("is owed only by a Deep contract whose recipe lists the workload", () => {
    assert.equal(wantsWorkload(["tsc", "workload"], "deep"), true);
    assert.equal(wantsWorkload(["tsc", "workload"], "standard"), false);
    assert.equal(wantsWorkload(["tsc", "e2e"], "deep"), false);
    const obs = withWorkload([], true);
    assert.deepEqual(obs, [{ id: "OB-workload", kind: "workload", category: "release", tool: "workload" }]);
    assert.equal(withWorkload(obs, true).length, 1);
  });
});

describe("workload report judgement [QLT-05]", () => {
  const d = decl();
  it("passes a reference report that meets every declared target, keeping only trended values, with the scope sentence", () => {
    const j = judgeReport(d, 0, report());
    assert.equal(j.status, "pass");
    assert.deepEqual(j.workload?.measures, { "list-p95-ms": 100 });
    assert.equal(j.workload?.samples, 50);
    assert.ok(j.limitations.includes(SCOPE));
    assert.ok(j.limitations.includes("The project report declares reference mode."));
    assert.ok(!j.limitations.includes(UNAVAILABLE));
  });

  it("fails a missed target by the kernel's own reading, naming the function and both numbers", () => {
    const j = judgeReport(d, 1, report({ referencePass: false, reasons: ["list-p95-over-200ms"] }, 250));
    assert.equal(j.status, "fail");
    assert.ok(j.failures.some((f) => f.test === "list-p95-ms" && /250 ms against the declared target 200/.test(f.message)));
    const harnessSaysPass = judgeReport(d, 0, report({}, 250));
    assert.equal(harnessSaysPass.status, "fail", "the harness's own verdict does not override a declared target");
  });

  it("fails on a harness reason the declaration does not cover", () => {
    const j = judgeReport(d, 1, report({ referencePass: false, reasons: ["double-booking"] }));
    assert.equal(j.status, "fail");
    assert.deepEqual(j.failures.map((f) => f.test), ["double-booking"]);
  });

  it("is inconclusive for smoke, too few samples, missing or invalid reports and contradictions", () => {
    const code = (exit: number, raw: string | null) => {
      const j = judgeReport(d, exit, raw);
      assert.equal(j.status, "inconclusive");
      assert.ok(j.limitations.includes(SCOPE));
      return j.reasons[0];
    };
    assert.equal(code(0, report({ mode: "smoke" })), "population-mismatch");
    assert.ok(!judgeReport(d, 0, report({ mode: "smoke" })).limitations.includes("The project report declares reference mode."));
    assert.equal(code(0, report({ operations: { list: { successful: { samples: 3, p95: 100 } } } })), "population-mismatch");
    assert.equal(code(1, report({ referencePass: false, reasons: ["insufficient-successful-samples"] })), "population-mismatch");
    assert.equal(code(0, null), "report-missing");
    assert.ok(judgeReport(d, 0, null).limitations.includes(UNAVAILABLE));
    assert.equal(code(0, "not json"), "report-invalid");
    assert.equal(code(0, report({ database: {} })), "report-invalid");
    assert.equal(code(0, report({ referencePass: false, reasons: ["double-booking"] })), "report-contradiction");
    assert.equal(code(1, report()), "report-contradiction");
    assert.equal(code(1, report({ referencePass: undefined })), "report-contradiction");
  });
});

describe("fitness trend [QLT-05]", () => {
  const rule = { percent: 20, consecutive: 3, floor: 0 };
  it("fires when each of the last n points is worse and the change exceeds the threshold; never on a flat step", () => {
    assert.equal(degraded([100, 110], "lower", rule), false);
    assert.equal(degraded([100, 110, 121], "lower", rule), true);
    assert.equal(degraded([100, 130, 100], "lower", rule), false);
    assert.equal(degraded([100, 100, 100, 119], "lower", rule), false);
    assert.equal(degraded([100, 100, 121], "lower", rule), false);
    assert.equal(degraded([0, 5, 12], "lower", { ...rule, floor: 10 }), true);
    assert.equal(degraded([0, 1, 2], "lower", { ...rule, floor: 10 }), false);
    assert.equal(degraded([0, 0, 0], "lower", rule), false);
    assert.equal(degraded([100, 90, 79], "higher", rule), true);
    assert.equal(degraded([100, 100, 79], "higher", rule), false);
  });

  const d: WorkloadDeclaration = decl();
  const env = "e1";
  const cur = (receipt: string, value: number, e = env) =>
    ({ receipt, at: "2026-11-10T00:00:00.000Z", workload: { env: e, samples: 50, measures: { "list-p95-ms": value } } });
  const finished = (values: number[], e = env): FitnessSeries =>
    values.reduce<FitnessSeries>((s, v, i) => appendSeries(s, cur(`RC-${i}`, v, e), []), {});

  it("keeps one point per receipt, raises one attention item for the crossing window and reports the series", () => {
    const series = finished([100, 110]);
    assert.equal(series["list-p95-ms"]!.points.length, 2);
    assert.deepEqual(appendSeries(series, cur("RC-1", 110), []), series, "a receipt already recorded adds nothing");
    const t = trendOf(d, series, cur("RC-now", 121));
    assert.equal(t.items.length, 1);
    assert.match(t.items[0]!.pattern, /^fitness-trend:list-p95-ms 100 to 121 ms \(\+21%, 3 runs\)$/);
    assert.equal(t.items[0]!.marker, false);
    assert.deepEqual(t.lines[0], { id: "list-p95-ms", unit: "ms", values: [100, 110, 121], runs: "the last 3 Deep contracts" });
    assert.equal(trendOf(d, series, cur("RC-again", 121)).items[0]!.id, t.items[0]!.id, "the same window keeps its id");
  });

  it("restarts the series when the environment changes, and starts the next window where a raised one ended", () => {
    const moved = trendOf(d, finished([100, 110]), cur("RC-now", 121, "e2"));
    assert.equal(moved.items.length, 0);
    assert.match(moved.lines[0]!.restarted!, /series restarted/);
    const raised = appendSeries(finished([100, 110]), cur("RC-2", 121), ["list-p95-ms"]);
    assert.equal(trendOf(d, raised, cur("RC-3", 133)).items.length, 0, "an accepted window is not raised again");
    const next = appendSeries(raised, cur("RC-3", 133), []);
    assert.equal(trendOf(d, next, cur("RC-4", 160)).items.length, 1, "a later window that crosses again raises a new item");
  });
});
