// The questions a commit can raise before it runs: who made an unexplained change, and consent to run the commit hooks or Git filters.
import type { Question } from "../core/schemas.ts";
import type { FilterGate } from "../ports/types.ts";
import { factsHash, question } from "./common.ts";

export const unexplainedQuestion = (paths: readonly string[]): Question => {
  const shown = paths.slice(0, 4).join(", ") + (paths.length > 4 ? ` and ${paths.length - 4} more` : "");
  return question({
    id: "unexplained",
    header: "Unexpected changes",
    bind: { factsHash: factsHash([...paths].sort()) },
    question: `These files changed and I cannot tell who changed them: ${shown}. Are they part of this work?`,
    options: [
      { label: "They are mine, include them", description: "Commit them with this work.", recommended: true },
      { label: "They are someone else's", description: "Leave them out of the commit and untouched." },
    ],
  });
};

export const hookQuestion = (hash: string): Question =>
  question({
    id: "hook-consent",
    header: "Commit hooks",
    bind: { factsHash: hash },
    question:
      "This project has commit hooks. They will run when I commit, and a hook can change or stage files itself. Commit with the hooks?",
    options: [
      {
        label: "Commit with hooks",
        description: "Hooks run as usual; if one touches files that are not mine I keep the commit and tell you.",
        recommended: true,
      },
      { label: "Keep the work uncommitted", description: "Nothing is committed; you can commit it yourself." },
    ],
  });

export const filterQuestion = (gate: FilterGate): Question =>
  question({
    id: "filter-consent",
    header: "Git filters",
    bind: { factsHash: gate.hash },
    question:
      `Git filters (${gate.names.join(", ")}) are configured for files in this project. ` +
      "Committing runs them, and a filter is a program that can change file contents. Commit with the filters?",
    options: [
      { label: "Commit with filters", description: "The filters run as Git would run them; I told you which ones.", recommended: true },
      { label: "Keep the work uncommitted", description: "Nothing is committed; you can commit it yourself." },
    ],
  });
