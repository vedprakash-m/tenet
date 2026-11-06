import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, contractFixture, project, reviewResult } from "./support/fixture.ts";
import { gather, verdictInput } from "../src/verbs/facts.ts";
import { deepPasses, issueReview } from "../src/verbs/manifest.ts";
import { findings } from "../src/verbs/findings.ts";
import { FindingsInput, ReviewResult, type AnalystLink, type Finding, type Receipt, type Reservation, type ReviewLink } from "../src/core/schemas.ts";
import { buildManifest, checkResult, estimateTokens, reviewOnlyManifest, TOKEN_BUDGET } from "../src/core/review.ts";
import { KernelError } from "../src/core/errors.ts";
import { emptyState } from "../src/core/state.ts";
import { handleOf } from "../src/verbs/common.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function context() {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "feature", request: "review", lane: "standard" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  const ports = p.ports(), state = ports.store.read()!.state, work = Object.values(state.work)[0]!;
  return { ports, state, work, h, facts: await gather(ports, work) };
}

describe("review admission [WRK-08, REV-05]", () => {
  it("carries recorded findings and dispositions within the complete packet budget [REV-04, AGT-04]", () => {
    const findings: Finding[] = (["valid", "open", "disputed", "fixed", "verified", "withdrawn", "risk-accepted", "deferred", "wont-fix"] as const).map((state, index) => ({
      id: `FND-${index + 1}`, n: index + 1, severity: index % 2 ? "blocker" : "major", axis: "behavior", state,
      location: { path: "src/example.ts", line: index + 1 }, claim: `Boundary ${state}`,
      evidence: "src/example.ts:1 inspected", fix: "Preserve the boundary",
      history: [{ to: state, by: "reviewer", reason: "Recorded evidence", at: "2026-11-04" }],
    }));
    const work = contractFixture({ findings }), before = structuredClone(work);
    for (const mode of ["full", "recheck"] as const) {
      const activeFindings = findings.filter(f => f.severity === "blocker"
        ? !["verified", "withdrawn"].includes(f.state)
        : ["open", "valid", "disputed", "fixed"].includes(f.state));
      const input = {
        work, elements: [], changes: [], candidate: "candidate", basisHash: "basis", attempt: 1,
        mode, recheckFindings: findings.filter(f => f.state === "fixed"), rubric: "", id: work.label, files: {}, charter: "",
      };
      const packet = buildManifest(input);
      assert.ok("text" in packet);
      assert.deepEqual(JSON.parse(packet.text).findings, activeFindings);
      assert.equal(packet.tokens, estimateTokens(packet.text));
      const empty = buildManifest({ ...input, work: { ...work, findings: [] } });
      assert.ok("text" in empty);
      assert.deepEqual(JSON.parse(empty.text).findings, []);
      assert.notEqual(empty.hash, packet.hash, "open finding evidence participates in manifest identity");
      const maxLength = Math.floor(TOKEN_BUDGET * 4 / 1.1);
      const charter = "x".repeat(maxLength - packet.text.length);
      const exact = buildManifest({ ...input, charter });
      assert.ok("text" in exact);
      assert.equal(exact.tokens, TOKEN_BUDGET);
      assert.deepEqual(JSON.parse(exact.text).findings, activeFindings);
      for (const over of [
        { ...input, charter: charter + "x" },
        { ...input, charter, work: { ...work, findings: [...findings, { ...findings[0]!, id: "FND-10", n: 10 }] } },
      ]) {
        const refused = buildManifest(over);
        assert.ok("code" in refused);
        assert.equal(refused.code, "narrow-increment");
      }
    }
    assert.deepEqual(work, before, "packet construction never relabels recorded findings");
  });

  it("reuses review completion only when the latest complete chain is eligible [REV-01, REV-08]", async () => {
    const p = project(); roots.push(p.root);
    const ports = p.ports(), seed = contractFixture({
      label: "W-0001", lane: "standard",
      basis: { intentRevision: 0, elementIds: [], hash: "basis", traits: [] },
    });
    const facts = { ...await gather(ports, seed), reviewPaths: ["src/greet.ts"] };
    const files = Object.fromEntries(facts.reviewPaths.map(path => [path, facts.inv.entries.get(path)?.blob ?? ""]));
    const full: ReviewLink = {
      reservation: "RV-full", candidate: facts.candidate, basisHash: seed.basis!.hash, mode: "full",
      status: "completed", independence: "subagent-fresh", files, uncovered: [], verified: [],
      coverage: { inspected: Object.keys(files), uncovered: [], crossCutting: "greet and callers inspected", sampled: [] },
    };
    const recheck: ReviewLink = { ...full, reservation: "RV-recheck", mode: "recheck", basedOn: full.reservation };
    const cases: Array<[ReviewLink[], boolean]> = [
      [[full], true],
      [[full, recheck], true],
      [[{ ...full, status: "partial" }, full], true],
      [[recheck], false],
      [[{ ...full, status: "partial" }, recheck], false],
      [[{ ...full, basisHash: "older" }, recheck], false],
      [[{ ...full, mode: "recheck" }, recheck], false],
      ...(["partial", "blocked", "failed", "cancelled"] as const).map((status): [ReviewLink[], boolean] => [[full, { ...full, status }], false]),
      ...[
        { independence: "same-session" as const }, { candidate: "older" }, { basisHash: "older" },
        { uncovered: ["src/other.ts"] }, { openDependencies: ["src/other.ts:1 remains uninspected"] },
        { files: {} }, { coverage: undefined },
        { coverage: { ...full.coverage!, inspected: [] } },
        { coverage: { ...full.coverage!, crossCutting: "" } },
        { coverage: { ...full.coverage!, sampled: [{ symbol: "greet", callers: 20, opened: 1, semantic: true, why: "sampled" }] } },
      ].map((over): [ReviewLink[], boolean] => [[full, { ...full, ...over }], false]),
    ];
    for (const [reviews, reused] of cases) {
      const work = { ...seed, reviews }, state = { ...emptyState("workspace", "test"), work: { [seed.id]: work } };
      const before = structuredClone(state);
      const issued = issueReview(ports, state, work, facts, []);
      assert.equal(issued.data === undefined, reused, JSON.stringify(reviews));
      assert.equal(issued.next.some(action => action.action === "finish"), reused);
      assert.equal(issued.work.budget.reservations.length, reused ? 0 : 1);
      assert.deepEqual(state, before);
    }
    const quick = { ...seed, lane: "quick" as const, reviews: [{ ...full, independence: "same-session" as const }] };
    const state = { ...emptyState("workspace", "test"), work: { [quick.id]: quick } };
    assert.ok(issueReview(ports, state, quick, facts, []).next.some(action => action.action === "finish"));
    const reviewed = { ...seed, reviews: [full] };
    assert.ok(issueReview(ports, state, reviewed, facts, [], true).data, "explicit retry is never a cache hit");
    const sampled = {
      ...full, coverage: { ...full.coverage!, sampled: [{ symbol: "greet", callers: 20, opened: 1, semantic: false, why: "same signature" }] },
    };
    const typed = { ...seed, reviews: [sampled], obligations: [{ id: "types", kind: "static" as const, category: "affected" as const, tool: "tsc" }] };
    const checkInputId = verdictInput(ports, state, typed, facts).checkInputId;
    const passing: Receipt = {
      id: "RC-types", obligation: "types", kind: "static", stage: "candidate", source: "kernel-run",
      checkInputId, scope: "full", argv: [], cwd: ".", durationMs: 1,
      versions: { tool: "1", reporter: "r", adapter: "a" },
      provenance: { runId: "run", runDir: "dir", startedAt: "test" }, status: "pass",
      qualifiers: [], reasons: [], limitations: [], candidate: facts.candidate,
    };
    const receiptCases: Array<{ name: string; receipts: Receipt[]; reused: boolean }> = [
      { name: "no receipt", receipts: [], reused: false },
      { name: "older check inputs", receipts: [{ ...passing, checkInputId: "older" }], reused: false },
      { name: "older candidate", receipts: [{ ...passing, candidate: "older" }], reused: false },
      { name: "targeted types", receipts: [{ ...passing, scope: "targeted" }], reused: false },
      { name: "baseline types", receipts: [{ ...passing, stage: "baseline" }], reused: false },
      ...(["fail", "inconclusive", "skipped"] as const).map(status => ({
        name: `${status} types`, receipts: [{ ...passing, status }], reused: false,
      })),
      { name: "current full pass", receipts: [passing], reused: true },
      { name: "newer failure", receipts: [passing, { ...passing, status: "fail" }], reused: false },
      { name: "newer pass", receipts: [{ ...passing, status: "fail" }, passing], reused: true },
      { name: "later stale result", receipts: [passing, { ...passing, checkInputId: "older", status: "fail" }], reused: true },
      { name: "later baseline result", receipts: [passing, { ...passing, stage: "baseline", status: "fail" }], reused: true },
    ];
    for (const { name, receipts, reused } of receiptCases) {
      const work = { ...typed, receipts };
      const issued = issueReview(ports, state, work, facts, []);
      assert.equal(issued.data === undefined, reused, name);
      assert.equal(issued.next.some(action => action.action === "finish"), reused, name);
      assert.equal(issued.work.budget.reservations.length, reused ? 0 : 1, name);
    }
    const linted = { ...typed, obligations: typed.obligations.map(ob => ({ ...ob, tool: "eslint" })) };
    const lintInputId = verdictInput(ports, state, linted, facts).checkInputId;
    const lintReview = issueReview(ports, state, { ...linted, receipts: [{ ...passing, checkInputId: lintInputId }] }, facts, []);
    assert.ok(lintReview.data, "a passing non-type static check does not cover sampled callers");
    assert.equal(lintReview.next.some(action => action.action === "finish"), false);
    assert.equal(lintReview.work.budget.reservations.length, 1);
  });

  it("requires review follow-up for reported open dependencies [REV-08, AGT-05]", async () => {
    const p = project(); roots.push(p.root);
    const reservation: Reservation = {
      id: "RV-dependencies", role: "reviewer", manifest: "review.json", manifestHash: "dependency-hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
    };
    for (const lane of ["quick", "standard", "deep"] as const) {
      for (const openDependencies of [undefined, [], ["src/dependency.ts:1 remains uninspected"]]) {
        const work = contractFixture({ label: "W-0001", lane });
        if (lane === "quick") work.focusedReview = reservation;
        else work.budget.reservations = [reservation];
        const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } }, before = structuredClone(state);
        const plan = await findings.run(p.ports(), state, FindingsInput.parse({
          h: handleOf(state, work),
          result: reviewResult({ review: { hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "full", files: [] } }, {
            dispatchMode: lane === "quick" ? "same-session" : "subagent-fresh", openDependencies,
          }),
        }));
        const unresolved = !!openDependencies?.length;
        const next = plan.resp.next ?? [];
        assert.equal(next.some(action => action.action === "finish"), !unresolved, `${lane}/${openDependencies}`);
        if (unresolved) assert.ok(next.some(action => action.action === (lane === "quick" ? "focused-review" : "review") && action.required));
        const after = plan.state!.work[work.id]!;
        assert.equal(after.reviews.at(-1)!.status, unresolved ? "partial" : "completed");
        assert.deepEqual(after.reviews.at(-1)!.openDependencies, openDependencies ?? []);
        assert.equal(after.budget.reviewRounds, work.budget.reviewRounds + 1);
        assert.equal(after.budget.delegations, work.budget.delegations + (lane === "quick" ? 0 : 1));
        assert.equal(after.budget.reservations.length, 0);
        assert.equal(after.focusedReview, undefined);
        assert.deepEqual(state, before);
      }
    }
  });

  it("keeps required Deep passes visible after recording an analyst result [WRK-04, AGT-05]", async () => {
    const p = project(); roots.push(p.root);
    const ports = p.ports(), seed = contractFixture({ label: "W-0001", lane: "deep" });
    const candidate = (await gather(ports, seed)).candidate;
    const pass = (role: AnalystLink["role"]): AnalystLink => ({
      reservation: `AN-${role}`, role, question: "Inspect this candidate", revision: candidate,
      status: "completed", independence: "subagent-fresh", artifacts: [], findings: [], openDependencies: [],
    });
    const reservation: Reservation = {
      id: "AN-latest", role: "analyst", analystRole: "architect", question: "Inspect this candidate",
      manifest: "analyst.json", manifestHash: "analyst-hash", candidate, basisHash: "basis", attempt: 1, mode: "full", files: {},
    };
    for (const lane of ["quick", "standard", "deep"] as const) {
      for (const over of [
        {}, { revision: "older" }, { dispatchMode: "same-session" as const },
        { openDependencies: ["src/dependency.ts:1 remains uninspected"] },
        { status: "partial" as const }, { status: "blocked" as const },
        { status: "failed" as const }, { status: "cancelled" as const },
      ]) {
        const work = { ...seed, lane, analyses: [pass("architect"), pass("security")] };
        work.budget = { ...seed.budget, reservations: [reservation] };
        const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } }, before = structuredClone(state);
        const result = {
          kind: "analyst" as const, manifest: reservation.manifestHash, reservation: reservation.id, attempt: 1,
          role: "architect" as const, status: "completed" as const, revision: candidate,
          dispatchMode: "subagent-fresh" as const, artifacts: [], findings: [], openDependencies: [], ...over,
        };
        const plan = await findings.run(ports, state, FindingsInput.parse({ h: handleOf(state, work), result }));
        const incomplete = result.status !== "completed";
        const unresolved = incomplete || lane === "deep" && Object.keys(over).length > 0;
        const next = plan.resp.next ?? [];
        assert.equal(next.length, unresolved ? 1 : 0, `${lane}/${JSON.stringify(over)}`);
        if (unresolved) {
          assert.equal(next[0]!.action, "analyst");
          assert.equal(next[0]!.required, true);
          assert.match(next[0]!.why, incomplete ? /retry with packet analyst/ : /--analyst-role architect/);
        }
        const after = plan.state!.work[work.id]!;
        assert.equal(after.analyses.length, work.analyses.length + 1);
        assert.equal(after.analyses.at(-1)!.status, result.status);
        assert.deepEqual(after.analyses.at(-1)!.openDependencies, result.openDependencies);
        assert.equal(after.budget.delegations, work.budget.delegations + (result.dispatchMode === "subagent-fresh" ? 1 : 0));
        assert.equal(after.budget.reviewRounds, work.budget.reviewRounds);
        assert.equal(after.budget.reservations.length, 0);
        assert.deepEqual(state, before);
      }
    }
  });

  it("keeps unresolved finding states blocking review completion guidance [REV-04]", async () => {
    const p = project(); roots.push(p.root);
    const reservation: Reservation = {
      id: "RV-states", role: "reviewer", manifest: "review.json", manifestHash: "states-hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
    };
    for (const severity of ["blocker", "major", "minor", "note"] as const) {
      for (const stateName of ["open", "valid", "disputed", "fixed", "verified", "withdrawn", "deferred", "risk-accepted", "wont-fix"] as const) {
        const finding: Finding = {
          id: "FND-1", n: 1, severity, state: stateName, axis: "behavior", location: { path: "src/example.ts" },
          claim: "A reported boundary", evidence: "src/example.ts:1", history: [],
        };
        const work = contractFixture({ label: "W-0001", findings: [finding] });
        work.budget.reservations = [reservation];
        const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } }, before = structuredClone(state);
        const plan = await findings.run(p.ports(), state, FindingsInput.parse({
          h: handleOf(state, work),
          result: reviewResult({ review: { hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "full", files: [] } }),
        }));
        const closed = stateName === "verified" || stateName === "withdrawn";
        const disposed = closed || ["deferred", "risk-accepted", "wont-fix"].includes(stateName);
        const blocking = severity === "blocker" ? !closed : severity === "major" && !disposed;
        const data = plan.resp.data as { blocking: Array<{ id: string }> };
        assert.deepEqual(data.blocking.map(item => item.id), blocking ? [finding.id] : [], `${severity}/${stateName}`);
        assert.equal(plan.resp.next?.some(action => action.action === "finish"), !blocking, `${severity}/${stateName}`);
        assert.deepEqual(plan.state!.work[work.id]!.findings, work.findings);
        assert.equal(plan.state!.work[work.id]!.budget.reviewRounds, work.budget.reviewRounds + 1);
        assert.equal(plan.state!.work[work.id]!.budget.delegations, work.budget.delegations + 1);
        assert.deepEqual(state, before);
      }
    }
  });

  it("requests Deep passes from the latest role result and its open dependencies [WRK-04, AGT-05]", () => {
    const pass = (role: AnalystLink["role"], over: Partial<AnalystLink> = {}): AnalystLink => ({
      reservation: `AN-${role}`, role, question: "Inspect this candidate", revision: "candidate",
      status: "completed", independence: "subagent-fresh", artifacts: [], findings: [], openDependencies: [], ...over,
    });
    const roles = (analyses: AnalystLink[], lane: "deep" | "standard" | "quick" = "deep") => {
      const work = contractFixture({ lane, analyses }), before = structuredClone(work);
      const next = deepPasses(work, "candidate");
      assert.deepEqual(work, before);
      for (const action of next) {
        assert.equal(action.action, "analyst");
        assert.equal(action.required, true);
      }
      return next.map(action => /--analyst-role (architect|security)/.exec(action.why)?.[1]);
    };
    assert.deepEqual(roles([]), ["architect", "security"]);
    assert.deepEqual(roles([pass("researcher")]), ["architect", "security"]);
    assert.deepEqual(roles([pass("architect"), pass("security")]), []);
    assert.deepEqual(roles([pass("architect"), pass("security"), pass("researcher", { status: "failed" })]), []);
    for (const role of ["architect", "security"] as const) {
      const other = role === "architect" ? "security" : "architect";
      for (const over of [
        { status: "partial" as const }, { status: "blocked" as const }, { status: "failed" as const },
        { status: "cancelled" as const }, { revision: "older" }, { independence: "same-session" as const },
        { openDependencies: ["src/example.ts:1 remains unresolved"] },
      ]) {
        const incomplete = pass(role, over);
        assert.deepEqual(roles([pass(role), pass(other), incomplete]), [role], JSON.stringify(over));
        assert.deepEqual(roles([incomplete, pass(other), pass(role)]), []);
        assert.deepEqual(roles([incomplete, pass(other)]), [role]);
      }
    }
    for (const lane of ["quick", "standard"] as const) assert.deepEqual(roles([], lane), []);
  });

  it("keeps an unresolved latest Deep pass required after recording a reviewer result [WRK-04, AGT-05]", async () => {
    const p = project(); roots.push(p.root);
    const reservation: Reservation = {
      id: "RV-deep", role: "reviewer", manifest: "review.json", manifestHash: "deep-hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
    };
    const architect: AnalystLink = {
      reservation: "AN-architecture", role: "architect", question: "Inspect this candidate", revision: "candidate",
      status: "completed", independence: "subagent-fresh", artifacts: [], findings: [], openDependencies: [],
    };
    const security: AnalystLink = { ...architect, reservation: "AN-security", role: "security" };
    for (const latest of [
      { ...architect, status: "failed" as const },
      { ...architect, openDependencies: ["src/example.ts:1 remains unresolved"] },
      { ...architect },
    ]) {
      const work = contractFixture({ label: "W-0001", lane: "deep", analyses: [architect, security, latest] });
      work.budget.reservations = [reservation];
      const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } }, before = structuredClone(state);
      const plan = await findings.run(p.ports(), state, FindingsInput.parse({
        h: handleOf(state, work),
        result: reviewResult({ review: { hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "full", files: [] } }),
      }));
      const outstanding = latest.status !== "completed" || latest.openDependencies.length > 0;
      const next = plan.resp.next?.filter(action => action.action === "analyst") ?? [];
      assert.equal(next.length, outstanding ? 1 : 0);
      if (outstanding) {
        assert.equal(next[0]!.required, true);
        assert.match(next[0]!.why, /--analyst-role architect/);
      }
      const after = plan.state!.work[work.id]!;
      assert.equal(after.budget.delegations, work.budget.delegations + 1);
      assert.equal(after.budget.reviewRounds, work.budget.reviewRounds + 1);
      assert.equal(after.budget.reservations.length, 0);
      assert.deepEqual(after.analyses, work.analyses);
      assert.deepEqual(state, before);
    }
  });

  it("includes each named finding's result shape only in recheck packets [REV-04, AGT-04]", () => {
    const named: Finding[] = ["FND-2", "FND-7"].map((id, n) => ({
      id, n: n + 1, severity: "major", axis: "behavior", state: "fixed",
      claim: `Boundary ${id}`, evidence: "src/example.ts:1", location: { path: "src/example.ts", line: n + 1 }, history: [],
    }));
    const work = contractFixture({ findings: named });
    for (const mode of ["full", "recheck"] as const) {
      for (const recheckFindings of [[], named]) {
        const result = buildManifest({
          work, elements: [], changes: [], candidate: "candidate", basisHash: "basis", attempt: 1,
          mode, recheckFindings, rubric: "Review the complete delta.", id: work.label, files: {}, charter: "",
        });
        assert.ok("text" in result);
        const packet = JSON.parse(result.text);
        if (mode === "full") {
          assert.equal(Object.hasOwn(packet.resultTemplate, "rechecked"), false);
          continue;
        }
        assert.deepEqual(packet.resultTemplate.rechecked, recheckFindings.map(finding => ({
          finding: finding.id, outcome: "verified | still-open", evidence: "path:line or command -> observed output",
        })));
        assert.deepEqual(packet.recheck.map((finding: { id: string }) => finding.id), recheckFindings.map(finding => finding.id));
        for (const outcome of ["verified", "still-open"] as const) {
          const response = ReviewResult.parse({
            ...reviewResult({ review: { hash: result.hash, reservation: result.reservation.id, attempt: 1, mode, files: [] } }),
            rechecked: packet.resultTemplate.rechecked.map((entry: { finding: string }) => ({
              finding: entry.finding, outcome, evidence: "src/example.ts:2 inspected",
            })),
          });
          assert.deepEqual(response.rechecked?.map(entry => entry.finding), recheckFindings.map(finding => finding.id));
          assert.equal(checkResult({
            ...work, budget: { ...work.budget, reservations: [result.reservation] },
          }, response, "standard").reservation?.id, result.reservation.id);
        }
        assert.equal(result.tokens, estimateTokens(result.text));
        assert.ok(result.tokens <= TOKEN_BUDGET);
      }
    }
  });

  it("counts the complete recheck result template against the packet budget [REV-08, AGT-04]", () => {
    const work = contractFixture();
    const finding: Finding = {
      id: "FND-1", n: 1, severity: "major", axis: "behavior", state: "fixed",
      claim: "Boundary", evidence: "src/example.ts:1", location: { path: "src/example.ts", line: 1 }, history: [],
    };
    const input = {
      work, elements: [], changes: [], candidate: "candidate", basisHash: "basis", attempt: 1,
      mode: "recheck" as const, recheckFindings: [finding], rubric: "", id: work.label, files: {}, charter: "",
    };
    const small = buildManifest(input);
    assert.ok("text" in small);
    const maxLength = Math.floor(TOKEN_BUDGET * 4 / 1.1);
    const charter = "x".repeat(maxLength - small.text.length);
    const exact = buildManifest({ ...input, charter });
    assert.ok("text" in exact);
    assert.equal(exact.text.length, maxLength);
    assert.equal(exact.tokens, TOKEN_BUDGET);
    assert.equal(JSON.parse(exact.text).resultTemplate.rechecked.length, 1);
    const large = buildManifest({ ...input, charter: charter + "x" });
    assert.ok("code" in large);
    assert.equal(large.code, "narrow-increment");
    const more = buildManifest({ ...input, charter, recheckFindings: [finding, { ...finding, id: "FND-2" }] });
    assert.ok("code" in more);
    assert.equal(more.code, "narrow-increment");
  });

  it("refuses ambiguous attention claims without clearing attention or settling review [REV-03]", async () => {
    const p = project(); roots.push(p.root);
    const reservation: Reservation = {
      id: "RV-attention", role: "reviewer", manifest: "review.json", manifestHash: "attention-hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
    };
    const marker = { id: "AT-1", path: "src/example.ts", line: 1, pattern: "skip", marker: true };
    const accepted = { id: marker.id, disposition: "accepted" as const, reason: "src/example.ts:1 skip inspected" };
    const claims = [
      { attention: [{ ...accepted, id: "unknown" }], invalid: true },
      { attention: [accepted, accepted], invalid: true },
      { attention: [accepted, { ...accepted, disposition: "finding" as const }], invalid: true },
      { attention: [{ ...accepted, disposition: "finding" as const }, accepted], invalid: true },
      { attention: [{ ...accepted, reason: " \t" }], invalid: true },
      { attention: [{ ...accepted, disposition: "finding" as const, reason: "" }], invalid: true },
      { attention: [accepted], invalid: false },
      { attention: [{ ...accepted, disposition: "finding" as const }], invalid: false },
      { attention: [], invalid: false },
    ];
    for (const claim of claims) {
      for (const dispatchMode of ["subagent-fresh", "same-session"] as const) {
        const work = contractFixture({ label: "W-0001", attention: [marker] });
        work.budget.reservations = [reservation];
        const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } }, before = structuredClone(state);
        const plan = await findings.run(p.ports(), state, FindingsInput.parse({
          h: handleOf(state, work),
          result: reviewResult({ review: {
            hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "full", files: [],
          } }, { attention: claim.attention, dispatchMode }),
        }));
        const after = plan.state!.work[work.id]!;
        assert.deepEqual(state, before);
        assert.deepEqual(after.findings, work.findings);
        assert.equal(after.budget.delegations, work.budget.delegations + (dispatchMode === "subagent-fresh" ? 1 : 0));
        assert.equal(after.budget.rechecks, work.budget.rechecks);
        if (claim.invalid) {
          assert.equal(plan.resp.exit, 2);
          assert.deepEqual(plan.resp.reasons?.map(reason => reason.code), ["review-result-invalid"]);
          assert.deepEqual(after.attention, work.attention);
          assert.deepEqual(after.reviews, work.reviews);
          assert.deepEqual(after.budget.reservations, [reservation]);
          assert.equal(after.budget.reviewRounds, work.budget.reviewRounds);
          assert.ok(!plan.resp.next?.some(next => next.action === "finish"));
        } else {
          assert.equal(plan.resp.exit, undefined);
          const disposition = claim.attention[0];
          assert.deepEqual(after.attention[0]!.disposition, disposition ? {
            by: dispatchMode === "subagent-fresh" ? "reviewer" : "same-session",
            outcome: disposition.disposition, reason: disposition.reason,
          } : undefined);
          assert.equal(after.reviews.length, work.reviews.length + 1);
          assert.equal(after.budget.reservations.length, 0);
          assert.equal(after.budget.reviewRounds, work.budget.reviewRounds + 1);
        }
      }
    }
  });

  it("refuses invalid recheck claims before mutation and applies an admitted fixed-finding result [REV-04]", async () => {
    const p = project(); roots.push(p.root);
    const finding: Finding = {
      id: "FND-1", n: 1, severity: "major", axis: "behavior", state: "fixed",
      claim: "A boundary was missing", evidence: "src/example.ts:1", location: { path: "src/example.ts", line: 1 },
      history: [{ to: "fixed", by: "coordinator", reason: "src/example.ts:2 changed", at: "2026-01-01T00:00:00.000Z" }],
    };
    const reservation: Reservation = {
      id: "RV-recheck", role: "reviewer", manifest: "review.json", manifestHash: "recheck-hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "recheck", files: {},
    };
    const base = { finding: finding.id, outcome: "verified" as const, evidence: "src/example.ts:2 checked" };
    for (const stateName of ["valid", "deferred", "fixed"] as const) {
      const work = contractFixture({ label: "W-0001", findings: [{ ...finding, state: stateName }] });
      work.budget.reservations = [reservation];
      const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } };
      for (const rechecked of stateName === "fixed" ? [
        [{ ...base, finding: "unknown" }], [base, base], [{ ...base, evidence: "  " }],
      ] : [[base]]) {
        const before = structuredClone(state);
        const plan = await findings.run(p.ports(), state, FindingsInput.parse({
          h: handleOf(state, work),
          result: reviewResult({ review: { hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "recheck", files: [] } }, { rechecked }),
        }));
        const after = plan.state!.work[work.id]!;
        assert.equal(plan.resp.exit, 2);
        assert.deepEqual(plan.resp.reasons?.map(reason => reason.code), ["review-result-invalid"]);
        assert.deepEqual(after.findings, work.findings);
        assert.deepEqual(after.reviews, work.reviews);
        assert.deepEqual(after.budget.reservations, [reservation]);
        assert.equal(after.budget.delegations, work.budget.delegations + 1);
        assert.equal(after.budget.rechecks, work.budget.rechecks);
        assert.equal(after.budget.reviewRounds, work.budget.reviewRounds);
        assert.deepEqual(state, before);
      }
    }
    for (const outcome of ["verified", "still-open"] as const) {
      const work = contractFixture({ label: "W-0001", findings: [finding] });
      work.budget.reservations = [reservation];
      const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } }, before = structuredClone(state);
      const plan = await findings.run(p.ports(), state, FindingsInput.parse({
        h: handleOf(state, work),
        result: reviewResult({ review: { hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "recheck", files: [] } },
          { rechecked: [{ ...base, outcome }] }),
      }));
      const after = plan.state!.work[work.id]!, target = outcome === "verified" ? "verified" : "valid";
      assert.equal(plan.resp.exit, undefined);
      assert.equal(after.findings[0]!.state, target);
      assert.equal(after.findings[0]!.history.length, finding.history.length + 1);
      assert.equal(after.findings[0]!.history.at(-1)!.by, "reviewer");
      assert.equal(after.budget.rechecks, work.budget.rechecks + 1);
      assert.equal(after.budget.delegations, work.budget.delegations + 1);
      assert.equal(after.budget.reviewRounds, work.budget.reviewRounds);
      assert.equal(after.budget.reservations.length, 0);
      assert.deepEqual(after.reviews.at(-1)!.verified, outcome === "verified" ? [finding.id] : []);
      assert.deepEqual(state, before);
    }
  });
  it("refuses full-review verification before application while counting the reported dispatch [REV-04]", async () => {
    const p = project(); roots.push(p.root);
    const finding: Finding = {
      id: "FND-1", n: 1, severity: "major", axis: "behavior", state: "valid",
      claim: "A boundary is missing", evidence: "src/example.ts:1", location: { path: "src/example.ts", line: 1 },
      history: [{ to: "valid", by: "reviewer", reason: "recorded", at: "2026-01-01T00:00:00.000Z" }],
    };
    const reservation: Reservation = {
      id: "RV-full", role: "reviewer", manifest: "review.json", manifestHash: "full-hash",
      candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
    };
    const work = contractFixture({ label: "W-0001", findings: [finding] });
    work.budget.reservations = [reservation];
    const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } };
    const before = structuredClone(state);
    const result = await findings.run(p.ports(), state, FindingsInput.parse({
      h: handleOf(state, work),
      result: reviewResult({ review: {
        hash: reservation.manifestHash, reservation: reservation.id, attempt: 1, mode: "full", files: [],
      } }, { rechecked: [{ finding: finding.id, outcome: "verified", evidence: "src/example.ts:2" }] }),
    }));
    assert.equal(result.resp.exit, 2);
    assert.deepEqual(result.resp.reasons?.map(reason => reason.code), ["review-result-invalid"]);
    const after = result.state!.work[work.id]!;
    assert.deepEqual(after.findings, before.work[work.id]!.findings);
    assert.deepEqual(after.reviews, before.work[work.id]!.reviews);
    assert.deepEqual(after.budget.reservations, [reservation]);
    assert.equal(after.budget.delegations, work.budget.delegations + 1);
    assert.equal(after.budget.reviewRounds, work.budget.reviewRounds);
    assert.ok(!result.resp.next?.some(next => next.action === "finish"));
    assert.deepEqual(state, before);
  });
  it("refuses an oversized complete review-only assignment [AGT-04]", () => {
    assert.throws(() => reviewOnlyManifest([], [], "x".repeat(80_000), null), error => {
      assert.ok(error instanceof KernelError);
      assert.equal(error.exit, 2);
      assert.equal(error.reasons[0]?.code, "narrow-increment");
      assert.ok(error.next?.some(next => next.action === "ask" && /narrow/i.test(next.why) && next.required));
      return true;
    });
  });
  it("preserves a small complete review-only assignment [AGT-04]", () => {
    const rubric = "Review correctness and security.\n".repeat(12);
    const changes = [{ path: "src/example.ts", kind: "source" as const, added: 2, removed: 1, hunks: [] }];
    const attention = [{ id: "AT-example", path: "src/example.ts", line: 1, pattern: "as any", marker: true }];
    const result = reviewOnlyManifest(changes, attention, rubric, "head");
    const packet = JSON.parse(result.text);
    assert.equal(packet.rubric.join(""), rubric);
    assert.deepEqual(packet.changes, [{ path: "src/example.ts", kind: "source", added: 2, removed: 1 }]);
    assert.deepEqual(packet.attention, attention);
    assert.deepEqual(packet.investigation, ["src/example.ts"]);
    assert.equal(result.tokens, estimateTokens(result.text));
    assert.ok(result.tokens < TOKEN_BUDGET);
  });
  it("accepts exactly the review-only token bound and refuses one character more [AGT-04]", () => {
    const rubric = "x".repeat(1_000);
    const emptyHead = reviewOnlyManifest([], [], rubric, "");
    const maxLength = Math.floor(TOKEN_BUDGET * 4 / 1.1);
    const head = "h".repeat(maxLength - emptyHead.text.length);
    const result = reviewOnlyManifest([], [], rubric, head);
    assert.equal(result.text.length, maxLength);
    assert.equal(result.tokens, TOKEN_BUDGET);
    assert.equal(JSON.parse(result.text).identity.base, head);
    assert.equal(JSON.parse(result.text).rubric.join(""), rubric);
    assert.equal(estimateTokens(result.text + "h"), TOKEN_BUDGET + 1);
    assert.throws(() => reviewOnlyManifest([], [], rubric, head + "h"), error => {
      assert.ok(error instanceof KernelError);
      assert.equal(error.reasons[0]?.code, "narrow-increment");
      assert.equal(error.exit, 2);
      return true;
    });
  });
  it("bounds the entire assignment including its rubric [AGT-04]", async () => {
    const { work, facts } = await context();
    const result = buildManifest({ work, elements: [], changes: [], candidate: facts.candidate, basisHash: work.basis!.hash, attempt: 1, mode: "full", recheckFindings: [], rubric: "x".repeat(80_000), id: work.label, files: {}, charter: "" });
    assert.ok("code" in result && result.code === "narrow-increment");
  });
  it("refuses a third Standard full round before issuing a manifest", async () => {
    const { ports, state, work, facts } = await context();
    const issued = issueReview(ports, state, { ...work, budget: { ...work.budget, reviewRounds: 2 } }, facts, []);
    assert.equal(issued.data, undefined);
    assert.ok(issued.reasons.some(r => r.code === "budget-exhausted"));
    assert.equal(issued.work.budget.reservations.length, 0);
  });
  for (const rounds of [0, 1]) {
    it(`shares one round across three-path split coverage starting at ${rounds} rounds [REV-08, WRK-08]`, async () => {
      const { ports, state, work, h, facts } = await context();
      const paths = ["src/greet.ts", "package.json", "tsconfig.json"];
      let current = { ...work, budget: { ...work.budget, reviewRounds: rounds } };
      for (const opened of [1, 2, 3]) {
        const issued = issueReview(ports, state, current, { ...facts, reviewPaths: paths }, []);
        assert.ok(issued.data, `coverage dispatch ${opened} must be admitted`);
        const plan = await findings.run(ports, { ...state, work: { ...state.work, [current.id]: issued.work } }, FindingsInput.parse({
          h, result: reviewResult(issued.data, {
            status: opened === 1 ? "partial" : "completed",
            coverage: { inspected: paths.slice(0, opened), uncovered: [], crossCutting: "source and configuration checked", sampled: [] },
          }),
        }));
        current = plan.state!.work[current.id]!;
        assert.equal(current.budget.reviewRounds, rounds + 1, `coverage result ${opened} shares the round`);
        assert.equal(current.budget.delegations, opened);
        assert.equal(current.budget.reservations.length, 0);
        assert.equal(current.reviews.at(-1)!.status, opened === 3 ? "completed" : "partial");
        assert.deepEqual(current.reviews.at(-1)!.uncovered, paths.slice(opened));
      }
    });
  }
  it("does not complete a review by combining disjoint split coverage [REV-08]", async () => {
    const { ports, state, work, h, facts } = await context();
    const paths = ["src/greet.ts", "package.json", "tsconfig.json"];
    let current = work;
    for (const path of paths) {
      const issued = issueReview(ports, state, current, { ...facts, reviewPaths: paths }, []);
      assert.ok(issued.data);
      const plan = await findings.run(ports, { ...state, work: { ...state.work, [work.id]: issued.work } }, FindingsInput.parse({
        h, result: reviewResult(issued.data, {
          coverage: { inspected: [path], uncovered: [], crossCutting: "source and configuration checked", sampled: [] },
        }),
      }));
      current = plan.state!.work[work.id]!;
      assert.equal(current.reviews.at(-1)!.status, "partial");
      assert.deepEqual(current.reviews.at(-1)!.uncovered, paths.filter(other => other !== path));
      assert.equal(current.budget.reviewRounds, 1);
      assert.ok(!plan.resp.next?.some(next => next.action === "finish"));
    }
  });
  it("gives three Quick partial splits distinct identities and rejects an old result [REV-08, WRK-08]", async () => {
    const { ports, state, work, h, facts } = await context();
    let current = { ...work, lane: "quick" as const };
    const results = [];
    for (const opened of [1, 2, 3]) {
      const issued = issueReview(ports, state, current, facts, []);
      assert.ok(issued.data, `Quick split ${opened} must be admitted`);
      const liveState = { ...state, work: { ...state.work, [work.id]: issued.work } };
      const result = reviewResult(issued.data, { status: "partial", dispatchMode: "same-session" });
      if (opened === 3) {
        const stale = await findings.run(ports, liveState, FindingsInput.parse({ h, result: results[1] }));
        assert.equal(stale.resp.exit, 2, "the previous split must not settle the live assignment");
        assert.ok(stale.resp.reasons?.some(reason => reason.code === "review-stale"));
        assert.deepEqual(stale.state!.work[work.id]!.focusedReview, issued.work.focusedReview);
        assert.equal(stale.state!.work[work.id]!.reviews.length, 2);
      }
      results.push(result);
      const plan = await findings.run(ports, liveState, FindingsInput.parse({ h, result }));
      current = plan.state!.work[work.id]! as typeof current;
      assert.equal(current.budget.reviewRounds, 1);
      assert.equal(current.budget.delegations, 0);
      assert.equal(current.budget.reservations.length, 0);
      assert.equal(current.focusedReview, undefined);
      assert.equal(current.reviews.at(-1)!.status, "partial");
    }
    for (const field of ["reservation", "attempt", "manifest"] as const) {
      assert.equal(new Set(results.map(result => result[field])).size, 3, `${field} must identify each split`);
    }
    for (const changed of ["candidate", "basis"] as const) {
      const changedWork = changed === "basis" ? { ...current, basis: { ...current.basis!, hash: "changed-basis" } } : current;
      const changedFacts = changed === "candidate" ? { ...facts, candidate: "changed-candidate" } : facts;
      const refused = issueReview(ports, state, changedWork, changedFacts, []);
      assert.equal(refused.data, undefined, `${changed} changes require a new Quick round`);
      assert.ok(refused.reasons.some(reason => reason.code === "budget-exhausted"));
    }
  });
  it("does not exempt changed candidates, changed bases or exhausted delegations [REV-08, WRK-08]", async () => {
    const { ports, state, work, h, facts } = await context();
    const first = issueReview(ports, state, { ...work, budget: { ...work.budget, reviewRounds: 1 } }, facts, []);
    assert.ok(first.data);
    const plan = await findings.run(ports, { ...state, work: { ...state.work, [work.id]: first.work } }, FindingsInput.parse({
      h, result: reviewResult(first.data, { status: "partial" }),
    }));
    const partial = plan.state!.work[work.id]!;
    assert.equal(partial.budget.reviewRounds, 2);
    for (const changed of ["candidate", "basis"] as const) {
      const current = changed === "basis" ? { ...partial, basis: { ...partial.basis!, hash: "changed-basis" } } : partial;
      const observed = changed === "candidate" ? { ...facts, candidate: "changed-candidate" } : facts;
      const refused = issueReview(ports, state, current, observed, []);
      assert.equal(refused.data, undefined, `${changed} changes require a new round`);
      assert.ok(refused.reasons.some(reason => reason.code === "budget-exhausted"));
      assert.equal(refused.work.budget.reservations.length, 0);
    }
    const exhausted = { ...partial, budget: { ...partial.budget, delegations: 6 } };
    const refused = issueReview(ports, state, exhausted, facts, []);
    assert.equal(refused.data, undefined);
    assert.ok(refused.next.some(next => next.action === "stop" && /delegation/.test(next.why)));
    assert.equal(refused.work.budget.delegations, 6);
    assert.equal(refused.work.budget.reservations.length, 0);
  });
  it("does not treat an analyst hold as a live review or spend the final slot [AGT-03, WRK-08]", async () => {
    const p = project(); roots.push(p.root);
    const ports = p.ports();
    const work = contractFixture({
      basis: { intentRevision: 0, elementIds: [], hash: "basis", traits: [] },
    });
    const facts = await gather(ports, work);
    const analyst: Reservation = {
      id: "RV-analyst", role: "analyst", manifest: "analyst.json", manifestHash: "analyst-hash",
      candidate: facts.candidate, basisHash: work.basis!.hash, attempt: 6, mode: "full", files: {},
      analystRole: "researcher", question: "Investigate the implementation",
    };
    const budget = {
      ...work.budget, delegations: 5, reservations: [analyst], tenetTokens: 123,
    };
    const state = { ...emptyState("workspace", "tag"), work: { [work.id]: { ...work, budget } } };
    const refused = issueReview(ports, state, { ...work, budget }, facts, []);
    assert.equal(refused.data, undefined);
    assert.ok(refused.next.some(next => next.action === "stop" && /delegation capacity/.test(next.why)));
    assert.deepEqual(refused.work.budget, budget, "refusal must not settle or replace the analyst hold");
  });
  it("refuses a Quick review when the focused slot contains an analyst hold", async () => {
    const p = project(); roots.push(p.root);
    const ports = p.ports();
    const base = contractFixture({
      lane: "quick", floor: "quick",
      basis: { intentRevision: 0, elementIds: [], hash: "basis", traits: [] },
    });
    const facts = await gather(ports, base);
    const analyst: Reservation = {
      id: "RV-focused-analyst", role: "analyst", manifest: "analyst.json", manifestHash: "analyst-hash",
      candidate: facts.candidate, basisHash: base.basis!.hash, attempt: 1, mode: "full", files: {},
      analystRole: "researcher", question: "Investigate the implementation",
    };
    const work = { ...base, focusedReview: analyst };
    const state = { ...emptyState("workspace", "tag"), work: { [work.id]: work } };

    const refused = issueReview(ports, state, work, facts, []);

    assert.equal(refused.data, undefined);
    assert.ok(refused.next.some(next => next.action === "stop" && /focused slot/.test(next.why)));
    assert.deepEqual(refused.work, work, "refusal must preserve the occupied slot and all counters");
  });
  it("reuses and retries only the reviewer reservation while preserving analyst holds", async () => {
    const { ports, state, work, facts } = await context();
    const first = issueReview(ports, state, work, facts, []);
    assert.ok(first.data);
    const analyst: Reservation = {
      id: "RV-analyst", role: "analyst", manifest: "analyst.json", manifestHash: "analyst-hash",
      candidate: facts.candidate, basisHash: work.basis!.hash, attempt: 2, mode: "full", files: {},
      analystRole: "security", question: "Check for security issues",
    };
    const withAnalyst = {
      ...first.work, budget: { ...first.work.budget, reservations: [...first.work.budget.reservations, analyst] },
    };
    const reused = issueReview(ports, state, withAnalyst, facts, []);
    assert.ok(reused.data);
    assert.equal(reused.work.budget.delegations, withAnalyst.budget.delegations);
    assert.equal(reused.work.budget.reservations.filter(reservation => reservation.role === "reviewer").length, 1);
    assert.ok(reused.work.budget.reservations.some(reservation => reservation.id === analyst.id));

    const retried = issueReview(ports, state, reused.work, facts, [], true);
    assert.ok(retried.data);
    assert.equal(retried.work.budget.delegations, reused.work.budget.delegations + 1);
    assert.equal(retried.work.budget.reservations.filter(reservation => reservation.role === "reviewer").length, 1);
    assert.ok(retried.work.budget.reservations.some(reservation => reservation.id === analyst.id));
  });
  it("refuses a third retry of one reservation", async () => {
    const { ports, state, work, facts } = await context();
    const first = issueReview(ports, state, work, facts, []);
    const second = issueReview(ports, state, first.work, facts, [], true);
    const third = issueReview(ports, state, second.work, facts, [], true);
    assert.ok(third.data);
    const refused = issueReview(ports, state, third.work, facts, [], true);
    assert.equal(refused.data, undefined);
    assert.ok(refused.reasons.some(r => r.code === "budget-exhausted"));
    assert.equal(refused.work.budget.delegations, third.work.budget.delegations);
  });
});
