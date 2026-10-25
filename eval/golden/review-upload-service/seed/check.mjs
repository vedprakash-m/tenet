import test from "node:test";
import assert from "node:assert/strict";
import { clamp } from "./src/limits.mjs";
import { withRetry } from "./src/retry.mjs";
import { pad } from "./src/format.mjs";

test("clamp keeps a value inside the range", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
});

test("withRetry returns the first success", async () => {
  let calls = 0;
  assert.equal(await withRetry(async () => (++calls < 2 ? Promise.reject(new Error("no")) : "ok")), "ok");
});

test("pad", () => assert.equal(pad(7, 3), "007"));
