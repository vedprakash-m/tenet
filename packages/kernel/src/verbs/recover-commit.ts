import { recordCommit } from "../core/attribution.ts";
import { hasDurableCommitAuthority } from "./dirty.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";

export async function recoverCommit(r: Recovery, u: Unresolved) {
  const op = u.op as {
    work: string; parent: string | null; expectedTree: string; paths: string[]; subject: string;
    dirtyDecisions?: Array<{
      path: string; questionInstance: string; itemToken: string; relevantFacts: unknown;
      scopeHash: string; choice: string;
    }>;
  };
  const w = r.state.work[op.work];
  if (!w || !Array.isArray(op.paths) || !hasDurableCommitAuthority(w, op.paths, op.dirtyDecisions)) {
    r.uncertain.push("an interrupted commit lacks matching durable whole-file inclusion authority");
    return;
  }
  const res = await r.ports.git.reconcileCommit(op.parent, op.expectedTree, op.paths, w?.label);
  if (res.completed && res.commit) {
    if (w) {
      r.state = {
        ...r.state,
        work: { ...r.state.work, [w.id]: recordCommit(w, { commit: res.commit, foreign: [] }, op.paths) },
      };
    }
    r.tx.result("commit", u.id, { completed: true, commit: res.commit, foreign: [] });
    r.completed.push(`commit ${res.commit.slice(0, 8)} had landed before the result was recorded`);
  } else if ((await r.ports.git.refCommit("HEAD")) !== op.parent) {
    r.uncertain.push("an interrupted commit cannot be reconciled against the current HEAD");
  } else {
    r.tx.result("commit", u.id, { completed: false });
    r.completed.push("an interrupted commit did not happen");
  }
}
