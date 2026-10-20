// Dependency verification (SEC-05, TS §9.11): what a resolved lockfile changes, and whether the change meets the policy.
// Pure. The population is the lockfile diff (new or changed direct packages and the transitive ones they add). Missing
// metadata is `unknown`, never verified, and a source that is not a registry is reported, never trusted by its name.

export type Source = "registry" | "git" | "file" | "link" | "unknown";
export interface Observation {
  key: string; name: string; version: string; previous?: string; direct: boolean; source: Source; resolved: string;
  integrity?: string; license?: string; hasInstallScript: boolean;
}
export interface LockDiff { added: Observation[]; changed: Observation[]; removed: string[] }

interface Entry { version?: string; resolved?: string; integrity?: string; license?: string; hasInstallScript?: boolean; link?: boolean }

function entries(text: string): Map<string, Entry> & { roots: Set<string> } {
  let j: { lockfileVersion?: number; packages?: Record<string, Entry & { dependencies?: object; devDependencies?: object; optionalDependencies?: object }> };
  try { j = JSON.parse(text); } catch { throw new Error("the lockfile is not valid JSON"); }
  if (!j.lockfileVersion || j.lockfileVersion < 2 || !j.packages) throw new Error(`lockfileVersion ${j.lockfileVersion ?? "(none)"} is not supported; npm's v2 and v3 lockfiles are`);
  const out = new Map<string, Entry>() as Map<string, Entry> & { roots: Set<string> };
  const root = j.packages[""] ?? {};
  out.roots = new Set([...Object.keys(root.dependencies ?? {}), ...Object.keys(root.devDependencies ?? {}), ...Object.keys(root.optionalDependencies ?? {})]);
  for (const [k, v] of Object.entries(j.packages)) if (k) out.set(k, v);
  return out;
}

const nameOf = (key: string): string => key.slice(key.lastIndexOf("node_modules/") + "node_modules/".length);

function sourceOf(e: Entry): Source {
  const r = e.resolved ?? "";
  if (e.link) return "link";
  if (/^git\+|^github:|^git:/.test(r)) return "git";
  if (/^file:/.test(r)) return "file";
  return /^https?:\/\//.test(r) ? "registry" : "unknown";
}

export function diffLockfile(before: string | null, after: string): LockDiff {
  const b = before === null ? new Map<string, Entry>() : entries(before);
  const a = entries(after);
  const obs = (key: string, e: Entry, previous?: string): Observation => ({
    key, name: nameOf(key), version: e.version ?? "", ...(previous ? { previous } : {}), direct: !key.slice(0, key.lastIndexOf("node_modules/")).includes("node_modules/") && a.roots.has(nameOf(key)),
    source: sourceOf(e), resolved: e.resolved ?? "", ...(e.integrity ? { integrity: e.integrity } : {}), ...(e.license ? { license: e.license } : {}), hasInstallScript: !!e.hasInstallScript,
  });
  const added: Observation[] = [], changed: Observation[] = [];
  for (const [k, e] of a) {
    const had = b.get(k);
    if (!had) added.push(obs(k, e));
    else if (had.version !== e.version || had.resolved !== e.resolved) changed.push(obs(k, e, had.version));
  }
  const gone = new Set<string>();
  for (const k of b.keys()) if (!a.has(k)) gone.add(nameOf(k));
  return { added, changed, removed: [...gone].filter((n) => ![...a.keys()].some((k) => nameOf(k) === n)).sort() };
}

export type Strictness = "allow" | "require-approval" | "deny";
export interface Policy { min_release_age_days: number; urgent_exception: Strictness; unknown_age: Strictness }
export interface Issue { package: string; kind: "age" | "unknown-age" | "script" | "source" | "license"; severity: "blocked" | "decision" | "note"; message: string }
export interface Judgement { verdict: "ok" | "needs-decision" | "blocked"; issues: Issue[]; scripts: string[] }

const RANK = { ok: 0, "needs-decision": 1, blocked: 2 } as const;
const BY_SEVERITY = { note: "ok", decision: "needs-decision", blocked: "blocked" } as const;
const sev = (s: Strictness): Issue["severity"] => (s === "deny" ? "blocked" : s === "require-approval" ? "decision" : "note");

/** `ages` is the publish age in days of `name@version`; an entry that is missing or undefined is unknown. */
export function judgeDependencies(obs: readonly Observation[], ages: Readonly<Record<string, number | undefined>>, o: { policy: Policy; urgent: boolean; allowedLicenses?: readonly string[] }): Judgement {
  const issues: Issue[] = [];
  const scripts: string[] = [];
  for (const p of obs) {
    const id = `${p.name}@${p.version}`;
    const add = (kind: Issue["kind"], severity: Issue["severity"], message: string) => issues.push({ package: id, kind, severity, message });
    if (p.source !== "registry") add("source", "decision", `${id} comes from a ${p.source} source that cannot be verified`);
    else {
      const age = ages[id];
      if (age === undefined) add("unknown-age", sev(o.policy.unknown_age), `${id} has no publish date I can verify`);
      else if (age < o.policy.min_release_age_days) {
        if (o.urgent) add("age", sev(o.policy.urgent_exception), `${id} was published ${age} days ago; your policy needs ${o.policy.min_release_age_days} (urgent exception: ${o.policy.urgent_exception})`);
        else add("age", "blocked", `${id} was published ${age} days ago; your policy needs ${o.policy.min_release_age_days}`);
      }
    }
    if (p.hasInstallScript) { scripts.push(id); add("script", "decision", `${id} runs an install script`); }
    if (o.allowedLicenses) {
      if (!p.license) add("license", "decision", `${id} declares no license`);
      else if (!o.allowedLicenses.includes(p.license)) add("license", "blocked", `${id} is ${p.license}, which is not on the allowed list`);
    }
  }
  const verdict = issues.reduce<Judgement["verdict"]>((v, i) => (RANK[BY_SEVERITY[i.severity]] > RANK[v] ? BY_SEVERITY[i.severity] : v), "ok");
  return { verdict, issues, scripts };
}
