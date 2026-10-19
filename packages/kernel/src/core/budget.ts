// Counters, reservations, warnings, stops and failure signatures (TS §8.6). The only module that changes a counter.
import type { BudgetState, Lane, Reservation, StopReason } from "./schemas.ts";

export const LIMITS: Record<Lane, { attempts: number; rounds: number; delegations: number; retries: number }> = {
  quick: { attempts: 3, rounds: 1, delegations: 2, retries: 2 },
  standard: { attempts: 3, rounds: 2, delegations: 6, retries: 2 },
  deep: { attempts: 4, rounds: 2, delegations: 12, retries: 2 },
};

export const newBudget = (): BudgetState => ({
  attempts: 0, reviewRounds: 0, rechecks: 0, reservations: [], delegations: 0, checksLaunched: 0, tenetTokens: 0, signatures: [],
});

const frac = (n: number, max: number) => `${n}/${max}`;
export function summarize(b: BudgetState, lane: Lane): { attempts: string; rounds: string; delegations: string } {
  const l = LIMITS[lane];
  return { attempts: frac(b.attempts, l.attempts), rounds: frac(b.reviewRounds, l.rounds), delegations: frac(b.delegations + b.reservations.length, l.delegations) };
}

/** True at or above 80% of any counter (WRK-12): the handoff is written proactively. */
export function nearLimit(b: BudgetState, lane: Lane): boolean {
  const l = LIMITS[lane];
  return b.attempts >= l.attempts * 0.8 || b.reviewRounds >= l.rounds * 0.8 || b.delegations + b.reservations.length >= l.delegations * 0.8;
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

export function settleReservation(b: BudgetState, id: string, opts: { countRound: boolean; recheck: boolean }): BudgetState {
  return {
    ...b,
    reservations: b.reservations.filter((r) => r.id !== id),
    delegations: b.delegations + 1,
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
  return `${obligation}|${[...failing].sort().join(",")}|${norm}`;
}
