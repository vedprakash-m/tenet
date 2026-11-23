import { stripTags } from "./tags.js";
import type { DeclaredTag, DeclaredTags, ItemResult, TestCase, TestReport } from "./types.js";

export function itemResults(
  items: Array<{ id: string; text?: string }>,
  reports: TestReport | TestReport[],
  declarations: Pick<DeclaredTags, "acceptance">,
): ItemResult[] {
  const allReports = Array.isArray(reports) ? reports : [reports];
  const cases = allReports.flatMap((report, reportIndex) =>
    report.cases.map((testCase, caseIndex) => ({ reportIndex, caseIndex, testCase })),
  );

  return items.map(({ id }) => {
    const expected = declarations.acceptance[id] ?? [];
    const matchedKeys = new Set<string>();
    const matched: Array<{ reportIndex: number; caseIndex: number; testCase: TestCase }> = [];
    let unmatched = 0;
    for (const declaration of expected) {
      const found = cases.filter(({ testCase }) => titleMatches(testCase.full_name, declaration.name));
      if (found.length === 0) unmatched += 1;
      for (const candidate of found) {
        const key = `${String(candidate.reportIndex)}\0${String(candidate.caseIndex)}`;
        if (matchedKeys.has(key)) continue;
        matchedKeys.add(key);
        matched.push(candidate);
      }
    }
    matched.sort((left, right) => left.reportIndex - right.reportIndex || left.caseIndex - right.caseIndex);
    const passed = matched.filter(({ testCase }) => testCase.status === "pass").length;
    const failed = matched.filter(({ testCase }) => ["fail", "error"].includes(testCase.status)).length;
    const skipped = matched.filter(({ testCase }) => testCase.status === "skip").length;
    const coverage = expected.length > 0 && unmatched === 0 ? "confirmed" : "not-confirmed";
    let result: ItemResult["result"];
    if (expected.length === 0) result = "no-test";
    else if (failed > 0) result = "failed";
    else if (matched.length === 0 || unmatched > 0) result = "not-run";
    else if (skipped === matched.length) result = "skipped";
    else result = "passed";
    const firstFailure = matched.find(({ testCase }) => testCase.status === "fail" || testCase.status === "error");
    return {
      id,
      result,
      coverage,
      tests: {
        expected: expected.length,
        passed,
        failed,
        skipped,
        not_run: unmatched,
      },
      names: [...new Set(matched.map(({ testCase }) => testCase.full_name))],
      authorship: itemAuthorship(expected),
      first_failure: firstFailure
        ? { full_name: firstFailure.testCase.full_name, status: firstFailure.testCase.status as "fail" | "error" }
        : null,
    };
  });
}

export function titleMatches(fullName: string, declarationName: string): boolean {
  const caseName = stripTags(fullName).replace(/\s+/g, " ").trim();
  const declaration = stripTags(declarationName).replace(/\s+/g, " ").trim();
  const normalizedCase = caseName.replace(/\[.+\]$/, "").trim();
  const pattern = declaration
    .split(/(%s|%d|%i|%f|%j|%o|%p|%#|\$name|\$\{[^}]+\})/g)
    .map((part) => (isPlaceholder(part) ? ".+" : escapeRegExp(part)))
    .join("");
  if (!pattern) return false;
  return new RegExp(`(?:^|[\\s>./:])${pattern}$`).test(normalizedCase);
}

function itemAuthorship(expected: DeclaredTag[]): ItemResult["authorship"] {
  if (expected.length === 0 || expected.some((declaration) => declaration.via_describe)) return "unknown";
  if (expected.every((declaration) => declaration.authorship === "written-here")) return "written-here";
  if (expected.some((declaration) => declaration.authorship === "unknown")) return "unknown";
  return "tag-added-here";
}

function isPlaceholder(value: string): boolean {
  return /^(?:%s|%d|%i|%f|%j|%o|%p|%#|\$name|\$\{[^}]+\})$/.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
