// Declared check outputs (EVD-09, specs/evidence-outputs.md v2): untracked data files a check writes, named by pattern.
// A declaration is cooperative, so the rules here keep it from naming code, configuration, locks, dependencies or a directory
// the contract is likely to change. An importable data file (JSON that code reads) stays a disclosed limit.
import { glob } from "./exclusions.ts";
import type { Obligation } from "./schemas.ts";

const DATA = /\.(?:json|snap|txt|csv|log|db|sqlite|png|html|xml|lcov|css|svg|map)$/i;
const NEVER_DIRS = new Set(["node_modules", ".git", ".tenet"]);
const CODE_DIRS = new Set(
  ["src", "lib", "app", "apps", "packages", "server", "shared", "test", "tests", "__tests__", "scripts", "bin", "source"],
);
const LOCKS = new Set(["package-lock.json", "pnpm-lock.yaml", "yarn.lock"]);

export const isDataPath = (path: string): boolean => DATA.test(path);

/** Why a pattern may not be a declared output, or null when it may. */
export function outputPatternProblem(pattern: string): string | null {
  const segs = pattern.split("/");
  const last = segs.at(-1) ?? "";
  if (!pattern || pattern.length > 200) return "an output pattern is 1 to 200 characters";
  if (pattern.startsWith("/") || pattern.includes("\\") || segs.some((s) => !s || s === "..")) {
    return `${pattern}: stay inside the project, with no empty or .. segment`;
  }
  if (segs.length < 2 || /[*?]/.test(segs[0]!)) return `${pattern}: start with a literal directory, such as coverage/**`;
  if (segs.some((s) => NEVER_DIRS.has(s)) || CODE_DIRS.has(segs[0]!)) return `${pattern}: that directory holds code or dependencies`;
  // `name/**` also matches a file called `name`, so a directory segment that looks like a file (a.ts/**) is refused
  if (segs.slice(0, -1).some((s) => /[^.]\.[a-z0-9]+$/i.test(s))) return `${pattern}: a directory name must not look like a file name`;
  if (LOCKS.has(last)) return `${pattern}: a lockfile is an input, not an output`;
  if (last !== "*" && last !== "**" && !isDataPath(last)) {
    return `${pattern}: end with * or ** or a data file (.json .snap .txt .csv .log .db .sqlite .png .html .xml .lcov .css .svg .map)`;
  }
  return null;
}

/** Output patterns of every obligation, once each. */
export const declaredOutputs = (obligations: readonly Pick<Obligation, "outputs">[]): string[] =>
  [...new Set(obligations.flatMap((o) => o.outputs ?? []))];

export function outputMatcher(patterns: readonly string[]): (path: string) => boolean {
  const res = patterns.map(glob);
  return (path) => res.some((r) => r.test(path));
}

export interface OutputFacts {
  patterns: readonly string[]; paths: Iterable<string>; untracked: ReadonlySet<string>; begun: ReadonlySet<string>;
  fixed: ReadonlySet<string>; scope: ReadonlyArray<(path: string) => boolean>; isSource: (path: string) => boolean;
}

/** Why the declared outputs cannot be trusted for this run, or null: each path they match must be an untracked data file that this
 * contract did not find already there and does not read, change or keep out (specs/evidence-outputs.md v2). */
export function outputsProblem(f: OutputFacts): string | null {
  const bad = f.patterns.map(outputPatternProblem).find((p) => p);
  if (bad) return bad;
  const match = outputMatcher(f.patterns);
  for (const path of f.paths) {
    if (!match(path)) continue;
    if (!f.untracked.has(path)) return `${path} is tracked in Git; a declared output must be untracked (use .gitignore instead)`;
    if (f.begun.has(path)) return `${path} was already there when this contract started; it cannot be a declared output`;
    if (!isDataPath(path) || !f.isSource(path)) return `${path} is code, a test or configuration, not a data file`;
    if (f.fixed.has(path) || f.scope.some((inScope) => inScope(path))) return `${path} is an input or in this contract's scope`;
  }
  return null;
}

/** Paths whose content differs between two inventories (added, removed or changed), sorted. */
export const movedPaths = (was: ReadonlyMap<string, { blob: string }>, now: ReadonlyMap<string, { blob: string }>): string[] =>
  [...new Set([...was.keys(), ...now.keys()])].filter((p) => was.get(p)?.blob !== now.get(p)?.blob).sort();

/** What a `concurrent-edit` receipt says about what moved and what to do about a file a check writes. */
export const movedNote = (moved: readonly string[]): string =>
  `changed during the run: ${moved.slice(0, 5).join(", ")}${moved.length > 5 ? " (and more)" : ""}; `
  + "a file a check writes should be an ignored path, or an untracked data file declared as an output";
