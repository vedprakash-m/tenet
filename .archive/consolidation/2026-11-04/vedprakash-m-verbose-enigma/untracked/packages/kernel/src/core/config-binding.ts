// Configuration evidence binding (config-completion 16.2 and 16.3). Pure. A work's binding is the hash of everything configuration
// decides about
// its evidence plus a serial that moves once per durably admitted change, so a return to an earlier configuration (A -> B -> A) is a new
// binding
// and never revives evidence issued under the first A.
import { canonicalRequiredCheck, comparePolicy, Policy } from "./policy.ts";
import { hashOf, stableStringify } from "./ids.ts";
import { resolveSetting, unavailableExecution } from "./config.ts";
import type { Layers, SettingKey } from "./config.ts";
import type { ConfigStamp, Lane, Obligation } from "./schemas.ts";

export const MAX_SERIAL = Number.MAX_SAFE_INTEGER;
/**
 * The settings that decide evidence. Presentation and scheduling preferences (style, checkpoints, resource_mode, lane request) are not
 * here.
 */
const RELEVANT: SettingKey[] = ["commands", "required_checks", "exclusions", "protected_paths", "dependency_policy"];

export interface BoundWork {
  lane: Lane; floor: Lane; protectedPaths: readonly string[]; recipeChecks: readonly string[]; obligations: readonly Obligation[];
}

const uniq = (v: readonly string[] | undefined): string[] | null => (v === undefined ? null : [...new Set(v)].sort());

function canonicalValue(key: SettingKey, value: unknown): unknown {
  if (key === "protected_paths") return uniq(value as string[]);
  if (key === "exclusions") {
    const groups = new Map<string, Set<string>>();
    for (const { pattern, kinds } of value as { pattern: string; kinds: string[] }[]) {
      const set = groups.get(pattern) ?? new Set<string>();
      for (const kind of kinds) set.add(kind);
      groups.set(pattern, set);
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b))
      .map(([pattern, kinds]) => ({ pattern, kinds: [...kinds].sort() }));
  }
  if (key === "required_checks") {
    return (value as NonNullable<Policy["required_checks"]>)
      .map(canonicalRequiredCheck)
      .sort((a, b) => a.id.localeCompare(b.id) || stableStringify(a).localeCompare(stableStringify(b)));
  }
  return value;
}
export const canonicalConfigValue = (key: SettingKey, value: unknown): unknown => canonicalValue(key, value);

const POLICY_KEYS = new Set<SettingKey>(["commands", "required_checks", "exclusions", "protected_paths", "dependency_policy"]);

/** Whether a candidate setting replaces its stored value, retaining absent-vs-explicit source identity. */
export function configValueEqual(key: SettingKey, previous: unknown, next: unknown): boolean {
  if ((previous === undefined) !== (next === undefined)) return false;
  if (previous === undefined) return true;
  const before = canonicalValue(key, previous);
  const after = canonicalValue(key, next);
  if (POLICY_KEYS.has(key) && comparePolicy(
    Policy.parse({ [key]: before }),
    Policy.parse({ [key]: after }),
  ).length) return false;
  return stableStringify(before) === stableStringify(after);
}

/** Every admitted definition field, absence explicit; proof bookkeeping (state, baseline fields) is excluded. */
export const definitionOf = (o: Obligation) => ({
  id: o.id, kind: o.kind, category: o.category, targeted: o.targeted ?? null, tool: o.tool ?? null, example: o.example ?? null,
    testFile: o.testFile ?? null,
  support: uniq(o.support), outputs: uniq(o.outputs), test: o.test ?? null, expectation: o.expectation ?? null,
    alongsideReason: o.alongsideReason ?? null,
});

/** Contributions keep their source label, so a masked source-only change still changes the projection; no source revision is invented. */
export function configProjection(layers: Layers, w: BoundWork) {
  const settings = Object.fromEntries(RELEVANT.map((key) => {
    const r = resolveSetting(key, layers);
    return [key, { value: normalize(key, r.value), contributions: (r.contributions ?? []).map((c) => ({ source: c.source,
      value: normalize(key, c.value) })), limits: r.limits }];
  }));
  return {
    version: 1 as const, settings, unavailable: [...unavailableExecution(layers)].sort(), lane: w.lane, floor: w.floor,
    protected: uniq(w.protectedPaths), recipeChecks: uniq(w.recipeChecks), obligations: w.obligations.map(definitionOf).sort((a,
      b) => a.id.localeCompare(b.id)),
  };
}

/** Designated sets compare as sets; argv and every other value keep their order. */
function normalize(key: SettingKey, value: unknown): unknown {
  return canonicalValue(key, value);
}

export const configHash = (layers: Layers, w: BoundWork): string => hashOf(configProjection(layers, w));

/** The unchanged projection keeps its stamp; a changed one gets a serial above the work's own and any recovered floor. */
export function advance(prev: ConfigStamp | undefined, hash: string, floor = -1): ConfigStamp {
  if (!Number.isSafeInteger(floor) || floor < -1) throw new Error("the recovered floor is invalid");
  if (prev?.hash === hash && prev.serial >= floor) return prev;
  const serial = Math.max(prev?.serial ?? -1, floor) + 1;
  if (serial > MAX_SERIAL) throw new Error("the configuration serial space is exhausted");
  return { hash, serial };
}

/**
 * One pass over every held work, in the same publication as the change that caused it. A work without a projection is refused, never
 * skipped.
 */
export function refreshWorks<T extends { configEvidence: ConfigStamp }>(
  works: Record<string, T>, hashes: Record<string, string>, floors: Record<string, number>,
): Record<string, T> {
  return Object.fromEntries(Object.entries(works).map(([id, w]) => {
    const hash = hashes[id];
    if (hash === undefined) throw new Error(`no configuration projection for ${id}`);
    const next = advance(w.configEvidence, hash, floors[id] ?? -1);
    return [id, next === w.configEvidence ? w : { ...w, configEvidence: next }];
  }));
}
