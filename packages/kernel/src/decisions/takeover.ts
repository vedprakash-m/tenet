// A new generation cannot infer that an earlier native chat stopped editing (TS §7.3).
import { KernelError } from "../core/errors.ts";
import type { WorkContract } from "../core/schemas.ts";
import { factsHash, nx } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

export const takeoverFacts = (w: WorkContract): string => factsHash({ work: w.id, generation: w.session.generation });
export const takeover: Decision = {
  kind: "takeover-check",
  run({ state, work, input }) {
    const q = state.pending.find(q => q.id === "takeover-check");
    if (!q || q.bind.factsHash !== takeoverFacts(work)) throw new KernelError("revision-conflict", "there is no current takeover question for this generation", { exit: 2 });
    const answer = input.answers?.[q.id];
    if (answer === "wait") return { resp: { work: work.id, exit: 3, questions: [q], next: [nx("ask", "Wait until the earlier chat has stopped; no editing is authorized yet.", true)] } };
    if (answer !== "stopped") throw new KernelError("revision-conflict", 'answer "stopped" or "wait"', { exit: 1 });
    return { state: { ...state, pending: state.pending.filter(p => p.id !== q.id) }, resp: { work: work.id, next: [nx("check", "The user reports that the earlier chat stopped. Recheck the current files before continuing.", true)] } };
  },
};
