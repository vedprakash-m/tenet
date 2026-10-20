// `decide grant`: authority beyond the routine one a clear request gives (WRK-03, TS §8.1). Only the protected-path class is
// built: it records the user's own words and the exact paths, for this contract only. Without words nothing is recorded.
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { matches } from "../core/exclusions.ts";
import { gather } from "../verbs/facts.ts";
import { unauthorizedEdits } from "../verbs/facts.ts";
import { factsHash, nx, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const Body = z.object({ paths: z.array(z.string()).max(50).optional() }).optional();

export const grant: Decision = {
  kind: "grant",
  async run({ ports, state, work, input }) {
    if (input.target !== "protected-path") throw new KernelError("capability-missing", `grant what? only "protected-path" is built; got "${input.target ?? ""}"`, { exit: 1 });
    const rest = state.pending.filter((q) => q.id !== "grant-confirm");
    if (input.answers?.["grant-confirm"] === "decline") return { state: withWork({ ...state, pending: rest }, work), resp: { work: work.id, next: [nx("implement", "Undo the edits in the protected paths, then check again.", true)] } };
    if (!input.quote?.trim()) throw new KernelError("authority-needed", "a grant records the user's own words: pass them as the quote", { exit: 2 });
    const body = Body.parse(input.propose);
    const asked = body?.paths ?? unauthorizedEdits(ports, work, await gather(ports, work, state.locks));
    if (!asked.length) throw new KernelError("continue-required", "no edit in a protected path needs a grant", { exit: 2 });
    const outside = asked.filter((p) => !work.scope.protected.some((x) => matches(x, p)));
    if (outside.length) throw new KernelError("restriction-key-unknown", `${outside.slice(0, 3).join(", ")} is not in a protected path`, { exit: 2 });
    const paths = [...new Set(asked)].sort();
    const g = { id: `GR-${work.grants.length + 1}`, actions: ["protected-path" as const], paths, source: "decide" as const, capture: "reported" as const, quote: input.quote.slice(0, 200), bind: { factsHash: factsHash(paths) } };
    return { state: withWork({ ...state, pending: rest }, { ...work, grants: [...work.grants, g] }), resp: { work: work.id, next: [nx("check", "Check again; the edits are authorized for this task.", true)], data: { grant: g.id, paths } } };
  },
};
