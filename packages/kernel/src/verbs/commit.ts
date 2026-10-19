// Commit protocol (TS §10.3), shared by `commit` (a checkpoint) and `finish` (the final commit): preconditions, the
// effect intent with the expected tree, the commit as an external job, then verification and the result record.
import { changedSinceCheck } from "../core/attribution.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { CommitInput } from "../core/schemas.ts";
import type { Question, Reason, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan, Resp, Verb } from "../pipeline.ts";
import type { CommitOutcome, Ports, Tx } from "../ports/types.ts";
import { factsHash, nx, question, withWork, workOf } from "./common.ts";
import { gather, worldDigest } from "./facts.ts";
import type { Facts } from "./facts.ts";
import { keepRecovered, recover } from "./recover.ts";

export const unexplainedQuestion = (paths: readonly string[]): Question => question({
  id: "unexplained", header: "Unexpected changes", bind: { factsHash: factsHash([...paths].sort()) },
  question: `These files changed and I cannot tell who changed them: ${paths.slice(0, 4).join(", ")}${paths.length > 4 ? ` and ${paths.length - 4} more`  : ""}. Are they part of this work?`,
  options: [{ label: "They are mine, include them", description: "Commit them with this work.", recommended: true }, { label: "They are someone else's", description: "Leave them out of the commit and untouched." }],
});

export const hookQuestion = (hash: string): Question => question({
  id: "hook-consent", header: "Commit hooks", bind: { factsHash: hash },
  question: "This project has commit hooks. They will run when I commit, and a hook can change or stage files itself. Commit with the hooks?",
  options: [{ label: "Commit with hooks", description: "Hooks run as usual; if one touches files that are not mine I keep the commit and tell you.", recommended: true }, { label: "Keep the work uncommitted", description: "Nothing is committed; you can commit it yourself." }],
});

export type Done = (st: State, w: WorkContract, out: CommitOutcome | null, reasons: Reason[]) => Promise<{ state: State; resp: Resp }>;

/** A refusal that stops the call before any effect, or a plan for the commit job; `null` means nothing to commit. */
export async function startCommit(ports: Ports, tx: Tx, st: State, w: WorkContract, facts: Facts, subject: string, done: Done): Promise<Plan | null> {
  const probe = await ports.git.probe();
  if (w.git.mode !== "git") return null;
  if (probe.state !== "ok") throw new KernelError("repo-state-readonly", probe.why);
  if (!probe.identity) return { resp: { work: w.id, reasons: [reason("git-identity-missing")], next: [nx("commit", "Set a Git name and email, then commit again.")] } };
  if (facts.att.unexplained.length) {
    const q = unexplainedQuestion(facts.att.unexplained);
    return { state: { ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] }, resp: { work: w.id, exit: 3, questions: [q], reasons: [reason("attribution-unexplained-change", facts.att.unexplained.join(", "))], next: [nx("ask", "Ask the user about the unexplained changes.", true)] } };
  }
  if (!facts.tenetPaths.length) return null;
  // Last-check rule: a Tenet file edited after the last successful check cannot be committed as checked.
  if (w.lastCheck?.candidate !== facts.candidate || changedSinceCheck(w, facts.inv, facts.tenetPaths).length) {
    throw new KernelError("stale", "files changed since the last check; run check first", { exit: 2 });
  }
  if (probe.hooks && !st.consents.some((c) => c.kind === "hooks" && c.configHash === probe.hooks) && !w.git.noCommit) {
    const q = hookQuestion(probe.hooks);
    return { state: { ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] }, resp: { work: w.id, exit: 3, questions: [q], reasons: [reason("filter-consent-needed", "commit hooks need consent")], next: [nx("ask", "Ask the user about commit hooks.", true)] } };
  }

  const runId = `${w.label}-c${ports.rand.base32(5)}`;
  const parent = facts.inv.head;
  const paths = facts.tenetPaths;
  const expectedTree = await ports.git.expectedTree({ paths, deleted: [], parent });
  const reqs = st.project.intent.elements.filter((e) => e.kind === "requirement" && w.basis?.elementIds.includes(e.id)).map((e) => e.id);
  const message = `${subject}\n\nTenet-Work: ${w.label}${reqs.length ? `\nTenet-Req: ${reqs.join(", ")}` : ""}`;
  tx.intent("commit", runId, { work: w.id, parent, expectedTree, paths, subject });
  const now = ports.clock.now();
  const prepared: WorkContract = { ...w, lastValidPhase: w.state, session: { ...w.session, inCall: { runId, ...ports.store.self(), verb: "commit", since: now } }, updatedAt: now };

  const job: Job = {
    id: runId,
    execute: () => ports.git.commit({ paths, deleted: [], message, parent, timeoutMs: 120_000 }),
    async finalize(tx2, st2, result) {
      const cw = st2.work[w.id]!;
      const out = (result as CommitOutcome | { error: string });
      const base: WorkContract = { ...cw, session: { generation: cw.session.generation } };
      if ("error" in out || !out.ok && out.reason !== "nothing-to-commit") {
        const o = out as CommitOutcome & { error?: string };
        tx2.result("commit", runId, { completed: false, reason: o.reason ?? "error" });
        const code = (o.reason ?? "hook-failed") as "hook-failed";
        return done(withWork(st2, base), base, null, [reason(["hook-failed", "signing-unavailable", "git-identity-missing", "git-locked"].includes(code) ? code : "hook-failed", o.detail ?? o.error)]);
      }
      const o = out as CommitOutcome;
      tx2.result("commit", runId, { completed: true, commit: o.commit ?? null, tree: o.tree ?? null });
      const reasons: Reason[] = [];
      if (o.foreign.length) reasons.push(reason("hook-staged-foreign-path", o.foreign.join(", ")));
      if (o.indexSync === "untouched" && o.syncPaths.length) reasons.push(reason("index-sync-needed", o.syncPaths.join(", "), { note: true }));
      const commits = o.commit && !base.git.commits.includes(o.commit) ? [...base.git.commits, o.commit] : base.git.commits;
      const nw: WorkContract = { ...base, state: base.lastValidPhase ?? base.state, git: { ...base.git, commits, committed: [...new Set([...base.git.committed, ...paths])] }, touched: [] };
      // A lock verified on an uncommitted candidate is anchored to the first commit that contains it (TS §9.7).
      const locks = st2.locks.map((l) => ("provisional" in l.anchor && l.anchor.provisional === w.id && o.commit ? { ...l, anchor: { commit: o.commit } } : l));
      return done({ ...withWork(st2, nw), locks }, nw, o, reasons);
    },
  };
  return { state: withWork(st, prepared), resp: { work: w.id, next: [] }, job };
}

export const commit: Verb<CommitInput> = {
  name: "commit",
  schema: CommitInput,
  class: () => "mutating",
  identity: worldDigest,
  editing: () => true,
  async run(ports, state, input, tx) {
    let w = workOf(state, input.h);
    if (!w.basis) throw new KernelError("continue-required", "record a basis with decide before committing", { exit: 2 });
    const rec = await recover(ports, tx!, state!);
    w = rec.state.work[w.id]!;
    if (w.session.inCall) throw new KernelError("work-busy", `a ${w.session.inCall.verb} is running`);
    if (rec.state.pending.length) return { resp: { work: w.id, exit: 3, questions: rec.state.pending, next: [nx("ask", "Answer the open question first.", true)] } };
    const facts = await gather(ports, w);
    const plan = await startCommit(ports, tx!, rec.state, w, facts, input.subject, async (st, nw, out, reasons) => ({
      state: st,
      resp: out
        ? { work: nw.id, reasons, exit: reasons.some((r) => !r.note) ? 3 : 0, next: [nx("check", "Committed. Continue, or finish.")], data: { commit: out.commit, tree: out.tree, foreign: out.foreign } }
        : { work: nw.id, exit: 2, reasons, next: [nx("commit", "The commit did not happen; fix the cause and retry.")] },
    }));
    return keepRecovered(plan ?? { resp: { work: w.id, next: [nx("finish", "There is nothing of mine to commit.")], data: { committed: false } } }, rec, state!);
  },
};
