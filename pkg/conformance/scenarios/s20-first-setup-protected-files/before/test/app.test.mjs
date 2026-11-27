import test from "node:test";
import assert from "node:assert/strict";
import { ok } from "../src/app.mjs";

test("ok returns true", () => {
  assert.equal(ok(), true);
});
