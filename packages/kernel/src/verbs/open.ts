// `open`: create or resume a contract (TS §6.5). Readiness, assistance level, lane floor, the starting snapshot,
// source ownership and a new generation. Writes nothing to Git.
import { KernelError } from "../core/errors.ts";
import { reason } from "../core/reasons.ts";
import { isEditingProfile } from "../core/risk.ts";
import { OpenInput } from "../core/schemas.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import { emptyState, isLive } from "../core/state.ts";
import type { Plan, Verb } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { nx, question, withWork } from "./common.ts";
import { describe, surface } from "./open-context.ts";
import type { Ctx } from "./open-context.ts";
import { created } from "./open-new.ts";
import { reconcileShared } from "./reconcile.ts";
import { recover } from "./recover.ts";
import { takeoverFacts } from "../decisions/takeover.ts";
import { quarantineQuestion, quarantineSurface } from "../decisions/quarantine.ts";

/** Admission and housekeeping every `open` goes through: quarantine, recovery, a suspended backup, temp cleanup, shared files. */
async function begin(ports: Ports, before: State | null, input: OpenInput, tx: Tx): Promise<Ctx> {
  if (["promote", "recipe-upgrade", "fix", "continue"].includes(input.profile)) {
    throw new KernelError(
      "capability-missing",
      `the ${input.profile} workflow is not implemented; resume an existing contract with its original profile and --resume`,
      { exit: 2 }
    );
  }
  const ident = tx.ensure();
  let state = before ?? emptyState(ident.workspaceId, ident.tag);
  if (tx.quarantined && !state.quarantine) {
    state = { ...state, quarantine: { ...tx.quarantined, choice: "pending" } };
    state = { ...state, pending: [...state.pending, quarantineQuestion(state)] };
  }
  const rec = await recover(ports, tx, state);
  state = rec.state;
  if (state.recovered && state.recovered.accounting !== "verified" && isEditingProfile(input.profile)) {
    throw new KernelError(
      "state-recovered-from-backup",
      "Recovered usage or process ownership is unknown; editing stays suspended until recovery can establish those facts.",
      { exit: 3 }
    );
  }
  // Housekeeping at a boundary: day-old run directories and manifests go, except those a live run or reservation uses.
  const keepDirs = Object.values(state.work).flatMap((w) =>
    [w.session.inCall?.runDir, w.focusedReview?.manifest, ...w.budget.reservations.map((r) => r.manifest)].filter(
      (x): x is string => !!x
    )
  );
  ports.store.sweepTemp(24 * 3600_000, keepDirs);
  const shared = reconcileShared(ports, state);
  const effects =
    rec.completed.length || rec.uncertain.length ? { completed: rec.completed, uncertain: rec.uncertain } : undefined;
  return { ports, input, before, state: shared.state, shared, effects, now: ports.clock.now() };
}

/** A repeated open with the same profile and request returns the still-proposed contract (TS §6.4). */
function repeated(c: Ctx): Plan | undefined {
  const same = Object.values(c.state.work).find(
    (w) => w.state === "proposed" && w.profile === c.input.profile && w.request === c.input.request
  );
  if (!same || c.input.resume) return undefined;
  return {
    ...(c.state !== c.before ? { state: c.state } : {}),
    resp: {
      work: same.id,
      ...describe(c.ports, c.state, same),
      ...(c.effects ? { effects: c.effects } : {}),
      kernel: true,
      ...surface(c.shared),
      ...quarantineSurface(c.state),
    },
  };
}

const takeoverQuestion = (w: WorkContract): Question =>
  question({
    id: "takeover-check",
    header: "Earlier chat",
    channel: "chat",
    bind: { factsHash: takeoverFacts(w) },
    question: `Has the earlier chat working on ${w.label} stopped? A new handle cannot stop its native edits.`,
    options: [
      { label: "It has stopped", description: "Continue with this generation and recheck the files." },
      { label: "Wait", description: "Keep this contract fenced until the earlier chat stops.", recommended: true },
    ],
  });

/** `open --resume`: the next generation of a live contract, behind a takeover question unless the last call left it at rest. */
function resumed(c: Ctx): Plan | undefined {
  const { state, input, now } = c;
  if (!input.resume) return undefined;
  const prev = Object.values(state.work)
    .filter(isLive)
    .filter((w) => w.profile === input.profile)
    .filter((w) => !input.planItem || w.planItem === input.planItem)
    .at(-1);
  if (!prev) return undefined;
  if (prev.session.inCall)
    throw new KernelError("work-busy", `a ${prev.session.inCall.verb} is still running; pause it before taking over`);
  if (isEditingProfile(prev.profile) && state.sourceOwner && state.sourceOwner.work !== prev.id) {
    throw new KernelError("owned-by-other-work", "another contract owns source");
  }
  const waiting = state.pending.find((q) => q.id === "takeover-check" && q.bind.factsHash === takeoverFacts(prev));
  if (waiting) {
    return {
      state,
      resp: {
        work: prev.id,
        exit: 3,
        questions: [waiting],
        next: [nx("ask", "Ask whether the earlier chat has stopped; end your turn.", true)],
      },
    };
  }
  const gen = state.generationSeq + 1;
  const w: WorkContract = {
    ...prev,
    state: prev.state === "parked" ? (prev.lastValidPhase ?? "executing") : prev.state,
    session: { generation: gen },
    updatedAt: now,
  };
  const last = prev.session.last?.response as { questions?: Question[] } | undefined;
  const awaitingAnswer = last?.questions?.some((q) =>
    state.pending.some((p) => p.id === q.id && p.bind.factsHash === q.bind.factsHash)
  );
  const takeover = !["parked", "finished"].includes(prev.state) && !awaitingAnswer;
  const owner = isEditingProfile(prev.profile) ? { sourceOwner: { work: prev.id, generation: gen } } : {};
  const q = takeover ? takeoverQuestion(w) : undefined;
  const why = q ? "Ask in chat whether the earlier chat stopped; end your turn." : "Continue where the contract left off.";
  return {
    state: { ...withWork(state, w), generationSeq: gen, ...owner, ...(q ? { pending: [...state.pending, q] } : {}) },
    resp: {
      work: w.id,
      ...describe(c.ports, state, w),
      kernel: true,
      ...(c.effects ? { effects: c.effects } : {}),
      ...surface(c.shared),
      ...(q
        ? {
            exit: 3,
            questions: [q],
            reasons: [reason("takeover-check", "The earlier native chat must stop before this generation continues.")],
          }
        : {}),
      next: [nx(q ? "ask" : w.state === "proposed" ? "basis" : "check", why, true)],
    },
  };
}

export const open: Verb<OpenInput> = {
  name: "open",
  schema: OpenInput,
  class: () => "mutating",

  async run(ports, state0, input, tx): Promise<Plan> {
    const c = await begin(ports, state0, input, tx!);
    return repeated(c) ?? resumed(c) ?? (await created(c));
  },
};
