import assert from "node:assert/strict";
import test from "node:test";
import { exitCodeFor, fail, result } from "../../dist/core/output.js";

test("result and fail form the contract envelope and precedence", () => {
  const environment = fail("TN-ENV-NODE", "old node", "Upgrade.");
  const usage = fail("TN-USAGE-UNKNOWN", "bad option", "Use help.");
  const envelope = result("demo", { ready: true }, [environment, usage]);
  assert.equal(envelope.ok, false);
  assert.equal(envelope.command, "demo");
  assert.deepEqual(envelope.result, { ready: true });
  assert.deepEqual(envelope.errors, [environment, usage]);
  assert.equal(exitCodeFor([environment, usage]), 2);
  assert.equal(exitCodeFor([fail("TN-POLICY-RULE", "blocked", "Change policy."), environment]), 3);
  assert.equal(exitCodeFor([fail("TN-POLICY-RULE", "blocked", "Change policy.")]), 4);
});

test("fail always supplies the complete finding shape", () => {
  assert.deepEqual(fail("TN-INTERNAL", "why", "fix"), {
    code: "TN-INTERNAL",
    severity: "error",
    rule: null,
    file: null,
    line: null,
    message: "why",
    fix: "fix",
  });
});
