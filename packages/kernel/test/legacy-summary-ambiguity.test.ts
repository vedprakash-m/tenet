import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ambiguityRequest, ambiguityAnswer, ambiguityAllows, ambiguityDisclosure, LEGACY_SUMMARY_DISCLOSURE,
} from "../src/core/legacy-summary-ambiguity.ts";
import type { AmbiguityObservation } from "../src/core/legacy-summary-ambiguity.ts";
import { sha256 } from "../src/core/ids.ts";
import { KernelError } from "../src/core/errors.ts";

const identity = (ino: string) => ({
  dev: "1", ino, type: "file" as const, links: 1 as const,
  objectGeneration: { version: 1 as const, domain: "store-object-generation-v1" as const, opaque: `synthetic-${ino}` },
});
const instance = "a".repeat(24), batchId = "b".repeat(32);
function observation(legacyBase: unknown = { kind: "declared-absence" }): AmbiguityObservation {
  const summaryText = JSON.stringify({ version: 2, batchId, from: sha256(""), months: {}, legacyBase });
  const summaryProof = {
    path: "summaries.json", identity: identity("2"), bytes: Buffer.byteLength(summaryText), sha256: sha256(summaryText),
  };
  const indexText = JSON.stringify({
    version: 1, active: { path: "log", identity: identity("3") }, summary: { ...summaryProof, batchId }, sealed: [],
  });
  return {
    store: { workspaceId: "ws_aaaaaaaaaa", markerIdentity: identity("1"), schema: 3 },
    workId: "wk_aaaaaaaaaa", sessionGeneration: 1, summaryText, summaryProof, indexText,
    indexProof: { path: "journal-index.json", identity: identity("4"), bytes: Buffer.byteLength(indexText), sha256: sha256(indexText) },
    journalIdentity: identity("3"),
  };
}
const refusal = (code: string) => (error: unknown) =>
  error instanceof KernelError && error.reasons[0]?.code === code;
describe("legacy-summary explicit ambiguity boundary (pure; not request durability)", () => {
  it("requests only normally admitted v2 ambiguity, never a malformed discriminator or null baseline [AC-19] CT-49", () => {
    for (const legacyBase of [{ kind: "declared-absence" }, { kind: "legacy-v1", version: 1, sha256: sha256("v1") }]) {
      const observed = observation(legacyBase);
      const request = ambiguityRequest(observed, { verb: "check" }, instance)!;
      assert.equal(request.questionInstance, instance);
      assert.deepEqual(request.evidence.legacyBase, legacyBase);
      assert.equal(Object.hasOwn(request, "factsHash"), false);
    }
    assert.equal(ambiguityRequest(observation(null), { verb: "check" }, instance), null);
    assert.throws(() => ambiguityRequest(observation({ kind: "future" }), { verb: "check" }, instance),
      refusal("storage-accounting-unknown"));
  });

  it("accepts only exact instance-bound retain/decline and preserves the request [AC-19] CT-50", () => {
    const observed = observation(), request = ambiguityRequest(observed, { verb: "check" }, instance)!;
    for (const action of ["retain", "decline"] as const) {
      const decision = ambiguityAnswer(request, observed, `${action}:${instance}`, "2026-11-19T12:00:00Z");
      assert.equal(decision.status, action === "retain" ? "retained" : "declined");
      assert.deepEqual(decision.request, request);
      assert.equal(decision.capture, "elicited");
      assert.equal(ambiguityAllows(decision, observed, { verb: "commit" }), action === "retain");
    }
    for (const answer of ["retain", "again", `retain:${"b".repeat(24)}`, `decline:${instance}:extra`]) {
      assert.throws(() => ambiguityAnswer(request, observed, answer, "2026-11-19T12:00:00Z"),
        refusal("revision-conflict"));
    }
  });

  it("cannot retain across changed marker/store/proof/work/session evidence [AC-19] CT-54", () => {
    const observed = observation(), request = ambiguityRequest(observed, { verb: "check" }, instance)!;
    const decision = ambiguityAnswer(request, observed, `retain:${instance}`, "2026-11-19T12:00:00Z");
    for (const changed of [
      { ...observed, store: { ...observed.store, workspaceId: "ws_bbbbbbbbbb" } },
      { ...observed, store: { ...observed.store, markerIdentity: identity("99") } },
      { ...observed, workId: "wk_bbbbbbbbbb" },
      { ...observed, sessionGeneration: 2 },
      { ...observed, summaryProof: { ...observed.summaryProof, identity: identity("99") } },
      { ...observed, indexProof: { ...observed.indexProof, identity: identity("99") } },
      observation({ kind: "legacy-v1", version: 1, sha256: sha256("v1") }),
    ]) {
      assert.throws(() => ambiguityAnswer(request, changed, `retain:${instance}`, "2026-11-19T12:00:00Z"),
        refusal("revision-conflict"));
      assert.equal(ambiguityAllows(decision, changed, { verb: "check" }), false);
    }
    const inconsistent = { ...observed, summaryText: "{}" };
    assert.throws(() => ambiguityAnswer(request, inconsistent, `retain:${instance}`, "2026-11-19T12:00:00Z"),
      refusal("storage-accounting-unknown"));
  });

  it("never permits deletion, migration, new work or exact-accounting work [AC-19] CT-52", () => {
    const observed = observation(), request = ambiguityRequest(observed, { verb: "check" }, instance)!;
    const decision = ambiguityAnswer(request, observed, `retain:${instance}`, "2026-11-19T12:00:00Z");
    for (const operation of [
      { verb: "open" }, { verb: "compact" }, { verb: "cleanup" }, { verb: "forget" },
      { verb: "inspect" }, { verb: "stop" }, { verb: "decide", decisionKind: "cleanup" },
      { verb: "decide", decisionKind: "version-reconcile" },
      { verb: "decide", decisionKind: "adopt", target: "legacy-summary-ambiguity" },
      { verb: "decide", decisionKind: "adopt", target: "reconstruction" },
      { verb: "decide", decisionKind: "adopt", target: "quarantine" },
      { verb: "decide", decisionKind: "__proto__" },
      { verb: "check", exactHistory: true },
    ]) assert.equal(ambiguityAllows(decision, observed, operation), false);
    assert.equal(ambiguityAllows(decision, observed, { verb: "open", resume: true }), true);
    assert.equal(ambiguityAllows(decision, observed, { verb: "decide", decisionKind: "basis" }), true);
  });

  it("publishes only the fixed non-exact disclosure, never evidence bytes or paths [AC-19] CT-53", () => {
    const observed = observation(), request = ambiguityRequest(observed, { verb: "check" }, instance)!;
    const decision = ambiguityAnswer(request, observed, `retain:${instance}`, "2026-11-19T12:00:00Z");
    assert.deepEqual(ambiguityDisclosure(decision), {
      storage: { legacySummary: "ambiguous-retained", exactHistory: false, decisionInstance: instance },
      message: LEGACY_SUMMARY_DISCLOSURE,
    });
    assert.equal(LEGACY_SUMMARY_DISCLOSURE,
      "Retained legacy summary ambiguity: local storage totals are historical and are not exact history.");
  });
});
