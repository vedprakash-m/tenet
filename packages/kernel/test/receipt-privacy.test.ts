import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalize } from "../src/adapters/node-ts.ts";
import { receiptsFrom, staticReceipt } from "../src/core/receipts.ts";
import type { ReceiptContext, RunFacts } from "../src/core/receipts.ts";
import type { Normalized, StaticNorm } from "../src/ports/types.ts";
import type { Obligation } from "../src/core/schemas.ts";

const synthetic = ["ghp_", "a1B2".repeat(9)].join("");
const ob: Obligation = { id: "OB-1", kind: "test", category: "acceptance", testFile: "a.test.ts" };
const ctx: ReceiptContext = {
  stage: "candidate", scope: "full", id: "chk", candidate: "candidate", runId: "run", runDir: "run",
  argv: ["vitest"], before: "d0",
  versions: { node: "fixture", tool: "3", reporter: "json", adapter: "fixture", static: { tsc: "5.9.3" } },
  missing: new Set(),
};
const facts: RunFacts = { exit: 1, timedOut: false, durationMs: 1, startedAt: "t", raw: "fixture", after: "d0", ran: true };
const report = (title: string, message = "AssertionError: expected true", file = "a.test.ts"): Normalized =>
  normalize(JSON.stringify({ testResults: [{
    name: `/p/${file}`, status: "failed",
    assertionResults: [{ fullName: title, status: "failed", failureMessages: [message] }],
  }] }), "/p");
const receipt = (norm: Normalized) => receiptsFrom(facts, norm, [ob], ctx)[0]!;
const staticOb: Obligation = { id: "OB-tsc", kind: "static", category: "affected", tool: "tsc" };
const staticResult = (norm: StaticNorm) => staticReceipt(facts, norm, staticOb, 0, ctx);
const noSecret = (value: unknown) => assert.equal(JSON.stringify(value).includes(synthetic), false);

describe("receipt privacy admission [SEC-11]", () => {
  it("refuses a secret-shaped assertion title without rewriting evidence identity", () => {
    const norm = report(`test ${synthetic}`);
    assert.equal(norm.invalid, undefined);
    const out = receipt(norm);
    assert.equal(out.status, "inconclusive");
    assert.ok(out.reasons.includes("report-invalid"));
    noSecret(out);
    assert.equal(out.failures, undefined);
    assert.equal(norm.files.get("a.test.ts")!.tests[0], `test ${synthetic}`);
  });
  it("refuses a secret-shaped report file before copying evidence", () => {
    const out = receipt(report("ordinary test", "AssertionError: expected true", `${synthetic}.test.ts`));
    assert.equal(out.status, "inconclusive");
    assert.ok(out.reasons.includes("report-invalid"));
    noSecret(out);
  });
  it("refuses secret-shaped static diagnostic identity before storing it", () => {
    const out = staticResult({ status: "fail", files: ["src/a.ts"], failures: [{
      test: `src/${synthetic}.ts:1:1`, kind: "type-error", message: "ordinary diagnostic",
    }] });
    assert.equal(out.status, "inconclusive");
    assert.ok(out.reasons.includes("report-invalid"));
    noSecret(out);
    assert.equal(out.failures, undefined);
  });
  it("refuses secret-shaped analyzed paths before assigning the population", () => {
    const out = staticResult({ status: "pass", files: [`src/${synthetic}.ts`], failures: [] });
    assert.equal(out.status, "inconclusive");
    assert.ok(out.reasons.includes("report-invalid"));
    noSecret(out);
    assert.equal(out.analyzedFiles, undefined);
  });
  it("redacts invalid static-report explanation before storing it", () => {
    const out = staticResult({ status: "invalid", problem: `malformed ${synthetic}`, failures: [] });
    assert.equal(out.status, "inconclusive");
    assert.ok(out.reasons.includes("report-invalid"));
    noSecret(out);
    assert.deepEqual(out.limitations, ["malformed [redacted]"]);
  });
  it("keeps safe assertion identities exact while redacting only diagnostic text", () => {
    const out = receipt(report("ordinary assertion [EX-1]", `AssertionError: printed ${synthetic}`));
    assert.equal(out.status, "fail");
    assert.equal(out.failures![0]!.test, "ordinary assertion [EX-1]");
    assert.match(out.failures![0]!.message, /\[redacted\]/);
    noSecret(out);
  });
  it("keeps safe static identity, population and failure semantics", () => {
    const out = staticResult({ status: "fail", files: ["src/a.ts"], failures: [{
      test: "src/a.ts:1:1", kind: "type-error", message: `printed ${synthetic}`,
    }] });
    assert.equal(out.status, "fail");
    assert.equal(out.failures![0]!.test, "src/a.ts:1:1");
    assert.deepEqual(out.analyzedFiles, ["src/a.ts"]);
    assert.equal(out.failures![0]!.message, "printed [redacted]");
    noSecret(out);
  });
});
