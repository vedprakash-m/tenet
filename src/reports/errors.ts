import { message } from "../core/messages.js";

type ReportErrorCode = "TN-REPORT-MISSING" | "TN-REPORT-MALFORMED";

function reportError(code: ReportErrorCode, vars: { path: string; kind?: string }): Error & { code: ReportErrorCode; fix: string } {
  const text = message(code, vars);
  return Object.assign(new Error(text.message), { code, fix: text.fix });
}

export function missingReport(path: string): Error & { code: string; fix: string } {
  return reportError("TN-REPORT-MISSING", { path });
}

export function malformedReport(path: string, kind: string): Error & { code: string; fix: string } {
  return reportError("TN-REPORT-MALFORMED", { path, kind });
}
