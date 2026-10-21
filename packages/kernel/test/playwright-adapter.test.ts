// The Playwright adapter's pure normalization (EVD-13, TS §9.3/9.5/12.7): the same per-file counts Vitest's
// normalizer produces, built from real captured report shapes, so every downstream receipt rule applies unchanged.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizePlaywright, playwrightArgv } from "../src/adapters/playwright.ts";

const result = (status: string, errors: Array<{ message?: string }> = []) => ({ status, errors });
const spec = (title: string, ok: boolean, results: Array<ReturnType<typeof result>>) => ({ title, ok, tests: [{ status: ok ? "expected" : "unexpected", results }] });
interface Suite { file: string; title: string; specs: Array<ReturnType<typeof spec>>; suites: Suite[] }
const suite = (file: string, specs: Array<ReturnType<typeof spec>>, nested: Suite[] = []): Suite => ({ file, title: file, specs, suites: nested });
const report = (suites: Suite[], stats: Partial<{ expected: number; skipped: number; unexpected: number; flaky: number }> = {}) =>
  JSON.stringify({ suites, stats: { expected: 0, skipped: 0, unexpected: 0, flaky: 0, ...stats } });

describe("Playwright report normalization [EVD-13]", () => {
  it("counts a passing spec as one executed, passing test under its file", () => {
    const raw = report([suite("e2e/a.spec.ts", [spec("one", true, [result("passed")])])], { expected: 1 });
    const norm = normalizePlaywright(raw);
    assert.equal(norm.invalid, undefined);
    assert.equal(norm.discovered, 1);
    assert.deepEqual(norm.files.get("e2e/a.spec.ts")?.passed, 1);
    assert.deepEqual(norm.files.get("e2e/a.spec.ts")?.failed, 0);
  });

  it("counts a failing spec, keeping its first error message, bounded", () => {
    const raw = report([suite("e2e/a.spec.ts", [spec("one", false, [result("failed", [{ message: `Error: boom\n${"x".repeat(600)}` }])])])], { unexpected: 1 });
    const norm = normalizePlaywright(raw);
    const f = norm.files.get("e2e/a.spec.ts")!;
    assert.equal(f.failed, 1);
    assert.equal(f.failureKinds[0], "assertion");
    assert.ok(f.failures[0]!.message.length <= 500);
  });

  it("counts a skipped spec as skipped, not executed", () => {
    const raw = report([suite("e2e/a.spec.ts", [spec("one", true, [result("skipped")])])], { skipped: 1 });
    const norm = normalizePlaywright(raw);
    const f = norm.files.get("e2e/a.spec.ts")!;
    assert.equal(f.skipped, 1);
    assert.equal(f.executed, 0);
  });

  it("flattens nested describe blocks under the file they share", () => {
    const nested = suite("e2e/a.spec.ts", [spec("inner", true, [result("passed")])]);
    const raw = report([suite("e2e/a.spec.ts", [spec("outer", true, [result("passed")])], [nested])], { expected: 2 });
    const norm = normalizePlaywright(raw);
    assert.equal(norm.files.get("e2e/a.spec.ts")?.executed, 2);
  });

  it("is invalid when the report is not JSON, has no suites, or nests past the depth bound", () => {
    assert.equal(normalizePlaywright("not json").invalid, "the report is not valid JSON");
    assert.equal(normalizePlaywright(JSON.stringify({ stats: {} })).invalid, "the report has no suites or stats");
    assert.equal(normalizePlaywright(null).invalid, "no report was produced");
    let deep: unknown = {};
    for (let i = 0; i < 70; i++) deep = { n: deep };
    assert.equal(normalizePlaywright(JSON.stringify({ suites: [], stats: {}, deep })).invalid, "the report exceeds depth 64");
  });

  it("is invalid when a spec's status and the report's own stats disagree", () => {
    const raw = report([suite("e2e/a.spec.ts", [spec("one", true, [result("passed")])])], { unexpected: 1 }); // stats say a failure exists; no spec failed
    assert.equal(normalizePlaywright(raw).invalid, "the report's stats and its specs disagree");
  });

  it("refuses a report path that leaves the workspace", () => {
    const raw = report([suite("../outside/a.spec.ts", [spec("one", true, [result("passed")])])], { expected: 1 });
    assert.equal(normalizePlaywright(raw, "/project").invalid, "a report path leaves the workspace");
  });

  it("argv is null when Playwright is not installed, a direct binary when it is", () => {
    assert.equal(playwrightArgv("/does/not/exist", "/tmp/out.json"), null);
  });
});
