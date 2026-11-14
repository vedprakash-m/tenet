// One fixture per verdict-table row this slice reaches (AC-27), plus the monotonicity properties (TS §8.3).
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { KernelError } from "../src/core/errors.ts";
import { DecideInput, State, WorkContract } from "../src/core/schemas.ts";
import { emptyState } from "../src/core/state.ts";
import { checkpointEvidence, continueRequired, fullChecksPassed, headline, verdict } from "../src/core/verdict.ts";
import type { VerdictInput } from "../src/core/verdict.ts";
import type { AnalystLink, BasisElement, Finding, Obligation, Receipt, ReviewLink } from "../src/core/schemas.ts";
import { handleOf } from "../src/verbs/common.ts";
import { decide } from "../src/verbs/decide.ts";
import { createPorts } from "../src/wire.ts";
import { contractFixture } from "./support/fixture.ts";

const CHECK = "chk1";
const ob: Obligation = { id: "OB-EX-1", kind: "test", category: "acceptance", testFile: "a.test.ts", test: "distinguishing", expectation: "fail", baselineMatched: true, baselineTestHash: "h1", baselineInputs: {} };
const suite: Obligation = { id: "OB-suite", kind: "test", category: "affected" };
const rc = (obligation: string, over: Partial<Receipt> = {}): Receipt => ({
  id: `RC-${obligation}`, obligation, kind: "test", stage: "candidate", source: "kernel-run", checkInputId: CHECK, scope: "full", argv: [], cwd: ".",
  durationMs: 1, versions: { tool: "1", reporter: "r", adapter: "a" }, provenance: { runId: "r", runDir: "d", startedAt: "t" }, status: "pass",
  qualifiers: [], reasons: [], limitations: [], candidate: "cand", ...over,
});
const req: BasisElement = { id: "REQ-1", origin: "request", kind: "requirement", text: "t", verifiedBy: [{ method: "obligation", ref: "OB-EX-1" }] };
const ex: BasisElement = { id: "EX-1", origin: "request", kind: "example", text: "t", of: "REQ-1", testFile: "a.test.ts", verifiedBy: [{ method: "obligation", ref: "OB-EX-1" }] };
const coverage = { inspected: ["a.ts"], uncovered: [], crossCutting: "a calls the shared helper", sampled: [] };
const link: ReviewLink = { reservation: "RV", mode: "full", candidate: "cand", basisHash: "bh", uncovered: [], verified: [], independence: "subagent-fresh", status: "completed", files: { "a.ts": "a" }, coverage };
const finding = (over: Partial<Finding>): Finding => ({ id: "F1", n: 1, severity: "major", axis: "behavior", location: { path: "a.ts" }, claim: "c", evidence: "e", state: "valid", history: [], ...over });

const pass = (role: AnalystLink["role"], over: Partial<AnalystLink> = {}): AnalystLink => ({
  reservation: `AN-${role}`, role, question: "q", revision: "cand", status: "completed", independence: "subagent-fresh",
  artifacts: [], findings: [], openDependencies: [], ...over,
});

const base = (): VerdictInput => ({
  profile: "feature", level: "L4", implementationExists: true, prototypeRequested: false, behavioralChange: true, reviewRequired: true,
  candidate: "cand", checkInputId: CHECK, basisHash: "bh", elements: [req, ex], obligations: [ob, suite], receipts: [rc("OB-EX-1"), rc("OB-suite")],
  testHashes: { "a.test.ts": "h1" }, changedLocks: [], unauthorized: [], reviews: [link], analyses: [], findings: [], attention: [], declined: [],
  attemptsLeft: 2, commitExists: true, committedTreeChecked: true, checkedIncludesHumanEdits: false, integratedStale: false,
});
/** A failing suite receipt that lists its failures, and a sealed starting record with these failure ids (EVD-04). */
const idOf = (test: string, kind = "assertion") => `${test.replace("#", "::")}${kind}:sig`;
const suiteFail = (failures: Array<{ test: string; kind: string; message: string }>, over: Partial<Receipt> = {}) => rc("OB-suite", {
  status: "fail", failures, failureIds: failures.map((f) => idOf(f.test, f.kind)),
  counts: { discovered: failures.length, executed: failures.length, passed: 0, failed: failures.length, skipped: 0, focused: 0 }, ...over,
});
const recorded = (failed: string[], complete = true) => ({ status: "recorded" as const, startId: "s", failed, complete, at: "t" });
const sealedWith = (start: string[], excluded: string[]) => ({ sealedBaseline: recorded(start), exceptions: [{ ids: excluded }] });
const codes = (i: VerdictInput) => verdict(i).reasons.filter((r) => !r.note).map((r) => r.code);

describe("verdict table [RES-02, EVD-01]", () => {
  it("holds a degraded fitness trend below checked-local until the user or a reviewer disposes it [QLT-05]", () => {
    const item = { id: "AT-trend", path: "workload.json", line: 1, marker: false, pattern: "fitness-trend:list-p95-ms 100 to 121 ms (+21%, 3 runs)" };
    const open = verdict({ ...base(), attention: [item] });
    assert.notEqual(open.endpoint, "checked-local");
    assert.ok(open.reasons.some((r) => r.code === "fitness-trend-degraded" && /not a result for the whole application/.test(r.message)));
    const by = (who: "same-session" | "user" | "reviewer") => verdict({ ...base(), attention: [{ ...item, disposition: { by: who, outcome: "accepted", reason: "known" } }] });
    assert.ok(by("same-session").reasons.some((r) => r.code === "fitness-trend-degraded"), "the session that caused it cannot accept it");
    assert.equal(by("user").endpoint, "checked-local");
    assert.equal(by("reviewer").endpoint, "checked-local");
  });
  it("cannot claim Deep assurance without architecture and security evidence [WRK-04]", () => {
    const v = verdict({ ...base(), lane: "deep" });
    assert.notEqual(v.endpoint, "checked-local");
    assert.ok(v.reasons.some(r => r.code === "review-missing" && /architecture/.test(r.message)));
    assert.ok(v.reasons.some(r => r.code === "review-missing" && /security/.test(r.message)));
  });
  it("reaches checked-local in Deep once native architect and security passes cover the current candidate [WRK-04]", () => {
    const deep = { ...base(), lane: "deep" as const, analyses: [pass("architect"), pass("security")] };
    assert.equal(verdict(deep).endpoint, "checked-local", JSON.stringify(verdict(deep).reasons));
    const noSecurity = verdict({ ...deep, analyses: [pass("architect")] });
    assert.notEqual(noSecurity.endpoint, "checked-local");
    assert.ok(noSecurity.reasons.some((r) => r.code === "review-missing" && /security/.test(r.message)));
    assert.ok(!noSecurity.reasons.some((r) => /architecture/.test(r.message)));
  });
  it("does not count a Deep pass that is stale, partial, open or not native [WRK-04]", () => {
    const deep = { ...base(), lane: "deep" as const };
    const only = (a: AnalystLink) => codes({ ...deep, analyses: [a, pass("security")] });
    assert.ok(only(pass("architect", { revision: "older" })).includes("review-stale"));
    assert.ok(only(pass("architect", { status: "partial" })).includes("review-partial-coverage"));
    assert.ok(only(pass("architect", { openDependencies: ["x"] })).includes("review-partial-coverage"));
    assert.ok(only(pass("architect", { independence: "same-session" })).includes("reduced-independence"));
    const retried = codes({ ...deep, analyses: [pass("architect", { status: "failed" }), pass("architect"), pass("security")] });
    assert.ok(!retried.includes("review-partial-coverage"), "the latest pass of a role is the one that counts");
  });
  it("requires the full review chain, including coverage of the recheck delta [REV-01]", () => {
    const root = { ...link, reservation: "root", candidate: "old" };
    const recheck: ReviewLink = { ...link, reservation: "delta", mode: "recheck", basedOn: "root", files: { "a.ts": "new" } };
    assert.deepEqual(codes({ ...base(), reviews: [root, recheck] }), []);
    assert.ok(codes({ ...base(), reviews: [recheck] }).includes("review-stale"));
    assert.ok(codes({ ...base(), reviews: [{ ...root, uncovered: ["unread.ts"] }, recheck] }).includes("review-partial-coverage"));
    assert.ok(codes({ ...base(), reviews: [root, { ...recheck, coverage: { ...coverage, inspected: [] } }] }).includes("review-partial-coverage"));
  });
  it("does not chain a recheck to a full review of an earlier basis, or to another recheck [REV-05]", () => {
    const root = { ...link, reservation: "root", candidate: "old" };
    const recheck: ReviewLink = { ...link, reservation: "delta", mode: "recheck", basedOn: "root", files: { "a.ts": "new" } };
    assert.ok(codes({ ...base(), reviews: [{ ...root, basisHash: "older" }, recheck] }).includes("review-stale"));
    const another: ReviewLink = { ...root, reservation: "root", mode: "recheck", basedOn: "x" };
    assert.ok(codes({ ...base(), reviews: [another, recheck] }).includes("review-stale"));
  });
  it("requires inspection, cross-module evidence and no open review dependencies [REV-08]", () => {
    assert.ok(codes({ ...base(), reviews: [{ ...link, coverage: undefined }] }).includes("review-partial-coverage"));
    assert.ok(codes({ ...base(), reviews: [{ ...link, coverage: { ...coverage, crossCutting: "" } }] }).includes("review-partial-coverage"));
    assert.ok(codes({ ...base(), reviews: [{ ...link, openDependencies: ["unread imported module"] }] }).includes("review-partial-coverage"));
  });
  it("allows caller sampling only for nonsemantic changes with a fresh full types receipt [REV-08]", () => {
    const sampled = { ...coverage, sampled: [{ symbol: "f", callers: 20, opened: 3, semantic: false, why: "same signature" }] };
    const sampledLink = { ...link, coverage: sampled };
    const types: Obligation = { id: "types", kind: "static", category: "affected", tool: "tsc" };
    const typed = { ...base(), reviews: [sampledLink], obligations: [ob, suite, types], receipts: [...base().receipts, rc("types", { kind: "static" })] };
    assert.deepEqual(codes(typed), []);
    assert.ok(codes({ ...base(), reviews: [sampledLink] }).includes("review-partial-coverage"));
    assert.ok(codes({ ...typed, reviews: [{ ...link, coverage: { ...sampled, sampled: [{ ...sampled.sampled[0]!, semantic: true }] } }] }).includes("review-partial-coverage"));
  });
  it("does not treat a fabricated manual reference as evidence [EVD-12]", () => {
    assert.ok(codes({ ...base(), elements: [{ ...req, verifiedBy: [{ method: "manual", ref: "someone said it works" }] }] }).includes("basis-element-unverified"));
  });
  it("invalidates red when a declared support input changes or disappears [EVD-03]", () => {
    const obligations = [{ ...ob, baselineInputs: { "helper.ts": "old" } }, suite];
    assert.ok(codes({ ...base(), obligations, testHashes: { "a.test.ts": "h1", "helper.ts": "new" } }).includes("red-invalidated"));
    assert.ok(codes({ ...base(), obligations }).includes("red-invalidated"));
  });
  it("requires a distinguishing obligation and every declared baseline expectation [TDD-01, TDD-04]", () => {
    assert.ok(codes({ ...base(), obligations: [suite] }).includes("no-distinguishing-red"));
    assert.ok(codes({ ...base(), obligations: [{ ...ob, category: "boundary", test: "boundary", baselineMatched: false }, suite] }).includes("no-distinguishing-red"));
    assert.ok(codes({ ...base(), obligations: [ob, { ...ob, id: "preserve", test: "preservation", expectation: "pass", baselineMatched: false }, suite] }).includes("evidence-missing"));
  });
  it("checked-local, committed, with no reasons when everything is fresh and reviewed", () => {
    const v = verdict(base());
    assert.deepEqual([v.endpoint, v.scope, v.reasons.length], ["checked-local", "committed", 0]);
  });
  it("names the scope: working tree, with or without the user's edits", () => {
    assert.equal(verdict({ ...base(), commitExists: false, committedTreeChecked: false }).scope, "working-tree-uncommitted");
    assert.equal(verdict({ ...base(), commitExists: false, committedTreeChecked: false, checkedIncludesHumanEdits: true }).scope, "working-tree-with-your-edits");
    assert.equal(verdict({ ...base(), checkedIncludesHumanEdits: true, committedTreeChecked: false }).scope, "working-tree-with-your-edits");
  });
  it("allows a matching sealed baseline failure only when the user excluded it [EVD-04]", () => {
    const failure = { test: "legacy.test.ts#existing-failure", kind: "assertion" as const, message: "still fails" };
    const id = idOf(failure.test);
    const withInputs = (start: string[], excluded: string[]) =>
      verdict({ ...base(), receipts: [rc("OB-EX-1"), suiteFail([failure])], ...sealedWith(start, excluded) });

    const excluded = withInputs([id], [id]);
    assert.equal(excluded.endpoint, "checked-local");
    assert.ok(excluded.reasons.some((r) => r.code === "baseline-failure-excluded" && r.note));

    const notExcluded = withInputs([id], []);
    assert.equal(notExcluded.endpoint, "implemented-unverified");
    assert.ok(notExcluded.reasons.some((r) => r.code === "baseline-failure-not-excluded" && !r.note));

    const notMatchingBaseline = withInputs([], [id]);
    assert.equal(notMatchingBaseline.endpoint, "implemented-unverified");
    assert.ok(notMatchingBaseline.reasons.some((r) => r.code === "evidence-failed" && !r.note && /weren't failing this way/.test(r.message)));

    const differentBaselineTest = withInputs([idOf("legacy.test.ts#different-failure")], [id]);
    assert.equal(differentBaselineTest.endpoint, "implemented-unverified");
    assert.ok(differentBaselineTest.reasons.some((r) => r.code === "evidence-failed" && !r.note));
  });
  it("lists every excluded pre-existing failure in the checked result [AC-27]", () => {
    const failures = [
      { test: "legacy.test.ts#first", kind: "assertion" as const, message: "first still fails" },
      { test: "other.test.ts#second", kind: "timeout" as const, message: "second still fails" },
    ];
    const ids = failures.map((failure) => idOf(failure.test, failure.kind));
    const v = verdict({ ...base(), receipts: [rc("OB-EX-1"), suiteFail(failures)], ...sealedWith(ids, ids) });

    assert.equal(v.endpoint, "checked-local");
    const excluded = v.reasons.filter((r) => r.code === "baseline-failure-excluded");
    assert.equal(excluded.length, 1);
    for (const file of ["legacy.test.ts", "other.test.ts"]) assert.ok(excluded[0]!.message.includes(file), file);
  });
  it("does not silently narrow the acceptance basis when only part of the outcome is verified", () => {
    const secondRequirement: BasisElement = {
      ...req, id: "REQ-2", text: "second part",
      verifiedBy: [{ method: "obligation", ref: "OB-second" }],
    };
    const secondObligation: Obligation = { id: "OB-second", kind: "test", category: "acceptance" };
    const input = {
      ...base(),
      elements: [...base().elements, secondRequirement],
      obligations: [...base().obligations, secondObligation],
    };
    const v = verdict(input);

    assert.equal(v.endpoint, "implemented-unverified");
    assert.ok(input.receipts.some((r) => r.obligation === "OB-EX-1" && r.status === "pass"));
    assert.ok(!v.reasons.some((r) => r.code === "basis-element-unverified" && r.refs?.includes("REQ-1")));
    assert.ok(v.reasons.some((r) => r.code === "evidence-missing" && r.message.includes("OB-second")));
    assert.ok(v.reasons.some((r) => r.code === "basis-element-unverified" && r.message.includes("REQ-2")));
  });
  it("keeps the full-suite obligation separate from targeted acceptance feedback [AC-27]", () => {
    const acceptance = rc("OB-EX-1", { id: "targeted", scope: "targeted" });
    const full = [rc("OB-EX-1"), rc("OB-suite")];
    const onlyTargeted = verdict({ ...base(), receipts: [acceptance] });
    assert.equal(onlyTargeted.endpoint, "implemented-unverified");
    assert.ok(onlyTargeted.reasons.some((r) => r.code === "evidence-missing" && r.refs?.includes("OB-suite")));

    const receipts = [...full, acceptance];
    assert.equal(verdict({ ...base(), receipts }).endpoint, "checked-local");
    assert.equal(fullChecksPassed([ob, suite], full), true);
    assert.equal(fullChecksPassed([ob, suite], [acceptance, full[1]!]), false);

    const work = contractFixture({
      obligations: [ob, suite], receipts, lastCheck: { candidate: "cand", at: "t", stage: "candidate" },
    });
    assert.equal(checkpointEvidence(work, "cand", CHECK), false);
    assert.equal(checkpointEvidence({ ...work, receipts: [...receipts, ...full] }, "cand", CHECK), true);
  });
  it("does not admit a current flaky receipt as checkpoint evidence [EVD-08]", () => {
    const work = contractFixture({
      obligations: [ob, suite],
      receipts: [rc("OB-EX-1", { qualifiers: ["flaky"] }), rc("OB-suite")],
      lastCheck: { candidate: "cand", at: "t", stage: "candidate" },
    });
    assert.equal(checkpointEvidence(work, "cand", CHECK), false);
  });
  const rows: Array<[string, (i: VerdictInput) => VerdictInput, string, string]> = [
    ["evidence-missing", (i) => ({ ...i, receipts: [rc("OB-EX-1")] }), "evidence-missing", "implemented-unverified"],
    ["a planned red is not evidence of the candidate", (i) => ({ ...i, receipts: [rc("OB-EX-1", { stage: "baseline", status: "pass" }), rc("OB-suite")] }), "evidence-missing", "implemented-unverified"],
    ["stale (any input changed) [EVD-03]", (i) => ({ ...i, receipts: i.receipts.map((r) => ({ ...r, checkInputId: "old" })) }), "stale", "implemented-unverified"],
    ["evidence-failed", (i) => ({ ...i, receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "fail", failures: [{ test: "t", kind: "assertion", message: "m" }] })] }), "evidence-failed", "implemented-unverified"],
    ["evidence-inconclusive", (i) => ({ ...i, receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "inconclusive", reasons: ["timeout"] })] }), "evidence-inconclusive", "implemented-unverified"],
    ["a skipped required check is not passing evidence", (i) => ({ ...i, receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "skipped" })] }), "evidence-inconclusive", "implemented-unverified"],
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
    ["basis-gap-open (a reviewer's basis gap left without a disposition)", (i) => ({ ...i, findings: [finding({ location: { path: "basis" }, history: [{ to: "valid", by: "reviewer", reason: "basis gap", at: "2026-01-01T00:00:00Z" }] })] }), "basis-gap-open", "implemented-unverified"],
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
  it("blocks on a fresh flaky result for the same check despite a stale pass [AC-27]", () => {
    const flaky = rc("OB-suite", { id: "flaky", qualifiers: ["flaky"] });
    const passing = rc("OB-suite", { id: "passing", provenance: { runId: "other", runDir: "other", startedAt: "t" } });
    const input = (receipts: Receipt[]) => verdict({ ...base(), receipts: [rc("OB-EX-1"), ...receipts] });

    assert.equal(input([flaky]).endpoint, "implemented-unverified");
    assert.ok(input([flaky]).reasons.some((r) => r.code === "evidence-flaky" && r.refs?.includes("OB-suite")));
    assert.equal(input([flaky, { ...passing, checkInputId: "old" }]).endpoint, "implemented-unverified");
    assert.equal(input([passing, flaky]).endpoint, "implemented-unverified");
  });
  it("requires confirmation of the particular assumption used by the basis [AC-27]", () => {
    const assumption: BasisElement = {
      id: "ASM-1", origin: "tenet", kind: "assumption", text: "a",
      verifiedBy: [{ method: "manual", ref: "confirmed by the user at kickoff" }],
    };
    const input = { ...base(), elements: [...base().elements, assumption] };
    const unconfirmed = verdict(input);
    assert.equal(unconfirmed.endpoint, "implemented-unverified");
    assert.ok(unconfirmed.reasons.some((r) => r.code === "assumption-unresolved" && r.refs?.includes("ASM-1")));
    assert.equal(verdict({ ...input, confirmedAssumptions: ["other"] }).endpoint, "implemented-unverified");
    assert.equal(verdict({ ...input, confirmedAssumptions: ["ASM-1"] }).endpoint, "checked-local");
  });
  it("does not accept an incomplete required review as a completed review [AC-27]", () => {
    const states: ReviewLink["status"][] = ["partial", "blocked", "failed", "cancelled"];
    for (const status of states) {
      const v = verdict({ ...base(), reviews: [{ ...link, status }] });
      assert.equal(v.endpoint, "implemented-unverified", status);
      assert.ok(v.reasons.some((r) => r.code === "review-partial-coverage" && !r.note), status);
    }
    assert.equal(verdict({ ...base(), reviews: [{ ...link, status: "completed" }] }).endpoint, "checked-local");
  });
  it("reports unavailable mandatory capabilities without a checked-local verdict [AC-27]", () => {
    const cases = [
      { input: { unsupportedChecks: ["required browser check"] }, code: "evidence-missing", detail: "required browser check" },
      { input: { authorityAvailable: false }, code: "authority-needed", detail: "suspended or expired" },
    ];
    for (const { input, code, detail } of cases) {
      for (const [overrides, endpoint] of [
        [{}, "implemented-unverified"],
        [{ level: "L0" }, "blocked"],
        [{ implementationExists: false }, "blocked"],
      ] as const) {
        const v = verdict({ ...base(), ...input, ...overrides });
        assert.equal(v.endpoint, endpoint, detail);
        assert.ok(v.reasons.some((r) => r.code === code && !r.note && r.message.includes(detail)), detail);
      }
    }
    assert.equal(verdict(base()).endpoint, "checked-local");
  });
  it("only verified or withdrawn blockers stop blocking the verdict [AC-27]", () => {
    const states: Finding["state"][] = ["open", "valid", "disputed", "withdrawn", "fixed", "verified", "deferred", "risk-accepted", "wont-fix"];
    for (const state of states) {
      const v = verdict({ ...base(), findings: [finding({ severity: "blocker", state })] });
      const closed = state === "verified" || state === "withdrawn";
      assert.equal(v.endpoint, closed ? "checked-local" : "implemented-unverified", state);
      assert.deepEqual(v.reasons.filter((r) => !r.note).map((r) => r.code), closed ? [] : ["blocker-open"], state);
      if (!closed) assert.deepEqual(v.reasons[0]?.refs, ["F1"], state);
    }
  });
  it("user-disposed major findings do not block the verdict [AC-27]", () => {
    const states: Finding["state"][] = ["open", "valid", "disputed", "withdrawn", "fixed", "verified", "deferred", "risk-accepted", "wont-fix"];
    for (const state of states) {
      const disposedByUser = state === "deferred" || state === "risk-accepted" || state === "wont-fix";
      const history = disposedByUser ? [{ to: state, by: "user" as const, reason: "accepted with the finding open", at: "2026-01-01T00:00:00Z" }] : [];
      const v = verdict({ ...base(), findings: [finding({ state, history })] });
      const nonblocking = disposedByUser || state === "verified" || state === "withdrawn";
      assert.equal(v.endpoint, nonblocking ? "checked-local" : "implemented-unverified", state);
      assert.deepEqual(v.reasons.filter((r) => !r.note).map((r) => r.code), nonblocking ? [] : ["major-undisposed"], state);
      if (!nonblocking) assert.deepEqual(v.reasons[0]?.refs, ["F1"], state);
    }
  });
  it("records the reason on a major disposition through the decision handler [AC-27]", async () => {
    const now = "2026-01-02T00:00:00.000Z";
    const ports = { ...createPorts(process.cwd(), {}), clock: { now: () => now, ms: () => Date.parse(now) } };
    const work = WorkContract.parse(contractFixture({ label: "W-0001", findings: [finding({})] }));
    const state = State.parse({ ...emptyState("workspace", "test"), work: { [work.id]: work } });
    const before = structuredClone(state);
    for (const outcome of ["deferred", "risk-accepted", "wont-fix"] as const) {
      const input = DecideInput.parse({
        h: handleOf(state, work), kind: "disposition", target: "F1", propose: { outcome, reason: "  user reason  " },
      });
      const plan = await decide.run(ports, state, input);
      const saved = State.parse(plan.state).work[work.id]!.findings[0]!;
      assert.equal(saved.state, outcome);
      assert.deepEqual(saved.history, [{ to: outcome, by: "user", reason: "user reason", at: now }]);
      assert.equal(verdict({ ...base(), findings: [saved] }).endpoint, "checked-local");
      assert.deepEqual(state, before);
    }
  });
  it("refuses direct blocker dispositions and major dispositions without a valid outcome and reason [AC-27]", async () => {
    const ports = createPorts(process.cwd(), {});
    for (const [severity, outcome, why, code] of [
      ["blocker", "deferred", "reason", "blocker-open"],
      ["blocker", "risk-accepted", "reason", "blocker-open"],
      ["blocker", "wont-fix", "reason", "blocker-open"],
      ["major", "verified", "reason", "revision-conflict"],
      ["major", "deferred", "   ", "revision-conflict"],
    ] as const) {
      const work = WorkContract.parse(contractFixture({ label: "W-0001", findings: [finding({ severity })] }));
      const state = State.parse({ ...emptyState("workspace", "test"), work: { [work.id]: work } });
      const before = structuredClone(state);
      const input = DecideInput.parse({
        h: handleOf(state, work), kind: "disposition", target: "F1", propose: { outcome, reason: why },
      });
      await assert.rejects(async () => decide.run(ports, state, input), (error: unknown) =>
        error instanceof KernelError && error.reasons.some((r) => r.code === code));
      assert.deepEqual(state, before);
      assert.equal(verdict({ ...base(), findings: work.findings }).endpoint, "implemented-unverified");
    }
  });
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
  it("retains every blocking reason under review, prototype and assistance ceilings [RES-02]", () => {
    const input = {
      ...base(),
      receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "fail", failures: [{ test: "broken", kind: "assertion", message: "failed" }] })],
      findings: [finding({ severity: "blocker" })],
      declined: ["review"],
      integratedStale: true,
    };
    const expected = ["evidence-failed", "blocker-open", "declined-step", "integration-unvalidated"];
    for (const [overrides, endpoint] of [
      [{}, "implemented-unverified"],
      [{ profile: "review" }, "findings-only"],
      [{ prototypeRequested: true }, "prototype"],
      [{ level: "L0" }, "blocked"],
    ] as const) {
      const v = verdict({ ...input, ...overrides });
      assert.equal(v.endpoint, endpoint);
      assert.deepEqual(v.reasons.filter((r) => !r.note).map((r) => r.code), expected, endpoint);
    }
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
  it("keeps an introduced failure unverified across every stop and budget outcome [AC-27]", () => {
    const stops: Array<VerdictInput["stopReason"]> = [undefined, "repeated-failure", "budget-exhausted", "host-limit", "user-stop", "declined"];
    for (const kind of ["assertion", "timeout", "compile-or-import", "runtime"]) {
      for (const stopReason of stops) {
        for (const attemptsLeft of [0, 1, 2]) {
          const input = {
            ...base(), stopReason, attemptsLeft,
            receipts: [rc("OB-EX-1"), rc("OB-suite", { status: "fail", failures: [{ test: "introduced", kind, message: "failed" }] })],
          };
          const v = verdict(input);
          const label = `${kind}, ${stopReason ?? "no stop"}, ${attemptsLeft} attempts`;
          assert.equal(v.endpoint, "implemented-unverified", label);
          assert.equal(v.scope, undefined, label);
          assert.equal(v.stopReason, stopReason, label);
          assert.deepEqual(v.reasons.filter(r => !r.note).map(r => r.code), ["evidence-failed"], label);
          assert.equal(continueRequired(v, input), !stopReason && attemptsLeft > 0, label);
        }
      }
    }
  });
  it("does not treat an excluded baseline failure as introduced work to retry [AC-27]", () => {
    const failure = { test: "legacy.test.ts#existing", kind: "assertion", message: "unchanged" };
    const stops: Array<VerdictInput["stopReason"]> = [undefined, "repeated-failure", "budget-exhausted", "host-limit", "user-stop", "declined"];
    for (const excluded of [true, false]) {
      for (const stopReason of stops) {
        for (const attemptsLeft of [0, 1, 2]) {
          const input: VerdictInput = {
            ...base(), stopReason, attemptsLeft, ...sealedWith([idOf(failure.test)], excluded ? [idOf(failure.test)] : []),
            receipts: [rc("OB-EX-1"), suiteFail([failure])],
          };
          const v = verdict(input);
          const label = `${excluded ? "excluded" : "not excluded"}, ${stopReason ?? "no stop"}, ${attemptsLeft} attempts`;
          assert.equal(v.endpoint, excluded ? "checked-local" : "implemented-unverified", label);
          assert.equal(v.scope, excluded ? "committed" : undefined, label);
          assert.equal(v.stopReason, stopReason, label);
          assert.deepEqual(v.reasons.map(r => r.code), [excluded ? "baseline-failure-excluded" : "baseline-failure-not-excluded"], label);
          assert.equal(v.reasons[0]?.note === true, excluded, label);
          if (excluded) assert.ok(v.reasons[0]?.message.includes("legacy.test.ts"), label);
          assert.equal(continueRequired(v, input), false, label);
        }
      }
    }
  });
  it("does not excuse partially excluded, mixed or unnamed failures at stop and budget boundaries [AC-27]", () => {
    const legacy = { test: "legacy.test.ts#existing", kind: "assertion", message: "unchanged" };
    const other = { test: "legacy.test.ts#other", kind: "assertion", message: "unchanged" };
    const introduced = { test: "new.test.ts#introduced", kind: "assertion", message: "failed" };
    const cases = [
      { label: "partially excluded baseline", failures: [legacy, other], baseline: [legacy.test, other.test], code: "baseline-failure-not-excluded" },
      { label: "baseline and introduced", failures: [legacy, introduced], baseline: [legacy.test], code: "evidence-failed" },
      { label: "unnamed failure", failures: [], baseline: [legacy.test], code: "classification-unknown" },
    ];
    const stops: Array<VerdictInput["stopReason"]> = [undefined, "repeated-failure", "budget-exhausted", "host-limit", "user-stop", "declined"];
    for (const c of cases) {
      for (const stopReason of stops) {
        for (const attemptsLeft of [0, 1, 2]) {
          const input: VerdictInput = {
            ...base(), stopReason, attemptsLeft, ...sealedWith(c.baseline.map((t) => idOf(t)), [idOf(legacy.test)]),
            receipts: [rc("OB-EX-1"), suiteFail(c.failures)],
          };
          const v = verdict(input);
          const label = `${c.label}, ${stopReason ?? "no stop"}, ${attemptsLeft} attempts`;
          assert.equal(v.endpoint, "implemented-unverified", label);
          assert.equal(v.scope, undefined, label);
          assert.equal(v.stopReason, stopReason, label);
          assert.deepEqual(v.reasons.map(r => r.code), [c.code], label);
          assert.equal(continueRequired(v, input), c.code === "evidence-failed" && !stopReason && attemptsLeft > 0, label);
        }
      }
    }
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

describe("threat and data note in the verdict [QLT-13]", () => {
  const note = (id: string, kind: BasisElement["kind"], threat: BasisElement["threat"]): BasisElement =>
    ({ id, origin: "request", kind, text: id, verifiedBy: [], threat });
  const complete = [req, { ...ex, threat: "data" as const }, { ...note("A-1", "assumption", "actor"), verifiedBy: [{ method: "manual" as const, ref: "confirmed by the user" }] }, note("C-1", "constraint", "asset"), note("C-2", "constraint", "abuse")];

  it("[QLT-13] holds a security-relevant change below checked-local while its note is incomplete", () => {
    const v = verdict({ ...base(), changeTraits: ["auth"] });
    assert.notEqual(v.endpoint, "checked-local");
    const open = v.reasons.find((r) => r.code === "threat-note-open");
    assert.ok(open && !open.note, JSON.stringify(v.reasons));
    assert.match(open.message, /missing actor, asset, data, abuse/);
  });

  it("[QLT-13] a complete note allows checked-local and says which security items are only constraints", () => {
    const v = verdict({ ...base(), changeTraits: ["auth"], elements: complete, confirmedAssumptions: ["A-1"] });
    assert.equal(v.endpoint, "checked-local", JSON.stringify(v.reasons));
    assert.equal(v.reasons.some((r) => r.code === "threat-note-open"), false);
    const unchecked = v.reasons.find((r) => r.code === "threat-constraints-unchecked");
    assert.ok(unchecked?.note, JSON.stringify(v.reasons));
    assert.match(unchecked.message, /: 2 security item\(s\) are constraints$/);
  });

  it("[QLT-13] needs no note for a change without a security-relevant trait", () => {
    const v = verdict({ ...base(), changeTraits: ["ui"] });
    assert.equal(v.endpoint, "checked-local");
    assert.equal(v.reasons.some((r) => r.code.startsWith("threat-")), false);
  });
});
