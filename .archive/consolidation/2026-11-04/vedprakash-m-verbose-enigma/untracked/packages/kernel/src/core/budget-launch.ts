// Launch ledger and proof-validity fence (config-completion 18.2 to 18.4, 20.1 to 20.3). Pure: validated events and cumulative tables
// in, tables and
// unit deltas out. This module never changes a counter; the one place that does is `recordLaunchedChecks` in budget.ts, applied to
// `addUnits`.
// A spawn without an acknowledgment is uncertain by design: it is reported, never refunded and never guessed.
import { stableStringify } from "./ids.ts";
import { AccountingCheckpoint2 } from "./schemas.ts";
import { recordLaunchedChecks } from "./budget.ts";
import type { z } from "zod";
import type { ConfigStamp, JobSettlement, LaunchEvent, LaunchKey, LaunchOwner, Recovery, State2 } from "./schemas.ts";

type Prepared = Extract<LaunchEvent, { phase: "prepared" }>;
type Phase = LaunchEvent["phase"];
export interface Launch { ordinal: number; prepared: Prepared; phase: Phase; cause?: string }
export interface Ledger { events: LaunchEvent[]; jobs: Map<number, Launch[]>; issues: string[]; after: ReadonlyMap<number, number> }

const AFTER: Record<Phase, Phase[]> = { prepared: ["starting", "no-launch"], starting: ["launched", "no-launch"], launched: [],
  "no-launch": [] };
const PRE_START = new Set(["cancelled-before-start", "refused-before-start"]);
const identity = (e: LaunchEvent): string => stableStringify(e);

function legal(from: Phase, e: LaunchEvent): boolean {
  if (!AFTER[from].includes(e.phase)) return false;
  if (e.phase !== "no-launch") return true;
  return from === "prepared" ? PRE_START.has(e.cause) : e.cause === "spawn-failed-no-child";
}

/**
 * Folds journal events in order. Each ordinal starts with `prepared`, advances only along the legal transitions, never changes once
 * terminal, and
 * the ordinals of a job are contiguous with one owner. A foreign or cloned record (another workspace) never joins the lineage.
 */
export function foldLedger(
  events: readonly LaunchEvent[], workspaceId?: string, after: ReadonlyMap<number, number> = new Map(),
): Ledger {
  const out: Ledger = { events: [...events], jobs: new Map(), issues: [], after };
  const owners = new Map<number, string>(), last = new Map<string, LaunchEvent>();
  for (const e of events) {
    const { jobSeq } = e.key.job, ordinal = e.key.ordinal, name = `launch ${jobSeq}/${ordinal}`;
    if (e.key.job.workspaceId !== e.owner.work.workspaceId) { out.issues.push(`${name}: owner belongs to another workspace`); continue; }
    if (workspaceId && e.key.job.workspaceId !== workspaceId) { out.issues.push(`${name}: another workspace's record`); continue; }
    const settledThrough = after.get(jobSeq) ?? 0;
    if (ordinal <= settledThrough) { out.issues.push(`${name}: event is at or before the settled prefix`); continue; }
    if (!owners.has(jobSeq)) owners.set(jobSeq, stableStringify(e.owner));
    if (owners.get(jobSeq) !== stableStringify(e.owner)) { out.issues.push(`${name}: a second owner for the job`); continue; }
    const chain = out.jobs.get(jobSeq) ?? [];
    const here = chain.find((l) => l.ordinal === ordinal);
    if (!here) {
      if (e.phase !== "prepared") out.issues.push(`${name}: ${e.phase} without prepared`);
    else if (ordinal !== settledThrough + chain.length + 1) out.issues.push(`${name}: ordinals are not contiguous`);
      else { chain.push({ ordinal, prepared: e, phase: "prepared" }); out.jobs.set(jobSeq, chain); last.set(name, e); }
      continue;
    }
    if (identity(last.get(name)!) === identity(e)) continue; // an identical replay of the current phase
    if (e.phase === "prepared") out.issues.push(`${name}: prepared again with different content`);
    else if (!legal(here.phase, e)) out.issues.push(`${name}: ${here.phase} cannot become ${e.phase}`);
    else { here.phase = e.phase; if (e.phase === "no-launch") here.cause = e.cause; last.set(name, e); }
  }
  return out;
}

const terminal = (l: Launch) => l.phase === "launched" || l.phase === "no-launch";
const units = (l: Launch) => (l.phase === "launched" ? l.prepared.obligations.length : 0);

export interface Settlement { job: JobSettlement; addUnits: number; beyondHole: number; unresolved: number[]; complete: boolean }

/**
 * Settles the contiguous terminal prefix after `settledThrough`. Units are the captured obligations of known launches, once; a hole
 * keeps later
 * known launches apart (`beyondHole`) until it resolves. Uncertain entries are listed, not counted and not refunded.
 */
export function settleJob(job: JobSettlement, ledger: Ledger, jobSeq: number): Settlement {
  const chain = ledger.jobs.get(jobSeq) ?? [];
  const after = ledger.after.get(jobSeq) ?? 0;
  if (after > job.settledThrough) throw new Error("the ledger checkpoint is ahead of the job settlement");
  if (after > 0 && after !== job.settledThrough) throw new Error("the ledger suffix does not start at the settled prefix");
  if (chain.some((launch) => launch.ordinal > job.allocatedThrough)) {
    throw new Error("the ledger contains a launch beyond the durably allocated prefix");
  }
  let through = job.settledThrough, add = 0;
  while (true) {
    const next = chain.find((l) => l.ordinal === through + 1);
    if (!next || !terminal(next)) break;
    add += units(next);
    through++;
  }
  const rest = chain.filter((l) => l.ordinal > through);
  const byOrdinal = new Map(chain.map((l) => [l.ordinal, l]));
  const allocatedThrough = job.allocatedThrough;
  const unresolved: number[] = [];
  for (let ordinal = through + 1; ordinal <= allocatedThrough; ordinal++) {
    const launch = byOrdinal.get(ordinal);
    if (!launch || !terminal(launch)) unresolved.push(ordinal);
  }
  const settledUnits = job.settledUnits + add;
  if (!Number.isSafeInteger(settledUnits)) throw new Error("the settled-unit counter is exhausted");
  return {
    job: { ...job, allocatedThrough, settledThrough: through,
      settledUnits },
    addUnits: add, beyondHole: rest.reduce((n, l) => n + units(l), 0), unresolved,
    complete: unresolved.length === 0,
  };
}

/** Allocates the next launch identity before a prepared event or process can be created. */
export function allocateLaunch(job: JobSettlement): { key: LaunchKey; job: JobSettlement } {
  if (job.closed) throw new Error("the job is closed");
  if (job.key.workspaceId !== job.owner.work.workspaceId) throw new Error("the job owner belongs to another workspace");
  const ordinal = job.allocatedThrough + 1;
  if (!Number.isSafeInteger(ordinal)) throw new Error("the launch ordinal space is exhausted");
  return { key: { job: job.key, ordinal }, job: { ...job, allocatedThrough: ordinal } };
}

/**
 * Applies one job's contiguous settlement and its budget delta as one checkpoint value. Callers must publish this value atomically;
 * unresolved holes remain in recovery and do not increment the budget.
 */
export function settleAccountingCheckpoint(
  input: z.infer<typeof AccountingCheckpoint2>, events: readonly LaunchEvent[], jobSeq: number,
): { checkpoint: z.infer<typeof AccountingCheckpoint2>; settlement: Settlement } {
  const jobs = input.recovery.jobs.filter((j) => j.key.jobSeq === jobSeq);
  if (jobs.length !== 1) throw new Error(`accounting checkpoint has no unique job ${jobSeq}`);
  const job = jobs[0]!;
  if (job.key.workspaceId !== input.workspaceId || input.recovery.jobSeq < jobSeq) {
    throw new Error(`job ${jobSeq} is outside the checkpoint high-water`);
  }
  const entries = input.entries.filter((e) => e.work === job.owner.work.work && e.generation === job.owner.generation);
  if (entries.length !== 1) throw new Error(`accounting checkpoint has no unique owner entry for job ${jobSeq}`);
  const selected = events.filter((e) => e.key.job.jobSeq === jobSeq && e.key.ordinal > job.settledThrough);
  const ledger = foldLedger(selected, input.workspaceId, new Map([[jobSeq, job.settledThrough]]));
  if (ledger.issues.length) throw new Error(`job ${jobSeq} ledger is invalid: ${ledger.issues.join("; ")}`);
  const chain = ledger.jobs.get(jobSeq) ?? [];
  if (chain.length && stableStringify(chain[0]!.prepared.owner) !== stableStringify(job.owner)) {
    throw new Error(`job ${jobSeq} ledger owner differs from its checkpoint`);
  }
  const settlement = settleJob(job, ledger, jobSeq);
  const entry = entries[0]!;
  const nextCount = entry.budget.checksLaunched + settlement.addUnits;
  if (!Number.isSafeInteger(nextCount)) throw new Error("the launched-check counter is exhausted");
  const checkpoint = AccountingCheckpoint2.parse({
    ...input,
    recovery: { ...input.recovery, jobs: input.recovery.jobs.map((j) => j.key.jobSeq === jobSeq ? settlement.job : j) },
    entries: input.entries.map((e) => e === entry
      ? { ...e, budget: recordLaunchedChecks(e.budget, settlement.addUnits) }
      : e),
  });
  return { checkpoint, settlement };
}

/** A chain that stopped at `prepared` proves no launch (every spawn path requires `starting` first), so recovery may close it. */
export function recoverPrepared(ledger: Ledger): LaunchEvent[] {
  return [...ledger.jobs.values()].flat().filter((l) => l.phase === "prepared").map((l) => ({
    kind: "launch" as const, version: 2 as const, key: l.prepared.key, owner: l.prepared.owner, phase: "no-launch" as const,
      cause: "cancelled-before-start" as const,
  }));
}

/** Process groups that stop/recovery must inspect, with the full job identity so equal ordinals cannot alias. */
export const ownershipSet = (ledger: Ledger, jobSeq?: number): Array<{ key: LaunchKey; owner: LaunchOwner }> =>
  [...ledger.jobs.entries()].sort(([a], [b]) => a - b)
    .filter(([seq]) => jobSeq === undefined || seq === jobSeq)
    .flatMap(([, launches]) => launches
      .filter((l) => l.phase === "starting" || l.phase === "launched")
      .map((l) => ({ key: l.prepared.key, owner: l.prepared.owner })));

/** The job number is allocated above the durable high-water before any command can run; it is never reused. */
export function allocateJob(r: Recovery, owner: JobSettlement["owner"]): { key: JobSettlement["key"]; recovery: Recovery } {
  if (r.jobSeq >= Number.MAX_SAFE_INTEGER) throw new Error("the job sequence is exhausted");
  const key = { workspaceId: owner.work.workspaceId, jobSeq: r.jobSeq + 1 };
  const job = { key, owner, allocatedThrough: 0, settledThrough: 0, settledUnits: 0, closed: false };
  return { key, recovery: { ...r, jobSeq: key.jobSeq, jobs: [...r.jobs, job] } };
}

export type Eligibility = "current" | "fence-pending" | "unavailable";

/**
 * Whether a work's proof may be used. The durable floor decides, not the readable primary: a floor above the stamp (a checkpoint whose
 * state was
 * never installed) or any view recovered from the previous state holds proof back until a recovery stamp is issued; a work with no floor
 * is unavailable.
 */
export function eligibility(s: State2, fromPrevious: boolean): Record<string, Eligibility> {
  return Object.fromEntries(Object.values(s.work).map((w): [string, Eligibility] => {
    const floors = s.recovery.validity.filter((v) => v.key.work === w.id && v.key.workspaceId === s.workspaceId);
    if (floors.length > 1) return [w.id, "fence-pending"];
    const floor = floors[0];
    if (!floor) return [w.id, "unavailable"];
    return [w.id,
      !fromPrevious && floor.hash === w.configEvidence.hash && floor.serial === w.configEvidence.serial ? "current" : "fence-pending"];
  }));
}

/** Recovery issues one stamp above every admitted retained serial; with none retained there is nothing to base a binding on. */
export function recoveredStamp(hash: string, retained: readonly number[]): ConfigStamp {
  if (!retained.length) throw new Error("no retained serial to allocate above");
  const serial = Math.max(...retained) + 1;
  if (serial > Number.MAX_SAFE_INTEGER) throw new Error("the configuration serial space is exhausted");
  return { hash, serial };
}
