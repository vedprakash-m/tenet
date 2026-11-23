import { catFileBatch, git } from "../core/git.js";
import { jcs } from "../core/hash.js";
import {
  anchorBlock,
  citationParts,
  docSection,
} from "./anchors.js";
import { itemLine, parseDoc, type ParsedDoc, type Requirement, type SpecSection } from "./parse.js";

type Reason = "implements" | "cited-code-changed" | "text-changed" | "same-area";
export type Touched = { id: string; why: Reason };
type Hunk = {
  oldPath: string | null;
  newPath: string | null;
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
};
type FileChange = { status: string; before?: string; after?: string };
type LocatedRequirement = {
  id: string;
  path: string;
  requirement: Requirement;
  section: SpecSection;
  doc: ParsedDoc;
};
type Candidate = {
  id: string;
  path: string;
  requirement: Requirement;
  section: SpecSection;
  doc: ParsedDoc;
  base?: LocatedRequirement;
  head?: LocatedRequirement;
};

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function numericOrder(left: string, right: string): number {
  const leftValue = /(\d+)$/.exec(left);
  const rightValue = /(\d+)$/.exec(right);
  const leftNumber = leftValue ? Number.parseInt(leftValue[1] ?? "0", 10) : Number.POSITIVE_INFINITY;
  const rightNumber = rightValue ? Number.parseInt(rightValue[1] ?? "0", 10) : Number.POSITIVE_INFINITY;
  return leftNumber - rightNumber || (left < right ? -1 : left > right ? 1 : 0);
}

async function allFiles(ref: string, cwd: string): Promise<string[]> {
  return (await git(["ls-tree", "-r", "-z", "--name-only", ref], { cwd })).split("\0").filter(Boolean);
}

async function snapshots(
  ref: string,
  cwd: string,
): Promise<{ files: Map<string, string>; docs: Map<string, ParsedDoc> }> {
  const paths = await allFiles(ref, cwd);
  const blobs = await catFileBatch(ref, paths, { cwd });
  const files = new Map<string, string>();
  const docs = new Map<string, ParsedDoc>();
  for (const [filename, value] of blobs) {
    const text = value.toString("utf8");
    files.set(filename, text);
    if (filename.endsWith(".md")) {
      const doc = parseDoc(filename, text);
      const tenet = doc.front?.tenet;
      if (
        tenet !== null &&
        typeof tenet === "object" &&
        !Array.isArray(tenet) &&
        (tenet as Record<string, unknown>).spec !== undefined
      ) docs.set(filename, doc);
    }
  }
  return { files, docs };
}

async function fileChanges(base: string, head: string, cwd: string): Promise<FileChange[]> {
  const fields = (await git(["diff", "--name-status", "-z", "-M", `${base}..${head}`], { cwd })).split("\0");
  const result: FileChange[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index] ?? "";
    if (!status) continue;
    if (status.startsWith("R")) {
      const before = fields[index + 1];
      const after = fields[index + 2];
      if (before && after) result.push({ status, before: portable(before), after: portable(after) });
      index += 2;
    } else {
      const filename = fields[index + 1];
      if (!filename) continue;
      result.push({
        status,
        ...(status.startsWith("A") ? { after: portable(filename) } : { before: portable(filename) }),
        ...(status.startsWith("A") ? {} : status.startsWith("D") ? {} : { after: portable(filename) }),
      });
      index += 1;
    }
  }
  return result;
}

async function diffHunks(base: string, head: string, cwd: string): Promise<Hunk[]> {
  const output = await git(
    ["diff", "--unified=0", "--no-color", "-M", "--no-prefix", `${base}..${head}`],
    { cwd },
  );
  const hunks: Hunk[] = [];
  let oldPath: string | null = null;
  let newPath: string | null = null;
  for (const line of output.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith("--- ")) {
      oldPath = line.slice(4) === "/dev/null" ? null : portable(line.slice(4));
      continue;
    }
    if (line.startsWith("+++ ")) {
      newPath = line.slice(4) === "/dev/null" ? null : portable(line.slice(4));
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) hunks.push({
      oldPath,
      newPath,
      oldStart: Number.parseInt(hunk[1] ?? "0", 10),
      oldCount: Number.parseInt(hunk[2] ?? "1", 10),
      newStart: Number.parseInt(hunk[3] ?? "0", 10),
      newCount: Number.parseInt(hunk[4] ?? "1", 10),
    });
  }
  return hunks;
}

function requirements(docs: Map<string, ParsedDoc>, blessedOnly: boolean): LocatedRequirement[] {
  const result: LocatedRequirement[] = [];
  for (const [path, doc] of docs) {
    for (const section of doc.sections) {
      if (blessedOnly && section.state !== "blessed") continue;
      for (const requirement of [...section.requirements, ...section.vision_items]) {
        result.push({ id: requirement.id, path, requirement, section, doc });
      }
    }
  }
  return result;
}

function byId(items: LocatedRequirement[]): Map<string, LocatedRequirement> {
  const result = new Map<string, LocatedRequirement>();
  for (const item of items.sort((left, right) =>
    numericOrder(left.id, right.id) ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  )) if (!result.has(item.id)) result.set(item.id, item);
  return result;
}

function overlaps(start: number, end: number, hunk: Hunk, oldSide: boolean): boolean {
  const hunkStart = oldSide ? hunk.oldStart : hunk.newStart;
  const count = oldSide ? hunk.oldCount : hunk.newCount;
  if (count > 0) return hunkStart <= end && hunkStart + count - 1 >= start;
  return start <= hunkStart && hunkStart < end;
}

function changedPath(path: string, changes: FileChange[]): FileChange | undefined {
  return changes.find((change) => change.before === path || change.after === path);
}

function citedCodeChanged(
  item: LocatedRequirement,
  baseFiles: Map<string, string>,
  headFiles: Map<string, string>,
  changes: FileChange[],
  hunks: Hunk[],
): boolean {
  for (const cite of item.requirement.cites) {
    const parsed = citationParts(cite);
    if (!parsed) continue;
    const change = changedPath(parsed.path, changes);
    if (change?.status.startsWith("D") || change?.status.startsWith("R")) return true;
    if (!baseFiles.has(parsed.path)) continue;
    if (parsed.kind === "path") {
      if (hunks.some((hunk) =>
        hunk.oldPath === parsed.path && overlaps(parsed.start, parsed.end, hunk, true)
      )) return true;
    } else if (parsed.kind === "test") {
      const block = anchorBlock(cite, (filename) => baseFiles.get(filename) ?? null);
      if (block && hunks.some((hunk) =>
        hunk.oldPath === parsed.path && overlaps(block.start, block.end, hunk, true)
      )) return true;
    } else {
      const baseText = baseFiles.get(parsed.path);
      const headText = headFiles.get(parsed.path);
      if (!baseText) continue;
      if (!headText) return true;
      const before = docSection(parsed.path, baseText, parsed.slug);
      const after = docSection(parsed.path, headText, parsed.slug);
      if (!before || !after || before.section.digest !== after.section.digest) return true;
      if (hunks.some((hunk) =>
        hunk.oldPath === parsed.path &&
        overlaps(before.start, before.end, hunk, true)
      )) return true;
    }
  }
  return false;
}

function textChanged(
  base: LocatedRequirement,
  head: LocatedRequirement | undefined,
  hunks: Hunk[],
): boolean {
  if (head?.section.state !== "blessed") return true;
  if (jcs(base.requirement) !== jcs(head.requirement)) return true;
  if (base.section.digest !== head.section.digest) return true;
  const line = itemLine(head.requirement);
  return line !== null && hunks.some((hunk) =>
    hunk.newPath === head.path && overlaps(line, line, hunk, false)
  );
}

function codeownersAtHead(files: Map<string, string>): string | null {
  for (const filename of [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]) {
    const value = files.get(filename);
    if (value !== undefined) return value;
  }
  return null;
}

function globRegex(pattern: string): RegExp {
  let source = pattern.startsWith("/") ? pattern.slice(1) : pattern;
  const directoryPattern = source.endsWith("/");
  if (directoryPattern) source += "**";
  const anchored = pattern.startsWith("/") || source.includes("/");
  let output = "";
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index] ?? "";
    if (character === "*") {
      if (source[index + 1] === "*") {
        index += 1;
        if (source[index + 1] === "/") {
          index += 1;
          output += "(?:.*/)?";
        } else {
          output += ".*";
        }
      } else output += "[^/]*";
    } else if (character === "?") output += "[^/]";
    else output += character.replace(/[\\^$+?.()|[\]{}]/g, "\\$&");
  }
  return new RegExp(`${anchored ? "^" : "(?:^|/)"}${output}$`);
}

function codeownerArea(filename: string, contents: string | null): string | null {
  if (contents === null) return null;
  let selected: string | null = null;
  for (const raw of contents.replaceAll("\r\n", "\n").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const cells = line.split(/\s+/);
    const pattern = cells[0];
    if (!pattern || cells.length < 2) continue;
    if (globRegex(pattern).test(filename)) selected = pattern;
  }
  return selected === null ? null : `codeowners:${selected}`;
}

function fallbackArea(filename: string): string {
  const slash = filename.indexOf("/");
  return slash < 0 ? "dir:." : `dir:${filename.slice(0, slash)}`;
}

function areaFor(filename: string, codeowners: string | null): string {
  return codeownerArea(filename, codeowners) ?? fallbackArea(filename);
}

function sameArea(
  item: LocatedRequirement,
  changed: FileChange[],
  codeowners: string | null,
): boolean {
  const changedAreas = new Set(changed.flatMap((change) => {
    const filename = change.after ?? change.before;
    return filename ? [areaFor(filename, codeowners)] : [];
  }));
  return item.requirement.cites.some((cite) => {
    const parsed = citationParts(cite);
    return parsed !== null && changedAreas.has(areaFor(parsed.path, codeowners));
  });
}

export async function touched(
  base: string,
  head: string,
  implementsIds: string[],
  options: { cwd?: string; codeowners_path?: string } = {},
): Promise<Touched[]> {
  const cwd = options.cwd ?? process.cwd();
  const [baseState, headState, changes, hunks] = await Promise.all([
    snapshots(base, cwd),
    snapshots(head, cwd),
    fileChanges(base, head, cwd),
    diffHunks(base, head, cwd),
  ]);
  const baseById = byId(requirements(baseState.docs, true));
  const headById = byId(requirements(headState.docs, true));
  const allIds = [...new Set([...baseById.keys(), ...headById.keys()])];
  const candidates = new Map<string, Candidate>();
  for (const id of allIds) {
    const baseItem = baseById.get(id);
    const headItem = headById.get(id);
    const item = headItem ?? baseItem;
    if (!item) continue;
    candidates.set(id, {
      id,
      path: item.path,
      requirement: item.requirement,
      section: item.section,
      doc: item.doc,
      ...(baseItem ? { base: baseItem } : {}),
      ...(headItem ? { head: headItem } : {}),
    });
  }
  const implemented = new Set(implementsIds);
  const reasons = new Map<string, Reason>();
  for (const [id, candidate] of candidates) {
    if (implemented.has(id) && (candidate.head || !headState.docs.has(candidate.path))) {
      reasons.set(id, "implements");
      continue;
    }
    if (
      candidate.base &&
      citedCodeChanged(candidate.base, baseState.files, headState.files, changes, hunks)
    ) {
      reasons.set(id, "cited-code-changed");
      continue;
    }
    if (
      candidate.base &&
      textChanged(candidate.base, candidate.head, hunks)
    ) reasons.set(id, "text-changed");
  }
  const codeowners = options.codeowners_path === undefined
    ? codeownersAtHead(headState.files)
    : headState.files.get(portable(options.codeowners_path)) ?? null;
  const same = [...candidates.values()]
    .filter((candidate) => !reasons.has(candidate.id))
    .filter((candidate) => {
      const item = candidate.head ?? candidate.base;
      return item !== undefined && sameArea(item, changes, codeowners);
    })
    .sort((left, right) => numericOrder(left.id, right.id))
    .slice(0, 10);
  for (const candidate of same) reasons.set(candidate.id, "same-area");
  return [...reasons]
    .map(([id, why]) => ({ id, why }))
    .sort((left, right) => numericOrder(left.id, right.id));
}
