import { recordCommit } from "../core/attribution.ts";
import { CommitProofV1 } from "../core/commit-proof.ts";
import type { CommitIntentV1 } from "../core/commit-proof.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import type { Reason, State, WorkContract } from "../core/schemas.ts";
import type { Resp } from "../pipeline.ts";
import type { CommitOutcome, Ports, Tx } from "../ports/types.ts";
import { nx, withWork } from "./common.ts";
import type { Done } from "./commit.ts";

interface Run { w: WorkContract; runId: string; paths: readonly string[]; intent: CommitIntentV1 }
const KNOWN_FAILURES = [
  "hook-failed", "signing-unavailable", "git-identity-missing", "git-locked", "capability-missing", "filter-consent-needed",
];
function uncertain(st: State, base: WorkContract, runId: string, detail?: string, commit?: string) {
  return {
    state: withWork(st, { ...base, state: "blocked" }),
    resp: {
      work: base.id, exit: 2 as const, reasons: [reason("effect-uncertain", detail)],
      effects: { completed: [], uncertain: [`commit ${runId}: outcome not verified`] },
      data: { observedHead: commit ?? null },
      next: [nx("stop", "Reconcile the commit before repeating it or releasing source ownership.", true)],
    },
  };
}
async function finalizeProof(ports: Ports, intent: CommitIntentV1, out: CommitOutcome): Promise<CommitProofV1> {
  const { subject: _subject, cursors: _cursors, ...identity } = intent;
  const parsed = CommitProofV1.safeParse({
    ...identity, parents: identity.parent ? [identity.parent] : [], commit: out.commit, observedTree: out.tree, foreign: out.foreign,
  });
  if (!parsed.success || !await ports.git.verifyCommit(parsed.data) ||
    (await ports.git.commitContext()).ref !== intent.ref || await ports.git.refCommit(intent.ref) !== out.commit)
    throw new KernelError("effect-uncertain", "commit result does not verify the captured attribution intent", { exit: 2 });
  ports.store.putCommitProof(parsed.data);
  return parsed.data;
}

/** Result and private proof precede the State publication, and only this finalization creates a proof. */
export async function settleCommit(
  ports: Ports, run: Run, tx: Tx, st: State, result: unknown, done: Done,
): Promise<{ state: State; resp: Resp }> {
  const { w, runId, paths } = run;
  const cw = st.work[w.id]!;
  const out = result as CommitOutcome | { error: string };
  const base: WorkContract = { ...cw, session: { generation: cw.session.generation } };
  if ("error" in out || !out.ok) {
    const o = out as CommitOutcome & { error?: string };
    if (o.error || o.reason === "effect-uncertain" || !await ports.git.commitUnmoved(run.intent))
      return uncertain(st, base, runId, o.detail ?? o.error, o.commit);
    tx.result("commit", runId, { completed: false, reason: o.reason ?? "error" });
    const code = (
      KNOWN_FAILURES.includes(o.reason ?? "hook-failed") ? (o.reason ?? "hook-failed") : "hook-failed"
    ) as "hook-failed";
    return done(withWork(st, base), base, null, o.reason === "nothing-to-commit" ? [] : [reason(code, o.detail ?? o.error)]);
  }
  const o = out;
  const proof = await finalizeProof(ports, run.intent, o);
  tx.result("commit", runId, { completed: true, commit: o.commit, tree: o.tree, foreign: o.foreign, proof });
  const reasons: Reason[] = [];
  if (o.foreign.length) reasons.push(reason("hook-staged-foreign-path", o.foreign.join(", ")));
  if (o.indexSync === "untouched" && o.syncPaths.length) {
    reasons.push(reason("index-sync-needed", `${o.syncPaths.join(", ")}; run: decide sync-index`, { note: true }));
  }
  const nw = recordCommit(base, o, paths);
  const locks = st.locks.map((l) =>
    "provisional" in l.anchor && l.anchor.provisional === w.id && o.commit ? { ...l, anchor: { commit: o.commit } } : l
  );
  const state = { ...withWork(st, nw), locks };
  if (o.foreign.length) return {
    state,
    resp: { work: nw.id, exit: 3, reasons,
      next: [nx("review", "Review foreign paths, then decide disposition.", true)],
      data: { commit: o.commit, foreign: o.foreign } },
  };
  return done(state, nw, o, reasons);
}
