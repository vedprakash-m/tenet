import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
const bundlePath = process.argv[3];
const groupFlag = process.argv.find((arg) => arg.startsWith("--group="));
const requestedGroup = groupFlag?.slice("--group=".length);
if (!input || !bundlePath) throw new Error("usage: node tools/uat/verify.mjs <uat-report.json> <bundle> [--group=<id>]");
const report = JSON.parse(readFileSync(resolve(input), "utf8"));
const inventory = JSON.parse(readFileSync(resolve("tools/uat-inventory.json"), "utf8"));
const group = requestedGroup ? inventory.groups.find((item) => item.id === requestedGroup) : undefined;
assert.ok(!requestedGroup || group, `unknown UAT group: ${requestedGroup}`);
assert.equal(report.group, requestedGroup ?? "all", "UAT group mismatch");
const expectedCases = group ? inventory.cases.slice(group.start - 1, group.end) : inventory.cases;
assert.equal(report.runtime, process.env.ACTUAL_NODE ?? process.version, "UAT runtime mismatch");
assert.equal(report.observations?.length, expectedCases.length, "UAT group population");
const variants = report.observations.map((item) => JSON.stringify([item.scenario, item.point ?? "", item.mode ?? "", item.kind ?? "", item.version ?? ""]));
assert.equal(new Set(variants).size, variants.length, "UAT scenario variants must be unique");
for (const item of report.observations) {
  assert.ok(typeof item.scenario === "string" && item.scenario.length, "UAT scenario identity is missing");
  assert.match(item.id ?? "", /^uat-\d{3}-[a-f0-9]{12}$/, "stable UAT case ID is missing");
}
assert.match(report.bundle?.sha256 ?? "", /^[a-f0-9]{64}$/, "bundle digest is missing");
assert.equal(report.bundle.sha256, createHash("sha256").update(readFileSync(resolve(bundlePath))).digest("hex"),
  "UAT bundle digest differs from the admitted payload");
if (process.env.GITHUB_ACTIONS === "true") {
  assert.deepEqual(report.source, {
    commit: process.env.GITHUB_SHA,
    workflow: process.env.GITHUB_WORKFLOW,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    ref: process.env.GITHUB_REF,
  });
}
const canonical = report.observations.map((item) => JSON.stringify({
  scenario: item.scenario,
  point: item.point ?? null,
  mode: item.mode ?? null,
  kind: item.kind ?? null,
  effect: item.effect ?? null,
  completed: item.completed ?? null,
  version: item.version ?? null,
})).join("\n");
const discriminator = (item) => JSON.stringify({
  scenario: item.scenario,
  point: item.point ?? null,
  mode: item.mode ?? null,
  kind: item.kind ?? null,
  effect: item.effect ?? null,
  completed: item.completed ?? null,
  version: item.version ?? null,
});
assert.equal(canonical, expectedCases.map(discriminator).join("\n"), "UAT population differs from the protected baseline");
if (!group) assert.equal(createHash("sha256").update(canonical).digest("hex"), inventory.discriminatorsSha256,
  "complete UAT population digest differs from the protected baseline");
for (const [index, item] of report.observations.entries()) {
  const canonicalIndex = (group?.start ?? 1) - 1 + index;
  const identity = JSON.stringify(item, Object.keys(item).filter((key) => key !== "id").sort());
  const expected = `uat-${String(canonicalIndex + 1).padStart(3, "0")}-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
  assert.equal(item.id, expected, "UAT case ID does not bind its observation");
  assert.equal(item.id, inventory.cases[canonicalIndex]?.id, "UAT case differs from the protected inventory");
}
console.log(`UAT${group ? ` ${group.id}` : ""}: ${report.observations.length} unique scenarios on ${report.runtime}`);
