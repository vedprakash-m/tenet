// The version pause (LFC-03, specs/schema-migration.md v2): a contract runs only under the kernel line, schema and adapter it
// was pinned to. A call under others returns one question; the answers that must stay possible are listed here.
import { KernelError } from "./core/errors.ts";
import { reason } from "./core/reasons.ts";
import { SCHEMA_VERSION } from "./core/schemas.ts";
import type { Question, Reason, State, WorkContract } from "./core/schemas.ts";
import { driftQuestion, driftText, versionDrift } from "./core/versions.ts";
import type { Drift, Versions } from "./core/versions.ts";
import type { Ports } from "./ports/types.ts";
import { workByHandle } from "./pipeline-render.ts";
import { withWork } from "./verbs/common.ts";

export const running = (ports: Ports): Versions =>
  ({ tenet: ports.version, schema: SCHEMA_VERSION, adapter: ports.stack.adapterVersion() });

/** Decisions that answer other questions, so a pause never blocks them. */
const ANSWERS = new Set(["version-reconcile", "abandon-confirm", "takeover-check", "repair-lock"]);
const answersOther = (verb: string, input: { kind?: string; target?: string }): boolean =>
  verb === "stop" || (verb === "decide" && (ANSWERS.has(input.kind ?? "") || (input.kind === "adopt" && input.target === "quarantine")));

/** An older document's missing adapter is back-filled silently; a drift stops every call but the answers (the fence runs first). */
export function versionGate(ports: Ports, verb: string, input: { kind?: string; target?: string }, w: WorkContract, state: State) {
  const now = running(ports);
  const filled = w.pinned.adapter ? w : { ...w, pinned: { ...w.pinned, adapter: now.adapter } };
  const drift = versionDrift(filled.pinned, now);
  if (drift.length && !answersOther(verb, input)) {
    throw new KernelError("version-changed", driftText(drift), { exit: 3, questions: [driftQuestion(drift)] });
  }
  return filled === w ? { w, state } : { w: filled, state: withWork(state, filled) };
}

/** `open --resume` cannot be refused (its new handle is how the user answers), so it carries the question instead. A takeover
 * question, when there is one, comes first and the drift is named beside it. */
export function resumeAsk(ports: Ports, w: WorkContract, takeover?: Question): { question?: Question; reasons: Reason[]; why?: string } {
  const drift = versionDrift(w.pinned, running(ports));
  const reasons = [
    ...(takeover ? [reason("takeover-check", "The earlier native chat must stop before this generation continues.")] : []),
    ...(drift.length ? [reason("version-changed", driftText(drift))] : []),
  ];
  if (takeover) return { question: takeover, reasons, why: "Ask in chat whether the earlier chat stopped; end your turn." };
  return drift.length
    ? { question: driftQuestion(drift), reasons, why: "Ask whether to continue under the new Tenet versions; end your turn." }
    : { reasons };
}

/** A read-only call names the drift without refusing anything; a handle that names no live contract adds nothing. */
export function versionNote(ports: Ports, state: State, handle: string): Reason[] {
  try {
    const drift: Drift[] = versionDrift(workByHandle(state, handle).pinned, running(ports));
    return drift.length ? [reason("version-changed", driftText(drift), { note: true })] : [];
  } catch {
    return [];
  }
}
