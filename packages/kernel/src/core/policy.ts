// tenet.policy.json (TS §8.5, PRD §7.3-7.4): strict parsing and the structural trust comparison. Pure.
// A pulled change that only tightens applies at once; anything that loosens, or that cannot be compared structurally,
// waits for the user. There is no implication solver: a changed glob is a different path.
import { z } from "zod";
import { stableStringify } from "./ids.ts";

const Kind = z.enum(["no-model-send", "no-read", "no-edit", "no-export", "no-routine-scan"]);
type Kind = z.infer<typeof Kind>;
const Strictness = z.enum(["allow", "require-approval", "deny"]);
export const Policy = z.strictObject({
  $schema: z.string().optional(),
  protected_paths: z.array(z.string()).optional(),
  exclusions: z.array(z.strictObject({ pattern: z.string(), kinds: z.array(Kind).min(1) })).optional(),
  required_checks: z.array(z.strictObject({
    id: z.string(), property: z.string(), population: z.string().optional(), configuration: z.string().optional(),
    tool: z.string().optional(), pass: z.string().optional(), alternatives: z.array(z.string()).optional(),
  })).optional(),
  dependency_policy: z.strictObject({ min_release_age_days: z.number().int().min(0).optional(), urgent_exception: Strictness.optional(), unknown_age: Strictness.optional() }).optional(),
  commands: z.record(z.string(), z.strictObject({ argv: z.array(z.string()).min(1), cwd: z.string().optional(), env: z.record(z.string(), z.string()).optional(), obligation: z.string().optional() })).optional(),
});
export type Policy = z.infer<typeof Policy>;

export type PolicyParse = { ok: true; policy: Policy } | { ok: false; key?: string; nearest?: string; message: string };

const KEYS = Object.keys(Policy.shape);
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cur = row[j]!;
      row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
  }
  return row[b.length]!;
}

/** Restriction-bearing: an unknown or malformed key blocks dependent work and the message names the nearest valid key (CFG-11). */
export function parsePolicy(json: unknown): PolicyParse {
  const r = Policy.safeParse(json);
  if (r.success) return { ok: true, policy: r.data };
  const issue = r.error.issues[0]!;
  if (issue.code === "unrecognized_keys" && issue.path.length === 0) {
    const key = issue.keys[0]!;
    const nearest = [...KEYS].sort((a, b) => distance(key, a) - distance(key, b))[0]!;
    return { ok: false, key, nearest, message: `"${key}" is not a policy key; did you mean "${nearest}"?` };
  }
  const where = [...issue.path, ...(issue.code === "unrecognized_keys" ? [issue.keys[0]!] : [])].join(".");
  return { ok: false, key: String(issue.path[0] ?? where), message: `${where}: ${issue.message}` };
}

export interface Change { field: string; kind: "tightened" | "loosened" | "changed"; detail: string }

const RANK = { allow: 0, "require-approval": 1, deny: 2 } as const;
const DEFAULT_DEPENDENCY = { min_release_age_days: 0, urgent_exception: "allow", unknown_age: "require-approval" } as const;

/** What a pulled policy changes, one entry per structurally comparable difference. */
export function comparePolicy(prev: Policy, next: Policy): Change[] {
  const out: Change[] = [];
  const add = (field: string, kind: Change["kind"], detail: string) => out.push({ field, kind, detail });

  const pp = new Set(prev.protected_paths ?? []), np = new Set(next.protected_paths ?? []);
  for (const p of np) if (!pp.has(p)) add("protected_paths", "tightened", `adds ${p}`);
  for (const p of pp) if (!np.has(p)) add("protected_paths", "loosened", `drops ${p}`);

  const pe = new Map((prev.exclusions ?? []).map((e) => [e.pattern, new Set<string>(e.kinds)]));
  const ne = new Map((next.exclusions ?? []).map((e) => [e.pattern, new Set<string>(e.kinds)]));
  for (const [pattern, kinds] of ne) {
    const had = pe.get(pattern);
    if (!had || [...kinds].some((k) => !had.has(k))) add("exclusions", "tightened", `${pattern}: adds ${[...kinds].filter((k) => !had?.has(k)).join(", ")}`);
  }
  for (const [pattern, kinds] of pe) {
    const has = ne.get(pattern);
    const lost = [...kinds].filter((k) => !has?.has(k));
    if (lost.length) add("exclusions", "loosened", `${pattern}: drops ${lost.join(", ")}`);
  }

  const pc = new Map((prev.required_checks ?? []).map((c) => [c.id, c])), nc = new Map((next.required_checks ?? []).map((c) => [c.id, c]));
  for (const [id, c] of nc) {
    if (!pc.has(id)) add("required_checks", "tightened", `adds ${id}`);
    else if (stableStringify(c) !== stableStringify(pc.get(id))) add("required_checks", "changed", `${id} is defined differently`);
  }
  for (const id of pc.keys()) if (!nc.has(id)) add("required_checks", "loosened", `drops ${id}`);

  const pd = { ...DEFAULT_DEPENDENCY, ...prev.dependency_policy }, nd = { ...DEFAULT_DEPENDENCY, ...next.dependency_policy };
  if (nd.min_release_age_days !== pd.min_release_age_days) add("dependency_policy.min_release_age_days", nd.min_release_age_days > pd.min_release_age_days ? "tightened" : "loosened", `${pd.min_release_age_days} to ${nd.min_release_age_days} days`);
  for (const f of ["urgent_exception", "unknown_age"] as const) {
    if (nd[f] !== pd[f]) add(`dependency_policy.${f}`, RANK[nd[f]] > RANK[pd[f]] ? "tightened" : "loosened", `${pd[f]} to ${nd[f]}`);
  }

  if (stableStringify(prev.commands ?? null) !== stableStringify(next.commands ?? null)) add("commands", "changed", "commands differ; a command needs its envelope consent before its first run");
  return out;
}

export interface Applied { policy: Policy; applied: Change[]; pending: Change[] }

/**
 * The policy in force after pulling `next`. Tightening applies at once; what loosens or changes keeps its previous value
 * until the user accepts the diff (`accepted`). Lists merge: the old entries stay and the new ones apply.
 */
export function effectivePolicy(prev: Policy, next: Policy, accepted: boolean): Applied {
  const changes = comparePolicy(prev, next);
  if (accepted) return { policy: next, applied: changes, pending: [] };
  const applied = changes.filter((c) => c.kind === "tightened"), pending = changes.filter((c) => c.kind !== "tightened");
  const pickDep = (f: "min_release_age_days" | "urgent_exception" | "unknown_age") => (applied.some((c) => c.field === `dependency_policy.${f}`) ? next.dependency_policy?.[f] : prev.dependency_policy?.[f]);
  const policy: Policy = { ...(next.$schema ? { $schema: next.$schema } : prev.$schema ? { $schema: prev.$schema } : {}) };
  const paths = [...new Set([...(prev.protected_paths ?? []), ...(next.protected_paths ?? [])])];
  if (paths.length || prev.protected_paths || next.protected_paths) policy.protected_paths = paths;
  const ex = new Map<string, Set<string>>();
  for (const e of [...(prev.exclusions ?? []), ...(next.exclusions ?? [])]) ex.set(e.pattern, new Set([...(ex.get(e.pattern) ?? []), ...e.kinds]));
  if (ex.size || prev.exclusions || next.exclusions) policy.exclusions = [...ex].map(([pattern, kinds]) => ({ pattern, kinds: [...kinds] as Kind[] }));
  const checks = new Map((prev.required_checks ?? []).map((c) => [c.id, c]));
  for (const c of next.required_checks ?? []) if (!checks.has(c.id)) checks.set(c.id, c);
  if (checks.size || prev.required_checks || next.required_checks) policy.required_checks = [...checks.values()];
  if (prev.dependency_policy || next.dependency_policy) {
    const dep = { min_release_age_days: pickDep("min_release_age_days"), urgent_exception: pickDep("urgent_exception"), unknown_age: pickDep("unknown_age") };
    policy.dependency_policy = Object.fromEntries(Object.entries(dep).filter(([, v]) => v !== undefined));
  }
  if (prev.commands) policy.commands = prev.commands;
  return { policy, applied, pending };
}
