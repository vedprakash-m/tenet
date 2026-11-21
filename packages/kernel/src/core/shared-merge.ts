// Three-way merge of Tenet's shared files by element ID (GIT-09, TS §7.9, §10.4). Pure: the in-scope files of the merge
// base, the target branch tip (ours) and the work tip (theirs) in, one proposal out. Entries are managed blocks in
// INTENT.md and docs/hardening.md, and whole decision files keyed by the ID in their name. One-sided changes take that
// side; the same ID changed differently on both sides is a `content` collision (the work side unless the user picks the
// target side); an ID both sides created is a `duplicate`, and the work branch's copy gets one new suffix everywhere.
// Mentions of a renamed ID are rewritten only in text the work branch alone changed; anywhere else the proposal is refused.
import { sha256 } from "./ids.ts";
import { blockHash, parseBlocks } from "./intent-md.ts";
import type { Block } from "./intent-md.ts";

export const BLOCK_FILES: readonly string[] = ["INTENT.md", "docs/hardening.md"];
const DECISION = /^docs\/decisions\/\d+-([A-Z]+-\d+-[a-z2-7]+)(?:-[^/]*)?\.md$/;
export const isDecisionPath = (p: string): boolean => DECISION.test(p);
/** Tenet's shared files reconciled by ID; any other conflicted path keeps Git's own conflict. */
export const isShared = (p: string): boolean => BLOCK_FILES.includes(p) || DECISION.test(p);

export type MergeSide = "target" | "work";
export type Collision = {
  id: string;
  kind: "content" | "duplicate";
  path: string;
  base: string | null;
  ours: string | null;
  theirs: string | null;
  proposed: string | null;
  side?: MergeSide;
  renamedTo?: string;
};
/** In-scope path to text, for one tree. */
export type Snap = ReadonlyMap<string, string>;
export type PlanInput = { base: Snap; ours: Snap; theirs: Snap; seed: string; sides?: Readonly<Record<string, MergeSide>> };
export type SharedPlan =
  | {
      ok: true;
      /** Paths whose merged content Tenet writes (null deletes), relative to Git's own merge. */
      files: Map<string, string | null>;
      collisions: Collision[];
      /** Old ID to new ID, for every duplicate. */
      renames: Map<string, string>;
      /** Old decision file name to new name, for references by path. */
      names: Map<string, string>;
      /** Work-branch paths the plan already rewrote; mention rewriting elsewhere skips them. */
      handled: Set<string>;
    }
  | { ok: false; why: string };

type Side = { text: string; blocks: Map<string, Block>; order: string[]; skeleton: string };

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const SEQ_ID = /^([A-Z]+)-(\d+)-([a-z2-7]+)$/;
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** Not text Tenet may rewrite: NUL bytes or bytes that did not decode as UTF-8. */
export const notText = (s: string): boolean => /[\u0000�]/.test(s);

function side(text: string): Side | string {
  const p = parseBlocks(text);
  if (!p.ok) return `${p.problem} marker at line ${p.line}`;
  let skeleton = "", at = 0;
  for (const b of p.blocks) { skeleton += text.slice(at, b.start); at = b.end; }
  skeleton += text.slice(at);
  // Blank lines between blocks shift as blocks come and go; they are not human text.
  const norm = skeleton.replace(/\r\n/g, "\n").split("\n").filter((l) => l.trim()).join("\n");
  return { text, blocks: new Map(p.blocks.map((b) => [b.id, b])), order: p.blocks.map((b) => b.id), skeleton: norm };
}

const bodyOf = (s: Side | null, id: string): string | null => {
  const b = s?.blocks.get(id);
  return b ? s!.text.slice(b.bodyStart, b.bodyEnd) : null;
};
const same = (a: string | null, b: string | null): boolean => (a === null || b === null ? a === b : blockHash(a) === blockHash(b));

/** Rewrites renamed IDs (and the cores they share with their examples) and renamed decision file names in a text. */
export function renamer(renames: ReadonlyMap<string, string>, names: ReadonlyMap<string, string> = new Map()) {
  const rules = [...renames].map(([from, to]) => {
    const prefix = SEQ_ID.exec(from)![1]!;
    return [new RegExp(`(?<=\\b[A-Z]+-)${escape(from.slice(prefix.length + 1))}(?![\\w-])`, "g"), to.slice(prefix.length + 1)] as const;
  });
  const files = [...names].map(([from, to]) => [new RegExp(escape(from), "g"), to] as const);
  const mentions = (s: string) => [...rules, ...files].some(([re]) => { re.lastIndex = 0; return re.test(s); });
  const apply = (s: string) => [...files, ...rules].reduce((acc, [re, to]) => acc.replace(re, to), s);
  return { mentions, apply };
}

/** A new `<seq>-<suffix>` for a duplicated ID, derived from the ID and the work tip so every file gets the same one. */
function resuffix(id: string, seed: string, taken: string): string | null {
  const m = SEQ_ID.exec(id);
  if (!m) return null;
  const [, prefix, seq, suffix] = m as unknown as [string, string, string, string];
  for (let i = 0; i < 64; i++) {
    const h = sha256(`${id}\n${i}\n${seed}`);
    const s = Array.from({ length: suffix.length }, (_, k) => ALPHABET[parseInt(h.slice(k * 2, k * 2 + 2), 16) % 32]).join("");
    if (s !== suffix && !taken.includes(`-${seq}-${s}`)) return `${prefix}-${seq}-${s}`;
  }
  return null;
}

type Entry = { path: string; text: string };
/** Decision files by the ID in their name; null when one ID names two files on one side. */
function decisions(s: Snap): Map<string, Entry> | string {
  const out = new Map<string, Entry>();
  for (const [path, text] of s) {
    const m = DECISION.exec(path);
    if (!m) continue;
    if (out.has(m[1]!)) return `${m[1]} names two decision files on one branch`;
    out.set(m[1]!, { path, text });
  }
  return out;
}
/** Front matter: a leading `---` block holding `id: <ID>`, which must be the ID in the file name. */
function frontMatterOk(e: Entry): boolean {
  const lines = e.text.replace(/^﻿/, "").replace(/\r\n/g, "\n").split("\n");
  if (lines[0] !== "---") return false;
  const end = lines.indexOf("---", 1);
  if (end < 0) return false;
  const ids = lines.slice(1, end).filter((l) => /^id:/.test(l)).map((l) => l.slice(3).trim().replace(/^["']|["']$/g, ""));
  return ids.length === 1 && ids[0] === DECISION.exec(e.path)![1];
}

const changed = (p: string, i: PlanInput) =>
  !(i.ours.get(p) === i.theirs.get(p) || i.ours.get(p) === i.base.get(p) || i.theirs.get(p) === i.base.get(p));

/** Why a proposal cannot be made without guessing; caught once, in `planShared`. */
class Refusal extends Error {}
const refuse = (why: string): never => { throw new Refusal(why); };
type Renamer = ReturnType<typeof renamer>;
type Acc = { files: Map<string, string | null>; collisions: Collision[]; handled: Set<string> };
const sideOf = (text: string | undefined, path: string): Side | null => {
  if (text === undefined) return null;
  const s = side(text);
  return typeof s === "string" ? refuse(`${path}: ${s}`) : s;
};

/** The work side with its prose mentions renamed, when the human text outside the blocks comes from the work branch. */
function frameSides(path: string, base: Side | null, ours: Side, theirs: Side, r: Renamer): { workProse: boolean; theirs: Side } {
  const workProse = theirs.skeleton !== ours.skeleton && (!base || ours.skeleton === base.skeleton);
  if (!workProse && !(theirs.skeleton === ours.skeleton || (base && theirs.skeleton === base.skeleton)))
    refuse(`${path}: both branches changed text outside Tenet's blocks`);
  if (theirs.skeleton === ours.skeleton && base?.skeleton !== ours.skeleton && r.mentions(ours.skeleton))
    refuse(`${path}: text both branches changed mentions a renamed ID`);
  if (!workProse || !r.mentions(theirs.skeleton)) return { workProse, theirs };
  let text = "", at = 0;
  for (const id of theirs.order) {
    const b = theirs.blocks.get(id)!;
    text += r.apply(theirs.text.slice(at, b.start)) + theirs.text.slice(b.start, b.end);
    at = b.end;
  }
  return { workProse, theirs: side(text + r.apply(theirs.text.slice(at))) as Side };
}

/** One block's merged body; a collision is recorded. A duplicate's work copy goes under its new ID. */
function mergeBlock(
  path: string, id: string, [b, o, t]: [string | null, string | null, string | null], i: PlanInput,
  renames: Map<string, string>, r: Renamer, out: Collision[],
): [string, string | null][] {
  if (same(o!, t!)) {
    if (!same(o!, b!) && o && r.mentions(o)) refuse(`${path}: ${id}, changed alike on both branches, mentions a renamed ID`);
    return [[id, o!]];
  }
  if (same(o!, b!)) return [[id, t === null ? null : r.apply(t!)]];
  if (same(t!, b!)) return [[id, o!]];
  if (b !== null) {
    // The ID was not at the merge base, so a mention in the work text is the work branch's; the target text keeps its own.
    const chosen = i.sides?.[id] ?? "work";
    const text = chosen === "work" ? (t === null ? null : r.apply(t!)) : o!;
    out.push({ id, kind: "content", path, base: b, ours: o!, theirs: t!, proposed: text, side: chosen });
    return [[id, text]];
  }
  const renamedTo = renames.get(id)!, moved = r.apply(t!);
  out.push({ id, kind: "duplicate", path, base: null, ours: o!, theirs: t!, proposed: moved, renamedTo });
  return [[id, o!], [renamedTo, moved]];
}

/** Merge one block file both sides changed; mentions of renamed IDs follow in text only the work branch changed. */
function mergeBlockFile(path: string, i: PlanInput, renames: Map<string, string>, r: Renamer, out: Collision[]): string {
  const ours = sideOf(i.ours.get(path), path), raw = sideOf(i.theirs.get(path), path), base = sideOf(i.base.get(path), path);
  if (!ours || !raw) return refuse(`${path} was deleted on one branch and changed on the other`);
  const { workProse, theirs } = frameSides(path, base, ours, raw, r);
  const result = new Map<string, string | null>();
  const extra: string[] = [];
  for (const id of new Set([...ours.order, ...theirs.order])) {
    const merged = mergeBlock(path, id, [bodyOf(base, id), bodyOf(ours, id), bodyOf(theirs, id)], i, renames, r, out);
    for (const [k, v] of merged) result.set(k, v);
    if (merged.length > 1) extra.push(merged[1]![0]);
  }
  const frame = workProse ? theirs : ours;
  return assemble(frame, frame === ours ? theirs : ours, result, extra);
}

/** The frame's text with merged bodies in place, removed blocks gone, and the other side's new blocks after its last block. */
function assemble(frame: Side, other: Side, result: Map<string, string | null>, extra: string[]): string {
  const eol = frame.text.includes("\r\n") ? "\r\n" : "\n";
  const fit = (s: string) => s.replace(/\r?\n/g, eol);
  const edits: { from: number; to: number; text: string }[] = [];
  for (const id of frame.order) {
    const b = frame.blocks.get(id)!, want = result.get(id) ?? null;
    if (want === null) edits.push({ from: b.start, to: b.end, text: "" });
    else if (want !== frame.text.slice(b.bodyStart, b.bodyEnd)) edits.push({ from: b.bodyStart, to: b.bodyEnd, text: fit(want) });
  }
  const added = [...other.order, ...extra].filter((id) => !frame.blocks.has(id) && result.get(id) != null);
  if (added.length) {
    const at = frame.order.length ? Math.max(...[...frame.blocks.values()].map((b) => b.end)) : frame.text.length;
    const lead = frame.order.length || frame.text.endsWith("\n") ? eol : `${eol}${eol}`;
    const body = added.map((id) => `<!-- tenet:begin ${id} -->${eol}${fit(result.get(id)!)}<!-- tenet:end ${id} -->${eol}`);
    edits.push({ from: at, to: at, text: `${lead}${body.join(eol)}` });
  }
  let text = frame.text;
  for (const e of edits.sort((a, b) => b.from - a.from)) text = text.slice(0, e.from) + e.text + text.slice(e.to);
  return text;
}

type Decisions = [Map<string, Entry>, Map<string, Entry>, Map<string, Entry>];

/** IDs created on both branches with different content: blocks in a block file, or decision files. */
function duplicateIds(i: PlanInput, blockFiles: readonly string[], [db, dou, dth]: Decisions): Set<string> {
  const dups = new Set<string>();
  for (const p of blockFiles) {
    const [b, o, t] = [i.base, i.ours, i.theirs].map((s) => sideOf(s.get(p), p));
    for (const id of o?.order ?? []) if (!b?.blocks.has(id) && t?.blocks.has(id) && !same(bodyOf(o!, id), bodyOf(t, id))) dups.add(id);
  }
  for (const [id, o] of dou) {
    const t = dth.get(id);
    if (!db.has(id) && t && !(t.path === o.path && t.text === o.text)) dups.add(id);
  }
  return dups;
}

/** One new ID per duplicate, and the new name of each renamed decision file. */
function renaming(i: PlanInput, dups: Set<string>, [, dou, dth]: Decisions) {
  const taken = [i.base, i.ours, i.theirs].flatMap((s) => [...s].flat()).join("\n");
  const renames = new Map<string, string>(), names = new Map<string, string>();
  for (const id of dups)
    renames.set(id, resuffix(id, i.seed, taken) ?? refuse(`${id} was created on both branches and cannot be re-suffixed`));
  for (const [id, t] of dth) {
    if (!dups.has(id)) continue;
    if (!frontMatterOk(t) || !frontMatterOk(dou.get(id)!)) refuse(`${t.path}: the front matter id is not the ID in its name`);
    names.set(fileName(t.path), fileName(t.path.replace(id, renames.get(id)!)));
  }
  return { renames, names };
}
const fileName = (p: string) => p.slice(p.lastIndexOf("/") + 1);

/** A decision file whose ID collides: the duplicate's work copy is renamed; a content collision takes the chosen side. */
function mergeDecision(
  id: string, [b, o, t]: [Entry | null, Entry | null, Entry | null], i: PlanInput, renames: Map<string, string>, r: Renamer, acc: Acc,
) {
  if (renames.has(id)) {
    const to = renames.get(id)!, path = t!.path.replace(id, to), moved = r.apply(t!.text);
    acc.files.set(t!.path, o!.path === t!.path ? o!.text : null).set(path, moved);
    acc.handled.add(t!.path).add(path);
    acc.collisions.push({
      id, kind: "duplicate", path: t!.path, base: null, ours: o!.text, theirs: t!.text, proposed: moved, renamedTo: to,
    });
    return;
  }
  if (!b) return;
  const [bt, ot, tt] = [b.text, o?.text ?? null, t?.text ?? null];
  if (ot === tt || ot === bt || tt === bt) return; // one-sided: Git's own merge holds it
  if (new Set([b.path, o?.path, t?.path].filter(Boolean)).size > 1)
    refuse(`${id}: its decision file was renamed on one branch and changed on the other`);
  const chosen = i.sides?.[id] ?? "work";
  const text = chosen === "work" ? (tt === null ? null : r.apply(tt)) : ot;
  acc.collisions.push({ id, kind: "content", path: b.path, base: bt, ours: ot, theirs: tt, proposed: text, side: chosen });
  acc.files.set(b.path, text);
  acc.handled.add(b.path);
}

/** The merged proposal for every in-scope file; `ok: false` names why no proposal can be made without guessing. */
export function planShared(i: PlanInput): SharedPlan {
  try {
    for (const s of [i.base, i.ours, i.theirs]) for (const [p, t] of s) if (notText(t)) refuse(`${p} is not UTF-8 text`);
    const blockFiles = BLOCK_FILES.filter((p) => (i.ours.has(p) || i.theirs.has(p)) && changed(p, i));
    const ds = [i.base, i.ours, i.theirs].map((s) => {
      const d = decisions(s);
      return typeof d === "string" ? refuse(d) : d;
    }) as Decisions;
    const dups = duplicateIds(i, blockFiles, ds);
    const { renames, names } = renaming(i, dups, ds);
    const r = renamer(renames, names);
    const acc: Acc = { files: new Map(), collisions: [], handled: new Set() };
    for (const p of blockFiles) {
      acc.files.set(p, mergeBlockFile(p, i, renames, r, acc.collisions));
      acc.handled.add(p);
    }
    const [db, dou, dth] = ds;
    for (const id of new Set([...dou.keys(), ...dth.keys()]))
      mergeDecision(id, [db.get(id) ?? null, dou.get(id) ?? null, dth.get(id) ?? null], i, renames, r, acc);
    return { ok: true, ...acc, renames, names };
  } catch (e) {
    if (e instanceof Refusal) return { ok: false, why: e.message };
    throw e;
  }
}
