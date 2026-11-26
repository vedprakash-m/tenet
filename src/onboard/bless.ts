import { spawn } from "node:child_process";
import { readFileSync, realpathSync } from "node:fs";
import { appendFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { isMap, parseDocument } from "yaml";
import { utcSeconds } from "../core/clock.js";
import { confine, writeAtomic } from "../core/fs.js";
import { git } from "../core/git.js";
import { readYaml } from "../core/yaml.js";
import { loadPolicy, ownersFor } from "../policy/index.js";
import type { TenetYaml } from "../types/generated.js";
import { anchorBlock, anchorRecordsFor, citationParts } from "../specs/anchors.js";
import { resolveCitations } from "../specs/citations.js";
import { flags } from "../specs/flags.js";
import { parseDoc, sectionLocation } from "../specs/parse.js";
import { sectionDigest } from "../specs/sections.js";
import { createInterface } from "node:readline";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";
import { isOpenSpecItem, itemLine, openItemsFor, type ConflictOrQuestion, type ParsedDoc, type SpecSection } from "../specs/parse.js";

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
  write?: typeof writeAtomic;
};
type Ask = (prompt: string) => Promise<string | null>;
type SectionState = { doc: ParsedDoc; section: SpecSection; text: string; filename: string };
type SessionState = {
  owners: string[];
  targets: Array<{ path: string; slug: string }>;
  conflicts: Array<{ path: string; id: string }>;
  records: string;
  read(path: string, slug: string): Promise<SectionState | null>;
  edit(state: SectionState): Promise<void>;
  resolve(state: SectionState, item: ConflictOrQuestion, field: "answer" | "resolution", value: string): Promise<void>;
  commit(state: SectionState, action: CompletedAction, by: string, restore: boolean, adopt: boolean, minutes: number): Promise<Finding[]>;
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
  contradiction: (ids: string) => `Does this choice contradict a drafted statement? Enter one of ${ids}, or type no > `,
  question: (id: string, text: string) => `Question ${id}: ${text}\n  1. Answer\n  2. Not a blocker\n  3. Skip section`,
  answer: "Write an answer > ",
  skipped: (heading: string, ids: string) => `Skipping ${heading} · open items: ${ids}`,
  revisit: "→ Run tenet bless when you’re ready to review the remaining sections.",
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
  summary: (count: number, total: number) => `Blessed ${count} of ${total} sections`,
  nothingBlessed: "Nothing is in force yet",
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

function sourceLine(text: string, line: number | null): string {
  return line === null ? "" : text.replaceAll("\r\n", "\n").split("\n")[line - 1] ?? "";
}

export function parseBlessDocument(file: string, text: string, prefix: string): ParsedDoc {
  return parseDoc(file, text, { prefix });
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

async function settleConflicts(state: SessionState, ask: Ask, write: (value: string) => void, findings: Finding[]): Promise<boolean> {
  for (const { path, id } of state.conflicts) {
    const source = await state.read(path, "conflicts");
    const conflict = source?.section.conflicts.find((item) => item.id === id);
    if (!source || !conflict || !isOpenSpecItem(conflict, "conflicts")) continue;
    write(blessText.conflict(id, conflict.text));
    const line = sourceLine(source.text, itemLine(conflict));
    const sections = source.doc.sections.filter((section) =>
      governing(section) && openItemsFor(source.doc, section, "conflicts").includes(conflict));
    const unresolved = () => diagnostic("TN-BLESS-OPEN-CONFLICT", { slug: sections[0]?.slug ?? "conflicts", ids: id });
    const alternatives = choices(line);
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
    if (!resolution) {
      findings.push({ ...unresolved(), severity: "warning" });
      continue;
    }
    const affected = /\(affects:\s*([^)]+)\)/i.exec(line)?.[1]?.split(",").map((entry) => entry.trim().toLowerCase());
    const items = sections.flatMap(statements).filter((item) => !affected || affected.includes(item.id.toLowerCase()));
    const answer = items.length ? await pick(
      ask, blessText.contradiction(items.map(({ id }) => id).join(", ")),
      ["no", ...items.map(({ id: itemId }) => itemId.toLowerCase())], write,
    ) : "no";
    if (answer === null) return false;
    if (answer !== "no") {
      const item = items.find(({ id: itemId }) => itemId.toLowerCase() === answer);
      if (item) write(blessText.editConflict(item.id));
      await state.edit(source);
      const updated = await state.read(path, "conflicts");
      const remaining = updated?.doc.sections.flatMap(statements).find((entry) => entry.id === item?.id);
      if (!updated || (remaining && cleanText(remaining.text) === cleanText(item?.text ?? ""))) {
        write(blessText.conflictUnchanged);
        findings.push(unresolved());
        continue;
      }
      const current = updated.section.conflicts.find((entry) => entry.id === id);
      if (current) await state.resolve(updated, current, "resolution", resolution);
    } else {
      await state.resolve(source, conflict, "resolution", resolution);
    }
  }
  return true;
}

async function settleQuestions(
  state: SessionState,
  initial: SectionState,
  ask: Ask,
  write: (value: string) => void,
): Promise<SectionState | "skip" | null> {
  let current = initial;
  while (true) {
    const question = openItemsFor(current.doc, current.section, "questions")[0];
    if (!question) return current;
    write(blessText.question(question.id, question.text));
    const choice = await pick(ask, "> ", ["1", "2", "3", "answer", "not a blocker", "skip section"], write);
    if (choice === null) return null;
    if (choice === "3" || choice === "skip section") {
      write(blessText.skipped(current.section.heading, question.id));
      return "skip";
    }
    let answer: string | null = "Not a blocker";
    if (choice === "1" || choice === "answer") {
      do {
        answer = await ask(blessText.answer);
        if (answer === null) return null;
      } while (!answer);
    }
    await state.resolve(current, question, "answer", answer);
    const updated = await state.read(current.doc.path, current.section.slug);
    if (!updated) return "skip";
    current = updated;
  }
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
  let changed = false;
  const editableState: SessionState = {
    ...state,
    resolve: async (entry, item, field, value) => {
      await state.resolve(entry, item, field, value);
      changed = true;
    },
    edit: async (entry: SectionState) => {
      if (!terminalClosed) lines.pause();
      try {
        await state.edit(entry);
        changed ||= await readFile(entry.filename, "utf8") !== entry.text;
      } finally { if (!terminalClosed) lines.resume(); }
    },
  };
  try {
    if (!state.owners.length) {
      findings.push(diagnostic("TN-SCHEMA", { path: "tenet.yaml", schema: "tenet-yaml", pointer: "/owners" }));
      return { result, findings };
    }
    const ownerOptions = state.owners.map((_, i) => String(i + 1));
    const onlyOwner = state.owners.length === 1;
    if (onlyOwner) ownerOptions.push("");
    const owner = await pick(ask, blessText.owner(state.owners.map((id, i) =>
      `${i + 1}. ${id}${onlyOwner ? " (Enter)" : ""}`).join("  ")), ownerOptions, write);
    const by = owner === null ? undefined : state.owners[Number(owner || "1") - 1];
    if (by && await settleConflicts(editableState, ask, write, findings)) {
      for (const target of state.targets) {
        const reviewStarted = now().valueOf();
        while (!interrupted) {
          const entry = await state.read(target.path, target.slug);
          if (!entry) break;
          const conflicts = openItemsFor(entry.doc, entry.section, "conflicts");
          if (conflicts.length) {
            write(blessText.skipped(entry.section.heading, conflicts.map(({ id }) => id).join(", ")));
            break;
          }
          const current = await settleQuestions(editableState, entry, ask, write);
          if (current === null) { interrupted = true; break; }
          if (current === "skip") break;
          const { section } = current;
          const flags = state.flags(current);
          if (section.text.trim()) write(section.text.trimEnd());
          const available: Action[] = flags.includes("sources-changed")
            ? ["bless", "confirm", "edit", "reject", "defer"] : ["bless", "edit", "reject", "defer"];
          const selected = await pick(ask, blessText.section(section.heading || section.slug, readingMinutes(section.text), available), [...available, "later"], write);
          if (selected === null) { interrupted = true; break; }
          if (selected === "edit") { await editableState.edit(current); continue; }
          const action = (selected === "later" ? "defer" : selected) as CompletedAction;
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
          const minutes = Math.max(0, now().valueOf() - reviewStarted) / 60_000;
          const errors = await state.commit(current, action, by, restore, adopt, minutes);
          findings.push(...errors);
          if (!errors.some((finding) => finding.severity === "error")) {
            const key = ({ bless: "blessed", confirm: "confirmed", reject: "rejected", defer: "deferred" } as const)[action];
            result[key]++;
            changed = true;
          }
          break;
        }
        if (interrupted) break;
      }
    }
  } catch (error) {
    findings.push(findingFrom(error));
  } finally {
    lines.close();
    if (input === process.stdin) process.off("SIGINT", stop);
    result.minutes = Math.max(0, now().valueOf() - started) / 60_000;
    const blessed = result.blessed + result.confirmed;
    write(`\n${blessText.summary(blessed, state.targets.length)}`);
    if (blessed === 0) write(blessText.nothingBlessed);
    write(changed ? blessText.commit(`"${state.records}"`) : blessText.revisit);
  }
  return { result, findings };
}

type Front = ReturnType<typeof matter>;
type Counts = { drafted: number | null; kept: number | null; edited: number | null; adopted: number | null; added: number | null };
type Patch = { path: string; text: string; expected?: string };
type Workspace = { cwd: string; head: string; records: string; prefix: string; now: () => Date; write: typeof writeAtomic };
const normalize = (text: string) => text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
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
    .filter((item) => isOpenSpecItem(item, "conflicts"))
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

function bumpVersion(version: unknown): string {
  const text = typeof version === "string" && version ? version : "0.1";
  if (!/^\d+$/.test(text) && !/\.\d+$/.test(text)) return `${text}.1`;
  return text.replace(/\d+$/, (last) => String(BigInt(last) + 1n));
}

async function copyFor(entry: SectionState, read: ReturnType<typeof reader>): Promise<string> {
  const copy = entry.section.blessed_copy ? read(entry.section.blessed_copy) : null;
  if (copy === null || sectionDigest(copy) !== entry.section.blessed_digest) {
    const heading = sectionLocation(entry.section).heading;
    throw { ...diagnostic("TN-SPEC-BLESSED-COPY", { slug: entry.section.slug }), file: entry.doc.path, line: heading || null };
  }
  return copy;
}

async function blessedCopyPath(ws: Workspace, document: string, slug: string): Promise<string> {
  const encode = (file: string) => file.replaceAll("/", "__");
  // Windows resolves paths case-insensitively while record paths retain their original case.
  const compare = (file: string) => process.platform === "win32" ? file.toLowerCase() : file;
  const encoded = encode(document);
  const comparison = compare(encoded);
  const root = await confine(ws.records, ws.cwd);
  async function collides(directory: string, relative: string): Promise<boolean> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (relative === ws.records && ["blessed", "holdout"].includes(entry.name.toLowerCase())) continue;
      const candidate = `${relative}/${entry.name}`;
      const key = compare(encode(candidate));
      if (entry.isDirectory() && comparison.startsWith(`${key}__`)) {
        if (await collides(path.join(directory, entry.name), candidate)) return true;
      } else if (entry.isFile() && key === comparison && compare(candidate) !== compare(document)) {
        return true;
      }
    }
    return false;
  }
  if (await collides(root, ws.records)) {
    throw { ...diagnostic("TN-SCHEMA", { path: document, schema: "spec-front-matter", pointer: "/sections" }), file: document };
  }
  const relative = `${ws.records}/blessed/${encoded}/${slug}.md`;
  // An existing symlink inside blessed must not point elsewhere in the repository.
  await confine(relative, ws.cwd);
  const blessedRoot = await confine(`${ws.records}/blessed`, ws.cwd);
  await mkdir(blessedRoot, { recursive: true });
  const copy = `${encoded}/${slug}.md`;
  await confine(copy, blessedRoot);
  await confine(`${copy}.anchors.json`, blessedRoot);
  return relative;
}

async function optionalBytes(filename: string): Promise<Buffer | null> {
  return readFile(filename).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
}

async function persist(ws: Workspace, patches: Patch[], log: object): Promise<void> {
  const logfile = await confine(`${ws.records}/blessed/log.jsonl`, ws.cwd);
  const saved = new Map<string, Buffer | null>();
  try {
    for (const patch of patches) {
      const filename = await confine(patch.path, ws.cwd);
      const old = await optionalBytes(filename);
      if (patch.expected !== undefined && old?.toString("utf8") !== patch.expected) {
        throw diagnostic("TN-SUBJ-DIRTY", { command: "bless" });
      }
      await ws.write(filename, patch.text);
      saved.set(filename, old);
    }
    await mkdir(path.dirname(logfile), { recursive: true });
    saved.set(logfile, await optionalBytes(logfile));
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

async function writeAction(ws: Workspace, entry: SectionState, action: CompletedAction, by: string, restore: boolean, adopt: boolean, minutes: number) {
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
      const newAnchors = anchorRecordsFor(subject, read, ws.head);
      const copyPath = await blessedCopyPath(ws, checked.doc.path, section.slug);
      const digest = sectionDigest(subject.text);
      if (action === "bless" && section.blessed_digest && section.blessed_digest !== digest) {
        front.yaml.setIn(["tenet", "version"], bumpVersion(front.yaml.getIn(["tenet", "version"])));
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
      patches.push({ path: copyPath, text: normalize(subject.text) }, { path: `${copyPath}.anchors.json`, text: `${JSON.stringify(newAnchors.records, null, 2)}\n` });
      measured = subject;
    } else if (section.blessed_digest) {
      if (restore) {
        const restored = reparseSection(checked, replaceBody(checked, await copyFor(checked, read)), ws.prefix);
        front.body = matter(restored.text).body;
        set("digest", restored.section.digest);
        set("flags", flags(restored.section, read));
        measured = restored.section;
      } else {
        set("digest", section.digest);
        set("flags", flags(section, read));
      }
    } else {
      set("state", action === "reject" ? "rejected" : "deferred");
      set("digest", section.digest);
      set("flags", []);
    }
    patches.push({ path: checked.doc.path, text: documentText(front), expected: entry.text });
    const counts = await countDraft(checked, measured, ws);
    await persist(ws, patches, {
      doc: checked.doc.path, section: section.slug, action, by, at: utcSeconds(ws.now),
      minutes, statements: counts,
    });
    return [];
  } catch (error) { return [findingFrom(error)]; }
}

async function historicalRange(
  cwd: string,
  citation: string,
  start: number | null,
  end: number | null,
  revision: string | null,
): Promise<string | null> {
  const parsed = citationParts(citation);
  if (!parsed || start === null || end === null || revision === null) return null;
  try {
    const source = await git(["show", `${revision}:${parsed.path}`], { cwd });
    const lines = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
    if (lines.at(-1) === "") lines.pop();
    return lines.slice(start - 1, end).join("\n");
  } catch {
    return null;
  }
}

async function anchorsToShow(
  cwd: string,
  entry: SectionState,
  read: ReturnType<typeof reader>,
): Promise<string[]> {
  const copy = entry.section.blessed_copy;
  let old: Record<string, unknown> = {};
  try {
    const raw = copy ? read(`${copy}.anchors.json`) : null;
    if (raw) old = JSON.parse(raw);
  } catch { /* Missing historical text is displayed as unavailable. */ }
  const changes: string[] = [];
  for (const [citation, digest] of Object.entries(entry.section.anchors)) {
    const next = anchorBlock(citation, read);
    if (next?.hash === digest) continue;
    const stored = old[citation];
    let before = typeof stored === "string" ? stored : blessText.noLines;
    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      const record = stored as {
        start?: unknown;
        end?: unknown;
        blessed_at_rev?: unknown;
      };
      const start = typeof record.start === "number" ? record.start : null;
      const end = typeof record.end === "number" ? record.end : null;
      const revision = typeof record.blessed_at_rev === "string" ? record.blessed_at_rev : null;
      before = await historicalRange(cwd, citation, start, end, revision) ??
        (start !== null && end !== null
          ? `${citationParts(citation)?.path ?? citation}:${start}-${end}`
          : blessText.noLines);
    }
    changes.push(
      blessText.before(citation, before),
      blessText.after(citation, next?.text ?? blessText.noLines),
    );
  }
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
    const ws: Workspace = { cwd, head, records, prefix, now, write: io.write ?? writeAtomic };
    const read = reader(cwd);
    const load = async (relative: string) => {
      const filename = await confine(relative, cwd);
      const text = await readFile(filename, "utf8").catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      return text === null ? null : { filename, text, doc: parseBlessDocument(relative, text, prefix) };
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
      return targets.some((target) => target.path === doc.path && doc.sections.some((section) =>
        section.slug === target.slug && openItemsFor(doc, section, "conflicts").some((item) => item.id === id)));
    }));
    return await blessSession({
      owners: policy.owners?.length ? policy.owners.map(({ id }) => id) :
        [...new Set(targets.flatMap(({ path }) => ownersFor(path)))],
      targets,
      conflicts,
      records,
      read: async (file, selector) => {
        const entry = await load(file);
        const section = entry?.doc.sections.find(({ slug, heading }) => slug === selector || heading === selector);
        return entry && section ? { ...entry, section } : null;
      },
      edit: (entry) => (io.edit ?? editInTerminal)(entry.filename, cwd),
      resolve: async (entry, item, field, value) => {
        await unchanged(entry);
        const lines = normalize(entry.text).split("\n");
        const index = (itemLine(item) ?? 0) - 1;
        const source = lines[index];
        if (!source) return;
        const checked = source.replace(/^(\s*[-*+]\s+)(?:\[[ xX]\]\s+)?/, "$1[x] ");
        const prompt = checked.replace(/(?:^|[;|\s])(?:resolution|answer):\s*.*$/i, "").replace(/[;|\s]*$/, "");
        lines[index] = `${prompt} | ${field}: ${value}`;
        await writeAtomic(entry.filename, lines.join("\n"));
      },
      commit: (entry, action, by, restore, adopt, minutes) => writeAction(ws, entry, action, by, restore, adopt, minutes),
      flags: (entry) => flags(entry.section, read),
      showAnchors: async (entry) => anchorsToShow(cwd, entry, read),
    }, io);
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
