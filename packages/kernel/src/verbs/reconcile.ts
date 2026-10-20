// `open` re-reads the shared files and compares them with what was adopted, every time (TS §7.8, PH0-4). A change is an
// ordinary external edit, never a silent carry-over: a tightened policy applies at once, anything looser or not
// comparable waits for the user's acceptance, and a block someone edited stays as they wrote it.
import { effectiveSettings, layersOf } from "../core/config.ts";
import { isStaticCheck, wantedStatic, withStatic } from "../core/obligations.ts";
import { parsePolicy } from "../core/policy.ts";
import type { Change, Policy } from "../core/policy.ts";
import { reason } from "../core/reasons.ts";
import { KernelError } from "../core/errors.ts";
import { judgeIntentFile, judgePolicyFile } from "../core/trust.ts";
import type { Question, Reason, State, WorkContract } from "../core/schemas.ts";
import { INTENT_FILE, POLICY_FILE } from "../decisions/adopt.ts";
import type { Ports } from "../ports/types.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { allowed } from "../core/exclusions.ts";
import { factsHash, question } from "./common.ts";

export interface Shared { state: State; reasons: Reason[]; question?: Question; policy: Policy }

export function reconcileShared(ports: Ports, state: State): Shared {
  const reasons: Reason[] = [];
  let next = state, ask: Question | undefined;
  const putPolicy = (restrictions: Policy, hash?: string) => { next = { ...next, trust: next.trust.map(t => t.file === POLICY_FILE ? { ...t, restrictions, ...(hash ? { hash } : {}) } : t) }; };
  const putHash = (file: string, hash: string) => { next = { ...next, trust: next.trust.map(t => t.file === file ? { ...t, hash } : t) }; };
  const entry = (file: string) => next.trust.find((t) => t.file === file);
  const list = (cs: readonly Change[]) => cs.map((c) => `${c.field} ${c.kind} (${c.detail})`).join("; ");

  const ptext = entry(POLICY_FILE) ? ports.project.read(POLICY_FILE) : null;
  const pj = ptext === null ? null : judgePolicyFile(entry(POLICY_FILE)!, ptext);
  if (pj?.kind === "unreadable") throw new KernelError("restriction-key-unknown", `${POLICY_FILE}: ${pj.message}; fix the policy before continuing`, { exit: 2 });
  if (pj?.kind === "changed") {
    putPolicy(pj.restrictions, pj.pending.length ? undefined : pj.fileHash);
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
  if (ij?.kind === "own-text") putHash(INTENT_FILE, ij.fileHash);

  const inForce = sharedPolicy(ports, next);
  // Restrictions in a shared file apply before it is adopted; the rest of it waits (PRD §7.1).
  if (!next.trust.some((t) => t.file === POLICY_FILE) && Object.values(inForce).some((v) => Array.isArray(v) ? v.length : v !== undefined)) reasons.push(reason("policy-applied", `${POLICY_FILE} is not adopted yet; its restrictions apply now`, { note: true }));
  return { state: next, reasons, ...(ask ? { question: ask } : {}), policy: inForce };
}

/** The shared policy in force: the adopted one, or the file as it stands when its restrictions are all there is to go on. */
export function sharedPolicy(ports: Ports, state: State | null): Policy {
  const t = state?.trust.find((x) => x.file === POLICY_FILE);
  const text = ports.project.read(POLICY_FILE);
  if (text === null) return t ? t.restrictions as Policy : {};
  let r;
  try { r = parsePolicy(JSON.parse(text)); } catch { throw new KernelError("restriction-key-unknown", `${POLICY_FILE} is not valid JSON`, { exit: 2 }); }
  if (!r.ok) throw new KernelError("restriction-key-unknown", `${POLICY_FILE}: ${r.message}`, { exit: 2 });
  return t ? t.restrictions as Policy : r.policy;
}

/** What every verb that reads a setting sees: the shared policy, the project's local settings and, with a contract, its task overrides. */
export const settingsFor = (ports: Ports, state: State | null, w?: WorkContract) => effectiveSettings(layersOf(state, w, sharedPolicy(ports, state)));

/** Declared execution consumers that do not exist yet must block evidence, rather than silently use defaults. */
export function unsupportedExecution(ports: Ports, state: State | null, w?: WorkContract): string[] {
  const settings = settingsFor(ports, state, w);
  return [...Object.keys(settings.commands as object).map(id => `configured command ${id}`), ...(settings.required_checks as { id: string; tool?: string }[]).filter(c => !isStaticCheck(c)).map(c => `required check ${c.id}`)];
}

/** The contract with the static checks its recipe and the required checks owe now: a restriction applies before the next action. */
export function withRequiredChecks(ports: Ports, state: State, w: WorkContract): WorkContract {
  if (!w.basis) return w;
  const required = settingsFor(ports, state, w).required_checks as Array<{ id: string; tool?: string }>;
  const obligations = withStatic(w.obligations, wantedStatic(state.project.recipe?.checks ?? [], required));
  return obligations.length === w.obligations.length ? w : { ...w, obligations };
}

/** Configure the same operation policy before an adapter reads project content. */
export function configurePolicy(ports: Ports, state: State | null): void {
  const exclusions = settingsFor(ports, state).exclusions as Exclusion[];
  if (!allowed("read", POLICY_FILE, exclusions)) throw new KernelError("capability-missing", "a policy that excludes reading its own governing file is unsupported; dependent work is blocked", { exit: 2 });
  ports.git.setExclusions(exclusions);
  ports.git.allowFilters((state?.consents ?? []).filter((c) => c.kind === "filters").map((c) => c.configHash));
  ports.project.setExclusions(exclusions);
  ports.stack.setExclusions(exclusions);
}
