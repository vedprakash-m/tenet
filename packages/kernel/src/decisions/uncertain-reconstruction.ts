import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { recoverIntent } from "../core/reconstruct.ts";
import type { Question, State } from "../core/schemas.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, question } from "../verbs/common.ts";
import { NOT_RECOVERED, recoveredContext } from "./reconstruction.ts";

type Retention = NonNullable<State["project"]["retention"]>["legacyTemp"];
const canStartFresh = (state: State) => Object.keys(state.work).length === 0 && state.archive.length === 0;

function uncertainQuestion(
  scope: Retention,
  intent: ReturnType<typeof recoverIntent> | null,
  startFresh = true,
): Question {
  const hasIntent = startFresh && intent?.ok && intent.ids.length > 0;
  return question({
    id: "reconstruction-review",
    header: "Local records missing",
    channel: "chat",
    bind: { factsHash: factsHash({ retention: scope, reconstruction: intent?.ok ? intent.intent : null }) },
    question: "Tenet found an existing ownership marker but no usable state or backup. " +
      "The affected project run files are preserved and no cleanup ran. " +
      (hasIntent
        ? "Managed repository intent is available, but no old authority or evidence was recovered. "
        : "No recoverable managed intent was found. ") +
      "Start a new state only after confirming what to retain?",
    options: [
      ...(hasIntent ? [{
        label: "Use these records",
        description: "Load unadopted repository intent; no old authority is restored.",
        recommended: true,
      }] : []),
      ...(startFresh ? [{
        label: "Start fresh",
        description: "Create an empty state and keep the ambiguous run scope protected.",
        recommended: !hasIntent,
      }] : []),
      { label: "Only inspect", description: "Do not release the uncertainty fence or create ordinary work." },
    ],
  });
}

const questionFor = (state: State, retained: Retention, intent: ReturnType<typeof recoverIntent> | null) =>
  uncertainQuestion(retained, intent, canStartFresh(state));

export async function offerUncertainReconstruction(
  ports: Ports,
  state: State,
): Promise<{ state: State; reason: ReturnType<typeof reason>; question: Question }> {
  const scope = ports.store.retentionScope();
  const retention = { ...scope, at: ports.clock.now(), pending: true };
  const marked = { ...state, project: { ...state.project, retention: { legacyTemp: retention } } };
  const { intent } = await recoveredContext(ports);
  const q = uncertainQuestion(retention, intent, canStartFresh(state));
  return {
    state: { ...marked, pending: [...marked.pending.filter((p) => p.id !== q.id), q] },
    reason: reason("state-history-unknown",
      "Local Tenet history is incomplete. No cleanup or dependent work was started; the affected project files are preserved."),
    question: q,
  };
}

export const uncertainReconstructionSurface = (state: State): Question | undefined =>
  state.project.retention?.legacyTemp.pending
    ? state.pending.find((q) => q.id === "reconstruction-review")
    : undefined;

function uncertainAnswer(
  state: State,
  retained: Retention | undefined,
  pending: Question | undefined,
  input: { answers?: Record<string, string> },
) {
  if (!retained?.pending || !pending) {
    throw new KernelError("revision-conflict", "there is no pending uncertain-state recovery question", { exit: 2 });
  }
  const answer = input.answers?.["reconstruction-review"];
  if (answer !== "use" && answer !== "fresh" && answer !== "inspect") {
    throw new KernelError("revision-conflict", 'answer "use", "fresh", or "inspect"', { exit: 1 });
  }
  if (answer !== "inspect" && !canStartFresh(state)) {
    throw new KernelError("revision-conflict",
      "a readable state with missing evidence can only be inspected; restore the missing records before restarting work",
      { exit: 2 });
  }
  return { answer, retained, pending };
}

function askAgain(
  state: State,
  retained: Retention,
  intent: ReturnType<typeof recoverIntent> | null,
  rest: Question[],
  reasonText: string,
) {
  const q = questionFor(state, retained, intent);
  return {
    state: {
      ...state,
      pending: [...rest, q],
      project: { ...state.project, retention: { legacyTemp: retained } },
    },
    resp: {
      exit: 3 as const,
      reasons: [reason(reasonText.startsWith("The retained") ? "state-history-unknown" : "revision-conflict", reasonText)],
      questions: [q],
    },
  };
}

export async function reviewUncertainReconstruction(
  ports: Ports,
  state: State,
  input: { answers?: Record<string, string> },
) {
  const { answer, retained, pending } = uncertainAnswer(
    state,
    state.project.retention?.legacyTemp,
    state.pending.find((q) => q.id === "reconstruction-review"),
    input,
  );
  const rest = state.pending.filter((q) => q.id !== "reconstruction-review");
  const { intent } = await recoveredContext(ports);
  const currentScope = ports.store.retentionScope();
  if (currentScope.path !== retained.path ||
      currentScope.identity !== retained.identity ||
      currentScope.exists !== retained.exists) {
    return askAgain(
      state,
      { ...retained, ...currentScope, at: ports.clock.now(), pending: true },
      intent,
      rest,
      "The retained project temp scope changed. Review the new identity; no reconstruction was accepted.",
    );
  }
  if (answer === "inspect") {
    return {
      state: { ...state, pending: rest },
      resp: {
        exit: 0 as const,
        reasons: [reason("state-history-unknown", "The affected local history remains uncertain; it was inspected, not released.")],
        data: { reconstruction: "inspect-only", retained: true },
      },
    };
  }
  if (answer === "use" && (!intent?.ok || !intent.ids.length)) {
    throw new KernelError("revision-conflict", "no managed intent is available for this reconstruction", { exit: 2 });
  }
  const expected = factsHash({ retention: retained, reconstruction: intent?.ok ? intent.intent : null });
  if (pending.bind.factsHash !== expected) {
    return askAgain(state, retained, intent, rest,
      "The retained scope or managed records changed; review them again.");
  }
  const intentState = answer === "use" && intent?.ok
    ? { ...intent.intent, revision: state.project.intent.revision + 1 }
    : state.project.intent;
  return {
    state: {
      ...state,
      pending: rest,
      project: {
        ...state.project,
        intent: intentState,
        retention: { legacyTemp: { ...retained, pending: false } },
        ...(answer === "use" && intent?.ok ? {
          reconstructed: { at: ports.clock.now(), elementIds: intent.ids, notRecovered: NOT_RECOVERED },
        } : {}),
      },
    },
    resp: {
      exit: 0 as const,
      data: {
        reconstructed: answer === "use",
        retained: true,
        elementIds: answer === "use" && intent?.ok ? intent.ids : [],
        notRecovered: NOT_RECOVERED,
      },
    },
  };
}
