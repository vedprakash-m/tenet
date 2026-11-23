import { sha256 } from "../core/hash.js";
import { parseDoc, sectionLocation, type SpecSection } from "./parse.js";
import { sectionDigest } from "./sections.js";

type Reader = (path: string) => string | null;
type CitationBlock = { start: number; end: number; text: string; hash: string };

function normalizedLines(text: string): string[] {
  const lines = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines.map((line) => line.replace(/[ \t]+$/, ""));
}

function joinLines(lines: string[]): { text: string; hash: string } {
  const text = lines.join("\n");
  return { text, hash: `sha256:${sha256(text)}` };
}

export function citationParts(cite: string):
  | { kind: "path"; path: string; start: number; end: number }
  | { kind: "test"; path: string; segments: string[] }
  | { kind: "doc"; path: string; slug: string }
  | null {
  const doc = /^doc:\s*(.+)#([^#\s]+)\s*$/.exec(cite);
  if (doc?.[1] && doc[2]) {
    return { kind: "doc", path: doc[1].trim().replaceAll("\\", "/"), slug: doc[2] };
  }
  if (/^doc:\s*/.test(cite)) return null;
  const test = /^test:\s*(.+?)\s+>\s+(.+)$/.exec(cite);
  if (test?.[1] && test[2]) {
    return {
      kind: "test",
      path: test[1].trim().replaceAll("\\", "/"),
      segments: test[2].split(/\s+>\s+/).map((part) => part.trim()).filter(Boolean),
    };
  }
  if (/^test:\s*/.test(cite)) return null;
  const path = /^(.+):(\d+)(?:-(\d+))?$/.exec(cite);
  if (path?.[1] && path[2]) {
    return {
      kind: "path",
      path: path[1].replaceAll("\\", "/"),
      start: Number.parseInt(path[2], 10),
      end: Number.parseInt(path[3] ?? path[2], 10),
    };
  }
  return null;
}

function occurrence(
  text: string,
  segment: string,
  cursor: number,
): { index: number; end: number } | null {
  const candidates = [segment, `def ${segment}`, `func ${segment}`]
    .map((needle) => ({ needle, index: text.indexOf(needle, cursor) }))
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index || left.needle.length - right.needle.length);
  const first = candidates[0];
  return first ? { index: first.index, end: first.index + first.needle.length } : null;
}

export function testSegmentsResolve(text: string, segments: string[]): boolean {
  let cursor = 0;
  for (const segment of segments) {
    const found = occurrence(text, segment, cursor);
    if (!found) return false;
    cursor = found.end;
  }
  return true;
}

function declarationIndent(line: string): number | null {
  if (
    !/(?:\b(?:describe|it|test)(?:\.(?:each)\s*\([^)]*\))?\s*\()|\b(?:it|test)\s*\.\w+\s*\(|^\s*def\s+test_\w*\s*\(|^\s*func\s+Test\w*\s*\(|\bt\.Run\s*\(|^\s*@Test\b|^\s*#\[test\]/.test(line)
  ) return null;
  return line.match(/^[ \t]*/)?.[0].length ?? 0;
}

export function testBlock(text: string, segments: string[]): CitationBlock | null {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  let cursor = 0;
  let last = -1;
  for (const segment of segments) {
    const found = occurrence(normalized, segment, cursor);
    if (!found) return null;
    last = found.index;
    cursor = found.end;
  }
  const before = normalized.slice(0, last);
  const start = before.split("\n").length;
  const lines = normalizedLines(normalized);
  const indentation = declarationIndent(lines[start - 1] ?? "");
  if (indentation === null) {
    const containing = [...lines.slice(0, start)].findLastIndex((line) => declarationIndent(line) !== null);
    if (containing < 0) return null;
    return testBlockAt(lines, containing, indentation);
  }
  return testBlockAt(lines, start - 1, indentation);
}

function testBlockAt(lines: string[], index: number, indentation: number | null): CitationBlock | null {
  const baseIndent = indentation ?? declarationIndent(lines[index] ?? "") ?? 0;
  let end = lines.length - 1;
  for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
    const nextIndent = declarationIndent(lines[candidate] ?? "");
    if (nextIndent !== null && nextIndent <= baseIndent) {
      end = candidate - 1;
      break;
    }
  }
  const values = joinLines(lines.slice(index, end + 1));
  return { start: index + 1, end: end + 1, ...values };
}

export function docSection(
  path: string,
  text: string,
  slug: string,
): { section: SpecSection; start: number; end: number } | null {
  const doc = parseDoc(path, text);
  const sectionIndex = doc.sections.findIndex((candidate) => candidate.slug === slug);
  const section = doc.sections[sectionIndex];
  if (!section) return null;
  const physical = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (physical.at(-1) === "") physical.pop();
  const location = sectionLocation(section);
  const next = doc.sections[sectionIndex + 1];
  const nextHeading = next ? sectionLocation(next).heading : physical.length + 1;
  return { section, start: location.start, end: Math.max(location.heading, nextHeading - 1) };
}

export function anchorBlock(cite: string, readFile: Reader): CitationBlock | null {
  const parsed = citationParts(cite);
  if (!parsed) return null;
  const file = readFile(parsed.path);
  if (file === null) return null;
  if (parsed.kind === "path") {
    const lines = normalizedLines(file);
    if (parsed.start < 1 || parsed.end < parsed.start || parsed.end > lines.length) return null;
    const values = joinLines(lines.slice(parsed.start - 1, parsed.end));
    return { start: parsed.start, end: parsed.end, ...values };
  }
  if (parsed.kind === "test") return testBlock(file, parsed.segments);
  const found = docSection(parsed.path, file, parsed.slug);
  if (!found) return null;
  const text = normalizedLines(found.section.text).join("\n");
  return {
    start: found.start,
    end: found.end,
    text,
    hash: sectionDigest(found.section.text),
  };
}

function citationsOf(section: SpecSection): string[] {
  const values = [...(section.requirements ?? []), ...(section.vision_items ?? [])];
  return values.flatMap((item) => item.cites ?? []);
}

export function anchorsFor(
  section: SpecSection,
  readFile: Reader,
): { anchors: Record<string, string>; texts: Record<string, string> } {
  const anchors: Record<string, string> = {};
  const texts: Record<string, string> = {};
  for (const cite of citationsOf(section)) {
    const block = anchorBlock(cite, readFile);
    if (!block) continue;
    anchors[cite] = block.hash;
    texts[cite] = block.text;
  }
  return { anchors, texts };
}

export function relocate(
  anchor: { hash: string; line_count: number },
  file: string,
): { start: number; end: number } | { matches: number } {
  if (anchor.line_count < 1) return { matches: 0 };
  const lines = normalizedLines(file);
  const matches: Array<{ start: number; end: number }> = [];
  for (let index = 0; index + anchor.line_count <= lines.length; index += 1) {
    const hash = `sha256:${sha256(lines.slice(index, index + anchor.line_count).join("\n"))}`;
    if (hash === anchor.hash) matches.push({ start: index + 1, end: index + anchor.line_count });
  }
  const match = matches[0];
  return matches.length === 1 && match ? match : { matches: matches.length };
}
