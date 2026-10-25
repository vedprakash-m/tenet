// `decide plan`: an ordered, editable plan of independently checkable increments (INT-12). The user sees the numbered plan
// once and answers; nothing is recorded before that. Items the proposal leaves out are dropped, and the question says so.
import { z } from "zod";
import { impact } from "../core/impact.ts";
import { KernelError } from "../core/errors.ts";
import { highestSeq } from "../core/ids.ts";
import { buildPlan } from "../core/plan.ts";
import { factsHash, nx, question, withWork } from "../verbs/common.ts";
import type { Decision } from "./types.ts";

const Proposal = z.object({
  items: z.array(z.object({
    ref: z.string().optional(), id: z.string().optional(), outcome: z.string().min(1).max(300), check: z.string().max(300),
    elementIds: z.array(z.string()).optional(), dependsOn: z.array(z.string()).optional(),
  })).min(1).max(30),
});

export const plan: Decision = {
  kind: "plan",
  run({ ports, state, work, input }) {
    const r = Proposal.safeParse(input.propose);
    if (!r.success) throw new KernelError("plan-invalid", `${r.error.issues[0]!.path.join(".") || "body"}: ${r.error.issues[0]!.message}`, { exit: 2 });
    const intent = state.project.intent;
    const built = buildPlan(intent.plan, r.data.items, highestSeq([...intent.elements, ...intent.plan]), () => ports.rand.base32(3));
    if (!built.ok) throw new KernelError("plan-invalid", built.message, { exit: 2 });
    if (!built.changed.length) return { resp: { work: work.id, next: [], data: { changed: false } } };

    const facts = factsHash({ plan: intent.plan.map((i) => [i.id, i.state]), items: r.data.items });
    const answer = input.answers?.["plan-confirm"];
    const pending = state.pending.find((q) => q.id === "plan-confirm");
    const rest = state.pending.filter((q) => q.id !== "plan-confirm");
    if (answer === undefined) {
      const lines = built.items.filter((i) => i.state !== "dropped" && i.state !== "done").map((i, n) => `${n + 1}. ${i.outcome} (checked by ${i.check})${i.dependsOn.length ? `, after ${i.dependsOn.length} other${i.dependsOn.length === 1 ? "" : "s"}` : ""}`);
      const dropped = built.items.filter((i) => built.changed.includes(i.id) && i.state === "dropped");
      const q = question({ id: "plan-confirm", header: "Confirm the plan", bind: { factsHash: facts }, question: `${lines.join("\n")}${dropped.length ? `\nThis drops: ${dropped.map((i) => i.outcome).join("; ")}.` : ""}`,
        options: [{ label: "Yes, that plan", description: "Record it; each item then gets its own contract.", recommended: true }, { label: "Change something", description: "Tell me what to adjust; nothing is recorded yet." }] });
      const shown = impact(state, built.changed); // INT-08: what an edit or drop reaches, before it is recorded
      return { state: { ...state, pending: [...rest, q] }, resp: { work: work.id, exit: 3, questions: [q], data: { impact: shown }, next: [nx("ask", "Ask the user, then answer with --answer plan-confirm=confirm.", true)] } };
    }
    if (answer !== "confirm") return { state: { ...state, pending: rest }, resp: { work: work.id, next: [nx("plan", "Revise the plan as the user asked.", true)] } };
    if (!pending || pending.bind.factsHash !== facts) throw new KernelError("plan-invalid", "the proposal changed since the question was asked; ask again", { exit: 3 });
    const items = built.items.map((i) => (built.changed.includes(i.id) && i.state === "proposed" ? { ...i, state: "accepted" as const } : i));
    const next = { ...state, pending: rest, project: { ...state.project, intent: { ...intent, revision: intent.revision + 1, plan: items } } };
    return { state: withWork(next, work), resp: { work: work.id, next: [], data: { changed: true, items: items.map((i) => ({ id: i.id, outcome: i.outcome, state: i.state })) } } };
  },
};
