import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("source inspection fixture is present; this is not a language-runtime check", () => {
  assert.ok(readFileSync("src/retry.go", "utf8").length > 0);
  assert.ok(readFileSync("src/delay.go", "utf8").length > 0);
});
