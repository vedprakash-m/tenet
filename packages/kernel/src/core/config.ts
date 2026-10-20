// The typed settings catalog and how a setting resolves (PRD §7.3-7.5, TS §8.5). One source for values, scopes and
// composition; pure. Preferences take the most specific source. Restrictions only ever add: every source contributes and
// none removes. A value is validated here and nowhere else; an unknown key is refused, never stored.
import { z } from "zod";
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
export const isSettingKey = (k: string): k is SettingKey => k in CATALOG;

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

export function resolveSetting(key: SettingKey, l: Layers): Resolved {
  const e: Entry = CATALOG[key];
  const howToChange = `tenet decide config --target ${key} --scope ${e.scopes.join("|") || "none"} (reset removes the override)`;
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
  const [a, b] = [from(shared), from(l.local)] as unknown[];
  const limits = base.limits;
  let value: unknown;
  switch (key) {
    case "protected_paths": value = union([a as string[], b as string[]]); break;
    case "exclusions": {
      const m = new Map<string, string[]>();
      for (const x of [...((a as { pattern: string; kinds: string[] }[]) ?? []), ...((b as { pattern: string; kinds: string[] }[]) ?? [])]) m.set(x.pattern, union([m.get(x.pattern), x.kinds]));
      value = [...m].map(([pattern, kinds]) => ({ pattern, kinds }));
      break;
    }
    case "required_checks": {
      const m = new Map<string, { id: string }>();
      for (const c of [...((a as { id: string }[]) ?? []), ...((b as { id: string }[]) ?? [])]) {
        const had = m.get(c.id);
        if (!had) m.set(c.id, c);
        else if (json(had) !== json(c)) limits.push(`"${c.id}" is defined differently in two sources; the first (shared policy before project) applies`);
      }
      value = [...m.values()];
      break;
    }
    case "dependency_policy": {
      const stated = [a, b].filter(Boolean) as Record<string, string | number>[];
      const pick = (f: keyof typeof DEFAULT_DEPENDENCY) => {
        const vals = stated.map((s) => s[f]).filter((v) => v !== undefined);
        if (!vals.length) return DEFAULT_DEPENDENCY[f];
        return f === "min_release_age_days" ? Math.max(...(vals as number[])) : (vals as (keyof typeof STRICT)[]).reduce((x, y) => (STRICT[y] > STRICT[x] ? y : x));
      };
      value = { min_release_age_days: pick("min_release_age_days"), urgent_exception: pick("urgent_exception"), unknown_age: pick("unknown_age") };
      break;
    }
    default: value = { ...((a as object) ?? {}), ...((b as object) ?? {}) }; // commands: per check name, the project's own win
  }
  const sharedUsed = sources.some(([s]) => s === "shared policy");
  return { ...base, value, source: sources.map(([s]) => s).join(" + ") || "default", adoption: sharedUsed ? l.adoption.policy : "n/a", overridden: [], contributions };
}

export const effectiveSettings = (l: Layers): Record<SettingKey, unknown> =>
  Object.fromEntries((Object.keys(CATALOG) as SettingKey[]).map((k) => [k, resolveSetting(k, l).value])) as Record<SettingKey, unknown>;

/** The sources of a setting as the state holds them; `shared` is the policy in force (see `sharedPolicy` in verbs/reconcile). */
export const layersOf = (state: { config: { local: Record<string, unknown> }; project: { adoption: Layers["adoption"] } } | null, work: { settings?: Record<string, unknown> | undefined } | undefined, shared: PolicyFile): Layers => ({
  shared, local: state?.config.local ?? {}, task: work?.settings ?? {}, adoption: state?.project.adoption ?? { intent: "undecided", policy: "undecided" },
});
