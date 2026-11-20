import { mock, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import type { Normalized } from "../src/ports/types.ts";
import type { Obligation } from "../src/core/schemas.ts";
import { sha256, stableStringify } from "../src/core/ids.ts";
import {
  answerFailureDiagnosis, failureDiagnosisQuestion, failureIdentity, FailureEvent, legacyFailureEvents, PrivacyIdentity,
} from "../src/core/privacy-identity.ts";
import { mergePrivacyBudgets, newBudget, normalizePrivacyBudget, recordPrivacyAttempt, repeatedFailure, stopFor } from "../src/core/budget.ts";
import { BudgetStateV3 } from "../src/core/privacy-identity.ts";
import { KernelError } from "../src/core/errors.ts";
import { ZodError } from "zod";

const obligation: Obligation = {
  id: "OB-EX-001-a.1", kind: "test", category: "acceptance", example: "EX-001-a.1", testFile: "test.ts",
};
function report(title = "[EX-001-a.1] synthetic assertion", message = "synthetic message"): Normalized {
  return {
    discovered: 1,
    files: new Map([["test.ts", {
      executed: 1, passed: 0, failed: 1, skipped: 0, focused: 0, tests: [title],
      outcomes: [{ test: title, status: "failed", kind: "assertion", kinds: ["assertion"] }],
      failureKinds: ["assertion"], failures: [{ test: title, kind: "assertion", message }],
    }]]),
  };
}

test("[WRK-09] [SEC-11] privacy identity admits one generated failure slot without hashing its title or message", () => {
  const expected = {
    status: "known", domain: "failure-slot-v1", version: 1, claim: "exact-admitted-value",
    value: `sha256:${sha256(stableStringify({
      domain: "failure-slot-v1", version: 1, obligation: obligation.id, slot: obligation.example, failureKind: "assertion",
    }))}`,
  };
  assert.deepEqual(failureIdentity([obligation], report()), expected);
  assert.deepEqual(failureIdentity([obligation], report("[EX-001-a.1] different synthetic title", "other synthetic message")), expected);
  assert.equal(PrivacyIdentity.safeParse(expected).success, true);
});

test("[SEC-11] privacy identity refuses ambiguous, untagged and unsupported failures before any hashing", () => {
  const hash = mock.method(crypto, "createHash", () => assert.fail("unknown input reached the digest helper"));
  syncBuiltinESMExports();
  try {
    const cases: Array<[Obligation[], Normalized]> = [
      [[], report()], [[obligation, obligation], report()], [[{ ...obligation, id: "synthetic arbitrary text" }], report()],
      [[{ ...obligation, example: undefined }], report()], [[{ ...obligation, coverageTag: "COV-extra" }], report()],
      [[obligation], report("synthetic untagged title")], [[obligation], report("[EX-other] synthetic title")],
      [[obligation], report("[EX-001-a.1] [EX-other] synthetic title")],
    ];
    for (const change of [
      { failed: 2 }, { outcomes: undefined }, { failureKinds: ["unregistered-kind"] },
      { failureKinds: ["assertion", "timeout"] }, { outcomes: [{ test: "[EX-001-a.1]", status: "failed" as const, kind: "timeout" }] },
    ]) {
      const current = report();
      Object.assign(current.files.get("test.ts")!, change);
      cases.push([[obligation], current]);
    }
    for (const [obligations, current] of cases)
      assert.deepEqual(failureIdentity(obligations, current), { status: "unknown", producer: "failure", cause: "outside-closed-domain" });
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[SEC-11] privacy failure admission refuses contradictory test and per-file failure evidence without hashing", () => {
  const cases: Normalized[] = [];
  const mismatched = report();
  mismatched.files.get("test.ts")!.failures[0]!.test = "another synthetic failure";
  cases.push(mismatched);
  const hidden = report();
  hidden.files.set("other.ts", { ...report().files.get("test.ts")!, failed: 0 });
  cases.push(hidden);
  const missingOutcome = report();
  missingOutcome.files.get("test.ts")!.outcomes = [];
  cases.push(missingOutcome);
  const hash = mock.method(crypto, "createHash", () => assert.fail("contradictory failure evidence reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const current of cases) assert.deepEqual(failureIdentity([obligation], current), {
      status: "unknown", producer: "failure", cause: "outside-closed-domain",
    });
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

const known = (attempt: number, letter = "a"): FailureEvent => ({
  kind: "known", domain: "failure-slot-v1", value: `sha256:${letter.repeat(64)}`, slot: "EX-001-a.1", attempt,
});
const unknown: FailureEvent = { kind: "unknown", attempt: 2, cause: "outside-closed-domain" };

test("[WRK-09] privacy failure repetition compares known values and never crosses unknown barriers", () => {
  assert.equal(repeatedFailure([known(1), known(2)]), true);
  assert.equal(repeatedFailure([known(1), known(2, "b"), known(3), known(4, "b")]), true);
  assert.equal(repeatedFailure([known(1), unknown, known(3)]), false);
  assert.equal(repeatedFailure([unknown, unknown]), false);
  assert.equal(repeatedFailure([known(1), known(2, "b"), unknown, known(4), known(5, "b")]), false);
});

test("[WRK-09] privacy unknown stops require diagnosis, preserve barriers and yield to exhausted attempts", () => {
  const { signatures: _legacy, ...counters } = newBudget();
  const budget = BudgetStateV3.parse({ ...counters, attempts: 2, failureEvents: [known(1), unknown] });
  assert.equal(stopFor(budget, "standard"), "failure-identity-unknown");
  assert.equal(stopFor({
    ...budget, attempts: 3, failureEvents: [known(1), { ...unknown, attempt: 3 }],
  }, "standard"), "budget-exhausted");
  const failureDiagnosis = {
    domain: "failure-diagnosis-v1" as const, version: 1 as const,
    throughAttempt: 2, unknownEventIndex: 1, at: "2026-11-19T00:00:00.000Z",
  };
  assert.equal(stopFor({ ...budget, failureDiagnosis }, "standard"), undefined);
  assert.equal(stopFor({ ...budget, attempts: 3, failureDiagnosis }, "deep"), undefined);
  assert.equal(stopFor({ ...budget, attempts: 3, failureDiagnosis }, "standard"), undefined,
    "a successful final attempt must not turn a diagnosed historical failure into budget exhaustion");
  assert.equal(stopFor({ ...budget, attempts: 3, failureEvents: [known(1), known(2)] }, "standard"), undefined,
    "a successful later attempt must not rebuild a repeated-failure stop from older failures");
  assert.equal(stopFor({ ...budget, failureDiagnosis: { ...failureDiagnosis, throughAttempt: 1 } }, "standard"), "failure-identity-unknown");
  assert.equal(stopFor({ ...budget, failureDiagnosis: { ...failureDiagnosis, unknownEventIndex: 0 } }, "standard"), "failure-identity-unknown");
  assert.equal(stopFor({ ...budget, attempts: 3, failureEvents: [known(1), unknown, known(3)] }, "deep"), undefined);
  assert.equal(stopFor({ ...budget, failureEvents: [known(1), known(2)] }, "standard"), "repeated-failure");
  assert.equal(stopFor({ ...budget, attempts: 3, failureEvents: [] }, "standard"), undefined);
});

test("[CON-03] privacy failure budgets reject contradictory event order, attempts and undeclared fields", () => {
  const { signatures: _legacy, ...counters } = newBudget();
  for (const extra of [
    { attempts: 2, failureEvents: [known(2), known(1)] },
    { attempts: 2, failureEvents: [known(1), known(1)] },
    { attempts: 1, failureEvents: [known(2)] },
    { attempts: 2, failureEvents: [known(1)], signatures: ["synthetic legacy text"] },
    ...[
      { throughAttempt: 1, unknownEventIndex: 1 }, { throughAttempt: 2, unknownEventIndex: 0 },
    ].map(fields => ({
      attempts: 2, failureEvents: [known(1), unknown], failureDiagnosis: {
        domain: "failure-diagnosis-v1", version: 1, ...fields, at: "2026-11-19T00:00:00.000Z",
      },
    })),
  ]) assert.equal(BudgetStateV3.safeParse({ ...counters, ...extra }).success, false);
  assert.equal(FailureEvent.safeParse({ kind: "unknown", attempt: null, cause: "outside-closed-domain" }).success, false);
  assert.equal(PrivacyIdentity.safeParse({
    status: "known", domain: "failure-slot-v1", version: 1, value: `sha256:${"a".repeat(64)}`,
    claim: "listed-execution-input-absent",
  }).success, false);
});

test("[SEC-11] [CON-03] privacy legacy plain and opaque signatures become ordered unknown barriers without hashing", () => {
  const hash = mock.method(crypto, "createHash", () => assert.fail("legacy signature reached the digest helper"));
  syncBuiltinESMExports();
  try {
    const signatures = ["synthetic legacy text", `sig:${"a".repeat(64)}`];
    assert.deepEqual(legacyFailureEvents(signatures, 4), {
      events: [
        { kind: "unknown", attempt: 3, cause: "legacy-no-provenance" },
        { kind: "unknown", attempt: 4, cause: "legacy-no-provenance" },
      ], mapping: "verified",
    });

    assert.deepEqual(legacyFailureEvents(signatures, 1), {
      events: signatures.map(() => ({ kind: "unknown", attempt: null, cause: "legacy-no-provenance" })), mapping: "unavailable",
    });
    assert.equal(hash.mock.callCount(), 0);
    assert.deepEqual(signatures, ["synthetic legacy text", `sig:${"a".repeat(64)}`]);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[SEC-11] [CON-03] the shared budget normalizer admits only its declared source version without hashing legacy values", () => {
  const source = { ...newBudget(), attempts: 4, checksLaunched: 7, signatures: ["synthetic legacy text", `sig:${"c".repeat(64)}`] };
  const original = structuredClone(source);
  const unsupported = (error: unknown) => error instanceof KernelError && error.reasons[0]?.code === "unsupported-record";
  const hash = mock.method(crypto, "createHash", () => assert.fail("budget normalization reached hashing"));
  syncBuiltinESMExports();
  try {
    const result = normalizePrivacyBudget(source, 2);
    assert.equal(result.mapping, "verified");
    assert.equal(result.budget.attempts, 4);
    assert.equal(result.budget.checksLaunched, 7);
    assert.deepEqual(result.budget.failureEvents, legacyFailureEvents(source.signatures, source.attempts).events);
    assert.equal(Object.hasOwn(result.budget, "signatures"), false);
    assert.deepEqual(normalizePrivacyBudget(result.budget, 3), result);
    assert.throws(() => normalizePrivacyBudget(source, 3), unsupported);
    assert.throws(() => normalizePrivacyBudget(result.budget, 2), unsupported);
    assert.throws(() => normalizePrivacyBudget({ ...source, extra: true }, 2), unsupported);
    assert.throws(() => normalizePrivacyBudget({ ...source, attempts: -1 }, 2), unsupported);
    assert.equal(normalizePrivacyBudget({ ...source, attempts: 1 }, 2).mapping, "unavailable");
    assert.equal(hash.mock.callCount(), 0);
    assert.deepEqual(source, original);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[WRK-09] privacy candidate accounting records one first-failure event and leaves successful attempts event-free", () => {
  const start = normalizePrivacyBudget(newBudget(), 2).budget;
  const identity = failureIdentity([obligation], report());
  const first = recordPrivacyAttempt(start, { identity, slot: obligation.example });
  assert.equal(first.attempts, 1);
  assert.deepEqual(first.failureEvents, [{
    kind: "known", domain: "failure-slot-v1", value: identity.status === "known" ? identity.value : "",
    slot: obligation.example, attempt: 1,
  }]);
  const second = recordPrivacyAttempt(first, { identity: { status: "unknown", producer: "failure", cause: "malformed" } });
  assert.equal(second.attempts, 2);
  assert.deepEqual(second.failureEvents[1], { kind: "unknown", attempt: 2, cause: "outside-closed-domain" });
  assert.equal(stopFor(second, "standard"), "failure-identity-unknown");
  const third = recordPrivacyAttempt(first);
  assert.equal(third.attempts, 2);
  assert.deepEqual(third.failureEvents, first.failureEvents);
  assert.equal(third.checksLaunched, 0);
  assert.equal(start.attempts, 0);
  assert.deepEqual(start.failureEvents, []);
  const full = { ...start, attempts: 8, failureEvents: Array.from({ length: 8 }, (_, i) => known(i + 1)) };
  const advanced = recordPrivacyAttempt(full, { identity, slot: obligation.example });
  assert.deepEqual(advanced.failureEvents.map(event => event.attempt), [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(advanced.attempts, 9);
});

test("[SEC-11] privacy accounting cannot promote another identity domain or an unadmitted slot into a known event", () => {
  const start = normalizePrivacyBudget(newBudget(), 2).budget;
  const identity = failureIdentity([obligation], report());
  for (const failure of [
    { identity, slot: "synthetic arbitrary slot" },
    { identity: { ...identity, domain: "world-v1" }, slot: obligation.example },
    { identity: { ...identity, extra: "synthetic raw text" }, slot: obligation.example },
    { identity: undefined, slot: obligation.example },
  ]) {
    const result = recordPrivacyAttempt(start, failure);
    assert.deepEqual(result.failureEvents, [{ kind: "unknown", attempt: 1, cause: "outside-closed-domain" }]);
  }
});

test("[CON-03] privacy accounting recovery selects the greatest attempt and never synthesizes a failure from its counter", () => {
  const start = normalizePrivacyBudget(newBudget(), 2).budget;
  const current = { ...start, attempts: 1, failureEvents: [known(1)] };
  const observed = { ...start, attempts: 2, checksLaunched: 4, failureEvents: [] };
  const result = mergePrivacyBudgets(current, observed, 3);
  assert.equal(result.verified, true);
  assert.equal(result.budget.attempts, 2);
  assert.equal(result.budget.checksLaunched, 4);
  assert.deepEqual(result.budget.failureEvents, []);
  const earlier = mergePrivacyBudgets(observed, current, 3);
  assert.equal(earlier.verified, false);
  assert.equal(earlier.budget.attempts, 2);
  assert.equal(earlier.budget.checksLaunched, 4);
  assert.deepEqual(earlier.budget.failureEvents, []);
  assert.deepEqual(current.failureEvents, [known(1)]);
});

test("[CON-03] privacy accounting recovery never decreases a monotone counter and exposes contradictory equal-attempt histories", () => {
  const base = { ...normalizePrivacyBudget(newBudget(), 2).budget, attempts: 2, failureEvents: [known(1), known(2)] };
  const high = { ...base, reviewRounds: 2, rechecks: 1, delegations: 4, checksLaunched: 7, tenetTokens: 30, activeMinutesTotal: 5 };
  const recovered = mergePrivacyBudgets(high, base, 3);
  assert.equal(recovered.verified, false);
  assert.deepEqual(recovered.budget, high);
  const conflict = mergePrivacyBudgets(base, { ...base, failureEvents: [known(1), known(2, "b")] }, 3);
  assert.equal(conflict.verified, false);
  assert.deepEqual(conflict.budget.failureEvents, base.failureEvents);
});

test("[WRK-09] [CON-03] equal-attempt checkpoint recovery cannot erase an accepted diagnosis", () => {
  const pending = { ...normalizePrivacyBudget(newBudget(), 2).budget, attempts: 2, failureEvents: [known(1), unknown] };
  const workId = `wk_${"a".repeat(10)}`, generation = 1;
  const question = failureDiagnosisQuestion(workId, generation, pending)!;
  const diagnosed = answerFailureDiagnosis(
    workId, generation, pending, question.bind.factsHash, "resume", "2026-11-19T00:00:00.000Z",
  ).budget;
  for (const [current, observed] of [[diagnosed, pending], [pending, diagnosed]] as const) {
    const result = mergePrivacyBudgets(current, observed, 3);
    assert.equal(result.verified, true);
    assert.deepEqual(result.budget.failureDiagnosis, diagnosed.failureDiagnosis);
    assert.deepEqual(result.budget.failureEvents, pending.failureEvents);
    assert.equal(result.budget.attempts, 2);
    assert.equal(stopFor(result.budget, "deep"), undefined);
  }
  const later = recordPrivacyAttempt(diagnosed, {
    identity: { status: "unknown", producer: "failure", cause: "outside-closed-domain" },
  });
  const advanced = mergePrivacyBudgets(diagnosed, later, 3);
  assert.equal(advanced.budget.failureDiagnosis, undefined);
  assert.equal(stopFor(advanced.budget, "deep"), "failure-identity-unknown");
});

test("[SEC-11] [CON-03] privacy accounting recovery normalizes legacy barriers before comparison without hashing", () => {
  const current = normalizePrivacyBudget(newBudget(), 2).budget;
  const observed = { ...newBudget(), attempts: 2, signatures: [`sig:${"a".repeat(64)}`, `sig:${"a".repeat(64)}`] };
  const hash = mock.method(crypto, "createHash", () => assert.fail("legacy accounting recovery reached hashing"));
  syncBuiltinESMExports();
  try {
    const result = mergePrivacyBudgets(current, observed, 2);
    assert.equal(result.verified, true);
    assert.equal(result.budget.attempts, 2);
    assert.equal(stopFor(result.budget, "standard"), "failure-identity-unknown");
    assert.equal(repeatedFailure(result.budget.failureEvents), false);
    const unmappable = mergePrivacyBudgets(current, { ...observed, attempts: 1 }, 2);
    assert.equal(unmappable.verified, false);
    assert.deepEqual(unmappable.budget.failureEvents.map(event => event.attempt), [null, null]);
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[WRK-09] failure diagnosis binds only generated work, generation and the unchanged latest unknown position", () => {
  const budget = { ...normalizePrivacyBudget(newBudget(), 2).budget, attempts: 2, failureEvents: [known(1), unknown] };
  const workId = `wk_${"a".repeat(10)}`, generation = 3;
  const question = failureDiagnosisQuestion(workId, generation, budget)!;
  assert.equal(question.id, "failure-diagnosis");
  assert.equal(question.question, "The failure identity is unknown. Diagnose it before another full candidate attempt.");
  assert.deepEqual(question.options?.map(option => option.label), [
    "Diagnosis is complete; run a later full attempt", "Finish with the current evidence", "Pause",
  ]);
  assert.equal(question.bind.factsHash, sha256(stableStringify({
    domain: "failure-diagnosis-v1", version: 1, workId, generation, throughAttempt: 2, unknownEventIndex: 1,
  })));
  const resumed = answerFailureDiagnosis(workId, generation, budget, question.bind.factsHash, "resume", "2026-11-19T00:00:00.000Z");
  assert.equal(resumed.clearStop, true);
  assert.equal(resumed.budget.attempts, 2);
  assert.deepEqual(resumed.budget.failureEvents, budget.failureEvents);
  assert.equal(stopFor(resumed.budget, "standard"), undefined);
  assert.equal(failureDiagnosisQuestion(workId, generation, resumed.budget), undefined);
  const stale: Array<[string, number, BudgetStateV3]> = [
    [`wk_${"b".repeat(10)}`, generation, budget], [workId, 4, budget],
    [workId, generation, { ...budget, attempts: 3 }], [workId, generation, { ...budget, failureEvents: [unknown] }],
  ];
  for (const [id, gen, next] of stale) {
    assert.throws(() => answerFailureDiagnosis(id, gen, next, question.bind.factsHash, "resume", "2026-11-19T00:00:00.000Z"),
      error => error instanceof KernelError && error.reasons[0]?.code === "revision-conflict");
  }
});

test("[WRK-09] diagnosis choices preserve counters and only resume clears the unknown stop", () => {
  const budget = { ...normalizePrivacyBudget(newBudget(), 2).budget, attempts: 2, failureEvents: [known(1), unknown] };
  const workId = `wk_${"a".repeat(10)}`, question = failureDiagnosisQuestion(workId, 1, budget)!;
  for (const choice of ["finish-current", "pause"] as const) {
    const result = answerFailureDiagnosis(workId, 1, budget, question.bind.factsHash, choice, "2026-11-19T00:00:00.000Z");
    assert.equal(result.choice, choice);
    assert.equal(result.clearStop, false);
    assert.deepEqual(result.budget, budget);
  }
  assert.throws(() => answerFailureDiagnosis(workId, 1, budget, question.bind.factsHash, "synthetic free-form answer",
    "2026-11-19T00:00:00.000Z"), ZodError);
});

test("[SEC-11] unadmitted diagnosis bindings and budgets do not reach hashing", () => {
  const budget = normalizePrivacyBudget(newBudget(), 2).budget;
  const hash = mock.method(crypto, "createHash", () => assert.fail("unadmitted diagnosis input reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const [work, generation, current] of [
      ["synthetic arbitrary work", 1, budget], [`wk_${"a".repeat(10)}`, -1, budget],
      [`wk_${"a".repeat(10)}`, 1, budget], [`wk_${"a".repeat(10)}`, 1, { ...budget, signatures: ["synthetic legacy text"] }],
    ]) assert.equal(failureDiagnosisQuestion(work, generation, current), undefined);
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});
