import { allowed, type Exclusion } from "../core/exclusions.ts";
import { policyPath } from "../core/policy-path.ts";
import type { Recovery, Unresolved } from "./recover-effects.ts";
import { settingsFor } from "./reconcile.ts";

/** Recovery has no current explicit-read grant. Admit the complete set again at each capability boundary. */
export function admitRecovery(r: Recovery, u: Unresolved, paths: unknown, edit = false): paths is string[] {
  const unavailable = () => {
    r.uncertain.push(`the interrupted ${u.effect} has unproved or prohibited affected paths; it remains unresolved`);
    return false;
  };
  if (!Array.isArray(paths) || !paths.length || paths.some(path => typeof path !== "string")
    || new Set(paths).size !== paths.length) return unavailable();
  try { for (const path of paths) policyPath(path); }
  catch (error) { if (error instanceof TypeError) return unavailable(); throw error; }
  const work = (u.op as { work?: string } | null)?.work;
  const exclusions = settingsFor(r.ports, r.state, work ? r.state.work[work] : undefined).exclusions as Exclusion[];
  if (paths.some(path => !allowed("read", path, exclusions, { kind: "routine-inventory" })
    || (edit && !allowed("edit", path, exclusions)))) return unavailable();
  r.ports.project.setExclusions(exclusions);
  r.ports.git.setExclusions(exclusions);
  return true;
}

export function hasPostconditions(value: unknown, paths: readonly string[]): boolean {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && Object.keys(value).length === paths.length && Object.entries(value).every(([path, expected]) =>
      paths.includes(path) && (expected === null
        || (typeof expected === "string" && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(expected))));
}
