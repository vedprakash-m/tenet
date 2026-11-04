// Trace fields for the journal `call` record (ENG-09, TS §16). Pure. Each vocabulary is a closed set registered with its
// meaning, as reasons are. The kernel writes what it observes in the call itself. Role, model and permission come from
// the host, which the kernel cannot see: they are written as `unknown` and named in `visibilityGaps`, never guessed.
// Values are numbers, timestamps, a contract label and members of these sets, so a record holds no file contents,
// prompts, secrets or command output (SEC-11).

export const TERMINATION = {
  completed: "The call ran to its response, including a question or a refusal",
  cancelled: "The work was cancelled or replaced before its result was used",
  timeout: "A check obligation reached its timeout",
  crashed: "The kernel failed internally",
} as const;

export const CHECK_OUTCOME = {
  pass: "Every receipt passed",
  fail: "At least one receipt failed",
  inconclusive: "No receipt failed, and at least one could not be judged",
  skipped: "No check ran to a verdict",
} as const;

export const PERMISSION = {
  approved: "The user approved the action",
  "auto-approved": "The host approved the action without asking",
  denied: "The action was denied",
  unknown: "The kernel cannot observe the host's permission decision",
} as const;

export const ROLE = {
  coordinator: "The main session",
  reviewer: "A fresh-context reviewer",
  analyst: "An advisory analyst",
  unknown: "The kernel cannot observe which role made the call",
} as const;

/** Record fields the host holds and the kernel cannot see; each is written as `unknown` and named in `visibilityGaps`. */
export const TRACE_GAPS = {
  role: "The kernel is not told which role made the call",
  model: "The kernel does not observe the model; a model a host reports is not an observation",
  permission: "The kernel does not see the host's approval decision",
} as const;

export interface TraceFacts {
  /** The contract's label, absent when the call has no contract. */
  label?: string;
  intentRevision: number;
  startedAt: string;
  endedAt: string;
  verb: string;
  exit: number;
  reasons: readonly { code: string }[];
  /** The receipts a check call reported. */
  receipts?: readonly { status: string }[];
  /** False for the provisional record of a job that has started and not ended. */
  final: boolean;
}

const checkOutcome = (receipts: readonly { status: string }[]): keyof typeof CHECK_OUTCOME => {
  const seen = new Set(receipts.map((r) => r.status));
  return seen.has("fail") ? "fail" : seen.has("inconclusive") ? "inconclusive" : seen.has("pass") ? "pass" : "skipped";
};

const terminationOf = (exit: number, reasons: readonly { code: string }[]): keyof typeof TERMINATION => {
  const has = (code: string) => reasons.some((r) => r.code === code);
  return exit === 5 ? "crashed" : has("timeout") ? "timeout" : has("run-superseded") ? "cancelled" : "completed";
};

/** The trace fields of one call record, added to its verb, exit and revision. */
export function traceFields(f: TraceFacts): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (f.label) out.work = f.label;
  out.intentRevision = f.intentRevision;
  out.startedAt = f.startedAt;
  out.durationMs = Math.max(0, Date.parse(f.endedAt) - Date.parse(f.startedAt));
  if (f.final) {
    out.termination = terminationOf(f.exit, f.reasons);
    if (f.verb === "check" && f.receipts) out.checkOutcome = checkOutcome(f.receipts);
  }
  out.role = "unknown";
  out.model = "unknown";
  out.permission = "unknown";
  out.visibilityGaps = Object.keys(TRACE_GAPS);
  return out;
}
