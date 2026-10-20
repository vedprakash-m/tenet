// `undo`: preview the inverse of a work's commits against the current state (TS §10.5, GIT-04). It applies nothing: the
// preview ends in one question, and `decide undo-confirm` applies the inverse to the working tree only. Later changes
// survive because the inverse is applied as a patch, never as a restore of old contents.
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { UndoInput } from "../core/schemas.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import type { Verb } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, nx, question, workOf } from "./common.ts";
import { gather, worldDigest } from "./facts.ts";

export interface UndoPlan {
  commits: string[];
  tree: string;
  patch: string;
  paths: string[];
  stat: string;
  later: string[];
}

/** The inverse of this work's commits, or the reason it cannot be made. Reads only; changes nothing. */
export async function planUndo(ports: Ports, st: State, w: WorkContract): Promise<UndoPlan> {
  if (w.git.mode !== "git") throw new KernelError("capability-missing", "undo needs the work to be committed in a Git repository", { exit: 2 });
  if (w.git.undoneBy) throw new KernelError("undo-conflict", `this work was already reverted by ${w.git.undoneBy}`, { exit: 2 });
  const found = await ports.git.workCommits(w.label);
  if (found.shallow) throw new KernelError("undo-conflict", "this is a shallow clone, so the work's history may be incomplete");
  if (found.merges) throw new KernelError("undo-conflict", "a commit of this work is a merge commit; undoing it needs a person");
  if (!found.commits.length || w.git.commits.some((c) => !found.commits.includes(c))) {
    throw new KernelError("capability-missing", "the work's commits are not all on the current branch; switch to the branch they are on", { exit: 2 });
  }
  const plan = await ports.git.planUndo(found.commits);
  if (!plan.ok) throw new KernelError("undo-conflict", `a later change overlaps: ${plan.conflict.join(", ") || plan.detail}`);
  const facts = await gather(ports, w, st.locks);
  const mine = facts.inv.status.map((s) => s.path).filter((p) => plan.paths.includes(p));
  if (mine.length) throw new KernelError("undo-conflict", `you have uncommitted changes in ${mine.slice(0, 4).join(", ")}; commit or set them aside first`);
  return {
    commits: found.commits,
    tree: plan.tree,
    patch: plan.patch,
    paths: plan.paths,
    stat: plan.stat,
    later: await ports.git.laterCommits(found.commits[0]!, plan.paths),
  };
}

export const undoFacts = (p: Pick<UndoPlan, "tree" | "paths">) => factsHash({ tree: p.tree, paths: p.paths });

export const undoQuestion = (w: WorkContract, p: UndoPlan): Question =>
  question({
    id: "undo-confirm",
    header: "Undo",
    channel: "chat",
    bind: { factsHash: undoFacts(p) },
    question: `Undo ${w.label}? This reverts ${p.paths.length} file${p.paths.length === 1 ? "" : "s"} (${p.stat}) in your working tree, then checks and commits the revert like any other work. It does not undo databases or anything outside the source. Reply "undo ${w.label}" or "leave it".`,
    options: [
      { label: "Undo", description: "Apply the inverse to the working tree.", recommended: false },
      { label: "Leave it", description: "Change nothing." },
    ],
  });

export const undo: Verb<UndoInput> = {
  name: "undo",
  schema: UndoInput,
  class: () => "mutating",
  editing: () => true,
  identity: worldDigest,
  async run(ports, state, input) {
    const st = state!;
    const w = workOf(st, input.h);
    const plan = await planUndo(ports, st, w);
    const q = undoQuestion(w, plan);
    return {
      state: { ...st, pending: [...st.pending.filter((p) => p.id !== q.id), q] },
      resp: {
        work: w.id,
        exit: 3,
        questions: [q],
        reasons: [reason("approval-gate", "approval mode is unknown; this destructive-action chat gate is advisory, and undo needs your yes")],
        data: { paths: plan.paths, summary: plan.stat, laterChangesTouching: plan.later, notUndone: "databases and external effects" },
        next: [nx("ask", "Show the preview and ask in chat; end your turn.", true)],
      },
    };
  },
};
