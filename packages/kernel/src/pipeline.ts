// One pipeline for every verb (TS §6.1): parse, class, lock, pure plan, in-lock effects, publish, external jobs,
// then the response is rebuilt from the finalized result. Locking, recovery, the envelope and logging exist once here.
import { ZodError } from "zod";
import type { ZodType } from "zod";
import { summarize } from "./core/budget.ts";
import { formatHandle, hashOf, parseHandle } from "./core/ids.ts";
import { inputProblem } from "./core/input.ts";
import { routineAuthorized } from "./core/authority.ts";
import { KernelError } from "./core/errors.ts";
import { redact, redactDeep } from "./core/redact.ts";
import { isEditingProfile, laneFloor, maxLane, raise } from "./core/risk.ts";
import { allowed, matches } from "./core/exclusions.ts";
import type { Exclusion } from "./core/exclusions.ts";
import { recover } from "./verbs/recover.ts";
import { configurePolicy, reconcileShared, settingsFor } from "./verbs/reconcile.ts";
import type { KernelResponse, Question, Reason, State, WorkContract } from "./core/schemas.ts";
import type { Ports, Tx } from "./ports/types.ts";

type Exit = 0 | 1 | 2 | 3 | 4 | 5;
type Next = KernelResponse["next"][number];

/** A verb's contribution to the response; the pipeline adds verb, revision, handle, budget and kernel info. */
export { KernelError };
export interface Resp {
  exit?: Exit; reasons?: Reason[]; next?: Next[]; questions?: Question[]; progress?: KernelResponse["progress"];
  effects?: KernelResponse["effects"]; data?: unknown; work?: string; kernel?: boolean;
}

/** Work that spawns a process runs between two transactions and never holds the lock (TS §7.3). */
export interface Job {
  id: string;
  execute(): Promise<unknown>;
  finalize(tx: Tx, state: State, result: unknown): Promise<{ state: State; resp: Resp }>;
}

export interface Plan { state?: State; resp: Resp; job?: Job }

export type OpClass = "stateless" | "read-only" | "mutating";

export interface Verb<I = any> {
  name: string;
  schema: ZodType<I>;
  class(input: I): OpClass;
  /** Mutating verbs that take source ownership (TS §6.3); others never need it. */
  editing?(input: I, state: State | null): boolean;
  run(ctx: Ports, state: State | null, input: I, tx?: Tx): Promise<Plan> | Plan;
  /** What the call's meaning also depends on besides its text, so an unchanged `check` after edits is a new call. */
  identity?(ctx: Ports, input: I, state: State | null): Promise<unknown>;
  /** The only step before the lock: maintenance that cannot need the lock it repairs (TS §7.3). */
  preLock?(ctx: Ports, input: I): Promise<void>;
}

export function workByHandle(state: State, h: string): WorkContract {
  const p = parseHandle(h);
  if (!p) throw new KernelError("stale-session", "malformed handle", { exit: 1 });
  if (p.tag !== state.tag) throw new KernelError("stale-session", "this handle belongs to another workspace");
  const w = Object.values(state.work).find((x) => x.label === `W-${String(p.labelN).padStart(4, "0")}`);
  if (!w) throw new KernelError("stale-session", `no contract ${h}`);
  if (w.session.generation !== p.generation) throw new KernelError("stale-session", "a newer chat took over this contract");
  return w;
}

export const handleOf = (state: State, w: WorkContract): string =>
  formatHandle(Number(w.label.slice(2)), w.session.generation, state.tag);

const DEFAULT_BUDGET = { attempts: "0/0", rounds: "0/0", delegations: "0/0" };

function render(ports: Ports, verb: string, resp: Resp, state: State | null, extra: Partial<KernelResponse> = {}): KernelResponse {
  const w = resp.work && state ? state.work[resp.work] : undefined;
  const reasons = [...(resp.reasons ?? [])];
  if (state?.recovered && !reasons.some(r => r.code === "state-recovered-from-backup")) reasons.push({
    code: "state-recovered-from-backup",
    message: `Recovered an older local revision; authority is suspended. Accounting is ${state.recovered.accounting ?? "unknown"}; reconfirmation is unavailable.`,
  });
  const exit = resp.exit ?? 0;
  const out: KernelResponse = {
    verb, exit: state?.recovered && exit === 0 ? 3 : exit, revision: state?.revision ?? 0, reasons, next: resp.next ?? [],
    budget: w ? summarize(w.budget, w.lane) : DEFAULT_BUDGET, ...extra,
  };
  if (w && state) out.handle = handleOf(state, w);
  if (resp.questions?.length) out.questions = resp.questions;
  if (resp.progress) out.progress = resp.progress;
  if (resp.effects) out.effects = resp.effects;
  if (resp.data !== undefined) out.data = resp.data;
  if (resp.kernel) out.kernel = { version: ports.version, schemaVersion: 1 };
  return redactDeep(out); // nothing displayed, and nothing cached on the contract, carries a likely secret (SEC-11)
}

const inputHash = (verb: string, input: unknown, world: unknown): string => {
  const { again: _again, ...rest } = (input ?? {}) as Record<string, unknown>;
  return hashOf({ verb, rest, world });
};

function fail(ports: Ports, verb: string, e: unknown, state: State | null): KernelResponse {
  if (e instanceof KernelError) return render(ports, verb, { exit: e.exit, reasons: e.reasons, ...(e.questions ? { questions: e.questions } : {}) }, state);
  if (e instanceof ZodError) return render(ports, verb, { exit: 1, reasons: [{ code: "invalid-input", message: e.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") }] }, state);
  const message = e instanceof Error ? e.message : String(e);
  // Internal errors never yield a success-shaped response (TS §6.1 principle 5).
  return render(ports, verb, { exit: 5, reasons: [{ code: "internal-error", message }] }, state);
}

export async function runVerb(ports: Ports, verbs: Record<string, Verb>, name: string, raw: unknown): Promise<KernelResponse> {
  const verb = verbs[name];
  if (!verb) return render(ports, name, { exit: 1, reasons: [{ code: "unknown-verb", message: `no verb "${name}"` }] }, null);
  const problem = inputProblem(raw);
  if (problem) return render(ports, name, { exit: 1, reasons: [{ code: "invalid-input", message: problem }] }, null);
  const parsed = verb.schema.safeParse(raw ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    return render(ports, name, { exit: 1, reasons: [{ code: "invalid-input", message: msg }] }, null);
  }
  // The user's own words and request text are kept as they said them, minus anything that looks like a secret (SEC-11).
  const input = Object.fromEntries(Object.entries(parsed.data as Record<string, unknown>).map(([k, v]) => [k, (k === "quote" || k === "request") && typeof v === "string" ? redact(v) : v])) as typeof parsed.data;
  const cls = verb.class(input);
  try {
    if (cls === "stateless") {
      if (name === "review") configurePolicy(ports, null);
      return render(ports, name, (await verb.run(ports, null, input)).resp, null);
    }
    if (cls === "read-only") {
      const read = ports.store.exists() ? ports.store.read() : null;
      configurePolicy(ports, read?.state ?? null);
      const plan = await verb.run(ports, read?.state ?? null, input);
      return render(ports, name, plan.resp, read?.state ?? null);
    }
    return await mutate(ports, verb, input);
  } catch (e) {
    return fail(ports, name, e, safeState(ports));
  }
}

/** The state for rendering an error; an unreadable store must not turn a refusal into a crash. */
function safeState(ports: Ports): State | null {
  try { return ports.store.exists() ? (ports.store.read()?.state ?? null) : null; } catch { return null; }
}

type Stamped = { res: KernelResponse; plan?: Plan };

/**
 * Renders the response for the revision about to be published and, for a final response, caches it on the contract in
 * the same publish. A job's provisional response is never cached: were the process to die mid-job, a retry would be
 * answered with a result nobody observed.
 */
function stamp(ports: Ports, verb: Verb, input: unknown, world: unknown, tx: Tx, next: State, resp: Resp, final: boolean): KernelResponse {
  const revision = (tx.state?.revision ?? 0) + 1;
  const res = render(ports, verb.name, resp, { ...next, revision });
  const w = resp.work ? next.work[resp.work] : undefined;
  if (final && w && verb.name !== "open") w.session = { ...w.session, last: { inputHash: inputHash(verb.name, input, world), response: res } };
  tx.publish(next);
  tx.call({ verb: verb.name, exit: res.exit, revision });
  return res;
}

async function mutate(ports: Ports, verb: Verb, input: any): Promise<KernelResponse> {
  const { store } = ports;
  let world: unknown = null;
  await verb.preLock?.(ports, input);
  const first: Stamped = await store.transaction(verb.name, async (tx) => {
    if (verb.name !== "stop") configurePolicy(ports, tx.state);
    const recovered = tx.state ? await recover(ports, tx, tx.state, { effects: verb.name !== "stop" }) : null;
    let current = recovered?.state ?? tx.state;
    if (current && recovered?.uncertain.length && verb.name !== "stop") {
      if (current !== tx.state) tx.publish(current);
      return { res: render(ports, verb.name, { exit: 2, effects: { completed: recovered.completed, uncertain: recovered.uncertain }, reasons: [{ code: "effect-uncertain", message: "An interrupted operation is still uncertain; dependent work is fenced until it is reconciled." }] }, current) };
    }
    const shared = current && !["open", "stop"].includes(verb.name) ? reconcileShared(ports, current) : null;
    if (shared) current = shared.state;
    if (verb.name !== "stop") configurePolicy(ports, current);
    // Envelope: a handle must name a live generation of a contract in this workspace; an identical retry is historical.
    const h: string | undefined = input.h;
    world = verb.identity ? await verb.identity(ports, input, current) : null;
    if (h && current) {
      let w = workByHandle(current, h);
      const quarantine = current.pending.find(q => q.id === "quarantine-review");
      if (quarantine && verb.name !== "stop" && !(verb.name === "decide" && (input.kind === "abandon-confirm" || input.kind === "adopt" && input.target === "quarantine"))) throw new KernelError("marker-mismatch", "Answer the imported-record question before continuing this contract.", { exit: 3, questions: [quarantine] });
      const takeover = current.pending.find(q => q.id === "takeover-check");
      if (takeover && verb.name !== "stop" && !(verb.name === "decide" && input.kind === "takeover-check")) throw new KernelError("takeover-check", "confirm that the earlier chat has stopped before continuing", { exit: 3, questions: [takeover] });
      if (verb.name !== "stop" && !(verb.name === "decide" && input.kind === "abandon-confirm") && w.session.inCall) throw new KernelError("work-busy", `a ${w.session.inCall.verb} is running`);
      const effectDecision = verb.name === "decide" && ["scaffold", "dependency", "sync-index", "undo-confirm"].includes(input.kind);
      if ((effectDecision || ["commit", "integrate", "undo"].includes(verb.name)) && !isEditingProfile(w.profile)) throw new KernelError("authority-needed", "this contract authorizes no source changes", { exit: 2 });
      const editing = effectDecision || (verb.name === "decide" && input.kind === "basis" && isEditingProfile(w.profile)) || (verb.editing?.(input, current) && isEditingProfile(w.profile) && !(verb.name === "finish" && w.state === "finished"));
      if (editing) {
        if (!routineAuthorized(w.grants, ports.clock.now())) throw new KernelError("authority-needed", "routine authority is suspended or expired; pause this contract and start a new contract from the user's request", { exit: 2 });
        if (current.sourceOwner && current.sourceOwner.work !== w.id) throw new KernelError("owned-by-other-work", `${current.work[current.sourceOwner.work]?.label ?? "another contract"} owns source`);
        if (["parked", "cancelled", "superseded"].includes(w.state)) throw new KernelError("stale-session", "resume this contract before editing", { exit: 2 });
        if (w.git.mode === "git" && ["check", "commit", "finish"].includes(verb.name) && input.stage !== "integrated" && (await ports.git.probe()).branch !== w.git.branch) throw new KernelError("stale-session", "the current branch differs from this contract; switch back before continuing", { exit: 2 });
        const prefs = settingsFor(ports, current, w);
        const forbidden = [...w.touched.map(t => t.path), ...(input.touched ?? [])].filter(p => !allowed("edit", p, prefs.exclusions as Exclusion[]));
        if (forbidden.length) throw new KernelError("authority-needed", `project exclusions forbid editing ${[...new Set(forbidden)].slice(0, 3).join(", ")}; no per-task grant overrides this restriction`, { exit: 2 });
        const protectedPaths = [...new Set([...w.scope.protected, ...(prefs.protected_paths as string[])])];
        const paths = (await ports.git.inventory([])).status.map(s => s.path);
        const assessment = raise(w.assessment, paths, current.project.traits, paths.some(p => protectedPaths.some(x => matches(x, p))));
        const floor = maxLane(w.floor, laneFloor(assessment));
        w = { ...w, assessment, floor, lane: maxLane(w.lane, floor), scope: { ...w.scope, protected: protectedPaths } };
        current = { ...current, work: { ...current.work, [w.id]: w }, sourceOwner: { work: w.id, generation: w.session.generation } };
      }
      const last = w.session.last;
      if (last && !input.again && last.inputHash === inputHash(verb.name, input, world)) {
        if (recovered && recovered.state !== tx.state) tx.publish(recovered.state);
        return { res: { ...(last.response as KernelResponse), historical: true as const } };
      }
    }
    const plan = await verb.run(ports, current, input, { ...tx, state: current });
    if (shared?.reasons.length) plan.resp.reasons = [...shared.reasons, ...(plan.resp.reasons ?? [])];
    if (recovered?.completed.length || recovered?.uncertain.length) plan.resp = { ...plan.resp, effects: { completed: [...recovered.completed, ...(plan.resp.effects?.completed ?? [])], uncertain: [...recovered.uncertain, ...(plan.resp.effects?.uncertain ?? [])] } };
    if (!plan.state && current !== tx.state) plan.state = current ?? undefined;
    if (!plan.state) return { res: render(ports, verb.name, plan.resp, tx.state), plan };
    if (plan.job) {
      const prepared = Object.values(plan.state.work).find(w => w.session.inCall?.runId === plan.job!.id)?.session.inCall;
      if (prepared?.runDir) ports.store.writeArtifact(prepared.runDir, "run.json", JSON.stringify({ prepared: true }));
    }
    // A job's provisional response is never returned: only the finalized one leaves the process.
    return { res: stamp(ports, verb, input, world, tx, plan.state, plan.resp, !plan.job), plan };
  });
  const job = first.plan?.job;
  if (!job) return first.res;
  const preparedOwner = first.plan?.state && Object.values(first.plan.state.work).find(w => w.session.inCall?.runId === job.id);
  const runDir = preparedOwner?.session.inCall?.runDir;
  if (runDir) ports.runner.guardRun(runDir, async spawn => {
    const admitted = await store.transaction(`${verb.name}:launch`, async tx => {
      const live = preparedOwner && tx.state?.work[preparedOwner.id];
      if (!live || live.session.generation !== preparedOwner.session.generation || live.session.inCall?.runId !== job.id || live.session.inCall.cancelled) throw new KernelError("run-superseded", "this job was cancelled before its process could start", { exit: 2 });
      // Spawn and write run.json synchronously while stop cannot acquire the lock; await execution only after release.
      return { pending: spawn() };
    });
    return admitted.pending;
  });
  let result: unknown;
  try {
    result = await job.execute();
  } catch (e) {
    result = { error: e instanceof Error ? e.message : String(e) };
  }
  const final = await store.transaction(verb.name, async (tx) => {
    if (!tx.state) throw new KernelError("marker-mismatch", "state vanished while a job ran");
    const prepared = first.plan?.state;
    const owner = prepared && Object.values(prepared.work).find(w => w.session.inCall?.runId === job.id);
    const live = owner && tx.state.work[owner.id];
    if (!live || live.session.generation !== owner.session.generation || live.session.inCall?.runId !== job.id || live.session.inCall.cancelled) return render(ports, verb.name, { exit: 2, work: owner?.id, reasons: [{ code: "run-superseded", message: "The job was cancelled or replaced; its result was discarded." }] }, tx.state);
    const out = await job.finalize(tx, tx.state, result);
    const effects = first.plan?.resp.effects;
    if (effects) out.resp.effects = {
      completed: [...new Set([...effects.completed, ...(out.resp.effects?.completed ?? [])])],
      uncertain: [...new Set([...effects.uncertain, ...(out.resp.effects?.uncertain ?? [])])],
    };
    if (out.state.sourceOwner?.work === live.id && out.state.work[live.id]?.state === "finished") {
      const { sourceOwner: _owner, ...rest } = out.state;
      out.state = rest;
    }
    return stamp(ports, verb, input, world, tx, out.state, out.resp, true);
  });
  return final;
}
