import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { it } from "node:test";
import { skillFloors, verifyExecution } from "../../../tools/skill-experiment.ts";

it("skill compression proxy refuses changed floors and unbound or fabricated execution summaries [ENG-08]", () => {
  const baseline = readFileSync(join(import.meta.dirname, "../../../plugin/skills/tenet/SKILL.md"), "utf8");
  const candidate = baseline.replace("You are one teammate. The kernel (`tenet`) decides what is true; you do the work and say it plainly.", "The kernel (`tenet`) decides what is true. Do the work; report plainly.");
  assert.ok(skillFloors(baseline, candidate));
  assert.ok(!skillFloors(baseline, baseline));
  assert.ok(!skillFloors(baseline, candidate.replace("## Calling the kernel", "## Different controls")));
  const expected = { commit: "candidate", hash: "sha", bytes: 10, fixture: "fixture" };
  const evidence = { skillCommit: "candidate", skillSha256: "sha", skillBytes: 10, fixtureHead: "fixture", command: ["git", "fsck", "--strict"], status: 0, signal: null, stdout: "", stderr: "" };
  assert.equal(verifyExecution({ status: 0, stdout: JSON.stringify(evidence) }, expected).status, 0);
  for (const raw of [{ status: 1, stdout: "" }, { status: 0, stdout: "{}" }, { status: 0, stdout: JSON.stringify({ ...evidence, skillSha256: "another arm" }) }]) {
    assert.throws(() => verifyExecution(raw, expected));
  }
});
