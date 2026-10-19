// `finish`: compute the verdict, commit an uncommitted candidate when the endpoint earns it, close the contract and
// return the result. The verdict is computed here and in `inspect why` only (TS §8.3).
import { summarize } from "../core/budget.ts";
import { controlsFor } from "../core/controls.ts";
import { handoffText } from "../core/handoff.ts";
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { FinishInput } from "../core/schemas.ts";
import type { Reason, State, WorkContract } from "../core/schemas.ts";
import { continueRequired, headline, verdict } from "../core/verdict.ts";
import type { Verdict } from "../core/verdict.ts";
import type { Plan, Resp, Verb } from "../pipeline.ts";
import { isEditing, nx, withWork, workOf } from "./common.ts";
import { startCommit } from "./commit.ts";
import { gather, verdictInput, worldDigest } from "./facts.ts";
import type { Facts } from "./facts.ts";
import { keepRecovered, recover } from "./recover.ts";

const MAX_REASONS = 8;

/** The result the user reads: outcome first, then checks, limits and the next action (RES-01). */
function result(w: WorkContract, v: Verdict, facts: Facts, extra: Reason[]): Resp {
  const label = headline(v, { profile: w.profile, branch: w.git.branch, humanFiles: facts.att.human.length + facts.att.concurrent.length + facts.att.unexplained.length });
  const reasons = [...v.reasons.filter((r) => !r.note), ...v.reasons.filter((r) => r.note), ...extra];
  const checks = [...new Map(w.receipts.filter((r) => r.stage !== "baseline").map((r) => [r.obligation, r])).values()].map((r) => ({ obligation: r.obligation, status: r.status, counts: r.counts }));
  return {
    work: w.id, reasons: reasons.slice(0, MAX_REASONS), next: [],
    progress: { phase: "finished", boundary: "milestone" },
    data: {
      outcome: w.outcome, endpoint: v.endpoint, ...(v.scope ? { scope: v.scope } : {}), level: w.level, label,
      ...(v.stopReason ? { stopReason: v.stopReason } : {}), acceptance: w.acceptance, checks, usage: summarize(w.budget, w.lane),
      ...controlsFor(w, v.endpoint), review: w.reviews.at(-1) ? { independence: w.reviews.at(-1)!.independence, axes: w.reviews.at(-1)!.axes ?? null, uncovered: w.reviews.at(-1)!.uncovered } : null, commits: w.git.commits, branch: w.git.branch, handoff: w.handoff ?? null, omitted: Math.max(0, reasons.length - MAX_REASONS),
    },
  };
}

export const finish: Verb<FinishInput> = {
  name: "finish",
  schema: FinishInput,
  class: () => "mutating",
  identity: worldDigest,
  editing: () => true,

  async run(ports, state, input, tx): Promise<Plan> {
    let w = workOf(state, input.h);
    const rec = await recover(ports, tx!, state!);
    const cur = rec.state;
    if (cur.work[w.id]!.session.inCall) throw new KernelError("work-busy", `a ${cur.work[w.id]!.session.inCall!.verb} is running`);
    const effects = rec.completed.length || rec.uncertain.length ? { completed: rec.completed, uncertain: rec.uncertain } : undefined;
    w = cur.work[w.id]!;
    if (!w.basis && isEditing(w)) throw new KernelError("continue-required", "record a basis before finishing", { exit: 2 });
    if (w.state === "finished") {
      // Already closed: report the verdict as it stands now, change nothing, commit nothing.
      const f = await gather(ports, w, cur.locks);
      return keepRecovered({ resp: result(w, verdict(verdictInput(ports, cur, w, f)), f, []) }, rec, state!);
    }
    if (cur.pending.length) return keepRecovered({ resp: { work: w.id, exit: 3, questions: cur.pending, next: [nx("ask", "Answer the open question first.", true)] } }, rec, state!);

    const facts = await gather(ports, w, cur.locks);
    const v0 = verdict(verdictInput(ports, cur, w, facts));
    if (continueRequired(v0, { attemptsLeft: verdictInput(ports, cur, w, facts).attemptsLeft, stopReason: w.stopReason })) {
      return keepRecovered({ resp: { work: w.id, exit: 2, reasons: [reason("continue-required", "an introduced failure remains and attempts are left"), ...v0.reasons.filter((r) => !r.note)].slice(0, MAX_REASONS), next: [nx("implement", "Fix the failing check, then check again.", true)] } }, rec, state!);
    }

    const close = (st: State, nw: WorkContract, f: Facts, v: Verdict, extra: Reason[]): { state: State; resp: Resp } => {
      // The handoff is written at the end of every contract, sufficient to resume without re-explanation (RES-04).
      const done: WorkContract = { ...nw, state: "finished" };
      const closed: WorkContract = { ...done, handoff: handoffText(st, done), updatedAt: ports.clock.now(), session: { generation: nw.session.generation, ...(nw.session.last ? { last: nw.session.last } : {}) } };
      const { sourceOwner, ...rest } = withWork(st, closed);
      const out: State = sourceOwner && sourceOwner.work !== nw.id ? { ...rest, sourceOwner } : rest;
      const resp = result(closed, v, f, extra);
      return { state: out, resp: effects ? { ...resp, effects } : resp };
    };

    const wantsCommit = v0.endpoint === "checked-local" && !input.noCommit && !w.git.noCommit && w.git.mode === "git" && isEditing(w);
    if (wantsCommit) {
      const plan = await startCommit(ports, tx!, cur, w, facts, input.subject ?? `${w.outcome.slice(0, 72)}`, async (st, nw, _out, reasons) => {
        // Rebuild everything from the finalized result: the facts after the commit, not the ones drafted before it.
        const f2 = await gather(ports, nw, st.locks);
        const v = verdict(verdictInput(ports, st, nw, f2));
        return close(st, nw, f2, v, reasons);
      });
      if (plan) return keepRecovered(plan, rec, state!);
    }
    return close(cur, w, facts, v0, []);
  },
};
