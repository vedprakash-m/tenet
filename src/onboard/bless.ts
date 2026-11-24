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
      menu.forEach((item, index) => write(`  ${index + 1}. ${item}`));
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
      lines.pause();
      try { await state.edit(entry); }
      finally { lines.resume(); }
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
            const approve = await pick(ask, "Confirm these source changes? [y/N] ", ["y", "n", ""], write);
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
