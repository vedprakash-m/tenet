// `decide model-unqualified-for-deep`: continue Deep work on an unqualified or unknown model, or pause (RSC-08, UX §5.1).
// Continuing records only that the user accepted the limitation for these facts; the model label stays what it was.
import { KernelError } from "../core/errors.ts";
import { MODEL_LIMIT, modelFacts, needsModelAnswer } from "../verbs/model-limit.ts";
import { stopWork } from "../verbs/stop.ts";
import { nx, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const CHANGED = "the work or its model changed since the question was asked; run check to be asked again";

export const modelLimit: Decision = {
  kind: MODEL_LIMIT,
  async run({ ports, state, work, input, tx }) {
    const q = state.pending.find((p) => p.id === MODEL_LIMIT);
    const answer = input.answers?.[MODEL_LIMIT];
    const rest = state.pending.filter((p) => p.id !== MODEL_LIMIT);
    if (!q) throw new KernelError("revision-conflict", "there is no open question about the model", { exit: 2 });
    if (!needsModelAnswer(work)) {
      return { state: { ...state, pending: rest }, resp: { work: work.id, next: [nx("check", "Continue.", true)] } };
    }
    if (answer !== "continue" && answer !== "pause") {
      throw new KernelError("revision-conflict", 'answer "continue" or "pause"', { exit: 1 });
    }
    if (q.bind.factsHash !== modelFacts(work)) throw new KernelError("revision-conflict", CHANGED, { exit: 2 });
    // Pause closes the question; the next check after resuming asks again, because nothing was accepted.
    if (answer === "pause") return stopWork(ports, { ...state, pending: rest }, { h: input.h!, mode: "pause" }, tx);
    const w = { ...work, modelAck: modelFacts(work) };
    const next = [nx(w.basis ? "check" : "basis", "Continue.", true)];
    return { state: withWork({ ...state, pending: rest }, w), resp: { work: w.id, next } };
  },
};
