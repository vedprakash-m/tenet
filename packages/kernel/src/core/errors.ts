// An early refusal with a registry reason. The pipeline renders it; no state is published.
import { exitFor, reason } from "./reasons.ts";
import type { ReasonCode } from "./reasons.ts";
import type { Question, Reason } from "./schemas.ts";

type Exit = 0 | 1 | 2 | 3 | 4 | 5;

export class KernelError extends Error {
  readonly reasons: Reason[];
  readonly exit: Exit;
  readonly questions?: Question[];
  constructor(code: ReasonCode, detail?: string, opts: { exit?: Exit; questions?: Question[] } = {}) {
    super(detail ?? code);
    this.reasons = [reason(code, detail)];
    this.exit = opts.exit ?? (exitFor(code) as Exit);
    if (opts.questions) this.questions = opts.questions;
  }
}
