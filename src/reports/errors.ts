export function reportError(
  code: "TN-REPORT-MISSING" | "TN-REPORT-MALFORMED",
  message: string,
  fix: string,
): Error & { code: string; fix: string } {
  const error = new Error(message) as Error & { code: string; fix: string };
  error.code = code;
  error.fix = fix;
  return error;
}

export function missingReport(path: string): Error & { code: string; fix: string } {
  return reportError(
    "TN-REPORT-MISSING",
    `test report is missing: ${path}`,
    "Generate the configured test report and try again.",
  );
}

export function malformedReport(path: string, detail: string): Error & { code: string; fix: string } {
  return reportError(
    "TN-REPORT-MALFORMED",
    `test report is malformed: ${path}: ${detail}`,
    "Generate a valid report for the configured kind and try again.",
  );
}
