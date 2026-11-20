import type { UndoOp } from "../decisions/undo.ts";
import { hashOf } from "../core/ids.ts";
import type { State } from "../core/schemas.ts";
import type { Outcome, Recovery } from "./recover-effects.ts";

export function isCancelledUndoState(state: State, op: UndoOp): boolean {
  const original = state.work[op.original], provisional = state.work[op.work];
  const expectedOwner = op.priorSourceOwner;
  const owner = state.sourceOwner;
  const replacement = owner && state.work[owner.work];
  const supersededByCurrentUndo = !expectedOwner &&
    !!replacement &&
    replacement.id !== provisional?.id &&
    replacement.profile === "fix" &&
    replacement.session.generation === owner!.generation &&
    replacement.reverting?.join("\0") === op.paths.join("\0") &&
    original?.git.undoneBy === replacement.label;
  return !!original && !!provisional &&
    original.session.generation === op.originalGeneration &&
    (original.git.undoneBy === undefined || supersededByCurrentUndo) &&
    provisional.label === op.provisionalLabel &&
    provisional.session.generation === op.provisionalGeneration &&
    provisional.state === "cancelled" &&
    provisional.reverting === undefined &&
    provisional.session.inCall === undefined &&
    (expectedOwner
      ? owner?.work === expectedOwner.work && owner.generation === expectedOwner.generation
      : owner === undefined ||
        owner?.work === original.id && owner.generation === op.originalGeneration ||
        supersededByCurrentUndo) &&
    !state.project.intent.elements.some(element => element.id === op.intentElementId);
}

export function cancelUnappliedUndoState(state: State, op: UndoOp): State | null {
  const original = state.work[op.original], provisional = state.work[op.work];
  const owner = state.sourceOwner;
  const priorOwner = op.priorSourceOwner && state.work[op.priorSourceOwner.work];
  const matchingElement = state.project.intent.elements.filter(element =>
    element.id === op.intentElementId && hashOf(element) === op.intentElementHash);
  if (
    !original || !provisional ||
    original.session.generation !== op.originalGeneration ||
    provisional.label !== op.provisionalLabel || provisional.session.generation !== op.provisionalGeneration ||
    original.git.undoneBy !== op.provisionalLabel ||
    owner?.work !== provisional.id || owner.generation !== provisional.session.generation ||
    (op.priorSourceOwner && (!priorOwner || priorOwner.session.generation !== op.priorSourceOwner.generation)) ||
    matchingElement.length !== 1
  ) return null;
  const { reverting: _reverting, ...restProvisional } = provisional;
  const { sourceOwner: _sourceOwner, ...withoutOwner } = state;
  return {
    ...withoutOwner,
    ...(op.priorSourceOwner ? { sourceOwner: op.priorSourceOwner } : {}),
    work: {
      ...state.work,
      [original.id]: { ...original, git: { ...original.git, undoneBy: undefined } },
      [provisional.id]: {
        ...restProvisional,
        state: "cancelled",
        session: { generation: provisional.session.generation },
      },
    },
    project: {
      ...state.project,
      intent: {
        ...state.project.intent,
        elements: state.project.intent.elements.filter(element => element.id !== op.intentElementId),
      },
    },
  };
}

export function publishUndo(r: Recovery, o: unknown, out: Outcome) {
  const op = o as Partial<UndoOp>;
  if (typeof op.intentElementId !== "string" || !op.paths) return;
  const recorded = op as UndoOp;
  if (out.completed === false) {
    if (isCancelledUndoState(r.state, recorded)) return;
    const cancelled = cancelUnappliedUndoState(r.state, recorded);
    if (!cancelled) {
      r.uncertain.push(`recorded undo ${recorded.work} no longer matches its ownership and intent binding`);
      return;
    }
    r.state = cancelled;
    r.completed.push("an interrupted undo did not apply; preview and confirm it again");
    return;
  }
  const provisional = r.state.work[recorded.work];
  if (!provisional || provisional.session.generation !== recorded.provisionalGeneration) {
    r.uncertain.push(`recorded undo ${recorded.work} lost its provisional contract`);
    return;
  }
  if (!provisional.session.inCall) return;
  r.state = {
    ...r.state,
    work: {
      ...r.state.work,
      [provisional.id]: { ...provisional, session: { generation: provisional.session.generation } },
    },
  };
  r.completed.push("the undo was recorded as applied but not yet in the contract; it is now");
}
