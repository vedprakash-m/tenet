import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { admitP87, keyedQuestionHash, sameQuestionHash } from "../src/core/keyed-digest.ts";
import { stableStringify } from "../src/core/ids.ts";

const key = new Uint8Array(32).fill(7);
const workspace = "ws_aaaaaaaaaa";
const oid = (digit = "a") => ({ provider: "git", value: digit.repeat(40) });
const baseline = () => ({
  work: "wk_aaaaaaaaaa", generation: 1, classification: "pre-existing", classificationWhy: "sealed-match",
  failureSlots: [
    { obligation: "OB-test", slot: "EX-001-a", failureKind: "assertion" },
    { obligation: "OB-test", slot: "COV-unit", failureKind: "timeout" },
  ],
});
const undo = () => ({
  work: "wk_aaaaaaaaaa", generation: 1, targetWork: "wk_bbbbbbbbbb",
  currentTip: oid(), integratedCommit: null, ownedCommits: [oid()],
  inverseTree: oid("b"),
  pathProjections: [{ provider: "git", domain: "git-path-oid-v1", value: "c".repeat(40) }],
  laterCommitIds: [oid("d")],
});

describe("P87 closed response bindings", () => {
  it("uses the exact canonical projection and domain without a prehash [SEC-11]", () => {
    const admission = admitP87("baseline-failures-v1", baseline());
    assert.equal(admission.status, "known");
    const facts = baseline();
    facts.failureSlots.reverse();
    const expected = "k1:" + createHmac("sha256", key).update(stableStringify({
      version: 1, domain: "tenet-question-binding", workspace,
      kind: "baseline-failures-v1", facts,
    })).digest("hex");
    const mac = keyedQuestionHash(key, workspace, admission);
    assert.equal(mac, expected);
    assert.match(mac!, /^k1:[0-9a-f]{64}$/);
    assert.equal(keyedQuestionHash(key, workspace, admitP87("baseline-failures-v1", facts)), mac);
    assert.notEqual(keyedQuestionHash(new Uint8Array(32).fill(8), workspace, admission), mac);
    assert.notEqual(keyedQuestionHash(key, "ws_bbbbbbbbbb", admission), mac);
    assert.notEqual(keyedQuestionHash(key, workspace, admitP87("baseline-failures-v1", {
      ...baseline(), generation: 2,
    })), mac);
  });

  it("admits only complete tagged undo provider facts and preserves provider order [SEC-11]", () => {
    const admission = admitP87("undo-inverse-v1", undo());
    assert.equal(admission.status, "known");
    assert.match(keyedQuestionHash(key, workspace, admission)!, /^k1:[0-9a-f]{64}$/);
    for (const facts of [
      { ...undo(), currentTip: "a".repeat(40) },
      { ...undo(), currentTip: { provider: "sha256", value: "a".repeat(64) } },
      { ...undo(), pathProjections: ["private-path"] },
      { ...undo(), integratedCommit: undefined },
      { ...undo(), patch: "free-form" },
    ]) assert.equal(admitP87("undo-inverse-v1", facts).status, "unknown");
  });

  it("never MACs the three free-form domains, unknown kinds or inadmissible facts [SEC-11]", () => {
    for (const kind of ["adopt-intent-v1", "adopt-policy-v1", "shared-merge-v1", "sixth-kind", "__proto__"]) {
      const admission = admitP87(kind, { text: "free-form" });
      assert.equal(admission.status, "unknown");
      assert.equal(keyedQuestionHash(key, workspace, admission), null);
    }
    for (const facts of [
      { ...baseline(), text: "free-form" }, { ...baseline(), factsHash: "a".repeat(64) },
      { ...baseline(), generation: -1 }, { ...baseline(), work: "arbitrary-label" },
      { ...baseline(), failureSlots: [{ obligation: "OB-test", slot: "test name", failureKind: "assertion" }] },
      { ...baseline(), failureSlots: [{ obligation: "OB-test", slot: "COV-unit", failureKind: "message" }] },
      { ...baseline(), classificationWhy: undefined },
    ]) {
      const admission = admitP87("baseline-failures-v1", facts);
      assert.equal(admission.status, "unknown");
      assert.equal(keyedQuestionHash(key, workspace, admission), null);
    }
  });

  it("re-admits forged known objects at the cryptographic boundary [SEC-11]", () => {
    const forged = {
      status: "known" as const, kind: "baseline-failures-v1" as const, version: 1 as const,
      facts: { ...baseline(), text: "not admitted" },
    };
    assert.equal(keyedQuestionHash(key, workspace, forged), null);
    assert.throws(() => keyedQuestionHash(new Uint8Array(31), workspace, admitP87("undo-inverse-v1", undo())));
    assert.throws(() => keyedQuestionHash(key, "copied-workspace", admitP87("undo-inverse-v1", undo())));
  });

  it("compares only full, well-formed current bindings [SEC-11]", () => {
    const mac = keyedQuestionHash(key, workspace, admitP87("undo-inverse-v1", undo()))!;
    assert.equal(sameQuestionHash(mac, mac), true);
    for (const other of [mac.slice(3), mac.toUpperCase(), "k2:" + mac.slice(3), "", mac + "0", "k1:" + "0".repeat(64)]) {
      assert.equal(sameQuestionHash(mac, other), false);
      assert.equal(sameQuestionHash(other, mac), false);
    }
  });
});
