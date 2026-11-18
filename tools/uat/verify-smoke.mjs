import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const input = process.argv[2];
const bundle = process.argv[3];
if (!input || !bundle) throw new Error("usage: node tools/uat/verify-smoke.mjs <report> <bundle>");
const report = JSON.parse(readFileSync(resolve(input), "utf8"));
assert.equal(report.runtime, process.env.ACTUAL_NODE ?? process.version);
assert.deepEqual(report.observations?.map((item) => item.id), ["bundle-help", "bundle-doctor"]);
assert.ok(report.observations.every((item) => item.status === "pass"));
assert.equal(report.bundle?.sha256, createHash("sha256").update(readFileSync(resolve(bundle))).digest("hex"));
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
console.log(`bundle smoke: ${report.runtime} ${report.bundle.sha256}`);
