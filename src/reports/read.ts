import path from "node:path";
import { malformedReport, missingReport } from "./errors.js";
import { readBounded, reportRegistry, type ReportKind } from "./registry.js";
import type { ReportReadOptions } from "./read-types.js";
import type { TestCase, TestReport, TestStatus } from "./types.js";

const statusRank: Record<TestStatus, number> = { pass: 0, skip: 1, fail: 2, error: 3 };

export function readReport(
  kind: string,
  reportPath: string | string[],
  options: ReportReadOptions = {},
): TestReport {
  const prefix = options.prefix ?? "R";
  if (kind === "none") {
    return { runner: "none", cases: [], teardown_failed: false, inconclusive: true };
  }
  const paths = Array.isArray(reportPath) ? reportPath : [reportPath];
  const display = paths.map((filename) => formatReportPath(filename, options.cwd));
  const all = display.length ? display.join(", ") : "[]";
  if (!Object.hasOwn(reportRegistry, kind)) throw malformedReport(all, kind);
  if (paths.length === 0) throw missingReport(all);

  const reports: TestReport[] = paths.map((filename, index) => {
    const shown = display[index] ?? filename;
    if (!filename) throw missingReport(shown);
    const resolved = path.resolve(options.cwd ?? process.cwd(), filename);
    let contents: string;
    try {
      contents = readBounded(resolved);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT" || code === "ENOTDIR") throw missingReport(shown);
      throw malformedReport(shown, kind);
    }
    try {
      const parsed = reportRegistry[kind as ReportKind](contents, { ...options, prefix });
      if (parsed.cases.length > 20_000) throw new Error("report exceeds 20,000 cases");
      return { runner: kind as ReportKind, ...parsed };
    } catch {
      throw malformedReport(shown, kind);
    }
  });
  return mergeReports(reports, all, kind);
}

function formatReportPath(filename: string, cwd?: string): string {
  const forward = filename.replaceAll("\\", "/");
  if (!cwd || !filename) return forward;
  const relative = path.relative(cwd, path.resolve(cwd, filename));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return forward;
  return relative.replaceAll("\\", "/") || ".";
}

function mergeReports(reports: TestReport[], reportPath: string, kind: string): TestReport {
  const merged = new Map<string, TestCase>();
  for (const report of reports) {
    for (const testCase of report.cases) {
      const existing = merged.get(testCase.full_name);
      if (!existing) {
        merged.set(testCase.full_name, cloneCase(testCase));
        continue;
      }
      existing.attempts.push(...testCase.attempts);
      if (statusRank[testCase.status] > statusRank[existing.status]) existing.status = testCase.status;
      existing.tags = [...new Set([...existing.tags, ...testCase.tags])];
      if (!existing.file && testCase.file) existing.file = testCase.file;
      if (testCase.duration_ms !== undefined) existing.duration_ms = (existing.duration_ms ?? 0) + testCase.duration_ms;
    }
  }
  const cases = [...merged.values()];
  if (cases.length > 20_000) {
    throw malformedReport(reportPath, kind);
  }
  return {
    runner: reports[0]?.runner ?? "none",
    cases,
    teardown_failed: reports.some((report) => report.teardown_failed),
    inconclusive: cases.length === 0,
  };
}

function cloneCase(testCase: TestCase): TestCase {
  const copy: TestCase = {
    full_name: testCase.full_name,
    status: testCase.status,
    attempts: [...testCase.attempts],
    tags: [...testCase.tags],
  };
  if (testCase.file !== undefined) copy.file = testCase.file;
  if (testCase.duration_ms !== undefined) copy.duration_ms = testCase.duration_ms;
  return copy;
}
