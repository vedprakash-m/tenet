// `open` for a new contract: the repository, readiness, ownership, plan item, lane and the starting snapshot (TS §6.5).
import { snapshotOf } from "../core/attribution.ts";
import { KernelError } from "../core/errors.ts";
import { matches } from "../core/exclusions.ts";
import { workId, workLabel } from "../core/ids.ts";
import { planBlock } from "../core/plan.ts";
import { reason } from "../core/reasons.ts";
import { assistanceLevel, chooseLane, isEditingProfile, laneFloor, raise } from "../core/risk.ts";
import type { OpenInput } from "../core/schemas.ts";
import type { Lane, Level, Question, State } from "../core/schemas.ts";
import { isLive, newContract } from "../core/state.ts";
import type { Plan } from "../pipeline.ts";
import type { Ports, RepoProbe } from "../ports/types.ts";
import { quarantineSurface } from "../decisions/quarantine.ts";
import { factsHash, question, readinessOf, withWork } from "./common.ts";
import { dirtyQuestion, undecidedDirty } from "./dirty.ts";
import { describe } from "./open-context.ts";
import type { Ctx } from "./open-context.ts";
import { settingsFor } from "./reconcile.ts";

/** The repository the contract will use: ask before `git init`, or build a snapshot-backed prototype when the user chose no Git. */
async function repository(ports: Ports, input: OpenInput, editing: boolean): Promise<RepoProbe> {
  let probe = await ports.git.probe();
  if (input.noGit && input.profile !== "prototype") {
    throw new KernelError("capability-missing", "only a prototype can be built without Git; open it with the prototype profile", {
      exit: 1,
    });
  }
  if (editing && !probe.isRepo) {
    if (input.noGit) {
      await ports.git.initShadow();
    } else if (!input.initGit) {
      const q: Question = question({
        id: "git-init",
        header: "Git",
        question: "This folder is not a Git repository. Tenet records its work in Git. Initialize one here?",
        options: [
          {
            label: "Start Git here",
            description:
              "Run git init in this folder so every commit is a checkpoint you can review or undo; nothing else changes.",
            recommended: true,
          },
          {
            label: "No Git: a prototype",
            description:
              "Build a snapshot-backed prototype, not a checked result. Open it with the prototype profile and --no-git.",
          },
        ],
        bind: { factsHash: factsHash(ports.root) },
      });
      throw new KernelError("repo-state-readonly", "this folder is not a Git repository", { exit: 3, questions: [q] });
    } else {
      await ports.git.init();
    }
    probe = await ports.git.probe();
  }
  if (editing && probe.state === "readonly") throw new KernelError("repo-state-readonly", probe.why);
  return probe;
}

/** Another live owner blocks an editing contract (TS §7.3); the plan item must exist, be accepted and not wait on others. */
function admitNew(c: Ctx, editing: boolean) {
  const { state, input } = c;
  if (editing && state.sourceOwner) {
    const owner = state.work[state.sourceOwner.work];
    if (owner && isLive(owner) && owner.state !== "parked")
      throw new KernelError("owned-by-other-work", `${owner.label} is editing here`);
  }
  const item = input.planItem ? state.project.intent.plan.find((i) => i.id === input.planItem) : undefined;
  if (input.planItem && !item) throw new KernelError("plan-invalid", `there is no plan item ${input.planItem}`, { exit: 2 });
  const blocked = item && planBlock(state.project.intent.plan, item);
  if (blocked) throw new KernelError("plan-item-blocked", blocked, { exit: 2 });
  return item;
}

/** The assessment, the lane floor and the lane: raised freely, lowered only to the floor (WRK-04). */
function lanePlan(c: Ctx, scope: string[], protectedPaths: string[], prefs: ReturnType<typeof settingsFor>) {
  const { input, state } = c;
  const protectedHit = scope.some((p) => protectedPaths.some((x) => matches(x, p)));
  const assessment = raise(input.assessment ?? {}, [...scope, ...(input.signals ?? [])], state.project.traits, protectedHit);
  const floor = laneFloor(assessment);
  const recommended = ["feature", "bug"].includes(input.profile) ? "standard" : floor;
  const wanted = input.lane ?? (prefs.lane === "auto" ? undefined : (prefs.lane as Lane));
  return { assessment, floor, ...chooseLane(wanted, floor, recommended) };
}

/** The new contract itself: lane, snapshot of the starting tree, and the routine grant a clear request gives (WRK-02). */
async function draft(c: Ctx, probe: RepoProbe, level: Level) {
  const { ports, input, now, state } = c;
  const scope = input.scopePaths ?? [];
  const prefs = settingsFor(ports, state);
  const protectedPaths = [...new Set([...(input.protectedPaths ?? []), ...(prefs.protected_paths as string[])])];
  const { assessment, floor, lane, clamped } = lanePlan(c, scope, protectedPaths, prefs);
  const inv = probe.isRepo ? await ports.git.inventory([]) : null;
  const start = inv ? snapshotOf(inv) : { head: null, branch: null, staged: [], dirty: [] };
  const w = newContract({
    id: workId(ports.rand),
    label: workLabel(state.workSeq + 1),
    profile: input.profile,
    request: input.request,
    lane,
    floor,
    level,
    generation: state.generationSeq + 1,
    now,
    version: ports.version,
    assessment: assessment as Record<string, "low" | "high">,
    scopePaths: scope,
    protectedPaths,
    gitMode: probe.shadow ? "shadow" : probe.isRepo ? "git" : "none",
    base: probe.head,
    branch: probe.branch,
    start,
    ...(input.planItem ? { planItem: input.planItem } : {}),
  });
  if (isEditingProfile(input.profile)) {
    const quote = input.request.slice(0, 200);
    w.grants.push({
      id: "GR-1",
      actions: ["local-routine"],
      source: "request",
      capture: "reported",
      quote,
      bind: { factsHash: factsHash(scope) },
    });
  }
  return { w, floor, clamped };
}

/** The plan item this contract works on is in progress from now on (INT-12). */
function claim(state: State, itemId: string, work: string): State {
  const intent = state.project.intent;
  const plan = intent.plan.map((i) => (i.id === itemId ? { ...i, state: "in-progress" as const, work } : i));
  return { ...state, project: { ...state.project, intent: { ...intent, plan } } };
}

export async function created(c: Ctx): Promise<Plan> {
  const { ports, input } = c;
  const editing = isEditingProfile(input.profile);
  const probe = await repository(ports, input, editing);
  const { level, why } = assistanceLevel(readinessOf(ports, probe), input.profile);
  if (level === "L0") throw new KernelError("capability-missing", why);
  const item = admitNew(c, editing);
  const { w, floor, clamped } = await draft(c, probe, level);

  // Tenet may only edit a human-dirty file after the user decides what happens to it (PRD 5.12).
  let state = c.state;
  const dirtyScope = undecidedDirty(w);
  if (dirtyScope.length) {
    state = { ...state, pending: [...state.pending.filter((q) => q.id !== "dirty-overlap"), dirtyQuestion(dirtyScope)] };
  }
  const gen = state.generationSeq + 1;
  const next: State = {
    ...withWork(item ? claim(state, item.id, w.id) : state, w),
    generationSeq: gen,
    workSeq: state.workSeq + 1,
    ...(editing ? { sourceOwner: { work: w.id, generation: gen } } : {}),
  };
  const imported = "Imported records were set aside as inert data; this contract starts from the current request.";
  const notes = [
    ...(next.quarantine?.choice === "pending" ? [reason("marker-mismatch", imported)] : []),
    ...(clamped
      ? [reason("budget-warning", `the ${floor} lane is the floor for this change and cannot be lowered`, { note: true })]
      : []),
    ...(why && level !== "L4" ? [reason("capability-missing", why, { note: true })] : []),
  ];
  const asking = next.pending.find((q) => q.id === "dirty-overlap") ?? c.shared.question;
  return {
    state: next,
    resp: {
      work: w.id,
      ...describe(ports, next, w),
      kernel: true,
      reasons: [...notes, ...c.shared.reasons],
      ...(asking ? { questions: [asking], exit: 3 } : {}),
      ...(c.effects ? { effects: c.effects } : {}),
      progress: { phase: "proposed" },
      ...quarantineSurface(next),
    },
  };
}
