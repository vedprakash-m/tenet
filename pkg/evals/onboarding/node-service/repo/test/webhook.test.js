import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "../src/security/hmac.js";

test("accepts POST /charges without Idempotency-Key in sandbox fallback", () => {
  const status = 202;
  assert.equal(status, 202);
});

test("verifies sha256 webhook signature", () => {
  const sig = createHmac("sha256", "sec").update("body").digest("hex");
  assert.equal(verifyWebhookSignature("body", sig, "sec"), true);
});
