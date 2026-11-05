// Reason codes whose producer existed but no test named them (docs/audits/2026-11-03/reason-codes.md). Each test drives
// the real producer and checks the code the spec attaches to that situation (TS Appendix C, §15.2; UX Spec §10).
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { z } from "zod";
import { GitCli } from "../src/adapters/git-cli.ts";
import { newBudget } from "../src/core/budget.ts";
import { KernelError } from "../src/core/errors.ts";
import { envelopeConsentPlan, makeExecutionEnvelope } from "../src/core/execution-envelope.ts";
import { checkAnalystResult, checkResult } from "../src/core/review.ts";
import { AnalystResult, ReviewResult, type Finding, type Reservation, type WorkContract } from "../src/core/schemas.ts";
import { emptyState } from "../src/core/state.ts";
import { runVerb } from "../src/pipeline.ts";
import type { Verb } from "../src/pipeline.ts";
import { cleanup, git, initRepo, newStore, tmp, write } from "./helpers.ts";
import { BASIS, contractFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const scratch = () => { const root = tmp("tenet-rc-"); roots.push(root); return root; };

/** An initialised repository with one commit, and its Git adapter. */
function repo() {
  const root = scratch();
  initRepo(root);
  write(root, "src/a.ts", "export const a = 1;\n");
  git(root, "add", "-A");
  git(root, "commit", "-qm", "init");
  return { root, g: new GitCli(root) };
}

describe("review: one focused recheck per contract", () => {
  const reservation: Reservation = {
    id: "R1", role: "reviewer", manifest: "reviewer.json", manifestHash: "m1",
    candidate: "candidate", basisHash: "basis", attempt: 1, mode: "recheck", files: {},
  };
  const result = ReviewResult.parse({
    kind: "review", manifest: "m1", reservation: "R1", attempt: 1, mode: "recheck",
    status: "completed", dispatchMode: "subagent-fresh", axes: { behavior: "pass", structure: "pass" },
    coverage: { inspected: [], uncovered: [], crossCutting: "checked", sampled: [] },
    attention: [], findings: [], basisGaps: [],
  });
  const workWith = (rechecks: number): WorkContract => contractFixture({
    budget: { ...newBudget(), rechecks, reservations: [reservation] },
  });

  it("refuses a second recheck result with recheck-exhausted and accepts the first [REV-05]", () => {
    const refused = checkResult(workWith(1), result, "standard");
    assert.deepEqual(refused.reasons.map((r) => r.code), ["recheck-exhausted"]);
    assert.equal(refused.reservation, undefined);
    const accepted = checkResult(workWith(0), result, "standard");
    assert.deepEqual(accepted.reasons, []);
    assert.equal(accepted.reservation?.id, "R1");
  });

  it("admits only unique fixed findings with nonblank evidence for a recheck [REV-04]", () => {
    const finding: Finding = {
      id: "FND-1", n: 1, severity: "major", axis: "behavior", state: "fixed",
      claim: "A boundary was missing", evidence: "src/example.ts:1", location: { path: "src/example.ts", line: 1 },
      history: [{ to: "fixed", by: "coordinator", reason: "src/example.ts:2 changed", at: "2026-01-01T00:00:00.000Z" }],
    };
    const base = { finding: finding.id, outcome: "verified" as const, evidence: "src/example.ts:2 checked" };
    for (const outcome of ["verified", "still-open"] as const) {
      const work = { ...workWith(0), findings: [finding] }, before = structuredClone(work);
      assert.equal(checkResult(work, { ...result, rechecked: [{ ...base, outcome }] }, "standard").reservation?.id, "R1");
      assert.deepEqual(work, before);
    }
    for (const state of ["open", "valid", "disputed", "withdrawn", "verified", "deferred", "risk-accepted", "wont-fix"] as const) {
      for (const outcome of ["verified", "still-open"] as const) {
        const work = { ...workWith(0), findings: [{ ...finding, state }] }, before = structuredClone(work);
        const checked = checkResult(work, { ...result, rechecked: [{ ...base, outcome }] }, "standard");
        assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-result-invalid"], `${state}/${outcome}`);
        assert.equal(checked.reservation, undefined);
        assert.deepEqual(work, before);
      }
    }
    for (const rechecked of [
      [{ ...base, finding: "unknown" }],
      [{ ...base, evidence: " \n\t" }],
      [base, base],
      [base, { ...base, outcome: "still-open" as const }],
    ]) {
      const work = { ...workWith(0), findings: [finding] }, before = structuredClone(work);
      const checked = checkResult(work, { ...result, rechecked }, "standard");
      assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-result-invalid"]);
      assert.equal(checked.reservation, undefined);
      assert.deepEqual(work, before);
    }
  });
});

describe("review and analyst reservation roles", () => {
  const reviewer: Reservation = {
    id: "reviewer-1", role: "reviewer", manifest: "reviewer.json", manifestHash: "reviewer-hash",
    candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
  };
  const analyst: Reservation = {
    id: "analyst-1", role: "analyst", manifest: "analyst.json", manifestHash: "analyst-hash",
    candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", files: {},
    analystRole: "researcher", question: "Inspect the code",
  };
  const reviewResultFor = (reservation: Reservation) => ReviewResult.parse({
    kind: "review", manifest: reservation.manifestHash, reservation: reservation.id, attempt: reservation.attempt, mode: reservation.mode,
    status: "completed", dispatchMode: "subagent-fresh", axes: { behavior: "pass", structure: "pass" },
    coverage: { inspected: [], uncovered: [], crossCutting: "checked", sampled: [] },
    attention: [], findings: [], basisGaps: [],
  });
  const analystResultFor = (reservation: Reservation) => AnalystResult.parse({
    kind: "analyst", manifest: reservation.manifestHash, reservation: reservation.id, attempt: reservation.attempt,
    role: "researcher", status: "completed", dispatchMode: "subagent-fresh", revision: reservation.candidate,
    artifacts: [], findings: [],
  });
  const workWithReservations = (reservations: Reservation[], focusedReview?: Reservation): WorkContract =>
    contractFixture({
      budget: { ...newBudget(), reservations },
      ...(focusedReview ? { focusedReview } : {}),
    });

  it("refuses recheck claims in a full review without settling its reservation [REV-04]", () => {
    const work = workWithReservations([reviewer]);
    const before = structuredClone(work);
    for (const outcome of ["verified", "still-open"] as const) {
      const result = ReviewResult.parse({
        ...reviewResultFor(reviewer),
        rechecked: [{ finding: "FND-1", outcome, evidence: "src/example.ts:1" }],
      });
      const checked = checkResult(work, result, "standard");
      assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-result-invalid"]);
      assert.equal(checked.reservation, undefined);
      assert.deepEqual(work, before);
    }
    for (const rechecked of [undefined, []]) {
      const result = ReviewResult.parse({ ...reviewResultFor(reviewer), rechecked });
      assert.deepEqual(checkResult(work, result, "standard").reasons, []);
    }
  });

  it("refuses duplicate or unexplained attention dispositions before review application [REV-03]", () => {
    const work = {
      ...workWithReservations([reviewer]),
      attention: [{ id: "AT-1", path: "src/example.ts", line: 1, pattern: "skip", marker: true }],
    };
    const before = structuredClone(work);
    const accepted = { id: "AT-1", disposition: "accepted" as const, reason: "src/example.ts:1 is an intentional skip" };
    for (const attention of [
      [{ ...accepted, id: "unknown" }],
      [accepted, accepted],
      [accepted, { ...accepted, disposition: "finding" as const }],
      [{ ...accepted, disposition: "finding" as const }, accepted],
      [{ ...accepted, reason: " \n\t" }],
      [{ ...accepted, disposition: "finding" as const, reason: "" }],
    ]) {
      const checked = checkResult(work, ReviewResult.parse({ ...reviewResultFor(reviewer), attention }), "standard");
      assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-result-invalid"]);
      assert.equal(checked.reservation, undefined);
      assert.deepEqual(work, before);
    }
    for (const attention of [[], [accepted], [{ ...accepted, disposition: "finding" as const }]]) {
      const checked = checkResult(work, ReviewResult.parse({ ...reviewResultFor(reviewer), attention }), "standard");
      assert.equal(checked.reservation?.id, reviewer.id);
      assert.deepEqual(checked.reasons, []);
      assert.deepEqual(work, before);
    }
  });

  it("does not accept an analyst reservation for a reviewer-shaped result", () => {
    const work = workWithReservations([analyst]);
    const checked = checkResult(work, reviewResultFor(analyst), "standard");
    assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-stale"]);
    assert.equal(checked.reservation, undefined);
  });

  it("does not accept an analyst focused slot for a reviewer-shaped result", () => {
    const work = workWithReservations([], analyst);
    const checked = checkResult(work, reviewResultFor(analyst), "standard");
    assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-stale"]);
    assert.equal(checked.reservation, undefined);
  });

  it("does not accept a reviewer reservation for an analyst-shaped result", () => {
    const work = workWithReservations([reviewer]);
    const checked = checkAnalystResult(work, analystResultFor(reviewer));
    assert.deepEqual(checked.reasons.map(reason => reason.code), ["review-stale"]);
    assert.equal(checked.reservation, undefined);
  });
});

describe("execution envelope: unknown exposure", () => {
  const envelope = makeExecutionEnvelope("ws", [{
    kind: "tests", argv: ["node", "vitest"], cwd: "<workspace>", environment: { passed: ["PATH"], dropped: ["NPM_TOKEN"] }, outputs: [],
  }]);
  const work = { id: "w1" } as unknown as WorkContract;

  it("asks one question before any spawn and names envelope-unknown with the envelope hash [SEC-15]", () => {
    const plan = envelopeConsentPlan(emptyState("ws", "tag"), work, envelope);
    assert.ok(plan);
    assert.equal(plan.resp.exit, 3);
    assert.deepEqual(plan.resp.reasons.map((r) => [r.code, r.refs]), [["envelope-unknown", [envelope.hash]]]);
    assert.deepEqual(plan.resp.questions.map((q) => q.id), ["envelope-consent"]);
    assert.deepEqual(plan.state.pending.map((q) => q.id), ["envelope-consent"]);
  });
  it("asks nothing once this exact envelope is consented, and nothing when no command is planned [SEC-15]", () => {
    const consented = { ...emptyState("ws", "tag"), consents: [{ kind: "envelope" as const, configHash: envelope.hash, at: "t" }] };
    assert.equal(envelopeConsentPlan(consented, work, envelope), undefined);
    assert.equal(envelopeConsentPlan(emptyState("ws", "tag"), work, { ...envelope, commands: [] }), undefined);
  });
});

describe("store: run directory", () => {
  const code = (e: unknown) => e instanceof KernelError && e.reasons[0]?.code === "run-dir-unavailable";

  it("refuses a run directory name that could leave the temporary area", () => {
    const store = newStore(scratch());
    for (const name of ["../escape", "/abs", "a//b", ""]) assert.throws(() => store.tempDir(name), code, name);
    assert.throws(() => store.writeArtifact(store.tempDir("run-x"), "a/b", "x"), code);
  });
  it("reports run-dir-unavailable when the temporary area cannot be written", () => {
    const store = newStore(scratch()), blocker = join(scratch(), "not-a-directory");
    writeFileSync(blocker, "a file where a directory is needed");
    const saved = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
    try {
      process.env.TMPDIR = process.env.TMP = process.env.TEMP = join(blocker, "tmp");
      assert.throws(() => store.tempDir("run-blocked"), code);
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    }
  });
  it("returns a nonzero pipeline refusal when a required run directory cannot be created [NFR-03]", async () => {
    const p = project();
    roots.push(p.root);
    const probe: Verb = {
      name: "run-dir-probe",
      schema: z.strictObject({}),
      class: () => "stateless",
      run(ports) {
        ports.store.tempDir("a//b");
        return { resp: {} };
      },
    };
    const response = await runVerb(p.ports(), { [probe.name]: probe }, probe.name, {});
    assert.equal(response.exit, 2, JSON.stringify(response));
    assert.ok(response.reasons.some((r) => r.code === "run-dir-unavailable"));
    assert.deepEqual(response.next, []);
  });
});

describe("git adapter: failures that name a reason", () => {
  it("refuses an inventory of more than 20,000 untracked files with inventory-too-large (TS §9.4)", { timeout: 300_000 }, async () => {
    const { root, g } = repo();
    mkdirSync(join(root, "data"));
    for (let i = 0; i <= 20_000; i++) writeFileSync(join(root, "data", `f${i}.txt`), "");
    await assert.rejects(g.inventory([]), (e: unknown) => {
      assert.ok(e instanceof KernelError);
      assert.equal(e.reasons[0]?.code, "inventory-too-large");
      assert.equal(e.exit, 2);
      assert.match(e.message, /\.gitignore/);
      return true;
    });
  });
  it("leaves the candidate uncommitted with git-identity-missing when Git has no name and email [GIT-15]", async () => {
    const { root, g } = repo();
    git(root, "config", "--unset", "user.name");
    git(root, "config", "--unset", "user.email");
    git(root, "config", "user.useConfigOnly", "true");
    write(root, "src/a.ts", "export const a = 2;\n");
    const before = await g.inventory([]);
    assert.equal((await g.probe()).identity, false);
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "no identity", parent: before.head, timeoutMs: 60_000 });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "git-identity-missing");
    assert.equal(git(root, "rev-parse", "HEAD"), before.head);
  });
  it("reports git-locked when Git cannot take the index lock during the commit [GIT-15]", async () => {
    const { root, g } = repo();
    write(root, "src/a.ts", "export const a = 2;\n");
    // The hook holds the lock Git would need, so the hook's own Git call fails with Git's real "index.lock" message.
    write(root, ".git/hooks/pre-commit", '#!/bin/sh\n: > "$GIT_INDEX_FILE.lock"\ngit add -- src/a.ts\n');
    chmodSync(join(root, ".git/hooks/pre-commit"), 0o755);
    const before = await g.inventory([]);
    const out = await g.commit({ paths: ["src/a.ts"], deleted: [], message: "locked", parent: before.head, timeoutMs: 60_000 });
    assert.equal(out.ok, false);
    assert.equal(out.reason, "git-locked", JSON.stringify(out));
    assert.equal(git(root, "rev-parse", "HEAD"), before.head);
  });
});

// These drive the kernel's mutating verbs, which refuse to run on Windows (TS §4.9): CI on Linux and macOS runs them.
describe("pipeline: stops and questions that name a reason", () => {
  it("a host usage limit parks the contract with stop reason host-limit and leaves every counter as it was [NFR-04]", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "host limit", lane: "quick" })).handle!;
    const work = () => Object.values(p.ports().store.read()!.state.work)[0]!;
    const counters = () => { const b = work().budget; return [b.attempts, b.reviewRounds, b.rechecks, b.delegations, b.checksLaunched, b.tenetTokens]; };
    const before = counters();
    const stopped = await p.call("stop", { h, mode: "pause", reason: "host-limit" });
    assert.equal(stopped.exit, 0, JSON.stringify(stopped));
    assert.equal(work().stopReason, "host-limit");
    assert.equal(work().state, "parked");
    assert.deepEqual(counters(), before);
  });
  it("asks before Tenet edits a file the person already changed and names attribution-mixed-file [GIT-10]", async () => {
    const p = project({ "docs/notes.md": "# notes\n" }); roots.push(p.root);
    p.write("docs/notes.md", "# notes\nwritten by the person before the work began\n");
    const h = (await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const asked = await p.call("check", { h, stage: "baseline", touched: ["docs/notes.md"] });
    assert.equal(asked.exit, 3, JSON.stringify(asked));
    assert.equal(asked.questions?.[0]?.id, "dirty-overlap");
    assert.ok(asked.reasons.some((r) => r.code === "attribution-mixed-file" && r.message.includes("docs/notes.md")), JSON.stringify(asked.reasons));
  });
});
