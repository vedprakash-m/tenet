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

function numericId(left: string, right: string): number {
  const leftNumber = /(\d+)$/.exec(left)?.[1];
  const rightNumber = /(\d+)$/.exec(right)?.[1];
  const leftNumeric = leftNumber === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(leftNumber, 10);
  const rightNumeric = rightNumber === undefined ? Number.POSITIVE_INFINITY : Number.parseInt(rightNumber, 10);
  return leftNumeric - rightNumeric || (left < right ? -1 : left > right ? 1 : 0);
}

function delta(path: string, before: ParsedDoc | undefined, after: ParsedDoc | undefined): Delta | null {
  if (!before && !after) return null;
  const oldItems = before ? items(before) : new Map<string, Requirement>();
  const newItems = after ? items(after) : new Map<string, Requirement>();
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
    doc: after ? documentName(path, after) : before ? documentName(path, before) : path,
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
  const key = (docs: Map<string, ParsedDoc>, path: string) => {
    const doc = docs.get(path);
    if (!doc) throw new Error(`missing parsed document: ${path}`);
    return documentName(path, doc);
  };
  const paths = [...new Set([
    ...[...before.keys()].map((path) => key(before, path)),
    ...[...after.keys()].map((path) => key(after, path)),
  ])];
  return paths.flatMap((name) => {
    const beforeEntry = [...before].find(([path, doc]) => documentName(path, doc) === name);
    const afterEntry = [...after].find(([path, doc]) => documentName(path, doc) === name);
    const path = afterEntry?.[0] ?? beforeEntry?.[0] ?? name;
    const item = delta(path, beforeEntry?.[1], afterEntry?.[1]);
    return item ? [item] : [];
  }).sort((left, right) => left.doc < right.doc ? -1 : left.doc > right.doc ? 1 : 0);
}
