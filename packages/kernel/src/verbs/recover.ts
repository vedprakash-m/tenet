// Recovery before anything else touches a resource (TS §7.4): an intent without a result is uncertain, never "did not
// happen", and is reconciled from its postcondition. Interrupted runs are stopped and discarded.
import { adopted, type AdoptOp } from "../decisions/adopt.ts";
import { restoreFiles, type DependencyOp } from "../decisions/dependency.ts";
import { scaffolded, type ScaffoldOp } from "../decisions/scaffold.ts";
import type { UndoOp } from "../decisions/undo.ts";
import type { State, WorkContract } from "../core/schemas.ts";
import type { Ports, Tx } from "../ports/types.ts";

export interface IntegrationOp { work: string; base: string; baseBefore: string; workTip: string }
export interface Recovered { state: State; completed: string[]; uncertain: string[] }

export async function recover(ports: Ports, tx: Tx, state: State, options: { effects?: boolean } = {}): Promise<Recovered> {
  const completed: string[] = [];
  const uncertain: string[] = [];
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
    if (alive && !c.cancelled) continue;
    const stopped = c.runDir ? await ports.runner.stopRun(c.runDir) : "unknown";
    if (stopped === "unknown") {
      uncertain.push(`the interrupted ${c.verb} has no trusted process record; an orphan may exist`);
      put({ ...w, state: "blocked", session: { ...w.session, inCall: { ...c, cancelled: true } } });
      continue;
    }
    completed.push(`discarded the interrupted ${c.verb} (${stopped === "stopped" ? "its processes were stopped" : "its processes had ended"})`);
    const phase = w.state === "checking" ? (w.lastValidPhase ?? "executing") : w.state;
    put({ ...w, state: phase, session: { generation: w.session.generation, ...(w.session.last ? { last: w.session.last } : {}) } });
  }

  // Stop remains available even when policy cannot be loaded. It must not apply or roll back project effects.
  if (options.effects === false) {
    uncertain.push(...tx.unresolved().map((u) => `${u.effect} ${u.id}: postcondition reconciliation is deferred until a policy-aware call`));
    return { state: next, completed, uncertain };
  }

  // 2. effects with an intent and no result
  for (const u of tx.unresolved()) {
    const work = next.work[(u.op as { work?: string } | null)?.work ?? ""];
    const running = work?.session.inCall;
    if (running?.cancelled) {
      uncertain.push(`the interrupted ${u.effect} still has uncertain process ownership`);
      continue;
    }
    if (running?.pid && running.procStart && (await ports.store.alive(running.pid, running.procStart))) continue;
    if (u.effect === "index-sync") {
      const op = u.op as { work?: unknown; sync?: unknown } | null;
      const id = `index-${ports.rand.base32(10)}`;
      if (!op || typeof op.work !== "string") {
        uncertain.push("the interrupted index sync has a malformed intent; its lock was left untouched");
        continue;
      }
      const workId = op.work;
      const status = await ports.git.recoverIndexSync(op.sync, {
        owner: ports.store.self(),
        intent: async (sync) => { tx.intent("index-sync", id, { work: workId, sync }); },
        result: async (status) => { tx.result("index-sync", id, { status }); },
      });
      if (status === "uncertain") {
        uncertain.push("the interrupted index sync has no trusted dead process identity; its lock was left untouched");
      } else {
        tx.result("index-sync", u.id, { status });
        completed.push(status === "untouched" ? "index recovery left the current index untouched; review the current commit/lock and retry decide sync-index" : "the interrupted index sync was reconciled without changing human staging");
      }
    } else if (u.effect === "commit") {
      const op = u.op as { work: string; parent: string | null; expectedTree: string; paths: string[]; subject: string };
      const r = await ports.git.reconcileCommit(op.parent, op.expectedTree, op.paths);
      const w = next.work[op.work];
      if (r.completed && r.commit) {
        if (w) {
          const commits = w.git.commits.includes(r.commit) ? w.git.commits : [...w.git.commits, r.commit];
          put({ ...w, git: { ...w.git, commits, committed: [...new Set([...w.git.committed, ...op.paths])] } });
        }
        tx.result("commit", u.id, { completed: true, commit: r.commit });
        completed.push(`commit ${r.commit.slice(0, 8)} had landed before the result was recorded`);
      } else if ((await ports.git.refCommit("HEAD")) !== op.parent) {
        uncertain.push("an interrupted commit cannot be reconciled against the current HEAD");
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
      } else if ((await ports.git.refCommit(op.base)) !== op.baseBefore) {
        uncertain.push("an interrupted integration cannot be reconciled against its base branch");
      } else {
        tx.result("integration", u.id, { completed: false });
        completed.push("an interrupted integration did not happen");
      }
    } else if (u.effect === "undo") {
      const op = u.op as UndoOp;
      if (!next.work[op.work]) {
        const stopped = op.runDir ? await ports.runner.stopRun(op.runDir) : "unknown";
        if (stopped === "unknown") {
          uncertain.push("the interrupted undo lost its contract and has uncertain process ownership");
          continue;
        }
        const here = await ports.git.inventory([]);
        if (op.paths.every((p) => (here.entries.get(p)?.blob ?? null) === op.pre[p])) {
          tx.result("undo", u.id, { completed: false });
          completed.push("an interrupted undo did not happen");
        } else {
          uncertain.push("the interrupted undo may have landed but recovery lost its contract; review the current tree");
        }
        continue;
      }
      const here = await ports.git.inventory([]);
      const at = (p: string) => here.entries.get(p)?.blob ?? null;
      const todo = op.paths.filter((p) => at(p) !== op.post[p]);
      if (todo.some((p) => at(p) !== op.pre[p])) {
        uncertain.push(`the undo touched files that have since changed (${todo.slice(0, 3).join(", ")})`);
        continue;
      }
      const patch = ports.store.readBlob(op.patch);
      const runOpts = op.runDir ? { runDir: op.runDir, timeoutMs: 60_000 } : undefined;
      const ok = !todo.length || (!!patch && (await ports.git.applyPatch(patch, todo, runOpts)).ok);
      if (ok) tx.result("undo", u.id, { completed: true });
      const msg = ok ? (todo.length ? "an interrupted undo was finished" : "the undo had been applied before the result was recorded") : "an interrupted undo could not be finished";
      (ok ? completed : uncertain).push(msg);
    } else if (u.effect === "scaffold") {
      const op = u.op as ScaffoldOp;
      const paths = Object.keys(op.expected);
      let now: Record<string, string | null>;
      try { now = ports.project.hashes(paths); }
      catch { uncertain.push("the scaffold postcondition cannot be read safely; no rollback was attempted"); continue; }
      const same = paths.filter((p) => now[p] === op.expected[p]);
      const modified = paths.filter((p) => now[p] !== null && now[p] !== op.expected[p]);
      if (modified.length) {
        uncertain.push(`the scaffold wrote files that have since changed (${modified.slice(0, 3).join(", ")})`);
      } else if (same.length === paths.length) {
        if (next.work[op.work]) applyScaffold(next.work[op.work]!, op);
        tx.result("scaffold", u.id, { completed: true, files: paths.length });
        completed.push("the scaffold had been written before the result was recorded");
      } else {
        ports.project.remove(same);
        tx.result("scaffold", u.id, { completed: false });
        completed.push(same.length ? "an interrupted scaffold was rolled back" : "an interrupted scaffold did not happen");
      }
    } else if (u.effect === "adopt") {
      const op = u.op as AdoptOp;
      let here: string | null | undefined;
      try { here = ports.project.hashes([op.file])[op.file]; }
      catch { uncertain.push(`the interrupted write of ${op.file} has an unreadable postcondition; it remains unresolved`); continue; }
      if (here === op.after) {
        next = adopted(next, op);
        tx.result("adopt", u.id, { completed: true });
        completed.push(`${op.file} had been written before the result was recorded`);
      } else if (here === op.before) {
        tx.result("adopt", u.id, { completed: false });
        completed.push(`an interrupted write of ${op.file} did not happen`);
      } else {
        uncertain.push(`the interrupted write of ${op.file} has an unknown postcondition`);
      }
    } else if (u.effect === "dependency") {
      const op = u.op as DependencyOp;
      if (op.phase === "resolve" && op.before) {
        try {
          restoreFiles(ports, op.before);
          tx.result("dependency", u.id, { completed: false });
          completed.push("an interrupted dependency resolution was rolled back");
        } catch {
          uncertain.push("the interrupted dependency resolution could not be rolled back safely");
        }
      } else if (op.phase === "install" && !op.scripts?.length) {
        tx.result("dependency", u.id, { completed: false });
        completed.push("an interrupted dependency install did not finish; answer again to retry");
      } else {
        uncertain.push("an interrupted dependency install was running install scripts; inspect node_modules before continuing");
      }
    } else if (u.effect === "branch") {
      const op = u.op as { work: string; from: string | null; to: string };
      const branch = (await ports.git.probe()).branch;
      if (branch === op.to) {
        if (next.work[op.work]) put({ ...next.work[op.work]!, git: { ...next.work[op.work]!.git, branch: op.to } });
        tx.result("branch", u.id, { completed: true, branch: op.to });
        completed.push(`branch ${op.to} had been created before the result was recorded`);
      } else if (branch === op.from) {
        tx.result("branch", u.id, { completed: false });
        completed.push("an interrupted branch switch did not happen");
      } else {
        uncertain.push(`an interrupted branch switch left the repository on ${branch ?? "detached HEAD"}`);
      }
    } else {
      uncertain.push(`${u.effect} ${u.id}`);
    }
  }
  // 3. a result that was logged but never published: apply it to state, idempotently (TS §7.4)
  const log = tx.recent(400);
  for (const r of log) {
    const out = r.outcome as { completed?: boolean; commit?: string; mode?: string } | undefined;
    if (r.kind !== "result" || !out?.completed) continue;
    const intent = log.find((e) => e.kind === "intent" && e.effect === r.effect && e.id === r.id);
    if (!intent) continue;
    if (r.effect === "scaffold") {
      const op = intent.op as ScaffoldOp;
      const w = next.work[op.work];
      if (w && !w.touched.some((t) => t.path in op.expected)) {
        applyScaffold(w, op);
        completed.push("the scaffold was recorded as done but not yet in the contract; it is now");
      }
    } else if (r.effect === "adopt") {
      const op = intent.op as AdoptOp;
      if (!next.trust.some((t) => t.file === op.file && t.hash === op.after)) {
        next = adopted(next, op);
        completed.push(`${op.file} was recorded as written but not yet adopted; it is now`);
      }
    } else if (r.effect === "branch") {
      const op = intent.op as { work: string; to: string };
      const w = next.work[op.work];
      if (w && w.git.branch !== op.to) {
        put({ ...w, git: { ...w.git, branch: op.to } });
        completed.push(`branch ${op.to} was recorded as created but not yet in the contract; it is now`);
      }
    } else if (r.effect === "integration" && out.commit) {
      const op = intent.op as IntegrationOp;
      const w = next.work[op.work];
      if (w && !w.git.integrated) {
        applyIntegration(w, op, out.commit, out.mode === "merge");
        completed.push("the integration was recorded as done but not yet in the contract; it is now");
      }
    } else if (r.effect === "commit" && out.commit) {
      const op = intent.op as { work: string; paths: string[] };
      const w = next.work[op.work];
      if (w && !w.git.commits.includes(out.commit)) {
        put({ ...w, git: { ...w.git, commits: [...w.git.commits, out.commit], committed: [...new Set([...w.git.committed, ...op.paths])] } });
        completed.push(`commit ${out.commit.slice(0, 8)} was recorded as done but not yet in the contract; it is now`);
      }
    }
  }
  return { state: next, completed, uncertain };
}
