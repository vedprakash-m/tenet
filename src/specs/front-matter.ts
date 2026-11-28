import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { Document, isCollection, isMap, isNode, parseDocument, type YAMLMap } from "yaml";
import { confine } from "../core/fs.js";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";
import { validate } from "../core/schema.js";
import type { Assignment, Inventory } from "../types/generated.js";

export type SpecMatter = {
  body: string;
  bodyLine: number;
  source: string | null;
  yaml: ReturnType<typeof parseDocument> | null;
  data: unknown;
  problem: string | null;
};

export function readSpecMatter(text: string): SpecMatter {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  const empty = { body: normalized, bodyLine: 1, source: null, yaml: null, data: null };
  if (lines[0]?.trim() !== "---") return { ...empty, problem: null };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return { ...empty, problem: "the closing YAML delimiter is missing" };

  const body = lines.slice(end + 1).join("\n");
  const bodyLine = end + 2;
  const source = lines.slice(1, end).join("\n");
  const yaml = parseDocument(source, { merge: false, uniqueKeys: true });
  if (yaml.errors.length) return { body, bodyLine, source, yaml, data: null, problem: "the YAML could not be parsed" };
  try {
    return { body, bodyLine, source, yaml, data: yaml.toJS({ maxAliasCount: 100 }), problem: null };
  } catch {
    return { body, bodyLine, source, yaml, data: null, problem: "the YAML could not be read" };
  }
}

export function writeSpecMatter(yaml: Pick<Document, "toString">, body: string): string {
  return "---\n" + yaml.toString({ lineWidth: 0 }) + "---\n" + body;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function updateMap(doc: Document, map: YAMLMap, before: Record<string, unknown>, after: Record<string, unknown>): void {
  for (const key of Object.keys(before)) {
    if (!Object.hasOwn(after, key)) map.delete(key);
  }
  for (const [key, value] of Object.entries(after)) {
    if (isDeepStrictEqual(before[key], value)) continue;
    const node = map.get(key, true);
    if (isMap(node) && isRecord(before[key]) && isRecord(value)) {
      updateMap(doc, node, before[key], value);
    } else if (isCollection(node)) {
      const replacement = doc.createNode(value);
      if (isCollection(replacement) && node.flow !== undefined) replacement.flow = node.flow;
      map.set(key, replacement);
    } else {
      map.set(key, value);
    }
  }
}

type YamlEdit = { start: number; end: number; value: string };

function yamlEdits(
  before: unknown, after: unknown, oldNode: unknown, newNode: unknown, source: string, rendered: string,
): YamlEdit[] | null {
  if (isDeepStrictEqual(before, after)) return [];
  if (isMap(oldNode) && isMap(newNode) && isRecord(before) && isRecord(after) &&
    Object.keys(before).length === Object.keys(after).length &&
    Object.keys(before).every((key) => Object.hasOwn(after, key))) {
    const children = Object.keys(before).map((key) =>
      yamlEdits(before[key], after[key], oldNode.get(key, true), newNode.get(key, true), source, rendered));
    if (children.every((child) => child !== null)) return children.flat();
  }
  // A block collection needs its original indentation. Let the enclosing map
  // supply it when a scalar changes to a block or a block changes to a scalar.
  const oldBlock = isCollection(oldNode) && !oldNode.flow;
  const newBlock = isCollection(newNode) && !newNode.flow;
  const oldRange = isNode(oldNode) ? oldNode.range : undefined;
  const newRange = isNode(newNode) ? newNode.range : undefined;
  if (!oldRange || !newRange || oldBlock !== newBlock) return null;
  const [start, end] = oldRange;
  const [from, to] = newRange;
  let value = rendered.slice(from, to);
  if (oldBlock && value.includes("\n")) {
    const width = (text: string, offset: number) => offset - text.lastIndexOf("\n", offset - 1) - 1;
    const shift = width(source, start) - width(rendered, from);
    if (shift > 0) value = value.replace(/\n(?=.)/g, "\n" + " ".repeat(shift));
    else if (shift < 0) value = value.replace(new RegExp("\\n {" + -shift + "}", "g"), "\n");
  }
  return [{ start, end, value }];
}

export function repairSpecMatter(matter: SpecMatter, data: Record<string, unknown>, body: string): string {
  if (matter.source === null || !matter.yaml || !isRecord(matter.data) || !isMap(matter.yaml.contents)) {
    return writeSpecMatter(new Document(data), body);
  }
  if (isDeepStrictEqual(matter.data, data)) return "---\n" + matter.source + "\n---\n" + body;
  const doc = matter.yaml.clone();
  if (!isMap(doc.contents)) throw new Error("Expected a specification front-matter map.");
  updateMap(doc, doc.contents, matter.data, data);
  const rendered = doc.toString({ lineWidth: 0 }).trimEnd();
  const updated = parseDocument(rendered);
  const changes = yamlEdits(matter.data, data, matter.yaml.contents, updated.contents, matter.source, rendered);
  let source = changes === null ? rendered : matter.source;
  for (const { start, end, value } of (changes ?? []).sort((a, b) => b.start - a.start)) {
    source = source.slice(0, start) + value + source.slice(end);
  }
  return "---\n" + source + "\n---\n" + body;
}

const repairableRequired = /^\/(?:tenet(?:\/(?:spec|doc|level|version|owner))?|sections(?:\/[^/]+\/(?:state|digest|flags))?)$/;

type MatterValidation =
  | { finding: null; yaml: NonNullable<SpecMatter["yaml"]>; repairable: false; legacyBlessing: false }
  | { finding: Finding; repairable: boolean; legacyBlessing: boolean };

export function validateSpecMatter(file: string, matter: SpecMatter, commitDraft = false): MatterValidation {
  const commit = commitDraft ? " Commit the repaired draft before rerunning the card." : "";
  if (!matter.yaml && !matter.problem) {
    const code = "TN-SPEC-NO-FRONT";
    const words = message(code);
    return { finding: { ...fail(code, words.message, words.fix + commit), file }, repairable: true, legacyBlessing: false };
  }
  const errors = matter.problem
    ? [{ pointer: "/", keyword: "yaml", message: matter.problem }]
    : validate("spec-front-matter", matter.data, { propertyPointers: true }).errors.filter(({ keyword }) => keyword !== "if");
  if (!errors.length && matter.yaml) return { finding: null, yaml: matter.yaml, repairable: false, legacyBlessing: false };

  const repairable = errors.every(({ keyword, pointer }) => keyword === "required" && repairableRequired.test(pointer));
  const legacyBlessing = errors.length > 0 && errors.every(({ keyword, pointer }) =>
    keyword === "required" && /^\/sections\/[^/]+\/(?:blessed_digest|blessed_copy)$/.test(pointer));
  const details = errors.map(({ pointer, message: detail }) =>
    (pointer || "/") + " " + detail.replace("must be object", "must be a map")).join(" · ");
  const code = "TN-SCHEMA";
  const words = message(code, { path: file, schema: "spec-front-matter", pointer: details });
  const invalidMaps = errors.filter(({ pointer, keyword }) => keyword === "type" && (pointer === "/tenet" || pointer === "/sections"));
  let fix = "Correct the listed YAML fields using the specification front-matter format, then run `tenet fix`.";
  if (repairable) fix = "Run `tenet fix` to fill in the missing front matter.";
  else if (invalidMaps.length === errors.length) {
    fix = "Replace " + invalidMaps.map(({ pointer }) => pointer).join(" and ") + " with YAML maps, using `{}` for an empty map. Then run `tenet fix`.";
  }
  return { finding: { ...fail(code, words.message, fix + commit), file }, repairable, legacyBlessing };
}

const assignmentPath = ".tenet/onboard/assignment.json";
const inventoryPath = ".tenet/onboard/inventory.json";

async function onboardJson(cwd: string, filename: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(await confine(filename, cwd), "utf8")) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError || ["ENOENT", "ENOTDIR", "TN-PATH-ESCAPE"].includes(String((error as NodeJS.ErrnoException).code))) {
      return null;
    }
    throw error;
  }
}

export function isDraftOutput(filename: string, records: string): boolean {
  const root = records.replaceAll("\\", "/");
  return filename.startsWith(root + "/") && filename.endsWith(".md") &&
    !filename.startsWith(root + "/blessed/") && !filename.includes("\\") &&
    !filename.split("/").some((part) => !part || part === "." || part === "..");
}

export async function draftOutputPaths(cwd: string, records: string): Promise<string[]> {
  const assignment = await onboardJson(cwd, assignmentPath);
  if (!validate("assignment", assignment).ok) return [];
  const { output } = assignment as Assignment;
  return [...new Set(output.paths)].filter((filename) => isDraftOutput(filename, records));
}

export async function inventoryRevision(cwd: string): Promise<string | undefined> {
  const inventory = await onboardJson(cwd, inventoryPath);
  return validate("inventory", inventory).ok ? (inventory as Inventory).revision : undefined;
}
