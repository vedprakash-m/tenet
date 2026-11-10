// GIT-09: when integration conflicts only in INTENT.md, Tenet merges it by element ID from the merge base and both tips and
// proposes the result. The proposal is bound to both tips and the exact text; it is applied only on the answer to it.
import { sha256 } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import { mergeShared } from "../core/shared-merge.ts";
import type { Collision } from "../core/shared-merge.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, nx, question } from "./common.ts";

/** Tenet's shared file that integration reconciles by ID; other shared files keep Git's own conflict. */
export const SHARED_INTENT = "INTENT.md";
const MAX_SHARED = 256 * 1024;

type Proposal = { text: string; collisions: Collision[]; facts: string };

/** INTENT.md merged by ID, bound to both tips and the exact text; null when there is no merge base or no clean merge by ID. */
async function sharedProposal(ports: Ports, baseTip: string, workTip: string): Promise<Proposal | null> {
  const mb = await ports.git.mergeBase(baseTip, workTip);
  if (!mb) return null;
  const [b, o, t] = await Promise.all([mb, baseTip, workTip].map((r) => ports.git.showAt(r, SHARED_INTENT)));
  if (o == null || t == null || [b, o, t].some((x) => (x?.length ?? 0) > MAX_SHARED)) return null;
  const m = mergeShared(b ?? null, o, t);
  if (!m.ok) return null;
  return { text: m.text, collisions: m.collisions, facts: factsHash({ baseTip, workTip, path: SHARED_INTENT, text: sha256(m.text) }) };
}

const clip = (s: string | null) => (s === null ? null : s.length > 2048 ? `${s.slice(0, 2048)}…` : s);

function mergeQuestion(base: string, p: Proposal): Question {
  const n = p.collisions.length;
  const found = n ? ` and found ${n} ID collision${n > 1 ? "s" : ""}` : "";
  return question({
    id: "shared-merge",
    header: "Shared files",
    bind: { factsHash: p.facts },
    question: `Integrating into ${base} conflicts only in ${SHARED_INTENT}. Tenet merged it by ID${found}; `
      + "the proposed text is shown. Use it in the merge?",
    options: [
      { label: "Use the merged INTENT.md", description: "Integrate now; the merge commit holds exactly the text shown.",
        recommended: true },
      { label: "Not now", description: "Nothing moves; resolve INTENT.md on the work branch yourself and integrate again." },
    ],
  });
}

type Where = { st: State; w: WorkContract; base: string; baseTip: string; workTip: string; dirty: readonly string[] };

/** The question with the current proposal, the confirmed text to merge with, or null when Git's own conflict must stand. */
export async function sharedMerge(ports: Ports, at: Where, agreed?: string): Promise<Plan | Record<string, string> | null> {
  const p = at.dirty.includes(SHARED_INTENT) ? null : await sharedProposal(ports, at.baseTip, at.workTip);
  if (!p) return null;
  if (agreed === p.facts) return { [SHARED_INTENT]: p.text };
  const q = mergeQuestion(at.base, p);
  const collisions = p.collisions.map((c) =>
    ({ ...c, base: clip(c.base), ours: clip(c.ours), theirs: clip(c.theirs), proposed: clip(c.proposed) }));
  const listed = p.collisions.map((c) => `${c.kind} ${c.id}${c.renamedTo ? ` -> ${c.renamedTo}` : ""}`).join(", ");
  return {
    state: { ...at.st, pending: [...at.st.pending.filter((x) => x.id !== q.id), q] },
    resp: {
      work: at.w.id,
      exit: 3,
      questions: [q],
      reasons: [reason("shared-merge-proposed", `${SHARED_INTENT}: ${listed || "no ID collisions"}`)],
      data: { proposal: { path: SHARED_INTENT, text: p.text, collisions } },
      next: [nx("ask", "Show the user the proposed INTENT.md and its collisions, then ask.", true)],
    },
  };
}
