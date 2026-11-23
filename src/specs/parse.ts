import { parseDocument } from "yaml";
import type { Finding } from "../types/generated.js";
import { sectionDigest, slugFor } from "./sections.js";

export type Requirement = {
  id: string;
  text: string;
  origin: "observed" | "documented" | "asked" | "inferred" | null;
  cites: string[];
  serves: string[];
  scope: string | null;
  adopted_by: string | null;
};

export type ConflictOrQuestion = {
  id: string;
  checked: boolean;
  section: string | null;
  text: string;
  resolution?: string;
  answer?: string;
};

export type SpecSection = {
  slug: string;
  heading: string;
  level: string | null;
  text: string;
  digest: string;
  requirements: Requirement[];
  vision_items: Requirement[];
  conflicts: ConflictOrQuestion[];
  questions: ConflictOrQuestion[];
  applies_to: string[];
  state: string;
  blessed_digest: string | null;
  blessed_at_rev: string | null;
  anchors: Record<string, string>;
  blessed_copy: string | null;
  flags: string[];
  owner: string | null;
};

export type ParsedDoc = {
  path: string;
  front: Record<string, unknown> | null;
  sections: SpecSection[];
  problems: Finding[];
};

type ParseOptions = { prefix?: string };
type RequirementOptions = ParseOptions & { line?: number; file?: string };
type InternalSection = SpecSection;

const lineLocations = new WeakMap<object, number>();
const sectionLocations = new WeakMap<SpecSection, { heading: number; start: number }>();
const messageByCode: Record<string, [string, string]> = {
  "TN-SPEC-DUP-ID": [
    "Duplicate specification ID {id}.",
    "Run `tenet fix` to assign a new ID, or remove the duplicate {id} item.",
  ],
  "TN-SPEC-DUP-SECTION": [
    "Duplicate section slug {slug}.",
    "Rename or merge the repeated {slug} heading.",
  ],
  "TN-SPEC-MISSING-ID": [
    "Specification line needs an ID.",
    "Run `tenet fix` or prefix the line with an unused ID.",
  ],
  "TN-SPEC-NO-FRONT": [
    "Specification file has no valid YAML front matter.",
    "Add YAML front matter (`---`) with `tenet` and `sections`, or run `tenet fix`.",
  ],
  "TN-SPEC-REQ-META": [
    "Requirement metadata is malformed: check closing braces, allowed keys, and origin.",
    "Fix the `{…}` metadata block with allowed keys and valid origin.",
  ],
};

function finding(
  code: string,
  file: string | null,
  line: number | null,
  values: Record<string, string> = {},
): Finding {
  const templates = messageByCode[code] ?? ["", ""];
  const fill = (template: string) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
  return {
    code,
    severity: "error",
    rule: null,
    file,
    line,
    message: fill(templates[0]),
    fix: fill(templates[1]),
  };
}

function portable(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function nullable(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" || text === "-" || text === "—" ? null : text;
}

function nonEmptyText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === "" ? null : text;
}

function commaList(value: unknown): string[] {
  const text = nullable(value);
  if (text === null) return [];
  return text.split(",").map((part) => part.trim()).filter(Boolean);
}

function metadataList(value: unknown): string[] {
  const text = nonEmptyText(value);
  if (text === null) return [];
  return text.split(",").map((part) => part.trim()).filter(Boolean);
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function keyLookup(row: Record<string, unknown>, key: string): unknown {
  const expected = key.toLowerCase().replace(/[_\s]+/g, "");
  for (const [candidate, value] of Object.entries(row)) {
    if (candidate.toLowerCase().replace(/[_\s]+/g, "") === expected) return value;
  }
  return undefined;
}

function isOrigin(value: string): value is NonNullable<Requirement["origin"]> {
  return value === "observed" || value === "documented" || value === "asked" || value === "inferred";
}

function parseMetadata(
  raw: string,
  prefix: string,
  initial: Partial<Requirement> = {},
): Requirement | Finding | null {
  const grouped = prefix === "V" ? "(?:[A-Z]+)?" : "";
  const idMatch = new RegExp(`^(${escapeRegExp(prefix)}-${grouped}\\d+)(?:\\s+(.*))?$`).exec(raw.trim());
  if (!idMatch) return null;
  const id = idMatch[1] ?? "";
  let text = (idMatch[2] ?? "").trim();
  let metadata: Record<string, string> | undefined;
  const open = text.indexOf("{");
  const close = text.lastIndexOf("}");
  if (open >= 0 || close >= 0) {
    if (open < 0 || close < open || close !== text.length - 1) {
      return requirementMetadataFinding();
    }
    metadata = {};
    const body = text.slice(open + 1, close);
    text = text.slice(0, open).trim();
    if (/(?:^|\s)(?:origin|cites|serves|scope|adopted_by|adopted by)\s*:/.test(text)) {
      return requirementMetadataFinding();
    }
    for (const field of body.split(";")) {
      const pair = /^([^:]+):([\s\S]*)$/.exec(field.trim());
      if (!pair) return requirementMetadataFinding();
      const key = pair[1]?.trim().toLowerCase().replace(/\s+/g, "_");
      const value = pair[2]?.trim() ?? "";
      if (!key || !["origin", "cites", "serves", "scope", "adopted_by"].includes(key)) {
        return requirementMetadataFinding();
      }
      metadata[key] = value;
    }
  } else if (/(?:^|\s)(?:origin|cites|serves|scope|adopted_by|adopted by)\s*:/.test(text)) {
    return requirementMetadataFinding();
  }

  let origin = initial.origin ?? null;
  if (metadata?.origin !== undefined) {
    if (!isOrigin(metadata.origin)) return requirementMetadataFinding();
    origin = metadata.origin;
  }
  const cites = initial.cites ?? metadataList(metadata?.cites);
  const serves = initial.serves ?? metadataList(metadata?.serves);
  const scope = initial.scope === undefined ? nonEmptyText(metadata?.scope) : initial.scope;
  const adopted = initial.adopted_by === undefined ? nonEmptyText(metadata?.adopted_by) : initial.adopted_by;
  return { id, text, origin, cites, serves, scope, adopted_by: adopted };
}

function requirementMetadataFinding(): Finding {
  return finding("TN-SPEC-REQ-META", null, null);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseRequirement(
  input: string | Record<string, string>,
  opts: RequirementOptions = {},
): Requirement | Finding {
  const prefix = opts.prefix ?? "R";
  const file = opts.file === undefined ? null : portable(opts.file);
  const line = opts.line ?? null;
  if (typeof input !== "string") {
    const id = nullable(keyLookup(input, "id"));
    if (id === null) return finding("TN-SPEC-MISSING-ID", file, line);
    const excluded = new Set([
      "id", "origin", "cites", "serves", "scope", "adoptedby", "adopted_by",
    ]);
    let selected: string | null = nullable(keyLookup(input, "requirement"));
    if (selected === null) selected = nullable(keyLookup(input, "rule"));
    if (selected === null) {
      for (const [key, value] of Object.entries(input)) {
        const clean = key.toLowerCase().replace(/[\s_]+/g, "");
        if (!excluded.has(clean) && !/^release$|^guarantee$|^status$/.test(clean)) {
          const candidate = nullable(value);
          if (candidate !== null) {
            selected = candidate;
            break;
          }
        }
      }
    }
    const parsed = parseMetadata(`${id} ${selected ?? ""}`.trim(), prefix);
    if (parsed === null || "code" in parsed) {
      return parsed === null
        ? finding("TN-SPEC-MISSING-ID", file, line)
        : { ...parsed, file, line };
    }
    const overrides: Partial<Requirement> = {};
    const origin = keyLookup(input, "origin");
    const cleanOrigin = nullable(origin);
    if (cleanOrigin !== null) {
      if (!isOrigin(cleanOrigin)) return finding("TN-SPEC-REQ-META", file, line);
      overrides.origin = cleanOrigin;
    }
    const cites = keyLookup(input, "cites");
    if (nullable(cites) !== null) overrides.cites = commaList(cites);
    const serves = keyLookup(input, "serves");
    if (nullable(serves) !== null) overrides.serves = commaList(serves);
    const scope = keyLookup(input, "scope");
    if (nullable(scope) !== null) overrides.scope = nullable(scope);
    const adopted = keyLookup(input, "adopted by") ?? keyLookup(input, "adopted_by");
    if (nullable(adopted) !== null) overrides.adopted_by = nullable(adopted);
    return { ...parsed, ...overrides };
  }

  const withoutBullet = input.trim().replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, "");
  const parsed = parseMetadata(withoutBullet, prefix);
  if (parsed === null) return finding("TN-SPEC-MISSING-ID", file, line);
  if ("code" in parsed) return { ...parsed, file, line };
  lineLocations.set(parsed, line ?? 0);
  return parsed;
}

function splitFront(text: string): { front: Record<string, unknown> | null; body: string; bodyLine: number } {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") return { front: null, body: normalized, bodyLine: 1 };
  let end = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === "---") {
      end = index;
      break;
    }
  }
  if (end < 0) return { front: null, body: normalized, bodyLine: 1 };
  const yaml = lines.slice(1, end).join("\n");
  try {
    const document = parseDocument(yaml, { merge: false, prettyErrors: true, uniqueKeys: true });
    if (document.errors.length > 0) return { front: null, body: lines.slice(end + 1).join("\n"), bodyLine: end + 2 };
    const parsed = document.toJS({ maxAliasCount: 100 });
    const top = record(parsed);
    const tenet = record(top?.tenet);
    if (!top || !tenet) return { front: null, body: lines.slice(end + 1).join("\n"), bodyLine: end + 2 };
    if (top.sections === undefined) top.sections = {};
    return { front: top, body: lines.slice(end + 1).join("\n"), bodyLine: end + 2 };
  } catch {
    return { front: null, body: lines.slice(end + 1).join("\n"), bodyLine: end + 2 };
  }
}

function fenceStart(line: string): { character: "`" | "~"; length: number } | null {
  const backticks = /^(?: {0,3})(`{3,})([^`]*)$/.exec(line);
  if (backticks?.[1]) {
    return { character: "`", length: backticks[1].length };
  }
  const tildes = /^(?: {0,3})(~{3,})(.*)$/.exec(line);
  if (tildes?.[1]) {
    return { character: "~", length: tildes[1].length };
  }
  return null;
}

function fenceEnd(line: string, fence: { character: "`" | "~"; length: number }): boolean {
  const escaped = fence.character === "`" ? "`" : "~";
  return new RegExp(`^ {0,3}${escaped}{${String(fence.length)},}\\s*$`).test(line);
}

function sectionRecord(front: Record<string, unknown> | null, slug: string): Record<string, unknown> {
  const sections = record(front?.sections);
  if (!sections) return {};
  const direct = record(sections[slug]);
  if (direct) return direct;
  const folded = slug.toLowerCase();
  for (const [candidate, value] of Object.entries(sections)) {
    if (candidate.toLowerCase() === folded) return record(value) ?? {};
  }
  return {};
}

function makeSection(
  slug: string,
  heading: string,
  body: string,
  front: Record<string, unknown> | null,
  startLine: number,
  headingLine: number,
): InternalSection {
  const meta = sectionRecord(front, slug);
  const tenet = record(front?.tenet);
  const level = nullable(meta.level) ?? nullable(tenet?.level);
  const state = nullable(meta.state) ?? "draft";
  const normalized = body.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const text = normalized && !normalized.endsWith("\n") ? `${normalized}\n` : normalized;
  const section: InternalSection = {
    slug,
    heading,
    level,
    text,
    digest: sectionDigest(normalized),
    requirements: [],
    vision_items: [],
    conflicts: [],
    questions: [],
    applies_to: Array.isArray(meta.applies_to)
      ? meta.applies_to.map(String)
      : [],
    state,
    blessed_digest: nullable(meta.blessed_digest),
    blessed_at_rev: nullable(meta.blessed_at_rev),
    anchors: record(meta.anchors)
      ? Object.fromEntries(Object.entries(meta.anchors as Record<string, unknown>).map(([key, value]) => [key, String(value)]))
      : {},
    blessed_copy: nullable(meta.blessed_copy),
    flags: Array.isArray(meta.flags) ? meta.flags.map(String) : [],
    owner: nullable(meta.owner) ?? nullable(tenet?.owner),
  };
  sectionLocations.set(section, { heading: headingLine, start: startLine });
  return section;
}

function isTableSeparator(line: string): boolean {
  const cells = tableCells(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.trim()));
}

function tableCells(line: string): string[] {
  let text = line.trim();
  if (text.startsWith("|")) text = text.slice(1);
  if (text.endsWith("|")) text = text.slice(0, -1);
  return text.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

function rowRecord(headers: string[], line: string): Record<string, string> {
  const values = tableCells(line);
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function parseSpecial(
  section: InternalSection,
  line: string,
  lineNumber: number,
  conflicts: ConflictOrQuestion[],
  questions: ConflictOrQuestion[],
  seen: Set<string>,
  problems: Finding[],
  path: string,
): void {
  const match = /^\s*[-*+]\s+(?:\[([ xX])\]\s+)?([A-Z]+-\d+)\b(.*)$/.exec(line);
  if (!match?.[2]) return;
  const id = match[2];
  if (seen.has(id)) {
    problems.push(finding("TN-SPEC-DUP-ID", path, lineNumber, { id }));
    return;
  }
  seen.add(id);
  const isQuestion = section.heading === "Open questions";
  let tail = match[3]?.trim() ?? "";
  let namedSection: string | null = null;
  const sectionMatch = /^\(section:\s*([^)]+)\)\s*/.exec(tail);
  if (sectionMatch?.[1]) {
    namedSection = sectionMatch[1].trim() || null;
    tail = tail.slice(sectionMatch[0].length);
  }
  const field = /(?:^|[\s;|])(resolution|answer):\s*([\s\S]+)$/.exec(tail);
  let value: string | undefined;
  if (field?.[1] && field[2]) {
    value = field[2].trim() || undefined;
    tail = tail.slice(0, field.index).trim().replace(/[;|]\s*$/, "").trim();
  }
  const option = /\s*\|\s*\d+:\s*[\s\S]*$/.exec(tail);
  if (option?.index !== undefined) tail = tail.slice(0, option.index).trim();
  const parsed: ConflictOrQuestion = {
    id,
    checked: match[1]?.toLowerCase() === "x",
    section: namedSection,
    text: tail,
    ...(field?.[1] === "resolution" && value ? { resolution: value } : {}),
    ...(field?.[1] === "answer" && value ? { answer: value } : {}),
  };
  lineLocations.set(parsed, lineNumber);
  (isQuestion ? questions : conflicts).push(parsed);
}

function addItem(
  result: Requirement | Finding,
  section: InternalSection,
  vision: boolean,
  seen: Set<string>,
  problems: Finding[],
  path: string,
  line: number,
): void {
  if ("code" in result) {
    problems.push(result);
    return;
  }
  if (seen.has(result.id)) {
    problems.push(finding("TN-SPEC-DUP-ID", path, line, { id: result.id }));
    return;
  }
  seen.add(result.id);
  lineLocations.set(result, line);
  (vision ? section.vision_items : section.requirements).push(result);
}

function parseStatements(
  section: InternalSection,
  prefix: string,
  seen: Set<string>,
  problems: Finding[],
  path: string,
): void {
  const lines = section.text ? section.text.replace(/\n$/, "").split("\n") : [];
  const vision = section.level === "L0" ||
    section.slug === "vision" ||
    /\bvision\b/i.test(section.heading);
  const governed = vision ||
    section.slug === "requirements" ||
    /\brequirements?\b/i.test(section.heading);
  const special = section.heading === "Conflicts" || section.heading === "Open questions";
  const location = sectionLocations.get(section) ?? { start: 0, heading: 0 };
  let fence: { character: "`" | "~"; length: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const source = lines[index] ?? "";
    const line = location.start + index;
    if (fence) {
      if (fenceEnd(source, fence)) fence = null;
      continue;
    }
    const nextFence = fenceStart(source);
    if (nextFence) {
      fence = nextFence;
      continue;
    }
    if (special) {
      parseSpecial(
        section,
        source,
        line,
        section.conflicts,
        section.questions,
        seen,
        problems,
        path,
      );
      continue;
    }
    if (source.includes("|") && index + 1 < lines.length) {
      const headers = tableCells(source);
      if (
        headers.length > 0 &&
        headers[0]?.toLowerCase().replace(/\s+/g, "") === "id" &&
        isTableSeparator(lines[index + 1] ?? "")
      ) {
        index += 2;
        for (; index < lines.length; index += 1) {
          const candidate = lines[index] ?? "";
          if (!candidate.trim() || !candidate.includes("|")) break;
          const row = rowRecord(headers, candidate);
          const rowLine = location.start + index;
          const item = parseRequirement(row, { prefix: vision ? "V" : prefix, file: path, line: rowLine });
          addItem(item, section, vision, seen, problems, path, rowLine);
        }
        index -= 1;
        continue;
      }
    }
    const bullet = /^\s*[-*+]\s+/.test(source);
    const itemPrefix = vision ? "V" : prefix;
    const item = /^\s*[-*+]\s+/.test(source)
      ? parseRequirement(source, { prefix: itemPrefix, file: path, line })
      : null;
    if (item && !("code" in item)) {
      addItem(item, section, vision, seen, problems, path, line);
    } else if (item && "code" in item) {
      if (item.code !== "TN-SPEC-MISSING-ID" || governed || /\{/.test(source)) {
        addItem(item, section, vision, seen, problems, path, line);
      }
    } else if (bullet && governed) {
      problems.push(finding("TN-SPEC-MISSING-ID", path, line));
    }
  }
}

export function parseDoc(path: string, text: string, opts: ParseOptions = {}): ParsedDoc {
  const filename = portable(path);
  const { front, body, bodyLine } = splitFront(text);
  const problems: Finding[] = [];
  if (!front) problems.push(finding("TN-SPEC-NO-FRONT", filename, null));
  const lines = body.split("\n");
  const raw: Array<{ slug: string; heading: string; bodyLines: string[]; start: number; headingLine: number }> = [];
  let current: { slug: string; heading: string; bodyLines: string[]; start: number; headingLine: number } | null =
    null;
  let fence: { character: "`" | "~"; length: number } | null = null;
  const slugs = new Set<string>();
  let position = 0;
  const startSection = (heading: string, line: number) => {
    position += 1;
    const slug = slugFor(heading, position);
    if (slugs.has(slug)) {
      problems.push(finding("TN-SPEC-DUP-SECTION", filename, line, { slug }));
    } else {
      slugs.add(slug);
    }
    current = { slug, heading, bodyLines: [], start: line + 1, headingLine: line };
    raw.push(current);
  };
  for (let index = 0; index < lines.length; index += 1) {
    const source = lines[index] ?? "";
    const line = bodyLine + index;
    const active = current as {
      slug: string;
      heading: string;
      bodyLines: string[];
      start: number;
      headingLine: number;
    } | null;
    if (fence) {
      active?.bodyLines.push(source);
      if (fenceEnd(source, fence)) fence = null;
      continue;
    }
    const nextFence = fenceStart(source);
    if (nextFence) {
      fence = nextFence;
      active?.bodyLines.push(source);
      continue;
    }
    const heading = /^## (.*)$/.exec(source);
    if (heading?.[1] !== undefined) {
      startSection(heading[1], line);
    } else {
      active?.bodyLines.push(source);
    }
  }
  if (!current) {
    const preamble = lines.join("\n");
    if (preamble.trim()) raw.push({
      slug: "_preamble",
      heading: "",
      bodyLines: lines,
      start: bodyLine,
      headingLine: bodyLine - 1,
    });
  } else {
    const firstHeading = raw.find((section) => section.headingLine !== -1);
    if (firstHeading) {
      const beforeCount = firstHeading.headingLine - bodyLine;
      const preambleLines = lines.slice(0, beforeCount);
      if (preambleLines.some((line) => line.trim())) {
        raw.unshift({
          slug: "_preamble",
          heading: "",
          bodyLines: preambleLines,
          start: bodyLine,
          headingLine: bodyLine - 1,
        });
      }
    }
  }
  const sections = raw.map((item) =>
    makeSection(item.slug, item.heading, item.bodyLines.join("\n"), front, item.start, item.headingLine)
  );
  const seen = new Set<string>();
  for (const section of sections) parseStatements(section, opts.prefix ?? "R", seen, problems, filename);
  return { path: filename, front, sections, problems };
}

export function itemLine(item: object): number | null {
  const line = lineLocations.get(item);
  return line && line > 0 ? line : null;
}

export function sectionLocation(section: SpecSection): { heading: number; start: number } {
  return sectionLocations.get(section) ?? { heading: 0, start: 0 };
}
