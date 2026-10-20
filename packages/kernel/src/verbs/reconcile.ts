// `open` re-reads the shared files and compares them with what was adopted, every time (TS §7.8, PH0-4). A change is an
// ordinary external edit, never a silent carry-over: a tightened policy applies at once, anything looser or not
// comparable waits for the user's acceptance, and a block someone edited stays as they wrote it.
import { effectiveSettings, layersOf } from "../core/config.ts";
import { parsePolicy } from "../core/policy.ts";
import type { Change, Policy } from "../core/policy.ts";
import { reason } from "../core/reasons.ts";
import { judgeIntentFile, judgePolicyFile } from "../core/trust.ts";
import type { Question, Reason, State, WorkContract } from "../core/schemas.ts";
import { INTENT_FILE, POLICY_FILE } from "../decisions/adopt.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, question } from "./common.ts";

export interface Shared { state: State; reasons: Reason[]; question?: Question; policy: Policy }

export function reconcileShared(ports: Ports, state: State): Shared {
  const reasons: Reason[] = [];
  let next = state, ask: Question | undefined;
  const put = (file: string, patch: Partial<State["trust"][number]>) => { next = { ...next, trust: next.trust.map((t) => (t.file === file ? { ...t, ...patch } : t)) }; };
  const entry = (file: string) => next.trust.find((t) => t.file === file);
  const list = (cs: readonly Change[]) => cs.map((c) => `${c.field} ${c.kind} (${c.detail})`).join("; ");

  const ptext = entry(POLICY_FILE) ? ports.project.read(POLICY_FILE) : null;
  const pj = ptext === null ? null : judgePolicyFile(entry(POLICY_FILE)!, ptext);
  if (pj?.kind === "unreadable") reasons.push(reason("restriction-key-unknown", `${POLICY_FILE}: ${pj.message}; the adopted rules stay in force`, { note: true }));
  if (pj?.kind === "changed") {
    put(POLICY_FILE, { restrictions: pj.restrictions as Record<string, unknown>, ...(pj.pending.length ? {} : { hash: pj.fileHash }) });
    if (pj.applied.length) reasons.push(reason("policy-applied", `${POLICY_FILE} tightened: ${list(pj.applied)}; applied`, { note: true }));
    if (pj.pending.length) {
      ask = question({ id: "adopt-confirm", header: "Shared policy changed", bind: { factsHash: factsHash({ policy: pj.fileHash }) }, question: `${POLICY_FILE} changed: ${list(pj.pending)}. Until you accept, the previous rules stay in force.`,
        options: [{ label: "Accept the change", description: "Apply the new file as written.", recommended: true }, { label: "Keep the previous rules", description: "Nothing changes now; I will mention it again at the next start." }] });
      next = { ...next, pending: [...next.pending.filter((q) => q.id !== "adopt-confirm"), ask] };
      reasons.push(reason("policy-change-needs-acceptance", `${POLICY_FILE} loosens or changes ${pj.pending.map((c) => c.field).join(", ")}`));
    }
  }

  const itext = entry(INTENT_FILE) ? ports.project.read(INTENT_FILE) : null;
  const ij = itext === null ? null : judgeIntentFile(entry(INTENT_FILE)!, itext);
  if (ij?.kind === "invalid") reasons.push(reason("intent-markers-invalid", `${ij.where}; Tenet will not write into ${INTENT_FILE} until it is fixed`, { note: true }));
  if (ij?.kind === "edited") reasons.push(reason("intent-edited-outside", ij.blocks.join(", "), { note: true }));
  if (ij?.kind === "own-text") put(INTENT_FILE, { hash: ij.fileHash });

  const inForce = sharedPolicy(ports, next);
  // Restrictions in a shared file apply before it is adopted; the rest of it waits (PRD §7.1).
  if (!next.trust.some((t) => t.file === POLICY_FILE) && Object.values(inForce).some((v) => Array.isArray(v) ? v.length : v !== undefined)) reasons.push(reason("policy-applied", `${POLICY_FILE} is not adopted yet; its restrictions apply now`, { note: true }));
  return { state: next, reasons, ...(ask ? { question: ask } : {}), policy: inForce };
}

/** The shared policy in force: the adopted one, or the file as it stands when its restrictions are all there is to go on. */
export function sharedPolicy(ports: Ports, state: State | null): Policy {
  const t = state?.trust.find((x) => x.file === POLICY_FILE);
  if (t) return t.restrictions as Policy;
  const text = ports.project.read(POLICY_FILE);
  if (text === null) return {};
  try { const r = parsePolicy(JSON.parse(text)); return r.ok ? r.policy : {}; } catch { return {}; }
}

/** What every verb that reads a setting sees: the shared policy, the project's local settings and, with a contract, its task overrides. */
export const settingsFor = (ports: Ports, state: State | null, w?: WorkContract) => effectiveSettings(layersOf(state, w, sharedPolicy(ports, state)));
