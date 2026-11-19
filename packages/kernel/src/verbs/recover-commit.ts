import {
  CommitIntentV1, CommitProofV1, LegacyCommitIntent, LegacyCommitResult,
  proofKey, proofMatchesIntent, proofMatchesWork,
} from "../core/commit-proof.ts";
import { replayCommit } from "../core/attribution.ts";
import { stableStringify } from "../core/ids.ts";
import type { Ports } from "../ports/types.ts";
import type { Question, WorkContract } from "../core/schemas.ts";
import type { Outcome, Recovery, Unresolved } from "./recover-effects.ts";
import { factsHash } from "./common.ts";
import { KernelError } from "../core/errors.ts";
import { ZodError } from "zod";

export async function commitRecoveryFacts(ports: Ports, u: Unresolved, w: WorkContract) {
  const parsed = CommitIntentV1.safeParse(u.op);
  const observation = parsed.success ? await ports.git.observeCommit(parsed.data) : null;
  const candidates = observation?.commit && parsed.success && observation.commit !== parsed.data.parent
    ? [observation.commit] : [];
  return {
    hash: factsHash({ id: u.id, op: u.op, work: w.id, generation: w.session.generation, observation }),
    candidates,
  };
}
export async function settleCommit(r: Recovery, u: Unresolved): Promise<void> {
  const parsed = CommitIntentV1.safeParse(u.op);
  const op = u.op as { work?: string } | null, w = op?.work && r.state.work[op.work];
  if (parsed.success && parsed.data.run === u.id && parsed.data.workspace === r.state.workspaceId &&
    w && parsed.data.generation === w.session.generation && parsed.data.label === w.label &&
    await r.ports.git.commitUnmoved(parsed.data)) {
    r.tx.result("commit", u.id, { completed: false });
    r.completed.push("the complete unchanged ref/reflog interval proves the interrupted commit was not performed");
    return;
  }
  r.uncertain.push(`commit ${u.id}: no durable attribution result; Git was left unchanged`);
  if (!w) return;
  const facts = await commitRecoveryFacts(r.ports, u, w);
  const q: Question = {
    id: `leave-unrecorded-${u.id}`, header: "Commit recovery", channel: "chat", bind: { factsHash: facts.hash },
    question: facts.candidates.length
      ? "The recorded ref moved, but I cannot prove this work created the observed commit. " +
        "Leave it unrecorded keeps Git unchanged and does not authorize undo."
      : "The interrupted commit is unresolved. Leave it unrecorded keeps Git unchanged and does not authorize undo.",
    options: [{ label: "Leave unrecorded", description: `Clear only the unresolved intent ${u.id}.` }],
  };
  if (!r.state.pending.some(p => p.id === q.id)) r.state = { ...r.state, pending: [...r.state.pending, q] };
}

export async function publishCommit(r: Omit<Recovery, "tx">, o: unknown, out: Outcome): Promise<void> {
  const op = o as { work?: string; paths: string[]; version?: unknown } | null;
  const w = op?.work && r.state.work[op.work];
  if (!op || !w) { r.uncertain.push("recorded commit has no matching work; publication remains unresolved"); return; }
  if (out.commit && w.git.commits.includes(out.commit)) return;
  if (op.version === undefined && (!LegacyCommitIntent.safeParse(o).success || !LegacyCommitResult.safeParse(out).success)) {
    r.uncertain.push("recorded legacy commit lacks a valid intent/result pair; publication remains unresolved");
    return;
  }
  if (op.version !== undefined) {
    const intent = CommitIntentV1.safeParse(o), parsed = CommitProofV1.safeParse(out.proof);
    if (!intent.success || !parsed.success || !proofMatchesIntent(parsed.data, intent.data) ||
      !proofMatchesWork(parsed.data, r.state, w, out.commit ?? "") ||
      !await privateWitness(r.ports, parsed.data)) {
      r.uncertain.push("recorded commit lacks a matching durable attribution proof; publication remains unresolved");
      return;
    }
  }
  if (!out.commit) return;
  const next = replayCommit(w, { ...out, commit: out.commit }, op.paths);
  if (!next) r.uncertain.push("recorded commit lacks foreign-path proof; inspect its effects");
  else if (next !== w) {
    const locks = r.state.locks.map(lock => "provisional" in lock.anchor && lock.anchor.provisional === w.id && out.commit
      ? { ...lock, anchor: { commit: out.commit } } : lock);
    r.state = { ...r.state, work: { ...r.state.work, [w.id]: next }, locks };
    const provenance = op.version === undefined ? "legacy-unproven" : "proven";
    r.completed.push(`commit ${out.commit!.slice(0, 8)} was published from its durable result (${provenance})`);
  }
}
async function privateWitness(ports: Ports, proof: CommitProofV1): Promise<boolean> {
  let matches: CommitProofV1[];
  try { matches = ports.store.commitProofs().filter(p => proofKey(p) === proofKey(proof)); }
  catch (error) {
    if (!(error instanceof KernelError || error instanceof SyntaxError || error instanceof ZodError)) throw error;
    return false;
  }
  return matches.length === 1 && stableStringify(matches[0]) === stableStringify(proof) &&
    await ports.git.verifyCommit(proof);
}
