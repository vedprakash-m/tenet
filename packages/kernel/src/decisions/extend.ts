// `decide extend`: the user agrees to more work after the active-time bound (WRK-08); their words are required.
import { KernelError } from "../core/errors.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

export const extend: Decision = {
  kind: "extend",
  run({ state, work, input }) {
    if (!input.quote?.trim()) {
      throw new KernelError("authority-needed", "extending the time records the user's own words: pass them as the quote", { exit: 2 });
    }
    const budget = { ...work.budget, activeMinutesSinceCheckIn: 0 };
    const resp = { work: work.id, checkIn: true, data: { activeMinutesTotal: budget.activeMinutesTotal } };
    return { state: withWork(state, { ...work, budget }), resp };
  },
};
