// Typecheck and lint as obligations the kernel runs itself (TS §9.1, §9.5; PRD 4.5.2: every required check has a fresh pass).
// A test run that passes while the project does not compile is not a checked result.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeStatic } from "../src/adapters/node-ts.ts";
import { deriveObligations, wantedStatic, withStatic } from "../src/core/obligations.ts";
import { staticReceipt } from "../src/core/receipts.ts";
import type { ReceiptContext, RunFacts } from "../src/core/receipts.ts";
import type { Obligation } from "../src/core/schemas.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, focusFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

describe("normalizing typecheck output [EVD-05]", () => {
  it("passes a clean run and names each error with its file, line and code", () => {
    assert.deepEqual(normalizeStatic("tsc", { exit: 0, raw: "" }), { status: "pass", failures: [] });
    const out = "src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.\nerror TS5083: Cannot read file 'x'.\n";
    const r = normalizeStatic("tsc", { exit: 2, raw: out });
    assert.equal(r.status, "fail");
    assert.deepEqual(r.failures[0], { test: "src/a.ts:3", kind: "type-error", message: "TS2322 Type 'string' is not assignable to type 'number'." });
    assert.equal(r.failures[1]!.kind, "configuration");
  });
  it("calls a run invalid when its exit status and its output disagree, rather than guessing", () => {
    assert.equal(normalizeStatic("tsc", { exit: 0, raw: "src/a.ts(1,1): error TS1: x\n" }).status, "invalid");
    assert.equal(normalizeStatic("tsc", { exit: 2, raw: "something unexpected\n" }).status, "invalid");
    assert.equal(normalizeStatic("tsc", { exit: 2, raw: null }).status, "invalid");
  });
});

describe("normalizing lint output [EVD-05]", () => {
  const file = (errors: number, over: Record<string, unknown> = {}) => ({
    filePath: "/p/src/a.ts", errorCount: errors, warningCount: 1,
    messages: errors ? [{ ruleId: "no-undef", severity: 2, message: "x is not defined", line: 4 }] : [{ ruleId: "x", severity: 1, message: "warn", line: 1 }], ...over,
  });
  it("fails on errors, ignores warnings, and keeps rule, file and line", () => {
    assert.deepEqual(normalizeStatic("eslint", { exit: 0, raw: JSON.stringify([file(0)]) }), { status: "pass", failures: [] });
    const r = normalizeStatic("eslint", { exit: 1, raw: JSON.stringify([file(1)]) });
    assert.equal(r.status, "fail");
    assert.deepEqual(r.failures[0], { test: "/p/src/a.ts:4", kind: "lint-error", message: "no-undef x is not defined" });
  });
  it("is invalid when nothing was linted, the report is malformed, or exit status and report disagree", () => {
    for (const [exit, raw] of [[0, "[]"], [0, "not json"], [0, JSON.stringify({ not: "an array" })], [1, JSON.stringify([file(0)])], [0, JSON.stringify([file(1)])], [2, JSON.stringify([file(0)])], [0, null]] as const) {
      assert.equal(normalizeStatic("eslint", { exit, raw }).status, "invalid", `${exit} ${raw}`);
    }
  });
});

describe("static receipts", () => {
  const ob: Obligation = { id: "OB-types", kind: "static", category: "boundary", tool: "tsc" };
  const ctx: ReceiptContext = { stage: "candidate", scope: "full", id: "chk", candidate: "c", runId: "r", runDir: "/d", argv: ["tsc"], before: "d0", versions: { node: "v", tool: "5", reporter: "tsc", adapter: "a", static: { tsc: "5.9.3" } }, missing: new Set() };
  const run = (over: Partial<RunFacts> = {}): RunFacts => ({ exit: 0, timedOut: false, durationMs: 5, startedAt: "t", raw: "", after: "d0", ran: true, ...over });
  it("passes only a completed run on an unchanged tree", () => {
    assert.equal(staticReceipt(run(), normalizeStatic("tsc", { exit: 0, raw: "" }), ob, 0, ctx).status, "pass");
  });
  it("turns failures into a failed receipt and everything unprovable into an inconclusive one", () => {
    const failed = staticReceipt(run({ exit: 2, raw: "a.ts(1,1): error TS1: bad\n" }), normalizeStatic("tsc", { exit: 2, raw: "a.ts(1,1): error TS1: bad\n" }), ob, 0, ctx);
    assert.equal(failed.status, "fail");
    assert.equal(failed.failures![0]!.kind, "type-error");
    const cases: Array<[RunFacts, string]> = [[run({ ran: false }), "not-executed"], [run({ timedOut: true }), "timeout"], [run({ after: "d1" }), "concurrent-edit"], [run({ exit: undefined, signal: "SIGKILL" }), "not-executed"]];
    for (const [facts, why] of cases) {
      const r = staticReceipt(facts, normalizeStatic("tsc", { exit: 0, raw: "" }), ob, 0, ctx);
      assert.equal(r.status, "inconclusive");
      assert.deepEqual(r.reasons, [why]);
    }
    const bad = staticReceipt(run(), normalizeStatic("tsc", { exit: 2, raw: "?" }), ob, 0, ctx);
    assert.deepEqual([bad.status, bad.reasons], ["inconclusive", ["report-invalid"]]);
  });
});

describe("which static checks a contract needs", () => {
  it("wants both after a starter scaffold, and only what a required check names otherwise [QLT-06]", () => {
    assert.deepEqual(wantedStatic(["tsc", "eslint"], []), ["tsc", "eslint"]);
    assert.deepEqual(wantedStatic([], []), []);
    assert.deepEqual(wantedStatic([], [{ id: "types" }]), ["tsc"]);
    assert.deepEqual(wantedStatic([], [{ id: "lint", tool: "eslint" }, { id: "types", tool: "tsc" }]), ["tsc", "eslint"]);
    assert.deepEqual(wantedStatic([], [{ id: "types", tool: "mypy" }, { id: "perf" }]), [], "an unknown tool or check is not ours to run");
  });
  it("adds them once, keeps earlier ones, and leaves the acceptance obligations alone", () => {
    const base = deriveObligations([], "vitest", []);
    const once = withStatic(base, ["tsc"]);
    assert.deepEqual(once.map((o) => o.id), ["OB-suite", "OB-types"]);
    assert.deepEqual(withStatic(once, ["tsc", "eslint"]).map((o) => o.id), ["OB-suite", "OB-types", "OB-lint"]);
    assert.deepEqual(withStatic(once, []), once);
  });
});

describe("a contract with a required type check", () => {
  const TSCONFIG = '{"compilerOptions":{"strict":true,"module":"NodeNext","target":"ES2023","noEmit":true,"allowImportingTsExtensions":true,"skipLibCheck":true,"types":[]}}\n';
  const POLICY = JSON.stringify({ required_checks: [{ id: "types", property: "the project compiles", tool: "tsc" }] });
  const fresh = (): Project => { const p = project({ "tsconfig.json": TSCONFIG, "tenet.policy.json": POLICY }); roots.push(p.root); return p; };
  const toGreen = async (p: Project, impl: string) => {
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", impl);
    return { h, g: await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] }) };
  };

  it("runs tsc itself, and a passing test run cannot hide a type error [EVD-01, QLT-06]", async () => {
    const p = fresh();
    const { h, g } = await toGreen(p, `${GREET_IMPL}export const n: number = "not a number";\n`);
    const types = d(g).receipts.find((r: { obligation: string }) => r.obligation === "OB-types");
    assert.equal(types.status, "fail", JSON.stringify(g));
    assert.equal(d(g).receipts.find((r: { obligation: string }) => r.obligation === "OB-suite").status, "pass", "the tests themselves pass");
    assert.ok(g.reasons.some((r) => r.code === "evidence-failed" && /OB-types/.test(r.message)));
    await focusFixture(p, h);
    const f = await finishFixture(p, { h });
    assert.equal(f.exit, 2, "finish does not close while an introduced failure remains and attempts are left");
    assert.ok(f.reasons.some((r) => r.code === "continue-required"));
    assert.ok(f.reasons.some((r) => r.code === "evidence-failed" && /OB-types/.test(r.message)));
  });

  it("reaches checked-local when the project compiles, with a receipt for the type check [EVD-02, EVD-12]", async () => {
    const p = fresh();
    const { h, g } = await toGreen(p, GREET_IMPL);
    const types = d(g).receipts.find((r: { obligation: string }) => r.obligation === "OB-types");
    assert.equal(types.status, "pass", JSON.stringify(g));
    const receipt = Object.values(p.ports().store.read()!.state.work)[0]!.receipts.find((r) => r.obligation === "OB-types")!;
    assert.equal(receipt.kind, "static");
    assert.equal(receipt.scope, "full");
    assert.ok(receipt.argv.some((a) => /tsc/.test(a)));
    await focusFixture(p, h);
    const f = await finishFixture(p, { h, subject: "Add greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f));
  });

  it("still refuses a required check the kernel has no way to run, instead of passing over it [CFG-11, NFR-03]", async () => {
    const p = project({ "tenet.policy.json": JSON.stringify({ required_checks: [{ id: "perf", property: "latency stays low" }] }) });
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "x", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const check = await p.call("check", { h, stage: "candidate" });
    assert.equal(check.exit, 2);
    assert.ok(check.reasons.some((r) => r.code === "capability-missing" && /perf/.test(r.message)), JSON.stringify(check.reasons));
  });

  it("leaves a project without a required check exactly as before [WRK-02]", async () => {
    const p = project(); roots.push(p.root);
    const { g } = await toGreen(p, GREET_IMPL);
    assert.ok(!d(g).receipts.some((r: { obligation: string }) => r.obligation === "OB-types"));
  });
});
