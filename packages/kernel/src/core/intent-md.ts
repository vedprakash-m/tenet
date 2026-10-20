// Managed blocks in INTENT.md (TS §7.8). Pure: text in, text out. Tenet owns the text between its markers and nothing else;
// every other byte, and the file's line endings, stay as they were. A damaged marker stops the work: nothing is guessed.
import { sha256 } from "./ids.ts";
import type { State } from "./schemas.ts";

type Intent = State["project"]["intent"];

export interface Block { id: string; line: number; start: number; bodyStart: number; bodyEnd: number; end: number }
export type Problem = "duplicate" | "nested" | "unbalanced" | "malformed";
export type Parsed = { ok: true; blocks: Block[] } | { ok: false; problem: Problem; id?: string; line: number; region: string };

const MARKER = /^\s*<!--\s*tenet:(begin|end)\s+([A-Za-z0-9][\w.-]*)\s*-->\s*$/;
const LOOKS_LIKE_MARKER = /<!--\s*tenet:(begin|end)(?![\w:])/; // the charter's `tenet:charter:` markers are not ours
const FENCE = /^\s*(```|~~~)/;

/** Normalized so a block is the same block whatever the file's line endings or trailing blank lines. */
export const blockHash = (body: string): string => sha256(body.replace(/\r\n/g, "\n").trimEnd());

export function parseBlocks(text: string): Parsed {
  const lines = text.split("\n");
  const blocks: Block[] = [];
  const seen = new Set<string>();
  let open: { id: string; line: number; start: number; bodyStart: number } | undefined;
  let offset = 0;
  let fenced = false;
  const fail = (problem: Problem, line: number, id?: string): Parsed => ({ ok: false, problem, line, ...(id ? { id } : {}), region: lines.slice(line - 1, line + 2).join("\n").replace(/\r/g, "") });
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const start = offset;
    offset += raw.length + 1;
    if (FENCE.test(raw)) { fenced = !fenced; continue; }
    if (fenced || !LOOKS_LIKE_MARKER.test(raw)) continue;
    const m = MARKER.exec(raw.replace(/\r$/, ""));
    if (!m) return fail("malformed", i + 1);
    const [, kind, id] = m as unknown as [string, "begin" | "end", string];
    if (kind === "begin") {
      if (open) return fail("nested", i + 1, id);
      if (seen.has(id)) return fail("duplicate", i + 1, id);
      seen.add(id);
      open = { id, line: i + 1, start, bodyStart: Math.min(offset, text.length) };
    } else {
      if (!open || open.id !== id) return fail("unbalanced", i + 1, id);
      blocks.push({ id, line: open.line, start: open.start, bodyStart: open.bodyStart, bodyEnd: start, end: Math.min(offset, text.length) });
      open = undefined;
    }
  }
  return open ? fail("unbalanced", open.line, open.id) : { ok: true, blocks };
}

const list = (label: string, items: readonly string[]): string => (items.length ? `**${label}**\n${items.map((x) => `- ${x}`).join("\n")}\n` : "");

/** Block bodies by ID, in the order they appear: the overview, then each requirement with its examples and invariants, then the rest, then plan items. */
export function renderIntent(intent: Intent): Map<string, string> {
  const out = new Map<string, string>();
  const o = intent.overview;
  out.set("OVERVIEW", `**Purpose** ${o.purpose}\n**Users** ${o.users}\n${list("Preferences", o.preferences)}${list("Non-goals", o.nonGoals)}`);
  const reqs = new Set(intent.elements.filter((e) => e.kind === "requirement").map((e) => e.id));
  const line = (e: Intent["elements"][number]) => `${e.id} ${e.text}${e.expiresAt ? ` (until ${e.expiresAt})` : ""}`;
  for (const e of intent.elements) {
    if (e.of && reqs.has(e.of) && (e.kind === "example" || e.kind === "invariant")) continue;
    const children = e.kind === "requirement" ? intent.elements.filter((c) => c.of === e.id && (c.kind === "example" || c.kind === "invariant")) : [];
    out.set(e.id, `**${line(e)}**\n${children.map((c) => `- ${line(c)}\n`).join("")}`);
  }
  for (const p of intent.plan) out.set(p.id, `**${p.id} ${p.outcome}** (${p.state})\n${p.check ? `- check: ${p.check}\n` : ""}${p.dependsOn.length ? `- depends on: ${p.dependsOn.join(", ")}\n` : ""}`);
  return out;
}

export type Projection =
  | { ok: true; text: string; changed: string[]; external: string[]; stale: string[]; written: Record<string, string> }
  | Extract<Parsed, { ok: false }>;

/**
 * The file after Tenet writes its blocks. `written` holds the hash of what Tenet last wrote in each block: a block that
 * differs from both that and the new text was edited by a person, so it stays as it is and is reported for a diff.
 */
export function projectIntent(existing: string | null, intent: Intent, written: Readonly<Record<string, string>>): Projection {
  const parsed = existing === null ? ({ ok: true, blocks: [] } as const) : parseBlocks(existing);
  if (!parsed.ok) return parsed;
  const eol = existing?.includes("\r\n") ? "\r\n" : "\n";
  const fit = (s: string) => s.replace(/\r?\n/g, eol);
  const desired = renderIntent(intent);
  const text0 = existing ?? `# Intent${eol}`;
  const changed: string[] = [], external: string[] = [], stale: string[] = [];
  const now: Record<string, string> = {};
  const edits: { from: number; to: number; text: string }[] = [];
  const have = new Set(parsed.blocks.map((b) => b.id));
  for (const b of parsed.blocks) {
    const want = desired.get(b.id);
    if (want === undefined) { stale.push(b.id); if (written[b.id]) now[b.id] = written[b.id]!; continue; }
    const cur = blockHash(text0.slice(b.bodyStart, b.bodyEnd));
    const target = blockHash(want);
    if (cur === target) now[b.id] = target;
    else if (written[b.id] === cur) { edits.push({ from: b.bodyStart, to: b.bodyEnd, text: fit(want) }); changed.push(b.id); now[b.id] = target; }
    else { external.push(b.id); if (written[b.id]) now[b.id] = written[b.id]!; }
  }
  const added = [...desired].filter(([id]) => !have.has(id));
  if (added.length) {
    const at = parsed.blocks.length ? Math.max(...parsed.blocks.map((b) => b.end)) : text0.length;
    const lead = parsed.blocks.length || text0.endsWith("\n") ? eol : `${eol}${eol}`; // a blank line between the user's text and ours
    const body = added.map(([id, b]) => `<!-- tenet:begin ${id} -->${eol}${fit(b)}<!-- tenet:end ${id} -->${eol}`).join(eol);
    edits.push({ from: at, to: at, text: `${lead}${body}` });
    for (const [id, b] of added) { changed.push(id); now[id] = blockHash(b); }
  }
  let text = text0;
  for (const e of edits.sort((a, b) => b.from - a.from)) text = text.slice(0, e.from) + e.text + text.slice(e.to);
  return { ok: true, text, changed, external, stale, written: now };
}
