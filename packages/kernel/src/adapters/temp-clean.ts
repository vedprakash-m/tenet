// Cleanup of a workspace's temp root (LFC-05). The walk records each entry's identity from a no-follow bigint lstat; removal
// goes entry by entry, deepest first, and touches an entry only while it and every ancestor up to the root still match the
// walk. There is never a recursive delete, so anything added or changed after the walk stays.
import { lstatSync, readdirSync, rmdirSync, unlinkSync, type BigIntStats } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import type { TempEntry } from "../core/residue.ts";

type Kept = Array<{ path: string; cause: string }>;

const typeOf = (st: BigIntStats): TempEntry["type"] =>
  st.isDirectory() ? "dir" : st.isFile() ? "file" : st.isSymbolicLink() ? "link" : "other";
const entryOf = (path: string, st: BigIntStats): TempEntry => ({
  path, type: typeOf(st), dev: String(st.dev), ino: String(st.ino), size: String(st.size),
  mtimeNs: String(st.mtimeNs), ctimeNs: String(st.ctimeNs),
});
const sameObject = (st: BigIntStats, e: TempEntry) =>
  String(st.dev) === e.dev && String(st.ino) === e.ino && typeOf(st) === e.type;
const unchanged = (st: BigIntStats, e: TempEntry) =>
  sameObject(st, e) && String(st.size) === e.size && String(st.mtimeNs) === e.mtimeNs && String(st.ctimeNs) === e.ctimeNs;
const lst = (path: string) => lstatSync(path, { bigint: true });
const at = (root: string, rel: string) => (rel ? join(root, ...rel.split("/")) : root);
const parentOf = (rel: string): string | null => (rel === "" ? null : rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "");
const depth = (rel: string) => (rel === "" ? 0 : rel.split("/").length);
const codeOf = (e: unknown) => (e as NodeJS.ErrnoException).code ?? "error";

/** Every entry under `root`, the root itself first (path ""), or null when any entry cannot be read or moved during the walk. */
export function walkRoot(root: string): TempEntry[] | null {
  const out: TempEntry[] = [];
  const visit = (rel: string): boolean => {
    const path = at(root, rel);
    const entry = entryOf(rel, lst(path));
    out.push(entry);
    if (entry.type !== "dir") return true;
    const names = readdirSync(path).sort();
    if (!sameObject(lst(path), entry)) return false; // replaced while it was listed: nothing below it is trusted
    return names.every((name) => visit(rel ? `${rel}/${name}` : name));
  };
  try { return visit("") ? out : null; } catch { return null; }
}

/** Whether every ancestor of `rel`, up to the root, is still the directory the walk recorded. */
function ancestorsMatch(root: string, byPath: ReadonlyMap<string, TempEntry>, rel: string): boolean {
  for (let p = parentOf(rel); p !== null; p = parentOf(p)) {
    const e = byPath.get(p);
    try { if (!e || !sameObject(lst(at(root, p)), e)) return false; } catch { return false; }
  }
  return true;
}

/** Removes one walked entry if it and its ancestors still match; otherwise why it stays ("gone" when already absent). */
function removeOne(root: string, byPath: ReadonlyMap<string, TempEntry>, e: TempEntry): "removed" | "gone" | string {
  const path = at(root, e.path);
  let st: BigIntStats;
  try { st = lst(path); } catch (x) { return codeOf(x) === "ENOENT" ? "gone" : codeOf(x); }
  const same = e.type === "dir" ? sameObject(st, e) : unchanged(st, e);
  if (!same || !ancestorsMatch(root, byPath, e.path)) return "changed";
  try {
    if (e.type === "dir") rmdirSync(path); else unlinkSync(path);
    return "removed";
  } catch (x) {
    const code = codeOf(x);
    return code === "ENOTEMPTY" || code === "EEXIST" ? "added" : code;
  }
}

/** Removes the walked entries that still match; `keep` folders (absolute) and everything above them stay. */
export function removeWalked(
  root: string, entries: readonly TempEntry[], keep: readonly string[],
): { removed: string[]; kept: Kept } {
  const byPath = new Map(entries.map((e) => [e.path, e]));
  const kept: Kept = [];
  const held = new Set<string>();
  const hold = (rel: string) => { for (let p = parentOf(rel); p !== null; p = parentOf(p)) held.add(p); };
  const keepRel = keep.map((k) => relative(root, k)).filter((r) => !r.startsWith("..") && !isAbsolute(r))
    .map((r) => r.split(sep).join("/"));
  const pending = (rel: string) => keepRel.some((k) => k === "" || rel === k || rel.startsWith(`${k}/`));
  for (const rel of keepRel.filter((r) => byPath.has(r))) {
    kept.push({ path: at(root, rel), cause: "recovery pending" });
    held.add(rel); hold(rel);
  }
  let rootRemoved = false;
  const order = [...entries].sort((a, b) => depth(b.path) - depth(a.path) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  for (const e of order) {
    if (held.has(e.path) || pending(e.path)) continue;
    const outcome = removeOne(root, byPath, e);
    if (outcome === "removed") { if (e.path === "") rootRemoved = true; continue; }
    if (outcome === "gone") continue; // already gone: nothing of anyone's is left to protect
    kept.push({ path: at(root, e.path), cause: outcome });
    hold(e.path);
  }
  return { removed: rootRemoved ? [root] : [], kept };
}
