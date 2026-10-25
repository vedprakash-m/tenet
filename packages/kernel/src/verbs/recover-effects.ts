// One reconciler per effect (TS §7.4). `settle` decides what an intent with no result left behind, from its postcondition:
// completed, not performed, or uncertain. `publish` applies a result that was logged but never reached the state document.
import { adopted, type AdoptOp } from "../decisions/adopt.ts";
import { restoreFiles, type DependencyOp } from "../decisions/dependency.ts";
import { scaffolded, type ScaffoldOp } from "../decisions/scaffold.ts";
import type { UndoOp } from "../decisions/undo.ts";
import { recordCommit, replayCommit } from "../core/attribution.ts";
import { adoptionReplayNeeded } from "../core/state.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Ports, Tx } from "../ports/types.ts";

export interface IntegrationOp { work: string; base: string; baseBefore: string; workTip: string }
export type Unresolved = ReturnType<Tx["unresolved"]>[number];
export type Outcome = { completed?: boolean; commit?: string; mode?: string; foreign?: unknown };
export interface Recovery { ports: Ports; tx: Tx; state: State; completed: string[]; uncertain: string[] }

const put = (r: Recovery, w: WorkContract) => { r.state = { ...r.state, work: { ...r.state.work, [w.id]: w } }; };
const withGit = (r: Recovery, w: WorkContract, git: Partial<WorkContract["git"]>) => put(r, { ...w, git: { ...w.git, ...git } });
const applyIntegration = (r: Recovery, w: WorkContract, op: IntegrationOp, commit: string, moved: boolean) =>
  withGit(r, w, { integrated: { into: op.base, commit, moved, validated: !moved } });
function applyScaffold(r: Recovery, w: WorkContract, op: ScaffoldOp) {
  put(r, scaffolded(w, op.expected, op.protect, op.recipe.checks ?? []));
  r.state = { ...r.state, project: { ...r.state.project, recipe: r.state.project.recipe ?? { ...op.recipe, installed: false } } };
}

async function indexSync(r: Recovery, u: Unresolved) {
  const op = u.op as { work?: unknown; sync?: unknown } | null;
  const id = `index-${r.ports.rand.base32(10)}`;
  if (!op || typeof op.work !== "string") {
    r.uncertain.push("the interrupted index sync has a malformed intent; its lock was left untouched");
    return;
  }
  const workId = op.work;
  const status = await r.ports.git.recoverIndexSync(op.sync, {
    owner: r.ports.store.self(),
    intent: async (sync) => { r.tx.intent("index-sync", id, { work: workId, sync }); },
    result: async (s) => { r.tx.result("index-sync", id, { status: s }); },
  });
  if (status === "uncertain") {
    r.uncertain.push("the interrupted index sync has no trusted dead process identity; its lock was left untouched");
    return;
  }
  r.tx.result("index-sync", u.id, { status });
  r.completed.push(status === "untouched"
    ? "index recovery left the current index untouched; review the current commit/lock and retry decide sync-index"
    : "the interrupted index sync was reconciled without changing human staging");
}

async function commit(r: Recovery, u: Unresolved) {
  const op = u.op as { work: string; parent: string | null; expectedTree: string; paths: string[]; subject: string };
  const w = r.state.work[op.work];
  const res = await r.ports.git.reconcileCommit(op.parent, op.expectedTree, op.paths, w?.label);
  if (res.completed && res.commit) {
    if (w) put(r, recordCommit(w, { commit: res.commit, foreign: [] }, op.paths));
    r.tx.result("commit", u.id, { completed: true, commit: res.commit, foreign: [] });
    r.completed.push(`commit ${res.commit.slice(0, 8)} had landed before the result was recorded`);
  } else if ((await r.ports.git.refCommit("HEAD")) !== op.parent) {
    r.uncertain.push("an interrupted commit cannot be reconciled against the current HEAD");
  } else {
    r.tx.result("commit", u.id, { completed: false });
    r.completed.push("an interrupted commit did not happen");
  }
}

async function integration(r: Recovery, u: Unresolved) {
  const op = u.op as IntegrationOp;
  const res = await r.ports.git.reconcileIntegration(op.base, op.baseBefore, op.workTip);
  const w = r.state.work[op.work];
  if (res.completed && res.commit && w) {
    applyIntegration(r, w, op, res.commit, res.mode === "merge");
    r.tx.result("integration", u.id, { completed: true, commit: res.commit, mode: res.mode });
    r.completed.push(`the integration into ${op.base} had landed before the result was recorded`);
  } else if ((await r.ports.git.refCommit(op.base)) !== op.baseBefore) {
    r.uncertain.push("an interrupted integration cannot be reconciled against its base branch");
  } else {
    r.tx.result("integration", u.id, { completed: false });
    r.completed.push("an interrupted integration did not happen");
  }
}

/** The contract the undo belonged to is gone (a backup was restored): only a confirmed pre-image proves it never happened. */
async function undoWithoutContract(r: Recovery, u: Unresolved, op: UndoOp) {
  const stopped = op.runDir ? await r.ports.runner.stopRun(op.runDir) : "unknown";
  if (stopped === "unknown") {
    r.uncertain.push("the interrupted undo lost its contract and has uncertain process ownership");
    return;
  }
  const here = await r.ports.git.inventory([]);
  if (op.paths.every((p) => (here.entries.get(p)?.blob ?? null) === op.pre[p])) {
    r.tx.result("undo", u.id, { completed: false });
    r.completed.push("an interrupted undo did not happen");
  } else {
    r.uncertain.push("the interrupted undo may have landed but recovery lost its contract; review the current tree");
  }
}

async function undo(r: Recovery, u: Unresolved) {
  const op = u.op as UndoOp;
  if (!r.state.work[op.work]) return undoWithoutContract(r, u, op);
  const here = await r.ports.git.inventory([]);
  const at = (p: string) => here.entries.get(p)?.blob ?? null;
  const todo = op.paths.filter((p) => at(p) !== op.post[p]);
  if (todo.some((p) => at(p) !== op.pre[p])) {
    r.uncertain.push(`the undo touched files that have since changed (${todo.slice(0, 3).join(", ")})`);
    return;
  }
  const patch = r.ports.store.readBlob(op.patch);
  const runOpts = op.runDir ? { runDir: op.runDir, timeoutMs: 60_000 } : undefined;
  const ok = !todo.length || (!!patch && (await r.ports.git.applyPatch(patch, todo, runOpts)).ok);
  if (ok) r.tx.result("undo", u.id, { completed: true });
  if (!ok) { r.uncertain.push("an interrupted undo could not be finished"); return; }
  r.completed.push(todo.length ? "an interrupted undo was finished" : "the undo had been applied before the result was recorded");
}

async function scaffold(r: Recovery, u: Unresolved) {
  const op = u.op as ScaffoldOp;
  const paths = Object.keys(op.expected);
  let now: Record<string, string | null>;
  try { now = r.ports.project.hashes(paths); }
  catch {
    r.uncertain.push("the scaffold postcondition cannot be read safely; no rollback was attempted");
    return;
  }
  const same = paths.filter((p) => now[p] === op.expected[p]);
  const modified = paths.filter((p) => now[p] !== null && now[p] !== op.expected[p]);
  if (modified.length) {
    r.uncertain.push(`the scaffold wrote files that have since changed (${modified.slice(0, 3).join(", ")})`);
  } else if (same.length === paths.length) {
    const w = r.state.work[op.work];
    if (w) applyScaffold(r, w, op);
    r.tx.result("scaffold", u.id, { completed: true, files: paths.length });
    r.completed.push("the scaffold had been written before the result was recorded");
  } else {
    r.ports.project.remove(same);
    r.tx.result("scaffold", u.id, { completed: false });
    r.completed.push(same.length ? "an interrupted scaffold was rolled back" : "an interrupted scaffold did not happen");
  }
}

async function adopt(r: Recovery, u: Unresolved) {
  const op = u.op as AdoptOp;
  let here: string | null | undefined;
  try { here = r.ports.project.hashes([op.file])[op.file]; }
  catch {
    r.uncertain.push(`the interrupted write of ${op.file} has an unreadable postcondition; it remains unresolved`);
    return;
  }
  if (here === op.after) {
    r.state = adopted(r.state, op);
    r.tx.result("adopt", u.id, { completed: true });
    r.completed.push(`${op.file} had been written before the result was recorded`);
  } else if (here === op.before) {
    r.tx.result("adopt", u.id, { completed: false });
    r.completed.push(`an interrupted write of ${op.file} did not happen`);
  } else {
    r.uncertain.push(`the interrupted write of ${op.file} has an unknown postcondition`);
  }
}

async function dependency(r: Recovery, u: Unresolved) {
  const op = u.op as DependencyOp;
  if (op.phase === "resolve" && op.before) {
    try {
      restoreFiles(r.ports, op.before, op.manager);
      r.tx.result("dependency", u.id, { completed: false });
      r.completed.push("an interrupted dependency resolution was rolled back");
    } catch {
      r.uncertain.push("the interrupted dependency resolution could not be rolled back safely");
    }
  } else if (op.phase === "install" && !op.scripts?.length) {
    r.tx.result("dependency", u.id, { completed: false });
    r.completed.push("an interrupted dependency install did not finish; answer again to retry");
  } else {
    r.uncertain.push("an interrupted dependency install was running install scripts; inspect node_modules before continuing");
  }
}

async function branch(r: Recovery, u: Unresolved) {
  const op = u.op as { work: string; from: string | null; to: string };
  const now = (await r.ports.git.probe()).branch;
  const w = r.state.work[op.work];
  if (now === op.to) {
    if (w) withGit(r, w, { branch: op.to });
    r.tx.result("branch", u.id, { completed: true, branch: op.to });
    r.completed.push(`branch ${op.to} had been created before the result was recorded`);
  } else if (now === op.from) {
    r.tx.result("branch", u.id, { completed: false });
    r.completed.push("an interrupted branch switch did not happen");
  } else {
    r.uncertain.push(`an interrupted branch switch left the repository on ${now ?? "detached HEAD"}`);
  }
}

export const SETTLE: Record<string, (r: Recovery, u: Unresolved) => Promise<void>> = {
  "index-sync": indexSync, commit, integration, undo, scaffold, adopt, dependency, branch,
};

/** A result that was logged but never published is applied to state, once (TS §7.4). */
export const PUBLISH: Record<string, (r: Recovery, op: unknown, out: Outcome) => void> = {
  scaffold(r, o) {
    const op = o as ScaffoldOp, w = r.state.work[op.work];
    if (!w || Object.keys(op.expected).every(path => path in w.vetted)) return;
    applyScaffold(r, w, op);
    r.completed.push("the scaffold was recorded as done but not yet in the contract; it is now");
  },
  adopt(r, o) {
    const op = o as AdoptOp;
    if (!adoptionReplayNeeded(r.state, op)) return;
    r.state = adopted(r.state, op);
    r.completed.push(`${op.file} was recorded as written but not yet adopted; it is now`);
  },
  branch(r, o) {
    const op = o as { work: string; to: string }, w = r.state.work[op.work];
    if (!w || w.git.branch === op.to) return;
    withGit(r, w, { branch: op.to });
    r.completed.push(`branch ${op.to} was recorded as created but not yet in the contract; it is now`);
  },
  integration(r, o, out) {
    const op = o as IntegrationOp, w = r.state.work[op.work];
    if (!w || !out.commit || w.git.integrated) return;
    applyIntegration(r, w, op, out.commit, out.mode === "merge");
    r.completed.push("the integration was recorded as done but not yet in the contract; it is now");
  },
  commit(r, o, out) {
    const op = o as { work: string; paths: string[] }, w = r.state.work[op.work];
    if (!w) return;
    const next = replayCommit(w, out, op.paths);
    if (!next) r.uncertain.push("recorded commit lacks foreign-path proof; inspect its effects");
    else if (next !== w) {
      put(r, next);
      r.completed.push(`commit ${out.commit!.slice(0, 8)} was recorded as done but not yet in the contract; it is now`);
    }
  },
};
