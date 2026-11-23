import type { DiagnosticText } from "../core/messages.js";
import type { Finding } from "../types/generated.js";
import type { PolicyError } from "./types.js";

export function policyError(
  code: string,
  text: DiagnosticText,
  options: { file?: string | null; rule?: string | null; severity?: Finding["severity"] } = {},
): PolicyError {
  const finding: Finding = {
    code,
    severity: options.severity ?? "error",
    rule: options.rule ?? null,
    file: options.file ?? null,
    line: null,
    ...text,
  };
  const error = new Error(text.message) as PolicyError;
  error.code = code;
  error.finding = finding;
  return error;
}

export function finding(
  code: string,
  severity: Finding["severity"],
  text: DiagnosticText,
  options: { file?: string; rule?: string } = {},
): Finding {
  return {
    code,
    severity,
    rule: options.rule ?? null,
    file: options.file ?? null,
    line: null,
    ...text,
  };
}
