import { z } from "zod";
import { hashOf, stableStringify } from "./ids.ts";
import type { State, WorkContract } from "./schemas.ts";

const Oid = z.string().regex(/^[a-f0-9]{40}$/);
const Path = z.string().min(1).refine(p => !p.startsWith("/") && !p.split("/").includes("..") && !p.includes("\0"));
const Paths = z.array(Path).max(20_000).refine(p => new Set(p).size === p.length);
const DirtyDecisionRef = z.strictObject({
  path: Path, questionInstance: z.string().min(1), itemToken: z.string().min(1),
  relevantFacts: z.unknown(), scopeHash: z.string().min(1), choice: z.literal("include"),
});
export const ReflogCursorV1 = z.discriminatedUnion("available", [
  z.strictObject({ available: z.literal(false), reason: z.string().min(1) }),
  z.strictObject({
    available: z.literal(true), ref: z.string().min(1), bytes: z.number().int().min(0).max(1_048_576),
    entries: z.number().int().min(0).max(10_000), sha256: z.string().regex(/^[a-f0-9]{64}$/), git: z.string().min(1),
  }),
]);
export type ReflogCursorV1 = z.infer<typeof ReflogCursorV1>;
export const CommitIntentV1 = z.strictObject({
  version: z.literal(1), workspace: z.string().min(1), work: z.string().min(1), generation: z.number().int().nonnegative(),
  run: z.string().min(1), label: z.string().min(1), ref: z.string().startsWith("refs/heads/"),
  parent: Oid.nullable(), expectedTree: Oid, paths: Paths, subject: z.string(),
  cursors: z.array(ReflogCursorV1).min(1).max(2), dirtyDecisions: z.array(DirtyDecisionRef).max(20_000).optional(),
});
export type CommitIntentV1 = z.infer<typeof CommitIntentV1>;
export const LegacyCommitIntent = z.object({
  work: z.string().min(1), parent: Oid.nullable(), expectedTree: Oid, paths: Paths, version: z.undefined().optional(),
});
export const LegacyCommitResult = z.union([
  z.object({ completed: z.literal(true), commit: Oid, foreign: Paths, proof: z.undefined().optional() }),
  z.object({ completed: z.literal(true), commit: z.null(), tree: z.null(), foreign: z.tuple([]), proof: z.undefined().optional() }),
]);
export const CommitProofV1 = CommitIntentV1.omit({ subject: true, cursors: true }).extend({
  parents: z.array(Oid).max(1), commit: Oid, observedTree: Oid, foreign: Paths,
}).refine(p => stableStringify(p.parents) === stableStringify(p.parent ? [p.parent] : []));
export type CommitProofV1 = z.infer<typeof CommitProofV1>;
export const UnrecordedDisposition = z.strictObject({
  disposition: z.literal("leave-unrecorded"), work: z.string().min(1), generation: z.number().int().nonnegative(),
  factsHash: z.string().regex(/^[a-f0-9]{12}$/), observedCandidates: z.array(Oid).max(20_000),
});
export function replayUnrecorded(state: State, id: string, op: unknown, outcome: unknown): State | undefined {
  const parsed = UnrecordedDisposition.safeParse(outcome);
  if (!parsed.success || !op || typeof op !== "object") return;
  const intent = op as { work?: unknown; generation?: unknown; run?: unknown };
  const out = parsed.data, work = state.work[out.work];
  if (intent.work !== out.work ||
    (intent.generation !== undefined && intent.generation !== out.generation) ||
    (intent.run !== undefined && intent.run !== id)) return;
  const questionId = `leave-unrecorded-${id}`, q = state.pending.find(p => p.id === questionId);
  if (!q) return state;
  if (!work || work.session.generation !== out.generation || q.bind.factsHash !== out.factsHash) return;
  return {
    ...state, pending: state.pending.filter(p => p.id !== questionId),
    work: { ...state.work, [work.id]: { ...work, state: work.lastValidPhase ?? work.state } },
  };
}

export const proofKey = (p: CommitProofV1): string => hashOf({
  version: p.version, workspace: p.workspace, work: p.work, generation: p.generation, run: p.run, commit: p.commit,
});
export function proofMatchesIntent(proof: CommitProofV1, intent: CommitIntentV1): boolean {
  const { subject: _subject, cursors: _cursors, ...identity } = intent;
  const { commit: _commit, parents: _parents, observedTree: _tree, foreign: _foreign, ...captured } = proof;
  return stableStringify(identity) === stableStringify(captured);
}
export function proofMatchesWork(proof: CommitProofV1, state: State, work: WorkContract, commit: string): boolean {
  return proof.workspace === state.workspaceId && proof.work === work.id &&
    proof.generation === work.session.generation && proof.label === work.label && proof.commit === commit;
}
export function ownedProofs(proofs: readonly CommitProofV1[], state: State, work: WorkContract): CommitProofV1[] | undefined {
  const owned: CommitProofV1[] = [];
  if (!work.git.commits.length || new Set(work.git.commits).size !== work.git.commits.length) return;
  for (const commit of work.git.commits) {
    const matches = proofs.filter(p => p.commit === commit);
    if (matches.length !== 1 || !proofMatchesWork(matches[0]!, state, work, commit)) return;
    owned.push(matches[0]!);
  }
  return owned;
}

/** Raw final-paragraph grammar; Git configuration cannot broaden it. */
export function exactWorkTrailer(message: string, label: string): boolean {
  const lines = message.replace(/\r\n/g, "\n").replace(/\n+$/, "").split("\n");
  const blank = lines.lastIndexOf("");
  if (blank < 1 || !lines.slice(0, blank).some(line => line.trim())) return false;
  const block = lines.slice(blank + 1);
  if (!block.every(line => /^[A-Za-z0-9][A-Za-z0-9-]*: [^\r\n]*$/.test(line))) return false;
  const work = block.filter(line => /^tenet-work(?:\s|:|$)/i.test(line));
  return work.length === 1 && work[0] === `Tenet-Work: ${label}` && label.trim() === label;
}
