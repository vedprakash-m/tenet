// `decide baseline-failures`: the user's answer about broader-suite failures that also fail on the starting files or could not
// be classified (EVD-04, TS §8.1 `Exception`). `exclude` records their own words and leaves exactly these failures out of this
// work; `fix` makes them this work's to fix. Either answer binds to the failure ids the question showed.
import { KernelError } from "../core/errors.ts";
import { FULL_SUITE } from "../core/obligations.ts";
import { BASELINE_QUESTION } from "../verbs/check-sealed.ts";
import { factsHash, nx, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const CHANGED = "the failing tests changed since the question was asked; run check to be asked again";

export const baselineFailures: Decision = {
  kind: BASELINE_QUESTION,
  run({ ports, state, work, input }) {
    const q = state.pending.find((p) => p.id === BASELINE_QUESTION);
    if (!q) throw new KernelError("revision-conflict", "there is no open question about failing tests", { exit: 2 });
    const answer = input.answers?.[BASELINE_QUESTION];
    if (answer !== "exclude" && answer !== "fix") throw new KernelError("revision-conflict", 'answer "exclude" or "fix"', { exit: 1 });
    const ids = work.receipts.filter((r) => r.obligation === FULL_SUITE && r.stage === "candidate").at(-1)?.failureIds ?? [];
    const same = ids.length > 0 && q.bind.factsHash === factsHash([...ids].sort());
    if (!same) throw new KernelError("revision-conflict", CHANGED, { exit: 2 });
    if (answer === "exclude" && !input.quote?.trim())
      throw new KernelError("authority-needed", "leaving failures out records the user's own words: pass them as the quote", { exit: 2 });
    const at = ports.clock.now();
    const exception = { kind: "baseline-failure" as const, ids, reason: input.quote?.slice(0, 200) ?? "", at };
    const w = answer === "exclude"
      ? { ...work, exceptions: [...(work.exceptions ?? []), exception].slice(-20) }
      : { ...work, treated: [...(work.treated ?? []), { ids, at }].slice(-20) };
    const why = answer === "exclude"
      ? "Check again; those failures are left out of this work."
      : "Fix the failing tests, then check again.";
    const rest = state.pending.filter((p) => p.id !== BASELINE_QUESTION);
    const next = [nx(answer === "exclude" ? "check" : "implement", why, true)];
    return { state: withWork({ ...state, pending: rest }, w), resp: { work: w.id, next } };
  },
};
