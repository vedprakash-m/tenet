// Counters, reservations, warnings, stops and failure signatures (TS §8.6). The only module that changes a counter.
import { AccountingCheckpoint } from "./schemas.ts";
import type { BudgetState, Lane, Reservation, State, StopReason } from "./schemas.ts";
import { sha256 } from "./ids.ts";

export const LIMITS: Record<Lane, { attempts: number; rounds: number; delegations: number; retries: number; minutes: number }> = {
  quick: { attempts: 3, rounds: 1, delegations: 2, retries: 2, minutes: 15 },
  standard: { attempts: 3, rounds: 2, delegations: 6, retries: 2, minutes: 60 },
  deep: { attempts: 4, rounds: 2, delegations: 12, retries: 2, minutes: 120 },
};

export const newBudget = (): BudgetState => ({
  attempts: 0, reviewRounds: 0, rechecks: 0, reservations: [], delegations: 0, checksLaunched: 0, tenetTokens: 0, signatures: [],
  activeMinutesSinceCheckIn: 0, activeMinutesTotal: 0,
});

const frac = (n: number, max: number) => `${n}/${max}`;
export function summarize(b: BudgetState, lane: Lane): { attempts: string; rounds: string; delegations: string } {
  const l = LIMITS[lane];
  return { attempts: frac(b.attempts, l.attempts), rounds: frac(b.reviewRounds, l.rounds), delegations: frac(b.delegations + b.reservations.length, l.delegations) };
}

/** True at or above 80% of any counter (WRK-12): the handoff is written proactively. */
export function nearLimit(b: BudgetState, lane: Lane, now?: string): boolean {
  const l = LIMITS[lane];
  const used = b.delegations + b.reservations.length;
  const activeGap = now && b.lastCall?.exit === 0
    ? Math.max(0, Date.parse(now) - Date.parse(b.lastCall.at)) / 60_000
    : 0;
  return b.attempts >= l.attempts * 0.8 || b.reviewRounds >= l.rounds * 0.8 || used >= l.delegations * 0.8 ||
    b.activeMinutesSinceCheckIn + activeGap >= l.minutes * 0.8;
}

/** Active time: call durations plus the gap after a call that said to keep working; the wait after a question is not work (TS §8.6). */
export function accrueTime(b: BudgetState, call: { startedAt: string; endedAt: string; exit: number; checkIn: boolean }): BudgetState {
  const start = Date.parse(call.startedAt), end = Date.parse(call.endedAt);
  const gap = b.lastCall?.exit === 0 ? Math.max(0, start - Date.parse(b.lastCall.at)) : 0;
  const minutes = (Math.max(0, end - start) + gap) / 60_000;
  return {
    ...b, activeMinutesTotal: b.activeMinutesTotal + minutes,
    activeMinutesSinceCheckIn: call.checkIn ? 0 : b.activeMinutesSinceCheckIn + minutes, lastCall: { at: call.endedAt, exit: call.exit },
  };
}

/** Checked before a new attempt, counting the gap since the last call; a step already running is never stopped (PRD 4.4.2). */
export function timeUp(b: BudgetState, lane: Lane, now: string): boolean {
  const gap = b.lastCall?.exit === 0 ? Math.max(0, Date.parse(now) - Date.parse(b.lastCall.at)) / 60_000 : 0;
  return b.activeMinutesSinceCheckIn + gap >= LIMITS[lane].minutes;
}

export const attemptsLeft = (b: BudgetState, lane: Lane): number => Math.max(0, LIMITS[lane].attempts - b.attempts);

/** A dispatch beyond the limit is refused before it happens: the limit counts delegations plus live reservations. */
export const canReserve = (b: BudgetState, lane: Lane): boolean => b.delegations + b.reservations.length < LIMITS[lane].delegations;

export function reserve(b: BudgetState, r: Reservation): BudgetState {
  return { ...b, reservations: [...b.reservations.filter((x) => x.id !== r.id), r] };
}

/** Reservations live exactly as long as their manifest is valid; an unsettled one is released and not counted. */
export function releaseStale(b: BudgetState, candidate: string, basisHash: string): BudgetState {
  const live = b.reservations.filter((r) => r.candidate === candidate && r.basisHash === basisHash);
  return live.length === b.reservations.length ? b : { ...b, reservations: live };
}

export const recordAttempt = (b: BudgetState): BudgetState => ({ ...b, attempts: b.attempts + 1 });
export const recordLaunchedChecks = (b: BudgetState, n: number): BudgetState => ({ ...b, checksLaunched: b.checksLaunched + n });
export const recordDelegation = (b: BudgetState): BudgetState => ({ ...b, delegations: b.delegations + 1 });
export const addTokens = (b: BudgetState, n: number): BudgetState => ({ ...b, tenetTokens: b.tenetTokens + n });

export function settleReservation(b: BudgetState, id: string, opts: { countRound: boolean; recheck: boolean; native?: boolean }): BudgetState {
  return {
    ...b,
    reservations: b.reservations.filter((r) => r.id !== id),
    delegations: b.delegations + (opts.native === false ? 0 : 1),
    reviewRounds: b.reviewRounds + (opts.countRound && !opts.recheck ? 1 : 0),
    rechecks: b.rechecks + (opts.countRound && opts.recheck ? 1 : 0),
  };
}

/** Same signature twice in a row, or an A-B-A-B oscillation (WRK-09). */
export function repeatedFailure(signatures: readonly string[]): boolean {
  const s = signatures;
  const n = s.length;
  if (n >= 2 && s[n - 1] === s[n - 2]) return true;
  return n >= 4 && s[n - 1] === s[n - 3] && s[n - 2] === s[n - 4] && s[n - 1] !== s[n - 2];
}

export const withSignature = (b: BudgetState, sig: string): BudgetState => ({ ...b, signatures: [...b.signatures, sig].slice(-8) });

/** The stop reason a counter state implies, if any; the verdict handles it honestly (WRK-09). */
export function stopFor(b: BudgetState, lane: Lane): StopReason | undefined {
  if (repeatedFailure(b.signatures)) return "repeated-failure";
  if (b.attempts >= LIMITS[lane].attempts && b.signatures.length > 0) return "budget-exhausted";
  return undefined;
}

/** Failure signature: the obligation, the sorted failing tests and the first normalized error line. */
export function failureSignature(obligation: string, failing: readonly string[], firstError: string): string {
  const norm = firstError.replace(/\d+/g, "N").replace(/\s+/g, " ").trim().slice(0, 160);
  return opaqueSignature(`${obligation}|${[...failing].sort().join(",")}|${norm}`);
}

const opaqueSignature = (s: string): string => /^sig:[a-f0-9]{64}$/.test(s) ? s : `sig:${sha256(s)}`;
const privateBudget = (b: BudgetState): BudgetState => ({ ...b, signatures: b.signatures.map(opaqueSignature) });

/** Journal only accounting deltas, never requests, evidence, grants or error text. Checkpoint before publication. */
export function accountingCheckpoint(next: State, previous: State | undefined): Omit<ReturnType<typeof AccountingCheckpoint.parse>, "t"> {
  return {
    kind: "accounting", workspaceId: next.workspaceId, revision: next.revision, workSeq: next.workSeq, generationSeq: next.generationSeq,
    complete: !next.recovered || next.recovered.accounting === "verified",
    inFlight: Object.values(next.work).filter(w => w.session.inCall).map(w => w.id),
    entries: Object.values(next.work).filter(w => {
      const old = previous?.work[w.id];
      return !old || old.session.generation !== w.session.generation || JSON.stringify(privateBudget(old.budget)) !== JSON.stringify(privateBudget(w.budget));
    }).map(w => ({ work: w.id, generation: w.session.generation, budget: privateBudget(w.budget) })),
  };
}

/** A checkpoint can only raise used counters/sequences. It cannot reconstruct missing authority or evidence. */
export function recoverAccounting(state: State, records: readonly unknown[]): { state: State; verified: boolean } {
  let next: State = { ...state, work: Object.fromEntries(Object.entries(state.work).map(([id, w]) => [id, { ...w, budget: privateBudget(w.budget) }])) };
  let invalid = false;
  const points = records.flatMap(record => {
    if (!record || typeof record !== "object" || (record as { kind?: unknown }).kind !== "accounting") return [];
    const parsed = AccountingCheckpoint.safeParse(record);
    if (!parsed.success) { invalid = true; return []; }
    return parsed.data.workspaceId === state.workspaceId && parsed.data.revision > state.revision ? [parsed.data] : [];
  });
  for (const point of points) {
    if (point.workSeq < next.workSeq || point.generationSeq < next.generationSeq) invalid = true;
    next = { ...next, workSeq: Math.max(next.workSeq, point.workSeq), generationSeq: Math.max(next.generationSeq, point.generationSeq) };
    for (const entry of point.entries) {
      const w = next.work[entry.work];
      if (!w || entry.generation < w.session.generation) continue;
      const b = w.budget, observed = privateBudget(entry.budget);
      if ((["attempts", "reviewRounds", "rechecks", "delegations", "checksLaunched", "tenetTokens", "activeMinutesTotal"] as const)
        .some(key => observed[key] < b[key])) invalid = true;
      const budget: BudgetState = {
        ...observed,
        attempts: Math.max(b.attempts, observed.attempts),
        reviewRounds: Math.max(b.reviewRounds, observed.reviewRounds),
        rechecks: Math.max(b.rechecks, observed.rechecks),
        delegations: Math.max(b.delegations, observed.delegations),
        checksLaunched: Math.max(b.checksLaunched, observed.checksLaunched),
        tenetTokens: Math.max(b.tenetTokens, observed.tenetTokens),
        activeMinutesTotal: Math.max(b.activeMinutesTotal, observed.activeMinutesTotal),
        signatures: observed.attempts >= b.attempts ? observed.signatures : b.signatures,
      };
      const stopReason = stopFor(budget, w.lane) ?? w.stopReason;
      const updated = { ...w, budget, session: { ...w.session, generation: entry.generation }, ...(stopReason ? { stopReason } : {}) };
      const owner = next.sourceOwner?.work === w.id ? { sourceOwner: { work: w.id, generation: entry.generation } } : {};
      next = { ...next, work: { ...next.work, [w.id]: updated }, ...owner };
    }
  }
  let revision = state.revision, contiguous = true, checkpoint = "";
  for (const point of points) {
    const signature = JSON.stringify({ complete: point.complete, inFlight: point.inFlight });
    if (point.revision !== revision + 1 && (point.revision !== revision || signature !== checkpoint)) contiguous = false;
    revision = point.revision;
    checkpoint = signature;
  }
  const latest = points.at(-1);
  const verified = !invalid && contiguous && !!latest?.complete && latest.inFlight.length === 0;
  return { state: next, verified };
}
