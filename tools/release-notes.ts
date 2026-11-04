// Release notes draft and gate (LFC-02, TS §18 item 3, PRD §5.9.2). Candidate: nothing here has run in a release.
//
//   node tools/release-notes.ts [--base <ref>] [--write]   print (or write) a draft built from repository facts
//   node tools/release-notes.ts --check <notes.md>         fail while a disclosure section lacks a written statement
//
// The draft lists the paths changed since the base for each disclosure item and the facts a reader needs (R1 mapping,
// open gates, known limits). A person writes each "Statement:" line; the tool never writes one, so it cannot claim "no change".
// Assumption (the specs leave the location open): notes live in the repository at docs/release/notes/v<version>.md.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { report } from "./coverage.ts";
import { releaseAuditReport } from "./release-audit.ts";
import { KERNEL_VERSION } from "../packages/kernel/src/version.ts";

export const PLACEHOLDER = "TODO(release-notes)";
const K = "packages/kernel/src/", P = "plugin/", H = `${P}com.github.copilot/`;

/** The six items of TS §18 item 3 plus evaluators (PRD LFC-02 names them; TS §18 does not). Paths are where such a change usually shows. */
export const ITEMS: Array<{ id: string; title: string; paths: string[] }> = [
  { id: "permissions", title: "Changed permissions", paths: [`${H}agents/`, `${H}descriptor.json`, `${P}schemas/tenet.policy.schema.json`, `${K}core/authority.ts`, `${K}core/policy.ts`, `${K}core/capabilities.ts`] },
  { id: "destinations", title: "Changed destinations", paths: [`${K}adapters/`, `${K}frontends/`, `${P}skills/tenet-starter-ts-web-api/template/.github/`] },
  { id: "executables", title: "Changed executable content", paths: [K, `${H}commands/`, "tools/payload-files.json", `${P}skills/tenet-starter-ts-web-api/template/package.json`] },
  { id: "schemas", title: "Changed schemas", paths: [`${P}schemas/`, `${K}core/schemas.ts`, `${K}core/versions.ts`, `${K}core/reasons.ts`] },
  { id: "evaluators", title: "Changed evaluators", paths: ["packages/eval/", "eval/", "tools/coverage.ts", "tools/release-audit.ts", "tools/lint-skills.ts", "tools/eval.ts"] },
  { id: "behavior", title: "Changed evaluated behavior", paths: ["eval/", `${P}skills/`, `${H}agents/`, `${H}commands/`] },
  { id: "matrix", title: "Support matrix", paths: ["docs/user/qualified-tuple.md", `${H}descriptor.json`] },
];
const SOLO = "Review rule disclosure";

export const notesPath = (version = KERNEL_VERSION) => `docs/release/notes/v${version}.md`;

const git = (root: string, ...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();

/** The newest release tag, or null before the first release. */
export function lastTag(root: string): string | null {
  try { return git(root, "describe", "--tags", "--abbrev=0", "--match", "v*") || null; } catch { return null; }
}

export const changedPaths = (root: string, base: string): string[] => git(root, "diff", "--name-only", `${base}..HEAD`).split("\n").filter(Boolean);

const section = (plan: string, heading: string): string => {
  const from = plan.indexOf(`\n${heading}`);
  return from < 0 ? "" : plan.slice(from + 1).split(/\n#{2,3} /)[0] ?? "";
};
const openBoxes = (plan: string, heading: string): string[] =>
  section(plan, heading).split("\n").filter((l) => l.startsWith("- [ ]")).map((l) => (l.length > 150 ? `${l.slice(0, 147)}...` : l).replace(/^- \[ \] /, ""));

export function facts(root: string): string[] {
  const plan = readFileSync(join(root, "specs/plan.md"), "utf8");
  const r = report(root, "R1");
  const audit = releaseAuditReport(r);
  const total = r.covered.length + r.hostOnly.length + r.unreachable.length + r.unmapped.length;
  const live = `${r.covered.length} mapped / ${r.hostOnly.length} host-only / ${r.unmapped.length} unmapped of ${total} Musts`;
  const stated = /\*\*(\d+ mapped \/ \d+ host-only \/ \d+ unmapped of \d+ Musts), (\d+) qualified\*\*/.exec(plan);
  const qualified = r.evidence.filter((e) => e.qualification === "qualified").length;
  const limits = /These controls do not[^.]*\./.exec(readFileSync(join(root, "specs/tech-spec.md"), "utf8"))?.[0];
  const gates = [...openBoxes(plan, "### 9.5 Release chain"), ...openBoxes(plan, "### 4.5 Owner-gate items")];
  return [
    `- R1 structural mapping now (tools/coverage.ts): ${live}; ${qualified} qualified; ${audit.blockedRequirements.length} Musts block a release audit.`,
    `- Plan dashboard states: ${stated ? `${stated[1]}, ${stated[2]} qualified` : "no figure found"}${stated?.[1] === live ? " (matches)" : " (DIFFERS or absent: update the plan or this draft)"}.`,
    r.integrityErrors.length ? `- Report integrity errors: ${r.integrityErrors.length}. Resolve before release.` : "- Report integrity errors: none.",
    ...gates.map((g) => `- Open gate: ${g}`),
    `- Known limit: ${limits ?? "none found in TS §18 (check that paragraph still exists)"}`,
  ];
}

export function draft(root: string, base: string | null, version = KERNEL_VERSION): string {
  const changed = base ? changedPaths(root, base) : null;
  const out = [`# Tenet ${version} release notes (draft)`, "",
    `Built by tools/release-notes.ts. Base: ${base ?? "none (first release: everything is new)"}. Head: ${git(root, "rev-parse", "HEAD")}.`,
    `Write a "Statement:" line in every section below, "No change." included. \`node tools/release-notes.ts --check\` fails while \`${PLACEHOLDER}\` remains.`,
    "", "## Repository facts", "", ...facts(root)];
  ITEMS.forEach((item, i) => {
    const hit = changed?.filter((p) => item.paths.some((q) => p.startsWith(q))) ?? null;
    out.push("", `## ${i + 1}. ${item.title}`, "",
      hit === null ? "Changed paths: not computed (no base). Describe the whole surface." : hit.length ? `Changed paths:\n${hit.map((p) => `- ${p}`).join("\n")}` : "Changed paths: none in the usual locations.",
      "", `Statement: ${PLACEHOLDER}`);
  });
  out.push("", `## ${SOLO}`, "", "With one maintainer, state that no second-maintainer review occurred, the 72-hour public window used and any external reviewer (PRD §5.9.2, ENG-11).", "", `Statement: ${PLACEHOLDER}`, "");
  return out.join("\n");
}

/** Problems that keep notes from release: a missing section, or a section whose statement is absent, empty or still the placeholder. */
export function checkNotes(text: string): string[] {
  const blocks = new Map(text.split(/^## /m).slice(1).map((b) => [b.split("\n")[0]!.trim(), b] as const));
  const wanted = [...ITEMS.map((item, i) => `${i + 1}. ${item.title}`), SOLO];
  const problems = blocks.has("Repository facts") ? [] : ["missing section: Repository facts"];
  for (const name of wanted) {
    const block = blocks.get(name);
    const statement = block ? /^Statement:[ \t]*(.*)$/m.exec(block)?.[1]?.trim() : undefined;
    if (!block) problems.push(`missing section: ${name}`);
    else if (!statement || statement.includes(PLACEHOLDER)) problems.push(`no statement written: ${name}`);
  }
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), root = join(import.meta.dirname, "..");
  const check = args.indexOf("--check");
  if (check >= 0) {
    const file = args[check + 1] ?? "";
    if (!existsSync(file)) { console.error(`release notes not found: ${file}`); process.exit(1); }
    const problems = checkNotes(readFileSync(file, "utf8"));
    for (const p of problems) console.error(`release notes: ${p}`);
    if (problems.length) process.exit(1);
    console.log(`release notes: all ${ITEMS.length + 1} disclosure sections have a written statement (their content is not judged)`);
  } else {
    const b = args.indexOf("--base");
    const text = draft(root, b >= 0 ? args[b + 1] ?? null : lastTag(root));
    if (!args.includes("--write")) process.stdout.write(text);
    else {
      const target = join(root, notesPath());
      if (existsSync(target)) { console.error(`${notesPath()} exists; not overwritten`); process.exit(1); }
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, text);
      console.log(`wrote ${notesPath()}`);
    }
  }
}
