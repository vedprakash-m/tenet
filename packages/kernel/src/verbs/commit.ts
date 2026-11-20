// Commit protocol (TS §10.3), shared by `commit` (a checkpoint) and `finish` (the final commit): preconditions, the
// effect intent with the expected tree, the commit as an external job, then verification and the result record.
import { KernelError } from "../core/errors.ts";
import { CommitInput } from "../core/schemas.ts";
import type { Reason, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan, Resp, Verb } from "../pipeline.ts";
import type { CommitOutcome, IndexJournal, Ports, Tx } from "../ports/types.ts";
import { nx, withWork, workOf } from "./common.ts";
import { gather, worldDigest } from "./facts.ts";
import type { Facts } from "./facts.ts";
import { dirtyDecisionRefs, hasDurableCommitAuthority } from "./dirty.ts";
import { commitBlockers } from "./commit-blockers.ts";
import type { CommitIntentV1 } from "../core/commit-proof.ts";
import { settleCommit } from "./commit-finalize.ts";

export type Done = (
  st: State,
  w: WorkContract,
  out: CommitOutcome | null,
  reasons: Reason[]
) => Promise<{ state: State; resp: Resp }>;

/** The index sync inside the commit is journalled under the same run, and refused if the commit was cancelled meanwhile. */
function indexJournalFor(ports: Ports, w: WorkContract, runId: string): IndexJournal {
  return {
    owner: ports.store.self(),
    intent: (sync) =>
      ports.store.transaction("commit:index-sync", async (current) => {
        const live = current.state?.work[w.id];
        if (
          live?.session.generation !== w.session.generation ||
          live.session.inCall?.runId !== runId ||
          live.session.inCall.cancelled
        ) {
          throw new KernelError("run-superseded", "the commit was cancelled before index sync", { exit: 2 });
        }
        current.intent("index-sync", runId, { work: w.id, sync });
      }),
    result: (status) =>
      ports.store.transaction("commit:index-sync", async (current) => {
        current.result("index-sync", runId, { status });
      }),
  };
}

/** A refusal that stops the call before any effect, or a plan for the commit job; `null` means nothing to commit. */
export async function startCommit(
  ports: Ports,
  tx: Tx,
  st: State,
  w: WorkContract,
  facts: Facts,
  subject: string,
  done: Done
): Promise<Plan | null> {
  const blocked = await commitBlockers(ports, st, w, facts);
  if (blocked !== "go") return blocked;
  const runId = `${w.label}-c${ports.rand.base32(5)}`;
  const runDir = ports.store.tempDir(`run-${runId}`);
  const parent = facts.inv.head;
  const paths = facts.tenetPaths;
  const dirtyDecisions = dirtyDecisionRefs(w, facts.includedHuman ?? []).map((decision) => ({
    path: decision.path,
    questionInstance: decision.questionInstance,
    itemToken: decision.itemToken,
    relevantFacts: decision.relevantFacts,
    scopeHash: decision.scopeHash,
    choice: "include" as const,
  }));
  if (!hasDurableCommitAuthority(w, paths, dirtyDecisions)) {
    throw new KernelError(
      "revision-conflict",
      "the commit lacks matching durable whole-file inclusion authority",
      { exit: 2 },
    );
  }
  const expectedTree = await ports.git.expectedTree({ paths, deleted: [], parent });
  const reqs = st.project.intent.elements
    .filter((e) => e.kind === "requirement" && w.basis?.elementIds.includes(e.id))
    .map((e) => e.id);
  const message = `${subject}\n\nTenet-Work: ${w.label}${reqs.length ? `\nTenet-Req: ${reqs.join(", ")}` : ""}`;
  const context = await ports.git.commitContext();
  const intent: CommitIntentV1 = {
    version: 1, workspace: st.workspaceId, work: w.id, generation: w.session.generation,
    run: runId, label: w.label, ...context, parent, expectedTree, paths, subject, dirtyDecisions,
  };
  tx.intent("commit", runId, intent);
  const now = ports.clock.now();
  const inCall = { runId, ...ports.store.self(), verb: "commit", since: now, runDir };
  const prepared: WorkContract = { ...w, lastValidPhase: w.state, session: { ...w.session, inCall }, updatedAt: now };
  const indexJournal = indexJournalFor(ports, w, runId);
  const job: Job = {
    id: runId,
    execute: () => ports.git.commit({ paths, deleted: [], message, parent, expectedTree, timeoutMs: 120_000, runDir, indexJournal }),
    finalize: async (tx2, st2, result) => settleCommit(ports, { w, runId, paths, intent }, tx2, st2, result, done),
  };
  return { state: withWork(st, prepared), resp: { work: w.id }, job };
}

export const commit: Verb<CommitInput> = {
  name: "commit",
  schema: CommitInput,
  class: () => "mutating",
  identity: worldDigest,
  editing: () => true,
  async run(ports, state, input, tx) {
    const st = state!;
    const w = workOf(st, input.h);
    if (!w.basis) throw new KernelError("continue-required", "record a basis with decide before committing", { exit: 2 });
    if (st.pending.length) {
      return {
        resp: {
          work: w.id,
          exit: 3,
          questions: st.pending,
          next: [nx("ask", "Answer the open question first.", true)],
        },
      };
    }
    const facts = await gather(ports, w);
    const plan = await startCommit(ports, tx!, st, w, facts, input.subject, async (st2, nw, out, reasons) => ({
      state: st2,
      resp: out
        ? {
            work: nw.id,
            reasons,
            exit: reasons.some((r) => !r.note) ? 3 : 0,
            next: [nx("check", "Committed. Continue, or finish.")],
            data: { commit: out.commit, tree: out.tree, foreign: out.foreign },
          }
        : {
            work: nw.id,
            exit: 2,
            reasons,
            next: [nx("commit", "The commit did not happen; fix the cause and retry.")],
          },
    }));
    return (
      plan ?? {
        resp: {
          work: w.id,
          next: [nx("finish", "There is nothing of mine to commit.")],
          data: {
            committed: false,
            guidance:
              "Tenet did not stage or commit a human-only file set. " +
              "The person can commit or set aside their own overlapping edits outside Tenet, then continue.",
          },
        },
      }
    );
  },
};
