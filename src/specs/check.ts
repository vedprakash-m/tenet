import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";
import { jcs, sha256 } from "../core/hash.js";
import { validate } from "../core/schema.js";
import { version as installedPackageVersion } from "../core/output.js";
import { catFileBatch, git } from "../core/git.js";
import { loadKit, loadPolicy, ruleMode } from "../policy/index.js";
import type { Policy } from "../policy/types.js";
import type { Finding } from "../types/generated.js";
import { resolveCitations } from "./citations.js";
import { flags } from "./flags.js";
import { ladder, type LadderEntry } from "./ladder.js";
import { parseDoc, itemLine, sectionLocation, type ParsedDoc, type Requirement, type SpecSection } from "./parse.js";

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

const messages = {
  "TN-BUDGET": {
    rule: "budget",
    message: "File {path} is over its token budget ({tokens} > {limit} tokens).",
    fix: "Trim {path} or run `tenet split` to extract a section into a part.",
  },
  "TN-BUDGET-WARN": {
    rule: "budget",
    message: "File {path} is at or over 90% of its token budget ({tokens} / {limit} tokens).",
    fix: "Trim {path} or run `tenet split` to extract a section into a part.",
  },
  "TN-CITE-ANANCHOR": {
    rule: "citations-valid",
    message: "Cited heading #{slug} was not found in {path}.",
    fix: "Update the doc: citation to an existing heading slug in {path}.",
  },
  "TN-KIT-EDITED": {
    rule: null,
    message: "Vendored kit digest differs from tenet.lock ({actual} != {expected}).",
    fix: "Restore .tenet/kit or run `tenet upgrade` to update tenet.lock.",
  },
  "TN-LOCK-MISMATCH": {
    rule: null,
    message: "Installed package {installed} differs from tenet.lock ({locked}).",
    fix: "Run `tenet upgrade` or reinstall @vedprakash-m/tenet@{locked}.",
  },
  "TN-SCHEMA": {
    rule: null,
    message: "File {path} failed {schema} schema validation at {pointer}.",
    fix: "Update {path} at {pointer} to match the {schema} schema.",
  },
  "TN-SPEC-BLESSED-COPY": {
    rule: null,
    message: "Blessed copy for section {slug} is missing or changed on disk.",
    fix: "Run `tenet bless` to restore or re-bless section {slug}.",
  },
  "TN-SPEC-DUP-ID": {
    rule: null,
    message: "Duplicate specification ID {id}.",
    fix: "Run `tenet fix` to assign a new ID, or remove the duplicate {id} item.",
  },
  "TN-SPEC-UNCOVERED-VISION": {
    rule: null,
    message: "Blessed vision item {id} is not served by a blessed requirement or listed under ## Not yet in scope.",
    fix: "Add serves: {id} to a blessed requirement or list {id} under a blessed ## Not yet in scope section.",
  },
  "TN-SPEC-REQ-META": {
    rule: null,
    message: "Requirement metadata is malformed: check closing braces, allowed keys, and origin.",
    fix: "Fix the `{…}` metadata block with allowed keys and valid origin.",
  },
} as const;

type MessageCode = keyof typeof messages;

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? `{${key}}`);
}

function makeFinding(
  code: MessageCode,
  severity: Finding["severity"],
  file: string | null,
  line: number | null,
  values: Record<string, string>,
): Finding {
  const template = messages[code];
  return {
    code: code === "TN-CITE-ANANCHOR" ? "TN-CITE-HEADING" : code,
    severity,
    rule: template.rule,
    file,
    line,
    message: fill(template.message, values),
    fix: fill(template.fix, values),
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

function duplicateIdFindings(entries: LadderEntry[]): Finding[] {
  const occurrences = new Map<string, Array<{ path: string; line: number | null }>>();
  const rank = (level: string | null) => level && /^L\d$/.test(level) ? Number(level.slice(1)) : 5;
  const ordered = [...entries].sort((left, right) =>
    rank(left.level) - rank(right.level) ||
    (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  for (const entry of ordered) {
    for (const section of entry.doc.sections) {
      for (const item of [...section.vision_items, ...section.requirements]) {
        const list = occurrences.get(item.id) ?? [];
        list.push({ path: entry.path, line: itemLine(item) });
        occurrences.set(item.id, list);
      }
    }
  }
  const findings: Finding[] = [];
  for (const [id, items] of occurrences) {
    for (const later of items.slice(1)) {
      findings.push(makeFinding("TN-SPEC-DUP-ID", "error", later.path, later.line, { id }));
    }
  }
  return findings;
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
    .flatMap((section) => section.text.match(/\bV-(?:[A-Z]+)?\d+\b/g) ?? [])));
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
  return [...findings].sort((left, right) => {
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
    findings.push(...entry.doc.problems);
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
      if (copyText === null || `sha256:${sha256(copyText.replace(/\n$/, ""))}` !== String(raw.blessed_digest)) {
        findings.push(makeFinding("TN-SPEC-BLESSED-COPY", "error", entry.path, section.slug === "_preamble"
          ? null
          : sectionLocation(section).heading, { slug: section.slug }));
      }
    }
    findings.push(...resolveCitations(entry.doc, (filename) => {
      const normalized = portable(filename);
      try {
        return readFileSync(path.join(cwd, ...normalized.split("/")), "utf8") as string;
      } catch {
        return null;
      }
    }));
    for (const { item } of [...requirementsOf(entry.doc), ...visionOf(entry.doc)]) {
      if (item.origin === null) {
        findings.push(makeFinding("TN-SPEC-REQ-META", "error", entry.path, itemLine(item), {}));
      }
    }
  }
  return findings;
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
  findings.push(...sectionFindings.flatMap((finding) => {
    const updated = applyRuleMode(finding, policy);
    return updated ? [updated] : [];
  }));
  if (!scoped) {
    findings.push(...await requiredDocumentFindings(cwd, policy, hasConfiguredLadder));
    findings.push(...duplicateIdFindings(allEntries));
    findings.push(...await duplicateIdsOnOtherBranches(cwd, allEntries));
    findings.push(...visionCoverage(allEntries));
    findings.push(...await kitFindings(cwd, policy, options.installedVersion ?? installedPackageVersion));
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
