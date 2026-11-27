/// <reference path="../policy/picomatch.d.ts" />
import picomatch from "picomatch";
import { catFileBatch, git } from "../core/git.js";
import { extractTags, extractTokenTags, stripTags } from "./tags.js";
import type { ScanResult, TestDeclaration, TestSkip } from "./types.js";

export const defaultTestPatterns = [
  "**/*.test.ts",
  "**/*.test.tsx",
  "**/*.test.js",
  "**/*.test.jsx",
  "**/*.test.mjs",
  "**/*.test.cjs",
  "**/*.spec.ts",
  "**/*.spec.tsx",
  "**/*.spec.js",
  "**/*.spec.jsx",
  "**/*.spec.mjs",
  "**/*.spec.cjs",
  "**/test_*.py",
  "**/*_test.py",
  "**/*_test.go",
  "**/*Test.java",
  "**/tests/**/*.rs",
];

const skipPatterns = [
  ".skip(",
  ".only(",
  ".todo(",
  ".skipIf(",
  "xit(",
  "xdescribe(",
  "@pytest.mark.skip",
  "@pytest.mark.xfail",
  "pytest.skip(",
  "@unittest.skip",
  "t.Skip(",
  "@Disabled",
  "@Ignore",
  "#[ignore]",
];

export type ScanPolicy = {
  cwd?: string;
  id_prefix?: string;
  test_files?: string[];
};

type TagSource = { tag: string; line: number; via_describe?: true };

export type ScannedDeclaration = TestDeclaration & {
  tag_sources: TagSource[];
  title_lines: number[];
};

export type DetailedScan = Omit<ScanResult, "declarations"> & {
  declarations: ScannedDeclaration[];
};

export async function scanTests(ref: string, policy: ScanPolicy = {}): Promise<ScanResult> {
  const detailed = await scanTestsDetailed(ref, policy);
  return {
    declarations: detailed.declarations.map(({ tag_sources: _sources, title_lines: _titleLines, ...declaration }) => declaration),
    skips: detailed.skips,
  };
}

export async function scanTestsDetailed(ref: string, policy: ScanPolicy = {}): Promise<DetailedScan> {
  const cwd = policy.cwd ?? process.cwd();
  const prefix = policy.id_prefix ?? "R";
  const tree = await git(["ls-tree", "-r", "--name-only", "-z", ref], { cwd });
  const allFiles = tree.split("\0").filter(Boolean).map(portable);
  const matchers = (policy.test_files?.length ? policy.test_files : defaultTestPatterns).map((pattern) =>
    picomatch(pattern.replaceAll("\\", "/"), { dot: true, nocase: false }),
  );
  const files = allFiles.filter((file) => matchers.some((matches) => matches(file)));
  const blobs = await catFileBatch(ref, files, { cwd });
  const declarations: ScannedDeclaration[] = [];
  const skips: TestSkip[] = [];
  for (const file of files.sort()) {
    const contents = blobs.get(file)?.toString("utf8");
    if (contents === undefined) continue;
    const scanned = scanText(file, contents, prefix);
    declarations.push(...scanned.declarations);
    skips.push(...scanned.skips);
  }
  return { declarations, skips };
}

export function scanText(file: string, text: string, prefix = "R"): DetailedScan {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  const declarations: ScannedDeclaration[] = [];
  const describes = findDescribes(lines, prefix);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const js = parseJsDeclaration(lines, index, prefix);
    if (js) {
      js.file = file;
      declarations.push(attachDescribeSources(js, describes));
    }

    const python = /^\s*def\s+(test_\w*)\s*\(/.exec(line);
    if (python?.[1]) {
      const raw = python[1];
      const end = pythonEnd(lines, index);
      declarations.push(
        completeDeclaration(file, index + 1, end, raw, "def", prefix, lines, tagSources(raw, index + 1, prefix), [index + 1]),
      );
    }

    const go = /^\s*func\s+(Test\w*)\s*\(/.exec(line);
    if (go?.[1]) {
      const raw = go[1];
      const end = braceEnd(lines, index);
      declarations.push(
        completeDeclaration(file, index + 1, end, raw, "func", prefix, lines, tagSources(raw, index + 1, prefix), [index + 1]),
      );
    }

    const run = /\bt\.Run\s*\(/.exec(line);
    if (run) {
      const title = quotedNear(lines, index, 3, run.index + run[0].length);
      if (title) {
        const end = braceEnd(lines, index);
        declarations.push(
          completeDeclaration(
            file,
            index + 1,
            end,
            title.value,
            "t.Run",
            prefix,
            lines,
            titleTagSources(title, prefix, lines),
            titleLines(title.start_line, title.line),
          ),
        );
      }
    }

    const java = /^\s*@Test\b/.exec(line);
    if (java) {
      const method = methodAfter(lines, index, /(?:public|protected|private)?\s*(?:\w[\w<>, ?[\].]*\s+)?(\w+)\s*\(/);
      if (method) declarations.push(attributeDeclaration(file, index, method, "@Test", lines, prefix));
    }
    const rust = /^\s*#\[test\]/.exec(line);
    if (rust) {
      const method = methodAfter(lines, index, /^\s*(?:async\s+)?fn\s+(\w+)\s*\(/);
      if (method) declarations.push(attributeDeclaration(file, index, method, "#[test]", lines, prefix));
    }
  }

  declarations.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line);
  const skips: TestSkip[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const pattern = skipPattern(file, line);
    if (pattern) skips.push({ file, line: index + 1, pattern, text: line.trim() });
  }
  return { declarations, skips };
}

function parseJsDeclaration(lines: string[], index: number, prefix: string): ScannedDeclaration | null {
  const line = lines[index] ?? "";
  if (/\bdescribe(?:\.each)?\s*\(/.test(line)) return null;
  const direct = /(?:^|[^\w$.])(test|it)(\.each)?\s*\(/g;
  const match = direct.exec(line);
  if (!match) return null;
  const kind = match[2] ? (`${match[1]}.each` as "it.each" | "test.each") : (match[1] as "it" | "test");
  const after = kind.endsWith(".each") ? eachTitleStart(lines, index, match.index + match[0].length) : match.index + match[0].length;
  const title = quotedNear(lines, index, 3, after);
  if (!title) return null;
  const end = declarationEnd(lines, index, after);
  return completeDeclaration(
    "",
    index + 1,
    end,
    title.value,
    kind,
    prefix,
    lines,
    titleTagSources(title, prefix, lines),
    titleLines(title.start_line, title.line),
  );
}

function eachTitleStart(lines: string[], line: number, position: number): number {
  const window = lines.slice(line, line + 4).join("\n");
  let depth = 0;
  let quote = "";
  for (let index = position; index < window.length; index += 1) {
    const char = window[index] ?? "";
    if (quote) {
      if (char === "\\" && index + 1 < window.length) index += 1;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") quote = char;
    else if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth <= 0) {
        const remainder = window.slice(index + 1);
        const open = remainder.search(/\(/);
        return open < 0 ? position : index + 1 + open + 1;
      }
    }
  }
  return position;
}

function completeDeclaration(
  file: string,
  line: number,
  endLine: number,
  raw: string,
  kind: TestDeclaration["kind"],
  prefix: string,
  lines: string[],
  ownSources: TagSource[],
  titleLines: number[],
): ScannedDeclaration {
  const tags = unique(ownSources.map((source) => source.tag));
  const ownName = stripTags(raw, prefix);
  const recordSources = kind === "def"
    ? recordPropertySources(lines, line - 1, endLine - 1, prefix)
    : [];
  const sources = uniqueSources([...ownSources, ...recordSources]);
  return {
    file,
    line,
    end_line: endLine,
    name: ownName,
    raw_name: raw,
    kind,
    tags: unique([...tags, ...recordSources.map((source) => source.tag)]),
    via_describe: false,
    tag_sources: sources,
    title_lines: titleLines,
  };
}

function attributeDeclaration(
  file: string,
  attributeLine: number,
  method: { line: number; name: string },
  kind: "@Test" | "#[test]",
  lines: string[],
  prefix: string,
): ScannedDeclaration {
  const end = braceEnd(lines, method.line);
  return completeDeclaration(
    file,
    attributeLine + 1,
    end,
    method.name,
    kind,
    prefix,
    lines,
    tagSources(method.name, method.line + 1, prefix),
    [method.line + 1],
  );
}

function tagSources(text: string, line: number, prefix: string): TagSource[] {
  return extractTags(text, prefix).map((tag) => ({ tag, line }));
}

function methodAfter(
  lines: string[],
  start: number,
  pattern: RegExp,
): { line: number; name: string } | null {
  for (let index = start + 1; index < Math.min(lines.length, start + 4); index += 1) {
    const match = pattern.exec(lines[index] ?? "");
    const name = match?.[1];
    if (name) return { line: index, name };
  }
  return null;
}

function findDescribes(lines: string[], prefix: string): Array<{ start: number; end: number; tags: TagSource[] }> {
  const describes: Array<{ start: number; end: number; tags: TagSource[] }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const match = /(?:^|[^\w$.])describe\s*\(/.exec(line);
    if (!match) continue;
    const title = quotedNear(lines, index, 3, match.index + match[0].length);
    if (!title) continue;
    describes.push({
      start: index + 1,
      end: declarationEnd(lines, index, match.index + match[0].length),
      tags: titleTagSources(title, prefix, lines),
    });
  }
  return describes;
}

function attachDescribeSources(
  declaration: ScannedDeclaration,
  describes: Array<{ start: number; end: number; tags: TagSource[] }>,
): ScannedDeclaration {
  const enclosing = describes.filter((describe) =>
    describe.start <= declaration.line && declaration.end_line <= describe.end
  );
  const inherited = enclosing.flatMap((describe) => describe.tags)
    .filter(({ tag }) => !declaration.tags.includes(tag))
    .map((source) => ({ ...source, via_describe: true as const }));
  if (inherited.length === 0) return declaration;
  declaration.tags = unique([...declaration.tags, ...inherited.map((source) => source.tag)]);
  declaration.tag_sources = uniqueSources([...declaration.tag_sources, ...inherited]);
  declaration.via_describe = true;
  return declaration;
}

function quotedNear(
  lines: string[],
  start: number,
  span: number,
  position = 0,
): { value: string; line: number; start_line: number } | null {
  const parts = lines.slice(start, Math.min(lines.length, start + span + 1));
  const window = parts.join("\n");
  for (let index = Math.max(0, position); index < window.length; index += 1) {
    const quote = window[index];
    if (quote !== "'" && quote !== '"' && quote !== "`") continue;
    let value = "";
    const startLine = start + (window.slice(0, index).match(/\n/g)?.length ?? 0) + 1;
    let line = startLine;
    for (let cursor = index + 1; cursor < window.length; cursor += 1) {
      const char = window[cursor] ?? "";
      if (char === "\n") line += 1;
      if (char === "\\") {
        if (cursor + 1 < window.length) {
          value += window[cursor + 1] ?? "";
          cursor += 1;
        } else value += char;
      } else if (char === quote) return { value, line, start_line: startLine };
      else value += char;
    }
  }
  return null;
}

function titleTagSources(
  title: { value: string; line: number; start_line: number },
  prefix: string,
  lines: string[],
): TagSource[] {
  return extractTags(title.value, prefix).flatMap((tag) => {
    const sources = sourceLinesForTag(lines, title.start_line - 1, title.line - 1, tag, prefix);
    return sources.length ? sources : [{ tag, line: title.line }];
  });
}

function titleLines(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function sourceLinesForTag(lines: string[], start: number, end: number, tag: string, prefix: string): TagSource[] {
  const sources: TagSource[] = [];
  for (let index = start; index <= end && index < lines.length; index += 1) {
    if (extractTags(lines[index] ?? "", prefix).includes(tag)) sources.push({ tag, line: index + 1 });
  }
  return sources;
}

function recordPropertySources(lines: string[], start: number, end: number, prefix: string): TagSource[] {
  const sources: TagSource[] = [];
  for (let index = Math.max(0, start); index <= end && index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const call = /^\s*record_property\s*\(\s*["']tenet\.case["']\s*,\s*(["'])(.*?)\1\s*\)/.exec(line);
    const value = call?.[2];
    if (!value) continue;
    const tags = extractTokenTags(value, prefix);
    for (const tag of tags) sources.push({ tag, line: index + 1 });
  }
  return uniqueSources(sources);
}

export function skipPattern(file: string, line: string): string | undefined {
  const text = line.trimStart();
  if (text.startsWith("//") || (file.endsWith(".py") && text.startsWith("#"))) return undefined;
  return skipPatterns.find((pattern) => {
    if (pattern === "xit(") return /(?:^|[^\w$.])xit\(/.test(text);
    if (pattern === "xdescribe(") return /(?:^|[^\w$.])xdescribe\(/.test(text);
    return text.includes(pattern);
  });
}

function braceEnd(lines: string[], start: number): number {
  return declarationEnd(lines, start);
}

// For calls, the position is just after their opening parenthesis. A block
// callback ends at its closing brace. An expression callback ends at the
// call's closing parenthesis, even when the expression contains object braces.
function declarationEnd(lines: string[], start: number, callPosition?: number): number {
  let rounds = callPosition === undefined ? 0 : 1;
  let braces = 0;
  let brackets = 0;
  let offset = callPosition ?? 0;
  let quote = "";
  let comment = false;
  let previous = "";
  let callbackArrow = false;
  for (let lineIndex = start; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex] ?? "";
    if (offset > line.length) {
      offset -= line.length + 1;
      continue;
    }
    for (let index = offset; index < line.length; index += 1) {
      const char = line[index] ?? "";
      const next = line[index + 1];
      if (comment) {
        if (char === "*" && next === "/") {
          comment = false;
          index += 1;
        }
        continue;
      }
      if (quote) {
        if (char === "\\" && next !== undefined) index += 1;
        else if (char === quote) quote = "";
        continue;
      }
      if (char === "/" && next === "/") break;
      if (char === "/" && next === "*") {
        comment = true;
        index += 1;
        continue;
      }
      if (char === "'" || char === '"' || char === "\x60") {
        quote = char;
        previous = char;
        continue;
      }
      if (char === ">" && previous === "=" && rounds === 1 && brackets === 0) callbackArrow = true;
      if (char === "(") rounds += 1;
      else if (char === ")") {
        rounds -= 1;
        if (callPosition !== undefined && rounds === 0) return lineIndex + 1;
      } else if (char === "[") brackets += 1;
      else if (char === "]") brackets -= 1;
      else if (char === "{") {
        if (braces > 0 || callPosition === undefined || (
          rounds === 1 && brackets === 0 &&
          ((callbackArrow && previous === ">") || (!callbackArrow && previous === ")"))
        )) braces += 1;
      } else if (char === "}" && braces > 0) {
        braces -= 1;
        if (braces === 0) return lineIndex + 1;
      }
      if (!/\s/.test(char)) previous = char;
    }
    offset = 0;
  }
  return Math.min(lines.length, start + 1);
}

function pythonEnd(lines: string[], start: number): number {
  const indent = leading((lines[start] ?? ""));
  let end = start + 1;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (!line.trim()) continue;
    if (leading(line) <= indent) break;
    end = index + 1;
  }
  return end;
}

function leading(line: string): number {
  return line.length - line.trimStart().length;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function uniqueSources(values: TagSource[]): TagSource[] {
  const found = new Map<string, TagSource>();
  for (const value of values) found.set(`${value.tag}\0${String(value.line)}`, value);
  return [...found.values()];
}

function portable(value: string): string {
  return value.replaceAll("\\", "/");
}
