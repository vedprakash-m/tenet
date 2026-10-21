// Quality ratchet (.github/copilot-instructions.md: simplicity first). New code meets the limits below. Code that already
// exceeded them is recorded in tools/quality-baseline.json and may only shrink; a new offender, or growth in a recorded
// one, fails. `--update` lowers the record after a refactor; `--init` writes it once. Nothing here raises a limit.
// Module sizes (TS §6.2) follow the same rule: a module over its owner-set budget may not grow past its recorded ceiling.
// Size is counted in non-whitespace characters, so wrapping a line or splitting a function is not growth (owner decision, 2026-10-20).
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export const LIMITS = { lines: 80, cc: 25, nest: 5, width: 140 } as const;
export interface Fn { lines: number; cc: number; nest: number }
export interface Measured { functions: Record<string, Fn>; wide: Record<string, number>; modules: Record<string, number> }
export interface Baseline { functions: Record<string, Fn>; wide: Record<string, number>; modules?: Record<string, number> }

/** Characters per budgeted line: the density of the pipeline, verbs and decisions when the owner set their 3,000-line budget (146,543 characters in 2,544 lines). */
export const CHARS_PER_LINE = 57.6;
export const budgetChars = (name: string): number => Math.round(BUDGETS[name]!.lines * CHARS_PER_LINE);

/** Budgets set by the owner (TS §6.2) in lines, enforced as characters. A module is a file, or a group of files (a directory, or files matching a pattern). */
export const BUDGETS: Record<string, { match: RegExp; lines: number }> = {
  "core/schemas": { match: /^core\/schemas\.ts$/, lines: 440 },
  "core/risk": { match: /^core\/risk\.ts$/, lines: 150 },
  "core/budget": { match: /^core\/budget\.ts$/, lines: 150 },
  "core/verdict": { match: /^core\/verdict\.ts$/, lines: 300 },
  "core/review": { match: /^core\/review\.ts$/, lines: 350 },
  "adapters/store-fs": { match: /^adapters\/store-fs\.ts$/, lines: 450 },
  "adapters/git-cli": { match: /^adapters\/git-cli\.ts$/, lines: 650 },
  "adapters/runner": { match: /^adapters\/runner\.ts$/, lines: 350 },
  "adapters/node-ts": { match: /^adapters\/node-ts\.ts$/, lines: 350 },
  "pipeline + verbs + decisions": { match: /^(pipeline[\w-]*\.ts|verbs\/.*|decisions\/.*)$/, lines: 3650 },
};

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith(".ts") ? [p] : [];
});
const BRANCH = new Set([ts.SyntaxKind.IfStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.ForInStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.CaseClause, ts.SyntaxKind.CatchClause, ts.SyntaxKind.ConditionalExpression]);
const LOGICAL = new Set([ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken]);
const NESTS = new Set([ts.SyntaxKind.IfStatement, ts.SyntaxKind.ForStatement, ts.SyntaxKind.ForOfStatement, ts.SyntaxKind.WhileStatement, ts.SyntaxKind.TryStatement, ts.SyntaxKind.SwitchStatement]);

function shape(body: ts.Node): { cc: number; nest: number } {
  let cc = 1, nest = 0;
  const walk = (n: ts.Node, depth: number) => {
    if (BRANCH.has(n.kind) || (ts.isBinaryExpression(n) && LOGICAL.has(n.operatorToken.kind))) cc++;
    const d = NESTS.has(n.kind) ? depth + 1 : depth;
    nest = Math.max(nest, d);
    ts.forEachChild(n, (c) => walk(c, d));
  };
  walk(body, 0);
  return { cc, nest };
}

const nameOf = (n: ts.Node): string | undefined => {
  if ((ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n)) && n.name) return n.name.getText();
  const p = n.parent;
  if (p && (ts.isVariableDeclaration(p) || ts.isPropertyAssignment(p)) && (ts.isArrowFunction(n) || ts.isFunctionExpression(n))) return p.name.getText();
  return undefined;
};

/** Length, complexity and nesting of every named function (a nested closure counts in its parent too), wide lines per file, and non-whitespace characters per budgeted module. */
export function measure(dir: string): Measured {
  const out: Measured = { functions: {}, wide: {}, modules: {} };
  for (const file of files(dir)) {
    const rel = relative(dir, file);
    const text = readFileSync(file, "utf8");
    const wide = text.split("\n").filter((l) => l.length > LIMITS.width).length;
    if (wide) out.wide[rel] = wide;
    for (const [name, b] of Object.entries(BUDGETS)) if (b.match.test(rel)) out.modules[name] = (out.modules[name] ?? 0) + text.replace(/\s+/g, "").length;
    const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const seen = new Map<string, number>();
    const visit = (n: ts.Node) => {
      const name = nameOf(n);
      const body = (n as ts.FunctionLikeDeclaration).body;
      if (name && body) {
        const n2 = (seen.get(name) ?? 0) + 1;
        seen.set(name, n2);
        const lines = sf.getLineAndCharacterOfPosition(n.getEnd()).line - sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
        out.functions[`${rel}#${name}${n2 > 1 ? `#${n2}` : ""}`] = { lines, ...shape(body) };
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

const over = (f: Fn): boolean => f.lines > LIMITS.lines || f.cc > LIMITS.cc || f.nest > LIMITS.nest;

/** Problems: a new offender, a recorded offender that grew, wide lines gained, or a module past its budget or its recorded ceiling. */
export function check(m: Measured, base: Baseline): string[] {
  const out: string[] = [];
  for (const [key, f] of Object.entries(m.functions)) {
    const r = base.functions[key];
    if (!r) {
      if (f.lines > LIMITS.lines) out.push(`${key}: ${f.lines} lines (limit ${LIMITS.lines})`);
      if (f.cc > LIMITS.cc) out.push(`${key}: complexity ${f.cc} (limit ${LIMITS.cc})`);
      if (f.nest > LIMITS.nest) out.push(`${key}: nesting ${f.nest} (limit ${LIMITS.nest})`);
      continue;
    }
    if (f.lines > r.lines) out.push(`${key} grew: ${f.lines} lines, recorded ${r.lines}`);
    if (f.cc > r.cc) out.push(`${key} grew: complexity ${f.cc}, recorded ${r.cc}`);
    if (f.nest > r.nest) out.push(`${key} grew: nesting ${f.nest}, recorded ${r.nest}`);
  }
  for (const [file, n] of Object.entries(m.wide)) {
    const r = base.wide[file];
    if (r === undefined) out.push(`${file}: ${n} line(s) wider than ${LIMITS.width} characters`);
    else if (n > r) out.push(`${file} gained wide lines: ${n}, recorded ${r}`);
  }
  for (const [name, n] of Object.entries(m.modules)) {
    const ceiling = base.modules?.[name], budget = budgetChars(name);
    if (ceiling === undefined && n > budget) out.push(`${name}: ${n} characters (budget ${budget})`);
    else if (ceiling !== undefined && n > ceiling) out.push(`${name} grew: ${n} characters, ceiling ${ceiling} (budget ${budget})`);
  }
  return out;
}

/** The record after a refactor: every value lowered to the measured one, offenders that now pass dropped, nothing new added. */
export function lowered(m: Measured, base: Baseline): Baseline {
  const functions: Record<string, Fn> = {};
  for (const [key, r] of Object.entries(base.functions)) {
    const f = m.functions[key];
    if (f && over(f)) functions[key] = { lines: Math.min(f.lines, r.lines), cc: Math.min(f.cc, r.cc), nest: Math.min(f.nest, r.nest) };
  }
  const wide: Record<string, number> = {};
  for (const [file, r] of Object.entries(base.wide)) { const n = Math.min(m.wide[file] ?? 0, r); if (n) wide[file] = n; }
  const modules: Record<string, number> = {};
  for (const [name, ceiling] of Object.entries(base.modules ?? {})) {
    const n = Math.min(m.modules[name] ?? 0, ceiling);
    if (n > budgetChars(name)) modules[name] = n;
  }
  return { functions, wide, modules };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(import.meta.dirname, "..");
  const recordPath = join(import.meta.dirname, "quality-baseline.json");
  const m = measure(join(root, "packages/kernel/src"));
  if (process.argv.includes("--init")) {
    if (existsSync(recordPath)) { console.error("lint-quality: the baseline exists; use --update to lower it"); process.exit(1); }
    const functions = Object.fromEntries(Object.entries(m.functions).filter(([, f]) => over(f)));
    const modules = Object.fromEntries(Object.entries(m.modules).filter(([name, n]) => n > budgetChars(name)));
    writeFileSync(recordPath, `${JSON.stringify({ functions, wide: m.wide, modules }, null, 1)}\n`);
    console.log(`lint-quality: recorded ${Object.keys(functions).length} functions and ${Object.keys(m.wide).length} files`);
  } else {
    const base = JSON.parse(readFileSync(recordPath, "utf8")) as Baseline;
    if (process.argv.includes("--update")) {
      writeFileSync(recordPath, `${JSON.stringify(lowered(m, base), null, 1)}\n`);
      console.log("lint-quality: baseline lowered");
    } else {
      const problems = check(m, base);
      for (const p of problems) console.error(p);
      const left = Object.keys(base.functions).length;
      for (const [name, n] of Object.entries(m.modules)) if (n > budgetChars(name)) console.log(`  over its budget: ${name} is ${n} characters, budget ${budgetChars(name)}`);
      console.log(`lint-quality: ${problems.length ? `${problems.length} problem(s)` : "no problems"}; ${left} recorded offender(s) left to refactor`);
      if (problems.length) process.exit(1);
    }
  }
}
