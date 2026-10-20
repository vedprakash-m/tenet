// `integrate`: merge the work branch into its base branch locally (TS §10.4, GIT-11). Normal Git operations only, never a
// reference edit on a checked-out branch. Conflicts are predicted before the editor moves; the switch is disclosed by the
// user's own request, and asked about only when uncommitted edits would travel with it (UX A12).
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { IntegrateInput } from "../core/schemas.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Job, Plan, Verb } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { factsHash, nx, question, withWork, workOf } from "./common.ts";
import { gather, worldDigest } from "./facts.ts";
import { settingsFor } from "./reconcile.ts";

export type IntegrationSetting = "offer" | "auto-on-accept" | "never";
export const integrationSetting = (ports: Ports, st: State, w?: WorkContract): IntegrationSetting => {
  const v = settingsFor(ports, st, w).integration;
  return v === "auto-on-accept" || v === "never" ? v : "offer";
};

export const switchFacts = (base: string, dirty: readonly string[]) => factsHash({ base, dirty: [...dirty].sort() });

const switchQuestion = (base: string, dirty: readonly string[]): Question => question({
  id: "branch-switch", header: "Your edits", bind: { factsHash: switchFacts(base, dirty) },
  question: `Integrating switches your editor to ${base}, and your uncommitted changes in ${dirty.slice(0, 3).join(", ")}${dirty.length > 3 ? ` and ${dirty.length - 3} more` : ""} come with it. Continue?`,
  options: [{ label: "Switch and carry my edits", description: "Git moves to the base branch with your uncommitted files unchanged; if Git cannot, nothing moves.", recommended: true }, { label: "Not now", description: "Stay on the work branch; commit or set aside your edits first." }],
});

/** The base branch and work branch of a contract, or an error that says why there is nothing to integrate. */
function branches(w: WorkContract): { base: string; work: string } {
  const base = w.git.start.branch, work = w.git.branch;
  if (!base || !work || base === work) throw new KernelError("capability-missing", "this work was committed on the base branch itself; there is nothing to integrate", { exit: 2 });
  if (!w.git.commits.length) throw new KernelError("continue-required", "nothing of this work is committed yet", { exit: 2 });
  return { base, work };
}

export type IntegrateDone = (st: State, w: WorkContract) => { state: State; resp: Plan["resp"] };

/** Preconditions, conflict prediction, the effect intent, then the merge as an external job. Shared with acceptance under auto-on-accept. */
export async function startIntegrate(ports: Ports, tx: Tx, st: State, w: WorkContract): Promise<Plan> {
  const { base, work } = branches(w);
  const probe = await ports.git.probe();
  if (probe.state !== "ok") throw new KernelError("repo-state-readonly", probe.why);
  if (probe.hooks) throw new KernelError("capability-missing", "integration hooks require an execution consent path that is not implemented; the editor was not switched", { exit: 2 });
  const baseTip = await ports.git.refCommit(base), workTip = await ports.git.refCommit(work);
  if (!baseTip || !workTip) throw new KernelError("capability-missing", `branch ${!baseTip ? base : work} no longer exists`, { exit: 2 });
  if (w.git.integrated?.commit && (await ports.git.refCommit(base)) === w.git.integrated.commit) return { resp: { work: w.id, next: [], data: { integrated: w.git.integrated } } };

  // Conflicts are predicted before the editor leaves the work branch.
  const predicted = await ports.git.predictConflicts(base, work);
  if (predicted.paths.length) throw new KernelError("integration-conflict", predicted.paths.slice(0, 8).join(", "), { exit: 3 });

  // Uncommitted edits travel with a branch switch: that is the one case that still asks, whatever the setting.
  const facts = await gather(ports, w, st.locks);
  const dirty = facts.inv.status.map((s) => s.path);
  if (probe.branch !== base && dirty.length && w.git.switchConsent !== switchFacts(base, dirty)) {
    const q = switchQuestion(base, dirty);
    return {
      state: { ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] },
      resp: { work: w.id, exit: 3, questions: [q], reasons: [reason("branch-switch-needed", dirty.join(", "))], next: [nx("ask", "Ask the user about their uncommitted edits.", true)] },
    };
  }

  const id = `i-${ports.rand.base32(6)}`;
  const runDir = ports.store.tempDir(`run-${id}`);
  tx.intent("integration", id, { work: w.id, base, baseBefore: baseTip, workTip });
  const now = ports.clock.now();
  const inCall = { runId: id, ...ports.store.self(), verb: "integrate", since: now, runDir };
  const prepared: WorkContract = {
    ...w,
    acceptance: w.acceptance === "pending" ? "accepted" : w.acceptance,
    lastValidPhase: w.state,
    updatedAt: now,
    session: { ...w.session, inCall },
  };

  const job: Job = {
    id,
    execute: () => ports.git.integrate(base, work, { runDir, timeoutMs: 60_000 }),
    async finalize(tx2, st2, result) {
      const cw = st2.work[w.id]!;
      const clear: WorkContract = { ...cw, session: { generation: cw.session.generation } };
      const r = result as { ok: boolean; commit?: string; mode?: "fast-forward" | "merge"; detail?: string; error?: string; uncertain?: boolean };
      if (!r.ok || !r.commit) {
        if (r.uncertain || r.error) {
          return {
            state: withWork(st2, { ...clear, state: "blocked" }),
            resp: {
              work: cw.id,
              exit: 2,
              effects: { completed: [], uncertain: ["integration postcondition is not established"] },
              reasons: [reason("effect-uncertain", r.detail ?? r.error ?? "integration did not complete cleanly")],
              next: [nx("stop", "Reconcile the integration before dependent work; the editor may have moved.", true)],
            },
          };
        }
        tx2.result("integration", id, { completed: false });
        return {
          state: withWork(st2, clear),
          resp: {
            work: cw.id,
            exit: 2,
            reasons: [reason("repo-state-readonly", r.detail ?? r.error ?? "Git could not integrate")],
            next: [nx("stop", "Nothing moved; fix the cause and say integrate again.")],
          },
        };
      }
      tx2.result("integration", id, { completed: true, commit: r.commit, mode: r.mode });
      // A fast-forward leaves the tree unchanged, so receipts and review stand; a merge onto a moved base is a new candidate.
      const moved = r.mode === "merge";
      const integrated = { into: base, commit: r.commit, moved, validated: !moved };
      const nw: WorkContract = { ...clear, git: { ...clear.git, integrated } };
      return {
        state: withWork(st2, nw),
        resp: {
          work: nw.id, data: { into: base, commit: r.commit, mode: r.mode, editorNow: base },
          next: moved ? [nx("check", `${base} had moved: check the integrated result before it is called checked.`, true)] : [],
          reasons: moved ? [reason("integration-unvalidated", "the merge result has not been checked", { note: true })] : [],
        },
      };
    },
  };
  return { state: withWork(st, prepared), resp: { work: w.id, next: [] }, job };
}

export const integrate: Verb<IntegrateInput> = {
  name: "integrate",
  schema: IntegrateInput,
  class: () => "mutating",
  editing: () => true,
  identity: worldDigest,
  async run(ports, state, input, tx) {
    const st = state!;
    const w = workOf(st, input.h);
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
    return startIntegrate(ports, tx!, st, w);
  },
};
