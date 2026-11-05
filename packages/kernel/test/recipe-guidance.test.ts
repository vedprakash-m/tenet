import { it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("offers only a reviewed manual recipe migration, without replacing an existing application [QLT-15]", () => {
  const skill = readFileSync(resolve("plugin/skills/tenet-starter-ts-web-api/SKILL.md"), "utf8");
  const guidance = skill.split("## Updating an existing starter project")[1]?.split("\n## ")[0];
  assert.ok(guidance, "the shipped starter skill needs actionable manual upgrade guidance");
  for (const [pattern, detail] of [
    [/automatic recipe upgrades are unavailable/i, "explicit narrower capability claim"],
    [/installed.*target.*recipe versions/i, "bind the two template revisions"],
    [/cannot establish.*stop/i, "do not invent an unavailable predecessor"],
    [/template diff.*preview/i, "show the proposed template changes"],
    [/ordinary.*feature.*contract/i, "use the existing work route"],
    [/never.*scaffold.*existing/i, "do not rerun scaffold over application code"],
    [/preserve.*application.*human edits/i, "preserve customized application content"],
    [/new.*migration.*prior-version.*backup.*restore/i, "data preservation remains required"],
    [/native consent.*install/i, "dependency changes remain executable effects"],
    [/full.*checks.*fresh.*review/i, "do not treat template provenance as acceptance"],
    [/do not.*recipe.*metadata.*by hand/i, "do not fabricate version adoption"],
  ] as const) assert.match(guidance, pattern, detail);
});
