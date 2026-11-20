import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { signingConsent } from "../src/decisions/consent.ts";
import type { DecisionCtx } from "../src/decisions/types.ts";
import type { State, WorkContract } from "../src/core/schemas.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { signingQuestion } from "../src/verbs/commit-questions.ts";
import { factsHash } from "../src/verbs/common.ts";
import { dirtyScopeHash } from "../src/verbs/dirty.ts";
import { PUBLISH, SETTLE, type Recovery } from "../src/verbs/recover-effects.ts";
import { cleanup } from "./helpers.ts";
import { callWithEnvelopeConsent, contractFixture, project, type Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

const fresh = (): Project => {
  const p = project();
  const ports = p.ports;
  p.ports = () => ({ ...ports(), platform: "linux" });
  p.rawCall = (verb, input = {}) => runVerb(p.ports(), VERBS, verb, input);
  p.call = (verb, input = {}) => callWithEnvelopeConsent(p.rawCall, verb, input);
  roots.push(p.root);
  return p;
};

const workWithAuthority = () => {
  const base = contractFixture();
  const dirty = {
    path: "src/human.ts",
    status: "MM",
    mode: "100644",
    blob: "human",
    indexMode: "100644",
    indexBlob: "human",
  };
  const relevantFacts = {
    path: "src/human.ts",
    status: "MM",
    exists: true,
    workMode: "100644",
    workBlob: "human-and-tenet",
    indexMode: "100644",
    indexBlob: "human",
    startRef: factsHash(dirty),
  };
  const w: WorkContract = {
    ...base,
    id: "W1",
    session: { generation: 7 },
    git: {
      ...base.git,
      start: {
        ...base.git.start,
        dirty: [dirty],
      },
    },
    dirtyFileDecisions: [],
  };
  const scopeHash = dirtyScopeHash(w);
  w.dirtyFileDecisions = [{
    workId: "W1",
    sessionGeneration: 7,
    questionInstance: "DQ-current",
    itemToken: "1",
    path: "src/human.ts",
    choice: "include",
    relevantFacts,
    scopeHash,
    recordedAt: "2026-11-18T00:00:00.000Z",
    captureClass: "elicited",
  }];
  const reference = {
    path: "src/human.ts",
    questionInstance: "DQ-current",
    itemToken: "1",
    relevantFacts,
    scopeHash,
    choice: "include",
  };
  return { w, reference };
};

describe("P47 review findings", () => {
  it("[GIT-10] finish --no-commit survives a failed finish before verdict planning", {
    skip: process.platform === "win32" && "public durable-store controls require the supported POSIX mutation host",
  }, async () => {
    const p = fresh();
    const opened = await p.call("open", {
      profile: "feature", request: "failed finish", scopePaths: ["src/greet.ts"], lane: "quick",
    });
    assert.equal(opened.exit, 0, JSON.stringify(opened));
    const failed = await p.call("finish", { h: opened.handle!, noCommit: true });
    assert.equal(failed.exit, 2, JSON.stringify(failed));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.git.noCommit, true);

    const p2 = fresh();
    const other = await p2.call("open", {
      profile: "feature", request: "branch failure", scopePaths: ["src/greet.ts"], lane: "quick",
    });
    p2.git("checkout", "-qb", "different-branch");
    const branchFailure = await p2.call("finish", { h: other.handle!, noCommit: true });
    assert.equal(branchFailure.exit, 2, JSON.stringify(branchFailure));
    assert.equal(Object.values(p2.ports().store.read()!.state.work)[0]!.git.noCommit, true);
  });

  it("[GIT-12] signing consent is bound to one work, generation and question instance", async () => {
    const { w } = workWithAuthority();
    const q = signingQuestion(w, "signer-config", "SQ-current");
    assert.equal(q.bind.workId, w.id);
    assert.equal(q.bind.sessionGeneration, w.session.generation);
    assert.equal(q.bind.instanceId, "SQ-current");
    const ports = {
      git: { probe: async () => ({ signing: "signer-config" }) },
      clock: { now: () => "2026-11-18T00:00:00.000Z" },
    };
    const ctx = (question: typeof q, work = w, instanceId = "SQ-current"): DecisionCtx => ({
      ports,
      state: { pending: [question], consents: [], work: { [work.id]: work } },
      work,
      input: {
        kind: "signing-consent",
        answers: {
          "signing-consent": { instanceId, answer: "keep-uncommitted" },
        },
      },
    } as unknown as DecisionCtx);
    const declined = await signingConsent.run(ctx(q));
    assert.equal(declined.state!.work.W1!.git.noCommit, true);

    const replaced = signingQuestion(w, "signer-config", "SQ-replacement");
    await assert.rejects(async () => signingConsent.run(ctx(replaced, w, "SQ-current")), /replaced|instance/);
    const wrongWork = signingQuestion({ ...w, id: "W2" }, "signer-config", "SQ-current");
    await assert.rejects(async () => signingConsent.run(ctx(wrongWork)), /another work|work generation/);
  });

  it("[GIT-10] interrupted commit settlement rejects missing or mismatched whole-file authority", async () => {
    const { w, reference } = workWithAuthority();
    let reconciled = 0;
    const r: Recovery = {
      ports: {
        git: {
          reconcileCommit: async () => { reconciled++; return { completed: false }; },
          refCommit: async () => "parent",
        },
      } as unknown as Recovery["ports"],
      tx: { result: () => undefined } as unknown as Recovery["tx"],
      state: { work: { W1: w } } as unknown as State,
      completed: [],
      uncertain: [],
    };
    const base = { effect: "commit", id: "commit-1", op: {
      work: "W1", parent: "parent", expectedTree: "tree", paths: ["src/human.ts"], subject: "subject",
    } };

    await SETTLE.commit!(r, base);
    assert.match(r.uncertain.join("\n"), /whole-file inclusion authority/);
    assert.equal(reconciled, 0);

    r.uncertain = [];
    await SETTLE.commit!(r, {
      ...base,
      op: { ...base.op, dirtyDecisions: [{ ...reference, questionInstance: "DQ-other" }] },
    });
    assert.match(r.uncertain.join("\n"), /whole-file inclusion authority/);
    assert.equal(reconciled, 0);

    r.uncertain = [];
    r.state = { ...r.state, work: {
      W1: { ...w, dirtyFileDecisions: [] },
    } } as unknown as State;
    await SETTLE.commit!(r, {
      ...base,
      op: { ...base.op, dirtyDecisions: [reference] },
    });
    assert.match(r.uncertain.join("\n"), /whole-file inclusion authority/);
    assert.equal(reconciled, 0);
  });

  it("[GIT-10] result replay rejects a recorded commit without matching whole-file authority", () => {
    const { w } = workWithAuthority();
    const r: Recovery = {
      ports: {} as Recovery["ports"],
      tx: {} as Recovery["tx"],
      state: { work: { W1: w } } as unknown as State,
      completed: [],
      uncertain: [],
    };
    PUBLISH.commit!(
      r,
      { work: "W1", paths: ["src/human.ts"] },
      { completed: true, commit: "a".repeat(40), foreign: [] },
    );
    assert.deepEqual(r.state.work.W1!.git.commits, []);
    assert.match(r.uncertain.join("\n"), /whole-file inclusion authority/);
  });
});
