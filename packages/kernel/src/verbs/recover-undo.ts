import type { UndoOp } from "../decisions/undo.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";
import { admitRecovery, hasPostconditions } from "./recover-admission.ts";

async function undoWithoutContract(recovery: Recovery, unresolved: Unresolved, op: UndoOp) {
  const stopped = op.runDir ? await recovery.ports.runner.stopRun(op.runDir) : "unknown";
  if (stopped === "unknown") {
    recovery.uncertain.push("the interrupted undo lost its contract and has uncertain process ownership");
    return;
  }
  if (!admitRecovery(recovery, unresolved, op.paths, true)) return;
  const here = await recovery.ports.git.inventory([]);
  if (op.paths.every((path) => (here.entries.get(path)?.blob ?? null) === op.pre[path])) {
    recovery.tx.result("undo", unresolved.id, { completed: false });
    recovery.completed.push("an interrupted undo did not happen");
  } else {
    recovery.uncertain.push("the interrupted undo may have landed but recovery lost its contract; review the current tree");
  }
}

export async function recoverUndo(recovery: Recovery, unresolved: Unresolved) {
  const op = unresolved.op as UndoOp;
  if (!admitRecovery(recovery, unresolved, op?.paths, true)) return;
  if (!hasPostconditions(op.pre, op.paths) || !hasPostconditions(op.post, op.paths)) {
    recovery.uncertain.push("the interrupted undo has incomplete path postconditions; it remains unresolved");
    return;
  }
  if (!recovery.state.work[op.work]) return undoWithoutContract(recovery, unresolved, op);
  const here = await recovery.ports.git.inventory([]);
  const at = (path: string) => here.entries.get(path)?.blob ?? null;
  const todo = op.paths.filter((path) => at(path) !== op.post[path]);
  if (todo.some((path) => at(path) !== op.pre[path])) {
    recovery.uncertain.push(`the undo touched files that have since changed (${todo.slice(0, 3).join(", ")})`);
    return;
  }
  if (!admitRecovery(recovery, unresolved, op.paths, true)) return;
  const patch = todo.length ? recovery.ports.store.readBlob(op.patch) : null;
  const run = op.runDir ? { runDir: op.runDir, timeoutMs: 60_000 } : undefined;
  if (!admitRecovery(recovery, unresolved, op.paths, true)) return;
  const ok = !todo.length || (!!patch && (await recovery.ports.git.applyPatch(patch, todo, run)).ok);
  if (ok) recovery.tx.result("undo", unresolved.id, { completed: true });
  if (!ok) {
    recovery.uncertain.push("an interrupted undo could not be finished");
    return;
  }
  recovery.completed.push(todo.length
    ? "an interrupted undo was finished"
    : "the undo had been applied before the result was recorded");
}
