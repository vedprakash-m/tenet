// An early refusal with a registry reason. The pipeline renders it; no state is published.
import { exitFor, reason } from "./reasons.ts";
import type { ReasonCode } from "./reasons.ts";
import type { Action, Question, Reason } from "./schemas.ts";

type Next = Array<{ action: Action; why: string; required?: boolean }>;

type Exit = 0 | 1 | 2 | 3 | 4 | 5;

export class KernelError extends Error {
  readonly reasons: Reason[];
  readonly exit: Exit;
  readonly questions?: Question[];
  readonly next?: Next;
  constructor(code: ReasonCode, detail?: string, opts: { exit?: Exit; questions?: Question[]; next?: Next } = {}) {
    super(detail ?? code);
    this.reasons = [reason(code, detail)];
    this.exit = opts.exit ?? (exitFor(code) as Exit);
    if (opts.questions) this.questions = opts.questions;
    if (opts.next) this.next = opts.next;
  }
}

/** Another contract owns the workspace. The user is told how to continue it or end it, not only that it exists. */
export const ownedByOther = (label: string): KernelError => {
  const why = `Ask the user whether ${label} should continue (open --resume) or end (stop cancel).`;
  const detail = `${label} is editing here. Continue it with open --resume, or end it with stop cancel --h <its handle>`;
  return new KernelError("owned-by-other-work", detail, { next: [{ action: "reconcile", why, required: true }] });
};
