import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { report, type Report } from "./coverage.ts";

export interface ReleaseAudit {
  report: Report;
  blockedRequirements: string[];
  bindingMismatch: boolean;
}

export function releaseAudit(root: string, milestone: string): ReleaseAudit {
  return releaseAuditReport(report(root, milestone));
}

export function releaseAuditReport(result: Report): ReleaseAudit {
  const qualified = result.evidence.filter((item) => item.qualification === "qualified");
  const bindings = new Set(qualified.map((item) => canonical(item.qualificationBinding)));
  const bindingMismatch = bindings.size > 1;
  const blocked = new Set(result.evidence.filter((item) => item.qualification !== "qualified").map((item) => item.id));
  if (result.integrityErrors.length) for (const item of result.evidence) blocked.add(item.id);
  if (bindingMismatch) for (const item of qualified) blocked.add(item.id);
  return {
    report: result,
    blockedRequirements: [...blocked].sort(),
    bindingMismatch,
  };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = process.argv.indexOf("--milestone");
  const milestone = index > 0 ? process.argv[index + 1] ?? "" : "R1";
  if (!["M0", "A", "B", "R1"].includes(milestone)) {
    console.error(`unknown milestone: ${milestone}`);
    process.exit(2);
  }
  const result = releaseAudit(join(import.meta.dirname, ".."), milestone);
  for (const error of result.report.integrityErrors) console.error(`report integrity: ${error}`);
  if (result.bindingMismatch) console.error("release blocked: due Musts are qualified on different tuples or Tenet artifacts");
  const unqualified = result.report.evidence.filter((item) => item.qualification !== "qualified").map((item) => item.id);
  if (unqualified.length) console.error(`release blocked: ${unqualified.length} due Musts are not qualified: ${unqualified.join(", ")}`);
  if (result.report.integrityErrors.length || result.blockedRequirements.length) process.exit(1);
  console.log(`requirement qualification ${milestone}: all due Musts share one qualified tuple and artifact`);
  console.log("This does not certify full PRD Section 4.7 readiness; Should omissions, residual risks, and owner approvals are not evaluated.");
}