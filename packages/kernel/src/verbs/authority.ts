// The question a protected-path edit raises (WRK-03): the user's own words are needed to authorize it, for this contract only.
import type { Question } from "../core/schemas.ts";
import { factsHash, question } from "./common.ts";

export function grantQuestion(paths: readonly string[]): Question {
  const sorted = [...paths].sort();
  return question({
    id: "grant-confirm", header: "Protected paths", bind: { factsHash: factsHash(sorted) },
    question: `This work edits ${sorted.slice(0, 4).join(", ")}${sorted.length > 4 ? ` and ${sorted.length - 4} more` : ""}, inside the project's protected paths. Allow it for this task only?`,
    options: [
      { label: "Yes, allow these edits for this task", description: "Record your words as the authority for exactly these paths; the next task asks again." },
      { label: "No, undo them", description: "Nothing is authorized; revert those files, then check again." },
    ],
  });
}
