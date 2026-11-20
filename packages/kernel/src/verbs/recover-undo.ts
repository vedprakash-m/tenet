import type { UndoOp } from "../decisions/undo.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";
import { cancelUnappliedUndoState } from "./recover-undo-state.ts";

function cancelUnappliedUndo(recovery: Recovery, unresolved: Unresolved, op: UndoOp) {
  const cancelled = cancelUnappliedUndoState(recovery.state, op);
  if (!cancelled) {
    recovery.uncertain.push(`undo ${unresolved.id} no longer matches its ownership and intent binding`);
    return;
  }
  recovery.state = cancelled;
  recovery.tx.result("undo", unresolved.id, { completed: false });
  recovery.completed.push("the interrupted undo did not apply; preview and confirm it again");
}

export async function recoverUndo(recovery: Recovery, unresolved: Unresolved) {
  const op = unresolved.op as UndoOp;
  const stopped = op.runDir ? await recovery.ports.runner.stopRun(op.runDir) : "unknown";
  if (stopped === "unknown") {
    recovery.uncertain.push(`undo ${unresolved.id} has uncertain process termination`);
    return;
  }
  if (!recovery.state.work[op.work]) {
    recovery.uncertain.push(`undo ${unresolved.id} lost its provisional contract`);
    return;
  }
  const provisional = recovery.state.work[op.work]!;
  const here = await recovery.ports.git.inventory([]);
  const unreadable = op.paths.filter(path => {
    const entry = here.entries.get(path);
    return !!entry && entry.mode !== "100644" && entry.mode !== "100755";
  });
  if (unreadable.length) {
    recovery.uncertain.push(`the undo postcondition is unreadable (${unreadable.slice(0, 3).join(", ")})`);
    return;
  }
  const same = (path: string, expected: UndoOp["pre"][string] | undefined) => {
    if (expected === undefined) return false;
    const entry = here.entries.get(path);
    if (!entry) return expected === null;
    return expected !== null && entry.mode === expected.mode && entry.blob === expected.blob;
  };
  const post = op.paths.filter(path => same(path, op.post[path]));
  const pre = op.paths.filter(path => same(path, op.pre[path]));
  if (post.length === op.paths.length) {
    recovery.state = {
      ...recovery.state,
      work: {
        ...recovery.state.work,
        [provisional.id]: { ...provisional, session: { generation: provisional.session.generation } },
      },
    };
    recovery.tx.result("undo", unresolved.id, { completed: true });
    recovery.completed.push("the undo had been applied before the result was recorded");
    return;
  }
  if (pre.length !== op.paths.length) {
    recovery.uncertain.push(`the undo has a partial or changed postcondition (${post.length}/${op.paths.length} paths at post-image)`);
    return;
  }
  cancelUnappliedUndo(recovery, unresolved, op);
}
