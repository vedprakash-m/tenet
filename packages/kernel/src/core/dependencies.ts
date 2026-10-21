// Dependency verification (SEC-05, TS §9.11): what a resolved lockfile changes, and whether the change meets the policy.
// Pure. The population is the lockfile diff (new or changed direct packages and the transitive ones they add). Missing
// metadata is `unknown`, never verified, and a source that is not a registry is reported, never trusted by its name.

export type Source = "registry" | "git" | "file" | "link" | "unknown";
export interface Observation {
  key: string; name: string; version: string; previous?: string; direct: boolean; source: Source; resolved: string;
  integrity?: string; license?: string; hasInstallScript: boolean | "unknown";
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
  const lines = text.split("\n");
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
      current = split && byKey.set(key, { ...split, resolution: {} }) ? key : null;
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
 * `changed` only when it is the single candidate, never guessed when several versions of one name coexist (pnpm
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
  for (const e of b.byKey.values()) beforeByName.set(e.name, [...(beforeByName.get(e.name) ?? []), e]);
  const consumed = new Set<string>();
  const added: Observation[] = [], changed: Observation[] = [];
  for (const [k, e] of a.byKey) {
    if (b.byKey.has(k)) { consumed.add(k); continue; } // the identical key exists on both sides: unchanged
    const priors = (beforeByName.get(e.name) ?? []).filter((p) => !consumed.has(`${p.name}@${p.version}`));
    if (priors.length === 1) { changed.push(obs(e, priors[0]!.version)); consumed.add(`${priors[0]!.name}@${priors[0]!.version}`); }
    else added.push(obs(e));
  }
  const gone = new Set<string>();
  for (const [k, e] of b.byKey) if (!consumed.has(k) && !a.byKey.has(k)) gone.add(e.name);
  return { added, changed, removed: [...gone].sort() };
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
