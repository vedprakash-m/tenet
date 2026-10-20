// `decide undo-confirm`: apply a previewed inverse to the working tree (TS §10.5). The inverse is planned again and must
// still be the one the user saw. Applying is a non-repeatable effect with per-path postconditions; the revert then becomes
// a new quick contract so it is checked and committed like any other change.
import { KernelError } from "../core/errors.ts";
import { workId, workLabel } from "../core/ids.ts";
import { deriveObligations } from "../core/obligations.ts";
import { snapshotOf } from "../core/attribution.ts";
import { newContract } from "../core/state.ts";
import type { BasisElement, State, WorkContract } from "../core/schemas.ts";
import { hashOf } from "../core/ids.ts";
import { isLive } from "../core/state.ts";
import { gather } from "../verbs/facts.ts";
import { reason } from "../core/reasons.ts";
import type { Job, Plan as VerbPlan, Resp } from "../pipeline.ts";
import type { Ports, Tx } from "../ports/types.ts";
import { nx, withWork } from "../verbs/common.ts";
import { planUndo, undoFacts } from "../verbs/undo.ts";
type UndoPlan = Awaited<ReturnType<typeof planUndo>>;
import type { Decision } from "./types.ts";

export interface UndoOp {
  work: string;
  original: string;
  tree: string;
  paths: string[];
  pre: Record<string, string | null>;
  post: Record<string, string | null>;
  patch: string;
  runDir?: string;
}

/** The revert is its own small contract: checked and committed like any other change, by the same rules. */
async function revertContract(ports: Ports, tx: Tx, rest: State, work: WorkContract, plan: UndoPlan, runDir: string, id: string) {
  const { inv } = await gather(ports, work, rest.locks);
  const now = ports.clock.now();
  const probe = await ports.git.probe();
  const gen = rest.generationSeq + 1;
  const seq = rest.workSeq + 1;
  const el: BasisElement = {
    id: `CNS-${String(seq).padStart(3, "0")}-und`,
    origin: "request",
    kind: "constraint",
    text: `Revert ${work.label}: ${work.outcome}`,
    verifiedBy: { notApplicable: "a revert has no new behavior to prove" },
  };
  const intent = {
    ...rest.project.intent,
    revision: rest.project.intent.revision + 1,
    elements: [...rest.project.intent.elements, el],
  };
  const base = newContract({
    id: workId(ports.rand),
    label: workLabel(seq),
    profile: "fix",
    request: `Undo ${work.label}`,
    lane: "quick",
    floor: "quick",
    level: work.level,
    generation: gen,
    now,
    version: ports.version,
    assessment: {},
    scopePaths: plan.paths,
    protectedPaths: work.scope.protected,
    gitMode: "git",
    base: probe.head,
    branch: probe.branch,
    start: snapshotOf(inv),
  });
  const op: UndoOp = {
    work: base.id,
    original: work.id,
    tree: plan.tree,
    paths: plan.paths,
    runDir,
    pre: await ports.git.blobsAt("HEAD", plan.paths),
    post: await ports.git.blobsAt(plan.tree, plan.paths),
    patch: ports.store.putBlob(plan.patch),
  };
  tx.intent("undo", id, op); // logged with the patch, so a crash after the state is published rolls forward instead of leaving a half-undo
  const nw: WorkContract = {
    ...base,
    state: "executing",
    reverting: plan.paths,
    session: { generation: gen, inCall: { runId: id, ...ports.store.self(), verb: "undo", since: now, runDir } },
    outcome: `Undo ${work.label}: ${work.outcome}`,
    touched: plan.paths.map((path) => ({ path })),
    grants: [
      {
        id: "GR-1",
        actions: ["local-routine"],
        source: "decide",
        capture: "reported",
        quote: `undo ${work.label}`,
        bind: { factsHash: undoFacts(plan) },
      },
    ],
    obligations: deriveObligations([], ports.stack.detect(ports.root).runner ?? "vitest", []),
    basis: {
      intentRevision: intent.revision,
      elementIds: [el.id],
      hash: hashOf({ undo: work.label, tree: plan.tree }),
      traits: [],
    },
  };
  return { nw, intent, gen, seq };
}

/** Locks on tests this undo removes or changes go with them: the user asked for the work to be reverted. */
function locksAfter(rest: State, work: WorkContract, plan: UndoPlan): State["locks"] {
  const undone = new Set(plan.commits);
  const goes = (l: State["locks"][number]) =>
    plan.paths.includes(l.path) &&
    (("commit" in l.anchor && undone.has(l.anchor.commit)) || ("provisional" in l.anchor && l.anchor.provisional === work.id));
  return rest.locks.filter((l) => !goes(l));
}

/** What the applied (or refused) patch turns into: a contract to check, an uncertain effect, or a withdrawn revert. */
function undoOutcome(
  tx: Tx,
  st: State,
  work: WorkContract,
  nw: WorkContract,
  plan: UndoPlan,
  id: string,
  result: unknown
): { state: State; resp: Resp } {
  const cur = st.work[nw.id]!;
  const r = result as { ok: boolean; detail?: string; error?: string; uncertain?: boolean };
  if (r.uncertain || r.error) {
    return {
      state: withWork(st, { ...cur, state: "blocked", session: { generation: cur.session.generation } }),
      resp: {
        work: cur.id,
        exit: 2,
        effects: { completed: [], uncertain: ["undo postcondition is not established"] },
        reasons: [reason("effect-uncertain", r.detail ?? r.error ?? "undo did not complete cleanly")],
        next: [nx("stop", "Reconcile the inverse before dependent work.", true)],
      },
    };
  }
  tx.result("undo", id, { completed: r.ok });
  if (r.ok) {
    return {
      state: withWork(st, { ...cur, session: { generation: cur.session.generation } }),
      resp: {
        work: cur.id,
        next: [nx("check", "Check the reverted tree, then finish to commit the revert.", true)],
        data: { reverted: plan.paths, summary: plan.stat, contract: nw.label },
      },
    };
  }
  // Nothing was reverted: the revert contract is withdrawn and the original is unmarked.
  const orig = st.work[work.id]!;
  const { sourceOwner: _o, ...noOwner } = st;
  const revertedOrig = withWork(noOwner, { ...orig, git: { ...orig.git, undoneBy: undefined } });
  return {
    state: withWork(revertedOrig, { ...cur, state: "cancelled", session: { generation: cur.session.generation } }),
    resp: {
      work: cur.id,
      exit: 3,
      reasons: [reason("undo-conflict", r.detail ?? r.error ?? "the inverse did not apply")],
      next: [],
    },
  };
}

export const undoConfirm: Decision = {
  kind: "undo-confirm",
  async run({ ports, tx, state, work, input }): Promise<VerbPlan> {
    const q = state.pending.find((p) => p.id === "undo-confirm");
    const answer = input.answers?.["undo-confirm"];
    if (!q) throw new KernelError("revision-conflict", "there is no open question about undoing", { exit: 2 });
    if (answer !== "apply" && answer !== "cancel")
      throw new KernelError("revision-conflict", 'answer "apply" or "cancel"', { exit: 1 });
    const rest: State = { ...state, pending: state.pending.filter((p) => p.id !== "undo-confirm") };
    if (answer === "cancel") return { state: withWork(rest, work), resp: { work: work.id, next: [] } };

    const plan = await planUndo(ports, rest, work);
    if (undoFacts(plan) !== q.bind.factsHash) {
      throw new KernelError("revision-conflict", "the inverse changed since the preview; ask for the preview again", { exit: 2 });
    }
    const owner = rest.sourceOwner && rest.work[rest.sourceOwner.work];
    if (owner && owner.id !== work.id && isLive(owner) && owner.state !== "parked") {
      throw new KernelError("owned-by-other-work", `${owner.label} is editing here`);
    }
    const id = `u-${ports.rand.base32(6)}`;
    const runDir = ports.store.tempDir(`run-${id}`);
    const { nw, intent, gen, seq } = await revertContract(ports, tx, rest, work, plan, runDir, id);
    const marked: WorkContract = { ...work, git: { ...work.git, undoneBy: nw.label } };
    const withMarked = withWork(
      { ...rest, project: { ...rest.project, intent }, generationSeq: gen, workSeq: seq, locks: locksAfter(rest, work, plan) },
      marked
    );
    const next: State = { ...withWork(withMarked, nw), sourceOwner: { work: nw.id, generation: gen } };
    const job: Job = {
      id,
      execute: () => ports.git.applyPatch(plan.patch, [], { runDir, timeoutMs: 60_000 }),
      finalize: async (tx2, st2, result) => undoOutcome(tx2, st2, work, nw, plan, id, result),
    };
    return { state: next, resp: { work: nw.id, next: [] }, job };
  },
};
