// Recovery before anything else touches a resource (TS §7.4): an intent without a result is uncertain, never "did not
// happen", and is reconciled from its postcondition. Interrupted runs are stopped and discarded.
import { scaffolded } from "../decisions/scaffold.ts";
import type { ScaffoldOp } from "../decisions/scaffold.ts";
import type { UndoOp } from "../decisions/undo.ts";

export interface IntegrationOp { work: string; base: string; baseBefore: string; workTip: string }
import type { State, WorkContract } from "../core/schemas.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";

export interface Recovered { state: State; completed: string[]; uncertain: string[] }

export async function recover(ports: Ports, tx: Tx, state: State): Promise<Recovered> {
  const completed: string[] = [], uncertain: string[] = [];
  let next = state;
  const put = (w: WorkContract) => { next = { ...next, work: { ...next.work, [w.id]: w } }; };

  const applyIntegration = (w: WorkContract, op: IntegrationOp, commit: string, moved: boolean) =>
    put({ ...w, git: { ...w.git, integrated: { into: op.base, commit, moved, validated: !moved } } });

  const applyScaffold = (w: WorkContract, op: ScaffoldOp) => {
    put(scaffolded(w, op.expected, op.protect));
    next = { ...next, project: { ...next.project, recipe: next.project.recipe ?? { ...op.recipe, installed: false } } };
  };

  // 1. a check whose kernel died: stop its process group if the identity still matches, and discard the run
  for (const w of Object.values(state.work)) {
    const c = w.session.inCall;
    if (!c) continue;
    const alive = c.pid !== undefined && c.procStart !== undefined && (await ports.store.alive(c.pid, c.procStart));
    if (alive) continue; // a live holder: the pipeline reports work-busy where it matters
    const stopped = c.runDir ? await ports.runner.stopRun(c.runDir) : "unknown";
    completed.push(`discarded the interrupted ${c.verb} (${stopped === "stopped" ? "its processes were stopped" : stopped === "gone" ? "its processes had ended" : "no process record; an orphan may exist"})`);
    put({ ...w, state: w.state === "checking" ? (w.lastValidPhase ?? "executing") : w.state, session: { generation: w.session.generation, ...(w.session.last ? { last: w.session.last } : {}) } });
  }

  // 2. effects with an intent and no result
  for (const u of tx.unresolved()) {
    if (u.effect === "commit") {
      const op = u.op as { work: string; parent: string | null; expectedTree: string; paths: string[]; subject: string };
      const r = await ports.git.reconcileCommit(op.parent, op.expectedTree, op.paths);
      const w = next.work[op.work];
      if (r.completed && r.commit) {
        if (w) put({ ...w, git: { ...w.git, commits: w.git.commits.includes(r.commit) ? w.git.commits : [...w.git.commits, r.commit], committed: [...new Set([...w.git.committed, ...op.paths])] } });
        tx.result("commit", u.id, { completed: true, commit: r.commit });
        completed.push(`commit ${r.commit.slice(0, 8)} had landed before the result was recorded`);
      } else {
        tx.result("commit", u.id, { completed: false });
        completed.push("an interrupted commit did not happen");
      }
    } else if (u.effect === "integration") {
      const op = u.op as IntegrationOp;
      const r = await ports.git.reconcileIntegration(op.base, op.baseBefore, op.workTip);
      const w = next.work[op.work];
      if (r.completed && r.commit && w) {
        applyIntegration(w, op, r.commit, r.mode === "merge");
        tx.result("integration", u.id, { completed: true, commit: r.commit, mode: r.mode });
        completed.push(`the integration into ${op.base} had landed before the result was recorded`);
      } else {
        tx.result("integration", u.id, { completed: false });
        completed.push("an interrupted integration did not happen");
      }
    } else if (u.effect === "undo") {
      // The revert contract was published before the patch was applied, so an interrupted undo rolls forward.
      const op = u.op as UndoOp;
      if (!next.work[op.work]) { tx.result("undo", u.id, { completed: false }); completed.push("an interrupted undo did not happen"); continue; }
      const here = await ports.git.inventory([]);
      const at = (p: string) => here.entries.get(p)?.blob ?? null;
      const todo = op.paths.filter((p) => at(p) !== op.post[p]);
      if (todo.some((p) => at(p) !== op.pre[p])) { tx.result("undo", u.id, { completed: false, uncertain: true }); uncertain.push(`the undo touched files that have since changed (${todo.slice(0, 3).join(", ")})`); continue; }
      const patch = ports.store.readBlob(op.patch);
      const ok = !todo.length || (!!patch && (await ports.git.applyPatch(patch, todo)).ok);
      tx.result("undo", u.id, { completed: ok });
      (ok ? completed : uncertain).push(ok ? (todo.length ? "an interrupted undo was finished" : "the undo had been applied before the result was recorded") : "an interrupted undo could not be finished");
    } else if (u.effect === "scaffold") {
      const op = u.op as ScaffoldOp;
      const paths = Object.keys(op.expected);
      const now = ports.project.hashes(paths);
      const same = paths.filter((p) => now[p] === op.expected[p]);
      const w = next.work[op.work];
      if (paths.some((p) => now[p] !== null && now[p] !== op.expected[p])) {
        tx.result("scaffold", u.id, { completed: false, uncertain: true });
        uncertain.push(`the scaffold wrote files that have since changed (${paths.filter((p) => now[p] !== null && now[p] !== op.expected[p]).slice(0, 3).join(", ")})`);
      } else if (same.length === paths.length) {
        if (w) applyScaffold(w, op);
        tx.result("scaffold", u.id, { completed: true, files: paths.length });
        completed.push("the scaffold had been written before the result was recorded");
      } else {
        ports.project.remove(same); // a partial write is rolled back: every file removed here is exactly one we created
        tx.result("scaffold", u.id, { completed: false });
        completed.push(same.length ? "an interrupted scaffold was rolled back" : "an interrupted scaffold did not happen");
      }
    } else {
      tx.result(u.effect, u.id, { completed: false, note: "unreconciled" });
      uncertain.push(`${u.effect} ${u.id}`);
    }
  }
  // 3. a result that was logged but never published: apply it to state, idempotently (TS §7.4)
  const log = tx.recent(400);
  for (const r of log) {
    const out = r.outcome as { completed?: boolean; commit?: string } | undefined;
    if (r.kind === "result" && r.effect === "scaffold" && out?.completed) {
      const op = log.find((e) => e.kind === "intent" && e.effect === "scaffold" && e.id === r.id)?.op as ScaffoldOp | undefined;
      const w = op && next.work[op.work];
      if (w && op && !w.touched.some((t) => t.path in op.expected)) { applyScaffold(w, op); completed.push("the scaffold was recorded as done but not yet in the contract; it is now"); }
      continue;
    }
    if (r.kind === "result" && r.effect === "integration" && out?.completed && (r.outcome as { commit?: string }).commit) {
      const intent = log.find((e) => e.kind === "intent" && e.effect === "integration" && e.id === r.id);
      const op = intent?.op as IntegrationOp | undefined;
      const w = op && next.work[op.work];
      const commit = (r.outcome as { commit: string; mode?: string }).commit;
      if (w && op && !w.git.integrated) { applyIntegration(w, op, commit, (r.outcome as { mode?: string }).mode === "merge"); completed.push("the integration was recorded as done but not yet in the contract; it is now"); }
      continue;
    }
    if (r.kind !== "result" || r.effect !== "commit" || !out?.completed || !out.commit) continue;
    const intent = log.find((e) => e.kind === "intent" && e.effect === "commit" && e.id === r.id);
    const w = intent && next.work[(intent.op as { work: string }).work];
    if (!w || w.git.commits.includes(out.commit)) continue;
    put({ ...w, git: { ...w.git, commits: [...w.git.commits, out.commit], committed: [...new Set([...w.git.committed, ...(intent!.op as { paths: string[] }).paths])] } });
    completed.push(`commit ${out.commit.slice(0, 8)} was recorded as done but not yet in the contract; it is now`);
  }
  return { state: next, completed, uncertain };
}

/** A plan that publishes nothing still must publish what recovery repaired. */
export const keepRecovered = (plan: Plan, rec: Recovered, original: State): Plan =>
  plan.state || rec.state === original ? plan : { ...plan, state: rec.state };
