import { lstat, readFile } from "node:fs/promises";
import { confine, writeAtomic } from "../core/fs.js";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { validate } from "../core/schema.js";
import { loadPolicy } from "../policy/index.js";
import { resolveCitations } from "../specs/citations.js";
import type { ParsedDoc } from "../specs/parse.js";
import type { Assignment, Inventory } from "../types/generated.js";
import { isGovernedSection, measureStatements, parseBlessDocument, readCitationSource, readingMinutes, readSpecMatter, statements, writeSpecMatter } from "./bless.js";

type CardOptions = { cwd?: string; pr?: number };
type StructuredCardOptions = CardOptions & { format: "result" };
export type OnboardingCardResult = { card: string; drafted_at_rev: string };

const inventoryPath = ".tenet/onboard/inventory.json";
const assignmentPath = ".tenet/onboard/assignment.json";
const skipLabels: Readonly<Record<string, string>> = {
  env: ".env*", credentials: "credentials", vendored: "vendored files",
  generated: "generated files", excluded: "excluded paths", binary: "binary files", oversize: "oversized files",
};

export const onboardingCardText = {
  title: (revision: string) => `### Tenet onboarding · drafted from ${revision} · nothing is in force until you bless it`,
  read: (items: string, skipped: string) => `Read: ${items} · Skipped: ${skipped}`,
  nothing: "none",
  citations: (count: number) => `✓ all ${count} citations checked against the code`,
  broken: (count: number, total: number) => `! ${count} of ${total} citations need attention`,
  finding: (file: string, line: number | null, words: string) => `  ! ${file}${line === null ? "" : `:${line}`} · ${words}`,
  conflicts: "Conflicts (settle these first)",
  conflict: (id: string, text: string, resolution?: string) => `  ${resolution ? "✓" : "!"} ${id} ${text}${resolution ? ` · ${resolution}` : ""}`,
  sections: (minutes: number) => `Sections (about ${minutes} minute${minutes === 1 ? "" : "s"})`,
  section: (heading: string, count: number, origins: string, minutes: number) =>
    `  ${heading} · ${count} statement${count === 1 ? "" : "s"}${origins ? ` · ${origins}` : ""} · ${minutes} min`,
  missingDraft: "commit a specification draft before running onboard --card",
  noSections: "  No specification sections were found.",
  checkout: (pr?: number) => `→ gh pr checkout ${pr ?? "<n>"}, then tenet bless in your terminal (or edit the files first)`,
  incompatible: "--card cannot be combined with --inventory-only, --refresh or --layout",
} as const;

function diagnostic(code: string, vars: Record<string, string> = {}) {
  const words = message(code, vars);
  return fail(code, words.message, words.fix);
}

async function onboardFile(cwd: string, filename: string, schema: "inventory" | "assignment"): Promise<unknown> {
  const location = await confine(filename, cwd);
  try {
    const value: unknown = JSON.parse(await readFile(location, "utf8"));
    const checked = validate(schema, value);
    if (checked.ok) return value;
    throw diagnostic("TN-SCHEMA", { path: filename, schema, pointer: checked.errors[0]?.pointer || "/" });
  } catch (error) {
    if (error && typeof error === "object" && "severity" in error) throw error;
    throw diagnostic("TN-SCHEMA", { path: filename, schema, pointer: "/" });
  }
}

function sourceList(inventory: Inventory): string {
  const adrPaths = new Set(inventory.sources.files.filter(({ kind }) => kind === "adr").map(({ path }) => path));
  const namedDocs = inventory.docs.filter(({ path }) => !adrPaths.has(path)).map(({ path }) => path);
  const adrs = adrPaths.size;
  const countFiles = (count: number, label: string) => `${count} ${label} file${count === 1 ? "" : "s"}`;
  const groups = [
    ...namedDocs,
    ...(adrs ? [`${adrs} ADR${adrs === 1 ? "" : "s"}`] : []),
    countFiles(inventory.sources.files.filter(({ kind }) => kind === "source").length, "source"),
    countFiles(inventory.tests.length, "test"),
    countFiles(inventory.sources.files.filter(({ kind }) => kind === "instructions").length, "instruction"),
  ];
  const skipped = [...new Set(inventory.sources.skipped.map(({ reason }) => skipLabels[reason] ?? reason))];
  return onboardingCardText.read(groups.join(", "), skipped.join(", ") || onboardingCardText.nothing);
}

function composeCard(inventory: Inventory, docs: ParsedDoc[], read: (file: string) => string | null, pr?: number): string {
  const governed = docs.flatMap((doc) => doc.sections.filter(isGovernedSection));
  const lines = [onboardingCardText.title(inventory.revision.slice(0, 7)), sourceList(inventory)];
  const cites = governed.flatMap(statements).flatMap((item) => item.cites);
  const findings = docs.flatMap((doc) => resolveCitations({ ...doc, sections: doc.sections.filter(isGovernedSection) }, read));
  lines.push(findings.length ? onboardingCardText.broken(findings.length, cites.length) : onboardingCardText.citations(cites.length));
  for (const finding of findings) {
    lines.push(onboardingCardText.finding(finding.file ?? "?", finding.line, finding.message));
  }
  const conflicts = docs.flatMap((doc) => doc.sections.flatMap((section) => section.conflicts))
    .filter(({ checked, resolution }) => !checked || !resolution);
  if (conflicts.length) {
    lines.push(onboardingCardText.conflicts);
    for (const item of conflicts) lines.push(onboardingCardText.conflict(item.id, item.text, item.checked ? item.resolution : undefined));
  }
  lines.push(onboardingCardText.sections(governed.reduce((minutes, section) => minutes + readingMinutes(section.text), 0)));
  if (!governed.length) lines.push(onboardingCardText.noSections);
  for (const section of governed) {
    const measured = measureStatements(section);
    const origins = ["asked", "documented", "observed", "inferred", "unlabelled"].flatMap((origin) => {
      const count = measured.filter((item) => (item.origin ?? "unlabelled") === origin).length;
      return count ? [`${count} ${origin}`] : [];
    });
    lines.push(onboardingCardText.section(section.heading || section.slug, measured.length, origins.join(", "), readingMinutes(section.text)));
  }
  lines.push(onboardingCardText.checkout(pr));
  return `${lines.join("\n")}\n`;
}

export function onboardingCard(options: StructuredCardOptions, write?: typeof writeAtomic): Promise<OnboardingCardResult>;
export function onboardingCard(options?: CardOptions): Promise<string>;
export async function onboardingCard(
  options: CardOptions & { format?: "result" } = {},
  write = writeAtomic,
): Promise<OnboardingCardResult | string> {
  if (options.pr !== undefined && (!Number.isSafeInteger(options.pr) || options.pr < 1)) {
    throw diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail: "the pull request number must be a positive integer" });
  }
  const cwd = (await git(["rev-parse", "--show-toplevel"], { cwd: options.cwd ?? process.cwd() })
    .catch(() => { throw diagnostic("TN-ENV-NOT-GIT", { path: options.cwd ?? process.cwd() }); })).trimEnd();
  const head = (await git(["rev-parse", "--verify", "HEAD^{commit}"], { cwd })
    .catch(() => { throw diagnostic("TN-ENV-NO-COMMIT"); })).trim();
  const inventory = await onboardFile(cwd, inventoryPath, "inventory") as Inventory;
  const assignment = await onboardFile(cwd, assignmentPath, "assignment") as Assignment;
  const paths = await Promise.all([...new Set(assignment.output.paths)].map(async (relative) => {
    const filename = await confine(relative, cwd);
    const present = await lstat(filename).then((entry) => entry.isFile(), (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT" || error.code === "ENOTDIR") return false;
      throw error;
    });
    return { relative, filename, present };
  }));
  const drafts = paths.filter(({ present }) => present);
  if (!drafts.length) throw diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail: onboardingCardText.missingDraft });
  const policy = await loadPolicy({ cwd }).catch((error: { finding?: unknown }) => { throw error.finding ?? error; });
  const docs: ParsedDoc[] = [];
  let existingStamp: string | undefined;
  const patches: Array<{ filename: string; original: string; next: string }> = [];
  for (const { relative, filename } of drafts) {
    const records = policy.paths.records.replaceAll("\\", "/");
    if (!relative.startsWith(`${records}/`) || !relative.endsWith(".md") || relative.startsWith(`${records}/blessed/`)) {
      throw diagnostic("TN-SCHEMA", { path: assignmentPath, schema: "assignment", pointer: "/output/paths" });
    }
    const text = await readFile(filename, "utf8");
    const parsed = parseBlessDocument(relative, text, policy.specs.id_prefix);
    const front = readSpecMatter(text);
    const tenet = parsed.front?.tenet as { spec?: unknown; drafted_at_rev?: unknown } | undefined;
    if (tenet?.spec !== 1) throw { ...diagnostic("TN-SPEC-NO-FRONT"), file: relative };
    docs.push(parsed);
    if (typeof tenet.drafted_at_rev === "string" && tenet.drafted_at_rev) {
      existingStamp ??= tenet.drafted_at_rev;
      continue;
    }
    if (!parsed.sections.some((section) => isGovernedSection(section) && section.state === "draft")) continue;
    const committed = await git(["show", `${head}:${relative}`], { cwd }).catch(() => null);
    if (committed === null || committed.replaceAll("\r\n", "\n") !== text.replaceAll("\r\n", "\n")) {
      throw { ...diagnostic("TN-SUBJ-DIRTY", { command: "onboard --card" }), file: relative };
    }
    front.yaml.setIn(["tenet", "drafted_at_rev"], head);
    patches.push({ filename, original: text, next: writeSpecMatter(front) });
  }
  const card = composeCard(inventory, docs, readCitationSource(cwd), options.pr);
  const saved: typeof patches = [];
  try {
    for (const patch of patches) {
      if (await readFile(patch.filename, "utf8") !== patch.original) {
        throw diagnostic("TN-SUBJ-DIRTY", { command: "onboard --card" });
      }
      await write(patch.filename, patch.next);
      saved.push(patch);
    }
  } catch (error) {
    const failures: unknown[] = [error];
    for (const patch of saved.reverse()) {
      try {
        if (await readFile(patch.filename, "utf8") === patch.next) await writeAtomic(patch.filename, patch.original);
      } catch (rollback) { failures.push(rollback); }
    }
    if (failures.length > 1) throw new AggregateError(failures, "Could not restore draft stamps");
    throw error;
  }
  return options.format === "result" ? { card, drafted_at_rev: patches.length ? head : existingStamp ?? head } : card;
}
