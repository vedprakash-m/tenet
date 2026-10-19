// Human-dirty files Tenet must edit: the user decides first, once per file (PRD 5.12, UX J-03b).
import { matches } from "../core/exclusions.ts";
import type { Question, WorkContract } from "../core/schemas.ts";
import { factsHash, question } from "./common.ts";

/** Files dirty at the start that this work edits or plans to edit, and that have no decision yet. */
export function undecidedDirty(w: WorkContract): string[] {
  const decided = new Set([...w.includeDirty, ...w.keepOut]);
  const touched = new Set(w.touched.map((t) => t.path));
  return w.git.start.dirty.map((d) => d.path).filter((p) => !decided.has(p) && (touched.has(p) || w.scope.paths.some((s) => matches(s, p))));
}

export function dirtyQuestion(paths: readonly string[]): Question {
  const sorted = [...paths].sort();
  return question({
    id: "dirty-overlap", header: "Your edits", bind: { factsHash: factsHash(sorted) },
    question: `You have uncommitted changes in ${sorted.slice(0, 3).join(", ")}${sorted.length > 3 ? ` and ${sorted.length - 3} more` : ""}, which this work needs to edit. What should happen to them?`,
    options: [
      { label: "Edit in place, keep mine out of the commit", description: "I edit the file on top of your changes; the commit holds only my other files and your changes stay uncommitted.", recommended: true },
      { label: "Include them in my commit", description: "Your changes and mine in these files are committed together." },
    ],
  });
}
