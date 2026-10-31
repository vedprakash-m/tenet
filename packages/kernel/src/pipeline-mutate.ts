// The mutating path of the pipeline (TS §6.1, §7.3): recovery, the handle envelope and source ownership inside the lock,
// then an external job outside it, and a second transaction that publishes the result if the contract still wants it.
import { routineAuthorized } from "./core/authority.ts";
import { KernelError, ownedByOther } from "./core/errors.ts";
import { allowed, matches } from "./core/exclusions.ts";
import type { Exclusion } from "./core/exclusions.ts";
import { isEditingProfile, laneFloor, maxLane, raise } from "./core/risk.ts";
import type { KernelResponse, Reason, State, WorkContract } from "./core/schemas.ts";
import { inputHash, render, stamp, workByHandle } from "./pipeline-render.ts";
import type { Stamped } from "./pipeline-render.ts";
import type { Job, Plan, Verb } from "./pipeline.ts";
import type { Ports, Tx } from "./ports/types.ts";
import { versionGate } from "./pipeline-version.ts";
import { recover } from "./verbs/recover.ts";
import type { Recovered } from "./verbs/recover.ts";
import { configurePolicy, reconcileShared, settingsFor, withRequiredChecks } from "./verbs/reconcile.ts";

type Input = Record<string, any>;
const EFFECT_DECISIONS = ["scaffold", "dependency", "sync-index", "undo-confirm"];
const SOURCE_VERBS = ["commit", "integrate", "undo"];

/** The contract that owns a prepared job, as the first transaction recorded it. */
const ownerOf = (state: State | undefined, jobId: string) =>
  state && Object.values(state.work).find((w) => w.session.inCall?.runId === jobId);

/** An imported-record question, a takeover question or a running job fences every call except the ones that answer or stop. */
function fence(current: State, verb: Verb, input: Input, w: WorkContract) {
  const quarantine = current.pending.find((q) => q.id === "quarantine-review");
  const answersQuarantine = input.kind === "abandon-confirm" || (input.kind === "adopt" && input.target === "quarantine");
  if (quarantine && verb.name !== "stop" && !(verb.name === "decide" && answersQuarantine)) {
    throw new KernelError("marker-mismatch", "Answer the imported-record question before continuing this contract.", {
      exit: 3,
      questions: [quarantine],
    });
  }
  const takeover = current.pending.find((q) => q.id === "takeover-check");
  if (takeover && verb.name !== "stop" && !(verb.name === "decide" && input.kind === "takeover-check")) {
    throw new KernelError("takeover-check", "confirm that the earlier chat has stopped before continuing", {
      exit: 3,
      questions: [takeover],
    });
  }
  if (verb.name !== "stop" && !(verb.name === "decide" && input.kind === "abandon-confirm") && w.session.inCall) {
    throw new KernelError("work-busy", `a ${w.session.inCall.verb} is running`);
  }
}

/** Whether this call changes source, which needs the owner's lease; a contract that authorizes no source changes cannot. */
function changesSource(verb: Verb, input: Input, current: State, w: WorkContract): boolean {
  const effectDecision = verb.name === "decide" && EFFECT_DECISIONS.includes(input.kind);
  if ((effectDecision || SOURCE_VERBS.includes(verb.name)) && !isEditingProfile(w.profile)) {
    throw new KernelError("authority-needed", "this contract authorizes no source changes", { exit: 2 });
  }
  if (effectDecision) return true;
  if (verb.name === "decide" && input.kind === "basis" && isEditingProfile(w.profile)) return true;
  return !!verb.editing?.(input, current) && isEditingProfile(w.profile) && !(verb.name === "finish" && w.state === "finished");
}

/** An editing call: routine authority must be live, the lease free, the branch the contract's, no excluded path; the lane may only rise. */
async function claimSource(ports: Ports, verb: Verb, input: Input, current: State, w0: WorkContract) {
  const fail = (code: "authority-needed" | "stale-session", why: string, exit?: 2) => {
    throw new KernelError(code, why, exit ? { exit } : {});
  };
  if (!routineAuthorized(w0.grants, ports.clock.now())) {
    fail(
      "authority-needed",
      "routine authority is suspended or expired; pause this contract and start a new contract from the user's request",
      2
    );
  }
  if (current.sourceOwner && current.sourceOwner.work !== w0.id) {
    throw ownedByOther(current.work[current.sourceOwner.work]?.label ?? "another contract");
  }
  if (["parked", "cancelled", "superseded"].includes(w0.state)) fail("stale-session", "resume this contract before editing", 2);
  const mustBeOnBranch =
    w0.git.mode === "git" && ["check", "commit", "finish"].includes(verb.name) && input.stage !== "integrated";
  if (mustBeOnBranch && (await ports.git.probe()).branch !== w0.git.branch) {
    fail("stale-session", "the current branch differs from this contract; switch back before continuing", 2);
  }
  const prefs = settingsFor(ports, current, w0);
  const forbidden = [...w0.touched.map((t) => t.path), ...(input.touched ?? [])].filter(
    (p) => !allowed("edit", p, prefs.exclusions as Exclusion[])
  );
  if (forbidden.length) {
    fail(
      "authority-needed",
      `project exclusions forbid editing ${[...new Set(forbidden)].slice(0, 3).join(", ")}; no per-task grant overrides this restriction`,
      2
    );
  }
  const protectedPaths = [...new Set([...w0.scope.protected, ...(prefs.protected_paths as string[])])];
  // What a scaffold wrote and nobody changed is the recipe's own vetted content, not the change being assessed.
  const vetted = ports.project.hashes(Object.keys(w0.vetted));
  const paths = (await ports.git.inventory([])).status
    .map((s) => s.path)
    .filter((p) => !(p in w0.vetted && vetted[p] === w0.vetted[p]));
  const assessment = raise(
    w0.assessment,
    paths,
    current.project.traits,
    paths.some((p) => protectedPaths.some((x) => matches(x, p)))
  );
  const floor = maxLane(w0.floor, laneFloor(assessment));
  const w: WorkContract = {
    ...w0,
    assessment,
    floor,
    lane: maxLane(w0.lane, floor),
    scope: { ...w0.scope, protected: protectedPaths },
  };
  return {
    w,
    current: { ...current, work: { ...current.work, [w.id]: w }, sourceOwner: { work: w.id, generation: w.session.generation } },
  };
}

/** The handle envelope: it must name a live generation of a contract here, and an identical retry is answered as historical. */
async function envelope(ports: Ports, verb: Verb, input: Input, current0: State, world: unknown) {
  let w = workByHandle(current0, input.h);
  let current = current0;
  const owed = withRequiredChecks(ports, current, w);
  if (owed !== w) ({ w, current } = { w: owed, current: { ...current, work: { ...current.work, [owed.id]: owed } } });
  fence(current, verb, input, w);
  ({ w, state: current } = versionGate(ports, verb.name, input, w, current));
  if (changesSource(verb, input, current, w)) ({ w, current } = await claimSource(ports, verb, input, current, w));
  const last = w.session.last;
  const historical = last && !input.again && last.inputHash === inputHash(verb.name, input, world);
  return { current, historical: historical ? { ...(last.response as KernelResponse), historical: true as const } : undefined };
}

/** An interrupted operation that recovery could not settle fences every call but `stop`. */
function fencedByUncertainty(ports: Ports, verb: Verb, tx: Tx, current: State, recovered: Recovered): Stamped {
  if (current !== tx.state) tx.publish(current);
  const effects = { completed: recovered.completed, uncertain: recovered.uncertain };
  const message = "An interrupted operation is still uncertain; dependent work is fenced until it is reconciled.";
  return { res: render(ports, verb.name, { exit: 2, effects, reasons: [{ code: "effect-uncertain", message }] }, tx.state) };
}

/** What recovery and shared-file reconciliation found goes into the answer, ahead of the verb's own reasons and effects. */
function addRecovery(plan: Plan, reasons: Reason[], recovered: Recovered | null) {
  if (reasons.length) plan.resp.reasons = [...reasons, ...(plan.resp.reasons ?? [])];
  if (!recovered?.completed.length && !recovered?.uncertain.length) return;
  const had = plan.resp.effects;
  plan.resp = {
    ...plan.resp,
    effects: {
      completed: [...recovered.completed, ...(had?.completed ?? [])],
      uncertain: [...recovered.uncertain, ...(had?.uncertain ?? [])],
    },
  };
}

/** Everything that happens inside the first lock: recovery, envelope, the verb's own plan, and publishing its state. */
async function planInLock(ports: Ports, verb: Verb, input: Input, tx: Tx, held: { world: unknown; startedAt: string }): Promise<Stamped> {
  if (verb.name !== "stop") configurePolicy(ports, tx.state);
  const recovered = tx.state ? await recover(ports, tx, tx.state, { effects: verb.name !== "stop" }) : null;
  let current = recovered?.state ?? tx.state;
  if (current && recovered?.uncertain.length && verb.name !== "stop")
    return fencedByUncertainty(ports, verb, tx, current, recovered);
  const shared = current && !["open", "stop"].includes(verb.name) ? reconcileShared(ports, current) : null;
  if (shared) current = shared.state;
  if (verb.name !== "stop") configurePolicy(ports, current);
  held.world = verb.identity ? await verb.identity(ports, input, current) : null;
  if (input.h && current) {
    const gate = await envelope(ports, verb, input, current, held.world);
    if (gate.historical) {
      if (recovered && recovered.state !== tx.state) tx.publish(recovered.state);
      return { res: gate.historical };
    }
    current = gate.current;
  }
  const plan = await verb.run(ports, current, input, { ...tx, state: current });
  addRecovery(plan, shared?.reasons ?? [], recovered);
  if (!plan.state && current !== tx.state) plan.state = current ?? undefined;
  if (!plan.state) return { res: render(ports, verb.name, plan.resp, tx.state), plan };
  const prepared = plan.job && ownerOf(plan.state, plan.job.id)?.session.inCall;
  if (prepared?.runDir) ports.store.writeArtifact(prepared.runDir, "run.json", JSON.stringify({ prepared: true }));
  // A job's provisional response is never returned: only the finalized one leaves the process.
  return { res: stamp(ports, verb, input, held.world, tx, plan.state, plan.resp, !plan.job, held.startedAt), plan };
}

/** A job still wanted: the contract exists at the same generation, runs this job, and was not cancelled. */
const stillWanted = (live: WorkContract | undefined, owner: WorkContract | undefined, job: Job): live is WorkContract =>
  !!live &&
  !!owner &&
  live.session.generation === owner.session.generation &&
  live.session.inCall?.runId === job.id &&
  !live.session.inCall.cancelled;

/** The spawn is admitted by a short transaction that rechecks the contract, so a stop either precedes launch or sees the process. */
function guardLaunch(ports: Ports, verb: Verb, owner: WorkContract | undefined, job: Job) {
  const runDir = owner?.session.inCall?.runDir;
  if (!runDir) return;
  ports.runner.guardRun(runDir, async (spawn) => {
    const admitted = await ports.store.transaction(`${verb.name}:launch`, async (tx) => {
      if (!stillWanted(owner && tx.state?.work[owner.id], owner, job)) {
        throw new KernelError("run-superseded", "this job was cancelled before its process could start", { exit: 2 });
      }
      // Spawn and write run.json synchronously while stop cannot acquire the lock; await execution only after release.
      return { pending: spawn() };
    });
    return admitted.pending;
  });
}

/** Publishes a finished job's result, unless the contract was cancelled or replaced meanwhile. */
async function publishResult(
  ports: Ports,
  verb: Verb,
  input: Input,
  first: Stamped,
  job: Job,
  result: unknown,
  worldValue: unknown,
  startedAt: string
) {
  return ports.store.transaction(verb.name, async (tx) => {
    if (!tx.state) throw new KernelError("marker-mismatch", "state vanished while a job ran");
    const owner = ownerOf(first.plan?.state, job.id);
    const live = owner && tx.state.work[owner.id];
    if (!stillWanted(live, owner, job)) {
      const reasons = [{ code: "run-superseded", message: "The job was cancelled or replaced; its result was discarded." }];
      return render(ports, verb.name, { exit: 2, work: owner?.id, reasons }, tx.state);
    }
    const out = await job.finalize(tx, tx.state, result);
    const effects = first.plan?.resp.effects;
    if (effects) {
      out.resp.effects = {
        completed: [...new Set([...effects.completed, ...(out.resp.effects?.completed ?? [])])],
        uncertain: [...new Set([...effects.uncertain, ...(out.resp.effects?.uncertain ?? [])])],
      };
    }
    if (out.state.sourceOwner?.work === live.id && out.state.work[live.id]?.state === "finished") {
      const { sourceOwner: _owner, ...rest } = out.state;
      out.state = rest;
    }
    return stamp(ports, verb, input, worldValue, tx, out.state, out.resp, true, startedAt);
  });
}

export async function mutate(ports: Ports, verb: Verb, input: Input): Promise<KernelResponse> {
  const held = { world: null as unknown, startedAt: ports.clock.now() };
  await verb.preLock?.(ports, input);
  const first = await ports.store.transaction(verb.name, (tx) => planInLock(ports, verb, input, tx, held));
  const job = first.plan?.job;
  if (!job) return first.res;
  guardLaunch(ports, verb, ownerOf(first.plan?.state, job.id), job);
  let result: unknown;
  try {
    result = await job.execute();
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }
  return publishResult(ports, verb, input, first, job, result, held.world, held.startedAt);
}
