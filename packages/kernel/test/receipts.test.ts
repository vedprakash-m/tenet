// A receipt proves only what the observed run and its report together show (TS §9.6, EVD-02).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { receiptsFrom } from "../src/core/receipts.ts";
import type { ReceiptContext, RunFacts } from "../src/core/receipts.ts";
import type { Obligation } from "../src/core/schemas.ts";
import { normalize } from "../src/adapters/node-ts.ts";

const ob: Obligation = { id: "OB-1", kind: "test", category: "acceptance", testFile: "a.test.ts" };
const suite: Obligation = { id: "OB-suite", kind: "test", category: "affected" };
const ctx: ReceiptContext = { stage: "candidate", scope: "full", id: "chk", candidate: "c", runId: "r", runDir: "/d", argv: ["vitest"], before: "d0", versions: { node: "v", tool: "3", reporter: "json", adapter: "a" }, missing: new Set() };
const run = (over: Partial<RunFacts> = {}): RunFacts => ({ exit: 0, timedOut: false, durationMs: 5, startedAt: "t", raw: "x", after: "d0", ran: true, ...over });

const report = (tests: Array<{ status: string; failure?: string }>, file = "/p/a.test.ts", other = true) => JSON.stringify({
  testResults: [
    { name: file, status: tests.some((t) => t.status === "failed") ? "failed" : "passed", assertionResults: tests.map((t, i) => ({ fullName: `t${i}`, status: t.status, failureMessages: t.failure ? [t.failure] : [] })) },
    ...(other ? [{ name: "/p/b.test.ts", status: "passed", assertionResults: [{ fullName: "b", status: "passed", failureMessages: [] }] }] : []),
  ],
});
const norm = (raw: string) => normalize(raw, "/p");
const one = (o: Obligation, r: RunFacts, n: ReturnType<typeof norm> | null, c = ctx) => receiptsFrom(r, n, [o], c)[0]!;

describe("receipts", () => {
  it("passes only when tests executed, none failed, and the exit status agrees [EVD-02, EVD-05]", () => {
    const r = one(ob, run(), norm(report([{ status: "passed" }])));
    assert.deepEqual([r.status, r.counts?.executed, r.reasons], ["pass", 1, []]);
    assert.equal(r.checkInputId, "chk");
    assert.equal(r.candidate, "c");
  });
  it("fails on a failing test and keeps at most five failures with their kind", () => {
    const tests = Array.from({ length: 7 }, () => ({ status: "failed", failure: "AssertionError: expected 1 to be 2" }));
    const r = one(ob, run({ exit: 1 }), norm(report(tests)));
    assert.equal(r.status, "fail");
    assert.equal(r.failures!.length, 5);
    assert.equal(r.failures![0]!.kind, "assertion");
  });
  it("counts zero executed tests as inconclusive, never a pass", () => {
    const r = one(ob, run(), norm(report([{ status: "skipped" }])));
    assert.deepEqual([r.status, r.reasons], ["inconclusive", ["zero-tests"]]);
  });
  it("is inconclusive when exit status and report disagree, in either direction", () => {
    assert.deepEqual(one(ob, run({ exit: 0 }), norm(report([{ status: "failed", failure: "boom" }]))).reasons, ["report-contradiction"]);
    assert.deepEqual(one(ob, run({ exit: 1 }), norm(report([{ status: "passed" }]))).reasons, ["report-contradiction"]);
  });
  it("a file that passed beside a failing file in the same run is a pass, not a contradiction [TDD-04]", () => {
    const raw = JSON.stringify({ testResults: [
      { name: "/p/a.test.ts", status: "passed", assertionResults: [{ fullName: "a", status: "passed", failureMessages: [] }] },
      { name: "/p/b.test.ts", status: "failed", assertionResults: [{ fullName: "b", status: "failed", failureMessages: ["AssertionError: expected 1 to be 2"] }] },
    ] });
    assert.deepEqual([one(ob, run({ exit: 1 }), norm(raw)).status, one({ ...ob, testFile: "b.test.ts" }, run({ exit: 1 }), norm(raw)).status], ["pass", "fail"]);
  });
  it("is inconclusive when the file the obligation names was not in the report", () => {
    assert.deepEqual(one({ ...ob, testFile: "missing.test.ts" }, run(), norm(report([{ status: "passed" }]))).reasons, ["population-mismatch"]);
  });
  it("is inconclusive for a focused test, a timeout, a process that did not run, and an edit during the run", () => {
    const focused = JSON.stringify({ testResults: [{ name: "/p/a.test.ts", status: "failed", assertionResults: [{ fullName: "x", status: "failed", failureMessages: ["Error: [Vitest] Unexpected .only modifier."] }] }] });
    assert.deepEqual(one(ob, run({ exit: 1 }), norm(focused)).reasons, ["focused-tests"]);
    assert.deepEqual(one(ob, run({ timedOut: true }), null).reasons, ["timeout"]);
    assert.deepEqual(one(ob, run({ ran: false }), null).reasons, ["not-executed"]);
    assert.deepEqual(one(ob, run({ after: "d1" }), norm(report([{ status: "passed" }]))).reasons, ["concurrent-edit"]);
  });
  it("distinguishes a missing report from an invalid one", () => {
    assert.deepEqual(one(ob, run({ raw: null }), null).reasons, ["report-missing"]);
    assert.deepEqual(one(ob, run({ raw: "not json" }), norm("not json")).reasons, ["report-invalid"]);
    assert.deepEqual(one(ob, run({ raw: "{}" }), norm("{}")).reasons, ["report-invalid"]);
  });
  it("treats a test file that failed to load as a failure, not as nothing", () => {
    const raw = JSON.stringify({ testResults: [{ name: "/p/a.test.ts", status: "failed", message: "Cannot find module './x'", assertionResults: [] }] });
    const r = one(ob, run({ exit: 1 }), norm(raw));
    assert.equal(r.status, "fail");
    assert.equal(r.failures![0]!.kind, "compile-or-import");
  });
  it("covers every file in the report for the suite obligation, and notes skips on an acceptance test", () => {
    const s = one(suite, run({ exit: 1 }), norm(report([{ status: "failed", failure: "AssertionError: x" }])));
    assert.deepEqual([s.status, s.counts?.executed], ["fail", 2]);
    const a = one(ob, run(), norm(report([{ status: "passed" }, { status: "skipped" }])));
    assert.deepEqual([a.status, a.limitations], ["pass", ["1 skipped"]]);
  });
  it("reports a test file that does not exist yet as not executed, with the reason", () => {
    const r = one(ob, run(), norm(report([{ status: "passed" }])), { ...ctx, missing: new Set(["OB-1"]) });
    assert.deepEqual([r.status, r.reasons, r.limitations], ["inconclusive", ["not-executed"], ["the test file does not exist yet"]]);
  });
});
