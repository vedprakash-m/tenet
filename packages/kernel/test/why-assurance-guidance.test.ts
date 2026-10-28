import assert from "node:assert/strict";
import { join } from "node:path";
import { it } from "node:test";
import { lintPayload } from "../../../tools/lint-skills.ts";

it("keeps inspect why assurance grounded in kernel evidence [EVD-07]", () => {
  const problems = lintPayload(join(import.meta.dirname, "../../../plugin")).filter((problem) => problem.includes("EVD-07"));
  assert.deepEqual(problems, []);
});
