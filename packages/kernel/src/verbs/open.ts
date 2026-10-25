// `open`: create or resume a contract (TS §6.5). Readiness, assistance level, lane floor, the starting snapshot,
// source ownership and a new generation. Writes nothing to Git.
import { KernelError, ownedByOther } from "../core/errors.ts";
import { isEditingProfile } from "../core/risk.ts";
import { OpenInput } from "../core/schemas.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import { emptyState, isLive } from "../core/state.ts";
import type { Plan, Verb } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { resumeAsk } from "../pipeline-version.ts";
import { nx, question, reclaim, withWork } from "./common.ts";
import { describe, surface } from "./open-context.ts";
import type { Ctx } from "./open-context.ts";
import { admitFolder, created } from "./open-new.ts";
import { reconcileShared } from "./reconcile.ts";
import { recover } from "./recover.ts";
import { takeoverFacts } from "../decisions/takeover.ts";
import { quarantineQuestion, quarantineSurface } from "../decisions/quarantine.ts";

/** Admission and housekeeping every `open` goes through: quarantine, recovery, a suspended backup, temp cleanup, shared files. */
async function begin(ports: Ports, before: State | null, input: OpenInput, tx: Tx): Promise<Ctx> {
  if (input.profile === "fix" && !input.findings) {
    throw new KernelError("capability-missing", "name the findings to fix: pass them as findings, as the review gave them", { exit: 1 });
  }
  if (input.findings) {
    const seen = new Set<number>();
    const dup = input.findings.find((f) => { if (seen.has(f.n)) return true; seen.add(f.n); return false; });
    if (dup) {
      throw new KernelError("capability-missing", `duplicate finding number ${dup.n}: each named finding must be distinct`, { exit: 1 });
    }
  }
  if (["recipe-upgrade", "continue"].includes(input.profile)) {
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
  const kept = reclaim(ports, tx, state);
  if (kept.overCeiling) {
    const big = kept.largest.map((c) => `${c.name} ${Math.round(c.bytes / 1024)} KB`).join(", ");
    const why = `.tenet/ holds protected data past its ceiling (${big}); stop or finish work, or clean up, before adding more`;
    throw new KernelError("storage-protected-full", why, { exit: 2 });
  }
  if (kept.message) rec.completed.push(kept.message);
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
    throw ownedByOther(state.work[state.sourceOwner.work]?.label ?? "another contract");
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
  const ask = resumeAsk(c.ports, w, q);
  const asking = ask.question;
  const why = ask.why ?? "Continue where the contract left off.";
  return {
    state: { ...withWork(state, w), generationSeq: gen, ...owner, ...(q ? { pending: [...state.pending, q] } : {}) },
    resp: {
      work: w.id,
      ...describe(c.ports, state, w),
      kernel: true,
      ...(c.effects ? { effects: c.effects } : {}),
      ...surface(c.shared),
      ...(asking
        ? {
            exit: 3,
            questions: [asking],
            reasons: ask.reasons,
          }
        : {}),
      next: [nx(asking ? "ask" : w.state === "proposed" ? "basis" : "check", why, true)],
    },
  };
}

export const open: Verb<OpenInput> = {
  name: "open",
  schema: OpenInput,
  class: () => "mutating",
  // Before the lock exists: a folder with no Git is asked about, and nothing is written into it meanwhile.
  preLock: admitFolder,

  async run(ports, state0, input, tx): Promise<Plan> {
    const c = await begin(ports, state0, input, tx!);
    return repeated(c) ?? resumed(c) ?? (await created(c));
  },
};
