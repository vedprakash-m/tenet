// Every PRD §4.5.2 decision-table row through the public pipeline, so the pure rule cannot drift from the endpoint
// returned by a verb. The direct verdict properties stay in verdict.test.ts; this file proves transport and selection.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import type { BasisElement, Finding, Obligation, Receipt, ReviewLink } from "../src/core/schemas.ts";
import { verdict } from "../src/core/verdict.ts";
import type { VerdictInput } from "../src/core/verdict.ts";
import { runVerb } from "../src/pipeline.ts";
import type { Verb } from "../src/pipeline.ts";
import { createPorts } from "../src/wire.ts";

const CHECK = "chk-ac27";
const obligation: Obligation = {
  id: "OB-EX-1", kind: "test", category: "acceptance", testFile: "a.test.ts", test: "distinguishing",
  expectation: "fail", baselineMatched: true, baselineTestHash: "test-hash", baselineInputs: {},
};
const suite: Obligation = { id: "OB-suite", kind: "test", category: "affected" };
const receipt = (id: string, over: Partial<Receipt> = {}): Receipt => ({
  id: `RC-${id}`, obligation: id, kind: "test", stage: "candidate", source: "kernel-run",
  checkInputId: CHECK, scope: "full", argv: [], cwd: ".", durationMs: 1,
  versions: { tool: "1", reporter: "r", adapter: "a" },
  provenance: { runId: `run-${id}`, runDir: `run-${id}`, startedAt: "2026-01-01T00:00:00.000Z" },
  status: "pass", qualifiers: [], reasons: [], limitations: [], candidate: "candidate", ...over,
});
const requirement: BasisElement = {
  id: "REQ-1", origin: "request", kind: "requirement", text: "greet",
  verifiedBy: [{ method: "obligation", ref: "OB-EX-1" }],
};
const example: BasisElement = {
  id: "EX-1", origin: "request", kind: "example", text: "Ada", of: "REQ-1", testFile: "a.test.ts",
  verifiedBy: [{ method: "obligation", ref: "OB-EX-1" }],
};
const review: ReviewLink = {
  reservation: "RV", mode: "full", candidate: "candidate", basisHash: "basis", uncovered: [], verified: [],
  independence: "subagent-fresh", status: "completed", files: { "a.ts": "hash" },
  coverage: { inspected: ["a.ts"], uncovered: [], crossCutting: "a calls b", sampled: [] },
};
const base = (): VerdictInput => ({
  profile: "feature", level: "L4", lane: "standard", implementationExists: true, prototypeRequested: false,
  behavioralChange: true, reviewRequired: true, candidate: "candidate", checkInputId: CHECK, basisHash: "basis",
  elements: [requirement, example], obligations: [obligation, suite],
  receipts: [receipt("OB-EX-1"), receipt("OB-suite")], testHashes: { "a.test.ts": "test-hash" },
  changedLocks: [], unauthorized: [], reviews: [review], analyses: [], findings: [], attention: [],
  declined: [], attemptsLeft: 2, commitExists: true, committedTreeChecked: true,
  checkedIncludesHumanEdits: false, integratedStale: false,
});
const tableVerb: Verb<VerdictInput> = {
  name: "verdict-table",
  schema: z.any(),
  class: () => "stateless",
  run(_ports, _state, input) {
    return { resp: { data: verdict(input) } };
  },
};
const throughPipeline = async (input: VerdictInput) => {
  const response = await runVerb(createPorts(process.cwd(), {}), { "verdict-table": tableVerb }, "verdict-table", input);
  assert.equal(response.exit, 0, JSON.stringify(response));
  return response.data as ReturnType<typeof verdict>;
};
const reasonCodes = (value: ReturnType<typeof verdict>) => value.reasons.filter((reason) => !reason.note).map((reason) => reason.code);
const blocker = (over: Partial<Finding> = {}): Finding => ({
  id: "FND-1", n: 1, severity: "blocker", axis: "behavior", location: { path: "a.ts" }, claim: "broken",
  evidence: "a.ts:1", state: "valid", history: [], ...over,
});

describe("PRD §4.5.2 verdict truth table through the public pipeline [AC-27]", () => {
  it("[AC-27] All conditions hold → checked-local", async () => {
    const result = await throughPipeline(base());
    assert.equal(result.endpoint, "checked-local");
    assert.equal(result.scope, "committed");
  });

  it("[AC-27] Implementation exists with missing evidence → implemented-unverified", async () => {
    const result = await throughPipeline({ ...base(), receipts: [receipt("OB-EX-1")] });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("evidence-missing"));
  });

  it("[AC-27] Introduced candidate failure returns to executing or is unverified at exhaustion", async () => {
    const result = await throughPipeline({
      ...base(), attemptsLeft: 0, stopReason: "budget-exhausted",
      receipts: [receipt("OB-EX-1"), receipt("OB-suite", {
        status: "fail", failures: [{ test: "introduced", kind: "assertion", message: "failed" }],
      })],
    });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("evidence-failed"));
  });

  it("[AC-27] Matching baseline and candidate failure is checked only when its scope was excluded", async () => {
    const failure = { test: "legacy#same", kind: "assertion" as const, message: "same" };
    const id = "legacy#same::assertion::sig".replace("#", "::");
    const input = {
      ...base(),
      receipts: [receipt("OB-EX-1"), receipt("OB-suite", { status: "fail", failures: [failure], failureIds: [id] })],
      sealedBaseline: { status: "recorded" as const, startId: "s", failed: [id], complete: true, at: "then" },
      exceptions: [{ ids: [id] }],
    };
    assert.equal((await throughPipeline(input)).endpoint, "checked-local");
    assert.equal((await throughPipeline({ ...input, exceptions: [] })).endpoint, "implemented-unverified");
  });

  it("[AC-27] Flaky evidence without equivalent coverage → implemented-unverified", async () => {
    const result = await throughPipeline({
      ...base(), receipts: [receipt("OB-EX-1"), receipt("OB-suite", { qualifiers: ["flaky"] })],
    });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("evidence-flaky"));
  });

  it("[AC-27] An open blocker is never checked-local", async () => {
    const result = await throughPipeline({ ...base(), findings: [blocker()] });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("blocker-open"));
  });

  it("[AC-27] A user-deferred major finding can remain with a checked-local endpoint", async () => {
    const result = await throughPipeline({
      ...base(), findings: [blocker({ severity: "major", state: "deferred" })],
    });
    assert.equal(result.endpoint, "checked-local");
  });

  it("[AC-27] An unresolved behavior-changing assumption → implemented-unverified", async () => {
    const assumption: BasisElement = {
      id: "ASM-1", origin: "tenet", kind: "assumption", text: "timezone",
      verifiedBy: [{ method: "manual", ref: "confirm" }],
    };
    const result = await throughPipeline({ ...base(), elements: [...base().elements, assumption] });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("assumption-unresolved"));
  });

  it("[AC-27] A partially verified outcome is not narrowed silently", async () => {
    const second: BasisElement = {
      id: "REQ-2", origin: "request", kind: "requirement", text: "second",
      verifiedBy: [{ method: "obligation", ref: "OB-second" }],
    };
    const result = await throughPipeline({
      ...base(), elements: [...base().elements, second],
      obligations: [...base().obligations, { id: "OB-second", kind: "test", category: "acceptance" }],
    });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("basis-element-unverified"));
  });

  it("[AC-27] Partial review coverage → implemented-unverified for uncovered parts", async () => {
    const result = await throughPipeline({
      ...base(), reviews: [{ ...review, uncovered: ["b.ts"] }],
    });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("review-partial-coverage"));
  });

  it("[AC-27] A declined mandatory step → implemented-unverified or prototype", async () => {
    const result = await throughPipeline({ ...base(), declined: ["review"] });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("declined-step"));
  });

  it("[AC-27] A requested prototype keeps the prototype endpoint even when checks pass", async () => {
    const result = await throughPipeline({ ...base(), prototypeRequested: true });
    assert.equal(result.endpoint, "prototype");
  });

  it("[AC-27] A required unavailable capability is blocked by the assistance level", async () => {
    const result = await throughPipeline({
      ...base(), level: "L0", implementationExists: false, authorityAvailable: false,
      receipts: [], reviews: [],
    });
    assert.equal(result.endpoint, "blocked");
    assert.ok(reasonCodes(result).includes("authority-needed"));
  });

  it("[AC-27] Human edits in the checked candidate bind checked-local to that working tree", async () => {
    const result = await throughPipeline({
      ...base(), commitExists: true, committedTreeChecked: false, checkedIncludesHumanEdits: true,
    });
    assert.equal(result.endpoint, "checked-local");
    assert.equal(result.scope, "working-tree-with-your-edits");
  });

  it("[AC-27] A moved-base integration is a new candidate until revalidated", async () => {
    const result = await throughPipeline({ ...base(), integratedStale: true });
    assert.equal(result.endpoint, "implemented-unverified");
    assert.ok(reasonCodes(result).includes("integration-unvalidated"));
  });

  it("[AC-27] Review-only ends findings-only while preserving all conditions", async () => {
    const result = await throughPipeline({ ...base(), profile: "review", findings: [blocker()] });
    assert.equal(result.endpoint, "findings-only");
    assert.ok(reasonCodes(result).includes("blocker-open"));
  });
});
