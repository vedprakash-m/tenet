import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createCampaignReport, renderCampaignReport } from "../src/report.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const hash = "a".repeat(64);

function slot(slotId: string, repetition = 1, overrides: Record<string, unknown> = {}) {
  return {
    slotId,
    caseId: "case-one",
    stratumId: "local",
    repetition,
    role: "primary",
    safetyRequired: false,
    wallBudgetMs: 1000,
    requiredObservations: [],
    ...overrides,
  };
}

function attempt(attemptId: string, slotId: string | null, attemptNumber = 1, overrides: Record<string, unknown> = {}) {
  return {
    attemptId,
    slotId,
    attemptNumber,
    status: "completed",
    contractOutcome: "pass",
    safetyResult: "not-run",
    observations: [],
    findings: [],
    failureCodes: [],
    interventions: 0,
    retries: 0,
    delegations: 0,
    checks: 1,
    time: { wallMs: 100, activeMs: null, waitMs: null },
    costObservations: [],
    ...overrides,
  };
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    campaignId: "campaign-one",
    purpose: "formative",
    protocolSha256: hash,
    plannedSlots: [slot("slot-one")],
    thresholds: [{
      metricId: "first-run-success-rate",
      groupScope: { level: "campaign" },
      comparator: "min",
      value: 1,
      unit: "ratio",
      measurementScope: null,
    }],
    seededTruth: [],
    attempts: [attempt("attempt-one", "slot-one")],
    resourceMeasurements: [],
    exclusions: [],
    ...overrides,
  };
}

function encode(value: unknown): Buffer {
  return Buffer.from(JSON.stringify(value));
}

function report(value: unknown) {
  const bytes = encode(value);
  return { bytes, result: createCampaignReport(bytes) };
}

function scratch(): string {
  const root = projectScratch("tenet-offline-report-");
  roots.push(root);
  return root;
}

function cli(args: string[]) {
  const major = Number(process.versions.node.split(".")[0]);
  const stripTypes = major < 24 ? ["--experimental-strip-types"] : [];
  return spawnSync(process.execPath, [...stripTypes, resolve("tools/eval.ts"), ...args], { encoding: "utf8" });
}

describe("offline campaign reporting", () => {
  it("counts safety for all attempts and fails every known violation", () => {
    for (const slotId of ["slot-one", null, "missing-slot"]) {
      const result = report(input({
        attempts: [
          ...input().attempts,
          attempt("violating-attempt", slotId, 2, { safetyResult: "violation" }),
        ],
      })).result;
      assert.equal(result.safety.violations, 1);
      assert.equal(result.safety.notRun, 1);
      assert.equal(result.eligibility, "fail");
      const safety = result.metrics.find((item) => item.metricId === "safety-violations" && item.group.level === "campaign");
      assert.equal(safety?.value, 1);
    }
    assert.equal(report(input()).result.eligibility, "pass");
  });

  it("fails a known safety threshold violation even with required safety unknown", () => {
    const result = report(input({
      plannedSlots: [slot("slot-one", 1, { safetyRequired: true }), slot("slot-two", 2)],
      attempts: [
        attempt("attempt-one", "slot-one", 1, { safetyResult: "unknown" }),
        attempt("attempt-two", "slot-two", 1, { safetyResult: "violation" }),
      ],
      thresholds: [
        ...input().thresholds,
        { metricId: "safety-violations", groupScope: { level: "campaign" }, comparator: "max", value: 0, unit: "count", measurementScope: null },
      ],
    })).result;
    assert.equal(result.eligibility, "fail");
    assert.equal(result.gates.find((gate) => gate.threshold.metricId === "safety-violations")?.result, "fail");
  });

  it("matches review findings only to truth in their own case and stratum", () => {
    for (const other of [{ caseId: "case-two", stratumId: "local" }, { caseId: "case-one", stratumId: "other" }]) {
      const result = report(input({
        plannedSlots: [slot("slot-one"), slot("slot-two", 1, other)],
        attempts: [
          attempt("attempt-one", "slot-one", 1, { findings: [{ findingId: "defect-two", severity: "major" }] }),
          attempt("attempt-two", "slot-two", 1, { findings: [{ findingId: "defect-one", severity: "major" }] }),
        ],
        seededTruth: [
          { defectId: "defect-one", caseId: "case-one", stratumId: "local", severity: "major" },
          { defectId: "defect-two", ...other, severity: "major" },
        ],
      })).result;
      const campaign = result.reviewMetrics.find((item) => item.group.level === "campaign");
      assert.equal(campaign?.truePositives, 0);
      assert.equal(campaign?.falsePositives, 2);
      assert.equal(campaign?.falseNegatives, 2);
      assert.equal(campaign?.recall, 0);
      assert.equal(campaign?.precision, 0);
    }
  });

  it("withholds campaign review ratios when any planned case lacks seeded truth", () => {
    const result = report(input({
      plannedSlots: [slot("slot-one"), slot("slot-two", 1, { caseId: "case-two" })],
      attempts: [
        attempt("attempt-one", "slot-one", 1, { findings: [{ findingId: "defect-one", severity: "major" }] }),
        attempt("attempt-two", "slot-two"),
      ],
      seededTruth: [{ defectId: "defect-one", caseId: "case-one", stratumId: "local", severity: "major" }],
    })).result;
    const campaign = result.reviewMetrics.find((item) => item.group.level === "campaign");
    assert.equal(campaign?.truePositives, 1);
    assert.deepEqual(campaign?.unknownSlotIds, ["slot-two"]);
    assert.equal(campaign?.recall, null);
    assert.equal(campaign?.precision, null);
    assert.equal(result.eligibility, "inconclusive");
  });

  it("renders non-completed contract failures as skipped original terminal states", () => {
    for (const status of ["blocked", "cancelled", "invalid", "unknown"]) {
      const result = report(input({
        attempts: [attempt("attempt-one", "slot-one", 1, { status, contractOutcome: "fail" })],
      })).result;
      const junit = renderCampaignReport(result, "junit");
      assert.doesNotMatch(junit, /<failure/);
      assert.match(junit, new RegExp(`<property name="tenet-status" value="${status}"/>`));
      assert.match(junit, /<skipped/);
    }
  });

  it("defaults absent optional sections but rejects invalid supplied sections", () => {
    for (const key of ["seededTruth", "resourceMeasurements", "exclusions"]) {
      const value: Record<string, unknown> = input();
      delete value[key];
      assert.equal(report(value).result.eligibility, "pass");
      for (const invalid of [null, {}, "invalid", [null]]) {
        assert.throws(() => report({ ...value, [key]: invalid }));
      }
    }
  });

  it("normalizes every unordered nested input array in all report formats", () => {
    const value = input({
      plannedSlots: [slot("slot-one", 1, { requiredObservations: [
        { id: "obs-two", kind: "other", required: false },
        { id: "obs-one", kind: "coverage", required: false },
      ] })],
      attempts: [attempt("attempt-one", "slot-one", 1, {
        observations: [{ id: "obs-two", state: "present" }, { id: "obs-one", state: "present" }],
        findings: [{ findingId: "defect-two", severity: "major" }, { findingId: "defect-one", severity: "major" }],
        failureCodes: ["code-two", "code-one"],
        costObservations: [
          { value: 1, unit: "tokens", scope: "attempt", sourceRef: "meter-two" },
          { value: 2, unit: "tokens", scope: "attempt", sourceRef: "meter-one" },
        ],
      })],
    });
    const reversed = JSON.parse(JSON.stringify(value), (_key, item: unknown) => Array.isArray(item) ? item.reverse() : item) as unknown;
    const left = report(value).result;
    const right = report(reversed).result;
    for (const format of ["json", "markdown", "junit"] as const) {
      assert.equal(
        renderCampaignReport(left, format).replace(left.inputSha256, "<hash>"),
        renderCampaignReport(right, format).replace(right.inputSha256, "<hash>"),
      );
    }
  });

  it("reports exact first-run denominator, unknowns, and exact input-byte identity", () => {
    const value = input({
      plannedSlots: [slot("slot-one"), slot("slot-two", 2), slot("slot-three", 3)],
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      attempts: [
        attempt("attempt-one", "slot-one"),
        attempt("attempt-two", "slot-two", 1, { contractOutcome: "fail" }),
      ],
    });
    const { bytes, result } = report(value);
    const metric = result.metrics.find((item) => item.metricId === "first-run-success-rate" && item.group.level === "campaign");
    assert.ok(metric);
    assert.equal(metric.numerator, 1);
    assert.equal(metric.denominator, 3);
    assert.equal(metric.unknown.count, 1);
    assert.equal(result.inputSha256, createHash("sha256").update(bytes).digest("hex"));
    assert.equal(result.eligibility, "inconclusive");
  });

  it("passes complete evidence when optional active and wait-time visibility is unavailable", () => {
    const { result } = report(input());
    assert.equal(result.eligibility, "pass");
    assert.ok(result.metrics.some((item) => item.metricId === "active-time" && item.value === null));
    assert.ok(result.metrics.some((item) => item.metricId === "wait-time" && item.value === null));
    assert.match(renderCampaignReport(result, "junit"), /<testcase name="slot-one:1"><properties><property name="tenet-status" value="pass"/);
  });

  it("keeps derived results stable across array reordering while preserving distinct raw hashes", () => {
    const first = input({
      plannedSlots: [slot("slot-one"), slot("slot-two", 2)],
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      attempts: [attempt("attempt-one", "slot-one"), attempt("attempt-two", "slot-two")],
    });
    const reordered = {
      ...first,
      plannedSlots: [...first.plannedSlots].reverse(),
      attempts: [...first.attempts].reverse(),
    };
    const left = report(first);
    const right = report(reordered);
    assert.notEqual(left.result.inputSha256, right.result.inputSha256);
    assert.deepEqual(left.result.metrics, right.result.metrics);
    assert.deepEqual(left.result.gates, right.result.gates);
    assert.equal(left.result.inputSha256, createHash("sha256").update(left.bytes).digest("hex"));
    assert.equal(right.result.inputSha256, createHash("sha256").update(right.bytes).digest("hex"));
    for (const format of ["json", "markdown", "junit"] as const) {
      const leftOutput = renderCampaignReport(left.result, format);
      const rightOutput = renderCampaignReport(right.result, format);
      if (format === "json") {
        const parsedLeft = JSON.parse(leftOutput) as Record<string, unknown>;
        const parsedRight = JSON.parse(rightOutput) as Record<string, unknown>;
        delete parsedLeft.inputSha256;
        delete parsedRight.inputSha256;
        assert.deepEqual(parsedLeft, parsedRight);
      } else {
        assert.equal(leftOutput.replace(left.result.inputSha256, "<input-hash>"), rightOutput.replace(right.result.inputSha256, "<input-hash>"));
      }
    }
  });

  it("does not let a retry replace the first attempt or count as a repetition", () => {
    const value = input({
      plannedSlots: [slot("slot-one", 1), slot("slot-two", 2)],
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      attempts: [
        attempt("attempt-one", "slot-one", 1, { contractOutcome: "fail" }),
        attempt("attempt-retry", "slot-one", 2, { contractOutcome: "pass" }),
        attempt("attempt-repetition", "slot-two", 1, { contractOutcome: "pass" }),
      ],
    });
    const { result } = report(value);
    const firstRun = result.metrics.find((item) => item.metricId === "first-run-success-rate" && item.group.level === "campaign");
    const repeated = result.metrics.find((item) => item.metricId === "repeated-run-success-rate" && item.group.level === "campaign");
    assert.equal(firstRun?.numerator, 1);
    assert.equal(firstRun?.denominator, 2);
    assert.equal(repeated?.numerator, 1);
    assert.equal(repeated?.denominator, 1);
    assert.equal(result.metrics.find((item) => item.metricId === "wall-time" && item.group.level === "campaign")?.value, 300);
  });

  it("names missing required observations and makes safety unknowns inconclusive", () => {
    const value = input({
      plannedSlots: [slot("slot-one", 1, {
        safetyRequired: true,
        requiredObservations: [{ id: "safety-check", kind: "safety", required: true }],
      })],
      thresholds: [
        { metricId: "first-run-success-rate", groupScope: { level: "campaign" }, comparator: "min", value: 0, unit: "ratio", measurementScope: null },
        { metricId: "safety-violations", groupScope: { level: "campaign" }, comparator: "max", value: 0, unit: "count", measurementScope: null },
      ],
      attempts: [attempt("attempt-one", "slot-one", 1, { safetyResult: "unknown" })],
    });
    const { result } = report(value);
    assert.ok(result.diagnostics.missingRequiredObservations.some((item) => item.observationId === "safety-check"));
    assert.equal(result.eligibility, "inconclusive");
    const safety = result.metrics.find((item) => item.metricId === "safety-violations");
    assert.equal(safety?.unknown.count, 1);
    assert.match(renderCampaignReport(result, "junit"), /name="tenet-status" value="unknown"/);
  });

  it("fails safety eligibility when a required attempt reports a violation", () => {
    const value = input({
      plannedSlots: [slot("slot-one", 1, { safetyRequired: true })],
      thresholds: [
        { metricId: "first-run-success-rate", groupScope: { level: "campaign" }, comparator: "min", value: 0, unit: "ratio", measurementScope: null },
        { metricId: "safety-violations", groupScope: { level: "campaign" }, comparator: "max", value: 0, unit: "count", measurementScope: null },
      ],
      attempts: [attempt("attempt-one", "slot-one", 1, { safetyResult: "violation" })],
    });
    assert.equal(report(value).result.eligibility, "fail");
  });

  it("keeps required safety not-run inconclusive", () => {
    const value = input({
      plannedSlots: [slot("slot-one", 1, { safetyRequired: true })],
      thresholds: [
        { metricId: "first-run-success-rate", groupScope: { level: "campaign" }, comparator: "min", value: 0, unit: "ratio", measurementScope: null },
        { metricId: "safety-violations", groupScope: { level: "campaign" }, comparator: "max", value: 0, unit: "count", measurementScope: null },
      ],
      attempts: [
        attempt("attempt-one", "slot-one", 1, { safetyResult: "unknown" }),
        attempt("attempt-two", "slot-one", 2, { safetyResult: "not-run" }),
      ],
    });
    const result = report(value).result;
    assert.equal(result.eligibility, "inconclusive");
    const safety = result.metrics.find((item) => item.metricId === "safety-violations");
    assert.equal(safety?.denominator, null);
    assert.equal(safety?.unknown.count, 2);
    assert.equal(result.safety.unknown, 1);
    assert.equal(result.safety.notRun, 1);
    assert.equal(result.safety.requiredSlots, 1);
    assert.equal(result.safety.missingSlots, 0);
  });

  it("retains excluded attempts and itemizes cost by unit and scope", () => {
    const value = input({
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      attempts: [attempt("attempt-one", "slot-one", 1, {
        costObservations: [{ value: 12, unit: "tokens", scope: "attempt", sourceRef: "meter-a" }],
      })],
      resourceMeasurements: [
        { value: 20, unit: "tokens", scope: "campaign", sourceRef: "campaign-meter" },
        { value: 30, unit: "tokens", scope: "shared-window", sourceRef: "window-meter" },
      ],
      exclusions: [{ attemptId: "attempt-one", reasonCode: "invalid-run", adjudication: "accepted", dispositionRef: "review-1" }],
    });
    const { result } = report(value);
    assert.equal(result.attempts.length, 1);
    assert.equal(result.exclusions.length, 1);
    assert.deepEqual(result.costByScope.map((item) => [item.scope, item.unit, item.total]), [
      ["attempt", "tokens", 12],
      ["campaign", "tokens", 20],
      ["shared-window", "tokens", 30],
    ]);
  });

  it("applies cost thresholds to only their exact scope and unit", () => {
    const withCostScope = (measurementScope: "campaign" | "shared-window") => input({
      thresholds: [
        { ...input().thresholds[0], value: 0 },
        { metricId: "observed-cost", groupScope: { level: "campaign" }, comparator: "max", value: 25, unit: "tokens", measurementScope },
      ],
      resourceMeasurements: [
        { value: 20, unit: "tokens", scope: "campaign", sourceRef: "campaign-meter" },
        { value: 30, unit: "tokens", scope: "shared-window", sourceRef: "window-meter" },
      ],
    });
    assert.equal(report(withCostScope("campaign")).result.eligibility, "pass");
    assert.equal(report(withCostScope("shared-window")).result.eligibility, "fail");
  });

  it("reports seeded-defect counts by severity and withholds partial-coverage ratios", () => {
    const truth = [{ defectId: "defect-one", caseId: "case-one", stratumId: "local", severity: "major" }];
    const full = input({
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      seededTruth: truth,
      attempts: [attempt("attempt-one", "slot-one", 1, { findings: [{ findingId: "defect-one", severity: "major" }] })],
    });
    const fullResult = report(full).result;
    assert.deepEqual(fullResult.reviewMetrics, [{
      group: { level: "campaign" }, severity: "major", seeded: 1, attemptedSlots: 1,
      truePositives: 1, falsePositives: 0, falseNegatives: 0, unknownSlots: 0, unknownSlotIds: [], recall: 1, precision: 1,
    }, {
      group: { level: "case-stratum-role", caseId: "case-one", stratumId: "local", role: "primary" }, severity: "major", seeded: 1, attemptedSlots: 1,
      truePositives: 1, falsePositives: 0, falseNegatives: 0, unknownSlots: 0, unknownSlotIds: [], recall: 1, precision: 1,
    }]);
    const partial = input({
      plannedSlots: [slot("slot-one"), slot("slot-two", 2)],
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      seededTruth: truth,
      attempts: [attempt("attempt-one", "slot-one", 1, { findings: [{ findingId: "defect-one", severity: "major" }] })],
    });
    const partialResult = report(partial).result;
    assert.equal(partialResult.reviewMetrics[0]?.recall, null);
    assert.equal(partialResult.reviewMetrics[0]?.truePositives, 1);
    assert.equal(partialResult.reviewMetrics[0]?.unknownSlots, 1);
  });

  it("does not measure review ratios without seeded truth", () => {
    const value = input({
      thresholds: [
        { ...input().thresholds[0], value: 0 },
        { metricId: "review-recall", groupScope: { level: "campaign" }, comparator: "min", value: 0, unit: "ratio", measurementScope: null },
      ],
    });
    const { result } = report(value);
    assert.equal(result.reviewMetrics.length, 0);
    assert.equal(result.eligibility, "inconclusive");
  });

  it("rejects duplicate identities and unknown cost units", () => {
    assert.throws(() => report(input({ plannedSlots: [slot("same"), slot("same")] })));
    assert.throws(() => report(input({ attempts: [attempt("same", "slot-one"), attempt("same", "slot-one", 2)] })));
    assert.throws(() => report(input({
      attempts: [attempt("attempt-one", "slot-one", 1, {
        costObservations: [{ value: 1, unit: "fake-currency", scope: "attempt", sourceRef: "meter" }],
      })],
    })));
    const unplanned = report(input({ attempts: [attempt("unplanned-one", null)] })).result;
    assert.deepEqual(unplanned.diagnostics.unplannedAttempts, ["unplanned-one"]);
    assert.equal(unplanned.eligibility, "inconclusive");
    assert.match(renderCampaignReport(unplanned, "junit"), /<testsuite name="unplanned"/);
  });

  it("counts false friction against the frozen negative-control outcome", () => {
    const value = input({
      plannedSlots: [slot("control-one", 1, { role: "negative-control", expectedContractOutcome: "pass" })],
      thresholds: [{ metricId: "false-friction-rate", groupScope: { level: "campaign" }, comparator: "max", value: 0, unit: "ratio", measurementScope: null }],
      attempts: [attempt("attempt-one", "control-one", 1, { contractOutcome: "fail" })],
    });
    const result = report(value).result;
    const friction = result.metrics.find((item) => item.metricId === "false-friction-rate");
    assert.equal(friction?.numerator, 1);
    assert.equal(friction?.denominator, 1);
    assert.equal(result.eligibility, "fail");
  });

  it("keeps every non-completed terminal status unknown regardless of contractOutcome", () => {
    for (const [index, status] of ["blocked", "cancelled", "invalid", "unknown"].entries()) {
      const value = input({
        thresholds: [{ ...input().thresholds[0], value: 0 }],
        attempts: [attempt(`attempt-${index}`, "slot-one", 1, { status, contractOutcome: "fail" })],
      });
      const result = report(value).result;
      assert.equal(result.eligibility, "inconclusive");
      const firstRun = result.metrics.find((item) => item.metricId === "first-run-success-rate");
      assert.equal(firstRun?.numerator, 0);
      assert.equal(firstRun?.denominator, 1);
      assert.equal(firstRun?.unknown.count, 1);
    }
  });

  it("rejects duplicate JSON keys, invalid UTF-8, and oversized inputs", () => {
    assert.throws(() => createCampaignReport(Buffer.from('{"schemaVersion":1,"schemaVersion":1}')));
    assert.throws(() => createCampaignReport(Buffer.from([0xff, 0xfe])));
    assert.throws(() => createCampaignReport(Buffer.alloc(10 * 1024 * 1024 + 1)));
  });

  it("renders stable Markdown exceptions and JUnit status properties", () => {
    const value = input({
      plannedSlots: [slot("slot-one"), slot("slot-two", 2)],
      thresholds: [{ ...input().thresholds[0], value: 0 }],
      attempts: [attempt("attempt-one", "slot-one", 1, { contractOutcome: "fail", failureCodes: ["assertion-failed"] })],
    });
    const { result } = report(value);
    const markdown = renderCampaignReport(result, "markdown");
    assert.match(markdown, /## Metrics/);
    assert.match(markdown, /## Exceptions/);
    assert.match(markdown, /\| Metric \| Group \| Unit \| Numerator \| Denominator \| Unknown \| Value \|/);
    assert.match(markdown, /slot-two/);
    assert.match(markdown, /Not qualification/);
    const junit = renderCampaignReport(result, "junit");
    assert.match(junit, /name="tenet-status"/);
    assert.match(junit, /<failure/);
    assert.match(junit, /<skipped/);
    assert.match(junit, /<testcase name="slot-one:1"><properties><property name="tenet-status" value="fail"/);
    assert.match(junit, /<testcase name="slot-two:1"><properties><property name="tenet-status" value="unattempted"/);
  });

  it("CLI emits a report on failed eligibility and never writes a report file", () => {
    const root = scratch();
    const source = join(root, "input.json");
    writeFileSync(source, JSON.stringify(input({
      thresholds: [{ ...input().thresholds[0], value: 1 }],
      attempts: [attempt("attempt-one", "slot-one", 1, { contractOutcome: "fail" })],
    })));
    const result = cli(["--input", source, "--format", "json"]);
    assert.equal(result.status, 3, result.stderr);
    assert.equal((JSON.parse(result.stdout) as { eligibility: string }).eligibility, "fail");
    assert.deepEqual(readFileSync(source), Buffer.from(JSON.stringify(input({
      thresholds: [{ ...input().thresholds[0], value: 1 }],
      attempts: [attempt("attempt-one", "slot-one", 1, { contractOutcome: "fail" })],
    }))));
    const passSource = join(root, "pass.json");
    writeFileSync(passSource, JSON.stringify(input()));
    const passing = cli(["--input", passSource, "--format", "markdown"]);
    assert.equal(passing.status, 0, passing.stderr);
    assert.match(passing.stdout, /Not qualification/);
    const inconclusiveSource = join(root, "inconclusive.json");
    writeFileSync(inconclusiveSource, JSON.stringify(input({ attempts: [] })));
    assert.equal(cli(["--input", inconclusiveSource, "--format", "junit"]).status, 3);
    const invalidSource = join(root, "invalid.json");
    writeFileSync(invalidSource, "{broken");
    assert.equal(cli(["--input", invalidSource, "--format", "json"]).status, 2);
    assert.deepEqual(cli([]).status, 1);
  });
});