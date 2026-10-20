// `stop`: pause at a safe boundary, cancel owned processes, or close the contract. Always allowed, even mid-check.
import { handoffText } from "../core/handoff.ts";
import { releaseItem } from "../core/plan.ts";
import { StopInput } from "../core/schemas.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Verb } from "../pipeline.ts";
import { nx, withWork, workOf } from "./common.ts";
import { recover } from "./recover.ts";

const release = (st: State, w: WorkContract): State => {
  if (st.sourceOwner?.work !== w.id) return st;
  const { sourceOwner: _gone, ...rest } = st;
  return rest;
};

export const stop: Verb<StopInput> = {
  name: "stop",
  schema: StopInput,
  class: () => "mutating",

  async run(ports, state, input, tx) {
    let w = workOf(state, input.h);
    const now = ports.clock.now();
    const effects: string[] = [];
    // Stop any process this contract owns, then record that it was cancelled so a late finalize is discarded.
    const c = w.session.inCall;
    if (c) {
      const how = c.runDir ? await ports.runner.stopRun(c.runDir) : "unknown";
      effects.push(how === "stopped" ? "stopped the running check" : how === "gone" ? "the check had already ended" : "no process record for the running check");
      w = { ...w, state: w.lastValidPhase && w.state === "checking" ? w.lastValidPhase : w.state, session: { generation: w.session.generation } };
    }
    const rec = await recover(ports, tx!, withWork(state!, w));
    w = rec.state.work[w.id]!;
    effects.push(...rec.completed);
    const handoff = handoffText(rec.state, w);
    const stopReason = input.mode === "pause" ? w.stopReason : "user-stop" as const;
    const next: WorkContract = {
      ...w, handoff, updatedAt: now, ...(stopReason ? { stopReason } : {}),
      state: input.mode === "pause" ? "parked" : input.mode === "abandon" ? "cancelled" : w.state,
    };
    // Cancel keeps the contract open at its last valid phase; pause and abandon release source ownership.
    const parked = input.mode === "cancel" ? withWork(rec.state, next) : release(withWork(rec.state, next), next);
    // Abandoning ends the contract, so its plan item is available again; pausing keeps it in progress.
    const st = input.mode === "abandon" ? { ...parked, project: { ...parked.project, intent: { ...parked.project.intent, plan: releaseItem(parked.project.intent.plan, w.id, false) } } } : parked;
    return {
      state: st,
      resp: {
        work: w.id, ...(effects.length ? { effects: { completed: effects, uncertain: rec.uncertain } } : {}),
        next: input.mode === "cancel" ? [nx("check", "Check again when ready.")] : [],
        progress: { phase: input.mode === "pause" ? "parked" : input.mode === "abandon" ? "cancelled" : next.state },
        data: { handoff },
      },
    };
  },
};
