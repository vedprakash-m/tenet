// `decide overview`: the project's purpose, users, preferences and non-goals (INT-02). Fields not named are kept; a repeat
// that changes nothing makes no revision of the intent.
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const Overview = z.object({
  purpose: z.string().min(1).max(600).optional(), users: z.string().min(1).max(400).optional(),
  preferences: z.array(z.string().max(200)).max(20).optional(), nonGoals: z.array(z.string().max(200)).max(20).optional(),
});

export const overview: Decision = {
  kind: "overview",
  run({ state, work, input }) {
    const r = Overview.safeParse(input.propose);
    if (!r.success) throw new KernelError("restriction-key-unknown", `overview: ${r.error.issues[0]!.path.join(".") || "body"}: ${r.error.issues[0]!.message}`, { exit: 2 });
    const intent = state.project.intent;
    const merged = { ...intent.overview, ...Object.fromEntries(Object.entries(r.data).filter(([, v]) => v !== undefined)) };
    if (JSON.stringify(merged) === JSON.stringify(intent.overview)) return { resp: { work: work.id, next: [], data: { changed: false } } };
    const next = { ...state, project: { ...state.project, intent: { ...intent, revision: intent.revision + 1, overview: merged } } };
    return { state: withWork(next, work), resp: { work: work.id, next: [], data: { changed: true, overview: merged } } };
  },
};
