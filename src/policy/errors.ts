import type { Finding } from "../types/generated.js";
import type { PolicyError } from "./types.js";

export function policyError(
  code: string,
  message: string,
  fix: string,
  options: { file?: string | null; rule?: string | null; severity?: Finding["severity"] } = {},
): PolicyError {
  const finding: Finding = {
    code,
    severity: options.severity ?? "error",
    rule: options.rule ?? null,
    file: options.file ?? null,
    line: null,
    message,
    fix,
  };
  const error = new Error(`${code}: ${message}`) as PolicyError;
  error.code = code;
  error.finding = finding;
  return error;
}

export function finding(
  code: string,
  severity: Finding["severity"],
  message: string,
  fix: string,
  options: { file?: string; rule?: string } = {},
): Finding {
  return {
    code,
    severity,
    rule: options.rule ?? null,
    file: options.file ?? null,
    line: null,
    message,
    fix,
  };
}
