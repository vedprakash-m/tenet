// Traceability (plan §12.1, TS §19.4): Requirement → fixture → tier → milestone. Structure only: it fails when a Must in
// the milestone has neither a T1 fixture nor an honest reason to need the real host. A green report is necessary, not
// sufficient; a person still confirms the fixture proves the requirement.
//
//   node tools/coverage.ts [--milestone M0|A|B|R1]
//
// A fixture is a test whose title carries the requirement ID in brackets: it("...", ...) → "... [TDD-01]".
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { REASONS } from "../packages/kernel/src/core/reasons.ts";

const ORDER = ["M0", "A", "B", "R1"];
const ROW = /^\| ([A-Z]{2,4}-\d+[a-z]?) \| (.*?) \| (Must|Should|Could|May) \| (M0|A|B|R1|R1\.1|Later) \|\s*([^|]*?)\s*\|$/;

export interface Requirement { id: string; text: string; level: string; milestone: string; acs: string[] }
export interface Report {
  covered: Array<{ id: string; tests: number }>; hostOnly: Requirement[]; unreachable: Requirement[]; unmapped: Requirement[];
  reasonCodes: { referenced: number; total: number }; overBudget: Array<{ module: string; lines: number; budget: number }>; tooLong: Array<{ file: string; lines: number }>;
}

/** Requirements that are agent behavior or host mechanics: there is nothing for the kernel to assert, so only T3 can show them. */
const HOST_BY_NATURE: Record<string, string> = {
  "INT-01": "the agent inspects the repository before asking (golden tasks)",
  "SEC-01": "native permission requests and their explanations (host)",
};

/** Requirements about actions that M0 cannot perform at all, so there is nothing to test yet; each names the verb that brings it in. */
const UNREACHABLE: Record<string, string> = {
  "SEC-13": "needs a remote, destructive or content-sending action; none exists before `publish`, `undo` and `integrate` (Alpha)",
};

export const parsePrd = (text: string): Requirement[] =>
  text.split("\n").flatMap((l) => {
    const m = ROW.exec(l);
    return m ? [{ id: m[1]!, text: m[2]!, level: m[3]!, milestone: m[4]!, acs: m[5]!.split(",").map((s) => s.trim()).filter(Boolean) }] : [];
  });

/** AC tiers from the tech spec's acceptance-suite mapping: `| AC-01 | T3 | ... |` and grouped rows. */
export function acTiers(techSpec: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of techSpec.split("\n")) {
    const m = /^\| (AC-[^|]+) \| (T[0-9][^|]*?) \|/.exec(l);
    if (!m) continue;
    const tiers = m[2]!.match(/T\d/g) ?? [];
    for (const raw of m[1]!.split(",").map((s) => s.trim())) {
      const range = /^AC-(\d+)([a-z]?)[–-]([a-z])$/.exec(raw); // AC-15a–c
      if (range) { for (let c = range[2]!.charCodeAt(0); c <= range[3]!.charCodeAt(0); c++) out.set(`AC-${range[1]}${String.fromCharCode(c)}`, tiers); continue; }
      out.set(raw, tiers);
    }
  }
  return out;
}

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === "node_modules" ? [] : walk(p)) : p.endsWith(".test.ts") ? [p] : [];
});

/** Requirement IDs tagged on test titles, with how many tests carry each. */
export function taggedTests(files: Record<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const text of Object.values(files)) {
    for (const t of text.matchAll(/\b(?:it|describe)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g)) {
      for (const tag of (t[1] ?? t[2] ?? t[3] ?? "").matchAll(/\[([A-Z]{2,4}-\d+[a-z]?(?:,\s*[A-Z]{2,4}-\d+[a-z]?)*)\]/g)) {
        for (const id of tag[1]!.split(",").map((s) => s.trim())) out.set(id, (out.get(id) ?? 0) + 1);
      }
    }
  }
  return out;
}

export function report(root: string, milestone: string): Report {
  const reqs = parsePrd(readFileSync(join(root, "specs/PRD.md"), "utf8")).filter((r) => r.level === "Must" && ORDER.indexOf(r.milestone) >= 0 && ORDER.indexOf(r.milestone) <= ORDER.indexOf(milestone));
  const tiers = acTiers(readFileSync(join(root, "specs/tech-spec.md"), "utf8"));
  const files = Object.fromEntries(walk(join(root, "packages")).map((f) => [f, readFileSync(f, "utf8")]));
  const tagged = taggedTests(files);
  const covered: Report["covered"] = [], hostOnly: Requirement[] = [], unreachable: Requirement[] = [], unmapped: Requirement[] = [];
  for (const r of reqs) {
    if (tagged.has(r.id)) { covered.push({ id: r.id, tests: tagged.get(r.id)! }); continue; }
    if (HOST_BY_NATURE[r.id]) { hostOnly.push(r); continue; }
    if (UNREACHABLE[r.id]) { unreachable.push(r); continue; }
    const t1Capable = r.acs.length === 0 || r.acs.some((ac) => !tiers.has(ac) || tiers.get(ac)!.includes("T1"));
    (t1Capable ? unmapped : hostOnly).push(r);
  }
  const all = Object.values(files).join("\n");
  const referenced = Object.keys(REASONS).filter((c) => new RegExp(`["'\`]${c}["'\`]`).test(all)).length;
  return { covered, hostOnly, unreachable, unmapped, reasonCodes: { referenced, total: Object.keys(REASONS).length }, overBudget: moduleBudgets(root), tooLong: tooLong(root) };
}

/** No verb or decision file is longer than this: growth is caught in the file that grew (owner decision, 2026-10-19). */
const FILE_CAP = 250;
function tooLong(root: string): Report["tooLong"] {
  const src = join(root, "packages/kernel/src");
  return ["verbs", "decisions"].flatMap((d) => readdirSync(join(src, d)).filter((f) => f.endsWith(".ts")).map((f) => ({ file: `${d}/${f}`, lines: readFileSync(join(src, d, f), "utf8").split("\n").length }))).filter((x) => x.lines > FILE_CAP);
}

/** Module line budgets are planning targets; more than 25% over needs a decision before the module grows (TS §6.2). */
function moduleBudgets(root: string): Report["overBudget"] {
  const src = join(root, "packages/kernel/src");
  const lines = (p: string) => { try { return readFileSync(p, "utf8").split("\n").length; } catch { return 0; } };
  const dir = (d: string) => { try { return readdirSync(join(src, d)).filter((f) => f.endsWith(".ts")).reduce((n, f) => n + lines(join(src, d, f)), 0); } catch { return 0; } };
  const budgets: Array<[string, number, number]> = [
    ["core/schemas", lines(join(src, "core/schemas.ts")), 400], ["core/risk", lines(join(src, "core/risk.ts")), 150],
    ["core/budget", lines(join(src, "core/budget.ts")), 150], ["core/verdict", lines(join(src, "core/verdict.ts")), 300],
    ["core/review", lines(join(src, "core/review.ts")), 350], ["adapters/store-fs", lines(join(src, "adapters/store-fs.ts")), 450],
    ["adapters/git-cli", lines(join(src, "adapters/git-cli.ts")), 650], ["adapters/runner", lines(join(src, "adapters/runner.ts")), 350],
    ["adapters/node-ts", lines(join(src, "adapters/node-ts.ts")), 350], ["pipeline + verbs + decisions", lines(join(src, "pipeline.ts")) + dir("verbs") + dir("decisions"), 3000],
  ];
  return budgets.filter(([, n, b]) => n > b * 1.25).map(([module, n, budget]) => ({ module, lines: n, budget }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--milestone");
  const milestone = i > 0 ? process.argv[i + 1]! : "M0";
  const r = report(join(import.meta.dirname, ".."), milestone);
  const total = r.covered.length + r.hostOnly.length + r.unreachable.length + r.unmapped.length;
  console.log(`coverage ${milestone}: ${total} Musts · ${r.covered.length} with a T1 fixture · ${r.hostOnly.length} need the real host (T3/T4) · ${r.unreachable.length} not reachable yet · ${r.unmapped.length} unmapped`);
  for (const x of r.unreachable) console.log(`  not reachable yet: ${x.id}: ${UNREACHABLE[x.id]}`);
  if (r.hostOnly.length) console.log(`  host only: ${r.hostOnly.map((x) => x.id).join(", ")}`);
  console.log(`  reason codes referenced by a fixture: ${r.reasonCodes.referenced} of ${r.reasonCodes.total}`);
  for (const o of r.overBudget) console.log(`  over budget by more than 25%: ${o.module} is ${o.lines} lines, budget ${o.budget}`);
  for (const t of r.tooLong) console.error(`${t.file} is ${t.lines} lines; the cap is ${FILE_CAP}`);
  if (r.tooLong.length) process.exit(1);
  if (r.unmapped.length) { console.error(`unmapped Musts: ${r.unmapped.map((x) => `${x.id} (${x.acs.join(" ")})`).join(", ")}`); process.exit(1); }
  console.log(`  checked ${relative(process.cwd(), join(import.meta.dirname, "../packages"))}`);
}
