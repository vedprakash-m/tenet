// `decide decision-record`: a decision the user made, kept with its context and consequences under a stable DEC ID (INT-10).
// It carries the user's own words, as a grant does; the record shows in INTENT.md once the intent is adopted.
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { elementId, highestSeq } from "../core/ids.ts";
import { withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const Body = z.object({
  title: z.string().min(1).max(120), context: z.string().min(1).max(800), decision: z.string().min(1).max(600), consequences: z.string().max(800).default(""),
  alternatives: z.array(z.object({ option: z.string().min(1).max(120), why: z.string().max(400) })).max(8).default([]),
  supersedes: z.string().optional(), links: z.array(z.string()).max(20).default([]),
});

export const decisionRecord: Decision = {
  kind: "decision-record",
  run({ ports, state, work, input }) {
    if (!input.quote?.trim()) throw new KernelError("authority-needed", "a decision record keeps the user's own words: pass them as the quote", { exit: 2 });
    const r = Body.safeParse(input.propose);
    if (!r.success) throw new KernelError("restriction-key-unknown", `decision-record: ${r.error.issues[0]!.path.join(".") || "body"}: ${r.error.issues[0]!.message}`, { exit: 2 });
    const intent = state.project.intent;
    const b = r.data;
    const same = intent.records.find((x) => x.title === b.title && x.decision === b.decision && x.context === b.context && x.status === "accepted");
    if (same) return { resp: { work: work.id, next: [], data: { changed: false, id: same.id } } };
    if (b.supersedes && !intent.records.some((x) => x.id === b.supersedes)) throw new KernelError("restriction-key-unknown", `there is no decision ${b.supersedes} to supersede`, { exit: 2 });
    const id = elementId("DEC", highestSeq([...intent.elements, ...intent.plan]) + 1, ports.rand.base32(3));
    const record = { id, title: b.title, status: "accepted" as const, date: ports.clock.now(), context: b.context, decision: b.decision, consequences: b.consequences, alternatives: b.alternatives, ...(b.supersedes ? { supersedes: b.supersedes } : {}), links: b.links, quote: input.quote.slice(0, 200) };
    const records = [...intent.records.map((x) => (x.id === b.supersedes ? { ...x, status: "superseded" as const } : x)), record];
    const element = { id, origin: "request" as const, kind: "decision" as const, text: `${b.title}: ${b.decision}`, verifiedBy: { notApplicable: "a decision carries no check of its own" } };
    const next = { ...state, project: { ...state.project, intent: { ...intent, revision: intent.revision + 1, elements: [...intent.elements, element], records } } };
    return { state: withWork(next, work), resp: { work: work.id, next: [], data: { changed: true, id } } };
  },
};
