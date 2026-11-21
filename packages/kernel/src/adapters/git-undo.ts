// The Git side of undo (GIT-04, undo-confirmation §7). Every fact comes from one pinned commit, rename detection is off,
// patch paths use explicit prefixes, and `git apply` runs only between two checks. A partial or disturbed apply is
// uncertain, never "not reverted".
import {
  closeSync, constants, lstatSync, mkdtempSync, openSync, readlinkSync, realpathSync, rmSync, writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { Runner } from "../ports/types.ts";

interface Out { code: number; stdout: string; stderr: string }
/** The parts of GitCli undo needs; `run` applies the adapter's neutral inspection arguments. */
export interface UndoGit {
  root: string;
  runner: Runner;
  run(args: string[], o?: { env?: Record<string, string>; input?: string; inspect?: boolean; filters?: boolean }): Promise<Out>;
  env(): Record<string, string>;
}
export interface UndoApply {
  patch: string; head: string; branch: string | null; paths: readonly string[];
  pre: Readonly<Record<string, string | null>>; post: Readonly<Record<string, string | null>>;
  runDir: string; timeoutMs: number;
}
type Applied = { ok: boolean; uncertain?: boolean; detail?: string };

/** Diff arguments that no user setting can change. */
const DIFF = ["diff", "--no-ext-diff", "--no-textconv", "--no-renames", "-U3", "--inter-hunk-context=0",
  "--src-prefix=a/", "--dst-prefix=b/", "--no-relative"];
const literal = (paths: readonly string[]) => paths.map((p) => `:(literal)${p}`);

async function out(g: UndoGit, args: string[], o?: Parameters<UndoGit["run"]>[1]): Promise<string> {
  const r = await g.run(args, o);
  if (r.code !== 0) throw new Error(`git ${args[0]} failed: ${r.stderr.trim().slice(0, 200)}`);
  return r.stdout;
}

const shortBranch = (branch: string | null): string | null =>
  branch?.startsWith("refs/heads/") ? branch.slice("refs/heads/".length) : branch;

/** HEAD as a commit ID and the display name of the checked-out branch, read once. */
export async function pinHead(g: UndoGit): Promise<{ head: string; branch: string | null }> {
  const head = (await out(g, ["rev-parse", "--verify", "-q", "HEAD^{commit}"])).trim();
  const ref = await g.run(["symbolic-ref", "-q", "--short", "HEAD"]);
  return { head, branch: ref.code === 0 ? ref.stdout.trim() : null };
}

/** Paths the owned commits changed, with both ends of a rename included. */
export async function undoNames(g: UndoGit, commits: readonly string[]): Promise<string[]> {
  const empty = (await out(g, ["hash-object", "-t", "tree", "/dev/null"])).trim();
  const names = new Set<string>();
  for (const c of commits) {
    const parent = (await g.run(["rev-parse", "-q", "--verify", `${c}^`])).stdout.trim() || empty;
    for (const p of (await out(g, ["diff", "--no-ext-diff", "--no-renames", "--no-relative",
      "--name-only", "-z", parent, c])).split("\0")) if (p) names.add(p);
  }
  return [...names].sort();
}

/** Paths named in patch headers. */
export function patchPaths(patch: string): string[] {
  const found = new Set<string>();
  for (const m of patch.matchAll(/^diff --git a\/(.+) b\/(.+)$/gm)) {
    found.add(m[1]!);
    found.add(m[2]!);
  }
  return [...found].sort();
}

/** Inverse of the owned commits on top of `head`, built in a temporary index. */
export async function planInverse(g: UndoGit, commits: readonly string[], head: string): Promise<
  { ok: true; tree: string; patch: string; paths: string[]; stat: string } |
  { ok: false; conflict: string[]; detail: string }
> {
  const dir = mkdtempSync(join(tmpdir(), "tenet-undo-"));
  const env = { GIT_INDEX_FILE: join(dir, "index") };
  try {
    await out(g, ["read-tree", head], { env, inspect: false });
    const empty = (await out(g, ["hash-object", "-t", "tree", "/dev/null"])).trim();
    for (const c of commits) {
      const parent = (await g.run(["rev-parse", "-q", "--verify", `${c}^`])).stdout.trim() || empty;
      const inverse = await out(g, [...DIFF, "--binary", "--full-index", c, parent]);
      const r = await g.run(["apply", "--cached", "-p1", "--whitespace=nowarn"],
        { env, input: inverse, inspect: false });
      if (r.code !== 0) {
        const named = [...r.stderr.matchAll(/error: (?:patch failed: )?([^:\n]+?)(?::\d+)?(?::| does not)/g)]
          .map((m) => m[1]!);
        return { ok: false, conflict: [...new Set(named)], detail: r.stderr.trim().slice(0, 400) };
      }
    }
    const tree = (await out(g, ["write-tree"], { env, inspect: false })).trim();
    const patch = await out(g, [...DIFF, "--binary", "--full-index", head, tree]);
    const paths = (await out(g, [...DIFF, "--name-only", "-z", head, tree])).split("\0").filter(Boolean).sort();
    const stat = (await out(g, [...DIFF, "--stat", "--no-color", head, tree])).trim().split("\n").at(-1) ?? "";
    const named = patchPaths(patch);
    if (named.length !== paths.length || named.some((p, i) => p !== paths[i])) {
      return { ok: false, conflict: [], detail: "the inverse patch names different paths than the plan; nothing was reverted" };
    }
    const unsupported = unsupportedUndoModes(await treeEntries(g, tree, paths), paths);
    if (unsupported.length) return {
      ok: false, conflict: unsupported, detail: "the inverse would recreate a symlink or another unsupported mode",
    };
    return { ok: true, tree, patch, paths, stat };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Commits after the oldest owned commit that touch the complete affected path set. */
export async function laterTouching(
  g: UndoGit, owned: readonly string[], oldest: string, head: string, paths: readonly string[],
) {
  if (!paths.length) return [];
  const mine = new Set(owned);
  return (await out(g, ["log", "--no-renames", "--format=%H %h %s", `${oldest}..${head}`, "--", ...literal(paths)]))
    .split("\n")
    .filter(Boolean)
    .filter((line) => !mine.has(line.slice(0, line.indexOf(" "))))
    .map((line) => line.slice(line.indexOf(" ") + 1));
}

const isLink = (p: string) => { try { return lstatSync(p).isSymbolicLink(); } catch { return false; } };
const exists = (p: string) => { try { lstatSync(p); return true; } catch { return false; } };

/** Working-tree blob identity without clean filters. */
export async function worktreeBlobs(g: UndoGit, paths: readonly string[]): Promise<Record<string, string | null>> {
  const blobs: Record<string, string | null> = {};
  for (const p of paths) {
    const abs = join(g.root, p);
    let st;
    try { st = lstatSync(abs); } catch { blobs[p] = null; continue; }
    if (st.isSymbolicLink()) {
      blobs[p] = (await out(g, ["hash-object", "-t", "blob", "--stdin"], { input: readlinkSync(abs) })).trim();
    } else if (st.isFile()) {
      blobs[p] = (await out(g, ["hash-object", "--no-filters", "--", p])).trim();
    } else {
      blobs[p] = "";
    }
  }
  return blobs;
}

async function indexEntries(g: UndoGit, paths: readonly string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const line of (await out(g, ["ls-files", "-s", "-z", "--", ...literal(paths)])).split("\0").filter(Boolean)) {
    const tab = line.indexOf("\t");
    result[line.slice(tab + 1)] = line.slice(0, tab);
  }
  return result;
}

async function treeEntries(g: UndoGit, head: string, paths: readonly string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const line of (await out(g, ["ls-tree", "-r", "-z", head, "--", ...literal(paths)])).split("\0").filter(Boolean)) {
    const tab = line.indexOf("\t");
    const [mode, , blob] = line.slice(0, tab).split(" ");
    result[line.slice(tab + 1)] = `${mode} ${blob} 0`;
  }
  return result;
}

/** Whether HEAD, branch and affected index entries still match the pinned commit. */
export async function undoState(g: UndoGit, head: string, branch: string | null, paths: readonly string[]) {
  const now = await pinHead(g).catch(() => null);
  const headOk = !!now && now.head === head && shortBranch(now.branch) === shortBranch(branch);
  const [index, tree] = await Promise.all([indexEntries(g, paths), treeEntries(g, head, paths)]);
  const indexOk = paths.every((p) => index[p] === tree[p]);
  return { headOk, indexOk, index: JSON.stringify(index) };
}

const ATTR_UNSET = new Set(["unspecified", "unset"]);
function unsupportedUndoModes(entries: Record<string, string>, paths: readonly string[]): string[] {
  return paths.filter((path) => {
    const entry = entries[path];
    return !!entry && !entry.startsWith("100644 ") && !entry.startsWith("100755 ");
  });
}
async function converted(g: UndoGit, paths: readonly string[]): Promise<string[]> {
  const input = `${paths.join("\0")}\0`;
  const attrs = (await out(g, ["check-attr", "-z", "--stdin", "text", "eol", "filter"],
    { input, filters: true })).split("\0");
  const autocrlf = (await g.run(["config", "--get", "core.autocrlf"])).stdout.trim().toLowerCase();
  const crlf = autocrlf === "true" || autocrlf === "input";
  const hit = new Set<string>();
  for (let i = 0; i + 2 < attrs.length; i += 3) {
    const [path, attr, value] = [attrs[i]!, attrs[i + 1]!, attrs[i + 2]!];
    const converts = attr === "filter" || attr === "eol"
      ? !ATTR_UNSET.has(value)
      : value !== "unspecified" ? value !== "unset" : crlf;
    if (converts) hit.add(path);
  }
  return [...hit];
}

/** Every affected path that is dirty, obstructed or subject to conversion. */
export async function undoObstructions(g: UndoGit, head: string, paths: readonly string[]): Promise<string[]> {
  if (!paths.length) return [];
  const hit = new Set<string>();
  const status = (await out(g, ["status", "--porcelain=v2", "-z", "--no-renames", "--untracked-files=all",
    "--ignored=matching", "--", ...literal(paths)])).split("\0").filter(Boolean);
  for (const record of status) {
    const named = record[0] === "1"
      ? record.split(" ").slice(8).join(" ")
      : record[0] === "u" ? record.split(" ").slice(10).join(" ") : record.slice(2);
    for (const p of paths) {
      if (named === p || named.startsWith(`${p}/`) || (named.endsWith("/") && p.startsWith(named))) hit.add(p);
    }
  }
  for (const line of (await out(g, ["ls-files", "-v", "-z", "--", ...literal(paths)])).split("\0").filter(Boolean)) {
    const tag = line[0]!;
    if (tag === "S" || (tag >= "a" && tag <= "z")) hit.add(line.slice(2));
  }
  const inHead = await treeEntries(g, head, paths);
  unsupportedUndoModes(inHead, paths).forEach((path) => hit.add(path));
  for (const p of paths.filter((x) => !inHead[x])) {
    if (exists(join(g.root, p))) { hit.add(p); continue; }
    const parts = p.split("/");
    for (let i = 1; i < parts.length; i++) {
      const dir = join(g.root, ...parts.slice(0, i));
      if (!exists(dir)) break;
      if (isLink(dir) || !lstatSync(dir).isDirectory() || exists(join(dir, ".git"))) { hit.add(p); break; }
    }
  }
  for (const p of await converted(g, paths)) hit.add(p);
  return [...hit].sort();
}

const atAll = (
  now: Record<string, string | null>,
  want: Readonly<Record<string, string | null>>,
  paths: readonly string[],
) => paths.every((p) => (now[p] ?? null) === (want[p] ?? null));

function admittedRunDirectory(path: string): boolean {
  const absolute = resolve(path);
  let boundary = absolute;
  while (dirname(boundary) !== boundary && !/^tenet-(?:ws_|unbound|[a-z0-9])/.test(basename(boundary)))
    boundary = dirname(boundary);
  if (dirname(boundary) === boundary) return false;
  try {
    let current = absolute;
    for (;;) {
      const st = lstatSync(current);
      if (st.isSymbolicLink() || !st.isDirectory()) return false;
      if (current === boundary) break;
      current = dirname(current);
    }
    const root = realpathSync(boundary), canonical = realpathSync(absolute);
    const rel = relative(root, canonical);
    return !isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`);
  } catch {
    return false;
  }
}

/** Applies the inverse only between the checks required by §7.4. */
export async function applyUndo(g: UndoGit, a: UndoApply): Promise<Applied> {
  let before: string;
  try {
    const state = await undoState(g, a.head, a.branch, a.paths);
    if (!state.headOk) return { ok: false, detail: "HEAD or the branch moved since the undo was confirmed; nothing was reverted" };
    before = state.index;
    const blocked = await undoObstructions(g, a.head, a.paths);
    if (blocked.length) return { ok: false, detail: `files changed at ${blocked.slice(0, 4).join(", ")}; nothing was reverted` };
  } catch (e) {
    return { ok: false, detail: `the undo could not be checked (${(e as Error).message}); nothing was reverted` };
  }
  const file = join(a.runDir, "inverse.patch");
  try {
    if (!admittedRunDirectory(a.runDir)) {
      return { ok: false, detail: "the undo run folder is linked or does not have an admitted directory identity" };
    }
    const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(fd, a.patch); } finally { closeSync(fd); }
  } catch (e) {
    return { ok: false, detail: `the inverse could not be written to its run folder (${(e as Error).message}); nothing was reverted` };
  }
  const r = await g.runner.run({
    argv: ["git", "--no-pager", "-c", "core.fsmonitor=false", "apply", "-p1", "--whitespace=nowarn", "--", file],
    cwd: g.root, runDir: a.runDir, timeoutMs: a.timeoutMs, env: g.env(),
  });
  try {
    const now = await worktreeBlobs(g, a.paths);
    if (r.timedOut || r.signal || r.exit === undefined) return { ok: false, uncertain: true, detail: "git apply did not finish" };
    if (r.exit !== 0) {
      return atAll(now, a.pre, a.paths)
        ? { ok: false, detail: r.stderr.trim().slice(0, 400) }
        : { ok: false, uncertain: true, detail: "git apply failed after writing some files" };
    }
    const state = await undoState(g, a.head, a.branch, a.paths);
    if (!state.headOk || state.index !== before) {
      return { ok: false, uncertain: true, detail: "HEAD, the branch or the index changed during the undo" };
    }
    if (!atAll(now, a.post, a.paths)) {
      return { ok: false, uncertain: true, detail: "a file is not as the undo expected after git apply" };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, uncertain: true, detail: `the undo's result could not be checked (${(e as Error).message})` };
  }
}

export async function guardedApplyUndo(
  g: UndoGit, input: UndoApply, guard: () => Promise<void>,
): Promise<Applied & { errorCode?: string }> {
  try { await guard(); }
  catch (error) { return { ok: false, uncertain: false, detail: error instanceof Error ? error.message : String(error) }; }
  if (process.platform === "win32" || constants.O_NOFOLLOW === undefined) {
    return {
      ok: false, uncertain: false, errorCode: "capability-missing",
      detail: "Safe inverse-patch application is unavailable on this runtime.",
    };
  }
  return applyUndo(g, input);
}
