import { readFile } from "node:fs/promises";
import { parseDocument } from "yaml";
import { confine } from "../core/fs.js";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";
import { validate } from "../core/schema.js";
import type { Assignment, Inventory } from "../types/generated.js";

export type SpecMatter = {
  body: string;
  bodyLine: number;
  yaml: ReturnType<typeof parseDocument> | null;
  data: unknown;
  problem: string | null;
};

export function readSpecMatter(text: string): SpecMatter {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  const empty = { body: normalized, bodyLine: 1, yaml: null, data: null };
  if (lines[0]?.trim() !== "---") return { ...empty, problem: null };
  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end < 0) return { ...empty, problem: "the closing YAML delimiter is missing" };

  const body = lines.slice(end + 1).join("\n");
  const bodyLine = end + 2;
  const yaml = parseDocument(lines.slice(1, end).join("\n"), { merge: false, uniqueKeys: true });
  if (yaml.errors.length) return { body, bodyLine, yaml, data: null, problem: "the YAML could not be parsed" };
  try {
    return { body, bodyLine, yaml, data: yaml.toJS({ maxAliasCount: 100 }), problem: null };
  } catch {
    return { body, bodyLine, yaml, data: null, problem: "the YAML could not be read" };
  }
}

export function writeSpecMatter(yaml: NonNullable<SpecMatter["yaml"]>, body: string): string {
  return "---\n" + yaml.toString({ lineWidth: 0 }) + "---\n" + body;
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
