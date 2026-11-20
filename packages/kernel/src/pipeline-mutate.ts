// The mutating path of the pipeline (TS §6.1, §7.3): recovery, the handle envelope and source ownership inside the lock,
// then an external job outside it, and a second transaction that publishes the result if the contract still wants it.
import { routineAuthorized } from "./core/authority.ts";
import { KernelError, ownedByOther } from "./core/errors.ts";
import { allowed, matches } from "./core/exclusions.ts";
import type { Exclusion } from "./core/exclusions.ts";
import { isEditingProfile, laneFloor, maxLane, raise } from "./core/risk.ts";
import type { KernelResponse, Reason, State, WorkContract } from "./core/schemas.ts";
import { handleOf, inputHash, prepareStamp, publishStamp, render, stamp, workByHandle } from "./pipeline-render.ts";
import type { Stamped } from "./pipeline-render.ts";
import type { Job, Plan, Verb } from "./pipeline.ts";
import type { EvictReport, Ports, Tx } from "./ports/types.ts";
import { versionGate } from "./pipeline-version.ts";
import { recover } from "./verbs/recover.ts";
import type { Recovered } from "./verbs/recover.ts";
import { configurePolicy, reconcileShared, settingsFor, withRequiredChecks } from "./verbs/reconcile.ts";
import { capabilitiesState, capabilityIdentity, prepareCapabilities } from "./pipeline-capabilities.ts";
import { protectedRunPaths } from "./core/storage-protection.ts";
import { JOB_FINAL_STATE_RESERVE } from "./core/storage-reservation.ts";

type Input = Record<string, any>;
const EFFECT_DECISIONS = ["scaffold", "dependency", "sync-index", "undo-confirm"];
const SOURCE_VERBS = ["commit", "integrate", "undo"];
const CLEANUP_RESPONSE_RESERVE = 2048;
const RECOVERY_STATE_RESERVE = 1024 * 1024;

function enforceStoreHistory(verb: Verb, input: Input, tx: Tx) {
  const uncertainRecovery =
    verb.name === "open" ||
    (verb.name === "decide" && input.kind === "adopt" && input.target === "reconstruction");
  if (tx.history === "uncertain" && !uncertainRecovery && verb.name !== "stop") {
    const why = verb.name === "stop"
      ? "Local Tenet history is incomplete; no trusted process record was available, so no process was signaled."
      : "Local Tenet history is incomplete. No cleanup or dependent work was started; the affected project files are preserved.";
    throw new KernelError("state-history-unknown", why, {
      exit: 3,
      next: [{ action: "ask", why: "Run inspect status without changing the affected store.", required: true }],
    });
  }
  if (tx.state?.project.retention?.legacyTemp.pending &&
      !(uncertainRecovery || verb.name === "stop" || verb.name === "inspect" ||
        (verb.name === "decide" && input.kind === "repair-lock"))) {
    throw new KernelError("state-history-unknown",
      "Local Tenet history remains incomplete. Review the recovery question before dependent work.",
      { exit: 3 });
  }
  const reserveRecovery =
    (verb.name === "open" && tx.history === "uncertain") ||
    (verb.name === "decide" && input.kind === "adopt" && input.target === "reconstruction");
  if (reserveRecovery) tx.allowReserve?.();
}
async function allowAdmittedStopReserve(ports: Ports, verb: Verb, input: Input, tx: Tx) {
  if (verb.name !== "stop" || !input.h || !tx.state) return false;
  const work = Object.values(tx.state.work).find((candidate) => handleOf(tx.state!, candidate) === input.h);
  const runDir = work?.session.inCall?.runDir;
  if (!runDir) return false;
  const raw = ports.store.readArtifact(runDir, "run.json");
  if (!raw) return false;
  let record: unknown;
  try { record = JSON.parse(raw); } catch { return false; }
  if (!record || typeof record !== "object") return false;
  const { pid, procStart } = record as { pid?: unknown; procStart?: unknown };
  if (!Number.isSafeInteger(pid) || Number(pid) <= 1 || typeof procStart !== "string" || !procStart) return false;
  if (!await ports.store.alive(Number(pid), procStart)) return false;
  tx.allowReserve?.();
  return true;
}
async function enforceUncertainStop(ports: Ports, verb: Verb, input: Input, tx: Tx) {
  const admitted = await allowAdmittedStopReserve(ports, verb, input, tx);
  if (verb.name === "stop" && tx.history === "uncertain" && !admitted) {
    throw new KernelError("state-history-unknown",
      "Local Tenet history is incomplete; no trusted live process record was available, so no process was signaled.",
      { exit: 3 });
  }
}
function enforceStorage(
  ports: Ports,
  verb: Verb,
  input: Input,
  tx: Tx,
  state: State | null,
  apply = false,
): EvictReport | undefined {
  const recovery =
    (verb.name === "decide" &&
      (input.kind === "repair-lock" ||
        (input.kind === "adopt" && input.target === "reconstruction"))) ||
    (verb.name === "open" &&
      (tx.history === "uncertain" || !!state?.project.retention?.legacyTemp.pending)) ||
    (state?.project.retention?.legacyTemp.pending &&
      ["stop"].includes(verb.name));
  if (!state || recovery) return undefined;
  const keep = protectedRunPaths(state, tx.unresolved());
  const report = tx.evict(keep, apply);
  if (report.refusal) {
    if (verb.name === "stop" && tx.reserveAllowed) return report;
    throw new KernelError(report.refusal.code, report.refusal.message, {
      exit: 2,
      effects: {
        completed: report.message ? [report.message] : [],
        uncertain: report.uncertain ?? [],
      },
    });
  }
  if (apply && !report.uncertain?.length) {
    try {
      const swept = ports.store.sweepTemp(24 * 3600_000, keep);
      if (swept) {
        const message = `Removed ${swept} old run folder(s) past the age limit.`;
        return { ...report, message: [report.message, message].filter(Boolean).join(" ") };
      }
    } catch {
      throw new KernelError("storage-accounting-unknown",
        "Age cleanup could not finish safely; dependent work was not published.",
        {
          exit: 2,
          effects: {
            completed: report.message ? [report.message] : [],
            uncertain: ["Age cleanup stopped after an incomplete measurement or changed run scope."],
          },
        });
    }
  }
  return report;
}
function addStorageReport(plan: Plan, report: EvictReport | undefined) {
  if (!report || (!report.message && !report.uncertain?.length)) return;
  const had = plan.resp.effects;
  plan.resp.effects = {
    completed: [...(had?.completed ?? []), ...(report.message ? [report.message] : [])],
    uncertain: [...(had?.uncertain ?? []), ...(report.uncertain ?? [])],
  };
}
const stateAfterPlan = (plan: Plan, current: State | null) => plan.state || current;
function reserveJobFinalState(ports: Ports, plan: Plan) {
  if (!plan.job || !plan.state) return;
  const owner = Object.values(plan.state.work).find((work) =>
    work.session.inCall?.runId === plan.job?.id
  );
  if (!owner?.session.inCall) return;
  plan.state = {
    ...plan.state,
    work: {
      ...plan.state.work,
      [owner.id]: {
        ...owner,
        session: {
          ...owner.session,
          inCall: {
            ...owner.session.inCall,
            storageReservedBytes: owner.session.inCall.storageReservedBytes ?? JOB_FINAL_STATE_RESERVE,
            storageBaselineBytes: owner.session.inCall.storageBaselineBytes ?? ports.store.storageBytes(),
          },
        },
      },
    },
  };
}
function reserveRecovery(tx: Tx, verb: Verb) {
  if (verb.name !== "stop" &&
      tx.state && !tx.state.project.retention?.legacyTemp.pending && tx.unresolved().length) {
    tx.reservePublish?.(tx.state, RECOVERY_STATE_RESERVE);
  }
}

/** A public no-commit request is durable even when the finish it accompanies later fails or is fenced. */
function persistFinishNoCommit(ports: Ports, verb: Verb, input: Input, tx: Tx) {
  if (verb.name !== "finish" || input.noCommit !== true || !input.h || !tx.state) return;
  let work: WorkContract;
  try { work = workByHandle(tx.state, input.h); } catch { return; }
  if (work.git.noCommit === true) return;
  const next: WorkContract = {
    ...work,
    git: { ...work.git, noCommit: true },
    updatedAt: ports.clock.now(),
  };
  tx.publish({ ...tx.state, work: { ...tx.state.work, [next.id]: next } });
  tx.flush?.();
}

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
  const recovered = current.pending.find((q) => q.id === "reconstruction-review");
  const answersRecovered = input.kind === "abandon-confirm" || (input.kind === "adopt" && input.target === "reconstruction");
  if (recovered && verb.name !== "stop" && !(verb.name === "decide" && answersRecovered)) {
    throw new KernelError("reconstructed-from-repository", "Answer the question about the recovered records before continuing.", {
      exit: 3,
      questions: [recovered],
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
    .filter((p) => !(Object.hasOwn(w0.vetted, p) && vetted[p] === w0.vetted[p]));
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
  const historical = last &&
    !input.again &&
    last.inputHash === inputHash(verb.name, input, world) &&
    !(last.response as KernelResponse).questions?.length;
  return { current, historical: historical ? { ...(last.response as KernelResponse), historical: true as const } : undefined };
}

/** An interrupted operation that recovery could not settle fences every call but `stop`. */
function fencedByUncertainty(ports: Ports, verb: Verb, tx: Tx, current: State, recovered: Recovered): Stamped {
  if (current !== tx.state) tx.publish(current);
  const effects = { completed: recovered.completed, uncertain: recovered.uncertain };
  const message = "An interrupted operation is still uncertain; dependent work is fenced until it is reconciled.";
  return { res: render(ports, verb.name, {
    exit: 2, effects, reasons: [{ code: "effect-uncertain", message }],
    questions: current.pending.filter(q => q.id.startsWith("leave-unrecorded-")),
  }, tx.state) };
}

/** A settled recovery must not be lost when the same call's handle or ownership gate refuses its requested next work. */
function settledRecoveryRefusal(
  ports: Ports, verb: Verb, tx: Tx, recovered: Recovered | null, error: unknown,
): Stamped | undefined {
  if (!(error instanceof KernelError) || !recovered) return;
  const settled = recovered.state !== tx.state || recovered.completed.length || recovered.uncertain.length;
  if (!settled) return;
  if (recovered.state !== tx.state) tx.publish(recovered.state);
  return {
    res: render(ports, verb.name, {
      exit: error.exit,
      reasons: error.reasons,
      ...(error.questions ? { questions: error.questions } : {}),
      ...(error.next ? { next: error.next } : {}),
      effects: {
        completed: [...recovered.completed, ...(error.effects?.completed ?? [])],
        uncertain: [...recovered.uncertain, ...(error.effects?.uncertain ?? [])],
      },
    }, tx.state),
  };
}

async function admittedEnvelope(
  ports: Ports, verb: Verb, input: Input, current: State, world: unknown, tx: Tx, recovered: Recovered | null,
): Promise<{ current: State } | Stamped> {
  try {
    const gate = await envelope(ports, verb, input, current, world);
    if (!gate.historical) return { current: gate.current };
    if (recovered && recovered.state !== tx.state) tx.publish(recovered.state);
    return { res: gate.historical };
  } catch (error) {
    const refused = settledRecoveryRefusal(ports, verb, tx, recovered, error);
    if (refused) return refused;
    throw error;
  }
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

function uncertaintyFences(verb: Verb, input: Input, recovered: Recovered | null): boolean {
  return !!recovered?.uncertain.length && verb.name !== "stop" &&
    !(verb.name === "decide" && input.kind === "leave-unrecorded");
}
function clearUnrecordedRecovery(verb: Verb, input: Input, tx: Tx, recovered: Recovered | null): void {
  if (verb.name !== "decide" || input.kind !== "leave-unrecorded" || !recovered) return;
  if (tx.unresolved().some(u => u.effect === "commit" && u.id === input.target)) return;
  recovered.uncertain = recovered.uncertain.filter(why => !why.startsWith(`commit ${input.target}:`));
}

/** Everything that happens inside the first lock: recovery, envelope, the verb's own plan, and publishing its state. */
async function planInLock(ports: Ports, verb: Verb, input: Input, tx: Tx, held: { world: unknown; startedAt: string }): Promise<Stamped> {
  persistFinishNoCommit(ports, verb, input, tx);
  enforceStoreHistory(verb, input, tx);
  await enforceUncertainStop(ports, verb, input, tx);
  reserveRecovery(tx, verb);
  if (verb.name !== "stop") configurePolicy(ports, tx.state);
  const recoveryPending = !!tx.state?.project.retention?.legacyTemp.pending;
  const recovered = tx.state && !recoveryPending
    ? await recover(ports, tx, tx.state, { effects: verb.name !== "stop" })
    : null;
  let current = recovered?.state ?? tx.state;
  if (current && uncertaintyFences(verb, input, recovered))
    return fencedByUncertainty(ports, verb, tx, current, recovered!);
  enforceStorage(ports, verb, input, tx, current);
  const shared = current && !["open", "stop"].includes(verb.name) ? reconcileShared(ports, current) : null;
  if (shared) current = shared.state;
  if (verb.name !== "stop") {
    configurePolicy(ports, current);
    prepareCapabilities(ports, current);
  }
  held.world = capabilityIdentity(ports, verb.identity ? await verb.identity(ports, input, current) : null);
  if (input.h && current) {
    const gate = await admittedEnvelope(ports, verb, input, current, held.world, tx, recovered);
    if ("res" in gate) return gate;
    current = gate.current;
  }
  const plan = await verb.run(ports, current, input, { ...tx, state: current });
  clearUnrecordedRecovery(verb, input, tx, recovered);
  addRecovery(plan, shared?.reasons ?? [], recovered);
  if (!plan.state && current !== tx.state) plan.state = current ?? undefined;
  plan.state = capabilitiesState(ports, plan.state, verb.name);
  if (!plan.state) {
    addStorageReport(plan, enforceStorage(ports, verb, input, tx, current, true));
    return { res: render(ports, verb.name, plan.resp, tx.state), plan };
  }
  reserveJobFinalState(ports, plan);
  const final = !plan.job;
  const draft = prepareStamp(ports, verb, input, held.world, tx, plan.state, plan.resp, final, held.startedAt);
  tx.reservePublish?.(draft.next, draft.callBytes + CLEANUP_RESPONSE_RESERVE);
  const prepared = plan.job && ownerOf(plan.state, plan.job.id)?.session.inCall;
  if (prepared?.runDir) ports.store.writeArtifact(prepared.runDir, "run.json", JSON.stringify({ prepared: true }));
  addStorageReport(plan, enforceStorage(ports, verb, input, tx, stateAfterPlan(plan, current), true));
  // A job's provisional response is never returned: only the finalized one leaves the process.
  return {
    res: publishStamp(
      tx,
      prepareStamp(ports, verb, input, held.world, tx, plan.state, plan.resp, final, held.startedAt),
    ),
    plan,
  };
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
    result = {
      error: e instanceof Error ? e.message : String(e),
      ...(e instanceof KernelError ? { errorCode: e.reasons[0]?.code } : {}),
    };
  }
  return publishResult(ports, verb, input, first, job, result, held.world, held.startedAt);
}
