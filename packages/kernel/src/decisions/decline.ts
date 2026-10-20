// `decide decline`: the user declines a mandatory step (WRK-13). The step is recorded with their words, the contract stops with
// the reason `declined`, and the verdict lists it, so the result can only reach an endpoint whose label shows what is missing.
import { KernelError } from "../core/errors.ts";
import { nx, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const STEPS = ["tests", "review"];

export const decline: Decision = {
  kind: "decline",
  run({ state, work, input }) {
    const step = input.target ?? "";
    if (!STEPS.includes(step)) {
      throw new KernelError("capability-missing", `decline which step? one of ${STEPS.join(", ")}; got "${step}"`, { exit: 1 });
    }
    if (!input.quote?.trim()) {
      throw new KernelError("authority-needed", "declining a step records the user's own words: pass them as the quote", { exit: 2 });
    }
    const declined = work.declined.includes(step) ? work.declined : [...work.declined, step];
    const next = { ...work, declined, stopReason: work.stopReason ?? ("declined" as const) };
    const finish = nx("finish", "Finish: the result will name the declined step.", true);
    return { state: withWork(state, next), resp: { work: work.id, next: [finish], data: { declined } } };
  },
};
