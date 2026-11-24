import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { appendFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import { utcSeconds } from "../core/clock.js";
import { confine, writeAtomic } from "../core/fs.js";
import { git } from "../core/git.js";
import { readYaml } from "../core/yaml.js";
import { loadPolicy, ownersFor } from "../policy/index.js";
import type { TenetYaml } from "../types/generated.js";
import { anchorBlock, anchorsFor } from "../specs/anchors.js";
import { resolveCitations } from "../specs/citations.js";
import { flags } from "../specs/flags.js";
import { parseDoc, sectionLocation } from "../specs/parse.js";
import { sectionDigest } from "../specs/sections.js";
import { createInterface } from "node:readline";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";
import { itemLine, type ConflictOrQuestion, type ParsedDoc, type SpecSection } from "../specs/parse.js";

type Action = "bless" | "confirm" | "edit" | "reject" | "defer";
export type CompletedAction = Exclude<Action, "edit">;
export type BlessResult = { blessed: number; confirmed: number; rejected: number; deferred: number; minutes: number };
export type BlessOptions = { cwd?: string; doc?: string; section?: string };
export type BlessIO = {
  stdin?: NodeJS.ReadableStream;
  stdout?: { write(value: string): unknown };
  terminal?: boolean;
  now?: () => Date;
  edit?: (filename: string, cwd: string) => Promise<void>;
};
type Ask = (prompt: string) => Promise<string | null>;
type SectionState = { doc: ParsedDoc; section: SpecSection; text: string; filename: string };
type SessionState = {
  owners: string[];
  targets: Array<{ path: string; slug: string }>;
  conflicts: Array<{ path: string; id: string }>;
  read(path: string, slug: string): Promise<SectionState | null>;
  edit(state: SectionState): Promise<void>;
  resolveConflict(state: SectionState, conflict: ConflictOrQuestion, resolution: string): Promise<void>;
  commit(state: SectionState, action: CompletedAction, by: string, restore: boolean, adopt: boolean): Promise<Finding[]>;
  flags(state: SectionState): string[];
  showAnchors(state: SectionState): Promise<string[]>;
};

export const blessText = {
  description: "Read and bless specification sections in your terminal.",
  owner: (options: string) => `Who is blessing? ${options} > `,
  invalid: "Choose one of the listed options.",
  conflict: (id: string, text: string) => `Conflict ${id}: ${text}`,
  postpone: "Decide later",
  writeResolution: "Write a resolution, or press Enter to decide later > ",
  contradiction: "Does this choice contradict a drafted statement? Enter its ID, or type no > ",
  editConflict: (id: string) => `Edit ${id} to agree with the selected resolution.`,
  conflictUnchanged: "The statement is unchanged. The conflict is still open.",
  section: (heading: string, minutes: number, actions: string[]) => `${heading} (${minutes} min) · ${actions.join(" / ")}? `,
  inferred: (ids: string) => `Inferred statements: ${ids}. Edit, adopt, or leave open? `,
  restore: "Restore the document's section from its blessed copy? [y/N] ",
  before: (cite: string, value: string) => `Old ${cite}:\n${value}`,
  after: (cite: string, value: string) => `New ${cite}:\n${value}`,
  noLines: "(unavailable)",
  textInForce: "Blessed text in force",
  confirmSources: "Confirm these source changes? [y/N] ",
  summary: (value: BlessResult) => `✓ ${value.blessed} blessed · ${value.confirmed} confirmed · ${value.rejected} rejected · ${value.deferred} for later`,
  commit: (root: string) => `→ git add -- ${root} && git commit -m "Bless specifications"`,
  missingTarget: "the selected document or section was not found",
  invalidOptions: "pass one document and one section at most",
  noOwners: "tenet.yaml has no owners to choose from",
} as const;

function diagnostic(code: string, vars: Record<string, string> = {}): Finding {
  const words = message(code, vars);
  return fail(code, words.message, words.fix);
}

export function readingMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(words / 200);
}

export function statements(section: SpecSection) {
  return [...section.vision_items, ...section.requirements];
}

function belongs(item: ConflictOrQuestion, doc: ParsedDoc, section: SpecSection): boolean {
  if (item.section === null) return true;
  return item.section === section.slug || item.section === section.heading ||
    item.section === `${doc.path}#${section.slug}`;
}

function relevantOpen(doc: ParsedDoc, section: SpecSection): ConflictOrQuestion[] {
  return doc.sections.flatMap((part) => [...part.conflicts, ...part.questions])
    .filter((item) => belongs(item, doc, section) && (!item.checked || !(item.resolution ?? item.answer)));
}

function sourceLine(text: string, line: number | null): string {
  return line === null ? "" : text.replaceAll("\r\n", "\n").split("\n")[line - 1] ?? "";
}

function choices(text: string): string[] {
  return [...text.matchAll(/\|\s*\d+:\s*([^|]+?)(?=\s*\||$)/g)].map((entry) => entry[1]?.trim() ?? "").filter(Boolean);
}

async function pick(ask: Ask, prompt: string, allowed: readonly string[], write: (value: string) => void): Promise<string | null> {
  while (true) {
    const choice = await ask(prompt);
    if (choice === null) return null;
    const normalized = choice.toLowerCase();
    if (allowed.includes(normalized)) return normalized;
    write(blessText.invalid);
  }
}

async function settle(state: SessionState, ask: Ask, write: (value: string) => void): Promise<boolean> {
  for (const { path, id } of state.conflicts) {
    const source = await state.read(path, "conflicts");
    const conflict = source?.section.conflicts.find((item) => item.id === id);
    if (!source || !conflict || (conflict.checked && conflict.resolution)) continue;
    write(blessText.conflict(id, conflict.text));
    const alternatives = choices(sourceLine(source.text, itemLine(conflict)));
    let resolution: string | null;
    if (alternatives.length) {
      const menu = [...alternatives, blessText.postpone];
      menu.forEach((item, index) => { write(`  ${index + 1}. ${item}`); });
      const choice = await pick(ask, "> ", menu.map((_, index) => String(index + 1)), write);
      if (choice === null) return false;
      resolution = alternatives[Number(choice) - 1] ?? "";
    } else {
      resolution = await ask(blessText.writeResolution);
      if (resolution === null) return false;
    }
    if (!resolution) continue;
    const target = await state.read(path, conflict.section ?? "");
    const items = target ? statements(target.section) : source.doc.sections.flatMap(statements);
    const answer = items.length ? await pick(
      ask, blessText.contradiction, ["no", ...items.map(({ id: itemId }) => itemId.toLowerCase())], write,
    ) : "no";
    if (answer === null) return false;
    if (answer !== "no") {
      const item = items.find(({ id: itemId }) => itemId.toLowerCase() === answer);
      if (item) write(blessText.editConflict(item.id));
      await state.edit(source);
      const updated = await state.read(path, "conflicts");
      const remaining = updated?.doc.sections.flatMap(statements).find((entry) => entry.id === item?.id);
      if (!updated || (remaining && remaining.text === item?.text)) {
        write(blessText.conflictUnchanged);
        continue;
      }
      const current = updated.section.conflicts.find((entry) => entry.id === id);
      if (current) await state.resolveConflict(updated, current, resolution);
    } else {
      await state.resolveConflict(source, conflict, resolution);
    }
  }
  return true;
}

export async function blessSession(state: SessionState, io: BlessIO = {}) {
  const input = io.stdin ?? process.stdin;
  const output = io.stdout ?? process.stdout;
  if (!(io.terminal ?? ("isTTY" in input && input.isTTY === true))) {
    return { result: null, findings: [diagnostic("TN-BLESS-NO-TTY")] };
  }
  const now = io.now ?? (() => new Date());
  const started = now().valueOf();
  const result: BlessResult = { blessed: 0, confirmed: 0, rejected: 0, deferred: 0, minutes: 0 };
  const findings: Finding[] = [];
  const write = (value: string) => { output.write(`${value}\n`); };
  const lines = createInterface({ input, crlfDelay: Infinity, terminal: false });
  const iterator = lines[Symbol.asyncIterator]();
  let terminalClosed = false;
  lines.once("close", () => { terminalClosed = true; });
  let interrupted = false;
  const stop = () => { interrupted = true; lines.close(); };
  if (input === process.stdin) process.once("SIGINT", stop);
  const ask: Ask = async (prompt) => {
    if (interrupted) return null;
    output.write(prompt);
    const answer = await iterator.next();
    if (answer.done || interrupted) return null;
    return answer.value.trim();
  };
  const editableState = {
    ...state,
    edit: async (entry: SectionState) => {
      if (!terminalClosed) lines.pause();
      try { await state.edit(entry); }
      finally { if (!terminalClosed) lines.resume(); }
    },
  };
  try {
    if (!state.owners.length) return { result, findings: [diagnostic("TN-SCHEMA", { path: "tenet.yaml", schema: "tenet-yaml", pointer: "/owners" })] };
    const owner = await pick(ask, blessText.owner(state.owners.map((id, i) => `${i + 1}. ${id}`).join("  ")),
      state.owners.map((_, i) => String(i + 1)), write);
    const by = owner === null ? undefined : state.owners[Number(owner) - 1];
    if (by && await settle(editableState, ask, write)) {
      for (const target of state.targets) {
        while (!interrupted) {
          const current = await state.read(target.path, target.slug);
          if (!current) break;
          const { doc, section } = current;
          const flags = state.flags(current);
          if (section.text.trim()) write(section.text.trimEnd());
          const available: Action[] = flags.includes("sources-changed")
            ? ["bless", "confirm", "edit", "reject", "defer"] : ["bless", "edit", "reject", "defer"];
          const selected = await pick(ask, blessText.section(section.heading || section.slug, readingMinutes(section.text), available), [...available, "later"], write);
          if (selected === null) { interrupted = true; break; }
          if (selected === "edit") { await editableState.edit(current); continue; }
          const action = (selected === "later" ? "defer" : selected) as CompletedAction;
          const open = relevantOpen(doc, section);
          if ((action === "bless" || action === "confirm") && open.length) {
            findings.push(diagnostic("TN-BLESS-OPEN-CONFLICT", { slug: section.slug, ids: open.map(({ id }) => id).join(", ") }));
            break;
          }
          let adopt = false;
          const inferred = statements(section).filter((item) => item.origin === "inferred");
          if (action === "bless" && inferred.length) {
            const ids = inferred.map(({ id }) => id).join(", ");
            const choice = await pick(ask, blessText.inferred(ids), ["edit", "adopt", "leave", ""], write);
            if (choice === "edit") { await editableState.edit(current); continue; }
            if (choice !== "adopt") {
              findings.push(diagnostic("TN-BLESS-INFERRED", { slug: section.slug, ids }));
              if (choice === null) interrupted = true;
              break;
            }
            adopt = true;
          }
          if (action === "confirm") {
            for (const line of await state.showAnchors(current)) write(line);
            const approve = await pick(ask, blessText.confirmSources, ["y", "n", ""], write);
            if (approve === null) { interrupted = true; break; }
            if (approve !== "y") continue;
          }
          let restore = false;
          if (flags.includes("edited") && (action === "reject" || action === "defer")) {
            const choice = await pick(ask, blessText.restore, ["y", "n", ""], write);
            if (choice === null) { interrupted = true; break; }
            restore = choice === "y";
          }
          const errors = await state.commit(current, action, by, restore, adopt);
          findings.push(...errors);
          if (!errors.some((finding) => finding.severity === "error")) {
            const key = ({ bless: "blessed", confirm: "confirmed", reject: "rejected", defer: "deferred" } as const)[action];
            result[key]++;
          }
          break;
        }
        if (interrupted) break;
      }
    }
  } finally {
    lines.close();
    if (input === process.stdin) process.off("SIGINT", stop);
    result.minutes = Math.max(0, now().valueOf() - started) / 60_000;
  }
  return { result, findings };
}

type Front = ReturnType<typeof matter>;
type Counts = { drafted: number | null; kept: number | null; edited: number | null; adopted: number | null; added: number | null };
type Patch = { path: string; text: string };
type Workspace = { cwd: string; head: string; records: string; prefix: string; started: number; now: () => Date };
const normalize = (text: string) => text.replaceAll("\r\n", "\n");
const cleanText = (text: string) => text.replace(/\{[^{}]*\}/g, "").trim().replace(/\s+/g, " ");
const portable = (value: string) => value.replaceAll("\\", "/").replace(/^\.\//, "");

function matter(text: string) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalize(text));
  if (!match?.[1]) throw diagnostic("TN-SPEC-NO-FRONT");
  const yaml = parseDocument(match[1], { uniqueKeys: true });
  if (yaml.errors.length || !isMap(yaml.contents)) throw diagnostic("TN-SPEC-NO-FRONT");
  return { yaml, body: normalize(text).slice(match[0].length) };
}

function documentText({ yaml, body }: Front): string {
  return `---\n${yaml.toString({ lineWidth: 0 })}---\n${body}`;
}

function governing(section: SpecSection): boolean {
  return !["Conflicts", "Open questions"].includes(section.heading) &&
    (section.slug !== "_preamble" || statements(section).length > 0 || section.text.split("\n").some((line) => line.trim() && !/^#\s/.test(line)));
}

function reparseSection(current: SectionState, text: string, prefix: string): SectionState {
  const doc = parseDoc(current.doc.path, text, { prefix });
  const section = doc.sections.find(({ slug }) => slug === current.section.slug);
  if (!section) throw new Error(blessText.missingTarget);
  return { ...current, text, doc, section };
}

function reader(cwd: string): (filename: string) => string | null {
  const root = realpathSync(cwd);
  return (filename) => {
    const relative = portable(filename);
    if (!relative || path.win32.parse(relative).root || path.posix.isAbsolute(relative) ||
        relative.split("/").some((part) => ["..", ".git"].includes(part))) return null;
    try {
      const target = realpathSync(path.join(root, relative));
      const fromRoot = path.relative(root, target);
      if (!fromRoot || fromRoot === ".." || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) return null;
      return readFileSync(target, "utf8");
    } catch { return null; }
  };
}

function targetsConflict(doc: ParsedDoc): Array<{ path: string; id: string }> {
  return doc.sections.flatMap((section) => section.conflicts
    .filter(({ checked, resolution }) => !checked || !resolution)
    .map(({ id }) => ({ path: doc.path, id })));
}

async function editInTerminal(filename: string, cwd: string): Promise<void> {
  const configured = process.env.VISUAL?.trim() || process.env.EDITOR?.trim();
  const parts = configured?.match(/"[^"]*"|'[^']*'|[^\s"']+/g)?.map((part) => part.replace(/^(["'])(.*)\1$/, "$2"));
  const [command, ...args] = parts ?? [process.platform === "win32" ? "notepad" : "vi"];
  if (!command) return;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, [...args, filename], { cwd, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Editor exited with status ${code ?? "unknown"}`));
    });
  });
}

async function unchanged(entry: SectionState): Promise<void> {
  if (await readFile(entry.filename, "utf8") !== entry.text) {
    const code = "TN-SUBJ-DIRTY";
    throw diagnostic(code, { command: "bless" });
  }
}

function replaceBody(entry: SectionState, body: string): string {
  const location = sectionLocation(entry.section);
  const lines = normalize(entry.text).split("\n");
  const old = entry.section.text.replace(/\n$/, "");
  lines.splice(location.start - 1, old ? old.split("\n").length : 0, ...(body ? body.replace(/\n$/, "").split("\n") : []));
  return lines.join("\n");
}

function tableCells(raw: string): string[] {
  return raw.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "").split(/(?<!\\)\|/).map((value) => value.trim());
}

function adoptStatements(entry: SectionState, by: string, prefix: string): SectionState {
  const lines = normalize(entry.text).split("\n");
  const adopted = statements(entry.section).filter(({ origin }) => origin === "inferred");
  for (const item of adopted) {
    const index = (itemLine(item) ?? 0) - 1;
    const line = lines[index];
    if (line === undefined) continue;
    const brace = /\{([^{}]*)\}\s*$/.exec(line);
    if (!line.trimStart().startsWith("|") && brace?.[1]) {
      const meta = brace[1].replace(/(^|;)\s*origin:\s*inferred\s*(?=;|$)/, "$1 origin: asked");
      lines[index] = `${line.slice(0, brace.index)}{${meta.trim()}; adopted_by: ${by}}`;
      continue;
    }
    let header = index - 1;
    while (header >= 0 && (lines[header] ?? "").includes("|") &&
      tableCells(lines[header] ?? "")[0]?.toLowerCase() !== "id") header--;
    const headers = tableCells(lines[header] ?? "");
    if (headers[0]?.toLowerCase() !== "id") continue;
    const columns = headers.map((cell) => cell.toLowerCase().replace(/[ _]/g, ""));
    for (const [key, label] of [["origin", "Origin"], ["adoptedby", "Adopted by"]]) {
      if (key && label && !columns.includes(key)) {
        columns.push(key);
        for (let row = header; row < lines.length && (lines[row] ?? "").includes("|"); row++) {
          const cells = tableCells(lines[row] ?? "");
          cells.push(row === header ? label : row === header + 1 ? "---" : "");
          lines[row] = `| ${cells.join(" | ")} |`;
        }
      }
    }
    const cells = tableCells(lines[index] ?? "");
    cells[columns.indexOf("origin")] = "asked";
    cells[columns.indexOf("adoptedby")] = by;
    lines[index] = `| ${cells.join(" | ")} |`;
  }
  return reparseSection(entry, lines.join("\n"), prefix);
}

type Measured = { id?: string; text: string; origin?: string | null };
function measures(section: SpecSection): Measured[] {
  const items = statements(section);
  const result: Measured[] = items.map(({ id, text, origin }) => ({ id, text: cleanText(text), origin }));
  if (section.slug === "requirements" || /\brequirements?\b/i.test(section.heading)) return result;
  const itemLines = new Set(items.map(itemLine));
  const start = sectionLocation(section).start;
  const prose = section.text.replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[ \t]*$/gm,
    (block) => block.replace(/[^\n]/g, " "));
  const text = prose.split("\n").filter((line, i) => !itemLines.has(start + i) &&
    !/^\s*(?:#|\||<!--)/.test(line)).join(" ");
  result.push(...cleanText(text).split(/(?<=[.!?])\s+/).filter(Boolean).map((sentence) => ({ text: sentence })));
  return result;
}

async function countDraft(entry: SectionState, current: SpecSection, ws: Workspace): Promise<Counts> {
  const ref = entry.doc.front?.tenet && typeof entry.doc.front.tenet === "object"
    ? (entry.doc.front.tenet as { drafted_at_rev?: unknown }).drafted_at_rev : undefined;
  const unavailable = { drafted: null, kept: null, edited: null, adopted: null, added: null };
  if (typeof ref !== "string" || !/^[a-f0-9]{6,64}$/i.test(ref)) return unavailable;
  const draft = await git(["show", `${ref}:${entry.doc.path}`], { cwd: ws.cwd }).catch(() => null);
  if (draft === null) return unavailable;
  const section = parseDoc(entry.doc.path, draft, { prefix: ws.prefix }).sections.find(({ slug }) => slug === current.slug);
  if (!section) return unavailable;
  const before = measures(section);
  const after = measures(current);
  const used = new Set<number>();
  const counts = { drafted: before.length, kept: 0, edited: 0, adopted: 0, added: 0 };
  for (const item of before) {
    const index = after.findIndex((next, candidate) => !used.has(candidate) && (item.id ? item.id === next.id : item.text === next.text));
    const next = after[index];
    if (next) used.add(index);
    if (next?.text === item.text) counts.kept++;
    else counts.edited++;
    if (next?.origin === "asked" && item.origin === "inferred") counts.adopted++;
  }
  counts.added = after.length - used.size;
  return counts;
}

function bumpVersion(version: unknown, filename: string): string {
  if (typeof version !== "string" || !/^\d+(?:\.\d+)*$/.test(version)) {
    throw diagnostic("TN-SCHEMA", { path: filename, schema: "spec-front-matter", pointer: "/tenet/version" });
  }
  const parts = version.split(".");
  const last = parts.pop() ?? "0";
  return [...parts, String(BigInt(last) + 1n)].join(".");
}

async function copyFor(entry: SectionState, read: ReturnType<typeof reader>): Promise<string> {
  const copy = entry.section.blessed_copy ? read(entry.section.blessed_copy) : null;
  if (copy === null || sectionDigest(copy) !== entry.section.blessed_digest) {
    const heading = sectionLocation(entry.section).heading;
    throw { ...diagnostic("TN-SPEC-BLESSED-COPY", { slug: entry.section.slug }), file: entry.doc.path, line: heading || null };
  }
  return copy;
}

async function persist(ws: Workspace, patches: Patch[], log: object): Promise<void> {
  const logfile = await confine(`${ws.records}/blessed/log.jsonl`, ws.cwd);
  const saved = new Map<string, Buffer | null>();
  try {
    for (const patch of patches) {
      const filename = await confine(patch.path, ws.cwd);
      const old = await readFile(filename).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      await writeAtomic(filename, patch.text);
      saved.set(filename, old);
    }
    await mkdir(path.dirname(logfile), { recursive: true });
    await appendFile(logfile, `${JSON.stringify(log)}\n`, "utf8");
  } catch (error) {
    const failures: unknown[] = [error];
    for (const [filename, bytes] of [...saved].reverse()) {
      try {
        if (bytes === null) await rm(filename, { force: true });
        else await writeAtomic(filename, bytes);
      } catch (rollback) { failures.push(rollback); }
    }
    if (failures.length > 1) throw new AggregateError(failures, "Could not restore an interrupted blessing write");
    throw error;
  }
}

function findingFrom(error: unknown): Finding {
  if (error && typeof error === "object" && "severity" in error) return error as Finding;
  if (error && typeof error === "object" && "finding" in error) return error.finding as Finding;
  return diagnostic("TN-INTERNAL", { detail: error instanceof Error ? error.message : String(error) });
}

async function writeAction(ws: Workspace, entry: SectionState, action: CompletedAction, by: string, restore: boolean, adopt: boolean) {
  try {
    await unchanged(entry);
    const checked = adopt ? adoptStatements(entry, by, ws.prefix) : entry;
    const { section } = checked;
    const inferred = statements(section).filter(({ origin }) => origin === "inferred");
    if (action === "bless" && inferred.length) return [diagnostic("TN-BLESS-INFERRED", { slug: section.slug, ids: inferred.map(({ id }) => id).join(", ") })];
    const read = reader(ws.cwd);
    const front = matter(checked.text);
    const sectionPath = ["sections", section.slug];
    const set = (key: string, value: unknown) => front.yaml.setIn([...sectionPath, key], value);
    const patches: Patch[] = [];
    let measured = section;
    if (action === "bless" || action === "confirm") {
      const subject = action === "confirm" ? reparseSection(checked, replaceBody(checked, await copyFor(checked, read)), ws.prefix).section : section;
      const relevant = { ...checked.doc, sections: [subject] };
      const errors = resolveCitations(relevant, read);
      if (errors.length) return errors;
      const newAnchors = anchorsFor(subject, read);
      const copyPath = `${ws.records}/blessed/${checked.doc.path.replaceAll("/", "__")}/${section.slug}.md`;
      const digest = sectionDigest(subject.text);
      if (action === "bless" && section.blessed_digest && section.blessed_digest !== digest) {
        front.yaml.setIn(["tenet", "version"], bumpVersion(front.yaml.getIn(["tenet", "version"]), checked.doc.path));
      }
      set("state", "blessed");
      set("digest", section.digest);
      set("blessed_digest", digest);
      set("blessed_at_rev", ws.head);
      set("blessed_by", by);
      set("blessed_at", utcSeconds(ws.now));
      set("recorded", "self");
      set("anchors", newAnchors.anchors);
      set("blessed_copy", copyPath);
      set("flags", section.digest === digest ? [] : ["edited"]);
      patches.push({ path: copyPath, text: subject.text }, { path: `${copyPath}.anchors.json`, text: `${JSON.stringify(newAnchors.texts, null, 2)}\n` });
      measured = subject;
    } else if (section.blessed_digest) {
      if (restore) {
        const restored = reparseSection(checked, replaceBody(checked, await copyFor(checked, read)), ws.prefix);
        front.body = matter(restored.text).body;
        set("digest", restored.section.digest);
        set("flags", flags(restored.section, read));
      } else {
        set("digest", section.digest);
        set("flags", flags(section, read));
      }
    } else {
      set("state", action === "reject" ? "rejected" : "deferred");
      set("digest", section.digest);
      set("flags", []);
    }
    patches.push({ path: checked.doc.path, text: documentText(front) });
    const counts = await countDraft(checked, measured, ws);
    await persist(ws, patches, {
      doc: checked.doc.path, section: section.slug, by, at: utcSeconds(ws.now),
      minutes: Math.max(0, ws.now().valueOf() - ws.started) / 60_000, statements: counts,
    });
    return [];
  } catch (error) { return [findingFrom(error)]; }
}

function anchorsToShow(entry: SectionState, read: ReturnType<typeof reader>): string[] {
  const copy = entry.section.blessed_copy;
  let old: Record<string, string> = {};
  try {
    const raw = copy ? read(`${copy}.anchors.json`) : null;
    if (raw) old = JSON.parse(raw);
  } catch { /* Missing historical text is displayed as unavailable. */ }
  const changes = Object.entries(entry.section.anchors).flatMap(([citation, digest]) => {
    const next = anchorBlock(citation, read);
    if (next?.hash === digest) return [];
    return [blessText.before(citation, old?.[citation] ?? blessText.noLines), blessText.after(citation, next?.text ?? blessText.noLines)];
  });
  const blessed = copy ? read(copy) : null;
  return blessed === null ? changes : [blessText.textInForce, blessed.trimEnd(), ...changes];
}

export async function runBless(options: BlessOptions = {}, io: BlessIO = {}): Promise<{ result: BlessResult | null; findings: Finding[] }> {
  const input = io.stdin ?? process.stdin;
  if (!(io.terminal ?? ("isTTY" in input && input.isTTY === true))) return { result: null, findings: [diagnostic("TN-BLESS-NO-TTY")] };
  const directory = options.cwd ?? process.cwd();
  try {
    const cwd = (await git(["rev-parse", "--show-toplevel"], { cwd: directory })
      .catch(() => { throw diagnostic("TN-ENV-NOT-GIT", { path: directory }); })).trimEnd();
    const head = (await git(["rev-parse", "--verify", "HEAD^{commit}"], { cwd })
      .catch(() => { throw diagnostic("TN-ENV-NO-COMMIT"); })).trim();
    const policy = await loadPolicy({ cwd });
    const records = portable(policy.paths.records);
    const prefix = policy.specs.id_prefix;
    const now = io.now ?? (() => new Date());
    const ws: Workspace = { cwd, head, records, prefix, now, started: now().valueOf() };
    const read = reader(cwd);
    const load = async (relative: string) => {
      const filename = await confine(relative, cwd);
      const text = await readFile(filename, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      return text === null ? null : { filename, text, doc: parseDoc(relative, text, { prefix }) };
    };
    const raw = await readYaml(await confine("tenet.yaml", cwd)) as TenetYaml;
    const intent = raw.specs?.documents?.length ? null : await load(`${records}/intent.md`);
    const paths = [...new Set(policy.specs.documents.map((doc) => `${records}/${portable(doc.path)}`))];
    const docs = intent ? [intent] : (await Promise.all(paths.map(load))).filter((doc) => doc !== null);
    const selected = options.doc === undefined ? docs : docs.filter(({ doc }) =>
      doc.path === portable(options.doc ?? "") || doc.path === `${records}/${portable(options.doc ?? "")}` ||
      (doc.front?.tenet as { doc?: string } | undefined)?.doc === options.doc);
    const targets = selected.flatMap(({ doc }) => doc.sections.filter((section) => {
      if (!governing(section)) return false;
      if (options.section) return [section.slug, section.heading].includes(options.section);
      return section.state !== "blessed" || flags(section, read).length > 0;
    }).map(({ slug }) => ({ path: doc.path, slug })));
    if ((options.doc && !selected.length) || (options.section && !targets.length)) {
      return { result: null, findings: [diagnostic("TN-USAGE-BLESS", { command: "bless", detail: blessText.missingTarget })] };
    }
    const conflicts = selected.flatMap(({ doc }) => targetsConflict(doc).filter(({ id }) => {
      const conflict = doc.sections.flatMap((section) => section.conflicts).find((item) => item.id === id);
      return targets.some((target) =>
        target.path === doc.path && doc.sections.some((section) => section.slug === target.slug && conflict && belongs(conflict, doc, section)));
    }));
    const result = await blessSession({
      owners: policy.owners?.length ? policy.owners.map(({ id }) => id) :
        [...new Set(targets.flatMap(({ path }) => ownersFor(path)))],
      targets,
      conflicts,
      read: async (file, selector) => {
        const entry = await load(file);
        const section = entry?.doc.sections.find(({ slug, heading }) => slug === selector || heading === selector);
        return entry && section ? { ...entry, section } : null;
      },
      edit: (entry) => (io.edit ?? editInTerminal)(entry.filename, cwd),
      resolveConflict: async (entry, conflict, resolution) => {
        await unchanged(entry);
        const lines = normalize(entry.text).split("\n");
        const index = (itemLine(conflict) ?? 0) - 1;
        const source = lines[index];
        if (!source) return;
        lines[index] = `${source.replace(/^(\s*[-*+]\s+)\[[ xX]\]/, "$1[x]").replace(/(?:^|[;|\s])resolution:\s*.*$/, "").replace(/[;|\s]*$/, "")} | resolution: ${resolution}`;
        await writeAtomic(entry.filename, lines.join("\n"));
      },
      commit: (entry, action, by, restore, adopt) => writeAction(ws, entry, action, by, restore, adopt),
      flags: (entry) => flags(entry.section, read),
      showAnchors: async (entry) => anchorsToShow(entry, read),
    }, io);
    if (result.result && result.result.blessed + result.result.confirmed + result.result.rejected + result.result.deferred > 0) {
      const output = io.stdout ?? process.stdout;
      output.write(`\n${blessText.summary(result.result)}\n${blessText.commit(`"${records}"`)}\n`);
    }
    return result;
  } catch (error) {
    return { result: null, findings: [findingFrom(error)] };
  }
}

export async function bless(options: BlessOptions = {}, io: BlessIO = {}): Promise<BlessResult> {
  const result = await runBless(options, io);
  const failure = result.findings.find(({ severity }) => severity === "error");
  if (failure) throw failure;
  if (!result.result) throw new Error("Blessing session returned no result");
  return result.result;
}

export { measures as measureStatements, reader as readCitationSource, matter as readSpecMatter, documentText as writeSpecMatter, governing as isGovernedSection };
