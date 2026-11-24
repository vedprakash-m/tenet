import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import type { Finding } from "../types/generated.js";
import { itemLine, parseDoc, type ParsedDoc } from "./parse.js";

type LadderOptions = { cwd?: string; specs_dir?: string; files?: string[] };
export type LadderEntry = { path: string; level: string | null; doc: ParsedDoc };

function portable(value: string): string {
  return value.replaceAll("\\", "/");
}

function relative(root: string, filename: string): string {
  return portable(path.relative(root, filename));
}

async function walk(root: string, skipRoot: boolean): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (
      skipRoot &&
      (entry.name === ".git" ||
        entry.name === ".tenet" ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build")
    ) continue;
    const filename = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(filename, skipRoot));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(filename);
  }
  return files;
}

function levelOrder(level: string | null): number {
  if (level === null) return 5;
  return /^(L[0-4])$/.test(level) ? Number(level.slice(1)) : 5;
}

function reportProjectDuplicates(entries: LadderEntry[]): void {
  const seen = new Map<string, { path: string; line: number | null }>();
  for (const entry of entries) {
    for (const section of entry.doc.sections) {
      const items = [
        ...section.requirements,
        ...section.vision_items,
        ...section.conflicts,
        ...section.questions,
      ];
      for (const item of items) {
        if (seen.has(item.id)) {
          const problem: Finding = {
            code: "TN-SPEC-DUP-ID",
            severity: "error",
            rule: null,
            file: entry.path,
            line: itemLine(item),
            message: `Duplicate specification ID ${item.id}.`,
            fix: `Run \`tenet fix\` to assign a new ID, or remove the duplicate ${item.id} item.`,
          };
          entry.doc.problems.push(problem);
        } else {
          seen.set(item.id, { path: entry.path, line: itemLine(item) });
        }
      }
    }
  }
}

export async function ladder(options: LadderOptions = {}): Promise<LadderEntry[]> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const root = options.specs_dir === undefined
    ? cwd
    : path.resolve(cwd, options.specs_dir);
  let filenames: string[];
  if (options.files !== undefined) {
    filenames = options.files.map((filename) => path.isAbsolute(filename) ? filename : path.resolve(cwd, filename));
  } else if (options.specs_dir !== undefined) {
    filenames = await walk(root, false);
  } else {
    filenames = await walk(root, true);
  }
  const result: LadderEntry[] = [];
  for (const filename of filenames) {
    try {
      const stat = await lstat(filename);
      if (!stat.isFile() || !filename.endsWith(".md")) continue;
      const text = await readFile(filename, "utf8");
      const document = parseDoc(relative(cwd, filename), text);
      if (!document.front || typeof document.front.tenet !== "object") continue;
      const tenet = document.front.tenet as Record<string, unknown>;
      if (tenet.spec === undefined) continue;
      const level = typeof tenet.level === "string" ? tenet.level : null;
      result.push({ path: relative(cwd, filename), level, doc: document });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }
  const sorted = result.sort((left, right) =>
    levelOrder(left.level) - levelOrder(right.level) ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0)
  );
  reportProjectDuplicates(sorted);
  return sorted;
}
