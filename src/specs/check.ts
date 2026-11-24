import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import { jcs } from "../core/hash.js";
import { message } from "../core/messages.js";
import { validate } from "../core/schema.js";
import { version as installedPackageVersion } from "../core/output.js";
import { catFileBatch, git } from "../core/git.js";
import { loadKit, loadPolicy, ruleMode } from "../policy/index.js";
import type { Policy } from "../policy/types.js";
import type { Finding } from "../types/generated.js";
import { citationParts } from "./anchors.js";
import { resolveCitations } from "./citations.js";
import { flags } from "./flags.js";
import { ladder, type LadderEntry } from "./ladder.js";
import { parseDoc, itemLine, sectionLocation, type ParsedDoc, type Requirement, type SpecSection } from "./parse.js";
import { sectionDigest } from "./sections.js";

export type CheckOptions = {
  cwd?: string;
  paths?: string[];
  pack?: boolean | string;
  ci?: boolean;
  base?: string;
  installedVersion?: string;
};

export type CheckSummary = {
  errors: number;
  warnings: number;
  advises: number;
};

export type CheckResult = {
  findings: Finding[];
  summary: CheckSummary;
};

const rules = {
  "TN-BUDGET": "budget",
  "TN-BUDGET-WARN": "budget",
  "TN-KIT-EDITED": null,
  "TN-LOCK-MISMATCH": null,
  "TN-SCHEMA": null,
  "TN-SPEC-BLESSED-COPY": null,
  "TN-SPEC-DUP-ID": null,
  "TN-SPEC-UNCOVERED-VISION": null,
  "TN-SPEC-REQ-META": null,
} as const;

type MessageCode = keyof typeof rules;

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function makeFinding(
  code: MessageCode,
  severity: Finding["severity"],
  file: string | null,
  line: number | null,
  values: Record<string, string>,
): Finding {
  const words = message(code, values);
  return {
    code,
    severity,
    rule: rules[code],
    file,
    line,
    message: words.message,
    fix: words.fix,
  };
}

async function readOptional(filename: string): Promise<string | null> {
  try {
    return await readFile(filename, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function parseYaml(text: string): unknown {
  const document = parseDocument(text, { merge: false, prettyErrors: true, uniqueKeys: true });
  if (document.errors.length > 0) throw document.errors[0] ?? new Error("invalid YAML");
  return document.toJS({ maxAliasCount: 100 });
}

function schemaFindings(pathname: string, schema: "tenet-yaml" | "spec-front-matter" | "pack" | "lock", value: unknown): Finding[] {
  const checked = validate(schema, value);
  if (checked.ok) return [];
  return checked.errors.map((error) =>
    makeFinding("TN-SCHEMA", "error", portable(pathname), null, {
      path: portable(pathname),
      schema,
      pointer: error.pointer || "/",
    }),
  );
}

function documentList(policy: Policy): Array<{ path: string; budget?: number }> {
  const records = policy.paths.records;
  return policy.specs.documents.map((document) => ({
    path: portable(path.posix.join(records, document.path)),
    ...(document.budget === undefined ? {} : { budget: document.budget }),
  }));
}

function defaultBudget(filename: string): number | null {
  const lower = filename.toLowerCase();
  if (lower === "agents.md") return 3_000;
  if (lower.endsWith("/now.md")) return 6_000;
  if (lower.endsWith("/vision.md")) return 4_000;
  if (lower.endsWith("/prd.md")) return 9_000;
  if (lower.includes("/prd/") && lower.endsWith(".md")) return 7_000;
  if (lower.endsWith("/catalog.md")) return 7_000;
  if (lower.endsWith("/tech-spec.md")) return 12_000;
  if (lower.endsWith("/ux-spec.md")) return 6_000;
  if (lower.endsWith("/plan.md")) return 6_000;
  if (lower.includes("/plan/") && lower.endsWith(".md")) return 6_000;
  if (lower.includes("/tech-spec/") && lower.endsWith(".md")) return 6_000;
  return null;
}

function tokens(text: string): number {
  return Math.ceil(text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").length / 4);
}

async function baseTexts(cwd: string, base: string | undefined, paths: string[]): Promise<Map<string, string | null>> {
  const result = new Map<string, string | null>(
    paths.map((filename) => [portable(filename), null]),
  );
  if (!base || paths.length === 0) return result;
  const wanted = new Set(paths.map(portable));
  const listing = await git(["ls-tree", "-r", "-z", "--name-only", base, "--", ...paths.map(portable)], { cwd })
    .catch(() => "");
  const existing = listing.split("\0").filter((filename) => wanted.has(portable(filename)));
  const blobs = existing.length === 0 ? new Map<string, Buffer>() : await catFileBatch(base, existing, { cwd });
  for (const filename of existing) {
    const contents = blobs.get(filename);
    if (contents) result.set(portable(filename), contents.toString("utf8"));
  }
  return result;
}

function checkBudget(
  pathname: string,
  text: string,
  limit: number,
  options: CheckOptions,
  previous: string | null,
  mode: Policy["rules"][string],
): Finding[] {
  const currentTokens = tokens(text);
  if (options.ci && options.base && currentTokens > limit) {
    const before = previous === null ? 0 : tokens(previous);
    if (before <= limit) {
      if (mode === "observe") return [];
      return [makeFinding("TN-BUDGET", mode === "enforce" ? "error" : "advise", pathname, null, {
        path: pathname,
        tokens: String(currentTokens),
        limit: String(limit),
      })];
    }
    return [];
  }
  if (!(options.ci && options.base) && currentTokens >= Math.ceil(limit * 0.9)) {
    return [makeFinding("TN-BUDGET-WARN", "warning", pathname, null, {
      path: pathname,
      tokens: String(currentTokens),
      limit: String(limit),
    })];
  }
  return [];
}

function sectionRecord(front: Record<string, unknown> | null, slug: string): Record<string, unknown> {
  if (!front) return {};
  const sections = front.sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) return {};
  const value = (sections as Record<string, unknown>)[slug];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function requirementsOf(doc: ParsedDoc): Array<{ section: SpecSection; item: Requirement }> {
  return doc.sections.flatMap((section) =>
    section.requirements.map((item) => ({ section, item })),
  );
}

function visionOf(doc: ParsedDoc): Array<{ section: SpecSection; item: Requirement }> {
  return doc.sections.flatMap((section) =>
    section.vision_items.map((item) => ({ section, item })),
  );
}

function specificationItems(entry: LadderEntry): Array<{ id: string; line: number | null }> {
  return entry.doc.sections.flatMap((section) =>
    [...section.vision_items, ...section.requirements, ...section.conflicts, ...section.questions]
      .map((item) => ({ id: item.id, line: itemLine(item) })),
  );
}

function localProblems(entry: LadderEntry): Finding[] {
  return entry.doc.problems.flatMap((finding) => {
    if (finding.code !== "TN-SPEC-DUP-ID") return [finding];
    const id = /^Duplicate specification ID (.+)\.$/.exec(finding.message)?.[1];
    if (!id || finding.line === null) return [];
    const occurrence = specificationItems(entry).find((item) => item.id === id);
    return occurrence?.line === finding.line
      ? []
      : [makeFinding("TN-SPEC-DUP-ID", "error", entry.path, finding.line, { id })];
  });
}

function duplicateIdFindings(entries: LadderEntry[], crossDocument = true): Finding[] {
  const groups = new Map<number, Map<string, Array<{ path: string; line: number | null }>>>();
  const occurrences = new Map<string, Array<{ path: string; line: number | null }>>();
  const rank = (level: string | null) => level && /^L\d$/.test(level) ? Number(level.slice(1)) : 5;
  const ordered = [...entries].sort((left, right) =>
    rank(left.level) - rank(right.level) ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  for (const [index, entry] of ordered.entries()) {
    const local = groups.get(index) ?? new Map<string, Array<{ path: string; line: number | null }>>();
    groups.set(index, local);
    const destination = crossDocument ? occurrences : local;
    for (const item of specificationItems(entry)) {
      const list = destination.get(item.id) ?? [];
      list.push({ path: entry.path, line: item.line });
      destination.set(item.id, list);
    }
  }
  const findings: Finding[] = [];
  for (const group of crossDocument ? [occurrences] : groups.values()) {
    for (const [id, items] of group) {
    for (const later of items.slice(1)) {
      findings.push(makeFinding("TN-SPEC-DUP-ID", "error", later.path, later.line, { id }));
    }
    }
  }
  return findings;
}

function deferredVisionIds(section: SpecSection): string[] {
  const lines = section.text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").split("\n");
  const result: string[] = [];
  let fence: string | null = null;
  for (const line of lines) {
    const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
    if (marker) {
      if (fence === null) fence = marker;
      else if (marker[0] === fence[0] && marker.length >= fence.length) fence = null;
      continue;
    }
    if (fence !== null) continue;
    if (!/^\s*(?:[-*+]\s+|\|)/.test(line)) continue;
    result.push(...line.match(/\bV-(?:[A-Z]+)?\d+\b/g) ?? []);
  }
  return result;
}

function visionCoverage(entries: LadderEntry[]): Finding[] {
  const blessedVision = entries.flatMap((entry) => visionOf(entry.doc)
    .filter(({ section }) => section.state === "blessed")
    .map(({ item }) => ({ path: entry.path, line: itemLine(item), id: item.id })));
  const covered = new Set(entries.flatMap((entry) => requirementsOf(entry.doc))
    .filter(({ section }) => section.state === "blessed")
    .flatMap(({ item }) => item.serves));
  const deferred = new Set(entries.flatMap((entry) => entry.doc.sections
    .filter((section) => section.slug === "not-yet-in-scope" && section.state === "blessed")
    .flatMap(deferredVisionIds)));
  const uncovered = blessedVision.filter(({ id }) => !covered.has(id) && !deferred.has(id));
  if (uncovered.length === 0) return [];
  return uncovered.map(({ id, path: filename, line }) =>
    makeFinding("TN-SPEC-UNCOVERED-VISION", "error", filename, line, {
      id,
    }),
  );
}

function applyRuleMode(finding: Finding, policy: Policy): Finding | null {
  if (finding.rule !== "citations-valid") return finding;
  const mode = ruleMode(policy, finding.rule);
  if (mode === "observe") return null;
  return { ...finding, severity: mode === "enforce" ? "error" : "advise" };
}

function sortedFindings(findings: Finding[]): Finding[] {
  const text = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  const unique = new Map<string, Finding>();
  for (const finding of findings) {
    unique.set(JSON.stringify([
      finding.code,
      finding.file,
      finding.line,
      finding.message,
      finding.fix,
    ]), finding);
  }
  return [...unique.values()].sort((left, right) => {
    const file = text(left.file ?? "", right.file ?? "");
    if (file !== 0) return file;
    const line = (left.line ?? 0) - (right.line ?? 0);
    if (line !== 0) return line;
    const code = text(left.code, right.code);
    if (code !== 0) return code;
    return text(left.message, right.message);
  });
}

async function checkSections(
  entries: LadderEntry[],
  cwd: string,
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const reader = (filename: string) => {
    const normalized = portable(filename);
    return readOptional(path.join(cwd, ...normalized.split("/")));
  };
  for (const entry of entries) {
    findings.push(...localProblems(entry));
    if (entry.doc.front) findings.push(...schemaFindings(entry.path, "spec-front-matter", entry.doc.front));
    for (const section of entry.doc.sections) {
      const computed = flags(section, (filename) => {
        const normalized = portable(filename);
        try {
          return readFileSync(path.join(cwd, ...normalized.split("/")), "utf8") as string;
        } catch {
          return null;
        }
      });
      const expected = [...computed].sort();
      const actual = [...section.flags].sort();
      if (JSON.stringify(expected) !== JSON.stringify(actual)) {
        findings.push(makeFinding("TN-SCHEMA", "error", entry.path, null, {
          path: entry.path,
          schema: "spec-front-matter",
          pointer: `/sections/${section.slug}/flags`,
        }));
      }
      if (section.state !== "blessed") continue;
      const raw = sectionRecord(entry.doc.front, section.slug);
      const copy = section.blessed_copy;
      if (!copy || !raw.blessed_digest) {
        findings.push(makeFinding("TN-SPEC-BLESSED-COPY", "error", entry.path, section.slug === "_preamble"
          ? null
          : sectionLocation(section).heading, { slug: section.slug }));
        continue;
      }
      const copyText = await reader(copy);
      if (copyText === null || sectionDigest(copyText) !== String(raw.blessed_digest)) {
        findings.push(makeFinding("TN-SPEC-BLESSED-COPY", "error", entry.path, section.slug === "_preamble"
          ? null
          : sectionLocation(section).heading, { slug: section.slug }));
      }
    }
    findings.push(...canonicalCitationFindings(entry.doc, resolveCitations(entry.doc, (filename) => {
      const normalized = portable(filename);
      try {
        return readFileSync(path.join(cwd, ...normalized.split("/")), "utf8") as string;
      } catch {
        return null;
      }
    })));
    for (const { item } of [...requirementsOf(entry.doc), ...visionOf(entry.doc)]) {
      if (item.origin === null) {
        findings.push(makeFinding("TN-SPEC-REQ-META", "error", entry.path, itemLine(item), {}));
      }
    }
  }
  return findings;
}

function canonicalCitationFindings(doc: ParsedDoc, inherited: Finding[]): Finding[] {
  const malformed = new Map<number, string[]>();
  for (const section of doc.sections) {
    for (const item of [...section.requirements, ...section.vision_items]) {
      const line = itemLine(item);
      if (line === null) continue;
      const cites = item.cites.filter((cite) => {
        const malformedTest = /^test:\s*/.test(cite) && !/\s+>\s+/.test(cite);
        const malformedDoc = /^doc:\s*/.test(cite) && !/.+#.+/.test(cite);
        return !citationParts(cite) || malformedTest || malformedDoc;
      });
      if (cites.length > 0) malformed.set(line, cites);
    }
  }
  const malformedIndexes = new Map<number, number>();
  return inherited.map((finding) => {
    let values: Record<string, string> | null = null;
    if (finding.message === "citation is malformed" && finding.line !== null) {
      const index = malformedIndexes.get(finding.line) ?? 0;
      malformedIndexes.set(finding.line, index + 1);
      const cite = malformed.get(finding.line)?.[index];
      if (cite) values = { cite };
    } else if (finding.code === "TN-CITE-FILE") {
      const matchedPath = /^Cited file (.+) was not found\.$/.exec(finding.message)?.[1];
      if (matchedPath) values = { path: matchedPath };
    } else if (finding.code === "TN-CITE-RANGE") {
      const cite = /^Citation (.+) has an invalid line range or format\.$/.exec(finding.message)?.[1];
      if (cite) values = { cite };
    } else if (finding.code === "TN-CITE-HEADING") {
      const matched = /^Cited heading #(.+) was not found in (.+)\.$/.exec(finding.message);
      if (matched?.[1] && matched[2]) values = { slug: matched[1], path: matched[2] };
    } else if (finding.code === "TN-CITE-TEST") {
      const matched = /^Cited test (.+) was not found in (.+)\.$/.exec(finding.message);
      if (matched?.[1] && matched[2]) values = { name: matched[1], file: matched[2] };
    }
    if (!values) return finding;
    const words = message(finding.code, values);
    return { ...finding, message: words.message, fix: words.fix };
  });
}

async function kitFindings(
  cwd: string,
  policy: Policy,
  installedVersion: string,
): Promise<Finding[]> {
  if (policy.kit_path === "kit") return [];
  const lockText = await readOptional(path.join(cwd, "tenet.lock"));
  if (lockText === null) {
    return [makeFinding("TN-SCHEMA", "error", "tenet.lock", null, {
      path: "tenet.lock",
      schema: "lock",
      pointer: "/",
    })];
  }
  const lockValue = parseYaml(lockText);
  const lockErrors = schemaFindings("tenet.lock", "lock", lockValue);
  if (lockErrors.length > 0) return lockErrors;
  const lock = lockValue as { version: string; kit_sha256: string };
  let actual: string | null = null;
  try {
    actual = (await loadKit(policy)).sha256;
  } catch (error) {
    if ((error as { code?: string }).code !== "TN-KIT-MISSING") throw error;
  }
  const result: Finding[] = [];
  if (actual !== lock.kit_sha256) {
    result.push(makeFinding("TN-KIT-EDITED", "error", "tenet.lock", null, {
      actual: actual ?? "missing",
      expected: lock.kit_sha256,
    }));
  }
  if (lock.version !== installedVersion) {
    result.push(makeFinding("TN-LOCK-MISMATCH", "warning", "tenet.lock", null, {
      installed: installedVersion,
      locked: lock.version,
    }));
  }
  return result;
}

async function packFindings(cwd: string, pack: CheckOptions["pack"]): Promise<Finding[]> {
  if (!pack) return [];
  const filename = typeof pack === "string"
    ? portable(pack)
    : "kit/packs/minimal/pack.yaml";
  const text = await readOptional(path.join(cwd, ...filename.split("/")));
  if (text === null) return [];
  return schemaFindings(filename, "pack", parseYaml(text));
}

async function markdownEntries(cwd: string): Promise<LadderEntry[]> {
  return ladder({ cwd });
}

function selectedEntries(entries: LadderEntry[], paths: string[] | undefined): LadderEntry[] {
  if (!paths || paths.length === 0) return entries;
  const selected = new Set(paths.map(portable));
  return entries.filter((entry) => selected.has(entry.path));
}

async function configuredEntries(
  cwd: string,
  policy: Policy,
  discovered: LadderEntry[],
): Promise<LadderEntry[]> {
  const entries = new Map(discovered.map((entry) => [entry.path, entry]));
  for (const document of policy.specs.documents) {
    const filename = portable(path.posix.join(policy.paths.records, document.path));
    if (entries.has(filename)) continue;
    const text = await readOptional(path.join(cwd, ...filename.split("/")));
    if (text === null) continue;
    entries.set(filename, {
      path: filename,
      level: document.level,
      doc: parseDoc(filename, text, { prefix: policy.specs.id_prefix }),
    });
  }
  const rank = (level: string | null) => level && /^L\d$/.test(level) ? Number(level.slice(1)) : 5;
  return [...entries.values()].sort((left, right) =>
    rank(left.level) - rank(right.level) ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
}

async function requiredDocumentFindings(
  cwd: string,
  policy: Policy,
  hasConfiguredLadder: boolean,
): Promise<Finding[]> {
  const intent = portable(path.posix.join(policy.paths.records, "intent.md"));
  const oneFile = !hasConfiguredLadder &&
    (await readOptional(path.join(cwd, ...intent.split("/")))) !== null;
  const required = oneFile ? [intent] : policy.specs.documents.map((document) =>
    portable(path.posix.join(policy.paths.records, document.path)));
  const findings: Finding[] = [];
  for (const filename of required) {
    if (await readOptional(path.join(cwd, ...filename.split("/"))) !== null) continue;
    findings.push(makeFinding("TN-SCHEMA", "error", filename, null, {
      path: filename,
      schema: "spec-ladder",
      pointer: "/specs/documents",
    }));
  }
  return findings;
}

async function duplicateIdsOnOtherBranches(
  cwd: string,
  current: LadderEntry[],
): Promise<Finding[]> {
  const refsText = await git(["for-each-ref", "--format=%(refname)%09%(objectname)", "refs/heads", "refs/remotes"], { cwd })
    .catch(() => "");
  const currentRef = (await git(["symbolic-ref", "--quiet", "HEAD"], { cwd }).catch(() => "")).trim();
  const currentCommit = (await git(["rev-parse", "HEAD"], { cwd }).catch(() => "")).trim();
  const refs = refsText.split("\n").flatMap((line) => {
    const [ref, commit] = line.split("\t");
    if (!ref || !commit || ref === currentRef || commit === currentCommit || ref.endsWith("/HEAD")) return [];
    return [{ ref, commit }];
  });
  if (refs.length === 0) return [];
  const all = new Map<string, Array<{
    state: string;
    source: string;
    signature: string;
    file: string;
    line: number | null;
  }>>();
  const collect = (entries: LadderEntry[], source: string) => {
    for (const entry of entries) {
      for (const section of entry.doc.sections) {
        for (const item of [...section.vision_items, ...section.requirements]) {
          const list = all.get(item.id) ?? [];
          list.push({
            state: section.state,
            source: `${source}:${entry.path}`,
            signature: jcs(item),
            file: entry.path,
            line: itemLine(item),
          });
          all.set(item.id, list);
        }
      }
    }
  };
  collect(current, "working-tree");
  for (const { ref } of refs) {
    const listing = await git(["ls-tree", "-r", "-z", "--name-only", ref], { cwd }).catch(() => "");
    const paths = listing.split("\0").filter((filename) => filename.endsWith(".md"));
    if (paths.length === 0) continue;
    const blobs = await catFileBatch(ref, paths, { cwd });
    const entries = paths.flatMap((filename) => {
      const contents = blobs.get(filename)?.toString("utf8");
      if (contents === undefined) return [];
      const doc = parseDoc(filename, contents);
      return doc.front && typeof doc.front.tenet === "object"
        ? [{ path: filename, level: doc.sections[0]?.level ?? null, doc }]
        : [];
    });
    collect(entries, ref);
  }
  const result: Finding[] = [];
  for (const [id, occurrences] of [...all.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const blessed = occurrences.filter((item) => item.state === "blessed");
    if (
      blessed.length < 2 ||
      new Set(blessed.map((item) => item.signature)).size < 2 ||
      occurrences.every((item) => item.source.startsWith("working-tree:"))
    ) continue;
    const source = blessed.find((item) => item.source.startsWith("working-tree:"));
    if (!source) continue;
    result.push(makeFinding("TN-SPEC-DUP-ID", "error", source.file, source.line, { id }));
  }
  return result;
}

export async function check(options: CheckOptions = {}): Promise<CheckResult> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const rawPolicy = await readOptional(path.join(cwd, "tenet.yaml"));
  const scoped = Boolean(options.paths && options.paths.length > 0);
  let hasConfiguredLadder = true;
  if (rawPolicy !== null) {
    try {
      const policyValue = parseYaml(rawPolicy);
      const rawSpecs = policyValue &&
        typeof policyValue === "object" &&
        !Array.isArray(policyValue) &&
        "specs" in policyValue
        ? (policyValue as { specs?: unknown }).specs
        : undefined;
      hasConfiguredLadder = Boolean(
        rawSpecs &&
        typeof rawSpecs === "object" &&
        "documents" in rawSpecs &&
        Array.isArray((rawSpecs as { documents?: unknown }).documents) &&
        ((rawSpecs as { documents: unknown[] }).documents.length > 0),
      );
      const policyErrors = schemaFindings("tenet.yaml", "tenet-yaml", policyValue);
      if (policyErrors.length > 0) {
        return {
          findings: policyErrors,
          summary: {
            errors: policyErrors.length,
            warnings: 0,
            advises: 0,
          },
        };
      }
    } catch {
      // loadPolicy supplies the canonical policy diagnostic for malformed YAML.
    }
  }
  const policy = await loadPolicy({ cwd });
  const allEntries = await configuredEntries(cwd, policy, await markdownEntries(cwd));
  const entries = selectedEntries(allEntries, options.paths);
  const findings: Finding[] = [...policy.findings];
  const sectionFindings = await checkSections(entries, cwd);
  findings.push(...(options.ci && options.base ? sectionFindings.flatMap((finding) => {
    const updated = applyRuleMode(finding, policy);
    return updated ? [updated] : [];
  }) : sectionFindings));
  if (!scoped) {
    findings.push(...await requiredDocumentFindings(cwd, policy, hasConfiguredLadder));
    findings.push(...duplicateIdFindings(allEntries));
    findings.push(...await duplicateIdsOnOtherBranches(cwd, allEntries));
    findings.push(...visionCoverage(allEntries));
    findings.push(...await kitFindings(cwd, policy, options.installedVersion ?? installedPackageVersion));
  } else {
    findings.push(...duplicateIdFindings(entries, false));
  }
  findings.push(...await packFindings(cwd, options.pack));

  const configured = documentList(policy);
  const budgetDocuments = [
    ...configured,
    ...entries
      .filter((entry) => !configured.some((document) => document.path === entry.path))
      .map((entry) => ({ path: entry.path })),
  ];
  const selectedBudgets = budgetDocuments.filter((document) =>
    !scoped || (options.paths ?? []).map(portable).includes(document.path));
  const prior = await baseTexts(cwd, options.base, selectedBudgets.map((document) => document.path));
  for (const document of selectedBudgets) {
    const text = await readOptional(path.join(cwd, ...document.path.split("/")));
    if (text === null) continue;
    const limit = "budget" in document && typeof document.budget === "number"
      ? document.budget
      : defaultBudget(document.path);
    if (limit !== null) {
      findings.push(...checkBudget(
        document.path,
        text,
        limit,
        options,
        prior.get(document.path) ?? null,
        ruleMode(policy, "budget"),
      ));
    }
  }
  const ordered = sortedFindings(findings);
  const summary: CheckSummary = {
    errors: ordered.filter((finding) => finding.severity === "error").length,
    warnings: ordered.filter((finding) => finding.severity === "warning").length,
    advises: ordered.filter((finding) => finding.severity === "advise").length,
  };
  return { findings: ordered, summary };
}
