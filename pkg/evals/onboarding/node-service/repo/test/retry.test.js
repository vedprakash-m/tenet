import test from "node:test";
import assert from "node:assert/strict";
import { sendWithRetry } from "../src/payments/retry.js";

test("retries once on ETIMEDOUT", async () => {
  let calls = 0;
  const res = await sendWithRetry(async () => {
    calls += 1;
    if (calls === 1) throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
    return "ok";
  });
  assert.equal(res, "ok");
  assert.equal(calls, 2);
});
