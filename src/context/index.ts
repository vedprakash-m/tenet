import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";
import { loadPolicy, ownersFor, ruleMode } from "../policy/index.js";
import type { Policy } from "../policy/types.js";
import { match } from "../policy/selectors.js";
import { citationParts } from "../specs/anchors.js";
import { flags } from "../specs/flags.js";
import { parseDoc, type ParsedDoc, type Requirement, type SpecSection } from "../specs/parse.js";
import { sectionDigest } from "../specs/sections.js";

export type ContextInput = {
  paths?: string[];
  ids?: string[];
  query?: string;
  include_drafts?: boolean;
  budget_tokens?: number;
  cwd?: string;
};

export type ContextItem = {
  id: string;
  section: string;
  text: string;
  flags: Array<"edited" | "sources-changed">;
  owner: string;
  reason: "global" | "id" | "path" | "applies_to" | "query";
  over_budget?: boolean;
};

export type ContextDraft = {
  id?: string;
  section: string;
  path: string;
  state: "draft" | "deferred";
  text: string;
  integrity_failed?: boolean;
};

export type ContextResult = {
  blessed: ContextItem[];
  drafts: ContextDraft[];
  index: Array<{ id: string; title: string }>;
  omitted: string[];
  truncated: boolean;
  rules: Array<{ rule: string; mode: "observe" | "advise" | "enforce" }>;
};

export type SpecificationState = {
  path: string;
  section: string;
  level: "L0" | "L1" | "L2" | "L3" | "L4" | null;
  state: string;
  flags: Array<"edited" | "sources-changed">;
};

type Candidate = {
  id: string;
  section: string;
  heading: string;
  level: SpecificationState["level"];
  text: string;
  flags: Array<"edited" | "sources-changed">;
  owner: string;
  cites: string[];
  scope: string | null;
  appliesTo: string[];
  prose: boolean;
};

type Collected = {
  result: ContextResult;
  findings: Finding[];
  validBlessedSections: number;
};

const alphaRules = [
  "tests-not-weakened",
  "protected-surfaces",
  "acceptance-passed",
  "citations-valid",
  "budget",
] as const;

const levelOrder: Record<string, number> = { L0: 0, L1: 1, L2: 2 };

function portable(value: string): string {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+/g, "/");
}

function localFile(cwd: string, value: string): string | null {
  const normalized = portable(value);
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    path.win32.isAbsolute(value) ||
    normalized.split("/").includes("..")
  ) {
    return null;
  }
  const root = path.resolve(cwd);
  const target = path.resolve(root, ...normalized.split("/"));
  const relative = path.relative(root, target);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return null;
  return target;
}

function reader(cwd: string, filename: string): string | null {
  const target = localFile(cwd, filename);
  if (!target) return null;
  try {
    return readFileSync(target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function asyncReader(cwd: string, filename: string): Promise<string | null> {
  const target = localFile(cwd, filename);
  if (!target) return null;
  try {
    return await readFile(target, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function integrityFinding(filename: string, slug: string): Finding {
  return {
    code: "TN-SPEC-BLESSED-COPY",
    severity: "warning",
    rule: null,
    file: filename,
    line: null,
    message: `Blessed copy for section ${slug} is missing or changed on disk.`,
    fix: `Run \`tenet bless\` to restore or re-bless section ${slug}.`,
  };
}

function sectionFlags(section: SpecSection, cwd: string): Array<"edited" | "sources-changed"> {
  return flags(section, (filename) => reader(cwd, filename));
}

function itemNumber(id: string): number {
  const match = /(\d+)$/.exec(id);
  if (!match?.[1]) return Number.POSITIVE_INFINITY;
  return Number.parseInt(match[1], 10);
}

function compareCandidates(left: Candidate, right: Candidate): number {
  const level = (levelOrder[left.level ?? ""] ?? 3) - (levelOrder[right.level ?? ""] ?? 3);
  if (level !== 0) return level;
  const numbers = itemNumber(left.id) - itemNumber(right.id);
  if (numbers !== 0 && Number.isFinite(numbers)) return numbers;
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function pathRelation(left: string, right: string): boolean {
  const first = portable(left).replace(/\/$/, "");
  const second = portable(right).replace(/\/$/, "");
  return first === second || first.startsWith(`${second}/`) || second.startsWith(`${first}/`);
}

function citedPath(cite: string): string | null {
  const parsed = citationParts(cite);
  return parsed?.kind === "path" ? parsed.path : null;
}

function tokenCount(text: string): number {
  return Math.ceil(text.replaceAll("\r\n", "\n").replaceAll("\r", "\n").length / 4);
}

function requirementCandidates(
  copy: ParsedDoc,
  current: SpecSection,
  level: SpecificationState["level"],
  owner: string,
  computedFlags: Array<"edited" | "sources-changed">,
): Candidate[] {
  const items = copy.sections.flatMap((section) => [
    ...section.requirements,
    ...section.vision_items,
  ]);
  return items.map((item: Requirement) => ({
    id: item.id,
    section: current.slug,
    heading: current.heading,
    level,
    text: item.text,
    flags: computedFlags,
    owner,
    cites: item.cites,
    scope: item.scope,
    appliesTo: [],
    prose: false,
  }));
}

function hasProse(copy: string, idPrefix: string): boolean {
  const lines = copy.replace(/\n$/, "").split("\n");
  const statement = new RegExp(`^\\s*[-*+]\\s+(?:${idPrefix}|V)-\\d+\\b`);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const next = lines[index + 1] ?? "";
    if (
      line.includes("|") &&
      line.split("|").some((cell) => cell.trim().toLowerCase().replace(/\s+/g, "") === "id") &&
      /^\s*\|?(?:\s*:?-+:?\s*\|)+\s*$/.test(next)
    ) {
      index += 2;
      while (index < lines.length && (lines[index] ?? "").includes("|")) index += 1;
      index -= 1;
      continue;
    }
    if (line.trim() && !statement.test(line)) return true;
  }
  return false;
}

function sourceDocId(front: Record<string, unknown> | null, sourcePath: string): string {
  const tenet = front?.tenet;
  if (tenet && typeof tenet === "object" && !Array.isArray(tenet)) {
    const doc = (tenet as Record<string, unknown>).doc;
    if (typeof doc === "string" && doc.length > 0) return doc;
  }
  return sourcePath;
}

function optionalDraft(
  section: SpecSection,
  sourcePath: string,
  integrityFailed = false,
): ContextDraft {
  const ids = [
    ...section.requirements.map((item) => item.id),
    ...section.vision_items.map((item) => item.id),
  ];
  const id = ids.length === 1 ? ids[0] : undefined;
  return {
    ...(id ? { id } : {}),
    section: section.slug,
    path: sourcePath,
    state: integrityFailed
      ? "draft"
      : section.state === "deferred"
        ? "deferred"
        : "draft",
    text: section.text.replace(/\n$/, ""),
    ...(integrityFailed ? { integrity_failed: true } : {}),
  };
}

async function collect(
  input: ContextInput,
): Promise<Collected> {
  const cwd = path.resolve(input.cwd ?? process.cwd());
  const budget = input.budget_tokens ?? 4_000;
  if (!Number.isFinite(budget) || budget <= 0) {
    const words = message("TN-USAGE-BUDGET", { budget: String(input.budget_tokens) });
    throw fail("TN-USAGE-BUDGET", words.message, words.fix);
  }
  if (input.paths !== undefined && (!Array.isArray(input.paths) || input.paths.some((value) => typeof value !== "string"))) {
    const words = message("TN-USAGE-CONTEXT", {
      command: "context",
      detail: "paths must be strings",
    });
    throw fail("TN-USAGE-CONTEXT", words.message, words.fix);
  }
  if (input.ids !== undefined && (!Array.isArray(input.ids) || input.ids.some((value) => typeof value !== "string"))) {
    const words = message("TN-USAGE-CONTEXT", {
      command: "context",
      detail: "IDs must be strings",
    });
    throw fail("TN-USAGE-CONTEXT", words.message, words.fix);
  }

  const policy = await loadPolicy({ cwd });
  const candidates: Candidate[] = [];
  const allDrafts: ContextDraft[] = [];
  const findings: Finding[] = [];
  let validBlessedSections = 0;

  for (const document of policy.specs.documents) {
    const sourcePath = `${policy.paths.records}/${portable(document.path)}`;
    const text = await asyncReader(cwd, sourcePath);
    if (text === null) continue;
    const parsed = parseDoc(sourcePath, text, { prefix: policy.specs.id_prefix });
    const docId = sourceDocId(parsed.front, sourcePath);
    for (const section of parsed.sections) {
      const sectionLevel = section.level as SpecificationState["level"];
      if (section.state !== "blessed") {
        if (input.include_drafts && (section.state === "draft" || section.state === "deferred")) {
          allDrafts.push(optionalDraft(section, sourcePath));
        }
        continue;
      }

      const copyPath = section.blessed_copy ? portable(section.blessed_copy) : "";
      const copy = copyPath ? await asyncReader(cwd, copyPath) : null;
      const intact = copy !== null &&
        section.blessed_digest !== null &&
        sectionDigest(copy) === section.blessed_digest;
      if (!intact || copy === null) {
        findings.push(integrityFinding(sourcePath, section.slug));
        allDrafts.push(optionalDraft(section, sourcePath, true));
        continue;
      }
      validBlessedSections += 1;
      const computedFlags = sectionFlags(section, cwd);
      const owner = section.owner ?? ownersFor(sourcePath).join(", ");
      const blessedDoc = parseDoc(copyPath, copy, { prefix: policy.specs.id_prefix });
      const requirements = requirementCandidates(
        blessedDoc,
        section,
        sectionLevel,
        owner,
        computedFlags,
      );
      candidates.push(...requirements);
      if (hasProse(copy, policy.specs.id_prefix)) {
        candidates.push({
          id: `${docId}#${section.slug}`,
          section: section.slug,
          heading: section.heading,
          level: sectionLevel,
          text: copy.replace(/\n$/, ""),
          flags: computedFlags,
          owner,
          cites: [],
          scope: null,
          appliesTo: [...section.applies_to],
          prose: true,
        });
      }
    }
  }

  const paths = [...new Set((input.paths ?? []).map(portable))];
  const ids = new Set(input.ids ?? []);
  const query = input.query?.toLowerCase();
  const groups: Array<{
    reason: ContextItem["reason"];
    candidates: Candidate[];
  }> = [
    { reason: "global", candidates: candidates.filter((item) => !item.prose && item.scope === "global") },
    { reason: "id", candidates: candidates.filter((item) => !item.prose && ids.has(item.id)) },
    {
      reason: "path",
      candidates: candidates.filter((item) =>
        !item.prose &&
        item.cites.some((cite) => {
          const cited = citedPath(cite);
          return cited !== null && paths.some((selected) => pathRelation(cited, selected));
        })
      ),
    },
    {
      reason: "applies_to",
      candidates: candidates.filter((item) =>
        item.prose && paths.some((selected) => match(item.appliesTo, selected))
      ),
    },
    {
      reason: "query",
      candidates: query === undefined
        ? []
        : candidates.filter((item) =>
          (!item.prose && item.text.toLowerCase().includes(query)) ||
          item.heading.toLowerCase().includes(query)
        ),
    },
  ];

  const admitted = new Set<string>();
  const omitted: string[] = [];
  const blessed: ContextItem[] = [];
  let used = 0;
  for (const group of groups) {
    for (const candidate of [...group.candidates].sort(compareCandidates)) {
      if (admitted.has(candidate.id) || omitted.includes(candidate.id)) continue;
      const tokens = tokenCount(candidate.text);
      const explicit = ids.has(candidate.id);
      if (explicit) {
        blessed.push({
          id: candidate.id,
          section: candidate.section,
          text: candidate.text,
          flags: candidate.flags,
          owner: candidate.owner,
          reason: group.reason,
          ...(tokens > budget ? { over_budget: true } : {}),
        });
        admitted.add(candidate.id);
        used = Math.min(budget, used + tokens);
      } else if (used + tokens <= budget) {
        blessed.push({
          id: candidate.id,
          section: candidate.section,
          text: candidate.text,
          flags: candidate.flags,
          owner: candidate.owner,
          reason: group.reason,
        });
        admitted.add(candidate.id);
        used += tokens;
      } else {
        omitted.push(candidate.id);
      }
    }
  }

  const indexBudget = Math.floor(budget * 0.2);
  const index: ContextResult["index"] = [];
  const indexed = new Set<string>();
  let indexUsed = 0;
  const remaining = candidates
    .filter((item) => !item.prose && !admitted.has(item.id) && !omitted.includes(item.id))
    .sort(compareCandidates);
  for (const candidate of remaining) {
    if (indexed.has(candidate.id)) continue;
    const title = candidate.text.slice(0, 80);
    const tokens = tokenCount(`${candidate.id} ${title}`);
    if (indexUsed + tokens <= indexBudget) {
      index.push({ id: candidate.id, title });
      indexed.add(candidate.id);
      indexUsed += tokens;
    }
  }

  const drafts: ContextDraft[] = [];
  const draftKeys = new Set<string>();
  for (const draft of allDrafts) {
    const key = `${draft.path}\0${draft.section}\0${draft.integrity_failed === true ? "integrity" : "working"}`;
    if (!draftKeys.has(key)) {
      draftKeys.add(key);
      drafts.push(draft);
    }
  }

  const result: ContextResult = {
    blessed,
    drafts,
    index,
    omitted,
    truncated: omitted.length > 0,
    rules: alphaRules.map((rule) => ({ rule, mode: ruleMode(policy, rule) })),
  };
  return { result, findings, validBlessedSections };
}

export async function context(input: ContextInput = {}): Promise<ContextResult> {
  return (await collect(input)).result;
}

export async function contextWithFindings(input: ContextInput = {}): Promise<Collected> {
  return collect(input);
}

export function contextSummary(
  result: ContextResult,
  findings: Finding[] = [],
  validBlessedSections = result.blessed.length + result.index.length,
): string {
  const lines = ["# Agent context", ""];
  if (validBlessedSections === 0) {
    lines.push("nothing blessed yet; run tenet bless", "");
  }
  lines.push(`## Blessed (${result.blessed.length})`);
  for (const item of result.blessed) {
    const notes = [
      item.reason,
      ...(item.flags.length > 0 ? item.flags : []),
      `owner: ${item.owner}`,
      ...(item.over_budget ? ["over_budget"] : []),
    ];
    lines.push(`- ${item.id} — ${item.text} (${notes.join("; ")})`);
  }
  lines.push("", `## Drafts (${result.drafts.length})`);
  for (const item of result.drafts) {
    lines.push(`- ${item.id ?? item.section} — ${item.state}${item.integrity_failed ? "; integrity failed" : ""}`);
  }
  lines.push(
    "",
    `## Index (${result.index.length})`,
    ...result.index.map((item) => `- ${item.id} — ${item.title}`),
    "",
    `## Omitted: ${result.omitted.length === 0 ? "none" : result.omitted.join(", ")}`,
    `## Rules: ${result.rules.map((item) => `${item.rule} (${item.mode})`).join(", ")}`,
  );
  if (findings.length > 0) {
    lines.push("", ...findings.map((finding) => `> ${finding.code}: ${finding.message}`));
  }
  return `${lines.join("\n")}\n`;
}

export async function specificationStates(
  cwd = process.cwd(),
): Promise<{ policy: Policy; specs: SpecificationState[] }> {
  const policy = await loadPolicy({ cwd: path.resolve(cwd) });
  const specs: SpecificationState[] = [];
  for (const document of policy.specs.documents) {
    const filename = `${policy.paths.records}/${portable(document.path)}`;
    const text = await asyncReader(path.resolve(cwd), filename);
    if (text === null) continue;
    const parsed = parseDoc(filename, text, { prefix: policy.specs.id_prefix });
    for (const section of parsed.sections) {
      specs.push({
        path: filename,
        section: section.slug,
        level: section.level as SpecificationState["level"],
        state: section.state,
        flags: section.state === "blessed" ? sectionFlags(section, path.resolve(cwd)) : [],
      });
    }
  }
  return { policy, specs };
}
