import { readFile } from "node:fs/promises";
import { confine, writeAtomic } from "../core/fs.js";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { fail } from "../core/output.js";
import { validate } from "../core/schema.js";
import { loadPolicy } from "../policy/index.js";
import { resolveCitations } from "../specs/citations.js";
import { parseDoc, type ParsedDoc } from "../specs/parse.js";
import type { Assignment, Inventory } from "../types/generated.js";
import { isGovernedSection, measureStatements, readCitationSource, readingMinutes, readSpecMatter, statements, writeSpecMatter } from "./bless.js";

type CardOptions = { cwd?: string; pr?: number };

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
  sections: (minutes: number) => `Sections (about ${minutes} minutes)`,
  section: (heading: string, count: number, origins: string, minutes: number) =>
    `  ${heading} · ${count} statement${count === 1 ? "" : "s"}${origins ? ` · ${origins}` : ""} · ${minutes} min`,
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
  const namedDocs = inventory.docs.map(({ path }) => path);
  const adrs = inventory.sources.files.filter(({ kind }) => kind === "adr").length;
  const groups = [
    ...namedDocs,
    ...(adrs ? [`${adrs} ADR${adrs === 1 ? "" : "s"}`] : []),
    `${inventory.sources.files.filter(({ kind }) => kind === "source").length} source files`,
    `${inventory.tests.length} test files`,
    `${inventory.sources.files.filter(({ kind }) => kind === "instructions").length} instruction files`,
  ];
  const skipped = [...new Set(inventory.sources.skipped.map(({ reason }) => skipLabels[reason] ?? reason))];
  return onboardingCardText.read(groups.join(", "), skipped.join(", ") || onboardingCardText.nothing);
}

function composeCard(inventory: Inventory, docs: ParsedDoc[], read: (file: string) => string | null, pr?: number): string {
  const governed = docs.flatMap((doc) => doc.sections.filter(isGovernedSection));
  const lines = [onboardingCardText.title(inventory.revision.slice(0, 7)), sourceList(inventory)];
  const cites = governed.flatMap(statements).flatMap((item) => item.cites);
  const findings = docs.flatMap((doc) => resolveCitations(doc, read));
  lines.push(findings.length ? onboardingCardText.broken(findings.length, cites.length) : onboardingCardText.citations(cites.length));
  for (const finding of findings) {
    lines.push(onboardingCardText.finding(finding.file ?? "?", finding.line, finding.message));
  }
  const conflicts = docs.flatMap((doc) => doc.sections.flatMap((section) => section.conflicts));
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

export async function onboardingCard(options: CardOptions = {}): Promise<string> {
  if (options.pr !== undefined && (!Number.isSafeInteger(options.pr) || options.pr < 1)) {
    throw diagnostic("TN-USAGE-ONBOARD", { command: "onboard", detail: "the pull request number must be a positive integer" });
  }
  const cwd = (await git(["rev-parse", "--show-toplevel"], { cwd: options.cwd ?? process.cwd() })
    .catch(() => { throw diagnostic("TN-ENV-NOT-GIT", { path: options.cwd ?? process.cwd() }); })).trimEnd();
  const head = (await git(["rev-parse", "--verify", "HEAD^{commit}"], { cwd })
    .catch(() => { throw diagnostic("TN-ENV-NO-COMMIT"); })).trim();
  const policy = await loadPolicy({ cwd });
  const inventory = await onboardFile(cwd, inventoryPath, "inventory") as Inventory;
  const assignment = await onboardFile(cwd, assignmentPath, "assignment") as Assignment;
  const docs: ParsedDoc[] = [];
  const patches: Array<{ filename: string; original: string; next: string }> = [];
  for (const relative of [...new Set(assignment.output.paths)]) {
    const records = policy.paths.records.replaceAll("\\", "/");
    if (!relative.startsWith(`${records}/`) || !relative.endsWith(".md") || relative.startsWith(`${records}/blessed/`)) {
      throw diagnostic("TN-SCHEMA", { path: assignmentPath, schema: "assignment", pointer: "/output/paths" });
    }
    const filename = await confine(relative, cwd);
    const text = await readFile(filename, "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    if (text === null) continue;
    const parsed = parseDoc(relative, text, { prefix: policy.specs.id_prefix });
    const front = readSpecMatter(text);
    const tenet = parsed.front?.tenet as { spec?: unknown; drafted_at_rev?: unknown } | undefined;
    if (tenet?.spec !== 1) throw { ...diagnostic("TN-SPEC-NO-FRONT"), file: relative };
    docs.push(parsed);
    if (typeof tenet.drafted_at_rev === "string" && tenet.drafted_at_rev) continue;
    if (!parsed.sections.some((section) => isGovernedSection(section) && section.state === "draft")) continue;
    const committed = await git(["show", `${head}:${relative}`], { cwd }).catch(() => null);
    if (committed === null || committed.replaceAll("\r\n", "\n") !== text.replaceAll("\r\n", "\n")) {
      throw { ...diagnostic("TN-SUBJ-DIRTY", { command: "onboard --card" }), file: relative };
    }
    front.yaml.setIn(["tenet", "drafted_at_rev"], head);
    patches.push({ filename, original: text, next: writeSpecMatter(front) });
  }
  const card = composeCard(inventory, docs, readCitationSource(cwd), options.pr);
  for (const patch of patches) {
    if (await readFile(patch.filename, "utf8") !== patch.original) throw diagnostic("TN-SUBJ-DIRTY", { command: "onboard --card" });
    await writeAtomic(patch.filename, patch.next);
  }
  return card;
}
