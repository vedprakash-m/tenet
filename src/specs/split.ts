import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import { confine, writeAtomic } from "../core/fs.js";
import { parseDoc, sectionLocation, type ParsedDoc } from "./parse.js";

export type SplitResult = {
  moved: string;
  pointer: string;
};

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function splitFront(text: string): { value: Record<string, unknown> | null; body: string } {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match?.[1]) return { value: null, body: normalized };
  const parsed = parseFront(match[1]);
  return { value: parsed, body: normalized.slice(match[0].length) };
}

function parseFront(value: string): Record<string, unknown> | null {
  try {
    const parsed = parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function compose(front: Record<string, unknown>, body: string): string {
  return `---\n${stringify(front, { lineWidth: 0 }).trimEnd()}\n---\n${body.replace(/^\n/, "")}`;
}

async function markdownFiles(root: string, relative = ""): Promise<string[]> {
  const result: string[] = [];
  for (const entry of await readdir(path.join(root, ...relative.split("/").filter(Boolean)), { withFileTypes: true })) {
    if (relative === "" && [".git", "node_modules", "dist", "build", ".tenet"].includes(entry.name)) continue;
    const filename = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) result.push(...await markdownFiles(root, filename));
    else if (entry.isFile() && entry.name.endsWith(".md")) result.push(filename);
  }
  return result;
}

function resolvedHref(from: string, href: string): string | null {
  if (!href || href.startsWith("#") || /^[A-Za-z]+:/.test(href) || href.startsWith("//")) return null;
  const [pathname, fragment] = href.split("#", 2);
  if (!pathname) return null;
  const normalized = path.posix.normalize(path.posix.join(path.posix.dirname(from), pathname));
  if (normalized.startsWith("../") || normalized === "..") return null;
  return `${normalized}${fragment === undefined ? "" : `#${fragment}`}`;
}

function updateLinks(
  text: string,
  source: string,
  oldTarget: string,
  newTarget: string,
  sectionSlug: string,
): string {
  return text.replace(/\]\(([^)]+)\)/g, (whole, href: string) => {
    const to = path.posix.relative(path.posix.dirname(source), newTarget) || path.posix.basename(newTarget);
    if (source === oldTarget && href === `#${sectionSlug}`) {
      return `](${to}#${sectionSlug})`;
    }
    const resolved = resolvedHref(source, href);
    if (resolved !== `${oldTarget}#${sectionSlug}`) return whole;
    return `](${to}#${sectionSlug})`;
  });
}

function sectionRecords(front: Record<string, unknown>): Record<string, Record<string, unknown>> {
  const sections = front.sections;
  return sections && typeof sections === "object" && !Array.isArray(sections)
    ? sections as Record<string, Record<string, unknown>>
    : {};
}

export async function split(
  doc: string | ParsedDoc,
  section: string | { slug: string },
  workingDirectory = process.cwd(),
): Promise<SplitResult> {
  const sectionSlug = typeof section === "string" ? section : section.slug;
  const rawPath = typeof doc === "string" ? doc : doc.path;
  const cwd = path.resolve(workingDirectory);
  if (path.isAbsolute(rawPath)) throw new RangeError("Split document path must be relative to the repository.");
  const absolute = await confine(rawPath, cwd);
  const source = portable(path.relative(cwd, absolute));
  const text = await readFile(absolute, "utf8");
  const parsed = parseDoc(source, text);
  const selected = parsed.sections.find((candidate) => candidate.slug === sectionSlug);
  if (!selected) throw new RangeError(`Section ${sectionSlug} was not found in ${source}.`);
  const { body, value: rawFront } = splitFront(text);
  if (!rawFront || !parsed.front) throw new Error(`${source} has no valid specification front matter.`);

  const next = parsed.sections[parsed.sections.indexOf(selected) + 1];
  const headingLine = sectionLocation(selected).heading;
  const nextLine = next ? sectionLocation(next).heading : bodyLines(text).length + 1;
  const documentLines = bodyLines(text);
  const bodyOnlyLines = bodyLines(body);
  const offset = documentLines.length - bodyOnlyLines.length;
  const movedLines = bodyOnlyLines.slice(headingLine - 1 - offset, nextLine - 1 - offset);
  const destination = portable(path.posix.join(
    path.posix.dirname(source),
    path.posix.basename(source, ".md"),
    `${sectionSlug}.md`,
  ));
  const absoluteDestination = await confine(destination, cwd);
  const relativeDestination = path.posix.relative(path.posix.dirname(source), destination);
  const pointer = `## ${selected.heading}\n\nSee [${selected.heading}](${relativeDestination}#${sectionSlug}).`;
  const replacedBody = [
    ...bodyOnlyLines.slice(0, headingLine - 1 - offset),
    pointer,
    ...bodyOnlyLines.slice(nextLine - 1 - offset),
  ].join("\n");
  const records = sectionRecords(rawFront);
  const movedRecord = records[sectionSlug] ?? { state: "draft", digest: selected.digest, flags: [] };
  delete records[sectionSlug];
  rawFront.sections = records;
  const partFront: Record<string, unknown> = {
    tenet: rawFront.tenet,
    sections: { [sectionSlug]: movedRecord },
  };

  await writeAtomic(absoluteDestination, compose(partFront, `${movedLines.join("\n").trim()}\n`));
  await writeAtomic(absolute, compose(rawFront, `${replacedBody.trim()}\n`));

  for (const filename of await markdownFiles(cwd)) {
    if (filename === destination) continue;
    const absoluteFile = path.join(cwd, ...filename.split("/"));
    const contents = await readFile(absoluteFile, "utf8");
    const updated = updateLinks(contents, filename, source, destination, sectionSlug);
    if (updated !== contents) await writeAtomic(absoluteFile, updated);
  }
  return { moved: destination, pointer: source };
}

function bodyLines(text: string): string[] {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
