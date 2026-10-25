// Constructors for the state document and a contract (TS §7.2). Pure: ids and time arrive as arguments.
import { newBudget, recoverAccounting } from "./budget.ts";
import { SCHEMA_VERSION } from "./schemas.ts";
import type { Lane, Level, ModelRecord, Profile, StartSnapshot, State, WorkContract } from "./schemas.ts";
import type { LogEntry } from "../ports/types.ts";
import { hashOf } from "./ids.ts";

export function adoptionReplayNeeded(
  state: State, op: { file: string; after: string; previousTrust?: string | null },
): boolean {
  const current = state.trust.find(entry => entry.file === op.file);
  if (current?.hash === op.after) return false;
  return op.previousTrust === undefined ? !current : (current ? hashOf(current) : null) === op.previousTrust;
}

export function recordedResults(log: readonly LogEntry[]): Array<{ effect: string; op: unknown; outcome: unknown }> {
  const intents = new Map<string, LogEntry>();
  for (const entry of log) {
    if (entry.kind !== "intent") continue;
    const key = JSON.stringify([entry.effect, entry.id]);
    if (!intents.has(key)) intents.set(key, entry);
  }
  return log.flatMap(entry => {
    if (entry.kind !== "result" || !entry.effect) return [];
    const intent = intents.get(JSON.stringify([entry.effect, entry.id]));
    return intent ? [{ effect: entry.effect, op: intent.op, outcome: entry.outcome }] : [];
  });
}

export const emptyState = (workspaceId: string, tag: string): State => ({
  schema: SCHEMA_VERSION, revision: 0, workspaceId, tag, generationSeq: 0, workSeq: 0,
  project: {
    intent: { revision: 0, overview: { purpose: "", users: "", preferences: [], nonGoals: [] }, elements: [], plan: [], records: [] },
    moduleRoot: ".", traits: [], adoption: { intent: "undecided", policy: "undecided", charter: "undecided" },
  },
  config: { local: {}, revision: 0 }, consents: [], trust: [], locks: [], pending: [], lessons: [], work: {}, archive: [],
});

export function recoveredState(state: State, at: string, records: readonly unknown[]): State {
  const accounting = recoverAccounting(state, records);
  return { ...accounting.state, consents: [], recovered: { from: "state.prev", at, accounting: accounting.verified ? "verified" : "unknown" }, work: Object.fromEntries(Object.entries(accounting.state.work).map(([id, w]) => { const { last: _cached, ...session } = w.session; return [id, { ...w, grants: [], session }]; })) };
}

/** The model as the coordinator reported it, or unknown: it is never inferred (RSC-02). */
export const modelRecord = (requested?: string): ModelRecord =>
  requested
    ? { requested, source: "reported", qualification: "unknown" }
    : { requested: "inherited", source: "unknown", qualification: "unknown" };

export interface NewContract {
  id: string; label: string; profile: Profile; request: string; lane: Lane; floor: Lane; level: Level;
  generation: number; now: string; version: string; adapter?: string; assessment: Record<string, "low" | "high">;
  scopePaths: string[]; protectedPaths: string[]; gitMode: "git" | "shadow" | "none";
  base: string | null; branch: string | null; start: StartSnapshot; planItem?: string; model?: string;
}

export const newContract = (n: NewContract): WorkContract => ({
  id: n.id, label: n.label, profile: n.profile, request: n.request, lane: n.lane, floor: n.floor, level: n.level,
  state: "proposed", session: { generation: n.generation }, outcome: "",
  scope: { paths: n.scopePaths, protected: n.protectedPaths },
  grants: [], obligations: [], receipts: [], attention: [], findings: [], reviews: [], analyses: [], declined: [],
  git: { mode: n.gitMode, base: n.base, branch: n.branch, start: n.start, commits: [], committed: [] },
  touched: [], vetted: {}, includeDirty: [], keepOut: [], budget: newBudget(), acceptance: "pending", assessment: n.assessment,
  pinned: { tenet: n.version, schema: SCHEMA_VERSION, ...(n.adapter ? { adapter: n.adapter } : {}) }, createdAt: n.now, updatedAt: n.now,
  model: modelRecord(n.model), ...(n.planItem ? { planItem: n.planItem } : {}),
});

/** Contracts that still hold their place: not finished, cancelled or superseded. */
export const isLive = (w: WorkContract): boolean => !["finished", "cancelled", "superseded"].includes(w.state);
