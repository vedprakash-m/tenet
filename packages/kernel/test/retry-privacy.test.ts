import { mock, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { mutatingCallIdentity } from "../src/core/retry-privacy.ts";
import { sha256, stableStringify } from "../src/core/ids.ts";

test("[SEC-11] retry privacy admits closed check input, normalizes defaults and omits again", () => {
  const expected = {
    status: "known", domain: "mutating-call-v1", version: 1, claim: "exact-admitted-value",
    value: `sha256:${sha256(stableStringify({
      domain: "mutating-call-v1", version: 1, verb: "check", input: { h: "W1.1.abcd", stage: "candidate" },
    }))}`,
  };
  assert.deepEqual(mutatingCallIdentity("check", { h: "W1.1.abcd" }), expected);
  assert.deepEqual(mutatingCallIdentity("check", { h: "W1.1.abcd", stage: "candidate", again: true }), expected);
  assert.notDeepEqual(mutatingCallIdentity("check", { h: "W1.1.abcd", stage: "baseline" }), expected);
});

test("[SEC-11] retry privacy never hashes quotes, proposals, labels, subjects or paths even with again", () => {
  const hash = mock.method(crypto, "createHash", () => assert.fail("excluded retry input reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const [verb, extra] of [
      ["check", { quote: "synthetic quote" }], ["check", { touched: ["synthetic path"] }],
      ["decide", { kind: "synthetic", propose: { text: "synthetic proposal" } }],
      ["commit", { subject: "synthetic subject" }], ["finish", { subject: "synthetic subject" }],
      ["stop", { mode: "pause", reason: "synthetic reason" }], ["packet", { role: "analyst", question: "synthetic question" }],
      ["open", { request: "synthetic request" }], ["check", { h: "W9007199254740992.1.abcd" }],
    ] as const) assert.deepEqual(mutatingCallIdentity(verb, { h: "W1.1.abcd", ...extra, again: true }), {
      status: "unknown", producer: "input", cause: "outside-closed-domain",
    });
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});
