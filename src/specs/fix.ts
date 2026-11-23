import { readFileSync } from "node:fs";
import { mkdir, readFile, rename } from "node:fs/promises";
import path from "node:path";
import { parse, stringify } from "yaml";
import { writeAtomic } from "../core/fs.js";
import { catFileBatch, git } from "../core/git.js";
import { jcs } from "../core/hash.js";
import { loadPolicy } from "../policy/index.js";
import type { Policy } from "../policy/types.js";
import { citationParts, relocate } from "./anchors.js";
import { flags, matchRenamed } from "./flags.js";
import { ladder, type LadderEntry } from "./ladder.js";
import { itemLine, parseDoc, sectionLocation, type SpecSection } from "./parse.js";

export type FixOptions = {
  cwd?: string;
  dryRun?: boolean;
};

export type FixResult = {
  changes: Array<{ path: string; action: string }>;
};

type Front = {
  tenet: Record<string, unknown>;
  sections: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
};

type IdOccurrence = {
  id: string;
  path: string;
  line: number;
  state: string;
  signature: string;
  authoredAt?: number;
};

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/\/+/g, "/").replace(/^(?:\.\/)+/, "");
}

function readSyncReader(cwd: string): (filename: string) => string | null {
  return (filename) => {
    try {
      return readFileSync(path.join(cwd, ...portable(filename).split("/")), "utf8");
    } catch {
      return null;
    }
  };
}

function splitFront(text: string): { front: Front | null; body: string } {
  const normalized = text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(normalized);
  if (!match?.[1]) return { front: null, body: normalized };
  const parsed = parse(match[1]) as unknown;
  const record = parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : null;
  const tenet = record?.tenet;
  const sections = record?.sections;
  if (!record || !tenet || typeof tenet !== "object" || Array.isArray(tenet)) {
    return { front: null, body: normalized };
  }
  return {
    front: {
      ...record,
      tenet: tenet as Record<string, unknown>,
      sections: sections && typeof sections === "object" && !Array.isArray(sections)
        ? sections as Record<string, Record<string, unknown>>
        : {},
    },
    body: normalized.slice(match[0].length),
  };
}

function compose(front: Front, body: string): string {
  return `---\n${stringify(front, { lineWidth: 0 }).trimEnd()}\n---\n${body.replace(/^\n/, "")}`;
}

function inferredDoc(filename: string): string {
  const name = path.posix.basename(filename, ".md");
  const allowed = new Set(["intent", "vision", "requirements", "design", "experience", "plan", "prd", "tech-spec", "ux-spec"]);
  if (allowed.has(name)) return name;
  if (filename.includes("/prd/")) return "prd";
  if (filename.includes("/tech-spec/")) return "tech-spec";
  if (filename.includes("/plan/")) return "plan";
  return "requirements";
}

function docOwner(policy: Policy, filename: string): string {
  const relative = filename.startsWith(`${policy.paths.records}/`)
    ? filename.slice(policy.paths.records.length + 1)
    : filename;
  return policy.specs.documents.find((document) => document.path === relative)?.owner ?? "Owner";
}

function docLevel(policy: Policy, filename: string): string {
  const relative = filename.startsWith(`${policy.paths.records}/`)
    ? filename.slice(policy.paths.records.length + 1)
    : filename;
  return policy.specs.documents.find((document) => document.path === relative)?.level ?? "L2";
}

function frontFor(entry: LadderEntry, current: Front | null, policy: Policy, head: string): Front {
  const front = current ?? {
    tenet: {
      spec: 1,
      doc: inferredDoc(entry.path),
      level: docLevel(policy, entry.path),
      version: "0.1",
      owner: docOwner(policy, entry.path),
    },
    sections: {},
  };
  if (typeof front.tenet.drafted_from !== "string" || front.tenet.drafted_from === "") {
    front.tenet.drafted_from = head;
  }
  return front;
}

function occurrences(entries: LadderEntry[], prefix: string): IdOccurrence[] {
  const result: IdOccurrence[] = [];
  for (const entry of entries) {
    for (const section of entry.doc.sections) {
      for (const item of [...section.vision_items, ...section.requirements]) {
        const line = itemLine(item);
        if (line === null || !item.id.startsWith(`${prefix}-`)) continue;
        result.push({ id: item.id, path: entry.path, line, state: section.state, signature: jcs(item) });
      }
    }
  }
  return result;
}

function idNumber(id: string): number {
  const match = /-(\d+)$/.exec(id);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

async function otherBranchOccurrences(cwd: string, prefix: string): Promise<IdOccurrence[]> {
  const currentCommit = (await git(["rev-parse", "HEAD"], { cwd }).catch(() => "")).trim();
  const refsText = await git(
    ["for-each-ref", "--format=%(refname)%09%(objectname)%09%(committerdate:unix)", "refs/heads", "refs/remotes"],
    { cwd },
  ).catch(() => "");
  const currentRef = (await git(["symbolic-ref", "--quiet", "HEAD"], { cwd }).catch(() => "")).trim();
  const refs = refsText.split("\n").flatMap((line) => {
    const [ref, commit, timestamp] = line.split("\t");
    return !ref || !commit || !timestamp || ref === currentRef || commit === currentCommit || ref.endsWith("/HEAD")
      ? []
      : [{ ref, timestamp: Number.parseInt(timestamp, 10) }];
  });
  const result: IdOccurrence[] = [];
  for (const { ref, timestamp } of refs) {
    const listing = await git(["ls-tree", "-r", "-z", "--name-only", ref], { cwd }).catch(() => "");
    const paths = listing.split("\0").filter((filename) => filename.endsWith(".md"));
    if (paths.length === 0) continue;
    const blobs = await catFileBatch(ref, paths, { cwd });
    for (const filename of paths) {
      const contents = blobs.get(filename)?.toString("utf8");
      if (contents === undefined) continue;
      const doc = parseDoc(filename, contents, { prefix });
      if (!doc.front) continue;
      for (const section of doc.sections) {
        for (const item of [...section.vision_items, ...section.requirements]) {
          result.push({
            id: item.id,
            path: filename,
            line: itemLine(item) ?? 1,
            state: section.state,
            signature: jcs(item),
            authoredAt: timestamp,
          });
        }
      }
    }
  }
  return result;
}

function bodyLines(text: string): string[] {
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
}

function lineScope(section: SpecSection): boolean {
  return section.level === "L0" ||
    section.slug === "vision" ||
    /\bvision\b/i.test(section.heading) ||
    section.slug === "requirements" ||
    /\brequirements?\b/i.test(section.heading);
}

function assignMissingIds(
  text: string,
  doc: ReturnType<typeof parseDoc>,
  prefix: string,
  nextRequirement: () => number,
  nextVision: () => number,
): string {
  const lines = bodyLines(text);
  for (const section of doc.sections) {
    if (!lineScope(section)) continue;
    const location = sectionLocation(section);
    const vision = section.level === "L0" || section.slug === "vision" || /\bvision\b/i.test(section.heading);
    for (let index = 0; index < section.text.replace(/\n$/, "").split("\n").length; index += 1) {
      const physical = location.start + index;
      const source = lines[physical - 1] ?? "";
      if (!/^\s*[-*+]\s+(?:\[[ xX]\]\s+)?/.test(source)) continue;
      const cleaned = source.trim().replace(/^[-*+]\s+(?:\[[ xX]\]\s+)?/, "");
      const expected = vision ? /^V-(?:[A-Z]+)?\d+\b/ : new RegExp(`^${prefix}-\\d+\\b`);
      if (expected.test(cleaned)) continue;
      const id = vision ? `V-${nextVision()}` : `${prefix}-${nextRequirement()}`;
      lines[physical - 1] = source.replace(
        /^(\s*[-*+]\s+(?:\[[ xX]\]\s+)?)/,
        `$1${id} `,
      );
    }
  }
  return lines.join("\n");
}

function replaceId(text: string, line: number, from: string, to: string): string {
  const lines = bodyLines(text);
  const index = line - 1;
  const current = lines[index];
  if (current !== undefined) lines[index] = current.replace(from, to);
  return lines.join("\n");
}

function normalizeCitation(cite: string): string {
  const trimmed = cite.trim();
  const parsed = citationParts(trimmed);
  if (!parsed) return trimmed;
  const cleanPath = portable(parsed.path);
  if (parsed.kind === "path") return `${cleanPath}:${parsed.start}${parsed.end === parsed.start ? "" : `-${parsed.end}`}`;
  if (parsed.kind === "doc") return `doc: ${cleanPath}#${parsed.slug}`;
  return `test: ${cleanPath} > ${parsed.segments.join(" > ")}`;
}

function replaceOccurrenceId(
  text: string,
  occurrence: IdOccurrence,
  to: string,
  prefix: string,
): string {
  const parsed = parseDoc(occurrence.path, text, { prefix });
  const candidates = parsed.sections
    .flatMap((section) => [...section.vision_items, ...section.requirements])
    .filter((item) => item.id === occurrence.id && jcs(item) === occurrence.signature);
  const target = candidates[0];
  const line = target ? itemLine(target) : occurrence.line;
  if (line === null) return text;
  return replaceId(text, line, occurrence.id, to);
}

function movedCitation(
  cite: string,
  anchors: Record<string, unknown>,
  read: (filename: string) => string | null,
): string {
  const parsed = citationParts(cite);
  if (parsed?.kind !== "path") return normalizeCitation(cite);
  const rawHash = anchors[cite];
  if (typeof rawHash !== "string") return normalizeCitation(cite);
  const file = read(parsed.path);
  if (file === null) return normalizeCitation(cite);
  const moved = relocate({ hash: rawHash, line_count: parsed.end - parsed.start + 1 }, file);
  if (!("start" in moved)) return normalizeCitation(cite);
  return `${portable(parsed.path)}:${moved.start}${moved.end === moved.start ? "" : `-${moved.end}`}`;
}

function normalizeCitationsInBody(
  text: string,
  anchors: Record<string, unknown>,
  read: (filename: string) => string | null,
): string {
  return text.replace(/\bcites:\s*([^;}]+)/g, (_whole, raw: string) => {
    const values = raw.split(",").map((value) => {
      const oldCitation = value.trim();
      const next = movedCitation(oldCitation, anchors, read);
      if (next !== oldCitation && Object.hasOwn(anchors, oldCitation)) {
        anchors[next] = anchors[oldCitation];
        delete anchors[oldCitation];
      }
      return next;
    });
    return `cites: ${values.join(", ")}`;
  });
}

function moveRenames(
  front: Front,
  sections: SpecSection[],
): Array<{ from: string; to: string }> {
  const matches = matchRenamed(front, sections);
  const moved: Array<{ from: string; to: string }> = [];
  for (const item of matches.renamed) {
    const old = front.sections[item.from];
    if (!old) continue;
    front.sections[item.to] = old;
    delete front.sections[item.from];
    moved.push({ from: item.from, to: item.to });
  }
  return moved;
}

async function moveBlessedCopy(
  front: Front,
  moved: Array<{ from: string; to: string }>,
  cwd: string,
  dryRun: boolean,
): Promise<FixResult["changes"]> {
  const changes: FixResult["changes"] = [];
  for (const item of moved) {
    const metadata = front.sections[item.to];
    if (!metadata || typeof metadata.blessed_copy !== "string") continue;
    const oldCopy = portable(metadata.blessed_copy);
    const newCopy = `${path.posix.dirname(oldCopy)}/${item.to}.md`;
    metadata.blessed_copy = newCopy;
    if (!dryRun && oldCopy !== newCopy) {
      await mkdir(path.join(cwd, ...path.posix.dirname(newCopy).split("/")), { recursive: true });
      await rename(path.join(cwd, ...oldCopy.split("/")), path.join(cwd, ...newCopy.split("/"))).catch(() => undefined);
      await rename(path.join(cwd, ...`${oldCopy}.anchors.json`.split("/")), path.join(cwd, ...`${newCopy}.anchors.json`.split("/"))).catch(() => undefined);
    }
    changes.push({ path: newCopy, action: "move-blessed-copy" });
  }
  return changes;
}

function setSections(front: Front, doc: ReturnType<typeof parseDoc>, cwd: string): void {
  const read = readSyncReader(cwd);
  for (const section of doc.sections) {
    const metadata = front.sections[section.slug] ?? {};
    const anchors = metadata.anchors && typeof metadata.anchors === "object" && !Array.isArray(metadata.anchors)
      ? metadata.anchors as Record<string, unknown>
      : {};
    const updated: Record<string, unknown> = {
      ...metadata,
      state: metadata.state ?? "draft",
      digest: section.digest,
      flags: flags(section, read),
    };
    if (Object.keys(anchors).length > 0) updated.anchors = anchors;
    front.sections[section.slug] = updated;
  }
}

function removeOrphans(front: Front, doc: ReturnType<typeof parseDoc>): void {
  const present = new Set(doc.sections.map((section) => section.slug));
  for (const slug of Object.keys(front.sections)) {
    if (!present.has(slug)) delete front.sections[slug];
  }
}

export async function fix(options: FixOptions = {}): Promise<FixResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const policy = await loadPolicy({ cwd });
  const prefix = policy.specs.id_prefix;
  const discovered = await ladder({ cwd });
  const known = new Map(discovered.map((entry) => [entry.path, entry]));
  for (const document of policy.specs.documents) {
    const filename = portable(path.posix.join(policy.paths.records, document.path));
    if (known.has(filename)) continue;
    try {
      const text = await readFile(path.join(cwd, ...filename.split("/")), "utf8");
      known.set(filename, {
        path: filename,
        level: document.level,
        doc: parseDoc(filename, text, { prefix }),
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const entries = [...known.values()].sort((left, right) => left.path.localeCompare(right.path));
  const requirementIds = occurrences(entries, prefix).filter((item) => item.id.startsWith(`${prefix}-`));
  const visionIds = entries.flatMap((entry) => entry.doc.sections.flatMap((section) =>
    section.vision_items.map((item) => ({
      id: item.id,
      path: entry.path,
      line: itemLine(item),
      state: section.state,
      signature: jcs(item),
    }))
  )).filter((item): item is IdOccurrence => item.line !== null);
  const branchIds = await otherBranchOccurrences(cwd, prefix);
  let nextRequirement = Math.max(0, ...requirementIds.map((item) => idNumber(item.id)),
    ...branchIds.filter((item) => item.id.startsWith(`${prefix}-`)).map((item) => idNumber(item.id))) + 1;
  let nextVision = Math.max(0, ...visionIds.map((item) => idNumber(item.id)),
    ...branchIds.filter((item) => item.id.startsWith("V-")).map((item) => idNumber(item.id))) + 1;

  const head = (await git(["rev-parse", "HEAD"], { cwd }).catch(() => "")).trim();
  const headTime = Number.parseInt((await git(["show", "-s", "--format=%ct", head || "HEAD"], { cwd }).catch(() => "0")).trim(), 10) || 0;
  const perFile = new Map<string, string>();
  const copyMoves: FixResult["changes"] = [];
  for (const entry of entries) {
    const original = await readFile(path.join(cwd, ...entry.path.split("/")), "utf8");
    const { front, body } = splitFront(original);
    let text = front ? original : body;
    text = assignMissingIds(
      text,
      parseDoc(entry.path, text, { prefix }),
      prefix,
      () => nextRequirement++,
      () => nextVision++,
    );
    let parsedAfterIds = parseDoc(entry.path, text, { prefix });
    for (const problem of parsedAfterIds.problems) {
      if (problem.code !== "TN-SPEC-DUP-ID" || problem.line === null) continue;
      const duplicate = parsedAfterIds.sections.find((candidate) => {
        const start = sectionLocation(candidate).start;
        return problem.line !== null && problem.line >= start &&
          problem.line < start + candidate.text.replace(/\n$/, "").split("\n").length;
      });
      if (duplicate?.state === "blessed") continue;
      const match = /Duplicate specification ID ([A-Z][A-Z0-9]*(?:-[A-Z]+)?-\d+)\./.exec(problem.message);
      const id = match?.[1];
      if (!id) continue;
      text = replaceId(
        text,
        problem.line,
        id,
        id.startsWith("V-") ? `V-${nextVision++}` : `${prefix}-${nextRequirement++}`,
      );
    }
    parsedAfterIds = parseDoc(entry.path, text, { prefix });
    const completeFront = frontFor(entry, front, policy, head || "working-tree");
    const renamed = moveRenames(completeFront, parsedAfterIds.sections);
    copyMoves.push(...await moveBlessedCopy(completeFront, renamed, cwd, Boolean(options.dryRun)));
    let bodyAfter = front ? splitFront(text).body : text;
    const read = readSyncReader(cwd);
    for (const section of parsedAfterIds.sections) {
      const metadata = completeFront.sections[section.slug] ?? {};
      const anchors = metadata.anchors && typeof metadata.anchors === "object" && !Array.isArray(metadata.anchors)
        ? metadata.anchors as Record<string, unknown>
        : {};
      bodyAfter = normalizeCitationsInBody(bodyAfter, anchors, read);
    }
    const reparsed = parseDoc(entry.path, compose(completeFront, bodyAfter), { prefix });
    removeOrphans(completeFront, reparsed);
    setSections(completeFront, reparsed, cwd);
    perFile.set(entry.path, compose(completeFront, bodyAfter));
  }

  const byId = new Map<string, IdOccurrence[]>();
  for (const occurrence of [...requirementIds, ...visionIds]) {
    const list = byId.get(occurrence.id) ?? [];
    list.push(occurrence);
    byId.set(occurrence.id, list);
  }
  for (const [id, list] of [...byId.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (list.length < 2) continue;
    const blessed = list.filter((item) => item.state === "blessed");
    if (blessed.length > 0) {
      for (const occurrence of list.filter((item) => item.state !== "blessed")) {
        const text = perFile.get(occurrence.path);
        if (!text) continue;
        perFile.set(
          occurrence.path,
          replaceOccurrenceId(
            text,
            occurrence,
            id.startsWith("V-") ? `V-${nextVision++}` : `${prefix}-${nextRequirement++}`,
            prefix,
          ),
        );
      }
      continue;
    }
    const ordered = [...list].sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line);
    for (const occurrence of ordered.slice(1)) {
      const text = perFile.get(occurrence.path);
      if (!text) continue;
      perFile.set(
        occurrence.path,
        replaceOccurrenceId(
          text,
          occurrence,
          id.startsWith("V-") ? `V-${nextVision++}` : `${prefix}-${nextRequirement++}`,
          prefix,
        ),
      );
    }
  }
  for (const occurrence of [...requirementIds, ...visionIds]) {
    if (occurrence.state === "blessed") continue;
    const conflicting = branchIds.filter((item) =>
      item.id === occurrence.id && item.signature !== occurrence.signature
    );
    const otherBlessed = conflicting.some((item) => item.state === "blessed");
    const currentIsNewer =
      headTime >= Math.max(...conflicting.map((item) => item.authoredAt ?? 0));
    if (conflicting.length === 0 || (!otherBlessed && !currentIsNewer)) continue;
    const text = perFile.get(occurrence.path);
    if (!text) continue;
    perFile.set(
      occurrence.path,
      replaceOccurrenceId(
        text,
        occurrence,
        occurrence.id.startsWith("V-") ? `V-${nextVision++}` : `${prefix}-${nextRequirement++}`,
        prefix,
      ),
    );
  }

  const changes: FixResult["changes"] = [...copyMoves];
  for (const entry of entries) {
    const filename = entry.path;
    const before = await readFile(path.join(cwd, ...filename.split("/")), "utf8");
    const candidate = perFile.get(filename);
    if (candidate === undefined || candidate === before) continue;
    changes.push({ path: filename, action: "repair" });
    if (!options.dryRun) await writeAtomic(path.join(cwd, ...filename.split("/")), candidate);
  }

  return { changes };
}
