// Risk, lane floors and the assistance level (TS §8.2; PRD Sections 5.2, 2.3). Pure functions only.
import type { Lane, Level, Profile } from "./schemas.ts";

export const DIMENSIONS = ["sensitive-data", "access", "external-effects", "reversibility", "compatibility", "uncertainty"] as const;
export type Dimension = (typeof DIMENSIONS)[number];
export type Assessment = Partial<Record<Dimension, "low" | "high">>;

/** Deterministic signals about the change raise dimensions; they never lower them (PRD Section 5.2). */
const SIGNAL_RAISES: Array<[RegExp, Dimension[]]> = [
  [/(^|\/)(auth|session|sessions|permissions?|login)(\/|\.|$)/i, ["access"]],
  [/(^|\/)(migrations?|schema|ddl)(\/|\.|$)|\.sql$/i, ["reversibility", "compatibility"]],
  [/(^|\/)(package\.json|package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/, ["compatibility"]],
];
const TRAIT_RAISES: Record<string, Dimension[]> = { "external-effects": ["external-effects"], "personal-data": ["sensitive-data"] };

export function raise(assessment: Assessment, paths: readonly string[], traits: readonly string[], protectedHit: boolean): Assessment {
  const out: Assessment = { ...assessment };
  const set = (ds: Dimension[]) => ds.forEach((d) => (out[d] = "high"));
  for (const p of paths) for (const [re, ds] of SIGNAL_RAISES) if (re.test(p)) set(ds);
  for (const t of traits) set(TRAIT_RAISES[t] ?? []);
  if (protectedHit) set(["compatibility"]);
  return out;
}

const RANK: Record<Lane, number> = { quick: 0, standard: 1, deep: 2 };
export const maxLane = (a: Lane, b: Lane): Lane => (RANK[a] >= RANK[b] ? a : b);

/** One High dimension sets the floor to Standard; two or more, or an irreversible effect, set it to Deep. */
export function laneFloor(assessment: Assessment, irreversible = false): Lane {
  const high = DIMENSIONS.filter((d) => assessment[d] === "high");
  if (high.length >= 2 || irreversible) return "deep";
  return high.length === 1 ? "standard" : "quick";
}

/** The user may raise freely and lower only to the floor (WRK-04). */
export function chooseLane(requested: Lane | undefined, floor: Lane, recommended: Lane): { lane: Lane; clamped: boolean } {
  if (!requested) return { lane: maxLane(floor, recommended), clamped: false };
  const lane = maxLane(requested, floor);
  return { lane, clamped: lane !== requested };
}

export interface Readiness {
  nodeOk: boolean; platformOk: boolean; stateWritable: boolean; policyBlocks: boolean;
  gitState: "ok" | "none" | "readonly"; // readonly: rebase/merge/detached/conflicts
  language: "ts-js" | "other";
  runnerSupported: boolean; // a qualified runner (Vitest) was detected at a supported version
  typescript: boolean; depsInstalled: boolean;
  experimental: boolean; // JavaScript-only, monorepo or another experimental tuple dimension
}

/** The assistance level is one pure function of readiness probes; the lowest matching row wins (TS §8.2). */
export function assistanceLevel(r: Readiness, profile: Profile): { level: Level; why?: string } {
  if (r.policyBlocks) return { level: "L0", why: "a required host capability is blocked by policy" };
  const editing = !["plan", "investigate"].includes(profile);
  if (editing && !r.stateWritable) return { level: "L0", why: "Tenet cannot write its local records here" };
  if (editing && !r.platformOk) return { level: "L0", why: "mutating work needs a supported platform" };
  if (r.language === "other") return { level: "L1", why: "this stack is outside the TypeScript and JavaScript profile" };
  if (profile === "plan") return { level: "L2", why: "planning only, as asked" };
  if (!r.depsInstalled) return { level: "L2", why: "dependencies are not installed" };
  if (!r.runnerSupported || r.experimental || !r.typescript) {
    return { level: "L3", why: !r.runnerSupported ? "no supported test runner was found" : r.experimental ? "this setup is experimental" : "this is not a TypeScript project" };
  }
  return { level: "L4" };
}

export const ceiling = (level: Level): "blocked" | "findings-only" | "implemented-unverified" | "checked-local" =>
  level === "L0" ? "blocked" : level === "L1" || level === "L2" ? "findings-only" : level === "L3" ? "implemented-unverified" : "checked-local";

/** Profiles that never edit source never take source ownership (TS §6.3). */
export const isEditingProfile = (p: Profile): boolean => !["plan", "investigate"].includes(p);
