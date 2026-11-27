/// <reference path="../policy/picomatch.d.ts" />
import picomatch from "picomatch";
import { git } from "../core/git.js";
import { defaultTestPatterns, scanTestsDetailed, skipPattern, type ScannedDeclaration } from "./scan.js";
import type { Weakening } from "./types.js";

type DiffLines = {
  added: Map<string, Map<number, string>>;
  removed: Map<string, Set<number>>;
};

type FileChange = { status: string; before?: string; after?: string };

export async function weakening(
  base: string,
  head: string,
  options: { cwd?: string; test_files?: string[] } = {},
): Promise<Weakening> {
  const cwd = options.cwd ?? process.cwd();
  const testFiles = [...defaultTestPatterns, ...options.test_files ?? []];
  const scanOptions = { cwd, test_files: testFiles };
  const matchers = testFiles.map((pattern) => picomatch(portable(pattern), { dot: true, nocase: false }));
  const isTestFile = (filename: string) => matchers.some((matches) => matches(filename));
  const [before, after, lines, changes, headFiles] = await Promise.all([
    scanTestsDetailed(base, scanOptions),
    scanTestsDetailed(head, scanOptions),
    diffLines(base, head, cwd),
    fileChanges(base, head, cwd),
    listFiles(head, cwd),
  ]);
  const by: Weakening["by"] = [];
  const notes: Weakening["notes"] = [];

  const deleted = changes.filter((change) => change.status.startsWith("D") && change.before);
  const renamed = new Map(
    changes
      .filter((change) => change.status.startsWith("R") && change.before && change.after)
      .map((change) => [change.after as string, change.before as string]),
  );
  for (const change of deleted) {
    const names = before.declarations.filter((declaration) => declaration.file === change.before)
      .map((declaration) => declaration.name);
    if (names.length > 0) by.push({ finding: "file-deleted", file: change.before as string, names: unique(names) });
  }
  const deletedFiles = new Set(deleted.map((change) => change.before as string));

  const addedNames = new Set(
    after.declarations
      .filter((declaration) => intersects(lines.added.get(declaration.file), declaration))
      .map((declaration) => declaration.name),
  );
  const removedByFile = new Map<string, string[]>();
  for (const declaration of before.declarations) {
    const newFile = [...renamed.entries()].find(([, old]) => old === declaration.file)?.[0] ?? declaration.file;
    const removed = lines.removed.get(newFile) ?? lines.removed.get(declaration.file);
    if (!removed || !declarationTouches(declaration, removed)) continue;
    if (deletedFiles.has(declaration.file) || addedNames.has(declaration.name)) continue;
    (removedByFile.get(newFile) ?? removedByFile.set(newFile, []).get(newFile))?.push(declaration.name);
  }
  for (const [file, names] of removedByFile) {
    const consolidated = [...(lines.added.get(file)?.values() ?? [])].some((line) =>
      line.includes(".each(") || line.includes("@pytest.mark.parametrize") || line.includes("t.Run(")
    );
    if (consolidated) notes.push({ note: "tests-consolidated", file, names: unique(names) });
    else by.push({ finding: "removed-tests", file, names: unique(names) });
  }

  for (const [file, added] of lines.added) {
    if (!isTestFile(file)) continue;
    for (const [lineNumber, text] of added) {
      if (!skipPattern(file, text)) continue;
      const affected = affectedDeclaration(after.declarations, file, lineNumber);
      by.push({
        finding: "skip-added",
        file,
        names: [affected?.name ?? text.trim()],
      });
    }
  }

  by.sort((left, right) => left.file.localeCompare(right.file) || left.finding.localeCompare(right.finding));
  notes.sort((left, right) => left.file.localeCompare(right.file));
  const recognizedByLanguage = new Map<string, boolean>();
  const changedLanguages = unique(
    headFiles
      .filter((file) => changes.some((change) => change.after === file || (!change.after && change.before === file)))
      .flatMap((file) => {
        const language = languageFor(file);
        if (!language) return [];
        if (!recognizedByLanguage.has(language)) recognizedByLanguage.set(language, false);
        return [language];
      }),
  );
  for (const file of headFiles) {
    if (!isTestFile(file)) continue;
    const language = languageFor(file);
    if (language) recognizedByLanguage.set(language, true);
  }

  return {
    found: by.length > 0,
    by,
    notes,
    not_checked: changedLanguages.filter((language) => !recognizedByLanguage.get(language)).sort(),
  };
}

function intersects(lines: Map<number, string> | undefined, declaration: ScannedDeclaration): boolean {
  if (!lines) return false;
  for (let line = declaration.line; line <= Math.min(declaration.end_line, declaration.line + 3); line += 1) {
    if (lines.has(line)) return true;
  }
  return false;
}

function declarationTouches(declaration: ScannedDeclaration, lines: Set<number>): boolean {
  if (lines.has(declaration.line)) return true;
  if (declaration.title_lines.some((line) => lines.has(line))) return true;
  return declaration.tag_sources.some((source) => lines.has(source.line));
}

function affectedDeclaration(
  declarations: ScannedDeclaration[],
  file: string,
  line: number,
): ScannedDeclaration | undefined {
  let enclosing: ScannedDeclaration | undefined;
  let next: ScannedDeclaration | undefined;
  for (const declaration of declarations) {
    if (declaration.file !== file) continue;
    if (declaration.line <= line && line <= declaration.end_line &&
        (!enclosing || declaration.line > enclosing.line ||
          (declaration.line === enclosing.line && declaration.end_line < enclosing.end_line))) {
      enclosing = declaration;
    } else if (declaration.line > line && declaration.line - line <= 3 &&
        (!next || declaration.line < next.line)) {
      next = declaration;
    }
  }
  return enclosing ?? next;
}

async function fileChanges(base: string, head: string, cwd: string): Promise<FileChange[]> {
  const output = await git(["diff", "--name-status", "-z", "-M", `${base}..${head}`], { cwd });
  const fields = output.split("\0");
  const result: FileChange[] = [];
  for (let index = 0; index < fields.length; index += 1) {
    const status = fields[index] ?? "";
    if (!status) continue;
    if (status.startsWith("R")) {
      const before = fields[index + 1];
      const after = fields[index + 2];
      if (before !== undefined && after !== undefined) result.push({ status, before: portable(before), after: portable(after) });
      index += 2;
    } else {
      const filename = fields[index + 1];
      if (filename !== undefined) {
        result.push({
          status,
          ...(status.startsWith("A") ? {} : { before: portable(filename) }),
          ...(status.startsWith("D") ? {} : { after: portable(filename) }),
        });
      }
      index += 1;
    }
  }
  return result;
}

async function diffLines(base: string, head: string, cwd: string): Promise<DiffLines> {
  const output = await git(["diff", "--unified=0", "--no-color", "-M", "--no-prefix", `${base}..${head}`], { cwd });
  const added = new Map<string, Map<number, string>>();
  const removed = new Map<string, Set<number>>();
  let oldFile: string | undefined;
  let newFile: string | undefined;
  let oldLine = 0;
  let newLine = 0;
  let oldRemaining = 0;
  let newRemaining = 0;
  for (const line of output.replaceAll("\r\n", "\n").split("\n")) {
    if (line.startsWith("--- ")) {
      oldFile = line.slice(4) === "/dev/null" ? undefined : portable(line.slice(4));
      continue;
    }
    if (line.startsWith("+++ ")) {
      newFile = line.slice(4) === "/dev/null" ? undefined : portable(line.slice(4));
      continue;
    }
    const hunk = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1] ?? 0);
      oldRemaining = Number(hunk[2] ?? 1);
      newLine = Number(hunk[3] ?? 0);
      newRemaining = Number(hunk[4] ?? 1);
      continue;
    }
    if (oldRemaining === 0 && newRemaining === 0) continue;
    if (line.startsWith("+") && !line.startsWith("+++")) {
      if (newFile) (added.get(newFile) ?? added.set(newFile, new Map()).get(newFile))?.set(newLine, line.slice(1));
      newLine += 1;
      newRemaining -= 1;
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      if (oldFile || newFile) (removed.get(newFile ?? oldFile as string) ?? removed.set(
        newFile ?? oldFile as string,
        new Set(),
      ).get(newFile ?? oldFile as string))?.add(oldLine);
      oldLine += 1;
      oldRemaining -= 1;
    } else if (!line.startsWith("\\")) {
      oldLine += 1;
      newLine += 1;
      oldRemaining -= 1;
      newRemaining -= 1;
    }
  }
  return { added, removed };
}

async function listFiles(ref: string, cwd: string): Promise<string[]> {
  const output = await git(["ls-tree", "-r", "--name-only", "-z", ref], { cwd });
  return output.split("\0").filter(Boolean).map(portable);
}

function languageFor(file: string): string | null {
  const lower = file.toLowerCase();
  if (/\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(lower)) return "javascript/typescript";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".go")) return "go";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".rs")) return "rust";
  if (lower.endsWith(".rb")) return "ruby";
  if (lower.endsWith(".cs")) return "csharp";
  if (lower.endsWith(".php")) return "php";
  if (lower.endsWith(".kt")) return "kotlin";
  if (lower.endsWith(".swift")) return "swift";
  if (lower.endsWith(".scala")) return "scala";
  if (/\.(?:c|h|cc|cpp|hpp)$/.test(lower)) return "c/c++";
  return null;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function portable(value: string): string {
  return value.replaceAll("\\", "/");
}
