import { catFileBatch, git } from "../core/git.js";
import { jcs } from "../core/hash.js";
import { parseDoc, type ParsedDoc, type Requirement } from "./parse.js";

export type Delta = {
  doc: string;
  added: string[];
  modified: string[];
  removed: string[];
};

async function markdownAt(ref: string, cwd: string): Promise<Map<string, ParsedDoc>> {
  const listing = await git(["ls-tree", "-r", "-z", "--name-only", ref], { cwd });
  const paths = listing.split("\0").filter((filename) => filename.endsWith(".md"));
  const blobs = await catFileBatch(ref, paths, { cwd });
  const result = new Map<string, ParsedDoc>();
  for (const [filename, contents] of blobs) {
    const parsed = parseDoc(filename, contents.toString("utf8"));
    if (parsed.front?.tenet !== undefined) result.set(filename, parsed);
  }
  return result;
}

function documentName(path: string, doc: ParsedDoc): string {
  const tenet = doc.front?.tenet;
  if (tenet !== null && typeof tenet === "object") {
    const value = (tenet as Record<string, unknown>).doc;
    if (typeof value === "string" && value) return value;
  }
  return path;
}

function items(doc: ParsedDoc): Map<string, Requirement> {
  const result = new Map<string, Requirement>();
  for (const section of doc.sections) {
    for (const item of [...section.requirements, ...section.vision_items]) result.set(item.id, item);
  }
  return result;
}

function groupedItems(docs: Map<string, ParsedDoc>): Map<string, Map<string, Requirement>> {
  const grouped = new Map<string, Map<string, Requirement>>();
  for (const [path, doc] of docs) {
    const name = documentName(path, doc);
    const values = grouped.get(name) ?? new Map<string, Requirement>();
    for (const [id, item] of items(doc)) {
      if (values.has(id)) {
        throw new Error(`duplicate specification ID ${id} in document ${name}`);
      }
      values.set(id, item);
    }
    grouped.set(name, values);
  }
  return grouped;
}

function numericId(left: string, right: string): number {
  const leftNumber = /(\d+)$/.exec(left)?.[1];
  const rightNumber = /(\d+)$/.exec(right)?.[1];
  const leftNumeric = leftNumber === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(leftNumber, 10);
  const rightNumeric = rightNumber === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(rightNumber, 10);
  return leftNumeric - rightNumeric || (left < right ? -1 : left > right ? 1 : 0);
}

function delta(
  name: string,
  oldItems: Map<string, Requirement> = new Map(),
  newItems: Map<string, Requirement> = new Map(),
): Delta | null {
  const added: string[] = [];
  const modified: string[] = [];
  const removed: string[] = [];
  for (const [id, item] of newItems) {
    const previous = oldItems.get(id);
    if (!previous) added.push(id);
    else if (jcs(item) !== jcs(previous)) modified.push(id);
  }
  for (const id of oldItems.keys()) if (!newItems.has(id)) removed.push(id);
  added.sort(numericId);
  modified.sort(numericId);
  removed.sort(numericId);
  if (added.length === 0 && modified.length === 0 && removed.length === 0) return null;
  return {
    doc: name,
    added,
    modified,
    removed,
  };
}

export async function deltas(
  base: string,
  head: string,
  options: { cwd?: string } = {},
): Promise<Delta[]> {
  const cwd = options.cwd ?? process.cwd();
  const [before, after] = await Promise.all([markdownAt(base, cwd), markdownAt(head, cwd)]);
  const beforeItems = groupedItems(before);
  const afterItems = groupedItems(after);
  const paths = [...new Set([
    ...beforeItems.keys(),
    ...afterItems.keys(),
  ])];
  return paths.flatMap((name) => {
    const item = delta(name, beforeItems.get(name), afterItems.get(name));
    return item ? [item] : [];
  }).sort((left, right) => left.doc < right.doc ? -1 : left.doc > right.doc ? 1 : 0);
}
