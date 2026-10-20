// `open`: create or resume a contract (TS §6.5). Readiness, assistance level, lane floor, the starting snapshot,
// source ownership and a new generation. Writes nothing to Git.
import { snapshotOf } from "../core/attribution.ts";
import { KernelError } from "../core/errors.ts";
import { matches } from "../core/exclusions.ts";
import { formatHandle, workId, workLabel } from "../core/ids.ts";
import { reason } from "../core/reasons.ts";
import { assistanceLevel, chooseLane, isEditingProfile, laneFloor, raise } from "../core/risk.ts";
import { OpenInput } from "../core/schemas.ts";
import type { Lane, Question, Reason, State, WorkContract } from "../core/schemas.ts";
import { planBlock } from "../core/plan.ts";
import { emptyState, isLive, newContract } from "../core/state.ts";
import type { Plan, Verb } from "../pipeline.ts";
import type { Ports } from "../ports/types.ts";
import { factsHash, nx, question, readinessOf, withWork } from "./common.ts";
import { dirtyQuestion, undecidedDirty } from "./dirty.ts";
import { reconcileShared, settingsFor } from "./reconcile.ts";
import type { Shared } from "./reconcile.ts";
import { recover } from "./recover.ts";
import { takeoverFacts } from "../decisions/takeover.ts";
import { quarantineData, quarantineQuestion, quarantineSurface } from "../decisions/quarantine.ts";

/** What reconciling the shared files adds to an answer: its reasons, and the question when a change needs acceptance. */
const surface = (s: Shared, base: Reason[] = []) => ({
  reasons: [...base, ...s.reasons],
  ...(s.question ? { questions: [s.question], exit: 3 as const } : {}),
});

function describe(ports: Ports, state: State, w: WorkContract) {
  const { style, checkpoints, resource_mode } = settingsFor(ports, state, w);
  const first = w.profile === "plan" ? nx("plan", "Draft the plan with the user.", true)
    : w.profile === "investigate" ? nx("research", "Investigate and report findings; nothing is edited.", true)
    : nx("basis", "Propose the outcome and examples, then record them with decide.", true);
  return {
    next: state.pending.length ? [nx("ask", "Answer the open question first.", true)] : [first],
    data: {
      settings: { style, checkpoints, resource_mode },
      label: w.label,
      handle: formatHandle(Number(w.label.slice(2)), w.session.generation, state.tag),
      profile: w.profile,
      lane: w.lane,
      floor: w.floor,
      level: w.level,
      branch: w.git.branch,
      ...(state.quarantine ? { quarantine: quarantineData(state) } : {}),
    },
  };
}

export const open: Verb<OpenInput> = {
  name: "open",
  schema: OpenInput,
  class: () => "mutating",

  async run(ports, state0, input, tx): Promise<Plan> {
    if (["promote", "recipe-upgrade", "fix", "continue"].includes(input.profile)) {
      throw new KernelError("capability-missing", `the ${input.profile} workflow is not implemented; resume an existing contract with its original profile and --resume`, { exit: 2 });
    }
    const ident = tx!.ensure();
    let state = state0 ?? emptyState(ident.workspaceId, ident.tag);
    if (tx!.quarantined && !state.quarantine) {
      state = { ...state, quarantine: { ...tx!.quarantined, choice: "pending" } };
      state = { ...state, pending: [...state.pending, quarantineQuestion(state)] };
    }
    const rec = await recover(ports, tx!, state);
    state = rec.state;
    if (state.recovered && state.recovered.accounting !== "verified" && isEditingProfile(input.profile)) {
      throw new KernelError("state-recovered-from-backup", "Recovered usage or process ownership is unknown; editing stays suspended until recovery can establish those facts.", { exit: 3 });
    }
    // Housekeeping at a boundary: day-old run directories and manifests go, except those a live run or reservation uses.
    const keepDirs = Object.values(state.work).flatMap((w) =>
      [w.session.inCall?.runDir, w.focusedReview?.manifest, ...w.budget.reservations.map((r) => r.manifest)].filter((x): x is string => !!x),
    );
    ports.store.sweepTemp(24 * 3600_000, keepDirs);
    const shared = reconcileShared(ports, state);
    state = shared.state;
    const effects = rec.completed.length || rec.uncertain.length ? { completed: rec.completed, uncertain: rec.uncertain } : undefined;
    const now = ports.clock.now();

    // A repeated open with the same profile and request returns the still-proposed contract (TS §6.4).
    const same = Object.values(state.work).find((w) => w.state === "proposed" && w.profile === input.profile && w.request === input.request);
    if (same && !input.resume) {
      return {
        ...(state !== state0 ? { state } : {}),
        resp: { work: same.id, ...describe(ports, state, same), ...(effects ? { effects } : {}), kernel: true, ...surface(shared), ...quarantineSurface(state) },
      };
    }

    if (input.resume) {
      const prev = Object.values(state.work)
        .filter(isLive)
        .filter((w) => w.profile === input.profile)
        .filter((w) => !input.planItem || w.planItem === input.planItem)
        .at(-1);
      if (prev) {
        if (prev.session.inCall) throw new KernelError("work-busy", `a ${prev.session.inCall.verb} is still running; pause it before taking over`);
        if (isEditingProfile(prev.profile) && state.sourceOwner && state.sourceOwner.work !== prev.id) throw new KernelError("owned-by-other-work", "another contract owns source");
        const pendingTakeover = state.pending.find((q) => q.id === "takeover-check" && q.bind.factsHash === takeoverFacts(prev));
        if (pendingTakeover) {
          return { state, resp: { work: prev.id, exit: 3, questions: [pendingTakeover], next: [nx("ask", "Ask whether the earlier chat has stopped; end your turn.", true)] } };
        }
        const gen = state.generationSeq + 1;
        const w: WorkContract = { ...prev, state: prev.state === "parked" ? prev.lastValidPhase ?? "executing" : prev.state, session: { generation: gen }, updatedAt: now };
        const last = prev.session.last?.response as { questions?: Question[] } | undefined;
        const awaitingAnswer = last?.questions?.some((q) => state.pending.some((p) => p.id === q.id && p.bind.factsHash === q.bind.factsHash));
        const takeover = !["parked", "finished"].includes(prev.state) && !awaitingAnswer;
        const owner = isEditingProfile(prev.profile) ? { sourceOwner: { work: prev.id, generation: gen } } : {};
        const q = takeover
          ? question({
              id: "takeover-check",
              header: "Earlier chat",
              channel: "chat",
              bind: { factsHash: takeoverFacts(w) },
              question: `Has the earlier chat working on ${w.label} stopped? A new handle cannot stop its native edits.`,
              options: [
                { label: "It has stopped", description: "Continue with this generation and recheck the files." },
                { label: "Wait", description: "Keep this contract fenced until the earlier chat stops.", recommended: true },
              ],
            })
          : undefined;
        return {
          state: { ...withWork(state, w), generationSeq: gen, ...owner, ...(q ? { pending: [...state.pending, q] } : {}) },
          resp: {
            work: w.id, ...describe(ports, state, w), kernel: true, ...(effects ? { effects } : {}),
            ...surface(shared),
            ...(q ? { exit: 3, questions: [q], reasons: [reason("takeover-check", "The earlier native chat must stop before this generation continues.")] } : {}),
            next: [nx(q ? "ask" : w.state === "proposed" ? "basis" : "check", q ? "Ask in chat whether the earlier chat stopped; end your turn." : "Continue where the contract left off.", true)],
          },
        };
      }
    }

    let probe = await ports.git.probe();
    const editing = isEditingProfile(input.profile);
    if (input.noGit && input.profile !== "prototype") {
      throw new KernelError("capability-missing", "only a prototype can be built without Git; open it with the prototype profile", { exit: 1 });
    }
    if (editing && !probe.isRepo) {
      if (input.noGit) {
        await ports.git.initShadow();
        probe = await ports.git.probe();
      } else if (!input.initGit) {
        const q: Question = question({
          id: "git-init",
          header: "Git",
          question: "This folder is not a Git repository. Tenet records its work in Git. Initialize one here?",
          options: [
            { label: "Start Git here", description: "Run git init in this folder so every commit is a checkpoint you can review or undo; nothing else changes.", recommended: true },
            { label: "No Git: a prototype", description: "Build a snapshot-backed prototype, not a checked result. Open it with the prototype profile and --no-git." },
          ],
          bind: { factsHash: factsHash(ports.root) },
        });
        throw new KernelError("repo-state-readonly", "this folder is not a Git repository", { exit: 3, questions: [q] });
      } else {
        await ports.git.init();
        probe = await ports.git.probe();
      }
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

    const item = input.planItem ? state.project.intent.plan.find((i) => i.id === input.planItem) : undefined;
    if (input.planItem && !item) throw new KernelError("plan-invalid", `there is no plan item ${input.planItem}`, { exit: 2 });
    const blocked = item && planBlock(state.project.intent.plan, item);
    if (blocked) throw new KernelError("plan-item-blocked", blocked, { exit: 2 });
    const scope = input.scopePaths ?? [];
    const prefs = settingsFor(ports, state);
    const protectedPaths = [...new Set([...(input.protectedPaths ?? []), ...(prefs.protected_paths as string[])])];
    const protectedHit = scope.some((p) => protectedPaths.some((x) => matches(x, p)));
    const assessment = raise(input.assessment ?? {}, [...scope, ...(input.signals ?? [])], state.project.traits, protectedHit);
    const floor = laneFloor(assessment);
    const recommended = ["feature", "bug"].includes(input.profile) ? "standard" : floor;
    const { lane, clamped } = chooseLane(input.lane ?? (prefs.lane === "auto" ? undefined : (prefs.lane as Lane)), floor, recommended);

    const inv = probe.isRepo ? await ports.git.inventory([]) : null;
    const start = inv ? snapshotOf(inv) : { head: null, branch: null, staged: [], dirty: [] };
    const gen = state.generationSeq + 1, seq = state.workSeq + 1;
    const w = newContract({
      id: workId(ports.rand), label: workLabel(seq), profile: input.profile, request: input.request, lane, floor, level, generation: gen, now,
      version: ports.version, assessment: assessment as Record<string, "low" | "high">, scopePaths: scope, protectedPaths,
      gitMode: probe.shadow ? "shadow" : probe.isRepo ? "git" : "none", base: probe.head, branch: probe.branch, start,
      ...(input.planItem ? { planItem: input.planItem } : {}),
    });
    if (editing) {
      w.grants.push({ id: "GR-1", actions: ["local-routine"], source: "request", capture: "reported", quote: input.request.slice(0, 200), bind: { factsHash: factsHash(scope) } });
    }

    // Tenet may only edit a human-dirty file after the user decides what happens to it (PRD 5.12).
    const dirtyScope = undecidedDirty(w);
    if (dirtyScope.length) state = { ...state, pending: [...state.pending.filter((q) => q.id !== "dirty-overlap"), dirtyQuestion(dirtyScope)] };

    const claimed = item
      ? { ...state, project: { ...state.project, intent: { ...state.project.intent, plan: state.project.intent.plan.map((i) => (i.id === item.id ? { ...i, state: "in-progress" as const, work: w.id } : i)) } } }
      : state;
    const next: State = { ...withWork(claimed, w), generationSeq: gen, workSeq: seq, ...(editing ? { sourceOwner: { work: w.id, generation: gen } } : {}) };
    const notes = [
      ...(next.quarantine?.choice === "pending" ? [reason("marker-mismatch", "Imported records were set aside as inert data; this contract starts from the current request.")] : []),
      ...(clamped ? [reason("budget-warning", `the ${floor} lane is the floor for this change and cannot be lowered`, { note: true })] : []),
      ...(why && level !== "L4" ? [reason("capability-missing", why, { note: true })] : []),
    ];
    const pending = next.pending.find((q) => q.id === "dirty-overlap");
    return {
      state: next,
      resp: {
        work: w.id, ...describe(ports, next, w), kernel: true, reasons: [...notes, ...shared.reasons],
        ...(pending ? { questions: [pending], exit: 3 } : shared.question ? { questions: [shared.question], exit: 3 } : {}), ...(effects ? { effects } : {}),
        progress: { phase: "proposed" },
        ...quarantineSurface(next),
      },
    };
  },
};
