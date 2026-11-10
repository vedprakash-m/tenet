// Deep work on a model nobody has qualified for it: the user is told once and chooses to continue or pause (RSC-08, TS §4.8).
import type { Question, WorkContract } from "../core/schemas.ts";
import { factsHash, question } from "./common.ts";

export const MODEL_LIMIT = "model-unqualified-for-deep";

/** The facts the user is shown: this work and its model record. A changed record needs a new answer. */
export function modelFacts(w: WorkContract): string {
  const m = w.model;
  return factsHash([w.id, m?.requested ?? "inherited", m?.source ?? "unknown", m?.qualification ?? "unknown"]);
}

/** Deep work whose model is not qualified, and the user has not yet chosen to continue with these exact facts. */
export function needsModelAnswer(w: WorkContract): boolean {
  return w.lane === "deep" && w.model?.qualification !== "qualified" && w.modelAck !== modelFacts(w);
}

export function modelQuestion(w: WorkContract): Question {
  return question({
    id: MODEL_LIMIT, header: "Model", bind: { factsHash: modelFacts(w) },
    question: "This model configuration hasn't been evaluated for Deep work. Continue with that limitation, or pause?",
    options: [
      { label: "Continue with that limitation", description: "Answer: continue. The model stays labelled unknown or unqualified." },
      { label: "Pause", description: `Answer: pause. Nothing more runs until you say continue.` },
    ],
  });
}
