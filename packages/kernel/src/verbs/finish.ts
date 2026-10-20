// `finish`: compute the verdict, commit an uncommitted candidate when the endpoint earns it, close the contract and
// return the result. The verdict is computed here and in `inspect why` only (TS §8.3).
import { summarize } from "../core/budget.ts";
import { controlsFor } from "../core/controls.ts";
import { handoffText } from "../core/handoff.ts";
import { KernelError } from "../core/errors.ts";
import { releaseItem } from "../core/plan.ts";
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
import { integrationSetting } from "./integrate.ts";
import type { IntegrationSetting } from "./integrate.ts";

const MAX_REASONS = 8;

/** The result the user reads: outcome first, then checks, limits and the next action (RES-01). */
function result(w: WorkContract, v: Verdict, facts: Facts, extra: Reason[], setting: IntegrationSetting, offer = false): Resp {
  const humanFiles = facts.att.human.length + facts.att.concurrent.length + facts.att.unexplained.length;
  const label = headline(v, { profile: w.profile, branch: w.git.branch, humanFiles });
  const reasons = [...v.reasons.filter((r) => !r.note), ...v.reasons.filter((r) => r.note), ...extra];
  const latestByOb = new Map(w.receipts.filter((r) => r.stage !== "baseline").map((r) => [r.obligation, r]));
  const checks = [...latestByOb.values()].map((r) => ({ obligation: r.obligation, status: r.status, counts: r.counts }));
  const lastReview = w.reviews.at(-1);
  const review = lastReview
    ? { independence: lastReview.independence, axes: lastReview.axes ?? null, uncovered: lastReview.uncovered }
    : null;
  const canIntegrate =
    setting !== "never" &&
    v.endpoint === "checked-local" &&
    w.git.branch !== w.git.start.branch &&
    !w.git.integrated;
  const integration = {
    setting,
    ...(canIntegrate ? { next: setting === "auto-on-accept" ? "accept" : "integrate" } : {}),
  };
  return {
    work: w.id,
    reasons: reasons.slice(0, MAX_REASONS),
    next: [],
    progress: { phase: "finished", boundary: "milestone" },
    data: {
      ...(offer ? { offer: "adopt" } : {}),
      outcome: w.outcome,
      endpoint: v.endpoint,
      ...(v.scope ? { scope: v.scope } : {}),
      level: w.level,
      label,
      ...(v.stopReason ? { stopReason: v.stopReason } : {}),
      acceptance: w.acceptance,
      checks,
      usage: summarize(w.budget, w.lane),
      ...controlsFor(w, v.endpoint),
      review,
      commits: w.git.commits,
      branch: w.git.branch,
      integration,
      handoff: w.handoff ?? null,
      omitted: Math.max(0, reasons.length - MAX_REASONS),
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
    const cur = state!;
    const w = workOf(cur, input.h);
    if (!w.basis && isEditing(w)) {
      throw new KernelError("continue-required", "record a basis before finishing", { exit: 2 });
    }
    if (w.state === "finished") {
      // Already closed: report the verdict as it stands now, change nothing, commit nothing.
      const f = await gather(ports, w, cur.locks);
      const v = verdict(verdictInput(ports, cur, w, f));
      return { resp: result(w, v, f, [], integrationSetting(ports, cur, w)) };
    }
    if (cur.pending.length) {
      return {
        resp: {
          work: w.id,
          exit: 3,
          questions: cur.pending,
          next: [nx("ask", "Answer the open question first.", true)],
        },
      };
    }

    const facts = await gather(ports, w, cur.locks);
    const vi = verdictInput(ports, cur, w, facts);
    const v0 = verdict(vi);
    if (continueRequired(v0, { attemptsLeft: vi.attemptsLeft, stopReason: w.stopReason })) {
      const reasons = [
        reason("continue-required", "an introduced failure remains and attempts are left"),
        ...v0.reasons.filter((r) => !r.note),
      ].slice(0, MAX_REASONS);
      return {
        resp: {
          work: w.id,
          exit: 2,
          reasons,
          next: [nx("implement", "Fix the failing check, then check again.", true)],
        },
      };
    }

    const close = (st: State, nw: WorkContract, f: Facts, v: Verdict, extra: Reason[]): { state: State; resp: Resp } => {
      // The handoff is written at the end of every contract, sufficient to resume without re-explanation (RES-04).
      const done: WorkContract = { ...nw, state: "finished" };
      const session = { generation: nw.session.generation, ...(nw.session.last ? { last: nw.session.last } : {}) };
      const closed: WorkContract = { ...done, handoff: handoffText(st, done), updatedAt: ports.clock.now(), session };
      const { sourceOwner, ...rest } = withWork(st, closed);
      const out: State = sourceOwner && sourceOwner.work !== nw.id ? { ...rest, sourceOwner } : rest;
      // The first checked-local result carries the one offer to save the project's shared files (CON-01).
      const offer =
        v.endpoint === "checked-local" &&
        isEditing(nw) &&
        st.project.adoption.intent === "undecided" &&
        !st.project.adoption.offered;
      const resp = result(closed, v, f, extra, integrationSetting(ports, st, closed), offer);
      // The plan item this contract worked on is done when it reached checked-local, otherwise available again (INT-12).
      const plan = releaseItem(out.project.intent.plan, nw.id, v.endpoint === "checked-local");
      const settled: State = { ...out, project: { ...out.project, intent: { ...out.project.intent, plan } } };
      const final: State = offer
        ? { ...settled, project: { ...settled.project, adoption: { ...settled.project.adoption, offered: true } } }
        : settled;
      return { state: final, resp };
    };

    const wantsCommit =
      v0.endpoint === "checked-local" &&
      !input.noCommit &&
      !w.git.noCommit &&
      w.git.mode === "git" &&
      isEditing(w);
    if (wantsCommit) {
      const subject = input.subject ?? `${w.outcome.slice(0, 72)}`;
      const plan = await startCommit(ports, tx!, cur, w, facts, subject, async (st, nw, _out, reasons) => {
        // Rebuild everything from the finalized result: the facts after the commit, not the ones drafted before it.
        const f2 = await gather(ports, nw, st.locks);
        const v = verdict(verdictInput(ports, st, nw, f2));
        return close(st, nw, f2, v, reasons);
      });
      if (plan) return plan;
    }
    return close(cur, w, facts, v0, []);
  },
};
