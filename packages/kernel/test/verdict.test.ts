// One fixture per verdict-table row this slice reaches (AC-27), plus the monotonicity properties (TS §8.3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { continueRequired, headline, verdict } from "../src/core/verdict.ts";
import type { VerdictInput } from "../src/core/verdict.ts";
import type { BasisElement, Finding, Obligation, Receipt, ReviewLink } from "../src/core/schemas.ts";

const CHECK = "chk1";
const ob: Obligation = { id: "OB-EX-1", kind: "test", category: "acceptance", testFile: "a.test.ts", test: "distinguishing", expectation: "fail", baselineMatched: true, baselineTestHash: "h1" };
const suite: Obligation = { id: "OB-suite", kind: "test", category: "affected" };
const rc = (obligation: string, over: Partial<Receipt> = {}): Receipt => ({
  id: `RC-${obligation}`, obligation, kind: "test", stage: "candidate", source: "kernel-run", checkInputId: CHECK, scope: "full", argv: [], cwd: ".",
  durationMs: 1, versions: { tool: "1", reporter: "r", adapter: "a" }, provenance: { runId: "r", runDir: "d", startedAt: "t" }, status: "pass",
  qualifiers: [], reasons: [], limitations: [], candidate: "cand", ...over,
});
const req: BasisElement = { id: "REQ-1", origin: "request", kind: "requirement", text: "t", verifiedBy: [{ method: "obligation", ref: "OB-EX-1" }] };
const ex: BasisElement = { id: "EX-1", origin: "request", kind: "example", text: "t", of: "REQ-1", testFile: "a.test.ts", verifiedBy: [{ method: "obligation", ref: "OB-EX-1" }] };
const link: ReviewLink = { reservation: "RV", mode: "full", candidate: "cand", basisHash: "bh", uncovered: [], verified: [], independence: "subagent-fresh", status: "completed", files: {} };
const finding = (over: Partial<Finding>): Finding => ({ id: "F1", n: 1, severity: "major", axis: "behavior", location: { path: "a.ts" }, claim: "c", evidence: "e", state: "valid", history: [], ...over });

const base = (): VerdictInput => ({
  profile: "feature", level: "L4", implementationExists: true, prototypeRequested: false, behavioralChange: true, reviewRequired: true,
  candidate: "cand", checkInputId: CHECK, basisHash: "bh", elements: [req, ex], obligations: [ob, suite], receipts: [rc("OB-EX-1"), rc("OB-suite")],
  baselineFailures: [], excludedScope: [], testHashes: { "a.test.ts": "h1" }, changedLocks: [], unauthorized: [], reviews: [link], findings: [], attention: [], declined: [],
  attemptsLeft: 2, commitExists: true, committedTreeChecked: true, checkedIncludesHumanEdits: false, integratedStale: false,
});
const codes = (i: VerdictInput) => verdict(i).reasons.filter((r) => !r.note).map((r) => r.code);

describe("verdict table [RES-02, EVD-01]", () => {
  it("checked-local, committed, with no reasons when everything is fresh and reviewed", () => {
    const v = verdict(base());
    assert.deepEqual([v.endpoint, v.scope, v.reasons.length], ["checked-local", "committed", 0]);
  });
  it("names the scope: working tree, with or without the user's edits", () => {
    assert.equal(verdict({ ...base(), commitExists: false, committedTreeChecked: false }).scope, "working-tree-uncommitted");
    assert.equal(verdict({ ...base(), commitExists: false, committedTreeChecked: false, checkedIncludesHumanEdits: true }).scope, "working-tree-with-your-edits");
    assert.equal(verdict({ ...base(), checkedIncludesHumanEdits: true, committedTreeChecked: false }).scope, "working-tree-with-your-edits");
  });
  const rows: Array<[string, (i: VerdictInput) => VerdictInput, string, string]> = [
    ["evidence-missing", (i) => ({ ...i, receipts: [rc("OB-EX-1")] }), "evidence-missing", "implemented-unverified"],
    ["a planned red is not evidence of the candidate", (i) => ({ ...i, receipts: [rc("OB-EX-1", { stage: "baseline", status: "pass" }), rc("OB-suite")] }), "evidence-missing", "implemented-unverified"],
    ["stale (any input changed) [EVD-03]", (i) => ({ ...i, receipts: i.receipts.map((r) => ({ ...r, checkInputId: "old" })) }), "stale", "implemented-unverified"],
    ["evidence-failed", (i) => ({ ...i, receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "fail", failures: [{ test: "t", kind: "assertion", message: "m" }] })] }), "evidence-failed", "implemented-unverified"],
    ["evidence-inconclusive", (i) => ({ ...i, receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "inconclusive", reasons: ["timeout"] })] }), "evidence-inconclusive", "implemented-unverified"],
    ["evidence-flaky", (i) => ({ ...i, receipts: [rc("OB-EX-1", { qualifiers: ["flaky"] }), rc("OB-suite")] }), "evidence-flaky", "implemented-unverified"],
    ["basis-element-unverified", (i) => ({ ...i, elements: [{ ...req, verifiedBy: [] }, ex] }), "basis-element-unverified", "implemented-unverified"],
    ["assumption-unresolved", (i) => ({ ...i, elements: [...i.elements, { id: "ASM-1", origin: "tenet", kind: "assumption", text: "a", verifiedBy: [] }] }), "assumption-unresolved", "implemented-unverified"],
    ["no-distinguishing-red", (i) => ({ ...i, obligations: [{ ...ob, baselineMatched: false }, suite] }), "no-distinguishing-red", "implemented-unverified"],
    ["red-invalidated", (i) => ({ ...i, testHashes: { "a.test.ts": "changed" } }), "red-invalidated", "implemented-unverified"],
    ["authority-needed (an edit in a protected path no grant covers)", (i) => ({ ...i, unauthorized: ["db/migrations/001.sql"] }), "authority-needed", "implemented-unverified"],
    ["locked-test-changed", (i) => ({ ...i, changedLocks: ["a.test.ts"] }), "locked-test-changed", "implemented-unverified"],
    ["review-missing", (i) => ({ ...i, reviews: [] }), "review-missing", "implemented-unverified"],
    ["review-stale (candidate moved)", (i) => ({ ...i, reviews: [{ ...link, candidate: "older" }] }), "review-stale", "implemented-unverified"],
    ["review-stale (basis changed)", (i) => ({ ...i, reviews: [{ ...link, basisHash: "older" }] }), "review-stale", "implemented-unverified"],
    ["reduced-independence", (i) => ({ ...i, reviews: [{ ...link, independence: "same-session" }] }), "reduced-independence", "implemented-unverified"],
    ["review-partial-coverage", (i) => ({ ...i, reviews: [{ ...link, uncovered: ["x.ts"] }] }), "review-partial-coverage", "implemented-unverified"],
    ["blocker-open", (i) => ({ ...i, findings: [finding({ severity: "blocker" })] }), "blocker-open", "implemented-unverified"],
    ["blocker is not closed by risk acceptance", (i) => ({ ...i, findings: [finding({ severity: "blocker", state: "risk-accepted" })] }), "blocker-open", "implemented-unverified"],
    ["major-undisposed", (i) => ({ ...i, findings: [finding({})] }), "major-undisposed", "implemented-unverified"],
    ["marker-unaccepted (same-session cannot accept)", (i) => ({ ...i, attention: [{ id: "A", path: "a.ts", line: 1, pattern: ".skip", marker: true, disposition: { by: "same-session", outcome: "accepted", reason: "r" } }] }), "marker-unaccepted", "implemented-unverified"],
    ["undisposed attention", (i) => ({ ...i, attention: [{ id: "A", path: "a.ts", line: 1, pattern: "mock", marker: false }] }), "major-undisposed", "implemented-unverified"],
    ["declined-step", (i) => ({ ...i, declined: ["review"] }), "declined-step", "implemented-unverified"],
    ["integration-unvalidated", (i) => ({ ...i, integratedStale: true }), "integration-unvalidated", "implemented-unverified"],
    ["blocked: nothing implemented", (i) => ({ ...i, implementationExists: false, commitExists: false, receipts: [] }), "evidence-missing", "blocked"],
  ];
  for (const [name, mut, code, endpoint] of rows) {
    it(`${name} → ${endpoint}`, () => {
      const v = verdict(mut(base()));
      assert.ok(v.reasons.some((r) => r.code === code && !r.note), `${code} in ${v.reasons.map((r) => r.code)}`);
      assert.equal(v.endpoint, endpoint);
    });
  }
  it("lets a reviewer or the user accept a marker, and a user accept a major", () => {
    const accepted = { id: "A", path: "a.ts", line: 1, pattern: ".skip", marker: true, disposition: { by: "reviewer" as const, outcome: "accepted" as const, reason: "intentional" } };
    assert.deepEqual(codes({ ...base(), attention: [accepted] }), []);
    assert.deepEqual(codes({ ...base(), findings: [finding({ state: "risk-accepted" })] }), []);
  });
  it("skips the review rows when review is not required (Quick)", () => {
    assert.deepEqual(codes({ ...base(), reviewRequired: false, reviews: [] }), []);
  });
  it("treats a refactor's missing red as no problem, but a behavioral change's as a reason", () => {
    const i = { ...base(), obligations: [{ ...ob, baselineMatched: false }, suite] };
    assert.deepEqual(codes({ ...i, behavioralChange: false }), []);
    assert.deepEqual(codes(i), ["no-distinguishing-red"]);
  });
  it("applies the level ceiling last: a high endpoint never exceeds what the level allows", () => {
    assert.equal(verdict({ ...base(), level: "L3" }).endpoint, "implemented-unverified");
    assert.equal(verdict({ ...base(), level: "L1" }).endpoint, "findings-only");
    assert.equal(verdict({ ...base(), level: "L0" }).endpoint, "blocked");
  });
  it("review-only, plan and investigate work end findings-only and still list every reason", () => {
    for (const profile of ["review", "plan", "investigate"] as const) assert.equal(verdict({ ...base(), profile }).endpoint, "findings-only");
    const v = verdict({ ...base(), profile: "review", findings: [finding({})] });
    assert.ok(v.reasons.some((r) => r.code === "major-undisposed"));
  });
  it("prototype keeps its endpoint but never reaches checked-local", () => {
    assert.equal(verdict({ ...base(), prototypeRequested: true }).endpoint, "prototype");
  });
  it("carries the stop reason through", () => {
    assert.equal(verdict({ ...base(), stopReason: "budget-exhausted", receipts: [] }).stopReason, "budget-exhausted");
  });
  it("finish must continue while a failure remains, attempts remain and no stop reason is set", () => {
    const v = verdict({ ...base(), receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "fail" })] });
    assert.equal(continueRequired(v, { attemptsLeft: 1 }), true);
    assert.equal(continueRequired(v, { attemptsLeft: 0 }), false);
    assert.equal(continueRequired(v, { attemptsLeft: 1, stopReason: "repeated-failure" }), false);
    assert.equal(continueRequired(verdict(base()), { attemptsLeft: 2 }), false);
  });
  it("words the headline in the user's terms, naming scope in the headline", () => {
    assert.match(headline(verdict(base()), { profile: "feature", branch: "main" }), /^Checked locally .*committed on main/);
    const u = verdict({ ...base(), commitExists: false, committedTreeChecked: false, checkedIncludesHumanEdits: true });
    assert.equal(headline(u, { profile: "feature", humanFiles: 2 }), "Checked locally (working tree), alongside your 2 uncommitted files");
    assert.equal(headline(verdict({ ...base(), receipts: [] }), { profile: "feature" }), "Built, not fully checked");
    assert.equal(headline(verdict({ ...base(), profile: "plan" }), { profile: "plan" }), "Plan ready, no source changes");
  });
});

const arbReceipts = fc.array(fc.constantFrom(rc("OB-EX-1"), rc("OB-suite"), rc("OB-EX-1", { status: "fail" }), rc("OB-suite", { checkInputId: "old" })), { maxLength: 6 });
const rank = (e: string) => ["blocked", "findings-only", "implemented-unverified", "checked-local"].indexOf(e);

describe("verdict properties", () => {
  it("more fresh passing evidence never weakens the endpoint", () => {
    fc.assert(fc.property(arbReceipts, (rs) => {
      const before = verdict({ ...base(), receipts: rs });
      const after = verdict({ ...base(), receipts: [...rs, rc("OB-EX-1"), rc("OB-suite")] });
      return rank(after.endpoint) >= rank(before.endpoint);
    }));
  });
  it("removing passing evidence never strengthens the endpoint", () => {
    fc.assert(fc.property(arbReceipts, fc.nat(5), (rs, k) => {
      const passing = rs.filter((r) => r.status === "pass");
      const full = verdict({ ...base(), receipts: passing });
      const fewer = verdict({ ...base(), receipts: passing.filter((_, i) => i !== k) });
      return rank(fewer.endpoint) <= rank(full.endpoint);
    }));
  });
  it("is deterministic", () => {
    fc.assert(fc.property(arbReceipts, (rs) => JSON.stringify(verdict({ ...base(), receipts: rs })) === JSON.stringify(verdict({ ...base(), receipts: rs }))));
  });
});
