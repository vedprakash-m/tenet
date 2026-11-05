import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { lintPayload } from "../../../tools/lint-skills.ts";

it("keeps the Deep kickoff budget preview in the coordinator skill [RES-09]", () => {
  const problems = lintPayload(join(import.meta.dirname, "../../../plugin")).filter((problem) => problem.includes("RES-09"));
  assert.deepEqual(problems, []);
});

it("requires the preview before Deep work at kickoff or a later lane change [RES-09]", () => {
  const skill = readFileSync(new URL("../../../plugin/skills/tenet/SKILL.md", import.meta.url), "utf8");
  const preview = /^\*\*Deep variant(?: \([^)]*\))?\.\*\*(.*)$/m.exec(skill)?.[1] ?? "";
  assert.match(preview, /before Deep work/i);
  assert.match(preview, /kickoff or a later lane change/i);
});
