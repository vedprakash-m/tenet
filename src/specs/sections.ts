import { sha256 } from "../core/hash.js";

const citedPath =
  /(?:[A-Za-z0-9._-]+(?:\/[A-Za-z0-9._-]+)+|[A-Za-z0-9._-]+\.[A-Za-z][A-Za-z0-9]*):\d+(?:-\d+)?/g;

function protectedToken(normalized: string, offset: number): boolean {
  let start = offset;
  while (start > 0 && !/\s/.test(normalized[start - 1] ?? "")) start -= 1;
  let end = offset;
  while (end < normalized.length && !/\s/.test(normalized[end] ?? "")) end += 1;
  const token = normalized.slice(start, end);
  return token.includes("://") || /sha256:/i.test(token);
}

export function sectionDigest(body: string): string {
  const lines = body.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) lines[index] = lines[index]?.replace(/[ \t]+$/, "") ?? "";
  while (lines.length > 0 && lines.at(-1)?.trim() === "") lines.pop();
  const normalized = lines.join("\n");
  const withoutRanges = normalized.replace(citedPath, (match, offset: number) => {
    if (protectedToken(normalized, offset)) return match;
    return match.replace(/:\d+(?:-\d+)?$/, "");
  });
  return `sha256:${sha256(withoutRanges)}`;
}

export function slugFor(heading: string, position: number): string {
  const slug = heading
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || `section-${String(position)}`;
}
