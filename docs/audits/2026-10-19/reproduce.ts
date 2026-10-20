// Audit observations, not the product's regression suite. Run from the repository with Node 24+:
// node docs/audits/2026-10-19/reproduce.ts
// Uses disposable repositories, no network or host UI. Assertions describe the defects observed at 5a022e3.
import assert from "node:assert/strict";
import { existsSync, mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { project, GREET_IMPL, reviewResult } from "../../../packages/kernel/test/support/fixture.ts";
import { cleanup, tmp, write } from "../../../packages/kernel/test/helpers.ts";
import { normalize } from "../../../packages/kernel/src/adapters/node-ts.ts";
import { receiptsFrom } from "../../../packages/kernel/src/core/receipts.ts";
import { Grant } from "../../../packages/kernel/src/core/schemas.ts";
import { allowed } from "../../../packages/kernel/src/core/exclusions.ts";
import { parseArgs } from "../../../packages/kernel/src/frontends/cli.ts";

const roots: string[] = [];
const results: Array<{ id: string; observed: unknown }> = [];
const constantTest = 'import { it, expect } from "vitest"; it("existing check", () => expect(1).toBe(1));\n';
const fresh = (files: Record<string, string> = {}) => {
  const p = project({ "src/existing.test.ts": constantTest, ...files }); roots.push(p.root); return p;
};
const data = (r: { data?: unknown }): any => r.data;
const requirementOnly = {
  outcome: "Return a greeting", scopePaths: ["src/greet.ts"],
  elements: [{ ref: "r", kind: "requirement", origin: "request", text: "Return Hello, Ada!" }],
};
async function open(p: ReturnType<typeof fresh>, request = "Return a greeting", lane = "quick") {
  const r = await p.call("open", { profile: "feature", request, scopePaths: ["src/greet.ts"], lane });
  assert.equal(r.exit, 0, JSON.stringify(r)); return r.handle!;
}
try {
  // Duplicate file identities overwrite a failed result. A killed process with a passing report also passes.
  const file = (status: string) => ({ name: "/fixture/a.test.ts", status, assertionResults: [{ fullName: "a", status, failureMessages: status === "failed" ? ["AssertionError"] : [] }] });
  const ctx = { stage: "candidate" as const, scope: "full" as const, id: "i", candidate: "c", runId: "r", runDir: "/fixture", argv: ["vitest"], before: "c", versions: { node: "v", tool: "5", reporter: "json", adapter: "1" }, missing: new Set<string>() };
  const facts = { exit: 0, timedOut: false, durationMs: 1, startedAt: "t", raw: "report", after: "c", ran: true };
  const obs = [{ id: "suite", kind: "test" as const, category: "affected" as const }];
  const duplicate = receiptsFrom(facts, normalize(JSON.stringify({ testResults: [file("failed"), file("passed")] }), "/fixture"), obs, ctx)[0]!;
  const killed = receiptsFrom({ ...facts, exit: undefined, signal: "SIGKILL" }, normalize(JSON.stringify({ testResults: [file("passed")] }), "/fixture"), obs, ctx)[0]!;
  assert.equal(duplicate.status, "pass"); assert.equal(killed.status, "pass");
  results.push({ id: "A01-report-integrity", observed: { duplicate: duplicate.status, killed: killed.status } });

  // The store follows a symlink, and also adopts an existing markerless directory.
  const linked = fresh(), outside = tmp("tenet-audit-out-"); roots.push(outside);
  symlinkSync(outside, join(linked.root, ".tenet"));
  const linkedOpen = await linked.call("open", { profile: "plan", request: "Plan only" });
  assert.equal(linkedOpen.exit, 0); assert.ok(existsSync(join(outside, "state")));
  const markerless = fresh(); mkdirSync(join(markerless.root, ".tenet")); write(markerless.root, ".tenet/preexisting", "untrusted\n");
  const markerlessOpen = await markerless.call("open", { profile: "plan", request: "Plan only" });
  assert.equal(markerlessOpen.exit, 0);
  results.push({ id: "A02-store-boundary", observed: { symlinkExit: linkedOpen.exit, stateWrittenOutsideWorkspace: true, markerlessExit: markerlessOpen.exit } });

  // An unrecognized authority field is silently stripped instead of refused.
  const unknownGrant = Grant.safeParse({ id: "g", actions: ["local-routine"], source: "request", capture: "reported", bind: { factsHash: "h" }, futureAuthority: true });
  assert.ok(unknownGrant.success);
  results.push({ id: "A03-unknown-authority", observed: { accepted: unknownGrant.success, unknownFieldRetained: "futureAuthority" in unknownGrant.data } });

  const malformed = fresh({ "tenet.policy.json": '{"protected_pathz":["src/**"]}\n' });
  const malformedOpen = await open(malformed);
  results.push({ id: "A04-malformed-policy", observed: { issuedHandle: !!malformedOpen } });

  // With no distinguishing obligation, an arbitrary green suite plus a self-reported review is enough.
  const noRed = fresh(); const nr = await open(noRed, "Add a greeting", "standard");
  await noRed.call("decide", { h: nr, kind: "basis", propose: requirementOnly });
  noRed.write("src/greet.ts", GREET_IMPL);
  const green = await noRed.call("check", { h: nr });
  await noRed.call("findings", { h: nr, result: reviewResult(data(green)) });
  const unproved = await noRed.call("finish", { h: nr, noCommit: true });
  assert.equal(data(unproved).endpoint, "checked-local");
  results.push({ id: "A05-no-red", observed: { endpoint: data(unproved).endpoint, baselineRuns: Object.values(noRed.ports().store.read()!.state.work)[0]!.receipts.filter(r => r.stage === "baseline").length } });

  // A boundary test declared to fail on baseline is never required to have that baseline.
  const boundary = fresh(); const bh = await open(boundary);
  await boundary.call("decide", { h: bh, kind: "basis", propose: { ...requirementOnly, elements: [
    ...requirementOnly.elements,
    { ref: "e", kind: "example", origin: "request", of: "r", text: "Ada gets the greeting", test: "boundary", expect: "fail", testFile: "src/greet.test.ts" },
  ] } });
  boundary.write("src/greet.ts", GREET_IMPL);
  boundary.write("src/greet.test.ts", 'import { it, expect } from "vitest"; import { greet } from "./greet.ts"; it("boundary", () => expect(greet("Ada")).toBe("Hello, Ada!"));\n');
  await boundary.call("check", { h: bh });
  const noBaseline = await boundary.call("finish", { h: bh, noCommit: true });
  assert.equal(data(noBaseline).endpoint, "checked-local");
  results.push({ id: "A06-boundary-baseline", observed: { endpoint: data(noBaseline).endpoint } });

  // Limits are reported but do not prevent more executions. --stage committed also runs no sealed checkout.
  const budget = fresh(); const bu = await open(budget);
  await budget.call("decide", { h: bu, kind: "basis", propose: requirementOnly });
  budget.write("src/greet.ts", GREET_IMPL);
  for (let n = 0; n < 4; n++) await budget.call("check", { h: bu, again: true });
  const budgetWork = Object.values(budget.ports().store.read()!.state.work)[0]!;
  assert.equal(budgetWork.budget.attempts, 4);
  const committed = await budget.call("check", { h: bu, stage: "committed", again: true });
  assert.ok(data(committed).receipts.some((r: any) => r.status === "pass"));
  results.push({ id: "A07-attempt-limit", observed: { attempts: budgetWork.budget.attempts, maximum: 3, committedStagePassedOnDirtyTree: true } });

  // A parked contract can run a check while a different contract owns source.
  const owner = fresh(); const ah = await open(owner, "first");
  await owner.call("decide", { h: ah, kind: "basis", propose: requirementOnly });
  await owner.call("stop", { h: ah, mode: "pause" });
  const other = await owner.call("open", { profile: "feature", request: "second" });
  assert.equal(other.exit, 0);
  const oldCheck = await owner.call("check", { h: ah });
  assert.equal(oldCheck.exit, 0);
  results.push({ id: "A08-source-ownership", observed: { oldContractCheckExit: oldCheck.exit, anotherContractOwnsSource: true } });

  // A new contract opened on a Tenet branch never gets a distinct branch.
  await owner.call("decide", { h: other.handle, kind: "basis", propose: requirementOnly });
  const works = Object.values(owner.ports().store.read()!.state.work);
  assert.equal(works[0]!.git.branch, works[1]!.git.branch);
  results.push({ id: "A09-stacked-branch", observed: { firstBranch: works[0]!.git.branch, secondBranch: works[1]!.git.branch } });

  // Branch review's advertised input is accepted but ignored: a clean feature branch yields zero files.
  const review = fresh(); review.git("switch", "-qc", "feature"); review.write("src/greet.ts", GREET_IMPL);
  review.git("add", "src/greet.ts"); review.git("commit", "-qm", "Add greeting");
  const branchReview = await review.call("review", { scope: "branch", base: "main" });
  assert.equal(data(branchReview).files, 0);
  results.push({ id: "A10-review-scope", observed: { committedBranchDiffFiles: 1, manifestFiles: data(branchReview).files } });

  // Actual auth changes do not raise a Quick lane chosen from an initially ordinary path.
  const risk = fresh(); const rh = await open(risk);
  await risk.call("decide", { h: rh, kind: "basis", propose: requirementOnly });
  risk.write("src/auth.ts", "export const canAccess = () => true;\n");
  await risk.call("check", { h: rh, touched: ["src/auth.ts"] });
  const rw = Object.values(risk.ports().store.read()!.state.work)[0]!;
  assert.equal(rw.lane, "quick"); assert.equal(rw.floor, "quick");
  results.push({ id: "A11-actual-risk", observed: { lane: rw.lane, floor: rw.floor, changedAuthFile: true } });

  // --flag=value in the approval snippet is not parsed as the same flag as --flag value.
  const args = parseArgs(["decide", "--kind=basis", "--h", "W1.1.abcd"]);
  assert.equal(args.input.kind, undefined);
  results.push({ id: "A12-cli-snippet", observed: { parsedInput: args.input } });
  assert.equal(allowed("model-send", ".npmrc"), true);
  results.push({ id: "A13-npmrc-exclusion", observed: { npmrcModelSendAllowed: true } });

  // A configured clean filter runs during stateless review without a consent question.
  const filters = fresh({ ".gitattributes": "src/greet.ts filter=audit\n" });
  filters.git("config", "filter.audit.clean", `node -e "require('fs').writeFileSync('FILTER_RAN','yes');process.stdin.pipe(process.stdout)"`);
  filters.write("src/greet.ts", GREET_IMPL);
  const filterReview = await filters.call("review");
  assert.equal(filterReview.exit, 0); assert.ok(existsSync(join(filters.root, "FILTER_RAN")));
  results.push({ id: "A14-review-filter-execution", observed: { reviewExit: filterReview.exit, configuredProgramRanAndWroteProjectFile: true } });

  // Git's assume-unchanged flag hides a real source edit from the inventory identity.
  const flagged = fresh(); const beforeFlag = await flagged.ports().git.inventory([]);
  flagged.git("update-index", "--assume-unchanged", "src/greet.ts"); flagged.write("src/greet.ts", GREET_IMPL);
  const afterFlag = await flagged.ports().git.inventory([]);
  assert.equal(beforeFlag.digest, afterFlag.digest);
  results.push({ id: "A15-flagged-input", observed: { digestUnchangedAfterSourceEdit: true } });

  // A predicted directory is used as proof of authorship for an undeclared, concurrent human file.
  const human = fresh();
  const hh = (await human.call("open", { profile: "refactor", request: "tidy greeting", scopePaths: ["src/"], lane: "quick" })).handle!;
  await human.call("decide", { h: hh, kind: "basis", propose: { outcome: "Keep greeting behavior", elements: [{ kind: "constraint", origin: "request", text: "Keep behavior" }] } });
  human.write("src/personal.ts", "// written by a person after open; never declared by the coordinator\nexport const privateWork = 1;\n");
  await human.call("check", { h: hh });
  const humanFinish = await human.call("finish", { h: hh });
  assert.equal(data(humanFinish).endpoint, "checked-local");
  assert.ok(human.git("show", "--name-only", "--format=", "HEAD").includes("src/personal.ts"));
  results.push({ id: "A16-predicted-path-authorship", observed: { endpoint: data(humanFinish).endpoint, undeclaredHumanFileCommitted: true } });

  process.stdout.write(JSON.stringify({ baseline: "5a022e3", observations: results }, null, 2) + "\n");
} finally {
  for (const root of roots) cleanup(root);
}
