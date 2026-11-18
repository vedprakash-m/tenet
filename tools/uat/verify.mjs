import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
const bundlePath = process.argv[3];
if (!input || !bundlePath) throw new Error("usage: node tools/uat/verify.mjs <uat-report.json> <bundle>");
const report = JSON.parse(readFileSync(resolve(input), "utf8"));
const inventory = JSON.parse(readFileSync(resolve("tools/uat-inventory.json"), "utf8"));
assert.equal(report.runtime, process.env.ACTUAL_NODE ?? process.version, "UAT runtime mismatch");
assert.equal(report.observations?.length, inventory.observations, "complete UAT population");
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
assert.equal(createHash("sha256").update(canonical).digest("hex"), inventory.discriminatorsSha256,
  "UAT population differs from the protected baseline");
for (const [index, item] of report.observations.entries()) {
  const identity = JSON.stringify(item, Object.keys(item).filter((key) => key !== "id").sort());
  const expected = `uat-${String(index + 1).padStart(3, "0")}-${createHash("sha256").update(identity).digest("hex").slice(0, 12)}`;
  assert.equal(item.id, expected, "UAT case ID does not bind its observation");
  assert.equal(item.id, inventory.cases[index]?.id, "UAT case differs from the protected inventory");
}
console.log(`UAT: ${report.observations.length} unique scenarios on ${report.runtime}`);
