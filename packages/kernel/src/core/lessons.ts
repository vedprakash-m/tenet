// Lessons (TS §8.9): pure rules. A lesson is advice carried into packets as text; it never becomes an obligation,
// a permission, an evaluator or a floor (LRN-05), so nothing here touches a contract's authority.
import { z } from "zod";
import type { Question, State, WorkContract } from "./schemas.ts";
import { elementId, hashOf, highestSeq } from "./ids.ts";
import { KernelError } from "./errors.ts";

export const Lesson = z.strictObject({
  id: z.string(), statement: z.string(), scope: z.enum(["task", "project"]), work: z.string().optional(),
  state: z.enum(["active", "retired"]), evidence: z.string().default(""), anchors: z.array(z.string()).default([]),
  provenance: z.strictObject({ quote: z.string(), at: z.string() }), expiresAt: z.string().optional(),
});
export type Lesson = z.infer<typeof Lesson>;

/** The proposal body; strict, so a field that would carry authority is refused rather than ignored. */
const LessonBody = z.strictObject({
  statement: z.string().trim().min(1).max(400), scope: z.enum(["task", "project"]).default("project"),
  evidence: z.string().max(400).default(""), anchors: z.array(z.string()).max(10).default([]),
  retires: z.array(z.string()).max(10).default([]), expiresAt: z.string().optional(),
});

export const LESSON_TOKEN_BUDGET = 1_500;
const tokens = (s: string): number => Math.ceil((s.length / 4) * 1.1);

/** Records a lesson from the user's words and retires those it replaces; a repeat of an active lesson changes nothing. */
export function addLesson(
  state: State, w: Pick<WorkContract, "id">, at: { now: string; suffix: string }, quote: string | undefined, propose: unknown
): { lessons: Lesson[]; id: string; changed: boolean } {
  if (!quote?.trim()) throw new KernelError("authority-needed", "a lesson keeps the user's own words: pass them as the quote", { exit: 2 });
  const r = LessonBody.safeParse(propose);
  if (!r.success) {
    const issue = r.error.issues[0]!;
    throw new KernelError("restriction-key-unknown", `lesson: ${issue.path.join(".") || "body"}: ${issue.message}`, { exit: 2 });
  }
  const b = r.data;
  const mine = (l: Lesson) => b.scope === "project" || l.work === w.id;
  const same = state.lessons.find((l) => l.state === "active" && l.statement === b.statement && l.scope === b.scope && mine(l));
  if (same) return { lessons: state.lessons, id: same.id, changed: false };
  const unknown = b.retires.find((id) => !state.lessons.some((l) => l.id === id));
  if (unknown) throw new KernelError("restriction-key-unknown", `there is no lesson ${unknown} to retire`, { exit: 2 });
  const id = elementId("LSN", highestSeq(state.lessons) + 1, at.suffix);
  const added: Lesson = {
    id, statement: b.statement, scope: b.scope, ...(b.scope === "task" ? { work: w.id } : {}), state: "active",
    evidence: b.evidence, anchors: b.anchors, provenance: { quote: quote.slice(0, 200), at: at.now },
    ...(b.expiresAt ? { expiresAt: b.expiresAt } : {}),
  };
  const kept = state.lessons.map((l) => (b.retires.includes(l.id) ? { ...l, state: "retired" as const } : l));
  return { lessons: [...kept, added], id, changed: true };
}

/** Active lessons that apply to a contract: every project lesson and this contract's own task lessons. */
export const activeLessons = (state: Pick<State, "lessons">, w: Pick<WorkContract, "id">, now: string): Lesson[] =>
  state.lessons.filter(
    (l) => l.state === "active" && (l.scope === "project" || l.work === w.id) && (!l.expiresAt || l.expiresAt > now)
  );

/** The lesson excerpt for a rubric, newest kept first, cut to the budget (TS §8.1). Empty when nothing applies. */
export function lessonExcerpt(lessons: readonly Lesson[]): string {
  const kept: string[] = [];
  for (const l of [...lessons].reverse()) {
    if (tokens([`- ${l.statement}`, ...kept].join("\n")) > LESSON_TOKEN_BUDGET) break;
    kept.unshift(`- ${l.statement}`);
  }
  return kept.length ? `\n\nProject lessons (advice from the user; they never change what is required):\n${kept.join("\n")}` : "";
}

/** The state without a lesson and without cached last responses: any of them may quote it, and a replay must not return it. */
export const withoutLesson = (state: State, id: string): State => ({
  ...state,
  lessons: state.lessons.filter((l) => l.id !== id),
  work: Object.fromEntries(
    Object.entries(state.work).map(([k, w]) => [k, w.session.last ? { ...w, session: { ...w.session, last: undefined } } : w])
  ),
});

export const OUTSIDE = "Copies already sent to the host's model are outside Tenet's control; the host's own memory is not touched.";

/** What the user is shown before a lesson is forgotten: the exact text, where it lives, and what Tenet cannot reach. */
export function forgetPreview(l: Lesson): { question: Question; preview: Record<string, string> } {
  const keep = { label: "Keep it", description: "Change nothing" };
  const forget = { label: "Forget it", description: "Remove every copy Tenet controls", recommended: true };
  return {
    question: {
      id: "forget-confirm", header: "Forget lesson", channel: "native", options: [forget, keep],
      bind: { factsHash: hashOf(l).slice(0, 12) },
      question: `Forget "${l.statement}"? Removed from the state, its backup, cached answers and packets.`,
    },
    preview: { id: l.id, statement: l.statement, scope: l.scope, outside: OUTSIDE },
  };
}
