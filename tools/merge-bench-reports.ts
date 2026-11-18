import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIXTURES } from "./bench-fixtures.ts";
import { WARM_RUNS, judgeWarmRuns } from "./bench.ts";
import type { FixtureName } from "./bench-fixtures.ts";
import type { Report, Row, Status, WarmRun } from "./bench.ts";

const fixtureNames = Object.keys(FIXTURES) as FixtureName[];
const measuredIds = ["bookkeeping-warm", "bookkeeping-cold", "tenet-storage", "resume"];
const bundleSha = (report: Report): string => {
  const bundle = report.environment.bundle;
  if (!bundle || typeof bundle !== "object" || !("sha256" in bundle) || typeof bundle.sha256 !== "string")
    throw new Error("benchmark report is missing its bundle digest");
  return bundle.sha256;
};

export function mergeBenchReports(reports: Report[]): Report {
  if (!reports.length) throw new Error("benchmark merge requires reports");
  const digest = bundleSha(reports[0]!);
  const fixed = reports[0]!.rows.filter((row) => row.fixture === undefined);
  if (!fixed.length) throw new Error("benchmark reports are missing fixed budget rows");
  for (const report of reports) {
    if (bundleSha(report) !== digest) throw new Error("benchmark reports used different bundle digests");
    const currentFixed = report.rows.filter((row) => row.fixture === undefined);
    if (JSON.stringify(currentFixed) !== JSON.stringify(fixed)) throw new Error("benchmark fixed rows differ");
  }
  const rows: Row[] = [...fixed];
  let environmentInvalidRuns = 0;
  const environments: Record<string, unknown>[] = [];
  const trace: string[] = [];

  for (const fixture of fixtureNames) {
    const matching = reports.filter((report) => report.rows.some((row) => row.fixture === fixture));
    if (matching.length !== WARM_RUNS) throw new Error(`${fixture} must have exactly ${WARM_RUNS} benchmark trials`);
    matching.sort((a, b) => (a.trial ?? 0) - (b.trial ?? 0));
    assertTrials(matching, fixture);
    const warmRuns: WarmRun[] = [];
    let representative: Report | undefined;
    for (const report of matching) {
      const warm = onlyRow(report, fixture, "bookkeeping-warm");
      if (report.trial === 1) representative = report;
      if (warm.runs?.length !== 1) throw new Error(`${fixture} trial ${report.trial} must contain one warm run`);
      warmRuns.push(warm.runs[0]!);
      environments.push({ fixture, trial: report.trial, ...report.environment });
      trace.push(`${fixture} trial ${report.trial}: ${report.fsyncTrace}`);
    }
    if (!representative) throw new Error(`${fixture} is missing trial 1`);
    const base = onlyRow(representative, fixture, "bookkeeping-warm");
    const judgment = judgeWarmRuns(warmRuns);
    const combined: Row = {
      ...base, status: judgment.status, observed: judgment.observed, detail: judgment.detail, runs: warmRuns,
      trace: warmRuns.every((run) => run.trace === "off") ? "off" :
        warmRuns.every((run) => run.trace === "ok") ? "ok" : "missing",
    };
    rows.push(combined, ...measuredIds.filter((id) => id !== "bookkeeping-warm").map((id) => onlyRow(representative, fixture, id)));
    environmentInvalidRuns += warmRuns.filter((run) => run.class === "environment-invalid").length;
  }
  const summary = { pass: 0, fail: 0, inconclusive: 0, "not-measurable": 0, unobservable: 0, delegated: 0 } as Record<Status, number>;
  for (const row of rows) summary[row.status]++;
  const exit: Report["exit"] = summary.fail || summary.inconclusive ? 1 : 0;
  return {
    platform: reports[0]!.platform,
    environment: reports[0]!.environment,
    environments,
    rows,
    summary,
    environmentInvalidRuns,
    fsyncTrace: trace.join("; "),
    exit,
  };
}

function assertTrials(reports: Report[], fixture: FixtureName): void {
  const trials = reports.map((report) => report.trial);
  if (trials.some((trial) => !Number.isInteger(trial)) ||
    trials.join(",") !== Array.from({ length: WARM_RUNS }, (_, index) => index + 1).join(","))
    throw new Error(`${fixture} benchmark trials are not 1..${WARM_RUNS} exactly once`);
}

function onlyRow(report: Report, fixture: FixtureName, id: string): Row {
  const matches = report.rows.filter((row) => row.fixture === fixture && row.id === id);
  if (matches.length !== 1) throw new Error(`${fixture} trial ${report.trial} has ${matches.length} ${id} rows`);
  return matches[0]!;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const directory = process.argv[2];
  if (!directory) throw new Error("usage: node tools/merge-bench-reports.ts <report-directory>");
  const files = readdirSync(directory).filter((file) => file.endsWith(".json")).sort();
  const expected = fixtureNames.flatMap((fixture) =>
    Array.from({ length: WARM_RUNS }, (_, index) => `system-budgets-${fixture}-${index + 1}.json`));
  if (JSON.stringify(files) !== JSON.stringify(expected.slice().sort()))
    throw new Error("benchmark report set differs from the fixed fixture/trial population");
  const reports = files.map((file) => JSON.parse(readFileSync(join(directory, file), "utf8")) as Report);
  const merged = mergeBenchReports(reports);
  process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
  if (merged.exit) process.exitCode = merged.exit;
  else console.error(`benchmark merge: ${fixtureNames.length} fixtures x ${WARM_RUNS} trials, bundle ${createHash("sha256").update(JSON.stringify(merged.environment.bundle)).digest("hex")}`);
}
