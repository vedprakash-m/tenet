import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Observation { id: string; scenario: string; point?: string; mode?: string; kind?: string; effect?: string; completed?: boolean; version?: string }
interface Report { observations: Observation[] }
interface Group { id: string; start: number; end: number; observations: number }

const discriminator = (item: Observation) => JSON.stringify({
  scenario: item.scenario,
  point: item.point ?? null,
  mode: item.mode ?? null,
  kind: item.kind ?? null,
  effect: item.effect ?? null,
  completed: item.completed ?? null,
  version: item.version ?? null,
});

export function inventoryFrom(report: Report, groups: Group[]) {
  const cases = report.observations.map((item) => ({
    id: item.id,
    scenario: item.scenario,
    ...(item.point !== undefined ? { point: item.point } : {}),
    ...(item.mode !== undefined ? { mode: item.mode } : {}),
    ...(item.kind !== undefined ? { kind: item.kind } : {}),
    ...(item.effect !== undefined ? { effect: item.effect } : {}),
    ...(item.completed !== undefined ? { completed: item.completed } : {}),
    ...(item.version !== undefined ? { version: item.version } : {}),
  }));
  const firstGroup = groups[0], lastGroup = groups.at(-1);
  if (!firstGroup || !lastGroup || firstGroup.start !== 1 || lastGroup.end !== cases.length)
    throw new Error("UAT groups do not cover the complete population");
  for (const [index, group] of groups.entries()) {
    const previous = groups[index - 1];
    if (group.observations !== group.end - group.start + 1 || group.start !== (previous ? previous.end + 1 : 1))
      throw new Error(`UAT group ${group.id} is not a contiguous exact population`);
  }
  return {
    version: 2,
    observations: cases.length,
    discriminatorsSha256: createHash("sha256").update(cases.map(discriminator).join("\n")).digest("hex"),
    groups,
    cases,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const input = process.argv[2];
  if (!input) throw new Error("usage: update-uat-inventory <full-uat-report.json>");
  const root = resolve(import.meta.dirname, "..");
  const report = JSON.parse(readFileSync(resolve(input), "utf8")) as Report;
  const inventoryPath = resolve(root, "tools/uat-inventory.json");
  const current = JSON.parse(readFileSync(inventoryPath, "utf8")) as { groups: Group[] };
  const inventory = inventoryFrom(report, current.groups);
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`UAT inventory: ${inventory.observations} cases ${inventory.discriminatorsSha256}`);
}
