// A required check that fails and then passes on unchanged inputs is flaky, never a pass (EVD-08, PRD §4.4.1, TS §9.9),
// and an input that changes while a check runs makes that result inconclusive (EVD-11). Real Git, real test processes.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { rmSync } from "node:fs";
import { join } from "node:path";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { cleanup, tmp } from "./helpers.ts";
import { BASIS, GREET_IMPL, callWithEnvelopeConsent, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const launched = (p: Project) => Object.values(p.ports().store.read()!.state.work)[0]!.budget.checksLaunched;
const receiptOf = (r: { data?: unknown }) => d(r).receipts[0] as Record<string, any>;

/** An acceptance test whose first N runs fail by throwing (counted through a file outside the project), then asserts for real. */
const flakyTest = (marks: string, failFirst: number) => `import { expect, it } from "vitest";
import { existsSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { greet } from "./greet.ts";
it("greets by name", () => {
  const seen = readdirSync(${JSON.stringify(marks)}).length;
  writeFileSync(join(${JSON.stringify(marks)}, "run-" + seen), "1");
  if (seen < ${failFirst}) throw new Error("flaky run " + seen);
  expect(greet("Ada")).toBe("Hello, Ada!");
});
`;

/** Through baseline (a real assertion red), with the implementation written and the run marks cleared before the candidate check. */
async function toCandidate(failFirst: number) {
  const p = project(); roots.push(p.root);
  const marks = tmp("tenet-marks-"); roots.push(marks);
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", flakyTest(marks, 0));
  const red = await p.call("check", { h, stage: "baseline" });
  assert.equal(red.next[0]!.action, "implement", JSON.stringify(red));
  const afterBaseline = launched(p);
  for (const f of ["run-0", "run-1", "run-2", "run-3"]) rmSync(join(marks, f), { force: true });
  p.write("src/greet.test.ts", flakyTest(marks, failFirst));
  p.write("src/greet.ts", GREET_IMPL);
  return { p, h, marks, afterBaseline };
}

describe("flaky required checks [EVD-08]", () => {
  it("a planned red is run once and never rerun", async () => {
    const { afterBaseline } = await toCandidate(0);
    assert.equal(afterBaseline, 1);
  });

  it("fails once, passes on the rerun: pass with the flaky qualifier, two launched checks, no review, never checked-local", async () => {
    const { p, h, afterBaseline } = await toCandidate(1);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const rc = receiptOf(r);
    assert.deepEqual([rc.status, rc.qualifiers], ["pass", ["flaky"]]);
    assert.deepEqual(rc.history.map((x: any) => x.status), ["fail", "pass"]);
    assert.equal(launched(p) - afterBaseline, 4, "two obligations in the first run, and the two that failed rerun once");
    assert.ok(r.reasons.some((x) => x.code === "evidence-flaky"), JSON.stringify(r.reasons));
    assert.notEqual(r.next[0]!.action, "review", "a flaky pass does not issue a review");
    const f = await p.call("finish", { h, subject: "Add greet", noCommit: true });
    assert.notEqual(d(f).endpoint, "checked-local");
    assert.ok(f.reasons.some((x) => x.code === "evidence-flaky"));
  });

  it("fails on every attempt: a failure with three launched checks and no flaky qualifier", async () => {
    const { p, h, afterBaseline } = await toCandidate(9);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const rc = receiptOf(r);
    assert.deepEqual([rc.status, rc.qualifiers, rc.history.length], ["fail", [], 3]);
    assert.equal(launched(p) - afterBaseline, 6, "two obligations in the first run, and the two that failed rerun twice");
    assert.equal(r.next[0]!.action, "implement");
  });

  it("a passing check is not rerun", async () => {
    const { p, h, afterBaseline } = await toCandidate(0);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(receiptOf(r).status, "pass");
    assert.equal(receiptOf(r).history, undefined);
    assert.equal(launched(p) - afterBaseline, 2, "two obligations, one run, no rerun");
  });
});

describe("an input that changes while a check runs [EVD-11]", () => {
  it("a file edited by a real process during the run makes the receipt inconclusive and publishes no pass", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", `import { expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { greet } from "./greet.ts";
it("greets by name", () => { writeFileSync("src/edited-while-running.ts", "export const x = 1;\\n"); expect(greet("Ada")).toBe("Hello, Ada!"); });
`);
    await p.call("check", { h, stage: "baseline" });
    rmSync(join(p.root, "src/edited-while-running.ts"), { force: true });
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const rc = receiptOf(r);
    assert.equal(rc.status, "inconclusive", JSON.stringify(rc));
    assert.ok(rc.reasons.includes("concurrent-edit"));
    assert.notEqual(r.next[0]!.action, "review");
    assert.equal(rc.history, undefined, "an inconclusive run is not rerun");
  });

  it("a toolchain that changes during the run makes the receipt inconclusive", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", `import { expect, it } from "vitest";\nimport { greet } from "./greet.ts";\nit("greets by name", () => { expect(greet("Ada")).toBe("Hello, Ada!"); });\n`);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const base = p.ports();
    let changed = false;
    const stack = Object.create(base.stack, { fingerprint: { value: (root: string) => ({ ...base.stack.fingerprint(root), tool: changed ? "9.9.9-moved" : base.stack.fingerprint(root).tool }) } });
    const runner = Object.create(base.runner, { run: { value: async (...a: Parameters<typeof base.runner.run>) => { const out = await base.runner.run(...a); changed = true; return out; } } });
    const r = await callWithEnvelopeConsent((verb, input) => runVerb({ ...base, stack, runner }, VERBS, verb, input), "check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const rc = receiptOf(r);
    assert.equal(rc.status, "inconclusive", JSON.stringify(rc));
    assert.ok(rc.reasons.includes("concurrent-edit"));
  });
});
