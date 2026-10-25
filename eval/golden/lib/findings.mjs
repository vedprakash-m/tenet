// Helpers for graders that compare the kernel's recorded findings with a task's seeded truth.
const RANK = { blocker: 3, major: 2, minor: 1, note: 0 };

/** Every finding in `.tenet/state`, across all work contracts. */
export const findingsOf = (state) => Object.values(state?.work ?? {}).flatMap((w) => w.findings ?? []);

/** A finding that names this seeded defect: same file, a line within `tolerance`, and at least the minimum severity. */
export const matches = (finding, truth, tolerance = 3) =>
  finding.location.path === truth.path &&
  typeof finding.location.line === "number" && Math.abs(finding.location.line - truth.line) <= tolerance &&
  RANK[finding.severity] >= RANK[truth.minSeverity];

/** The seeded defects that no recorded finding names. */
export const missed = (findings, truths) => truths.filter((t) => !findings.some((f) => matches(f, t)));

/** Still reported to the user rather than fixed or withdrawn. */
export const stillReported = (finding) => ["open", "valid", "deferred", "risk-accepted"].includes(finding.state);

export const atLeast = (finding, severity) => RANK[finding.severity] >= RANK[severity];
