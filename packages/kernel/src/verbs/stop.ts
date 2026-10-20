// `stop`: pause at a safe boundary, cancel owned processes, or close the contract. Always allowed, even mid-check.
import { handoffText } from "../core/handoff.ts";
import { releaseItem } from "../core/plan.ts";
import { StopInput } from "../core/schemas.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Plan, Verb } from "../pipeline.ts";
import { KernelError } from "../core/errors.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { factsHash, nx, question, withWork, workOf } from "./common.ts";
import { recover } from "./recover.ts";

const release = (st: State, w: WorkContract): State => {
  if (st.sourceOwner?.work !== w.id) return st;
  const { sourceOwner: _gone, ...rest } = st;
  return rest;
};

const abandonFacts = (w: WorkContract) => factsHash({ id: w.id, generation: w.session.generation, state: w.state, run: w.session.inCall?.runId ?? null });

export async function stopWork(ports: Ports, state: State, input: StopInput, tx: Tx): Promise<Plan> {
  let w = workOf(state, input.h);
  if (input.mode === "abandon") {
    const answer = input.answers?.["abandon-confirm"];
    const pending = state.pending.find(q => q.id === "abandon-confirm");
    if (answer) {
      if (!pending || pending.bind.factsHash !== abandonFacts(w)) throw new KernelError("revision-conflict", "the contract changed since the abandonment preview; preview again", { exit: 2 });
      state = { ...state, pending: state.pending.filter(q => q.id !== "abandon-confirm") };
      if (answer === "cancel") return { state, resp: { work: w.id, next: [] } };
      if (answer !== "abandon") throw new KernelError("revision-conflict", 'answer "abandon" or "cancel"', { exit: 1 });
    } else {
      const q = question({
        id: "abandon-confirm",
        header: "Abandon work",
        channel: "chat",
        bind: { factsHash: abandonFacts(w) },
        question: `Abandon ${w.label}? Its running work will stop, the contract will close and its plan item will be released. Files and commits stay as they are. Reply "abandon ${w.label}" or "keep it".`,
        options: [
          { label: "Abandon", description: "Close this contract and release its plan item." },
          { label: "Keep it", description: "Leave the contract and its work unchanged.", recommended: true },
        ],
      });
      return {
        state: { ...state, pending: [...state.pending.filter((x) => x.id !== q.id), q] },
        resp: {
          work: w.id,
          exit: 3,
          questions: [q],
          reasons: [{ code: "approval-gate", message: "Approval mode is unknown; this destructive-action chat gate is advisory." }],
          next: [nx("ask", "Show the preview and ask in chat; end your turn.", true)],
        },
      };
    }
  }
  const now = ports.clock.now();
  const effects: string[] = [];
  // Stop any process this contract owns, then record that it was cancelled so a late finalize is discarded.
  const c = w.session.inCall;
  if (c) {
    const how = c.runDir ? await ports.runner.stopRun(c.runDir) : "unknown";
    if (how === "unknown") {
      return {
        state: withWork(state, { ...w, state: "blocked", session: { ...w.session, inCall: { ...c, cancelled: true } } }),
        resp: {
          work: w.id,
          exit: 2,
          effects: { completed: [], uncertain: ["no trusted process record; an orphan may exist"] },
          reasons: [{ code: "effect-uncertain", message: "The process could not be identified safely; source ownership was not released." }],
          next: [nx("stop", "Reconcile process ownership before starting other work.", true)],
        },
      };
    }
    effects.push(how === "stopped" ? "stopped the running check" : how === "gone" ? "the check had already ended" : "no process record for the running check");
    w = { ...w, state: w.lastValidPhase && w.state === "checking" ? w.lastValidPhase : w.state, session: { generation: w.session.generation } };
  }
  const rec = await recover(ports, tx!, withWork(state!, w), { effects: false });
  w = rec.state.work[w.id]!;
  effects.push(...rec.completed);
  if (rec.uncertain.length) {
    return {
      state: withWork(rec.state, { ...w, state: "blocked" }),
      resp: {
        work: w.id,
        exit: 2,
        effects: { completed: effects, uncertain: rec.uncertain },
        reasons: [{ code: "effect-uncertain", message: "An interrupted effect is still uncertain; source ownership was not released." }],
        next: [nx("stop", "Reconcile the uncertain effect before starting other work.", true)],
      },
    };
  }
  const handoff = handoffText(rec.state, w);
  const stopReason = input.reason === "host-limit" ? "host-limit" as const : input.mode === "pause" ? w.stopReason : "user-stop" as const;
  const next: WorkContract = {
    ...w, handoff, updatedAt: now, ...(stopReason ? { stopReason } : {}),
    ...(input.mode === "pause" ? { lastValidPhase: w.state === "parked" ? w.lastValidPhase : w.state } : {}),
    state: input.mode === "pause" ? "parked" : input.mode === "abandon" ? "cancelled" : w.state,
  };
  // Cancel keeps the contract open at its last valid phase; pause and abandon release source ownership.
  const parked = input.mode === "cancel" ? withWork(rec.state, next) : release(withWork(rec.state, next), next);
  // Abandoning ends the contract, so its plan item is available again; pausing keeps it in progress.
  const st = input.mode === "abandon"
    ? { ...parked, project: { ...parked.project, intent: { ...parked.project.intent, plan: releaseItem(parked.project.intent.plan, w.id, false) } } }
    : parked;
  return {
    state: st,
    resp: {
      work: w.id, ...(effects.length ? { effects: { completed: effects, uncertain: rec.uncertain } } : {}),
      next: input.mode === "cancel" ? [nx("check", "Check again when ready.")] : [],
      progress: { phase: input.mode === "pause" ? "parked" : input.mode === "abandon" ? "cancelled" : next.state },
      data: { handoff },
    },
  };
}

export const stop: Verb<StopInput> = {
  name: "stop", schema: StopInput, class: () => "mutating",
  run: (ports, state, input, tx) => stopWork(ports, state!, input, tx!),
};
