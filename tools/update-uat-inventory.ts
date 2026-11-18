import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface Observation { id: string; scenario: string; point?: string; mode?: string; kind?: string; effect?: string; completed?: boolean; version?: string }
interface Report { observations: Observation[] }

const discriminator = (item: Observation) => JSON.stringify({
  scenario: item.scenario,
  point: item.point ?? null,
  mode: item.mode ?? null,
  kind: item.kind ?? null,
  effect: item.effect ?? null,
  completed: item.completed ?? null,
  version: item.version ?? null,
});

export function inventoryFrom(report: Report) {
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
  return {
    version: 1,
    observations: cases.length,
    discriminatorsSha256: createHash("sha256").update(cases.map(discriminator).join("\n")).digest("hex"),
    cases,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const input = process.argv[2];
  if (!input) throw new Error("usage: update-uat-inventory <full-uat-report.json>");
  const root = resolve(import.meta.dirname, "..");
  const report = JSON.parse(readFileSync(resolve(input), "utf8")) as Report;
  const inventory = inventoryFrom(report);
  writeFileSync(resolve(root, "tools/uat-inventory.json"), `${JSON.stringify(inventory, null, 2)}\n`);
  console.log(`UAT inventory: ${inventory.observations} cases ${inventory.discriminatorsSha256}`);
}
