import { sha256 } from "../core/hash.js";
import { anchorBlock, citationParts, relocate } from "./anchors.js";
import type { SpecSection } from "./parse.js";

export { relocate } from "./anchors.js";

type Reader = (path: string) => string | null;
type FlagSection = SpecSection | Record<string, unknown>;

function field(section: FlagSection, key: string): unknown {
  return (section as Record<string, unknown>)[key];
}

function normalizedRange(file: string, start: number, end: number): string | null {
  const lines = file.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (start < 1 || end < start || end > lines.length) return null;
  return lines.slice(start - 1, end).map((line) => line.replace(/[ \t]+$/, "")).join("\n");
}

function pathCitationMoved(cite: string, expected: string, file: string): boolean {
  const parsed = citationParts(cite);
  if (parsed?.kind !== "path") return false;
  const normalized = file.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length > 50_000) return false;
  const result = relocate({ hash: expected, line_count: parsed.end - parsed.start + 1 }, file);
  return "start" in result;
}

export function flags(section: FlagSection, readFile: Reader): Array<"edited" | "sources-changed"> {
  if (field(section, "state") !== "blessed") return [];
  const result: Array<"edited" | "sources-changed"> = [];
  if (field(section, "digest") !== field(section, "blessed_digest")) result.push("edited");
  const anchors = field(section, "anchors");
  if (!anchors || typeof anchors !== "object" || Array.isArray(anchors)) return result;
  for (const [cite, rawHash] of Object.entries(anchors as Record<string, unknown>)) {
    const expected = String(rawHash);
    const parsed = citationParts(cite);
    if (!parsed) {
      result.push("sources-changed");
      break;
    }
    const file = readFile(parsed.path);
    if (file === null) {
      result.push("sources-changed");
      break;
    }
    if (parsed.kind === "path") {
      const actual = normalizedRange(file, parsed.start, parsed.end);
      const hash = actual === null ? null : `sha256:${sha256(actual)}`;
      if (hash !== expected && !pathCitationMoved(cite, expected, file)) {
        result.push("sources-changed");
        break;
      }
      continue;
    }
    const actual = anchorBlock(cite, readFile);
    if (!actual || actual.hash !== expected) {
      result.push("sources-changed");
      break;
    }
  }
  return result;
}

type Front = {
  sections?: Record<string, { digest?: string | null; blessed_digest?: string | null }>;
};

export function matchRenamed(
  front: Front | Record<string, unknown>,
  sections: Array<{ slug: string; digest: string }>,
): { renamed: Array<{ from: string; to: string; digest: string }>; ambiguous: Array<{ from: string; candidates: string[] }> } {
  const frontSections = (front as Front).sections ?? {};
  const existing = new Set(Object.keys(frontSections));
  const candidates = sections.filter((section) =>
    !existing.has(section.slug) &&
    section.slug !== "_preamble" &&
    section.slug !== "conflicts" &&
    section.slug !== "open-questions"
  );
  const renamed: Array<{ from: string; to: string; digest: string }> = [];
  const ambiguous: Array<{ from: string; candidates: string[] }> = [];
  for (const [from, metadata] of Object.entries(frontSections)) {
    if (sections.some((section) => section.slug === from)) continue;
    let digest = metadata.digest ?? null;
    let matched = digest === null ? [] : candidates.filter((section) => section.digest === digest);
    if (matched.length === 0) {
      digest = metadata.blessed_digest ?? null;
      matched = digest === null ? [] : candidates.filter((section) => section.digest === digest);
    }
    const single = matched[0];
    if (matched.length === 1 && digest !== null && single) {
      renamed.push({ from, to: single.slug, digest });
    } else if (matched.length > 1) {
      ambiguous.push({ from, candidates: matched.map((section) => section.slug) });
    }
  }
  const useCounts = new Map<string, number>();
  for (const item of renamed) useCounts.set(item.to, (useCounts.get(item.to) ?? 0) + 1);
  return {
    renamed: renamed.filter((item) => (useCounts.get(item.to) ?? 0) === 1),
    ambiguous,
  };
}
