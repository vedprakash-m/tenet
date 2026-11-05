// How a response is built and recorded: handles, the rendered envelope, the call identity and the publish step.
import { accrueTime, attachUsage, budgetProgress, nearLimit, summarize } from "./core/budget.ts";
import { handoffText } from "./core/handoff.ts";
import { reason } from "./core/reasons.ts";
import { formatHandle, hashOf, parseHandle } from "./core/ids.ts";
import { KernelError } from "./core/errors.ts";
import { redactDeep } from "./core/redact.ts";
import { traceFields } from "./core/trace.ts";
import type { KernelResponse, State, WorkContract } from "./core/schemas.ts";
import type { Ports, Tx } from "./ports/types.ts";
import type { Plan, Resp, Verb } from "./pipeline.ts";
import { settingsFor } from "./verbs/reconcile.ts";

export type Stamped = { res: KernelResponse; plan?: Plan };

export function workByHandle(state: State, h: string): WorkContract {
  const p = parseHandle(h);
  if (!p) throw new KernelError("handle-unknown", "a handle looks like W7.3.k7q");
  if (p.tag !== state.tag) throw new KernelError("handle-unknown", "it belongs to another workspace");
  const w = Object.values(state.work).find((x) => x.label === `W-${String(p.labelN).padStart(4, "0")}`);
  if (!w) throw new KernelError("handle-unknown", `there is no contract ${h}`);
  if (w.session.generation !== p.generation) {
    const why = "Run open --resume to continue this contract in this chat, if the user wants that.";
    throw new KernelError("stale-session", "a newer chat took over this contract; take it back with open --resume", {
      next: [{ action: "reconcile", why, required: true }],
    });
  }
  return w;
}

export const handleOf = (state: State, w: WorkContract): string =>
  formatHandle(Number(w.label.slice(2)), w.session.generation, state.tag);

export function render(
  ports: Ports,
  verb: string,
  resp: Resp,
  state: State | null,
  extra: Partial<KernelResponse> = {}
): KernelResponse {
  const w = resp.work && state ? state.work[resp.work] : undefined;
  const reasons = [...(resp.reasons ?? [])];
  const usage = w ? summarize(w.budget, w.lane) : undefined;
  if (state?.recovered && !reasons.some((r) => r.code === "state-recovered-from-backup"))
    reasons.push({
      code: "state-recovered-from-backup",
      message: `Recovered an older local revision; authority is suspended. Accounting is ${state.recovered.accounting ?? "unknown"}; ` +
        "reconfirmation is unavailable.",
    });
  const exit = resp.exit ?? 0;
  const out: KernelResponse = {
    verb,
    exit: state?.recovered && exit === 0 ? 3 : exit,
    revision: state?.revision ?? 0,
    reasons,
    next: resp.next ?? [],
    budget: usage ? budgetProgress(usage) : { attempts: "0/0", rounds: "0/0", delegations: "0/0" },
    ...extra,
  };
  if (w && state) out.handle = handleOf(state, w);
  if (resp.questions?.length) out.questions = resp.questions;
  if (resp.progress) out.progress = resp.progress;
  if (resp.effects) out.effects = resp.effects;
  if (resp.data !== undefined) out.data = attachUsage(resp.data, usage);
  if (resp.kernel) out.kernel = { version: ports.version, schemaVersion: 1 };
  return redactDeep(out); // nothing displayed, and nothing cached on the contract, carries a likely secret (SEC-11)
}

export const inputHash = (verb: string, input: unknown, world: unknown): string => {
  const { again: _again, ...rest } = (input ?? {}) as Record<string, unknown>;
  return hashOf({ verb, rest, world });
};

/** Accrue time before applying warning and handoff rules at every final publication boundary. */
function withActiveTime(ports: Ports, verb: string, next: State, resp: Resp, startedAt: string): State {
  const w = next.work[resp.work!]!;
  const cadence = settingsFor(ports, next, w).checkpoints;
  const boundary = resp.progress?.boundary;
  const checkIn = !!resp.checkIn || !!resp.questions?.length || ["finish", "stop"].includes(verb) ||
    (cadence === "each-phase" && !!boundary) || (cadence === "milestones" && boundary === "milestone");
  const call = { startedAt, endedAt: ports.clock.now(), exit: resp.exit ?? 0 };
  const near = nearLimit(accrueTime(w.budget, { ...call, checkIn: false }), w.lane);
  const budget = accrueTime(w.budget, { ...call, checkIn });
  if (near && !resp.reasons?.some(r => r.code === "budget-warning"))
    resp.reasons = [...(resp.reasons ?? []), reason("budget-warning", "80% of a limit is used", { note: true })];
  const updated = { ...w, budget };
  if (near || w.stopReason) updated.handoff = handoffText(next, updated);
  return { ...next, work: { ...next.work, [w.id]: updated } };
}

/**
 * Renders the response for the revision about to be published and, for a final response, caches it on the contract in
 * the same publish. A job's provisional response is never cached: were the process to die mid-job, a retry would be
 * answered with a result nobody observed.
 */
export function stamp(
  ports: Ports,
  verb: Verb,
  input: unknown,
  world: unknown,
  tx: Tx,
  next: State,
  resp: Resp,
  final: boolean,
  startedAt: string
): KernelResponse {
  const revision = (tx.state?.revision ?? 0) + 1;
  if (final && resp.work && next.work[resp.work]) next = withActiveTime(ports, verb.name, next, resp, startedAt);
  const res = render(ports, verb.name, resp, { ...next, revision });
  const w = resp.work ? next.work[resp.work] : undefined;
  if (final && w && verb.name !== "open")
    w.session = { ...w.session, last: { inputHash: inputHash(verb.name, input, world), response: res } };
  tx.publish(next);
  tx.call({ verb: verb.name, exit: res.exit, revision, ...traceFields({
    label: w?.label, intentRevision: next.project.intent.revision, startedAt, endedAt: ports.clock.now(), verb: verb.name,
    exit: res.exit, reasons: res.reasons, receipts: (resp.data as { receipts?: { status: string }[] } | undefined)?.receipts, final,
  }) });
  return res;
}
