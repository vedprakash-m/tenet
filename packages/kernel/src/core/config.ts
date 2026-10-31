// The typed settings catalog and how a setting resolves (PRD §7.3-7.5, TS §8.5). One source for values, scopes and
// composition; pure. Preferences take the most specific source. Restrictions only ever add: every source contributes and
// none removes. A value is validated here and nowhere else; an unknown key is refused, never stored.
import { z } from "zod";
import { isStaticCheck } from "./obligations.ts";
import { Policy } from "./policy.ts";
import type { Policy as PolicyFile } from "./policy.ts";

export type Scope = "task" | "project";
export type AdoptionState = "undecided" | "adopted" | "declined";
export type Source = "default" | "shared policy" | "project" | "task" | "adoption";

const P = Policy.shape;
const STRICT = { allow: 0, "require-approval": 1, deny: 2 } as const;
const DEFAULT_DEPENDENCY = { min_release_age_days: 0, urgent_exception: "allow", unknown_age: "require-approval" } as const;

interface Entry { kind: "preference" | "commitment" | "executable" | "restriction"; scopes: readonly Scope[]; default: unknown; schema: z.ZodType }
export const CATALOG = {
  style: { kind: "preference", scopes: ["task", "project"], default: "balanced", schema: z.enum(["guided", "balanced", "concise"]) },
  checkpoints: { kind: "preference", scopes: ["task", "project"], default: "milestones", schema: z.enum(["minimal", "milestones", "each-phase"]) },
  lane: { kind: "preference", scopes: ["task", "project"], default: "auto", schema: z.enum(["auto", "quick", "standard", "deep"]) },
  resource_mode: { kind: "preference", scopes: ["task", "project"], default: "normal", schema: z.enum(["normal", "conserve", "serial"]) },
  shared_memory: { kind: "preference", scopes: [], default: "undecided", schema: z.enum(["undecided", "adopted", "declined"]) },
  branching: { kind: "preference", scopes: ["task", "project"], default: "per-work", schema: z.enum(["per-work", "current"]) },
  integration: { kind: "preference", scopes: ["project"], default: "offer", schema: z.enum(["offer", "auto-on-accept", "never"]) },
  commands: { kind: "executable", scopes: ["project"], default: {}, schema: P.commands.unwrap() },
  required_checks: { kind: "commitment", scopes: ["project"], default: [], schema: P.required_checks.unwrap() },
  protected_paths: { kind: "commitment", scopes: ["project"], default: [], schema: P.protected_paths.unwrap() },
  exclusions: { kind: "restriction", scopes: ["project"], default: [], schema: P.exclusions.unwrap() },
  dependency_policy: { kind: "commitment", scopes: ["project"], default: DEFAULT_DEPENDENCY, schema: P.dependency_policy.unwrap() },
} as const satisfies Record<string, Entry>;
export type SettingKey = keyof typeof CATALOG;
export const isSettingKey = (k: string): k is SettingKey => Object.hasOwn(CATALOG, k);

/** Stored preferences/restrictions obey the same catalog and scope rules as incoming decisions. */
export const settingsSchema = (scope: Scope) => z.strictObject(Object.fromEntries(
  (Object.entries(CATALOG) as [SettingKey, Entry][]).filter(([, e]) => e.scopes.includes(scope)).map(([key, e]) => [key, e.schema.optional()]),
));

export interface Layers { shared: PolicyFile; local: Record<string, unknown>; task: Record<string, unknown>; adoption: { intent: AdoptionState; policy: AdoptionState } }
export interface Resolved {
  key: SettingKey; value: unknown; source: string; adoption: AdoptionState | "n/a";
  overridden: { source: Source; value: unknown }[]; contributions?: { source: Source; value: unknown }[]; limits: string[]; howToChange: string;
}

export function validateSetting(key: SettingKey, value: unknown, scope: Scope): { ok: true; value: unknown } | { ok: false; message: string } {
  const e: Entry = CATALOG[key];
  if (key === "shared_memory") return { ok: false, message: "shared_memory is the answer to the offer to save the project's files; answer it with decide adopt" };
  if (!e.scopes.includes(scope)) return { ok: false, message: `${key} cannot be set for ${scope}; it can be set for: ${e.scopes.join(", ")}` };
  const r = e.schema.safeParse(value);
  if (r.success) return { ok: true, value: r.data };
  const options = e.schema instanceof z.ZodEnum ? ` must be ${e.schema.options.join(", ")}` : `: ${r.error.issues[0]!.message}`;
  return { ok: false, message: `${key}${options}` };
}

const union = <T>(lists: readonly (readonly T[] | undefined)[]): T[] => [...new Set(lists.flatMap((l) => l ?? []))];
const json = (v: unknown) => JSON.stringify(v);

type Merged = { value: unknown; limits: string[] };

const mergeExclusions = (a: unknown, b: unknown): unknown => {
  const m = new Map<string, string[]>();
  for (const x of [...((a as { pattern: string; kinds: string[] }[]) ?? []), ...((b as { pattern: string; kinds: string[] }[]) ?? [])]) {
    m.set(x.pattern, union([m.get(x.pattern), x.kinds]));
  }
  return [...m].map(([pattern, kinds]) => ({ pattern, kinds }));
};

/** Checks compose by id; a second, different definition of an id is kept out and blocks checking until reconciled. */
const mergeChecks = (a: unknown, b: unknown): Merged => {
  const m = new Map<string, { id: string }>(), limits: string[] = [];
  for (const c of [...((a as { id: string }[]) ?? []), ...((b as { id: string }[]) ?? [])]) {
    const had = m.get(c.id);
    if (!had) m.set(c.id, c);
    else if (json(had) !== json(c)) limits.push(`"${c.id}" is defined differently; checking and checked-local are blocked until reconciled`);
  }
  return { value: [...m.values()], limits };
};

/** Each dependency field takes the strictest stated value: the longest age, the strictest rule. */
const mergeDependency = (a: unknown, b: unknown): unknown => {
  const stated = [a, b].filter(Boolean) as Record<string, string | number>[];
  const pick = (f: keyof typeof DEFAULT_DEPENDENCY) => {
    const vals = stated.map((s) => s[f]).filter((v) => v !== undefined);
    if (!vals.length) return DEFAULT_DEPENDENCY[f];
    return f === "min_release_age_days" ? Math.max(...(vals as number[])) : (vals as (keyof typeof STRICT)[]).reduce((x, y) => (STRICT[y] > STRICT[x] ? y : x));
  };
  return { min_release_age_days: pick("min_release_age_days"), urgent_exception: pick("urgent_exception"), unknown_age: pick("unknown_age") };
};

/** A shared and a project value combine by the setting's own rule: stricter wins, never the looser. */
function mergeLayers(key: SettingKey, a: unknown, b: unknown): Merged {
  switch (key) {
    case "protected_paths": return { value: union([a as string[], b as string[]]), limits: [] };
    case "exclusions": return { value: mergeExclusions(a, b), limits: [] };
    case "required_checks": return mergeChecks(a, b);
    case "dependency_policy": return { value: mergeDependency(a, b), limits: [] };
    default: return { value: { ...((a as object) ?? {}), ...((b as object) ?? {}) }, limits: [] }; // commands: per check name, the project's own win
  }
}

export function resolveSetting(key: SettingKey, l: Layers): Resolved {
  const e: Entry = CATALOG[key];
  const howToChange = key === "shared_memory" ? "tenet decide adopt --h <handle> --target intent (preview, then answer adopt-confirm)" : `tenet decide config --h <handle> --target ${key} with JSON stdin {"propose":{"value":<value>,"scope":"${e.scopes[0]}"}}; {"propose":{"reset":true,"scope":"${e.scopes[0]}"}} removes the override`;
  const base = { key, limits: [] as string[], howToChange };
  if (key === "shared_memory") return { ...base, value: l.adoption.intent, source: "adoption", adoption: l.adoption.intent, overridden: [] };

  if (e.kind === "preference") {
    const stated: { source: Source; value: unknown }[] = [
      ...(key in l.task ? [{ source: "task" as const, value: l.task[key] }] : []),
      ...(key in l.local ? [{ source: "project" as const, value: l.local[key] }] : []),
      { source: "default", value: e.default },
    ];
    return { ...base, value: stated[0]!.value, source: stated[0]!.source, adoption: "n/a", overridden: stated.slice(1) };
  }

  const shared = l.shared as Record<string, unknown>;
  const from = (src: Record<string, unknown>) => src[key] as never;
  const sources = ([["shared policy", from(shared)], ["project", from(l.local)]] as [Source, unknown][]).filter(([, v]) => v !== undefined);
  const contributions = sources.map(([source, value]) => ({ source, value }));
  const { value, limits } = mergeLayers(key, from(shared), from(l.local));
  const sharedUsed = sources.some(([s]) => s === "shared policy");
  if (declaredButNotRun(key, value)) limits.push(STORED_ONLY);
  return { ...base, value, limits, source: sources.map(([s]) => s).join(" + ") || "default", adoption: sharedUsed ? l.adoption.policy : "n/a", overridden: [], contributions };
}

const STORED_ONLY = "Stored declaration only: configured execution is unavailable; checks and checked-local are blocked until it is implemented or the declaration is removed.";

/** Commands, and required checks other than the static ones the kernel runs, are stored but have no execution consumer yet. */
const declaredButNotRun = (key: string, value: unknown): boolean => {
  if (key === "commands") return Object.keys(value as object).length > 0;
  return key === "required_checks" && (value as { id: string; tool?: string }[]).some((c) => !isStaticCheck(c));
};

/** Conflicts and unavailable consumers block admission and verdicts through the same resolved layers. */
export function unavailableExecution(l: Layers): string[] {
  const checks = resolveSetting("required_checks", l);
  const commands = resolveSetting("commands", l).value as object;
  return [
    ...checks.limits.filter(limit => limit !== STORED_ONLY),
    ...Object.keys(commands).map(id => `configured command ${id}`),
    ...(checks.value as { id: string; tool?: string }[]).filter(c => !isStaticCheck(c)).map(c => `required check ${c.id}`),
  ];
}

export const effectiveSettings = (l: Layers): Record<SettingKey, unknown> =>
  Object.fromEntries((Object.keys(CATALOG) as SettingKey[]).map((k) => [k, resolveSetting(k, l).value])) as Record<SettingKey, unknown>;

/** The sources of a setting as the state holds them; `shared` is the policy in force (see `sharedPolicy` in verbs/reconcile). */
export const layersOf = (state: { config: { local: Record<string, unknown> }; project: { adoption: Layers["adoption"] } } | null, work: { settings?: Record<string, unknown> | undefined } | undefined, shared: PolicyFile): Layers => ({
  shared, local: state?.config.local ?? {}, task: work?.settings ?? {}, adoption: state?.project.adoption ?? { intent: "undecided", policy: "undecided" },
});
