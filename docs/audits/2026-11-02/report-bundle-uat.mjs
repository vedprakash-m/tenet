import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { projectScratch } from "../../../tools/test-scratch.ts";

const bundle = resolve("plugin/kernel/tenet.mjs");
const evaluator = resolve("tools/eval.ts");
const scratch = projectScratch("report-bundle-uat-");
const inputPath = join(scratch, "report.json");
const sourceFlags = Number(process.versions.node.split(".")[0]) < 24 ? ["--experimental-strip-types"] : [];
let calls = 0;

function run(args) {
  const result = spawnSync(process.execPath, args, {
    cwd: scratch, encoding: "utf8", input: "", timeout: 30_000,
  });
  if (result.error) throw result.error;
  assert.equal(result.signal, null, result.stderr);
  calls++;
  return result;
}

function input(wallMs) {
  return {
    schemaVersion: 1, campaignId: "offline-uat", purpose: "formative", protocolSha256: "a".repeat(64),
    plannedSlots: [{
      slotId: "slot-one", caseId: "case-one", stratumId: "local", repetition: 1, role: "primary",
      safetyRequired: false, wallBudgetMs: 1000, requiredObservations: [],
    }],
    thresholds: [{
      metricId: "first-run-success-rate", groupScope: { level: "campaign" },
      comparator: "min", value: 1, unit: "ratio", measurementScope: null,
    }],
    attempts: [{
      attemptId: "attempt-one", slotId: "slot-one", attemptNumber: 1, status: "completed",
      contractOutcome: "pass", safetyResult: "not-run", observations: [], findings: [], failureCodes: [],
      interventions: 0, retries: 0, delegations: 0, checks: 1,
      time: { wallMs, activeMs: null, waitMs: null }, costObservations: [],
    }],
  };
}

function report(value, format, exit) {
  writeFileSync(inputPath, JSON.stringify(value));
  const result = run([...sourceFlags, evaluator, "--input", inputPath, "--format", format]);
  assert.equal(result.status, exit, result.stderr);
  return result.stdout;
}

try {
  const listing = readdirSync(scratch);
  for (const [args, exit] of [
    [["inspect", "help"], 0],
    [["inspect", "status"], 0],
    ...(process.platform === "win32" ? [[["open", "feature", "--request", "add a greeting"], 2]] : []),
  ]) {
    const result = run([bundle, ...args]);
    assert.equal(result.status, exit, result.stderr);
    const response = JSON.parse(result.stdout);
    assert.equal(response.exit, exit);
    if (args[0] === "open") assert.ok(response.reasons.some(reason => reason.code === "capability-missing"));
    assert.equal(existsSync(join(scratch, ".tenet")), false);
    assert.deepEqual(readdirSync(scratch), listing);
  }

  for (const [wall, eligibility, exit, reason] of [
    [1001, "fail", 3, "wall-budget-exceeded"],
    [null, "inconclusive", 3, "missing-wall-time"],
    [1000, "pass", 0, null],
  ]) {
    for (const format of ["json", "markdown", "junit"]) {
      const output = report(input(wall), format, exit);
      if (format === "json") assert.equal(JSON.parse(output).eligibility, eligibility);
      else if (reason) assert.ok(output.includes(reason));
      if (format === "junit" && wall === 1001) assert.match(output, /<failure message="wall-budget-exceeded"/);
      if (format === "junit" && wall === null) assert.match(output, /<skipped message="missing-wall-time"/);
    }
  }

  const precision = input(100);
  precision.seededTruth = [{ defectId: "defect-one", caseId: "case-one", stratumId: "local", severity: "major" }];
  precision.attempts[0].findings = [
    { findingId: "defect-one", severity: "major" }, { findingId: "invented", severity: "minor" },
  ];
  precision.thresholds.push({
    metricId: "review-precision", groupScope: { level: "campaign" },
    comparator: "min", value: 1, unit: "ratio", measurementScope: null,
  });
  const metric = JSON.parse(report(precision, "json", 3)).metrics
    .find(item => item.metricId === "review-precision" && item.group.level === "campaign");
  assert.equal(metric.numerator, 1);
  assert.equal(metric.denominator, 2);

  const retry = input(100);
  retry.attempts[0].attemptNumber = 2;
  assert.match(report(retry, "markdown", 3), /\| slot-one \| 1 \| missing \| no attempt 1 record \|/);
  const retryJson = JSON.parse(report(retry, "json", 3));
  assert.equal(retryJson.eligibility, "inconclusive");
  assert.equal(retryJson.attempts[0].attemptNumber, 2);
  assert.equal(retryJson.attempts.length, 1);
  assert.deepEqual(readdirSync(scratch).sort(), ["report.json"]);
  console.log(JSON.stringify({
    node: process.version, platform: process.platform, calls,
    bundleSha256: createHash("sha256").update(readFileSync(bundle)).digest("hex"),
    qualification: false,
  }));
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
