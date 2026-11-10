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

/** After "wait": an undecided start-dirty file that is no longer dirty (the user committed or set aside their edits)
 * holds no uncommitted human bytes, so it stops being human-dirty for this work. */
export function settleCleaned(w: WorkContract, dirtyNow: ReadonlySet<string>): WorkContract {
  const cleaned = new Set(undecidedDirty(w).filter((p) => !dirtyNow.has(p)));
  if (!cleaned.size) return w;
  return { ...w, git: { ...w.git, start: { ...w.git.start, dirty: w.git.start.dirty.filter((e) => !cleaned.has(e.path)) } } };
}

/** Left-out files that are declared touched or no longer have their starting bytes. */
export function leftOutChanged(w: WorkContract, blobNow: (path: string) => string | undefined): string[] {
  const start = new Map(w.git.start.dirty.map((e) => [e.path, e.blob]));
  const touched = new Set(w.touched.map((t) => t.path));
  return (w.leaveOut ?? []).filter((p) => touched.has(p) || blobNow(p) !== start.get(p));
}

const NO_COMMIT = `(Saying "don't commit" instead lets me edit alongside your changes without committing either.)`;

export function dirtyQuestion(paths: readonly string[]): Question {
  const sorted = [...paths].sort();
  return question({
    id: "dirty-overlap", header: "Your edits", bind: { factsHash: factsHash(sorted) },
    question: `You have uncommitted changes in ${sorted.join(", ")}, which this work needs to edit. What should happen to them? ${NO_COMMIT}`,
    options: [
      {
        label: "Wait while you commit or set aside your edits, then say continue",
        description: "Answer: wait. Keeps your work and mine separate; I don't touch these files until you continue.",
        recommended: true,
      },
      { label: "Include your edits in this work", description: "Answer: include. Your changes and mine in these files are committed together." },
      { label: "Leave these files out", description: "Answer: leave-out. I don't edit or commit them; the change may be incomplete." },
    ],
  });
}
