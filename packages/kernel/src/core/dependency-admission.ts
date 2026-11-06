// Which dependency changes the private resolver can take (SEC-05, TS §9.11), and the text of the preview. Pure: callers
// pass file presence (stat only, so a root .npmrc is never read) and the captured manifest and lock bytes.
import { z } from "zod";
import { KernelError } from "./errors.ts";
import { diffLockfile, diffPnpmLock } from "./dependencies.ts";
import type { Judgement, LockDiff, Observation } from "./dependencies.ts";

export const MANIFEST = "package.json";
export const LOCK_FILES = { npm: "package-lock.json", pnpm: "pnpm-lock.yaml" } as const;
export type Manager = keyof typeof LOCK_FILES;
export const lockFileOf = (manager: Manager): string => LOCK_FILES[manager];
type Present = (path: string) => boolean;

const SPEC_RE = /^@?[a-z0-9][a-z0-9._~-]*(\/[a-z0-9._~-]+)?(@[A-Za-z0-9.^~<>=*|-]+)?$/i;
const LOCAL_SPEC = /^(?:file|link|workspace):/i;
const DependencyBody = z.object({
  specs: z.array(z.string().regex(SPEC_RE, "not a registry package spec")).min(1).max(10),
  urgent: z.boolean().default(false),
});

export type Files = { manifest: string | null; lock: string | null };
/** The effect intent a dependency job records before it runs, read again by recovery. */
export interface DependencyOp {
  work: string;
  phase: "resolve" | "install";
  manager: Manager;
  before?: Files;
  scripts?: string[];
}
/** The two files a dependency change owns, keyed by path, as a comparable map of hashes or contents. */
export const named = (manager: Manager, f: Files): Record<string, string | null> =>
  ({ [MANIFEST]: f.manifest, [LOCK_FILES[manager]]: f.lock });
export const same = (a: Record<string, string | null>, b: Record<string, string | null>) =>
  Object.keys(b).every((k) => a[k] === b[k]);

export const DIFF_OF: Record<Manager, (before: string | null, after: string) => LockDiff> = { npm: diffLockfile, pnpm: diffPnpmLock };
export const CI_ARGV: Record<Manager, string[]> = {
  npm: ["npm", "ci", "--ignore-scripts", "--no-audit"],
  pnpm: ["pnpm", "install", "--frozen-lockfile", "--ignore-scripts"],
};
export const nameOf = (id: string) => id.slice(0, id.lastIndexOf("@"));
export const lastLines = (r: { stderr: string; stdout: string }, n: number) =>
  (r.stderr || r.stdout).trim().split("\n").slice(-n).join("\n");

/** Whole days since `npm view <id> time --json` says this version was published; unknown when it cannot be read. */
export function ageInDays(stdout: string, version: string, now: number): number | undefined {
  try {
    const t = (JSON.parse(stdout) as Record<string, string>)[version];
    return t ? Math.floor((now - Date.parse(t)) / 864e5) : undefined;
  } catch {
    return undefined;
  }
}

/** What the resolver job returns to its finalizer. */
export interface Resolution {
  failed?: string;
  error?: string;
  diff?: LockDiff;
  ages?: Record<string, number | undefined>;
  after?: { manifest: string; lock: string };
}

/** The user's own words and a valid list of registry specs, or the reason the request cannot start. */
export function parseRequest(quote: string | undefined, propose: unknown): { specs: string[]; urgent: boolean } {
  if (!quote?.trim()) {
    const why = "a dependency change records the user's own words: pass them as the quote";
    throw new KernelError("authority-needed", why, { exit: 2 });
  }
  const body = DependencyBody.safeParse(propose);
  if (body.success) return body.data;
  const why = `dependency: ${body.error.issues[0]!.message}; only registry package names with an optional version are accepted`;
  throw new KernelError("restriction-key-unknown", why, { exit: 2 });
}

/** The install scripts the user named; each must have been named by the preview. */
export function approvedScripts(answer: string | undefined, named: readonly string[]): string[] {
  const approved = (answer ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const unknown = approved.filter((s) => !named.includes(s));
  if (unknown.length) {
    const why = `${unknown.join(", ")} was not named by the preview; its scripts need their own consent`;
    throw new KernelError("restriction-key-unknown", why, { exit: 2 });
  }
  return approved;
}

export const RESOLVE_ARGV: Record<Manager, (specs: string[]) => string[]> = {
  npm: (specs) => ["npm", "install", "--package-lock-only", "--ignore-scripts", "--no-audit", ...specs],
  pnpm: (specs) => ["pnpm", "add", "--lockfile-only", "--ignore-scripts", ...specs], // "add": package.json does not list these specs yet
};

export function selectManager(present: Present): { manager: Manager } | { refusal: string } {
  if (present("yarn.lock")) return { refusal: "Yarn lockfiles are not supported by dependency resolution" };
  const npm = present(LOCK_FILES.npm), pnpm = present(LOCK_FILES.pnpm);
  if (npm && pnpm) return { refusal: "multiple package-manager lockfiles are not supported by dependency resolution" };
  return { manager: pnpm ? "pnpm" : "npm" };
}

/** A lockfile was added, removed or replaced so the manager is no longer the one the preview used. */
export function layoutRefusal(present: Present, expected: Manager): string | undefined {
  const selected = selectManager(present);
  if ("refusal" in selected) return selected.refusal;
  return selected.manager === expected ? undefined : "the package-manager lockfile changed after the preview";
}

/** A project change that makes the preview's manager or resolver inputs unsupported, checked by presence only. */
export const projectRefusal = (present: Present, manager: Manager): string | undefined =>
  layoutRefusal(present, manager) ?? configRefusal(present, manager);

export function configRefusal(present: Present, manager: Manager): string | undefined {
  if (present(".npmrc"))
    return "a root .npmrc is secret and cannot be copied to the private resolver; use user-level manager configuration";
  if (present("pnpm-workspace.yaml")) return "pnpm workspaces are not supported by dependency resolution";
  if (manager === "pnpm" && present(".pnpmfile.cjs")) return "pnpm resolver hooks are not supported by dependency resolution";
  return undefined;
}

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;

function parseObject(text: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(text));
  } catch {
    return null;
  }
}

function hasLocalDependency(manifest: Record<string, unknown>): boolean {
  return ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"].some((group) =>
    Object.values(record(manifest[group]) ?? {}).some((spec) => typeof spec === "string" && LOCAL_SPEC.test(spec)));
}

function npmLockHasLocalSource(lock: Record<string, unknown>): boolean {
  const pending: unknown[] = [lock];
  while (pending.length) {
    const entry = record(pending.pop());
    if (!entry) continue;
    if (entry.link === true || typeof entry.resolved === "string" && LOCAL_SPEC.test(entry.resolved)) return true;
    pending.push(...Object.values(entry));
  }
  return false;
}

/** Why the captured manifest and lock cannot be resolved as one root package from the registry, if they cannot. */
export function contentRefusal(manager: Manager, manifestText: string | null, lock: string | null): string | undefined {
  const manifest = manifestText === null ? {} : parseObject(manifestText);
  if (!manifest) return "the current package manifest is invalid; dependency resolution requires a single root package";
  if (Object.hasOwn(manifest, "workspaces")) return "npm workspaces are not supported by dependency resolution";
  if (hasLocalDependency(manifest)) return "local, link and workspace dependency sources are not supported";
  if (manager === "pnpm" && Object.keys(record(record(manifest.pnpm)?.patchedDependencies) ?? {}).length > 0)
    return "pnpm patched dependencies are not supported";
  if (lock === null) return undefined;
  const local = "the current lockfile contains a local dependency source; resolution is unsupported";
  if (manager === "pnpm") return /(?:file|link|workspace):|\bdirectory\s*:|^\s*patchedDependencies\s*:/m.test(lock) ? local : undefined;
  const parsed = parseObject(lock);
  if (!parsed) return "the current package lockfile is invalid; refusing unresolved dependency sources";
  return npmLockHasLocalSource(parsed) ? local : undefined;
}

/** The preview's question text: what the lockfile changes, what the policy says, and how to approve an install script. */
export function previewText(specs: string[], obs: Observation[], removed: string[], j: Judgement): string {
  const lines = obs
    .slice(0, 8)
    .map((o) => `${o.name}@${o.version}${o.previous ? ` (was ${o.previous})` : ""}${o.direct ? "" : ", transitive"}`);
  const notes = j.issues.filter((i) => i.severity !== "note").map((i) => i.message);
  const more = obs.length > 8 ? `; and ${obs.length - 8} more` : "";
  const dropped = removed.length ? `. It drops ${removed.slice(0, 4).join(", ")}` : "";
  const issueNotes = notes.length ? ` ${notes.join(". ")}.` : "";
  const scriptsHint = j.scripts.length
    ? ` To run an install script, name it: --answer dependency-scripts=${j.scripts.join(",")}.`
    : "";
  const count = `${obs.length} package${obs.length === 1 ? "" : "s"}`;
  const summary = `Add ${specs.join(", ")}? The lockfile changes ${count}: ${lines.join("; ")}${more}${dropped}.`;
  const held = "package.json and the lockfile already hold the resolved versions; nothing is installed yet.";
  return `${summary}${issueNotes} ${held}${scriptsHint}`;
}

export const previewOptions = (recommended: boolean) => [
  { label: "Yes, install them", description: "Install exactly the lockfile shown, with install scripts off.", recommended },
  { label: "No, restore my files", description: "Put package.json and the lockfile back as they were; nothing is installed." },
];
