import { lstat, readFile, readdir } from "node:fs/promises";
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

function rebaseOutgoingLinks(
  text: string,
  source: string,
  destination: string,
  sectionSlug: string,
): string {
  return text.replace(/\]\(([^)]+)\)/g, (whole, href: string) => {
    if (!href || /^[A-Za-z]+:/.test(href) || href.startsWith("//")) return whole;
    if (href.startsWith("#")) {
      const fragment = href.slice(1);
      if (fragment === sectionSlug) return whole;
      const target = `${source}#${fragment}`;
      const relative = path.posix.relative(path.posix.dirname(destination), target) ||
        path.posix.basename(source);
      return `](${relative})`;
    }
    const resolved = resolvedHref(source, href);
    if (resolved === null) return whole;
    const [target, fragment] = resolved.split("#", 2);
    if (!target) return whole;
    const relative = path.posix.relative(path.posix.dirname(destination), target) ||
      path.posix.basename(target);
    return `](${relative}${fragment === undefined ? "" : `#${fragment}`})`;
  });
}

function idsIn(doc: ParsedDoc): string[] {
  return doc.sections.flatMap((section) =>
    [...section.vision_items, ...section.requirements, ...section.conflicts, ...section.questions]
      .map((item) => item.id),
  ).sort();
}

async function verifyIntegrity(
  original: ParsedDoc,
  source: string,
  sourceText: string,
  destination: string,
  movedText: string,
  cwd: string,
  sectionSlug: string,
): Promise<void> {
  const sourceDoc = parseDoc(source, sourceText);
  const movedDoc = parseDoc(destination, movedText);
  const before = idsIn(original);
  const after = [...idsIn(sourceDoc), ...idsIn(movedDoc)].sort();
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error(`Split of ${source} would change specification IDs.`);
  }
  if (!movedDoc.sections.some((section) => section.slug === sectionSlug)) {
    throw new Error(`Split of ${source} would lose #${sectionSlug}.`);
  }
  const planned = new Map([[source, sourceText], [destination, movedText]]);
  for (const match of movedText.matchAll(/\]\(([^)]+)\)/g)) {
    const href = match[1];
    if (!href || /^[A-Za-z]+:/.test(href) || href.startsWith("//")) continue;
    const resolved = href.startsWith("#")
      ? `${destination}${href}`
      : resolvedHref(destination, href);
    if (resolved === null) throw new Error(`Split of ${source} left an unresolved link ${href}.`);
    const [target, fragment] = resolved.split("#", 2);
    if (!target) continue;
    let targetText = planned.get(target);
    if (targetText === undefined) {
      try {
        targetText = await readFile(path.join(cwd, ...target.split("/")), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          throw new Error(`Split of ${source} left a missing link target ${target}.`);
        }
        throw error;
      }
    }
    if (fragment !== undefined && target.endsWith(".md")) {
      const targetDoc = parseDoc(target, targetText);
      if (!targetDoc.sections.some((section) => section.slug === fragment)) {
        throw new Error(`Split of ${source} left a missing anchor #${fragment} in ${target}.`);
      }
    }
  }
}

async function verifyPlannedLinks(
  cwd: string,
  planned: Map<string, string>,
): Promise<void> {
  for (const [from, contents] of planned) {
    for (const match of contents.matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1];
      if (!href || /^[A-Za-z]+:/.test(href) || href.startsWith("//")) continue;
      const resolved = href.startsWith("#")
        ? `${from}${href}`
        : resolvedHref(from, href);
      if (resolved === null) throw new Error(`Split left an unresolved link ${href} in ${from}.`);
      const [target, fragment] = resolved.split("#", 2);
      if (!target) continue;
      let targetText = planned.get(target);
      if (targetText === undefined) {
        try {
          targetText = await readFile(path.join(cwd, ...target.split("/")), "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(`Split left a missing link target ${target} in ${from}.`);
          }
          throw error;
        }
      }
      if (fragment !== undefined && target.endsWith(".md")) {
        const targetDoc = parseDoc(target, targetText);
        if (!targetDoc.sections.some((candidate) => candidate.slug === fragment)) {
          throw new Error(`Split left a missing anchor #${fragment} in ${target}.`);
        }
      }
    }
  }
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
  try {
    await lstat(absoluteDestination);
    throw new Error(`Split destination ${destination} already exists.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
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
  const movedText = compose(
    partFront,
    `${rebaseOutgoingLinks(movedLines.join("\n"), source, destination, sectionSlug).trim()}\n`,
  );
  const sourceText = compose(rawFront, `${replacedBody.trim()}\n`);
  const sourceWithLinks = updateLinks(sourceText, source, source, destination, sectionSlug);

  const updates: Array<{ filename: string; text: string }> = [];

  for (const filename of await markdownFiles(cwd)) {
    if (filename === destination) continue;
    const absoluteFile = path.join(cwd, ...filename.split("/"));
    const contents = filename === source
      ? sourceWithLinks
      : await readFile(absoluteFile, "utf8");
    const updated = updateLinks(contents, filename, source, destination, sectionSlug);
    if (updated !== contents || filename === source) updates.push({ filename, text: updated });
  }
  await verifyIntegrity(
    parsed,
    source,
    sourceWithLinks,
    destination,
    movedText,
    cwd,
    sectionSlug,
  );
  const planned = new Map(updates.map((update) => [update.filename, update.text]));
  planned.set(source, sourceWithLinks);
  planned.set(destination, movedText);
  await verifyPlannedLinks(cwd, planned);
  await writeAtomic(absoluteDestination, movedText);
  await writeAtomic(absolute, sourceWithLinks);
  for (const update of updates) {
    if (update.filename === source) continue;
    await writeAtomic(path.join(cwd, ...update.filename.split("/")), update.text);
  }
  return { moved: destination, pointer: source };
}

function bodyLines(text: string): string[] {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
