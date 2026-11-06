// A receipt proves only what the observed run and its report together show (TS §9.6, EVD-02).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { cleanup, tmp, write } from "./helpers.ts";
import { receiptsFrom, settleReruns } from "../src/core/receipts.ts";
import type { ReceiptContext, RunFacts } from "../src/core/receipts.ts";
import type { Obligation, Receipt, WorkContract } from "../src/core/schemas.ts";
import { createStack, normalize } from "../src/adapters/node-ts.ts";
import { normalizePlaywright } from "../src/adapters/playwright.ts";
import { matchBaseline } from "../src/verbs/check-evidence.ts";
import type { Run } from "../src/verbs/check-evidence.ts";

const ob: Obligation = { id: "OB-1", kind: "test", category: "acceptance", testFile: "a.test.ts" };
const suite: Obligation = { id: "OB-suite", kind: "test", category: "affected" };
const ctx: ReceiptContext = { stage: "candidate", scope: "full", id: "chk", candidate: "c", runId: "r", runDir: "/d", argv: ["vitest"], before: "d0", versions: { node: "v", tool: "3", reporter: "json", adapter: "a", static: {} }, missing: new Set() };
const run = (over: Partial<RunFacts> = {}): RunFacts => ({ exit: 0, timedOut: false, durationMs: 5, startedAt: "t", raw: "x", after: "d0", ran: true, ...over });

const report = (tests: Array<{ status: string; failure?: string }>, file = "/p/a.test.ts", other = true) => JSON.stringify({
  testResults: [
    { name: file, status: tests.some((t) => t.status === "failed") ? "failed" : "passed", assertionResults: tests.map((t, i) => ({ fullName: `t${i}`, status: t.status, failureMessages: t.failure ? [t.failure] : [] })) },
    ...(other ? [{ name: "/p/b.test.ts", status: "passed", assertionResults: [{ fullName: "b", status: "passed", failureMessages: [] }] }] : []),
  ],
});
const norm = (raw: string) => normalize(raw, "/p");
const one = (o: Obligation, r: RunFacts, n: ReturnType<typeof norm> | null, c = ctx) => receiptsFrom(r, n, [o], c)[0]!;
const baselineRed = (receipt: Receipt) => matchBaseline(
  { baseline: true, facts: { inv: { entries: new Map() } } } as Run,
  { obligations: [{ ...ob, expectation: "fail" }] } as WorkContract, [receipt],
)[0]!.baselineMatched;

describe("receipts", () => {
  it("refuses Playwright errors on skipped results before tagged or suite baseline proof [EVD-02, EVD-05, TDD-02]", () => {
    const data = (selectedStatus: string, status: string, errors: Array<{ message?: string }> | undefined) => ({
      suites: [{ title: "a.test.ts", file: "a.test.ts", specs: [
        { title: "[EX-1] selected behavior", ok: selectedStatus === "passed", tests: [{
          status: selectedStatus === "passed" ? "expected" : "unexpected", expectedStatus: "passed",
          results: [{ status: selectedStatus, errors: selectedStatus === "failed" ? [{ message: "AssertionError: expected true" }] : [] }],
        }] },
        { title: "sibling", ok: true, tests: [{
          status: status === "passed" ? "expected" : "skipped", expectedStatus: status,
          results: [{ status, errors }],
        }] },
      ] }],
      stats: { expected: Number(selectedStatus === "passed") + Number(status === "passed"),
        unexpected: Number(selectedStatus === "failed"), skipped: Number(status === "skipped"), flaky: 0 },
    });
    for (const status of ["passed", "skipped"]) {
      for (const errors of [[{ message: "TypeError: cleanup failed" }], [{ message: "" }], [{}]]) {
        for (const selectedStatus of ["passed", "failed"]) {
          const normalized = normalizePlaywright(JSON.stringify(data(selectedStatus, status, errors)), "/p");
          assert.equal(normalized.invalid, "the test summary and its execution disagree");
          assert.equal(normalized.files.size, 0);
          assert.equal(normalized.discovered, 0);
          for (const obligation of [ob, { ...ob, example: "EX-1" }, suite]) {
            const receipt = one(obligation, run({ exit: selectedStatus === "failed" ? 1 : 0 }), normalized);
            assert.equal(receipt.status, "inconclusive");
            assert.deepEqual(receipt.reasons, ["report-invalid"]);
            if (obligation.id === ob.id) assert.equal(baselineRed(receipt), false);
          }
        }
      }
      for (const errors of [undefined, []]) {
        const normalized = normalizePlaywright(JSON.stringify(data("passed", status, errors)), "/p");
        assert.equal(normalized.invalid, undefined);
        assert.equal(one({ ...ob, example: "EX-1" }, run(), normalized).status, "pass");
        assert.equal(one(ob, run(), normalized).status, status === "skipped" ? "inconclusive" : "pass");
      }
    }
    assert.notEqual(createStack().adapterVersion(), "node-ts@26");
  });

  it("never discards failure diagnostics attached to nonfailed assertions [EVD-02, EVD-05, TDD-02]", () => {
    for (const status of ["passed", "pending", "skipped", "todo", "disabled"]) {
      for (const failureMessages of [["TypeError: cleanup failed"], [""]]) {
        for (const selectedStatus of ["passed", "failed"]) {
          const data = JSON.parse(report([{
            status: selectedStatus, failure: selectedStatus === "failed" ? "AssertionError: expected true" : undefined,
          }], "/p/a.test.ts", false));
          data.testResults[0].assertionResults[0].fullName = "[EX-1] selected behavior";
          data.testResults[0].assertionResults.push({ fullName: "contradictory sibling", status, failureMessages });
          const normalized = norm(JSON.stringify(data));
          assert.equal(normalized.invalid, "the assertion status and its failure messages disagree",
            JSON.stringify({ status, failureMessages, selectedStatus }));
          assert.equal(normalized.files.size, 0);
          assert.equal(normalized.discovered, 0);
          for (const obligation of [ob, { ...ob, example: "EX-1" }, suite]) {
            const receipt = one(obligation, run({ exit: selectedStatus === "failed" ? 1 : 0 }), normalized);
            assert.equal(receipt.status, "inconclusive");
            assert.deepEqual(receipt.reasons, ["report-invalid"]);
            if (obligation.id === ob.id) assert.equal(baselineRed(receipt), false);
          }
        }
      }
      for (const failureMessages of [undefined, []]) {
        const data = JSON.parse(report([{ status: "passed" }], "/p/a.test.ts", false));
        data.testResults[0].assertionResults[0].fullName = "[EX-1] selected behavior";
        data.testResults[0].assertionResults.push({ fullName: "clean sibling", status, failureMessages });
        const normalized = norm(JSON.stringify(data));
        assert.equal(normalized.invalid, undefined);
        assert.equal(one({ ...ob, example: "EX-1" }, run(), normalized).status, "pass");
        assert.equal(one(ob, run(), normalized).status, status === "passed" ? "pass" : "inconclusive");
      }
    }
    assert.notEqual(createStack().adapterVersion(), "node-ts@25");
  });

  it("refuses focus anywhere in the run before file or tagged evidence can establish a verdict [EVD-02, EVD-05, TDD-02]", () => {
    for (const status of ["passed", "failed"]) {
      const data = JSON.parse(report([{ status, failure: status === "failed" ? "AssertionError: expected true" : undefined }]));
      data.testResults[0].assertionResults[0].fullName = "[EX-1] selected behavior";
      data.testResults[1].status = "failed";
      data.testResults[1].assertionResults[0] = {
        fullName: "focused sibling", status: "failed", failureMessages: ["Error: [Vitest] Unexpected .only modifier."],
      };
      for (const obligation of [ob, { ...ob, example: "EX-1" }, suite]) {
        const receipt = one(obligation, run({ exit: 1 }), norm(JSON.stringify(data)));
        assert.equal(receipt.status, "inconclusive");
        assert.deepEqual(receipt.reasons, ["focused-tests"]);
        if (obligation.id === ob.id) assert.equal(baselineRed(receipt), false);
      }
    }
  });

  it("rejects real cross-file focus without confusing ordinary sibling assertion failures [EVD-02, EVD-05, TDD-02]", () => {
    const root = tmp("tenet-cross-file-focus-"), stack = createStack();
    try {
      write(root, "vitest.config.mjs",
        'export default { test: { globals: true, allowOnly: true, include: ["*.test.js"], maxWorkers: 1 } };\n');
      for (const mode of ["focused-pass", "focused-red", "ordinary"] as const) {
        write(root, "a.test.js", `test("[EX-1] selected behavior", () => expect(true).toBe(${mode !== "focused-red"}));\n`);
        write(root, "b.test.js", `test${mode === "ordinary" ? "" : ".only"}("sibling", () => expect(true).toBe(false));\n`);
        const report = join(root, "report.json"), argv = stack.argv("all", report);
        const child = spawnSync(argv[0]!, [join(import.meta.dirname, "..", "..", "..", argv[1]!), ...argv.slice(2)], {
          cwd: root, env: { ...process.env, CI: "1" }, encoding: "utf8", timeout: 30_000,
        });
        assert.equal(child.error, undefined, child.stderr);
        assert.equal(child.status, 1, child.stderr);
        const normalized = normalize(readFileSync(report, "utf8"), root);
        assert.equal(normalized.invalid, undefined);
        for (const example of [undefined, "EX-1"]) {
          const obligation = { ...ob, testFile: "a.test.js", ...(example ? { example } : {}) };
          const receipt = one(obligation, run({ exit: 1 }), normalized);
          assert.equal(receipt.status, mode === "ordinary" ? "pass" : "inconclusive", JSON.stringify({ mode, receipt }));
          assert.deepEqual(receipt.reasons, mode === "ordinary" ? [] : ["focused-tests"]);
          assert.equal(baselineRed(receipt), false);
        }
      }
      assert.notEqual(stack.adapterVersion(), "node-ts@24");
    } finally { cleanup(root); }
  });

  it("does not pass real unhandled rejections despite permissive Vitest settings [EVD-02, EVD-05]", () => {
    const root = tmp("tenet-vitest-unhandled-"), stack = createStack();
    try {
      write(root, "vitest.config.mjs",
        'export default { test: { globals: true, dangerouslyIgnoreUnhandledErrors: true, ' +
        'include: ["probe.test.js"], maxWorkers: 1 } };\n');
      for (const mode of ["unhandled", "passing"] as const) {
        write(root, "probe.test.js", 'test("behavior", async () => {\n' +
          (mode === "unhandled" ? '  Promise.reject(new TypeError("background cleanup failed"));\n' : "") +
          '  await new Promise(resolve => setTimeout(resolve, 25));\n  expect(true).toBe(true);\n});\n');
        const report = join(root, "report.json"), argv = stack.argv("all", report);
        const child = spawnSync(argv[0]!, [join(import.meta.dirname, "..", "..", "..", argv[1]!), ...argv.slice(2)], {
          cwd: root, env: { ...process.env, CI: "1" }, encoding: "utf8", timeout: 30_000,
        });
        assert.equal(child.error, undefined, child.stderr);
        const normalized = normalize(readFileSync(report, "utf8"), root);
        assert.equal(normalized.invalid, undefined);
        const receipt = one(suite, run({ exit: child.status ?? undefined }), normalized);
        assert.equal(receipt.status, mode === "passing" ? "pass" : "inconclusive", JSON.stringify({ mode, receipt }));
        assert.deepEqual(receipt.reasons, mode === "passing" ? [] : ["report-contradiction"]);
        assert.equal(child.status, mode === "passing" ? 0 : 1);
      }
      assert.notEqual(stack.adapterVersion(), "node-ts@23");
    } finally { cleanup(root); }
  });

  it("keeps suite failures after diagnostic caps and tagged-example selection [EVD-05, TDD-02]", () => {
    const raw = JSON.parse(report(Array.from({ length: 6 }, () => ({
      status: "failed", failure: "AssertionError: expected true",
    })), "/p/a.test.ts", false));
    raw.testResults[0].message = "suite cleanup failed";
    raw.testResults[0].assertionResults[0].fullName = "[EX-1] behavior";
    const normalized = norm(JSON.stringify(raw)), file = normalized.files.get("a.test.ts")!;
    assert.equal(file.failures.length, 5);
    assert.deepEqual(file.failureKinds, ["assertion", "compile-or-import"]);
    for (const obligation of [ob, { ...ob, example: "EX-1" }]) {
      const receipt = one(obligation, run({ exit: 1 }), normalized);
      assert.equal(receipt.status, "fail");
      assert.deepEqual(receipt.failureKinds, ["assertion", "compile-or-import"]);
      assert.equal(baselineRed(receipt), false);
      assert.equal(receipt.limitations.some(note => note.includes("matched by")), false);
    }
  });

  it("retains real Vitest suite-hook errors beside failing assertions [EVD-05, TDD-02]", () => {
    const root = tmp("tenet-vitest-hook-"), stack = createStack();
    try {
      write(root, "vitest.config.mjs",
        'export default { test: { globals: true, include: ["probe.test.js"], maxWorkers: 1 } };\n');
      for (const mode of ["mixed", "hook", "assertion"] as const) {
        write(root, "probe.test.js",
          `test("behavior", () => expect(true).toBe(${mode === "hook"}));\n` +
          (mode === "assertion" ? "" : 'afterAll(() => { throw new TypeError("suite cleanup failed"); });\n'));
        const report = join(root, "report.json"), argv = stack.argv("all", report);
        const child = spawnSync(argv[0]!, [join(import.meta.dirname, "..", "..", "..", argv[1]!), ...argv.slice(2)], {
          cwd: root, env: { ...process.env, CI: "1" }, encoding: "utf8", timeout: 30_000,
        });
        assert.equal(child.error, undefined, child.stderr);
        assert.equal(child.status, 1);
        const raw = readFileSync(report, "utf8"), normalized = normalize(raw, root);
        assert.equal(normalized.invalid, undefined);
        const receipt = one({ ...ob, testFile: "probe.test.js" }, run({ exit: 1 }), normalized);
        assert.equal(receipt.status, "fail");
        assert.deepEqual(new Set(receipt.failureKinds),
          new Set(mode === "assertion" ? ["assertion"] : mode === "hook" ? ["compile-or-import"] : ["assertion", "compile-or-import"]));
        const matched = matchBaseline(
          { baseline: true, facts: { inv: { entries: new Map() } } } as Run,
          { obligations: [{ ...ob, testFile: "probe.test.js", expectation: "fail" }] } as WorkContract, [receipt],
        )[0]!.baselineMatched;
        assert.equal(matched, mode === "assertion", raw);
      }
      assert.notEqual(stack.adapterVersion(), "node-ts@22");
    } finally { cleanup(root); }
  });

  it("refuses real focused Vitest execution even when project configuration allows it [EVD-02, EVD-05]", () => {
    const root = tmp("tenet-vitest-focus-"), stack = createStack();
    try {
      write(root, "vitest.config.mjs",
        'export default { test: { globals: true, allowOnly: true, include: ["probe.test.js"], maxWorkers: 1 } };\n');
      for (const mode of ["focused", "passing", "assertion"] as const) for (const files of ["all", ["probe.test.js"]] as const) {
        write(root, "probe.test.js",
          `test${mode === "focused" ? ".only" : ""}("selected", () => expect(true).toBe(true));\n` +
          `test("sibling", () => expect(true).toBe(${mode === "passing"}));\n`);
        const report = join(root, "report.json");
        const argv = stack.argv(files === "all" ? files : [...files], report);
        const child = spawnSync(argv[0]!, [join(import.meta.dirname, "..", "..", "..", argv[1]!), ...argv.slice(2)], {
          cwd: root, env: { ...process.env, CI: "1" }, encoding: "utf8", timeout: 30_000,
        });
        assert.equal(child.error, undefined, child.stderr);
        const normalized = normalize(readFileSync(report, "utf8"), root);
        assert.equal(normalized.invalid, undefined);
        const receipt = one(suite, run({ exit: child.status ?? undefined }), normalized);
        assert.equal(receipt.status, mode === "focused" ? "inconclusive" : mode === "passing" ? "pass" : "fail",
          JSON.stringify({ mode, argv, receipt }));
        assert.deepEqual(receipt.reasons, mode === "focused" ? ["focused-tests"] : []);
        assert.equal(child.status, mode === "passing" ? 0 : 1);
        if (mode === "focused") assert.ok(receipt.counts!.focused > 0);
        else {
          assert.equal(receipt.counts!.executed, 2);
          assert.equal(receipt.counts!.skipped, 0);
          assert.deepEqual(receipt.failureKinds, mode === "passing" ? [] : ["assertion"]);
        }
      }
      assert.notEqual(stack.adapterVersion(), "node-ts@21");
    } finally { cleanup(root); }
  });

  it("classifies formatted Vitest assertions without rewriting recorded diagnostics [EVD-05, TDD-02, EVD-03]", () => {
    const assertion = "Error: \u001b[2mexpect(\u001b[22mreceived).toBe(expected)\n at a.test.ts:1:1";
    for (const [failure, expected] of [
      [assertion, "assertion"],
      ["\u001b[31mAssertionError: expected true\u001b[39m", "assertion"],
      ["\u001b[31mTypeError: cannot call expect(received)\u001b[39m", "runtime-error"],
      ["\u001b[31mTypeError: setup failed\u001b[39m\n at AssertionError.expect(a.test.ts:1:1)", "runtime-error"],
    ] as const) {
      const normalized = norm(report([{ status: "failed", failure }], "/p/a.test.ts", false));
      const receipt = one(ob, run({ exit: 1 }), normalized);
      assert.deepEqual(normalized.files.get("a.test.ts")!.failureKinds, [expected], failure);
      assert.deepEqual(receipt.failureKinds, [expected], failure);
      assert.equal(normalized.files.get("a.test.ts")!.failures[0]!.message, failure.split("\n")[0]);
      assert.equal(baselineRed(receipt), expected === "assertion", failure);
    }
    assert.notEqual(createStack().adapterVersion(), "node-ts@20");
  });

  it("invalidates normalization evidence that admitted oversized failure diagnostics [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@17");
  });
  it("bounds every assertion failure diagnostic at 2000 characters before display truncation [EVD-05]", () => {
    const raw = JSON.parse(report([{ status: "failed", failure: "AssertionError" }], "/p/a.test.ts", false));
    for (const message of ["x".repeat(2001), 42, null, {}]) {
      raw.testResults[0].assertionResults[0].failureMessages = ["AssertionError", message];
      const normalized = norm(JSON.stringify(raw));
      assert.equal(normalized.invalid, "invalid assertion failure messages");
      assert.equal(normalized.files.size, 0);
      assert.equal(normalized.discovered, 0);
      assert.equal(one(ob, run({ exit: 1 }), normalized).status, "inconclusive");
    }
    raw.testResults[0].assertionResults[0].failureMessages = ["AssertionError", "x".repeat(2000)];
    const normalized = norm(JSON.stringify(raw));
    assert.equal(normalized.invalid, undefined);
    assert.equal(one(ob, run({ exit: 1 }), normalized).status, "fail");
    assert.deepEqual(normalized.files.get("a.test.ts")!.failureKinds, ["assertion", "runtime-error"]);
  });
  it("invalidates normalization evidence that accepted execution in skipped files [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@15");
  });
  it("rejects executed assertions under pending or skipped file summaries [EVD-05]", () => {
    for (const status of ["pending", "skipped"]) {
      for (const assertion of ["passed", "failed"]) {
        const raw = JSON.parse(report([{ status: assertion }], "/p/a.test.ts", false));
        raw.testResults[0].status = status;
        const normalized = norm(JSON.stringify(raw));
        assert.equal(normalized.invalid, "a skipped file contains executed tests", `${status}/${assertion}`);
        assert.equal(normalized.files.size, 0);
        assert.equal(normalized.discovered, 0);
        assert.equal(one(ob, run({ exit: assertion === "failed" ? 1 : 0 }), normalized).status, "inconclusive");
      }
      const raw = JSON.parse(report([{ status: "skipped" }], "/p/a.test.ts", false));
      raw.testResults[0].status = status;
      const normalized = norm(JSON.stringify(raw));
      assert.equal(normalized.invalid, undefined);
      assert.equal(normalized.files.get("a.test.ts")!.executed, 0);
      assert.equal(normalized.files.get("a.test.ts")!.skipped, 1);
      assert.equal(one(ob, run(), normalized).status, "inconclusive");
    }
  });
  it("returns invalid for malformed file statuses and failure messages without throwing [EVD-05]", () => {
    for (const variant of ["file-status", "message-type"]) {
      const raw = JSON.parse(report([{ status: "failed", failure: "AssertionError" }]));
      if (variant === "file-status") raw.testResults[0].status = "invented";
      else raw.testResults[0].assertionResults[0].failureMessages = [{ instruction: "untrusted data" }];
      let result: ReturnType<typeof norm> | undefined;
      assert.doesNotThrow(() => { result = norm(JSON.stringify(raw)); });
      assert.ok(result?.invalid, variant);
    }
  });
  it("keeps malformed reporter structures from producing passing receipts [EVD-02, EVD-05]", () => {
    const notString = fc.oneof(
      fc.constant(null), fc.boolean(), fc.integer(), fc.array(fc.integer(), { maxLength: 3 }),
      fc.dictionary(fc.string(), fc.integer(), { maxKeys: 3 }),
    );
    const notArray = fc.oneof(
      fc.constant(null), fc.boolean(), fc.integer(), fc.string(),
      fc.dictionary(fc.string(), fc.integer(), { maxKeys: 3 }),
    );
    const notRecord = fc.oneof(
      fc.constant(null), fc.boolean(), fc.integer(), fc.string(), fc.array(fc.integer(), { maxLength: 3 }),
    );
    const notBoolean = fc.oneof(
      fc.constant(null), fc.integer(), fc.string(), fc.array(fc.integer(), { maxLength: 3 }),
      fc.dictionary(fc.string(), fc.integer(), { maxKeys: 3 }),
    );
    const badStatus = (valid: string[]) => fc.oneof(notString, fc.string().filter((value) => !valid.includes(value)));
    const badMessages = fc.oneof(
      notArray, fc.array(notString, { minLength: 1, maxLength: 3 }), fc.array(fc.string(), { minLength: 1, maxLength: 3 }),
    );
    const badErrors = fc.oneof(
      notArray, fc.array(notRecord, { minLength: 1, maxLength: 3 }),
      fc.array(fc.record({ message: fc.string() }), { minLength: 1, maxLength: 3 }),
    );
    const badTotal = fc.nat({ max: 30000 }).filter((value) => value !== 2);
    const vitestAssertion = { fullName: "[EX-1] behavior", status: "passed", failureMessages: [] };
    const vitestControl = { name: "/p/a.test.ts", status: "passed", assertionResults: [vitestAssertion] };
    const vitestFile = { ...vitestControl, name: "/p/b.test.ts" };
    const playwrightResult = { status: "passed", errors: [] };
    const playwrightTest = { status: "expected", results: [playwrightResult] };
    const playwrightSpec = { title: "[EX-1] behavior", ok: true, tests: [playwrightTest] };
    const playwrightControl = { file: "a.test.ts", title: "a.test.ts", specs: [playwrightSpec] };
    const playwrightSuite = { ...playwrightControl, file: "b.test.ts", title: "b.test.ts" };
    const playwrightStats = { expected: 2, unexpected: 0, skipped: 0, flaky: 0 };
    const vitest = (file: unknown) => ({ testResults: [vitestControl, file], numTotalTests: 2 });
    const playwright = (suite: unknown) => ({ suites: [playwrightControl, suite], stats: playwrightStats });
    const examples: Array<{
      name: string;
      values: fc.Arbitrary<unknown>;
      build: (value: unknown) => unknown;
      parse: (raw: string) => ReturnType<typeof norm>;
    }> = [
      { name: "Vitest file", values: notRecord, build: (value) => vitest(value), parse: norm },
      { name: "Vitest file name", values: notString, build: (value) => vitest({ ...vitestFile, name: value }), parse: norm },
      { name: "Vitest file status", values: badStatus(["passed", "failed", "pending", "skipped"]), build: (value) => vitest({ ...vitestFile, status: value }), parse: norm },
      { name: "Vitest assertions", values: notArray, build: (value) => vitest({ ...vitestFile, assertionResults: value }), parse: norm },
      { name: "Vitest assertion", values: notRecord, build: (value) => vitest({ ...vitestFile, assertionResults: [value] }), parse: norm },
      { name: "Vitest assertion name", values: notString, build: (value) => vitest({ ...vitestFile, assertionResults: [{ ...vitestAssertion, fullName: value }] }), parse: norm },
      { name: "Vitest assertion status", values: badStatus(["passed", "failed", "pending", "skipped", "todo", "disabled"]), build: (value) => vitest({ ...vitestFile, assertionResults: [{ ...vitestAssertion, status: value }] }), parse: norm },
      { name: "Vitest failure messages", values: badMessages, build: (value) => vitest({ ...vitestFile, assertionResults: [{ ...vitestAssertion, failureMessages: value }] }), parse: norm },
      { name: "Vitest population", values: badTotal, build: (value) => ({ ...vitest(vitestFile), numTotalTests: value }), parse: norm },
      { name: "Playwright suite", values: notRecord, build: (value) => playwright(value), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright specs", values: notArray, build: (value) => playwright({ ...playwrightSuite, specs: value }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright spec", values: notRecord, build: (value) => playwright({ ...playwrightSuite, specs: [value] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright spec title", values: notString, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, title: value }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright spec summary", values: notBoolean, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, ok: value }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright tests", values: notArray, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: value }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright test", values: notRecord, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: [value] }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright test status", values: badStatus(["expected", "unexpected", "flaky", "skipped"]), build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: [{ ...playwrightTest, status: value }] }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright results", values: notArray, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: [{ ...playwrightTest, results: value }] }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright result", values: notRecord, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: [{ ...playwrightTest, results: [value] }] }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright result status", values: badStatus(["passed", "failed", "skipped", "timedOut", "interrupted"]), build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: [{ ...playwrightTest, results: [{ ...playwrightResult, status: value }] }] }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright result errors", values: badErrors, build: (value) => playwright({ ...playwrightSuite, specs: [{ ...playwrightSpec, tests: [{ ...playwrightTest, results: [{ ...playwrightResult, errors: value }] }] }] }), parse: (raw) => normalizePlaywright(raw, "/p") },
      { name: "Playwright population", values: badTotal, build: (value) => ({ ...playwright(playwrightSuite), stats: { ...playwrightStats, expected: value } }), parse: (raw) => normalizePlaywright(raw, "/p") },
    ];
    for (const { name, values, build, parse } of examples) {
      fc.assert(fc.property(values, (value) => {
        const normalized = parse(JSON.stringify(build(value)));
        assert.ok(normalized.invalid, `${name}: ${JSON.stringify(value)}`);
        assert.equal(normalized.files.size, 0, name);
        assert.equal(normalized.discovered, 0, name);
        for (const obligation of [ob, { ...ob, example: "EX-1" }, suite]) {
          const receipt = one(obligation, run(), normalized);
          assert.equal(receipt.status, "inconclusive", name);
          assert.deepEqual(receipt.reasons, ["report-invalid"], name);
        }
      }), { numRuns: 100, seed: 20261106 });
    }
    for (const normalized of [
      norm(JSON.stringify(vitest(vitestFile))),
      normalizePlaywright(JSON.stringify(playwright(playwrightSuite)), "/p"),
    ]) {
      assert.equal(normalized.invalid, undefined);
      for (const obligation of [ob, { ...ob, example: "EX-1" }, suite])
        assert.equal(one(obligation, run(), normalized).status, "pass");
    }
  });
  it("invalidates normalization evidence from before total-population admission [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@14");
  });
  it("rejects supplied total-test counts that disagree with the complete assertion population [EVD-05]", () => {
    const raw = JSON.parse(report([{ status: "passed" }], "/p/a.test.ts", false));
    for (const numTotalTests of [2, 0, -1, 1.5, "1", null, {}, []]) {
      const normalized = norm(JSON.stringify({ ...raw, numTotalTests }));
      assert.equal(normalized.invalid, "the report's total and its assertions disagree", JSON.stringify(numTotalTests));
      assert.equal(normalized.files.size, 0);
      assert.equal(normalized.discovered, 0);
      assert.equal(one(ob, run(), normalized).status, "inconclusive");
    }
    for (const report of [raw, { ...raw, numTotalTests: 1 }]) {
      const normalized = norm(JSON.stringify(report));
      assert.equal(normalized.invalid, undefined);
      assert.equal(normalized.discovered, 1);
      assert.equal(one(ob, run(), normalized).status, "pass");
    }
  });
  it("preserves bounded report admission diagnostics before population normalization [EVD-05]", () => {
    let deep: unknown = 0;
    for (let i = 0; i < 65; i++) deep = { nested: deep };
    const cases: Array<[string, string]> = [
      [" ".repeat(10 * 1024 * 1024 + 1), "the report exceeds 10 MB"],
      ["{", "the report is not valid JSON"],
      ["null", "the report has no testResults"],
      ['{"testResults":{}}', "the report has no testResults"],
      [JSON.stringify({ testResults: Array(2001).fill(null) }), "too many test files; the report was not fully normalized"],
      [JSON.stringify({ testResults: [], deep }), "the report exceeds depth 64"],
    ];
    for (const [raw, expected] of cases) {
      const normalized = norm(raw);
      assert.equal(normalized.invalid, expected);
      assert.equal(normalized.files.size, 0);
      assert.equal(normalized.discovered, 0);
    }
  });
  it("invalidates the adapter identity that accepted contradictory Vitest reports [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@12");
  });
  it("invalidates normalization evidence from the earlier failure-classification adapter [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@13");
  });
  it("rejects passing assertions carrying failure messages, including empty diagnostics [EVD-05]", () => {
    for (const messages of [["AssertionError: expected true"], [""]]) {
      const raw = JSON.parse(report([{ status: "passed" }]));
      raw.testResults[0].assertionResults[0].failureMessages = messages;
      const normalized = norm(JSON.stringify(raw));
      assert.equal(normalized.invalid, "the assertion status and its failure messages disagree");
      assert.equal(normalized.files.size, 0);
      assert.equal(normalized.discovered, 0);
      assert.equal(one(ob, run(), normalized).status, "inconclusive");
    }
    assert.equal(one(ob, run(), norm(report([{ status: "passed" }]))).status, "pass");
  });
  it("rejects report file identities that are empty, workspace directories or contain NUL [EVD-05]", () => {
    for (const path of ["", ".", "/p", "a\0.test.ts"]) {
      const normalized = norm(report([{ status: "passed" }], path, false));
      assert.ok(normalized.invalid, JSON.stringify(path));
      assert.equal(normalized.files.size, 0);
      assert.equal(one(suite, run(), normalized).status, "inconclusive");
    }
  });
  it("keeps classification of every failure even when diagnostic examples are capped [EVD-05]", () => {
    const tests = [...Array.from({ length: 5 }, () => ({ status: "failed", failure: "AssertionError: expected 1 to be 2" })), { status: "failed", failure: "TypeError: setup crashed" }];
    const r = one(ob, run({ exit: 1 }), norm(report(tests)));
    assert.equal(r.failures!.length, 5);
    assert.deepEqual(new Set(r.failureKinds), new Set(["assertion", "runtime-error"]));
  });
  it("retains all errors on one failed assertion, including after tagged selection [EVD-05, TDD-02]", () => {
    const raw = JSON.parse(report([{ status: "failed", failure: "AssertionError: expected true" }], "/p/a.test.ts", false));
    raw.testResults[0].assertionResults[0].fullName = "[EX-1] mixed failures";
    raw.testResults[0].assertionResults[0].failureMessages.push("TypeError: cleanup crashed");
    for (const obligation of [ob, { ...ob, example: "EX-1" }]) {
      const receipt = one(obligation, run({ exit: 1 }), norm(JSON.stringify(raw)));
      assert.equal(receipt.status, "fail");
      assert.deepEqual(new Set(receipt.failureKinds), new Set(["assertion", "runtime-error"]));
    }
    raw.testResults[0].assertionResults[0].failureMessages.push("Error: [Vitest] Unexpected .only modifier.");
    assert.deepEqual(one({ ...ob, example: "EX-1" }, run({ exit: 1 }), norm(JSON.stringify(raw))).reasons, ["focused-tests"]);
  });
  it("does not classify assertion-looking runtime stack frames as assertion failures [EVD-05, TDD-02]", () => {
    const raw = JSON.parse(report([{ status: "failed", failure: "TypeError: cleanup crashed\n at AssertionError.toEqual (cleanup.ts:1:1)" }], "/p/a.test.ts", false));
    assert.deepEqual(one(ob, run({ exit: 1 }), norm(JSON.stringify(raw))).failureKinds, ["runtime-error"]);
  });
  it("invalidates normalization evidence that matched assertion words inside runtime diagnostics [EVD-03]", () => {
    assert.notEqual(createStack().adapterVersion(), "node-ts@16");
  });
  it("does not classify assertion-looking runtime first lines as assertion failures [EVD-05, TDD-02]", () => {
    let actual: string | undefined;
    try { (undefined as unknown as { toEqual(): void }).toEqual(); }
    catch (error) { actual = String(error); }
    assert.match(actual!, /^TypeError:/);
    const diagnostics = [actual!, "TypeError: expect(value) is not a function", "ReferenceError: toBe is not defined",
      "RangeError: expected length to be positive", "SyntaxError: unexpected AssertionError token",
      "Error: failed to match a route", "URIError: malformed toEqual input"];
    for (const failure of diagnostics) {
      const receipt = one(ob, run({ exit: 1 }), norm(report([{ status: "failed", failure }], "/p/a.test.ts", false)));
      assert.deepEqual(receipt.failureKinds, ["runtime-error"], failure);
      assert.equal(receipt.status, "fail");
      assert.equal(baselineRed(receipt), false, failure);
    }
  });
  it("retains supported assertion, focused and timeout diagnostic prefixes [EVD-05, TDD-02]", () => {
    const cases = [
      ["AssertionError: expected 1 to deeply equal 2", "assertion"],
      ["expected 1 to be 2", "assertion"],
      ["expect(received).toEqual(expected)", "assertion"],
      ["Error: expect(received).toBe(expected)", "assertion"],
      ["Error: Test timed out in 1000ms.", "timeout"],
      ["Error: [Vitest] Unexpected .only modifier.", "focused"],
    ];
    for (const [failure, expected] of cases) {
      const receipt = one(ob, run({ exit: 1 }), norm(report([{ status: "failed", failure }], "/p/a.test.ts", false)));
      assert.deepEqual(receipt.failureKinds, [expected], failure);
      assert.equal(baselineRed(receipt), expected === "assertion", failure);
    }
  });
  it("never passes a terminated process or a duplicate report identity [EVD-02, EVD-05]", () => {
    const good = report([{ status: "passed" }]);
    assert.equal(one(ob, run({ exit: undefined, signal: "SIGKILL" }), norm(good)).status, "inconclusive");
    const duplicate = JSON.parse(good);
    duplicate.testResults.unshift({ ...duplicate.testResults[0], status: "failed", assertionResults: [{ fullName: "bad", status: "failed", failureMessages: ["AssertionError"] }] });
    assert.equal(one(ob, run(), norm(JSON.stringify(duplicate))).status, "inconclusive");
  });
  it("refuses outside paths, unknown test statuses and silent report overflow [EVD-05]", () => {
    assert.ok(norm(report([{ status: "passed" }], "/elsewhere/a.test.ts")).invalid);
    assert.ok(norm(report([{ status: "invented" }])).invalid);
    const many = JSON.parse(report([{ status: "passed" }]));
    many.testResults = Array.from({ length: 2001 }, (_, n) => ({ ...many.testResults[0], name: `/p/${n}.test.ts` }));
    assert.ok(norm(JSON.stringify(many)).invalid);
  });
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
  it("rejects a zero exit against a failure anywhere in the run, including outside tagged selection [EVD-02, EVD-05]", () => {
    const raw = JSON.parse(report([{ status: "passed" }]));
    raw.testResults[0].assertionResults[0].fullName = "[EX-1] selected pass";
    raw.testResults[1].status = "failed";
    raw.testResults[1].assertionResults[0] = { fullName: "sibling failure", status: "failed", failureMessages: ["AssertionError"] };
    for (const obligation of [ob, { ...ob, example: "EX-1" }, suite]) {
      const receipt = one(obligation, run(), norm(JSON.stringify(raw)));
      assert.equal(receipt.status, "inconclusive");
      assert.deepEqual(receipt.reasons, ["report-contradiction"]);
    }
    raw.testResults[0].assertionResults.push(raw.testResults[1].assertionResults[0]);
    const tagged = one({ ...ob, example: "EX-1" }, run(), norm(JSON.stringify(raw)));
    assert.equal(tagged.status, "inconclusive");
    assert.deepEqual(tagged.reasons, ["report-contradiction"]);
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
    assert.deepEqual([a.status, a.limitations], ["inconclusive", ["1 skipped"]]);
  });
  it("reports a test file that does not exist yet as not executed, with the reason", () => {
    const r = one(ob, run(), norm(report([{ status: "passed" }])), { ...ctx, missing: new Set(["OB-1"]) });
    assert.deepEqual([r.status, r.reasons, r.limitations], ["inconclusive", ["not-executed"], ["the test file does not exist yet"]]);
  });
  it("matches each obligation to its own tagged assertions when examples share a test file, instead of the whole file's aggregate", () => {
    const raw = JSON.stringify({
      testResults: [{
        name: "/p/a.test.ts",
        status: "failed",
        assertionResults: [
          { fullName: "[EX-1] new behavior", status: "failed", failureMessages: ["AssertionError: expected x"] },
          { fullName: "[EX-2] keeps old behavior", status: "passed", failureMessages: [] },
        ],
      }],
    });
    const distinguishing: Obligation = { id: "OB-a", kind: "test", category: "acceptance", testFile: "a.test.ts", example: "EX-1" };
    const preservation: Obligation = { id: "OB-b", kind: "test", category: "acceptance", testFile: "a.test.ts", example: "EX-2" };
    const [ra, rb] = receiptsFrom(run({ exit: 1 }), norm(raw), [distinguishing, preservation], ctx);
    assert.equal(ra!.status, "fail");
    assert.equal(rb!.status, "pass", "a passing preservation example must not inherit a sibling's failure just because they share a file");
  });
  it("falls back to the whole file's aggregate when no assertion names an obligation's example, unchanged from before", () => {
    const a: Obligation = { id: "OB-a", kind: "test", category: "acceptance", testFile: "a.test.ts", example: "EX-9" };
    const b: Obligation = { id: "OB-b", kind: "test", category: "acceptance", testFile: "a.test.ts", example: "EX-10" };
    const n = norm(report([{ status: "failed", failure: "AssertionError: x" }, { status: "passed" }], "/p/a.test.ts", false));
    const [ra, rb] = receiptsFrom(run({ exit: 1 }), n, [a, b], ctx);
    assert.equal(ra!.status, "fail");
    assert.equal(rb!.status, "fail", "with no tag naming either obligation, both still see the shared file's aggregate result");
  });

  it("retains a tagged failure beyond the diagnostic cap [EVD-02, EVD-05]", () => {
    const data = JSON.parse(report(Array.from({ length: 6 }, () => ({ status: "failed", failure: "AssertionError: expected x" }))));
    data.testResults[0].assertionResults[5].fullName = "[EX-6] sixth failure";
    const receipt = one({ ...ob, example: "EX-6" }, run({ exit: 1 }), norm(JSON.stringify(data)));
    assert.equal(receipt.status, "fail");
    assert.equal(receipt.counts?.failed, 1);
    assert.deepEqual(receipt.failureKinds, ["assertion"]);
  });

  it("never turns a tagged skipped test into an executed pass [EVD-02]", () => {
    const data = JSON.parse(report([{ status: "passed" }, { status: "skipped" }]));
    data.testResults[0].assertionResults[1].fullName = "[EX-2] skipped example";
    const receipt = one({ ...ob, example: "EX-2" }, run(), norm(JSON.stringify(data)));
    assert.equal(receipt.status, "inconclusive");
    assert.equal(receipt.counts?.executed, 0);
    assert.equal(receipt.counts?.skipped, 1);
  });

  it("does not narrow away a file-level failure or focused sibling [EVD-02, EVD-05]", () => {
    for (const focused of [false, true]) {
      const assertions = [{ fullName: "[EX-1] passing example", status: "passed", failureMessages: [] as string[] }];
      if (focused) assertions.push({
        fullName: "another test", status: "failed", failureMessages: ["Error: [Vitest] Unexpected .only modifier."],
      });
      const raw = JSON.stringify({ testResults: [{
        name: "/p/a.test.ts", status: "failed", message: "Cannot find module './setup'", assertionResults: assertions,
      }] });
      assert.notEqual(one({ ...ob, example: "EX-1" }, run({ exit: 1 }), norm(raw)).status, "pass");
    }
  });

  it("matches the full example tag rather than another example's numeric prefix [EVD-05]", () => {
    const data = JSON.parse(report([{ status: "failed", failure: "AssertionError: expected x" }, { status: "passed" }]));
    data.testResults[0].assertionResults[0].fullName = "[EX-1] first";
    data.testResults[0].assertionResults[1].fullName = "[EX-10] tenth";
    const receipt = one({ ...ob, example: "EX-1" }, run({ exit: 1 }), norm(JSON.stringify(data)));
    assert.equal(receipt.counts?.executed, 1);
    assert.equal(receipt.counts?.failed, 1);
  });
});

describe("settling reruns of a failed required check [EVD-08]", () => {
  const failed = (id = "OB-1") => ({ ...one(ob, run({ exit: 1 }), norm(report([{ status: "failed", failure: "AssertionError: expected 1 to be 2" }]))), id: `RC-${id}` });
  const passed = () => one(ob, run({ exit: 0 }), norm(report([{ status: "passed" }])));
  const inconclusive = () => one(ob, run({ after: "d1" }), norm(report([{ status: "passed" }])));

  it("a pass after a failure is flaky: it keeps the failing names, the first receipt's identity and the history", () => {
    const [r] = settleReruns([failed()], [[passed()]]);
    assert.deepEqual([r!.status, r!.qualifiers, r!.id], ["pass", ["flaky"], "RC-OB-1"]);
    assert.deepEqual(r!.history!.map((h) => h.status), ["fail", "pass"]);
    assert.ok(r!.history![0]!.failed.length >= 1);
  });
  it("a failure on every attempt stays a failure, with its history and no flaky qualifier", () => {
    const [r] = settleReruns([failed()], [[failed()], [failed()]]);
    assert.deepEqual([r!.status, r!.qualifiers, r!.history!.length], ["fail", [], 3]);
  });
  it("a rerun that is inconclusive (an input moved) never turns a failure into a pass", () => {
    const [r] = settleReruns([failed()], [[inconclusive()], [passed()]]);
    assert.equal(r!.status, "fail");
    assert.deepEqual(r!.qualifiers, []);
    assert.equal(r!.history![1]!.status, "inconclusive");
  });
  it("leaves a passing or inconclusive first receipt and unrelated obligations alone", () => {
    const p = passed();
    assert.deepEqual(settleReruns([p], [[passed()]]), [p]);
    const other = { ...failed(), obligation: "OB-2" };
    assert.deepEqual(settleReruns([other], [[passed()]]), [other], "a rerun of another obligation says nothing about this one");
  });
  it("keeps at most three history entries and five failing names", () => {
    const many = one(ob, run({ exit: 1 }), norm(report(Array.from({ length: 9 }, () => ({ status: "failed", failure: "AssertionError: x" })))));
    const [r] = settleReruns([many], [[many], [many], [many]]);
    assert.ok(r!.history!.length <= 3 && r!.history!.every((h) => h.failed.length <= 5));
  });
});
