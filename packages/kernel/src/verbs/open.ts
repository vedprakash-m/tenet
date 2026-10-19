// `open`: create or resume a contract (TS §6.5). Readiness, assistance level, lane floor, the starting snapshot,
// source ownership and a new generation. Writes nothing to Git.
import { snapshotOf } from "../core/attribution.ts";
import { KernelError } from "../core/errors.ts";
import { matches } from "../core/exclusions.ts";
import { formatHandle, workId, workLabel } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import { assistanceLevel, chooseLane, isEditingProfile, laneFloor, raise } from "../core/risk.ts";
import { OpenInput } from "../core/schemas.ts";
import type { Question, State, WorkContract } from "../core/schemas.ts";
import { emptyState, isLive, newContract } from "../core/state.ts";
import type { Plan, Verb } from "../pipeline.ts";
import { factsHash, nx, question, readinessOf, withWork } from "./common.ts";
import { dirtyQuestion, undecidedDirty } from "./dirty.ts";
import { recover } from "./recover.ts";

function describe(state: State, w: WorkContract) {
  const first = w.profile === "plan" ? nx("plan", "Draft the plan with the user.", true)
    : w.profile === "investigate" ? nx("research", "Investigate and report findings; nothing is edited.", true)
    : nx("basis", "Propose the outcome and examples, then record them with decide.", true);
  return {
    next: state.pending.length ? [nx("ask", "Answer the open question first.", true)] : [first],
    data: { label: w.label, handle: formatHandle(Number(w.label.slice(2)), w.session.generation, state.tag), profile: w.profile, lane: w.lane, floor: w.floor, level: w.level, branch: w.git.branch },
  };
}

export const open: Verb<OpenInput> = {
  name: "open",
  schema: OpenInput,
  class: () => "mutating",

  async run(ports, state0, input, tx): Promise<Plan> {
    const ident = tx!.ensure();
    let state = state0 ?? emptyState(ident.workspaceId, ident.tag);
    const rec = await recover(ports, tx!, state);
    state = rec.state;
    // Housekeeping at a boundary: day-old run directories and manifests go, except those a live run or reservation uses.
    ports.store.sweepTemp(24 * 3600_000, Object.values(state.work).flatMap((w) => [w.session.inCall?.runDir, ...w.budget.reservations.map((r) => r.manifest)].filter((x): x is string => !!x)));
    const effects = rec.completed.length || rec.uncertain.length ? { completed: rec.completed, uncertain: rec.uncertain } : undefined;
    const now = ports.clock.now();

    // A repeated open with the same profile and request returns the still-proposed contract (TS §6.4).
    const same = Object.values(state.work).find((w) => w.state === "proposed" && w.profile === input.profile && w.request === input.request);
    if (same && !input.resume) return { ...(rec.state !== state0 ? { state } : {}), resp: { work: same.id, ...describe(state, same), ...(effects ? { effects } : {}), kernel: true } };

    if (input.resume) {
      const prev = Object.values(state.work).filter(isLive).filter((w) => !input.planItem || w.planItem === input.planItem).at(-1);
      if (prev) {
        const gen = state.generationSeq + 1;
        const w: WorkContract = { ...prev, session: { generation: gen }, updatedAt: now };
        const takeover = ["executing", "checking"].includes(prev.state);
        const owner = state.sourceOwner?.work === prev.id ? { sourceOwner: { work: prev.id, generation: gen } } : {};
        return {
          state: { ...withWork(state, w), generationSeq: gen, ...owner },
          resp: {
            work: w.id, ...describe(state, w), kernel: true, ...(effects ? { effects } : {}),
            reasons: takeover ? [reason("takeover-check", "if the earlier chat is still working on this, stop it before continuing", { note: true })] : [],
            next: [nx(w.state === "proposed" ? "basis" : "check", "Continue where the contract left off.", true)],
          },
        };
      }
    }

    let probe = await ports.git.probe();
    const editing = isEditingProfile(input.profile);
    if (editing && !probe.isRepo) {
      if (!input.initGit) {
        const q: Question = question({ id: "git-init", header: "Git", question: "This folder is not a Git repository. Tenet records its work in Git. Initialize one here?",
          options: [{ label: "Initialize Git", description: "Run git init in this folder; nothing else changes.", recommended: true }, { label: "Not now", description: "Stop; no files are changed." }],
          bind: { factsHash: factsHash(ports.root) } });
        throw new KernelError("repo-state-readonly", "this folder is not a Git repository", { exit: 3, questions: [q] });
      }
      await ports.git.init();
      probe = await ports.git.probe();
    }
    if (editing && probe.state === "readonly") throw new KernelError("repo-state-readonly", probe.why);

    const readiness = readinessOf(ports, probe);
    const { level, why } = assistanceLevel(readiness, input.profile);
    if (level === "L0") throw new KernelError("capability-missing", why);

    // Ownership: an editing contract takes it; another live owner blocks (TS §7.3).
    if (editing && state.sourceOwner) {
      const owner = state.work[state.sourceOwner.work];
      if (owner && isLive(owner) && owner.state !== "parked") throw new KernelError("owned-by-other-work", `${owner.label} is editing here`);
    }

    const scope = input.scopePaths ?? [];
    const protectedPaths = input.protectedPaths ?? [];
    const protectedHit = scope.some((p) => protectedPaths.some((x) => matches(x, p)));
    const assessment = raise(input.assessment ?? {}, [...scope, ...(input.signals ?? [])], state.project.traits, protectedHit);
    const floor = laneFloor(assessment);
    const { lane, clamped } = chooseLane(input.lane, floor, floor);

    const inv = probe.isRepo ? await ports.git.inventory([]) : null;
    const start = inv ? snapshotOf(inv) : { head: null, branch: null, staged: [], dirty: [] };
    const gen = state.generationSeq + 1, seq = state.workSeq + 1;
    const w = newContract({
      id: workId(ports.rand), label: workLabel(seq), profile: input.profile, request: input.request, lane, floor, level, generation: gen, now,
      version: ports.version, assessment: assessment as Record<string, "low" | "high">, scopePaths: scope, protectedPaths,
      gitMode: probe.isRepo ? "git" : "none", base: probe.head, branch: probe.branch, start, ...(input.planItem ? { planItem: input.planItem } : {}),
    });
    if (editing) {
      w.grants.push({ id: "GR-1", actions: ["local-routine"], source: "request", capture: "reported", quote: input.request.slice(0, 200), bind: { factsHash: factsHash(scope) } });
    }

    // Tenet may only edit a human-dirty file after the user decides what happens to it (PRD 5.12).
    const dirtyScope = undecidedDirty(w);
    if (dirtyScope.length) state = { ...state, pending: [...state.pending.filter((q) => q.id !== "dirty-overlap"), dirtyQuestion(dirtyScope)] };

    const next: State = { ...withWork(state, w), generationSeq: gen, workSeq: seq, ...(editing ? { sourceOwner: { work: w.id, generation: gen } } : {}) };
    const notes = [
      ...(clamped ? [reason("budget-warning", `the ${floor} lane is the floor for this change and cannot be lowered`, { note: true })] : []),
      ...(why && level !== "L4" ? [reason("capability-missing", why, { note: true })] : []),
    ];
    const pending = next.pending.find((q) => q.id === "dirty-overlap");
    return {
      state: next,
      resp: {
        work: w.id, ...describe(next, w), kernel: true, reasons: notes,
        ...(pending ? { questions: [pending], exit: 3 } : {}), ...(effects ? { effects } : {}),
        progress: { phase: "proposed" },
      },
    };
  },
};
