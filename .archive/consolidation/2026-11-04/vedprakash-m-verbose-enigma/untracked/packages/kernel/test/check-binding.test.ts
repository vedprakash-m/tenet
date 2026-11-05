import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { join } from "node:path";
import { deriveObligations } from "../src/core/obligations.ts";
import { formatHandle } from "../src/core/ids.ts";
import type { RunFacts } from "../src/core/receipts.ts";
import { check } from "../src/verbs/check.ts";
import { checkInputId, gather } from "../src/verbs/facts.ts";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import { state1 } from "./support/schema1-fixtures.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("candidate binding on the existing schema-1-typed check handler boundary", () => {
  for (const change of ["hash", "serial", "A-B-A", "missing", "malformed", "unchanged", "schema-1",
    "baseline", "old-baseline", "stale-baseline", "integrated"] as const) {
  it(`finalizes ${change} configuration eligibility without refunding the launch`, async () => {
    const p = project({ "src/greet.test.ts": "export {};\n" });
    roots.push(p.root);
    const ports = p.ports();
    ports.store.self = () => ({ pid: process.pid, procStart: "test-process-start" });
    const initial = state1();
    const id = Object.keys(initial.work)[0]!;
    const original = initial.work[id]!;
    const work = {
      ...original,
      obligations: [{
        id: "OB-acceptance", kind: "test" as const, category: "acceptance" as const,
        testFile: "src/greet.test.ts", expectation: "pass" as const,
        baselineMatched: true, baselineInputs: {}, baselineTestHash: p.git("hash-object", "src/greet.test.ts"),
        baselineConfigEvidence: { hash: "a".repeat(64), serial: change === "old-baseline" ? 0 : 1 },
      }, ...deriveObligations([], "vitest", [])],
      configEvidence: { hash: "a".repeat(64), serial: 1 },
    };
    const state = { ...initial };
    state.work[id] = work;
    if (change === "schema-1") Reflect.deleteProperty(work, "configEvidence");
    if (change === "baseline") for (const ob of work.obligations) Reflect.deleteProperty(ob, "baselineConfigEvidence");
    const handle = formatHandle(Number(work.label.slice(2)), work.session.generation, state.tag);
    const stage = change === "baseline" || change === "stale-baseline" ? "baseline"
      : change === "integrated" ? "integrated" : "candidate";
    if (change === "integrated")
      work.git.integrated = { into: "main", commit: "a".repeat(40), moved: true, validated: false };
    const input = check.schema.parse({ h: handle, stage });
    let plan = await check.run(ports, state, input);
    if (!plan.job) {
      const question = plan.resp.questions?.find((q) => q.id === "envelope-consent");
      assert.ok(question, JSON.stringify(plan.resp));
      const withConsent = plan.state!;
      const ready = {
        ...withConsent,
        pending: withConsent.pending.filter((q) => q.id !== question.id),
        consents: [...withConsent.consents, { kind: "envelope" as const, configHash: question.bind.factsHash, at: "now" }],
      };
      Object.assign(ready.work[id]!, { pendingEnvelope: undefined });
      plan = await check.run(ports, ready, input);
    }
    assert.ok(plan.job, JSON.stringify(plan.resp));
    const prepared = plan.state!;
    const preparedWork = prepared.work[id]!;
    const observed = await gather(ports, preparedWork);
    const inCall = preparedWork.session.inCall;
    assert.ok(inCall);
    if (change !== "schema-1") {
      assert.deepEqual(Reflect.get(inCall, "issuedConfigEvidence"), work.configEvidence);
      assert.equal(Reflect.get(inCall, "checkInputId"), checkInputId(ports, work, observed.candidate));
    } else {
      assert.equal(Reflect.get(inCall, "issuedConfigEvidence"), undefined);
      assert.equal(Reflect.get(inCall, "checkInputId"), undefined);
    }
    const runDir = preparedWork.session.inCall?.runDir;
    assert.ok(runDir);
    roots.push(runDir);
    const issued = work.configEvidence ?? { hash: "a".repeat(64), serial: 1 };
    const currentStamp = {
      hash: change === "hash" ? "b".repeat(64) : issued.hash,
      serial: change === "hash" ? issued.serial : issued.serial + (change === "A-B-A" ? 2 : 1),
    };
    const current = { ...prepared, work: { ...prepared.work } };
    const moved = { ...preparedWork };
    if (change === "schema-1") Reflect.deleteProperty(moved, "configEvidence");
    else if (["unchanged", "baseline", "old-baseline"].includes(change)) Object.assign(moved, { configEvidence: issued });
    else if (change === "missing") Reflect.deleteProperty(moved, "configEvidence");
    else Object.assign(moved, { configEvidence: change === "malformed" ? { hash: "invalid" } : currentStamp });
    current.work[id] = moved;
    const facts: RunFacts = {
      exit: 0, timedOut: false, durationMs: 1, startedAt: "now",
      raw: JSON.stringify({ testResults: [{
        name: join(p.root, "src", "greet.test.ts"), status: "passed",
        assertionResults: [{ fullName: "passes", status: "passed", failureMessages: [] }],
      }] }),
      after: observed.candidate, ran: true,
    };
    const finalized = await plan.job.finalize({} as never, current, {
      ...facts, statics: {},
    });
    const result = finalized.state;
    const resultWork = result.work[id]!;
    const receipt = resultWork.receipts.at(-1)!;

    assert.equal(receipt.status, "pass");
    assert.equal(receipt.checkInputId, checkInputId(ports, work, observed.candidate));
    if (change === "baseline") {
      assert.deepEqual(Reflect.get(resultWork.obligations[0]!, "baselineConfigEvidence"), issued);
      assert.equal(resultWork.budget.attempts, preparedWork.budget.attempts);
      return;
    }
    if (change === "unchanged" || change === "schema-1" || change === "old-baseline") {
      if (change === "old-baseline") assert.deepEqual(result.locks, prepared.locks);
      assert.equal(resultWork.budget.attempts, preparedWork.budget.attempts + 1);
      const launched = stage === "baseline" ? 1 : preparedWork.obligations.length;
      assert.equal(resultWork.budget.checksLaunched, preparedWork.budget.checksLaunched + launched);
      assert.equal(resultWork.lastCheck?.candidate, observed.candidate);
      assert.ok(!finalized.resp.reasons?.some((reason) =>
        reason.message.includes("configuration binding changed before check finalization")));
      return;
    }
    assert.notEqual(receipt.checkInputId, checkInputId(ports, { ...work, configEvidence: currentStamp }, observed.candidate));
    const launched = stage === "baseline" ? 1 : preparedWork.obligations.length;
    assert.equal(resultWork.budget.checksLaunched, preparedWork.budget.checksLaunched + launched);
    assert.equal(resultWork.budget.attempts, preparedWork.budget.attempts);
    assert.equal(resultWork.lastCheck, preparedWork.lastCheck);
    assert.deepEqual(resultWork.obligations, preparedWork.obligations);
    assert.deepEqual(resultWork.attention, preparedWork.attention);
    assert.deepEqual(resultWork.reviews, preparedWork.reviews);
    assert.deepEqual(resultWork.focusedReview, preparedWork.focusedReview);
    assert.deepEqual(resultWork.git, preparedWork.git);
    assert.deepEqual(result.locks, prepared.locks);
    assert.equal(resultWork.session.inCall, undefined);
    assert.equal(finalized.resp.exit, 2);
    assert.equal(finalized.resp.next?.[0]?.action, "check");
    assert.ok(finalized.resp.reasons?.some((reason) => reason.code === "evidence-inconclusive"));
  });
  }
});
