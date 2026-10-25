// Version pinning (LFC-03, specs/schema-migration.md v2). A contract is pinned to the kernel line, state schema and adapter it was
// created under; a call under different ones pauses until the user reconciles. Pure.
import { hashOf } from "./ids.ts";
import type { Question, WorkContract } from "./schemas.ts";

export interface Versions { tenet: string; schema: number; adapter: string }
export interface Drift { field: "kernel" | "schema" | "adapter"; was: string; now: string; downgrade: boolean }

export function schemaStatus(record: unknown, current: number): "supported" | "unsupported" | "unavailable" {
  if (typeof record !== "object" || record === null || Array.isArray(record) || !Object.hasOwn(record, "schema")) {
    return "unavailable";
  }
  const schema = (record as { schema: unknown }).schema;
  return Number.isSafeInteger(current) && current > 0 && schema === current ? "supported" : "unsupported";
}

/** The part of the kernel version that pauses a contract: major.minor and any pre-release tag; a patch release does not. */
export const kernelLine = (v: string): string => {
  const m = /^(\d+)\.(\d+)\.\d+(.*)$/.exec(v);
  return m ? `${m[1]}.${m[2]}${m[3]}` : v;
};

const num = (v: string): number[] => (/(\d+)(?:\.(\d+))?/.exec(v) ?? []).slice(1).map(Number);
const lower = (a: string, b: string): boolean => {
  const [x, y] = [num(a), num(b)];
  for (let i = 0; i < 2; i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) < (y[i] ?? 0);
  return false;
};

/** What differs between a contract's pin and the running versions. A missing adapter (an older document) is not a difference. */
export function versionDrift(pinned: WorkContract["pinned"], now: Versions): Drift[] {
  const out: Drift[] = [];
  const add = (field: Drift["field"], was: string, to: string, downgrade: boolean) => out.push({ field, was, now: to, downgrade });
  if (kernelLine(pinned.tenet) !== kernelLine(now.tenet)) add("kernel", pinned.tenet, now.tenet, lower(now.tenet, pinned.tenet));
  if (pinned.schema !== now.schema) add("schema", String(pinned.schema), String(now.schema), now.schema < pinned.schema);
  if (pinned.adapter && pinned.adapter !== now.adapter) add("adapter", pinned.adapter, now.adapter, lower(now.adapter, pinned.adapter));
  return out;
}

const one = (d: Drift) => `${d.field} ${d.was} to ${d.now}${d.downgrade ? ", older" : ""}`;
export const driftText = (drift: readonly Drift[]): string => `Tenet changed since this contract started (${drift.map(one).join("; ")}).`;

/** The one question a paused contract asks: continue under the new versions, or stop. */
export function driftQuestion(drift: readonly Drift[]): Question {
  return {
    id: "version-reconcile", header: "Tenet changed", channel: "native", bind: { factsHash: hashOf(drift).slice(0, 12) },
    question: `${driftText(drift)} Continue under the new versions? Old checks run again; grants, limits and intent stay.`,
    options: [
      { label: "Continue", description: "Pin this contract to the running versions", recommended: !drift.some((d) => d.downgrade) },
      { label: "Stop", description: "Park the contract; nothing else changes" },
    ],
  };
}
