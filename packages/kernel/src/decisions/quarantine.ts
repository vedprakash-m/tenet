// Review of an import never restores its authority. Only a metadata preview is offered; content adoption is separate.
import { KernelError } from "../core/errors.ts";
import type { State } from "../core/schemas.ts";
import { factsHash, nx, question } from "../verbs/common.ts";
import type { DecisionCtx } from "./types.ts";

const binding = (state: State) => factsHash({ workspace: state.workspaceId, quarantine: state.quarantine });
export const quarantineQuestion = (state: State) =>
  question({
    id: "quarantine-review",
    header: "Imported records",
    channel: "chat",
    bind: { factsHash: binding(state) },
    question: "I found Tenet records I didn't create; I've set them aside and started fresh. Review the import's metadata, or keep the fresh start? Imported settings, commands and authority remain inactive.",
    options: [
      { label: "Keep the fresh start", description: "Keep the old files set aside and continue with this request.", recommended: true },
      { label: "Review them", description: "Show where the import was set aside and its entry count; restore nothing automatically." },
    ],
  });
export const quarantineData = (state: State) =>
  state.quarantine
    ? { path: `.tenet/${state.quarantine.path}`, entries: state.quarantine.entries, choice: state.quarantine.choice, authorityRestored: false, contentAdopted: false }
    : undefined;
export const quarantineSurface = (state: State) => {
  const q = state.pending.find((q) => q.id === "quarantine-review");
  return q ? { exit: 3 as const, questions: [q] } : {};
};

const REVIEW_LIMITS = [
  "Metadata preview only. Importing record contents is unavailable; restate approved intent through the ordinary basis, overview and plan decisions. No imported grant or consent can be restored.",
];

export function reviewQuarantine({ state, work, input }: DecisionCtx) {
  const q = state.pending.find((q) => q.id === "quarantine-review");
  if (!state.quarantine || !q || q.bind.factsHash !== binding(state)) {
    throw new KernelError("revision-conflict", "there is no matching imported-record preview", { exit: 2 });
  }
  const answer = input.answers?.["quarantine-review"];
  if (answer !== "fresh" && answer !== "review") throw new KernelError("revision-conflict", 'answer "fresh" or "review"', { exit: 1 });
  const next: State = {
    ...state,
    quarantine: { ...state.quarantine, choice: answer === "fresh" ? "fresh" : "review-requested" },
    pending: state.pending.filter((q) => q.id !== "quarantine-review"),
  };
  const action = work.profile === "plan" ? "plan" : work.profile === "investigate" ? "research" : "basis";
  return {
    state: next,
    resp: {
      work: work.id,
      next: [nx(action, "Continue from the current request; imported records remain inert.")],
      data: { quarantine: quarantineData(next), ...(answer === "review" ? { limits: REVIEW_LIMITS } : {}) },
    },
  };
}
