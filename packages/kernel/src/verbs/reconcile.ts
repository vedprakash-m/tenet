// `open` re-reads the shared files and compares them with what was adopted, every time (TS §7.8, PH0-4). A change is an
// ordinary external edit, never a silent carry-over: a tightened policy applies at once, anything looser or not
// comparable waits for the user's acceptance, and a block someone edited stays as they wrote it.
import { sha256 } from "../core/ids.ts";
import { blockHash, parseBlocks } from "../core/intent-md.ts";
import { comparePolicy, effectivePolicy, parsePolicy } from "../core/policy.ts";
import type { Policy } from "../core/policy.ts";
import { reason } from "../core/reasons.ts";
import type { Question, Reason, State } from "../core/schemas.ts";
import { INTENT_FILE, POLICY_FILE } from "../decisions/adopt.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, question } from "./common.ts";

export interface Shared { state: State; reasons: Reason[]; question?: Question; protectedPaths: string[] }

export function reconcileShared(ports: Ports, state: State): Shared {
  const reasons: Reason[] = [];
  let next = state, ask: Question | undefined;
  const put = (file: string, patch: Partial<State["trust"][number]>) => { next = { ...next, trust: next.trust.map((t) => (t.file === file ? { ...t, ...patch } : t)) }; };

  const policy = next.trust.find((t) => t.file === POLICY_FILE);
  const ptext = policy ? ports.project.read(POLICY_FILE) : null;
  if (policy && ptext !== null && sha256(ptext) !== policy.hash) {
    let json: unknown = null;
    try { json = JSON.parse(ptext); } catch { /* reported below */ }
    const parsed = parsePolicy(json);
    if (!parsed.ok) reasons.push(reason("restriction-key-unknown", `${POLICY_FILE}: ${parsed.message}; the adopted rules stay in force`, { note: true }));
    else {
      const eff = effectivePolicy(policy.restrictions as Policy, parsed.policy, false);
      put(POLICY_FILE, { restrictions: eff.policy as Record<string, unknown>, ...(eff.pending.length ? {} : { hash: sha256(ptext) }) });
      if (eff.applied.length) reasons.push(reason("budget-warning", `${POLICY_FILE} tightened: ${eff.applied.map((c) => `${c.field} (${c.detail})`).join("; ")}; applied`, { note: true }));
      if (eff.pending.length) {
        ask = question({ id: "adopt-confirm", header: "Shared policy changed", bind: { factsHash: factsHash({ policy: sha256(ptext) }) }, question: `${POLICY_FILE} changed: ${eff.pending.map((c) => `${c.field} ${c.kind} (${c.detail})`).join("; ")}. Until you accept, the previous rules stay in force.`,
          options: [{ label: "Accept the change", description: "Apply the new file as written.", recommended: true }, { label: "Keep the previous rules", description: "Nothing changes now; I will mention it again at the next start." }] });
        next = { ...next, pending: [...next.pending.filter((q) => q.id !== "adopt-confirm"), ask] };
        reasons.push(reason("policy-change-needs-acceptance", `${POLICY_FILE} loosens or changes ${eff.pending.map((c) => c.field).join(", ")}`));
      }
    }
  }

  const intent = next.trust.find((t) => t.file === INTENT_FILE);
  const itext = intent ? ports.project.read(INTENT_FILE) : null;
  if (intent && itext !== null && sha256(itext) !== intent.hash) {
    const parsed = parseBlocks(itext);
    if (!parsed.ok) reasons.push(reason("intent-markers-invalid", `line ${parsed.line}${parsed.id ? ` around ${parsed.id}` : ""} (${parsed.problem}); Tenet will not write into ${INTENT_FILE} until it is fixed`, { note: true }));
    else {
      const written = (intent.restrictions.blocks ?? {}) as Record<string, string>;
      const edited = parsed.blocks.filter((b) => written[b.id] !== undefined && blockHash(itext.slice(b.bodyStart, b.bodyEnd)) !== written[b.id]).map((b) => b.id);
      if (edited.length) reasons.push(reason("intent-edited-outside", edited.join(", "), { note: true }));
      else put(INTENT_FILE, { hash: sha256(itext) }); // only the user's own text changed
    }
  }

  const pol = next.trust.find((t) => t.file === POLICY_FILE)?.restrictions as Policy | undefined;
  return { state: next, reasons, ...(ask ? { question: ask } : {}), protectedPaths: pol?.protected_paths ?? [] };
}
