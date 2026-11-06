// Dependency verification (SEC-05, TS §9.11): what a resolved lockfile changes, and whether the change meets the policy.
// Pure. The population is the lockfile diff (new or changed direct packages and the transitive ones they add). Missing
// metadata is `unknown`, never verified, and a source that is not a registry is reported, never trusted by its name.

import { z } from "zod";

export type Source = "registry" | "git" | "file" | "link" | "unknown";
export interface Observation {
  key: string; name: string; version: string; previous?: string; direct: boolean; source: Source; resolved: string;
  integrity?: string; license?: string; hasInstallScript: boolean | "unknown";
}
export interface LockDiff { added: Observation[]; changed: Observation[]; removed: string[] }

interface Entry { version?: string; resolved?: string; integrity?: string; license?: string; hasInstallScript?: boolean; link?: boolean }

const PackageEntry = z.object({
  version: z.string().min(1).optional(), resolved: z.string().optional(), integrity: z.string().min(1).optional(),
  license: z.string().optional(), hasInstallScript: z.boolean().optional(), link: z.boolean().optional(),
  dependencies: z.record(z.string(), z.string()).optional(), devDependencies: z.record(z.string(), z.string()).optional(),
  optionalDependencies: z.record(z.string(), z.string()).optional(),
});
const NpmLock = z.object({ lockfileVersion: z.union([z.literal(2), z.literal(3)]), packages: z.record(z.string(), PackageEntry) });

function entries(text: string): Map<string, Entry> & { roots: Set<string> } {
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { throw new Error("the lockfile is not valid JSON"); }
  const parsed = NpmLock.safeParse(raw);
  if (!parsed.success) throw new Error("the lockfile has invalid package metadata or an unsupported lockfileVersion; npm v2 and v3 are supported");
  const j = parsed.data;
  const out = new Map<string, Entry>() as Map<string, Entry> & { roots: Set<string> };
  const root = j.packages[""] ?? {};
  out.roots = new Set([...Object.keys(root.dependencies ?? {}), ...Object.keys(root.devDependencies ?? {}), ...Object.keys(root.optionalDependencies ?? {})]);
  for (const [k, v] of Object.entries(j.packages)) if (k) out.set(k, v);
  return out;
}

/** Policy-relevant metadata can change without a version or URL change. */
const sameEntry = (a: Entry, b: Entry): boolean =>
  a.version === b.version && a.resolved === b.resolved && a.integrity === b.integrity &&
  a.license === b.license && !!a.hasInstallScript === !!b.hasInstallScript && !!a.link === !!b.link;

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
    else if (!sameEntry(had, e)) changed.push(obs(k, e, had.version));
  }
  const gone = new Set<string>();
  for (const k of b.keys()) if (!a.has(k)) gone.add(nameOf(k));
  const remainingNames = new Set([...a.keys()].map(nameOf));
  return { added, changed, removed: [...gone].filter((n) => !remainingNames.has(n)).sort() };
}

// ---------------------------------------------------------------- pnpm (pnpm-lock.yaml): a narrow line scan, never a
// general YAML parse — only the shape pnpm actually emits: quoted or bare `name@version:` keys under `packages:`,
// a one-line flow-mapped `resolution: {...}`, and root dependency names (the line before any `specifier:`).

interface PnpmEntry { name: string; version: string; resolution: Record<string, string> }

/** Split a pnpm package key on the `@` that separates its name from its version or source URL: the first one after
 * an optional leading `@scope/`, not the last, so a version/URL that itself contains `@` (an SSH git remote) does
 * not shift the boundary. */
function splitPnpmKey(key: string): { name: string; version: string } | null {
  const from = key.startsWith("@") ? key.indexOf("/") + 1 : 0;
  if (key.startsWith("@") && from === 0) return null;
  const at = key.indexOf("@", from);
  return at === -1 ? null : { name: key.slice(0, at), version: key.slice(at + 1) };
}

function parsePnpmLock(text: string): { byKey: Map<string, PnpmEntry>; roots: Set<string> } {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const versions = lines.filter(line => /^(?:lockfileVersion|['"]lockfileVersion['"])\s*:/.test(line));
  if (versions.length !== 1 || !/^lockfileVersion: (?:'9\.0'|"9\.0"|9\.0)\s*$/.test(versions[0]!))
    throw new Error("the pnpm lockfileVersion is unsupported; only pnpm v9 lockfiles are supported");
  if (!lines.includes("packages:")) throw new Error("the pnpm lockfile has no packages: section");
  const roots = new Set<string>();
  const keyLine = /^\s+(?:'([^']+)'|([^\s:'].*)):\s*$/;
  for (let i = 0; i < lines.length - 1; i++) {
    const m = keyLine.exec(lines[i]!);
    if (m && /^\s+specifier:/.test(lines[i + 1] ?? "")) roots.add((m[1] ?? m[2])!);
  }
  const byKey = new Map<string, PnpmEntry>();
  let inPackages = false, current: string | null = null;
  for (const line of lines) {
    if (line === "packages:") { inPackages = true; continue; }
    if (inPackages && line !== "" && !line.startsWith(" ")) { inPackages = false; current = null; continue; }
    if (!inPackages) continue;
    const pkg = /^ {2}(?:'([^']+)'|([^\s:'].*)):\s*$/.exec(line);
    if (pkg) {
      const key = (pkg[1] ?? pkg[2])!;
      const split = splitPnpmKey(key);
      if (!split || byKey.has(key)) throw new Error("the pnpm lockfile contains an invalid or duplicate package identity");
      byKey.set(key, { ...split, resolution: {} });
      current = key;
      continue;
    }
    const res = current && /^ {4}resolution: \{(.*)\}\s*$/.exec(line);
    if (res) {
      const fields: Record<string, string> = {};
      for (const part of res[1]!.split(/,\s*(?=[a-zA-Z]+:)/)) {
        const kv = /^([a-zA-Z]+):\s*(.*)$/.exec(part.trim());
        if (kv) fields[kv[1]!] = kv[2]!.trim();
      }
      byKey.get(current!)!.resolution = fields;
    }
  }
  if (!byKey.size) throw new Error("the pnpm lockfile's packages: section has no entries I recognize");
  return { byKey, roots };
}

/** `type: git` is explicit; `tarball`/`integrity` are pnpm's registry and direct-URL markers (SEC-05: never guessed
 * from the version string the way a key alone could be spoofed to look like). */
function pnpmSource(r: Record<string, string>): Source {
  if (r.type === "git" || r.commit) return "git";
  if (r.integrity) return "registry";
  if (r.tarball) return /^https?:\/\//.test(r.tarball) ? "registry" : "file";
  if (r.directory) return "link";
  return "unknown";
}

/** Same shape as `diffLockfile`, for pnpm-lock.yaml. A key embeds its own version (unlike npm's path-keyed lockfile),
 * so an upgrade is two different keys, not one changed entry; a same-name match in the prior lockfile is counted as
 * `changed` only for one absent prior and one new version, never guessed when several versions of one name coexist (pnpm
 * allows that). pnpm's lockfile does not record whether a package has an install script at all (unlike npm's), so
 * that fact is always `"unknown"` here — disclosed, never claimed as false. */
export function diffPnpmLock(before: string | null, after: string): LockDiff {
  const b = before === null ? { byKey: new Map<string, PnpmEntry>(), roots: new Set<string>() } : parsePnpmLock(before);
  const a = parsePnpmLock(after);
  const obs = (e: PnpmEntry, previous?: string): Observation => ({
    key: `${e.name}@${e.version}`, name: e.name, version: e.version, ...(previous ? { previous } : {}),
    direct: a.roots.has(e.name), source: pnpmSource(e.resolution), resolved: e.resolution.tarball ?? e.resolution.repo ?? "",
    ...(e.resolution.integrity ? { integrity: e.resolution.integrity } : {}), hasInstallScript: "unknown",
  });
  const beforeByName = new Map<string, PnpmEntry[]>();
  for (const [key, e] of b.byKey) {
    if (a.byKey.has(key)) continue;
    const versions = beforeByName.get(e.name) ?? [];
    versions.push(e);
    beforeByName.set(e.name, versions);
  }
  const newCounts = new Map<string, number>();
  for (const [key, e] of a.byKey) if (!b.byKey.has(key)) newCounts.set(e.name, (newCounts.get(e.name) ?? 0) + 1);
  const added: Observation[] = [], changed: Observation[] = [];
  for (const [k, e] of a.byKey) {
    const prior = b.byKey.get(k);
    if (prior) {
      const keys = new Set([...Object.keys(prior.resolution), ...Object.keys(e.resolution)]);
      if ([...keys].some(key => prior.resolution[key] !== e.resolution[key])) changed.push(obs(e, prior.version));
      continue;
    }
    const priors = beforeByName.get(e.name) ?? [];
    if (priors.length === 1 && newCounts.get(e.name) === 1) changed.push(obs(e, priors[0]!.version));
    else added.push(obs(e));
  }
  const gone = new Set<string>();
  for (const [k, e] of b.byKey) if (!a.byKey.has(k)) gone.add(e.name);
  const remainingNames = new Set([...a.byKey.values()].map(e => e.name));
  return { added, changed, removed: [...gone].filter(name => !remainingNames.has(name)).sort() };
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
      if (age === undefined || !Number.isFinite(age)) add("unknown-age", sev(o.policy.unknown_age), `${id} has no publish date I can verify`);
      else if (age < o.policy.min_release_age_days) {
        if (o.urgent) add("age", sev(o.policy.urgent_exception), `${id} was published ${age} days ago; your policy needs ${o.policy.min_release_age_days} (urgent exception: ${o.policy.urgent_exception})`);
        else add("age", "blocked", `${id} was published ${age} days ago; your policy needs ${o.policy.min_release_age_days}`);
      }
    }
    if (p.hasInstallScript === true) { scripts.push(id); add("script", "decision", `${id} runs an install script`); }
    else if (p.hasInstallScript === "unknown") add("script", "note", `${id}'s install-script status cannot be verified from this lockfile`);
    if (o.allowedLicenses) {
      if (!p.license) add("license", "decision", `${id} declares no license`);
      else if (!o.allowedLicenses.includes(p.license)) add("license", "blocked", `${id} is ${p.license}, which is not on the allowed list`);
    }
  }
  const verdict = issues.reduce<Judgement["verdict"]>((v, i) => (RANK[BY_SEVERITY[i.severity]] > RANK[v] ? BY_SEVERITY[i.severity] : v), "ok");
  return { verdict, issues, scripts };
}
