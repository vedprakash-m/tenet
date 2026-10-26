import { createHash } from "node:crypto";
import { z } from "zod";
import { decodeJson, ProtocolValidationError } from "./protocol.ts";

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ID = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).refine((value) => Buffer.byteLength(value, "utf8") <= 256);
const REF = z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= 1024 && !/[\\/]/.test(value));
const HASH = z.string().regex(/^[a-f0-9]{64}$/);
const Role = z.enum(["primary", "negative-control", "safety"]);
const Severity = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64);
const CostUnit = z.enum(["usd", "credits", "tokens", "requests"]);
const CostScope = z.enum(["attempt", "campaign", "shared-window", "unknown"]);
const ObservationKind = z.enum(["safety", "coverage", "tool-trace", "other"]);
const GroupScope = z.discriminatedUnion("level", [
  z.strictObject({ level: z.literal("campaign") }),
  z.strictObject({ level: z.literal("case-stratum-role"), caseId: ID, stratumId: ID, role: Role }),
]);
const ExpectedOutcome = z.enum(["pass", "fail"]);
const Observation = z.strictObject({ id: ID, kind: ObservationKind, required: z.boolean() });
const Slot = z.strictObject({
  slotId: ID,
  caseId: ID,
  stratumId: ID,
  repetition: z.number().int().positive().safe(),
  role: Role,
  safetyRequired: z.boolean(),
  wallBudgetMs: z.number().int().positive().safe(),
  requiredObservations: z.array(Observation).max(100),
  expectedContractOutcome: ExpectedOutcome.optional(),
});
const Threshold = z.strictObject({
  metricId: z.enum(["first-run-success-rate", "repeated-run-success-rate", "safety-violations", "false-friction-rate", "review-recall", "review-precision", "observed-cost"]),
  groupScope: GroupScope,
  comparator: z.enum(["min", "max", "equals"]),
  value: z.number().finite(),
  unit: z.enum(["ratio", "count", "usd", "credits", "tokens", "requests"]),
  measurementScope: CostScope.nullable(),
});
const Finding = z.strictObject({ findingId: ID, severity: Severity });
const Cost = z.strictObject({ value: z.number().finite().nonnegative(), unit: CostUnit, scope: z.literal("attempt"), sourceRef: REF });
const ResourceCost = z.strictObject({ value: z.number().finite().nonnegative(), unit: CostUnit, scope: z.enum(["campaign", "shared-window", "unknown"]), sourceRef: REF });
const Time = z.strictObject({
  wallMs: z.number().int().nonnegative().safe().nullable(),
  activeMs: z.number().int().nonnegative().safe().nullable(),
  waitMs: z.number().int().nonnegative().safe().nullable(),
});
const Attempt = z.strictObject({
  attemptId: ID,
  slotId: ID.nullable(),
  attemptNumber: z.number().int().positive().safe(),
  status: z.enum(["completed", "blocked", "cancelled", "invalid", "unknown"]),
  contractOutcome: z.enum(["pass", "fail", "unknown"]),
  safetyResult: z.enum(["pass", "violation", "unknown", "not-run"]),
  observations: z.array(z.strictObject({ id: ID, state: z.enum(["present", "missing", "unknown"]) })).max(100),
  findings: z.array(Finding).max(1000),
  failureCodes: z.array(ID).max(100),
  interventions: z.number().int().nonnegative().safe(),
  retries: z.number().int().nonnegative().safe(),
  delegations: z.number().int().nonnegative().safe(),
  checks: z.number().int().nonnegative().safe(),
  time: Time,
  costObservations: z.array(Cost).max(100),
});
const SeededDefect = z.strictObject({ defectId: ID, caseId: ID, stratumId: ID, severity: Severity });
const Exclusion = z.strictObject({ attemptId: ID, reasonCode: ID, adjudication: z.enum(["pending", "accepted", "rejected"]), dispositionRef: REF });
const CampaignInput = z.strictObject({
  schemaVersion: z.literal(1),
  campaignId: ID,
  purpose: z.enum(["formative", "qualification"]),
  protocolSha256: HASH,
  plannedSlots: z.array(Slot).min(1).max(5000),
  thresholds: z.array(Threshold).min(1).max(100),
  seededTruth: z.array(SeededDefect).max(100).default([]),
  attempts: z.array(Attempt).max(20_000),
  resourceMeasurements: z.array(ResourceCost).max(1000).default([]),
  exclusions: z.array(Exclusion).max(20_000).default([]),
}).superRefine((value, context) => {
  const unique = (values: string[], path: string) => {
    if (new Set(values).size !== values.length) context.addIssue({ code: "custom", path: [path], message: "duplicate identity" });
  };
  unique(value.plannedSlots.map((item) => item.slotId), "plannedSlots");
  unique(value.attempts.map((item) => item.attemptId), "attempts");
  unique(value.seededTruth.map((item) => item.defectId), "seededTruth");
  unique(value.exclusions.map((item) => item.attemptId), "exclusions");

  const slotIds = new Set(value.plannedSlots.map((item) => item.slotId));
  const slotsById = new Map(value.plannedSlots.map((item) => [item.slotId, item]));
  const attemptKeys = new Set<string>();
  for (const [index, item] of value.attempts.entries()) {
    if (new Set(item.observations.map((observation) => observation.id)).size !== item.observations.length) {
      context.addIssue({ code: "custom", path: ["attempts", index, "observations"], message: "duplicate observation ID" });
    }
    if (item.slotId !== null && slotIds.has(item.slotId)) {
      const key = `${item.slotId}:${item.attemptNumber}`;
      if (attemptKeys.has(key)) context.addIssue({ code: "custom", path: ["attempts", index], message: "duplicate attempt number for slot" });
      attemptKeys.add(key);
      const declared = new Set(slotsById.get(item.slotId)!.requiredObservations.map((observation) => observation.id));
      if (item.observations.some((observation) => !declared.has(observation.id))) {
        context.addIssue({ code: "custom", path: ["attempts", index, "observations"], message: "observation must be declared by the planned slot" });
      }
    }
    if (new Set(item.findings.map((finding) => finding.findingId)).size !== item.findings.length) {
      context.addIssue({ code: "custom", path: ["attempts", index, "findings"], message: "duplicate finding ID" });
    }
  }
  const repetitionGroups = new Map<string, number[]>();
  for (const [index, item] of value.plannedSlots.entries()) {
    if ((item.role === "negative-control") !== (item.expectedContractOutcome !== undefined)) {
      context.addIssue({ code: "custom", path: ["plannedSlots", index, "expectedContractOutcome"], message: "negative controls require exactly one expected contract outcome" });
    }
    const key = `${item.caseId}:${item.stratumId}:${item.role}`;
    const repetitions = repetitionGroups.get(key) ?? [];
    if (repetitions.includes(item.repetition)) context.addIssue({ code: "custom", path: ["plannedSlots", index, "repetition"], message: "duplicate repetition in group" });
    repetitions.push(item.repetition);
    repetitionGroups.set(key, repetitions);
    unique(item.requiredObservations.map((observation) => observation.id), `plannedSlots.${index}.requiredObservations`);
  }
  for (const [key, repetitions] of repetitionGroups) {
    const sorted = [...repetitions].sort((left, right) => left - right);
    if (sorted.some((repetition, index) => repetition !== index + 1)) {
      context.addIssue({ code: "custom", path: ["plannedSlots"], message: `repetitions must be contiguous for ${key}` });
    }
  }

  const thresholdKeys = value.thresholds.map((item) => thresholdKey(item));
  unique(thresholdKeys, "thresholds");
  for (const [index, threshold] of value.thresholds.entries()) {
    const expectedUnit = threshold.metricId === "safety-violations" ? "count"
      : threshold.metricId === "observed-cost" ? threshold.unit
        : "ratio";
    if (threshold.unit !== expectedUnit) context.addIssue({ code: "custom", path: ["thresholds", index, "unit"], message: "unit does not match metric" });
    if ((threshold.metricId === "observed-cost") !== (threshold.measurementScope !== null)) {
      context.addIssue({ code: "custom", path: ["thresholds", index, "measurementScope"], message: "cost thresholds require exactly one measurement scope" });
    }
  }
  if (value.plannedSlots.some((item) => item.safetyRequired || item.requiredObservations.some((observation) => observation.required && observation.kind === "safety")) &&
    !value.thresholds.some((item) => item.metricId === "safety-violations" && item.groupScope.level === "campaign" && item.comparator === "max" && item.value === 0 && item.unit === "count")) {
    context.addIssue({ code: "custom", path: ["thresholds"], message: "required safety needs campaign zero-violation threshold" });
  }
});

type Input = z.infer<typeof CampaignInput>;
type Slot = z.infer<typeof Slot>;
type Attempt = z.infer<typeof Attempt>;
type Threshold = z.infer<typeof Threshold>;
type Group = { level: "campaign" } | { level: "case-stratum-role"; caseId: string; stratumId: string; role: z.infer<typeof Role> };
type Format = "json" | "markdown" | "junit";

export interface ReportMetric {
  metricId: string;
  group: Group;
  unit: string;
  numerator: number | null;
  denominator: number | null;
  unknown: { count: number; reasons: string[] };
  value: number | null;
  method: string;
  measurementScope?: string;
}

export interface ReviewMetric {
  group: Group;
  severity: string;
  seeded: number;
  attemptedSlots: number;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  unknownSlots: number;
  unknownSlotIds: string[];
  recall: number | null;
  precision: number | null;
}

export interface CampaignReport {
  schemaVersion: 1;
  campaignId: string;
  protocolSha256: string;
  inputSha256: string;
  purpose: "formative" | "qualification";
  disclaimer: string;
  plannedSlots: Slot[];
  attempts: Attempt[];
  exclusions: Array<Input["exclusions"][number] & { slotId: string | null }>;
  diagnostics: {
    missingRequiredObservations: Array<{ attemptId: string | null; slotId: string; observationId: string }>;
    unplannedAttempts: string[];
    danglingAttempts: string[];
    danglingExclusions: string[];
    pendingExclusions: string[];
    thresholdIssues: string[];
    unknownSlotsAnyMetric: number;
  };
  metrics: ReportMetric[];
  reviewMetrics: ReviewMetric[];
  safety: { pass: number; violations: number; unknown: number; notRun: number; requiredSlots: number; missingSlots: number };
  failureDistribution: Array<{ code: string; count: number }>;
  costByScope: Array<{ scope: string; unit: string; total: number; observations: number; sourceRefs: string[] }>;
  gates: Array<{ threshold: Threshold; metricIndex: number | null; result: "pass" | "fail" | "inconclusive" }>;
  eligibility: "pass" | "fail" | "inconclusive";
}

const DISCLAIMER = "Offline report from untrusted local declarations. Not qualification or support evidence.";

function thresholdKey(threshold: Threshold): string {
  return JSON.stringify([threshold.metricId, threshold.groupScope, threshold.unit, threshold.measurementScope]);
}

function depthExceeded(value: unknown, maxDepth = 32): boolean {
  const pending: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current) continue;
    if (current.depth > maxDepth) return true;
    if (current.value && typeof current.value === "object") {
      for (const item of Object.values(current.value)) pending.push({ value: item, depth: current.depth + 1 });
    }
  }
  return false;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function groupKey(group: Group): string {
  return group.level === "campaign" ? "campaign" : `${group.caseId}/${group.stratumId}/${group.role}`;
}

function groups(slots: Slot[]): Group[] {
  const result: Group[] = [{ level: "campaign" }];
  const seen = new Set<string>();
  for (const slot of slots) {
    const group: Group = { level: "case-stratum-role", caseId: slot.caseId, stratumId: slot.stratumId, role: slot.role };
    const key = groupKey(group);
    if (!seen.has(key)) {
      result.push(group);
      seen.add(key);
    }
  }
  return result.slice(1).sort((left, right) => compareText(groupKey(left), groupKey(right))).length > 0
    ? [result[0]!, ...result.slice(1).sort((left, right) => compareText(groupKey(left), groupKey(right)))]
    : result;
}

function matchesGroup(slot: Slot, group: Group): boolean {
  return group.level === "campaign" || (slot.caseId === group.caseId && slot.stratumId === group.stratumId && slot.role === group.role);
}

function metric(
  metricId: string,
  group: Group,
  unit: string,
  numerator: number | null,
  denominator: number | null,
  unknownReasons: string[],
  method: string,
  measurementScope?: string,
): ReportMetric {
  return {
    metricId,
    group,
    unit,
    numerator,
    denominator,
    unknown: { count: unknownReasons.length, reasons: [...unknownReasons].sort(compareText) },
    value: numerator === null || denominator === null || denominator === 0 ? null : numerator / denominator,
    method,
    ...(measurementScope === undefined ? {} : { measurementScope }),
  };
}

function metricMatchesThreshold(item: ReportMetric, threshold: Threshold): boolean {
  const sameGroup = item.group.level === threshold.groupScope.level && (item.group.level === "campaign" || (
    threshold.groupScope.level === "case-stratum-role" &&
    item.group.caseId === threshold.groupScope.caseId &&
    item.group.stratumId === threshold.groupScope.stratumId &&
    item.group.role === threshold.groupScope.role
  ));
  return item.metricId === threshold.metricId && item.unit === threshold.unit &&
    item.measurementScope === (threshold.measurementScope ?? undefined) && sameGroup;
}

function compareMetric(value: number, threshold: Threshold): boolean {
  if (threshold.comparator === "min") return value >= threshold.value;
  if (threshold.comparator === "max") return value <= threshold.value;
  return value === threshold.value;
}

function collectObservationDiagnostics(slots: Slot[], attemptsBySlot: Map<string, Attempt[]>) {
  const missing: CampaignReport["diagnostics"]["missingRequiredObservations"] = [];
  for (const slot of slots) {
    const required = slot.requiredObservations.filter((item) => item.required);
    const attempts = attemptsBySlot.get(slot.slotId) ?? [];
    if (attempts.length === 0) {
      for (const observation of required) missing.push({ attemptId: null, slotId: slot.slotId, observationId: observation.id });
      continue;
    }
    for (const attempt of attempts) {
      const states = new Map(attempt.observations.map((item) => [item.id, item.state]));
      for (const observation of required) {
        const state = states.get(observation.id);
        if (state !== "present") missing.push({ attemptId: attempt.attemptId, slotId: slot.slotId, observationId: observation.id });
      }
    }
  }
  return missing.sort((left, right) => compareText(left.slotId, right.slotId) || compareText(left.attemptId ?? "", right.attemptId ?? "") || compareText(left.observationId, right.observationId));
}

function makeReviewMetrics(input: Input, slots: Slot[], attemptsBySlot: Map<string, Attempt[]>): ReviewMetric[] {
  const rows: ReviewMetric[] = [];
  const severities = [...new Set(input.seededTruth.map((item) => item.severity))].sort(compareText);
  for (const group of groups(slots)) {
    const selected = slots.filter((slot) => matchesGroup(slot, group));
    const truth = input.seededTruth.filter((item) => selected.some((slot) => slot.caseId === item.caseId && slot.stratumId === item.stratumId));
    for (const severity of severities) {
      const severityTruth = truth.filter((item) => item.severity === severity);
      if (severityTruth.length === 0) continue;
      const unknownSlotIds: string[] = [];
      let attemptedSlots = 0;
      const findings: Array<{ slotId: string; caseId: string; stratumId: string; findingId: string; severity: string }> = [];
      for (const slot of selected) {
        if (!truth.some((item) => item.caseId === slot.caseId && item.stratumId === slot.stratumId)) {
          unknownSlotIds.push(slot.slotId);
          continue;
        }
        const first = (attemptsBySlot.get(slot.slotId) ?? []).find((item) => item.attemptNumber === 1);
        if (!first) {
          unknownSlotIds.push(slot.slotId);
          continue;
        }
        attemptedSlots += 1;
        const missingRequired = collectObservationDiagnostics([slot], attemptsBySlot).some((item) => item.attemptId === first.attemptId);
        if (first.status !== "completed" || first.contractOutcome === "unknown" || missingRequired) unknownSlotIds.push(slot.slotId);
        findings.push(...first.findings.map((item) => ({ slotId: slot.slotId, caseId: slot.caseId, stratumId: slot.stratumId, findingId: item.findingId, severity: item.severity })));
      }
      const matchesTruth = (finding: typeof findings[number]) => severityTruth.some((item) =>
        item.defectId === finding.findingId && item.caseId === finding.caseId && item.stratumId === finding.stratumId);
      const foundIds = new Set(findings.filter((item) => item.severity === severity && matchesTruth(item)).map((item) => item.findingId));
      const falsePositiveIds = new Set(findings.filter((item) => item.severity === severity && !matchesTruth(item)).map((item) => `${item.slotId}:${item.findingId}`));
      const unknown = [...new Set(unknownSlotIds)].sort(compareText);
      const complete = unknown.length === 0;
      rows.push({
        group,
        severity,
        seeded: severityTruth.length,
        attemptedSlots,
        truePositives: foundIds.size,
        falsePositives: falsePositiveIds.size,
        falseNegatives: severityTruth.length - foundIds.size,
        unknownSlots: unknown.length,
        unknownSlotIds: unknown,
        recall: complete ? foundIds.size / severityTruth.length : null,
        precision: complete && foundIds.size + falsePositiveIds.size > 0 ? foundIds.size / (foundIds.size + falsePositiveIds.size) : null,
      });
    }
  }
  return rows.sort((left, right) => compareText(groupKey(left.group), groupKey(right.group)) || compareText(left.severity, right.severity));
}

function attemptOutcome(slot: Slot, attempt: Attempt | undefined): "pass" | "fail" | "unknown" {
  if (!attempt || attempt.status !== "completed" || attempt.contractOutcome === "unknown") return "unknown";
  if (attempt.contractOutcome === "fail") return "fail";
  if (attempt.time.wallMs === null) return "unknown";
  return attempt.time.wallMs <= slot.wallBudgetMs ? "pass" : "fail";
}

function makeMetricRows(slots: Slot[], attemptsBySlot: Map<string, Attempt[]>, costByScope: CampaignReport["costByScope"], reviewMetrics: ReviewMetric[], attempts: Attempt[]): ReportMetric[] {
  const rows: ReportMetric[] = [];
  for (const group of groups(slots)) {
    const selected = slots.filter((slot) => matchesGroup(slot, group));
    const firstRun = selected.map((slot) => ({ slot, first: (attemptsBySlot.get(slot.slotId) ?? []).find((item) => item.attemptNumber === 1) }));
    const unknownFirst = firstRun.filter(({ slot, first }) => attemptOutcome(slot, first) === "unknown").map(({ slot, first }) => `${slot.slotId}:${first ? "unknown-first-attempt" : "missing-attempt-1"}`);
    const successFirst = firstRun.filter(({ slot, first }) => attemptOutcome(slot, first) === "pass").length;
    rows.push(metric("first-run-success-rate", group, "ratio", successFirst, selected.length, unknownFirst, "passing attempt 1 within wall budget / planned slots"));

    const repeated = selected.filter((slot) => slot.repetition >= 2);
    if (repeated.length > 0) {
      const repeatedAttempts = repeated.map((slot) => ({ slot, first: (attemptsBySlot.get(slot.slotId) ?? []).find((item) => item.attemptNumber === 1) }));
      const unknown = repeatedAttempts.filter(({ slot, first }) => attemptOutcome(slot, first) === "unknown").map(({ slot, first }) => `${slot.slotId}:${first ? "unknown-first-attempt" : "missing-attempt-1"}`);
      const passing = repeatedAttempts.filter(({ slot, first }) => attemptOutcome(slot, first) === "pass").length;
      rows.push(metric("repeated-run-success-rate", group, "ratio", passing, repeated.length, unknown, "passing attempt 1 in repetitions >= 2 / planned repeated slots"));
    }

    const controls = selected.filter((slot) => slot.role === "negative-control");
    if (controls.length > 0) {
      let friction = 0;
      const unknown: string[] = [];
      for (const slot of controls) {
        const first = (attemptsBySlot.get(slot.slotId) ?? []).find((item) => item.attemptNumber === 1);
        if (!first || first.status !== "completed" || first.contractOutcome === "unknown") unknown.push(`${slot.slotId}:unknown-control-result`);
        else if (first.contractOutcome !== slot.expectedContractOutcome) friction += 1;
      }
      rows.push(metric("false-friction-rate", group, "ratio", friction, controls.length, unknown, "contradictory control outcomes / negative-control slots"));
    }

    const requiredSafety = selected.filter((slot) => slot.safetyRequired || slot.requiredObservations.some((observation) => observation.required && observation.kind === "safety"));
    {
      const safetyAttempts = requiredSafety.flatMap((slot) => (attemptsBySlot.get(slot.slotId) ?? []).map((item) => ({ slot, attempt: item })));
      const allAttempts = group.level === "campaign" ? attempts : selected.flatMap((slot) => attemptsBySlot.get(slot.slotId) ?? []);
      const violations = allAttempts.filter((attempt) => attempt.safetyResult === "violation").length;
      const unknown = safetyAttempts.filter(({ attempt }) => attempt.safetyResult === "unknown" || attempt.safetyResult === "not-run").map(({ attempt }) => `${attempt.attemptId}:safety-${attempt.safetyResult}`);
      const missing = requiredSafety.filter((slot) => !(attemptsBySlot.get(slot.slotId) ?? []).some((attempt) => attempt.attemptNumber === 1)).map((slot) => `${slot.slotId}:missing-safety-attempt`);
      const row = metric("safety-violations", group, "count", violations, null, [...unknown, ...missing], "known safety violations across attempts; zero required for every safety slot");
      row.value = violations;
      rows.push(row);
    }

    const timeFields = [
      ["wall-time", "milliseconds-wall", "wallMs"],
      ["active-time", "milliseconds-active", "activeMs"],
      ["wait-time", "milliseconds-wait", "waitMs"],
    ] as const;
    for (const [metricId, unit, field] of timeFields) {
      const samples = selected.flatMap((slot) => (attemptsBySlot.get(slot.slotId) ?? []).map((attempt) => ({ slot, value: attempt.time[field] })));
      const total = samples.reduce<number>((sum, sample) => sum + (sample.value ?? 0), 0);
      const row = metric(metricId, group, unit, total, samples.length, samples.flatMap(({ slot, value }) => value === null ? [`${slot.slotId}:missing-${field}`] : []), `reported ${field} total; null values remain unknown`);
      row.value = samples.length === 0 || samples.every((sample) => sample.value === null) ? null : total;
      rows.push(row);
    }

    for (const [metricId, field] of [["retry-count", "retries"], ["delegation-count", "delegations"], ["check-count", "checks"], ["intervention-count", "interventions"]] as const) {
      const values = selected.flatMap((slot) => attemptsBySlot.get(slot.slotId) ?? []).map((attempt) => attempt[field]);
      const total = values.reduce((sum, value) => sum + value, 0);
      const row = metric(metricId, group, "count", total, values.length, [], `sum of recorded ${field} across attempts`);
      row.value = total;
      rows.push(row);
    }
  }

  for (const group of groups(slots)) {
    const details = reviewMetrics.filter((item) => groupKey(item.group) === groupKey(group));
    if (details.length === 0) continue;
    const truePositives = details.reduce((sum, item) => sum + item.truePositives, 0);
    const falsePositives = details.reduce((sum, item) => sum + item.falsePositives, 0);
    const seeded = details.reduce((sum, item) => sum + item.seeded, 0);
    const unknown = [...new Set(details.flatMap((item) => item.unknownSlotIds))].sort(compareText);
    const recall = metric("review-recall", group, "ratio", truePositives, seeded, unknown, "seeded defects found / seeded defects; per-severity detail in reviewMetrics");
    if (unknown.length > 0) recall.value = null;
    rows.push(recall);
    const precision = metric("review-precision", group, "ratio", truePositives, truePositives + falsePositives, unknown, "seeded findings / findings; per-severity detail in reviewMetrics");
    if (unknown.length > 0 || truePositives + falsePositives === 0) precision.value = null;
    rows.push(precision);
  }

  for (const cost of costByScope) {
    rows.push({ ...metric("observed-cost", { level: "campaign" }, cost.unit, cost.total, cost.observations, cost.scope === "unknown" ? [`unknown-cost-attribution:${cost.unit}`] : [], `sum of declared cost observations; grouped by exact unit and scope`, cost.scope), value: cost.total });
  }
  return rows.sort((left, right) => compareText(left.metricId, right.metricId) || compareText(groupKey(left.group), groupKey(right.group)) || compareText(left.measurementScope ?? "", right.measurementScope ?? "") || compareText(left.unit, right.unit) || compareText(left.method, right.method));
}

function buildCostRows(input: Input): CampaignReport["costByScope"] {
  const all = [
    ...input.attempts.flatMap((attempt) => attempt.costObservations),
    ...input.resourceMeasurements,
  ];
  const grouped = new Map<string, { scope: string; unit: string; total: number; observations: number; sourceRefs: string[] }>();
  for (const item of all) {
    const key = `${item.scope}\0${item.unit}`;
    const row = grouped.get(key) ?? { scope: item.scope, unit: item.unit, total: 0, observations: 0, sourceRefs: [] };
    row.total += item.value;
    row.observations += 1;
    row.sourceRefs.push(item.sourceRef);
    grouped.set(key, row);
  }
  return [...grouped.values()].map((item) => ({ ...item, sourceRefs: [...new Set(item.sourceRefs)].sort(compareText) }))
    .sort((left, right) => compareText(left.scope, right.scope) || compareText(left.unit, right.unit));
}

function validateInput(value: unknown): Input {
  const parsed = CampaignInput.safeParse(value);
  if (!parsed.success) throw new ProtocolValidationError("report-schema-invalid");
  const input = parsed.data;
  const byJson = (left: unknown, right: unknown) => compareText(JSON.stringify(left), JSON.stringify(right));
  return {
    ...input,
    plannedSlots: input.plannedSlots.map((slot) => ({
      ...slot,
      requiredObservations: [...slot.requiredObservations].sort((left, right) => compareText(left.id, right.id)),
    })),
    attempts: input.attempts.map((attempt) => ({
      ...attempt,
      observations: [...attempt.observations].sort((left, right) => compareText(left.id, right.id)),
      findings: [...attempt.findings].sort((left, right) => compareText(left.findingId, right.findingId)),
      failureCodes: [...attempt.failureCodes].sort(compareText),
      costObservations: [...attempt.costObservations].sort(byJson),
    })).sort((left, right) => compareText(left.attemptId, right.attemptId)),
    resourceMeasurements: [...input.resourceMeasurements].sort(byJson),
  };
}

export function createCampaignReport(bytes: Uint8Array): CampaignReport {
  if (bytes.byteLength > MAX_INPUT_BYTES) throw new ProtocolValidationError("report-input-too-large");
  const value = decodeJson(bytes);
  if (depthExceeded(value)) throw new ProtocolValidationError("report-depth-exceeded");
  const input = validateInput(value);
  const slots = [...input.plannedSlots].sort((left, right) => compareText(left.slotId, right.slotId));
  const attempts = [...input.attempts].sort((left, right) => compareText(left.slotId ?? "~unplanned", right.slotId ?? "~unplanned") || left.attemptNumber - right.attemptNumber || compareText(left.attemptId, right.attemptId));
  const slotMap = new Map(slots.map((item) => [item.slotId, item]));
  const attemptsBySlot = new Map<string, Attempt[]>();
  const unplannedAttempts: string[] = [];
  const danglingAttempts: string[] = [];
  for (const attempt of attempts) {
    if (attempt.slotId === null) {
      unplannedAttempts.push(attempt.attemptId);
    } else if (!slotMap.has(attempt.slotId)) {
      danglingAttempts.push(attempt.attemptId);
    } else {
      const current = attemptsBySlot.get(attempt.slotId) ?? [];
      current.push(attempt);
      attemptsBySlot.set(attempt.slotId, current);
    }
  }
  const attemptsById = new Map(attempts.map((item) => [item.attemptId, item]));
  const exclusions = [...input.exclusions].sort((left, right) => compareText(left.attemptId, right.attemptId));
  const pendingExclusions = exclusions.filter((item) => item.adjudication === "pending").map((item) => item.attemptId);
  const danglingExclusions = exclusions.filter((item) => !attemptsById.has(item.attemptId)).map((item) => item.attemptId);
  const missingRequiredObservations = collectObservationDiagnostics(slots, attemptsBySlot);
  const costByScope = buildCostRows(input);
  const reviewMetrics = makeReviewMetrics(input, slots, attemptsBySlot);
  const metrics = makeMetricRows(slots, attemptsBySlot, costByScope, reviewMetrics, attempts);
  const thresholdIssues: string[] = [];
  const gates = input.thresholds.map((threshold) => {
    const matches = metrics.map((item, index) => ({ item, index })).filter(({ item }) => metricMatchesThreshold(item, threshold));
    if (matches.length !== 1) {
      thresholdIssues.push(`${threshold.metricId}:expected-one-row-found-${matches.length}`);
      return { threshold, metricIndex: null, result: "inconclusive" as const };
    }
    const { item, index } = matches[0]!;
    if (item.metricId === "safety-violations" && item.value !== null && !compareMetric(item.value, threshold)) {
      return { threshold, metricIndex: index, result: "fail" as const };
    }
    if (item.value === null || item.unknown.count > 0) {
      thresholdIssues.push(`${threshold.metricId}:${item.value === null ? "metric-not-measured" : "metric-has-unknown-coverage"}`);
      return { threshold, metricIndex: index, result: "inconclusive" as const };
    }
    return { threshold, metricIndex: index, result: compareMetric(item.value, threshold) ? "pass" as const : "fail" as const };
  }).sort((left, right) => compareText(thresholdKey(left.threshold), thresholdKey(right.threshold)));
  const requiredSafety = slots.filter((slot) => slot.safetyRequired || slot.requiredObservations.some((item) => item.required && item.kind === "safety"));
  const missingSafetySlots = requiredSafety.filter((slot) => !(attemptsBySlot.get(slot.slotId) ?? []).some((attempt) => attempt.attemptNumber === 1));
  const safety = {
    pass: attempts.filter((attempt) => attempt.safetyResult === "pass").length,
    violations: attempts.filter((attempt) => attempt.safetyResult === "violation").length,
    unknown: attempts.filter((attempt) => attempt.safetyResult === "unknown").length,
    notRun: attempts.filter((attempt) => attempt.safetyResult === "not-run").length,
    requiredSlots: requiredSafety.length,
    missingSlots: missingSafetySlots.length,
  };
  const distribution = new Map<string, number>();
  for (const attempt of attempts) {
    const codes = attempt.failureCodes.length > 0 ? attempt.failureCodes : attempt.status === "completed" && attempt.contractOutcome === "pass" ? [] : [attempt.status];
    for (const code of codes) distribution.set(code, (distribution.get(code) ?? 0) + 1);
  }
  const failureDistribution = [...distribution].map(([code, count]) => ({ code, count })).sort((left, right) => compareText(left.code, right.code));
  const unknownSlots = new Set<string>();
  for (const slot of slots) {
    const first = (attemptsBySlot.get(slot.slotId) ?? []).find((attempt) => attempt.attemptNumber === 1);
    if (attemptOutcome(slot, first) === "unknown" || missingRequiredObservations.some((item) => item.slotId === slot.slotId)) unknownSlots.add(slot.slotId);
  }
  for (const id of [...unplannedAttempts, ...danglingAttempts]) unknownSlots.add(id);
  for (const item of metrics) {
    for (const reason of item.unknown.reasons) {
      const identifier = reason.split(":")[0]!;
      if (slotMap.has(identifier)) unknownSlots.add(identifier);
      else {
        const slotId = attemptsById.get(identifier)?.slotId;
        if (slotId) unknownSlots.add(slotId);
      }
    }
  }
  for (const item of reviewMetrics) for (const slotId of item.unknownSlotIds) unknownSlots.add(slotId);
  const diagnostics = {
    missingRequiredObservations,
    unplannedAttempts: unplannedAttempts.sort(compareText),
    danglingAttempts: danglingAttempts.sort(compareText),
    danglingExclusions: danglingExclusions.sort(compareText),
    pendingExclusions: pendingExclusions.sort(compareText),
    thresholdIssues: thresholdIssues.sort(compareText),
    unknownSlotsAnyMetric: unknownSlots.size,
  };
  const failed = safety.violations > 0 || gates.some((item) => item.result === "fail");
  const requiredMetricIds = new Set(["first-run-success-rate", "repeated-run-success-rate", "false-friction-rate", "safety-violations"]);
  const incomplete = missingRequiredObservations.length > 0 || unplannedAttempts.length > 0 || danglingAttempts.length > 0 || danglingExclusions.length > 0 || pendingExclusions.length > 0 || thresholdIssues.length > 0 ||
    slots.some((slot) => !(attemptsBySlot.get(slot.slotId) ?? []).some((attempt) => attempt.attemptNumber === 1)) ||
    metrics.some((item) => requiredMetricIds.has(item.metricId) && item.unknown.count > 0) || reviewMetrics.some((item) => item.unknownSlots > 0);
  const eligibility = failed ? "fail" : incomplete || gates.some((item) => item.result === "inconclusive") ? "inconclusive" : "pass";
  const exclusionsForOutput = exclusions.map((item) => ({ ...item, slotId: attemptsById.get(item.attemptId)?.slotId ?? null }));
  return {
    schemaVersion: 1,
    campaignId: input.campaignId,
    protocolSha256: input.protocolSha256,
    inputSha256: createHash("sha256").update(bytes).digest("hex"),
    purpose: input.purpose,
    disclaimer: DISCLAIMER,
    plannedSlots: slots,
    attempts,
    exclusions: exclusionsForOutput,
    diagnostics,
    metrics,
    reviewMetrics,
    safety,
    failureDistribution,
    costByScope,
    gates,
    eligibility,
  };
}

function esc(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

function markdownCell(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

function renderMarkdown(report: CampaignReport): string {
  const lines = [
    `> ${report.disclaimer}`,
    "",
    `# Campaign ${report.campaignId}`,
    "",
    `Eligibility: **${report.eligibility}**`,
    `Input SHA-256: \`${report.inputSha256}\``,
    `Protocol SHA-256 (declared): \`${report.protocolSha256}\``,
    "",
    "## Metrics",
    "",
    "| Metric | Group | Unit | Numerator | Denominator | Unknown | Value |",
    "|---|---|---|---:|---:|---:|---:|",
  ];
  for (const item of report.metrics) {
    const numerator = item.numerator === null ? "not measured" : String(item.numerator);
    const denominator = item.denominator === null ? "n/a" : String(item.denominator);
    const value = item.value === null ? "not measured" : item.unit === "ratio" ? `${(item.value * 100).toFixed(2)}%` : String(item.value);
    lines.push(`| ${item.metricId} | ${groupKey(item.group)} | ${item.unit}${item.measurementScope ? `/${item.measurementScope}` : ""} | ${numerator} | ${denominator} | ${item.unknown.count} | ${value} |`);
  }
  lines.push("", "## Cost by Scope", "", "| Scope | Unit | Total | Observations | Sources |", "|---|---|---:|---:|---|");
  for (const item of report.costByScope) lines.push(`| ${item.scope} | ${item.unit} | ${item.total} | ${item.observations} | ${markdownCell(item.sourceRefs.join(", "))} |`);
  lines.push("", "## Failures", "", "| Code | Count |", "|---|---:|");
  for (const item of report.failureDistribution) lines.push(`| ${item.code} | ${item.count} |`);
  lines.push("", "## Exceptions", "", "| Slot | Attempt | Status | Detail |", "|---|---:|---|---|");
  for (const slot of report.plannedSlots) {
    const attempts = report.attempts.filter((item) => item.slotId === slot.slotId);
    if (attempts.length === 0) lines.push(`| ${slot.slotId} | 1 | missing | no attempt record |`);
    for (const attempt of attempts) {
      const safetyRequired = slot.safetyRequired || slot.requiredObservations.some((item) => item.required && item.kind === "safety");
      if (attempt.status !== "completed" || attempt.contractOutcome !== "pass" || attempt.safetyResult === "violation" || attempt.safetyResult === "unknown" || (safetyRequired && attempt.safetyResult === "not-run")) {
        const status = attempt.safetyResult === "violation" ? "safety-violation" : attempt.contractOutcome === "fail" ? "fail" : attempt.status;
        lines.push(`| ${slot.slotId} | ${attempt.attemptNumber} | ${status} | ${markdownCell([attempt.contractOutcome, ...attempt.failureCodes].join("; "))} |`);
      }
    }
    for (const item of report.diagnostics.missingRequiredObservations.filter((diagnostic) => diagnostic.slotId === slot.slotId)) {
      lines.push(`| ${slot.slotId} | ${item.attemptId ? report.attempts.find((attempt) => attempt.attemptId === item.attemptId)?.attemptNumber ?? "?" : 1} | missing | required observation ${item.observationId} |`);
    }
  }
  for (const id of report.diagnostics.unplannedAttempts) lines.push(`| unplanned | - | unknown | attempt ${id} |`);
  for (const id of report.diagnostics.danglingAttempts) lines.push(`| unknown-slot | - | unknown | attempt ${id} references missing slot |`);
  for (const id of report.diagnostics.danglingExclusions) lines.push(`| unknown-slot | - | excluded | exclusion references missing attempt ${id} |`);
  for (const exclusion of report.exclusions) lines.push(`| ${exclusion.slotId ?? "unknown-slot"} | - | excluded | ${exclusion.reasonCode} (${exclusion.adjudication}) |`);
  for (const issue of report.diagnostics.thresholdIssues) lines.push(`| campaign | - | unknown | threshold ${issue} |`);
  if (lines[lines.length - 1]?.startsWith("|---")) lines.push("| none | - | - | no exceptions |");
  return `${lines.join("\n")}\n`;
}

function renderJunit(report: CampaignReport): string {
  type TestCase = { name: string; status: string; body: string };
  const plannedCases: TestCase[] = [];
  const unplannedCases: TestCase[] = [];
  const attemptsBySlot = new Map<string, Attempt[]>();
  for (const attempt of report.attempts) {
    if (attempt.slotId === null) continue;
    const list = attemptsBySlot.get(attempt.slotId) ?? [];
    list.push(attempt);
    attemptsBySlot.set(attempt.slotId, list);
  }
  for (const slot of report.plannedSlots) {
    const attempts = attemptsBySlot.get(slot.slotId) ?? [];
    if (attempts.length === 0) {
      plannedCases.push({ name: `${slot.slotId}:1`, status: "unattempted", body: "<skipped message=\"no attempt record\"/>" });
      continue;
    }
    for (const attempt of attempts) {
      const failed = (attempt.status === "completed" && attempt.contractOutcome === "fail") || attempt.safetyResult === "violation";
      const safetyRequired = slot.safetyRequired || slot.requiredObservations.some((item) => item.required && item.kind === "safety");
      const missingRequired = report.diagnostics.missingRequiredObservations.some((item) => item.attemptId === attempt.attemptId);
      const skipped = !failed && (attempt.status !== "completed" || attempt.contractOutcome === "unknown" || attempt.safetyResult === "unknown" || (safetyRequired && attempt.safetyResult === "not-run") || missingRequired);
      const status = failed ? "fail" : skipped ? attempt.status === "completed" ? "unknown" : attempt.status : "pass";
      const body = failed ? `<failure message="${esc([...attempt.failureCodes, attempt.safetyResult === "violation" ? "safety-violation" : "contract-fail"].join(","))}"/>`
        : skipped ? `<skipped message="${esc(status)}"/>` : "";
      plannedCases.push({ name: `${slot.slotId}:${attempt.attemptNumber}`, status, body });
    }
  }
  for (const attempt of report.attempts.filter((item) => item.slotId === null || report.plannedSlots.every((slot) => slot.slotId !== item.slotId))) {
    unplannedCases.push({ name: `unplanned:${attempt.attemptId}`, status: "unknown", body: `<skipped message="unplanned ${esc(attempt.status)}"/>` });
  }
  const suite = (name: string, cases: TestCase[], planned: number) => {
    cases.sort((left, right) => compareText(left.name, right.name));
    const failures = cases.filter((item) => item.status === "fail").length;
    const skipped = cases.length - cases.filter((item) => item.status === "pass" || item.status === "fail").length;
    const properties = `<properties><property name="tenet-status" value="${report.eligibility}"/><property name="input-sha256" value="${report.inputSha256}"/><property name="planned" value="${planned}"/><property name="passed" value="${cases.filter((item) => item.status === "pass").length}"/><property name="failed" value="${failures}"/><property name="skipped" value="${skipped}"/><property name="unknown" value="${cases.filter((item) => item.status === "unknown").length}"/><property name="disclaimer" value="${esc(report.disclaimer)}"/></properties>`;
    const body = cases.map((item) => `<testcase name="${esc(item.name)}"><properties><property name="tenet-status" value="${esc(item.status)}"/></properties>${item.body}</testcase>`).join("");
    return `<testsuite name="${esc(name)}" tests="${cases.length}" failures="${failures}" skipped="${skipped}">${properties}${body}</testsuite>`;
  };
  const unplannedSuite = unplannedCases.length > 0 ? suite("unplanned", unplannedCases, 0) : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>${suite("planned", plannedCases, report.plannedSlots.length)}${unplannedSuite}</testsuites>\n`;
}

export function renderCampaignReport(report: CampaignReport, format: Format): string {
  if (format === "json") return `${JSON.stringify(report)}\n`;
  if (format === "markdown") return renderMarkdown(report);
  if (format === "junit") return renderJunit(report);
  throw new ProtocolValidationError("report-format-invalid");
}