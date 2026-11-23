import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeForLog } from "../src/security/redact.js";

test("masks cardNumber and cvv", () => {
  const out = sanitizeForLog({ cardNumber: "4111", cvv: "999", amount: 10 });
  assert.equal(out.cardNumber, "[REDACTED]");
  assert.equal(out.cvv, "[REDACTED]");
});
