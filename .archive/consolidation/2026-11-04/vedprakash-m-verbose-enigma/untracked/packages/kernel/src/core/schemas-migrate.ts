// The pure rules of the 1 -> 2 migration protocol (schema-migration 16.4, 16.5, 18.2, 18.3): which bytes a preview binds, when consent
// holds, what blocks an upgrade, which on-disk tuples are recoverable, when a rollback is still pristine.
// No file is read; hashes and texts arrive as values.
import { z } from "zod";
import { hashOf, sha256 } from "./ids.ts";
import { Sha } from "./schemas.ts";
import type { Refusal } from "./schemas-legacy.ts";
import type { State, State2 } from "./schemas.ts";

const bytes = (v: string | null): string | null => (v === null ? null : sha256(v));

export interface PreviewInput {
  marker: string; primary: string; previous: string | null; log: string | null; summaries: string | null;
  references: { blobs: string[]; runDirs: string[]; manifests: string[] };
  bridge: string; target: string; registryVersion: string; design: string;
}

/** The canonical facts hash: every source byte and file-presence sentinel, the reference inventory and the build and design identities. */
export function previewFacts(i: PreviewInput): { factsHash: string } {
  const sorted = (a: string[]) => [...a].sort();
  const refs = { blobs: sorted(i.references.blobs), runDirs: sorted(i.references.runDirs), manifests: sorted(i.references.manifests) };
  return {
    factsHash: hashOf({
      schemas: [1, 2], marker: bytes(i.marker), primary: bytes(i.primary), previous: bytes(i.previous), log: bytes(i.log),
        summaries: bytes(i.summaries),
      refs, bridge: i.bridge, target: i.target, registryVersion: i.registryVersion, design: i.design,
    }),
  };
}

/**
 * Only `yes` with the preview's exact hash proceeds; `no` declines and writes nothing; a different hash is stale; anything else is
 * missing.
 */
export function consent(current: string, a: { answer?: string; factsHash?: string }): "accepted" | "declined" | "stale" | "missing" {
  if (a.answer === "no") return "declined";
  if (a.answer !== "yes" || !a.factsHash) return "missing";
  return a.factsHash === current ? "accepted" : "stale";
}

/** Work and records the migration must not cancel or settle: stop or reconcile them under the supported source kernel first (16.4). */
export function migrationBlockers(s: State): string[] {
  const out: string[] = [];
  for (const w of Object.values(s.work)) {
    if (w.session.inCall) out.push(`${w.label}: a call is in flight`);
    if (w.pendingEnvelope) out.push(`${w.label}: an execution envelope is pending`);
    if (w.budget.reservations.length || w.focusedReview) out.push(`${w.label}: a reviewer or analyst reservation is open`);
  }
  if (s.quarantine?.choice === "pending") out.push("a quarantine choice is pending");
  if (s.recovered?.accounting === "unknown") out.push("accounting is uncertain after recovery");
  return out;
}

// ---------------------------------------------------------------- ordered installation (16.5) and rollback (18.2)

export type Part = "previous" | "primary" | "marker";
export interface Pair { from: string | null; to: string | null }
/** Hashes with null for absence. Log and summaries never change in either direction. */
export type Plan = Record<Part, Pair> & { log: string | null; summaries: string | null };
export type Observed = Record<Part, string | null> & { log: string | null; summaries: string | null };
const ORDER: Part[] = ["previous", "primary", "marker"];

/**
 * The only next operation for what is on disk: previous, then primary, then the marker last, in either direction. A tuple is admitted only
 * as a prefix of that order; where a part's two values are equal (an absent previous both ways) the step collapses. Anything else refuses.
 */
export function nextStep(plan: Plan, seen: Observed, direction: "upgrade" | "rollback"): { ok: true; step: Part | "done" } | Refusal {
  const refuse = (detail: string): Refusal => ({ ok: false, reason: "unsupported-record", where: "migration-set", detail });
  if (seen.log !== plan.log || seen.summaries !== plan.summaries) return refuse("the journal or its summaries changed");
  const ends = (p: Pair) => (direction === "upgrade" ? { src: p.from, dst: p.to } : { src: p.to, dst: p.from });
  let k = 0;
  while (k < ORDER.length && seen[ORDER[k]!] === ends(plan[ORDER[k]!]).dst) k++;
  for (let j = k; j < ORDER.length; j++) {
    if (seen[ORDER[j]!] !== ends(plan[ORDER[j]!]).src) return refuse(`${ORDER[j]} is neither the recorded source nor target`);
  }
  return { ok: true, step: k === ORDER.length ? "done" : ORDER[k]! };
}

// ---------------------------------------------------------------- pristine rollback (18.2)

const stamps = (w: State2["work"][string]): Array<{ serial: number } | undefined> => [
  w.configEvidence, w.budget.reservations.map((r) => r.configEvidence), w.focusedReview?.configEvidence,
    w.reviews.map((r) => r.configEvidence),
  w.analyses.map((r) => r.configEvidence), w.obligations.map((o) => o.baselineConfigEvidence),
].flat() as Array<{ serial: number } | undefined>;

/**
 * Why the live bytes are not pristine, empty when they are: the lineage issued no identity above the initial floor, so a later re-upgrade
 * reuses nothing. `tail` is the journal text after the applied phase. This is a second guard beside the exact-manifest match.
 */
export function pristineProblems(s: State2, tail: string): string[] {
  const out: string[] = [];
  if (s.recovery.jobSeq !== 0 || s.recovery.jobs.length) out.push("a job was issued");
  if (s.recovery.validity.some((v) => v.serial !== 0)) out.push("a validity floor is above zero");
  if (new Set(s.recovery.validity.map((v) => `${v.key.workspaceId}\0${v.key.work}`)).size !== s.recovery.validity.length) {
    out.push("a validity floor is duplicated");
  }
  if (Object.values(s.work).some((w) => stamps(w).some((st) => st && st.serial > 0))) out.push("a stamp is above serial zero");
  for (const line of tail.split("\n").filter(Boolean)) {
    const e = JSON.parse(line) as { kind?: string; op?: { version?: number }; outcome?: { version?: number } };
    if (e.kind === "launch" || e.op?.version === 2 || e.outcome?.version === 2) out.push("a launch or version-2 effect was journaled");
  }
  return out;
}

// ---------------------------------------------------------------- minimal terminal record (18.3)

/** Exactly five keys: no time, build, path, owner, quote, response or payload. */
export const Terminal = z.strictObject({
  operationId: z.string().regex(/^[0-9a-f]{32}$/), protocolVersion: z.literal(1),
  versions: z.strictObject({ from: z.union([z.literal(1), z.literal(2)]), to: z.union([z.literal(1), z.literal(2)]) }),
  outcome: z.enum(["upgraded", "rolled-back"]), bindingDigest: z.string().regex(/^[0-9a-f]{64}$/),
}).refine((t) => t.versions.from !== t.versions.to && (t.outcome === "upgraded") === (t.versions.to === 2),
  "versions disagree with the outcome");
export type Terminal = z.infer<typeof Terminal>;

/** Replay of a historical fact needs the exact id, protocol, versions and binding; nothing else is accepted. */
export const matchTerminal = (stored: Terminal, asked: Terminal): boolean =>
  stored.operationId === asked.operationId && stored.protocolVersion === asked.protocolVersion
  && stored.versions.from === asked.versions.from && stored.versions.to === asked.versions.to
  && stored.bindingDigest === asked.bindingDigest;

// ---------------------------------------------------------------- the durable descriptor (16.4, 16.5)

const Seen = z.strictObject({ from: Sha.nullable(), to: Sha.nullable() });
const OperationId = z.string().regex(/^[0-9a-f]{32}$/);

/**
 * The old-writer fence and the recovery record. Phase is a lower bound: the recorded before and after hashes decide what is on disk.
 * It holds no evidence and grants no authority; a copied descriptor in an unowned store is inert (16.3).
 */
export const Descriptor = z.strictObject({
  protocolVersion: z.literal(1), direction: z.enum(["upgrade", "rollback"]), id: OperationId, upgradeId: OperationId,
  phase: z.enum(["fenced", "backed-up", "prepared", "applied", "rolled-back"]),
  owner: z.strictObject({ workspaceId: z.string().min(1), nonce: z.string().min(1) }),
  factsHash: Sha, bridge: z.string().min(1), target: z.string().min(1), quote: z.string().max(1000).optional(),
  plan: z.strictObject({ previous: Seen, primary: Seen, marker: Seen, log: Sha.nullable(), summaries: Sha.nullable() }),
  rollbackEligible: z.boolean(), terminal: Terminal.optional(),
});
export type Descriptor = z.infer<typeof Descriptor>;
