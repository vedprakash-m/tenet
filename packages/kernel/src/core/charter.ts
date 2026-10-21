// The project's own engineering charter: at most 300 tokens between one pair of markers in an instruction file (TS §7.8).
import { estimateTokens } from "./review.ts";

const BEGIN = "<!-- tenet:charter:begin -->";
const END = "<!-- tenet:charter:end -->";
const MAX_TOKENS = 300;

/** The charter of the first file that has one: exactly one balanced pair of markers, not empty, within the cap; else undefined. */
export function projectCharter(files: ReadonlyArray<string | null>): string | undefined {
  for (const text of files) {
    if (!text || text.split(BEGIN).length !== 2 || text.split(END).length !== 2) continue;
    const from = text.indexOf(BEGIN) + BEGIN.length, to = text.indexOf(END);
    const body = to > from ? text.slice(from, to).trim() : "";
    if (body && estimateTokens(body) <= MAX_TOKENS) return body;
  }
  return undefined;
}
