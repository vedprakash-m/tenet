function reportError(
  code: "TN-REPORT-MISSING" | "TN-REPORT-MALFORMED",
  message: string,
  fix: string,
): Error & { code: string; fix: string } {
  return Object.assign(new Error(message), { code, fix });
}

export function missingReport(path: string): Error & { code: string; fix: string } {
  return reportError(
    "TN-REPORT-MISSING",
    `Test report ${path} was not found.`,
    `Run tests to generate ${path}, or provide an existing report path.`,
  );
}

export function malformedReport(path: string, kind: string): Error & { code: string; fix: string } {
  return reportError(
    "TN-REPORT-MALFORMED",
    `Test report ${path} is not valid ${kind} input.`,
    `Fix the ${kind} report format, XML entity rules, or size/case limits for ${path}.`,
  );
}
