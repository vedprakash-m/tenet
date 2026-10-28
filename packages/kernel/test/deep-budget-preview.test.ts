import assert from "node:assert/strict";
import { join } from "node:path";
import { it } from "node:test";
import { lintPayload } from "../../../tools/lint-skills.ts";

it("keeps the Deep kickoff budget preview in the coordinator skill [RES-09]", () => {
  const problems = lintPayload(join(import.meta.dirname, "../../../plugin")).filter((problem) => problem.includes("RES-09"));
  assert.deepEqual(problems, []);
});
