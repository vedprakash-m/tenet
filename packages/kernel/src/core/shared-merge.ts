// Three-way merge of Tenet's managed blocks in INTENT.md by element ID (GIT-09, TS §7.9). Pure: three texts in, one proposed
// text out. Blocks changed on one side take that side; the same ID changed differently on both sides is a collision. An ID
// both sides created is kept for the base branch and re-suffixed in the work branch's blocks. Text outside the blocks is
// never merged: when both sides changed it, there is no proposal and Git's own conflict stands.
import { sha256 } from "./ids.ts";
import { blockHash, parseBlocks } from "./intent-md.ts";
import type { Block } from "./intent-md.ts";

export type Collision = {
  id: string;
  kind: "content" | "duplicate";
  base: string | null;
  ours: string | null;
  theirs: string | null;
  proposed: string;
  renamedTo?: string;
};
export type SharedMerge = { ok: true; text: string; collisions: Collision[] } | { ok: false; why: string };

type Side = { text: string; blocks: Map<string, Block>; order: string[]; skeleton: string };

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";
const SEQ_ID = /^([A-Z]+)-(\d+)-([a-z2-7]+)$/;

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
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A new `<seq>-<suffix>` core for a duplicated ID, derived from the content so the proposal is the same on every call. */
function resuffix(id: string, theirs: string, taken: string): string | null {
  const m = SEQ_ID.exec(id);
  if (!m) return null;
  const [, , seq, suffix] = m as unknown as [string, string, string, string];
  for (let i = 0; i < 64; i++) {
    const h = sha256(`${id}\n${i}\n${theirs}`);
    const s = Array.from({ length: suffix.length }, (_, k) => ALPHABET[parseInt(h.slice(k * 2, k * 2 + 2), 16) % 32]).join("");
    if (s !== suffix && !taken.includes(`-${seq}-${s}`)) return `${seq}-${s}`;
  }
  return null;
}


type Merged = { result: Map<string, string | null>; collisions: Collision[]; extra: string[] };

/** Each block's merged body by ID; a duplicated ID is re-suffixed in every block that came only from the work branch. */
function mergeBlocks(base: Side | null, ours: Side, theirs: Side, taken: string): Merged | string {
  const collisions: Collision[] = [];
  const result = new Map<string, string | null>();
  const renames: Array<[RegExp, string]> = [];
  const extra: string[] = []; // re-suffixed IDs, placed after the original
  for (const id of new Set([...ours.order, ...theirs.order])) {
    const b = bodyOf(base, id), o = bodyOf(ours, id), t = bodyOf(theirs, id);
    const oneSided = same(o, t) ? o : same(o, b) ? t : same(t, b) ? o : undefined;
    if (oneSided !== undefined) { result.set(id, oneSided); continue; }
    if (b !== null) {
      collisions.push({ id, kind: "content", base: b, ours: o, theirs: t, proposed: (t ?? o)! });
      result.set(id, (t ?? o)!);
      continue;
    }
    const core = resuffix(id, t!, taken);
    if (!core) return `${id} was created on both branches and cannot be re-suffixed`;
    const prefix = SEQ_ID.exec(id)![1]!;
    const renamedTo = `${prefix}-${core}`;
    renames.push([new RegExp(`(?<=\\b[A-Z]+-)${escape(id.slice(prefix.length + 1))}(?![\\w-])`, "g"), core]);
    collisions.push({ id, kind: "duplicate", base: null, ours: o, theirs: t, proposed: t!, renamedTo });
    result.set(id, o).set(renamedTo, t!);
    extra.push(renamedTo);
  }
  const fromTheirs = [...theirs.order.filter((id) => bodyOf(ours, id) === null && bodyOf(base, id) === null), ...extra];
  const rename = (s: string) => renames.reduce((acc, [re, core]) => acc.replace(re, core), s);
  for (const id of fromTheirs) result.set(id, rename(result.get(id)!));
  for (const c of collisions) if (c.renamedTo) c.proposed = result.get(c.renamedTo)!;
  return { result, collisions, extra };
}

/** The frame's text with merged bodies in place, removed blocks gone, and the other side's new blocks after its last block. */
function assemble(frame: Side, other: Side, { result, extra }: Merged): string {
  const eol = frame.text.includes("\r\n") ? "\r\n" : "\n";
  const fit = (s: string) => s.replace(/\r?\n/g, eol);
  const edits: { from: number; to: number; text: string }[] = [];
  for (const id of frame.order) {
    const b = frame.blocks.get(id)!, want = result.get(id) ?? null;
    if (want === null) edits.push({ from: b.start, to: b.end, text: "" });
    else if (!same(want, frame.text.slice(b.bodyStart, b.bodyEnd))) edits.push({ from: b.bodyStart, to: b.bodyEnd, text: fit(want) });
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

/** Merge INTENT.md from the merge base (null when absent there), the base branch tip (ours) and the work tip (theirs). */
export function mergeShared(baseText: string | null, oursText: string, theirsText: string): SharedMerge {
  const parsed = [baseText === null ? null : side(baseText), side(oursText), side(theirsText)];
  const bad = parsed.find((s): s is string => typeof s === "string");
  if (bad !== undefined) return { ok: false, why: bad };
  const [base, ours, theirs] = parsed as [Side | null, Side, Side];
  // The human text outside the blocks comes whole from one side: the side whose text changed, or ours when neither did.
  const frame =
    theirs.skeleton === ours.skeleton || (base && theirs.skeleton === base.skeleton) ? ours
      : base && ours.skeleton === base.skeleton ? theirs : null;
  if (!frame) return { ok: false, why: "both branches changed text outside Tenet's blocks" };
  const m = mergeBlocks(base, ours, theirs, `${baseText ?? ""}\n${oursText}\n${theirsText}`);
  if (typeof m === "string") return { ok: false, why: m };
  return { ok: true, text: assemble(frame, frame === ours ? theirs : ours, m), collisions: m.collisions };
}
