// Declared check outputs (EVD-09, specs/evidence-outputs.md v2): untracked paths a check writes are omitted from the inventory;
// anything else that moves during a run is still an inconclusive result, and now names the file. Real Git, real test processes.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { glob } from "../src/core/exclusions.ts";
import { outputPatternProblem } from "../src/core/outputs.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const receiptOf = (r: { data?: unknown }) => d(r).receipts[0] as Record<string, any>;
const withOutputs = (outputs: string[]) => ({ ...BASIS, elements: BASIS.elements.map((e) => (e.kind === "example" ? { ...e, outputs } : e)) });
const writer = (rel: string, body = "{}") => `import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { greet } from "./greet.ts";
it("greets by name", () => { mkdirSync(dirname(${JSON.stringify(rel)}), { recursive: true }); writeFileSync(${JSON.stringify(rel)}, ${JSON.stringify(body)}); expect(greet("Ada")).toBe("Hello, Ada!"); });
`;

async function toCandidate(outputs: string[], testBody: string, baselineBody = testBody) {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
  const b = await p.call("decide", { h, kind: "basis", propose: withOutputs(outputs) });
  assert.equal(b.exit, 0, JSON.stringify(b));
  p.write("src/greet.test.ts", baselineBody);
  const red = await p.call("check", { h, stage: "baseline" });
  assert.equal(red.next[0]!.action, "implement", JSON.stringify(red));
  p.write("src/greet.test.ts", testBody);
  p.write("src/greet.ts", GREET_IMPL);
  return { p, h };
}

describe("a declared untracked output does not invalidate the run [EVD-09]", () => {
  it("is created by the run: valid pass, no question, not committed, the reviewer is told an output is declared", async () => {
    const { p, h } = await toCandidate(["coverage/**"], writer("coverage/summary.json"));
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(receiptOf(r).status, "pass", JSON.stringify(receiptOf(r)));
    assert.ok(existsSync(join(p.root, "coverage/summary.json")));
    const manifest = JSON.parse((await import("node:fs")).readFileSync(d(r).review.manifest, "utf8"));
    assert.ok(JSON.stringify(manifest.attention ?? []).includes("coverage/**"), "the reviewer sees the declaration");
    const item = Object.values(p.ports().store.read()!.state.work)[0]!.attention.find((a) => a.path === "coverage/**")!;
    const rev = await p.call("findings", { h, result: reviewResult(d(r), { attention: [{ id: item.id, disposition: "accepted", reason: "a declared untracked output; nothing to review" }] }) });
    assert.equal(rev.exit, 0, JSON.stringify(rev));
    const f = await p.call("finish", { h, subject: "Add greet" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
    assert.deepEqual(p.git("show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean).sort(), ["src/greet.test.ts", "src/greet.ts"]);
  });

  it("is rewritten by a rerun, and is deleted between runs: still valid", async () => {
    const { p, h } = await toCandidate(["out/*.json"], writer("out/report.json"));
    assert.equal(receiptOf(await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] })).status, "pass");
    rmSync(join(p.root, "out/report.json"));
    assert.equal(receiptOf(await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"], again: true })).status, "pass");
  });

  it("the same write without a declaration is concurrent-edit and the receipt names the file", async () => {
    const { p, h } = await toCandidate([], writer("coverage/summary.json"), GREET_TEST);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    const rc = receiptOf(r);
    assert.equal(rc.status, "inconclusive");
    assert.ok(rc.reasons.includes("concurrent-edit"));
    assert.match(rc.limitations.join(" "), /coverage\/summary\.json/, JSON.stringify(rc.limitations));
    assert.match(rc.limitations.join(" "), /declare|gitignore/i, "it says what to do");
  });

  it("a tracked fixture rewritten by a test is concurrent-edit, names the file, and a declaration cannot cover it", async () => {
    const p = project({ "fixtures/golden.json": "{\"a\":1}\n" }); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: withOutputs(["fixtures/*.json"]) });
    p.write("src/greet.test.ts", writer("fixtures/golden.json", "{\"a\":2}"));
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.notEqual(r.exit, 0, "the check is refused before it launches");
    assert.equal(r.reasons[0]!.code, "capability-missing");
    assert.match(r.reasons[0]!.message, /fixtures\/golden\.json.*tracked|tracked.*fixtures\/golden\.json/);
  });

  it("an output that already existed untracked when the contract started is refused", async () => {
    const p = project(); roots.push(p.root);
    mkdirSync(join(p.root, "coverage"), { recursive: true });
    writeFileSync(join(p.root, "coverage/old.json"), "{}");
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard", includeDirty: [] } as any)).handle!;
    await p.call("decide", { h, kind: "basis", propose: withOutputs(["coverage/**"]) });
    p.write("src/greet.test.ts", writer("coverage/summary.json"));
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.reasons[0]?.code, "capability-missing", JSON.stringify(r.reasons));
    assert.match(r.reasons[0]!.message, /coverage\/old\.json/);
  });

  it("a pattern that later matches a code file refuses the check before it launches", async () => {
    const { p, h } = await toCandidate(["gen/**"], writer("gen/report.json"));
    p.write("gen/helper.ts", "export const x = 1;\n");
    const r = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(r.reasons[0]?.code, "capability-missing", JSON.stringify(r.reasons));
    assert.match(r.reasons[0]!.message, /gen\/helper\.ts/);
  });
});

describe("what a declaration may name [EVD-09]", () => {
  const bad = ["*", "**", "*.json", "**/*.json", "src/**", "src/greet.ts", "node_modules/**", ".git/**", "package-lock.json", "coverage/../src/x", "/abs/out.json", "a\\\\b.json", "", "x/".repeat(120), "out/x.ts", "out/test.test.ts", "a.ts/**", "x.test.ts/**", "package.json/**"];
  const good = ["coverage/**", ".cache/*", "out/report.json", "reports/**/*.xml", "tmp/out.snap"];
  for (const p of bad) it(`refuses "${p.slice(0, 30)}"`, () => assert.ok(outputPatternProblem(p), p));
  for (const p of good) it(`accepts "${p}"`, () => assert.equal(outputPatternProblem(p), null));

  it("property: no accepted pattern can name a code, config, lock or dependency path", () => {
    const forbidden = ["src/a.ts", "a.tsx", "lib/b.js", "x.mjs", "package.json", "tsconfig.json", "package-lock.json", "pnpm-lock.yaml", "yarn.lock", "node_modules/x/y.json", ".git/config", "src/x.test.ts", "vitest.config.ts"];
    fc.assert(fc.property(fc.array(fc.constantFrom("*", "**", "?", "coverage", "out", "src", ".cache", "node_modules", ".git", "a.json", "a.ts", "x.test.ts", ""), { minLength: 1, maxLength: 5 }), (parts) => {
      const pattern = parts.join("/");
      if (outputPatternProblem(pattern)) return true;
      const re = glob(pattern);
      return !forbidden.some((f) => re.test(f));
    }), { numRuns: 3000 });
  });

  it("the basis refuses a bad declaration when it is recorded", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    for (const outputs of [["src/**"], ["*.json"], ["node_modules/**"]]) {
      const r = await p.call("decide", { h, kind: "basis", propose: withOutputs(outputs) });
      assert.notEqual(r.exit, 0, JSON.stringify(outputs));
    }
  });
});
