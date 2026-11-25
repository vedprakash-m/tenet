import { readFileSync } from "node:fs";

export type Severity = "error" | "warning" | "advise";

export type Finding = {
  code: string;
  severity: Severity;
  rule: string | null;
  file: string | null;
  line: number | null;
  message: string;
  fix: string;
};

export type Envelope<T = unknown> = {
  ok: boolean;
  command: string;
  version: string;
  result: T;
  errors: Finding[];
};

function readVersion(): string {
  try {
    const manifest = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
      version?: unknown;
    };
    return typeof manifest.version === "string" ? manifest.version : "0.0.0";
  } catch {
    return process.env.npm_package_version ?? "0.0.0";
  }
}

export const version = readVersion();

export function fail(code: string, words: string, fix: string): Finding {
  return {
    code,
    severity: "error",
    rule: null,
    file: null,
    line: null,
    message: words,
    fix,
  };
}

export function errorFinding(error: unknown): Finding | undefined {
  const candidates: unknown[] = [error];
  if (error && typeof error === "object" && "finding" in error) {
    candidates.unshift((error as { finding: unknown }).finding);
  }
  return candidates.find((value): value is Finding => {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<Finding>;
    return (
      candidate.severity === "error" &&
      typeof candidate.code === "string" &&
      (candidate.rule === null || typeof candidate.rule === "string") &&
      (candidate.file === null || typeof candidate.file === "string") &&
      (candidate.line === null ||
        (typeof candidate.line === "number" && Number.isInteger(candidate.line) && candidate.line >= 1)) &&
      typeof candidate.message === "string" &&
      typeof candidate.fix === "string"
    );
  });
}

export function result<T>(command: string, value: T, findings: Finding[] = []): Envelope<T> {
  return {
    ok: findings.every((finding) => finding.severity !== "error"),
    command,
    version,
    result: value,
    errors: findings,
  };
}

export function exitCodeFor(findings: Finding[]): 0 | 1 | 2 | 3 | 4 {
  const codes = findings.filter((finding) => finding.severity === "error").map((finding) => finding.code);
  if (codes.some((code) => code.startsWith("TN-USAGE-") || code === "TN-BLESS-NO-TTY")) return 2;
  if (
    codes.some((code) =>
      [
        "TN-ENV-NODE",
        "TN-ENV-GIT",
        "TN-ENV-NO-COMMIT",
        "TN-ENV-NOT-GIT",
        "TN-POLICY-MISSING",
        "TN-ENV-OFFLINE",
        "TN-ENV-REGISTRY",
      ].includes(code),
    )
  ) {
    return 3;
  }
  if (
    codes.some((code) =>
      [
        "TN-POLICY-LOOSEN",
        "TN-POLICY-INCOMPATIBLE",
        "TN-POLICY-RULE",
        "TN-INIT-EXISTS",
        "TN-BLESS-OPEN-CONFLICT",
        "TN-BLESS-INFERRED",
      ].includes(code),
    )
  ) {
    return 4;
  }
  return codes.length > 0 ? 1 : 0;
}
