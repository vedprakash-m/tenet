import type { UndoOp } from "../decisions/undo.ts";
import type { PathImage } from "../ports/types.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";
import { admitRecovery, hasPostconditions } from "./recover-admission.ts";
import { cancelUnappliedUndoState } from "./recover-undo-state.ts";

type LegacyUndoOp = Omit<UndoOp, "pre" | "post"> & {
  pre: Record<string, string | null>;
  post: Record<string, string | null>;
};

function hasImagePostconditions(value: unknown, paths: readonly string[]): value is UndoOp["pre"] {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === paths.length && Object.entries(value).every(([path, expected]) =>
      paths.includes(path) && (expected === null || (
        typeof expected === "object" && expected !== null && !Array.isArray(expected)
        && typeof (expected as Partial<PathImage>).mode === "string"
        && typeof (expected as Partial<PathImage>).blob === "string"
      )));
}

function isRecordedImageOp(op: UndoOp): boolean {
  return typeof op.intentElementId === "string"
    && typeof op.head === "string"
    && (op.branch === null || typeof op.branch === "string");
}

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

async function recoverLegacyUndo(recovery: Recovery, unresolved: Unresolved, op: LegacyUndoOp) {
  if (!recovery.state.work[op.work]) {
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
    return;
  }
  if (!admitRecovery(recovery, unresolved, op.paths, true)) return;
  const here = await recovery.ports.git.inventory([]);
  const at = (path: string) => here.entries.get(path)?.blob ?? null;
  if (op.paths.every((path) => at(path) === op.post[path])) {
    recovery.tx.result("undo", unresolved.id, { completed: true });
    recovery.completed.push("the undo had been applied before the result was recorded");
    return;
  }
  recovery.uncertain.push("the interrupted undo has no pinned head; its postcondition is not complete");
}

function completeUndo(recovery: Recovery, unresolved: Unresolved, provisional: Recovery["state"]["work"][string], applied: boolean) {
  recovery.state = {
    ...recovery.state,
    work: {
      ...recovery.state.work,
      [provisional.id]: { ...provisional, session: { generation: provisional.session.generation } },
    },
  };
  recovery.tx.result("undo", unresolved.id, { completed: true });
  recovery.completed.push(applied ? "an interrupted undo was finished" : "the undo had been applied before the result was recorded");
}

async function recoverImageUndo(recovery: Recovery, unresolved: Unresolved, op: UndoOp) {
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
  const ownership = await recovery.ports.git.undoState(op.head, op.branch, op.paths);
  if (!ownership.headOk || !ownership.indexOk) {
    recovery.uncertain.push(`undo ${unresolved.id} no longer matches its pinned HEAD, branch or index`);
    return;
  }
  if (!admitRecovery(recovery, unresolved, op.paths, true)) return;
  const here = await recovery.ports.git.inventory([]);
  const unreadable = op.paths.filter(path => {
    const entry = here.entries.get(path);
    return !!entry && entry.mode !== "100644" && entry.mode !== "100755";
  });
  if (unreadable.length) {
    recovery.uncertain.push(`the undo postcondition is unreadable (${unreadable.slice(0, 3).join(", ")})`);
    return;
  }
  const same = (path: string, expected: PathImage | null | undefined) => {
    if (expected === undefined) return false;
    const entry = here.entries.get(path);
    if (!entry) return expected === null;
    return expected !== null && entry.mode === expected.mode && entry.blob === expected.blob;
  };
  const post = op.paths.filter(path => same(path, op.post[path]));
  const pre = op.paths.filter(path => same(path, op.pre[path]));
  if (!admitRecovery(recovery, unresolved, op.paths, true)) return;
  if (post.length === op.paths.length) {
    completeUndo(recovery, unresolved, provisional, false);
    return;
  }
  if (pre.length !== op.paths.length) {
    recovery.uncertain.push(`the undo has a partial or changed postcondition (${post.length}/${op.paths.length} paths at post-image)`);
    return;
  }
  const patch = op.runDir ? recovery.ports.store.readBlob(op.patch) : null;
  if (!patch || !op.runDir) {
    recovery.uncertain.push(`undo ${unresolved.id} has no recoverable inverse patch or run folder`);
    return;
  }
  const applied = await recovery.ports.git.applyUndo({
    patch,
    head: op.head,
    branch: op.branch,
    paths: op.paths,
    pre: Object.fromEntries(op.paths.map(path => [path, op.pre[path]?.blob ?? null])),
    post: Object.fromEntries(op.paths.map(path => [path, op.post[path]?.blob ?? null])),
    runDir: op.runDir,
    timeoutMs: 60_000,
  });
  if (applied.ok) {
    completeUndo(recovery, unresolved, provisional, true);
    return;
  }
  if (applied.uncertain) {
    recovery.uncertain.push(applied.detail ?? "an interrupted undo could not be settled");
    return;
  }
  cancelUnappliedUndo(recovery, unresolved, op);
}

export async function recoverUndo(recovery: Recovery, unresolved: Unresolved) {
  const op = unresolved.op as UndoOp;
  if (!admitRecovery(recovery, unresolved, op?.paths, true)) return;
  if (!isRecordedImageOp(op)) {
    const legacy = op as LegacyUndoOp;
    if (!hasPostconditions(legacy.pre, legacy.paths) || !hasPostconditions(legacy.post, legacy.paths)) {
      recovery.uncertain.push("the interrupted undo has incomplete path postconditions; it remains unresolved");
      return;
    }
    return recoverLegacyUndo(recovery, unresolved, legacy);
  }
  if (!hasImagePostconditions(op.pre, op.paths) || !hasImagePostconditions(op.post, op.paths)) {
    recovery.uncertain.push("the interrupted undo has incomplete path postconditions; it remains unresolved");
    return;
  }
  await recoverImageUndo(recovery, unresolved, op);
}

/** A cleanup never repeats removal: its question is withdrawn, so a retried yes is refused and a new preview shows what is left. */
export async function cleanup(recovery: Recovery, unresolved: Unresolved) {
  recovery.state = {
    ...recovery.state,
    pending: recovery.state.pending.filter((q) => q.id !== "cleanup-confirm"),
  };
  recovery.tx.result("cleanup", unresolved.id, { interrupted: true });
  recovery.completed.push("an interrupted cleanup may have removed some run files; preview again to see what remains");
}
