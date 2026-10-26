// The quality ratchet (copilot-instructions: simplicity first). New code meets the limits; existing offenders are recorded in
// a baseline and may only shrink. Each rule has a fixture that must fail, so a gate that stops catching shows up.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, budgetChars, check, lowered, measure } from "../../../tools/lint-quality.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const dirs: string[] = [];
after(() => dirs.forEach(dir => rmSync(dir, { recursive: true, force: true })));
const tree = (files: Record<string, string>) => {
  const d = projectScratch("quality fixture-");
  dirs.push(d);
  for (const [rel, text] of Object.entries(files)) { mkdirSync(join(d, rel, ".."), { recursive: true }); writeFileSync(join(d, rel), text); }
  return d;
};
const longFn = (name: string, body: number) => `export function ${name}(x: number): number {\n${"  x += 1;\n".repeat(body)}  return x;\n}\n`;
const branchy = (name: string, n: number) => `export function ${name}(x: number): number {\n${Array.from({ length: n }, (_, i) => `  if (x === ${i}) return ${i};`).join("\n")}\n  return -1;\n}\n`;
const none: { functions: Record<string, never>; wide: Record<string, number>; modules?: Record<string, number> } = { functions: {}, wide: {} };

describe("measuring", () => {
  it("does not count CRLF terminators as width while retaining the exact width limit", () => {
    const text = `${"x".repeat(LIMITS.width)}\n${"y".repeat(LIMITS.width + 1)}\n`;
    const lf = measure(tree({ "core/risk.ts": text }));
    const crlf = measure(tree({ "core/risk.ts": text.replace(/\n/g, "\r\n") }));
    assert.deepEqual(lf.wide, { "core/risk.ts": 1 });
    assert.deepEqual(crlf, lf);
    assert.match(check(crlf, none).join("\n"), /core\/risk.ts: 1 line\(s\) wider than 140 characters/);
  });
  it("uses canonical nested paths for module matching and function and width baseline keys", () => {
    const text = `${longFn("legacy", LIMITS.lines + 1)}const wide = "${"x".repeat(LIMITS.width)}";\n`;
    const m = measure(tree({ "core/risk.ts": text }));
    assert.deepEqual(Object.keys(m.functions), ["core/risk.ts#legacy"]);
    assert.deepEqual(m.wide, { "core/risk.ts": 1 });
    assert.equal(m.modules["core/risk"], text.replace(/\s+/g, "").length);
    const base = { functions: { "core/risk.ts#legacy": { ...m.functions["core/risk.ts#legacy"]! } }, wide: { "core/risk.ts": 1 } };
    assert.deepEqual(check(m, base), []);
    const grown = measure(tree({ "core/risk.ts": `${longFn("legacy", LIMITS.lines + 2)}${"x".repeat(LIMITS.width + 1)}\n${"y".repeat(LIMITS.width + 1)}\n` }));
    const problems = check(grown, base);
    assert.ok(problems.some(p => /^core\/risk.ts#legacy grew:/.test(p)), problems.join("\n"));
    assert.ok(problems.some(p => /^core\/risk.ts gained wide lines: 2, recorded 1$/.test(p)), problems.join("\n"));
  });
  it("reports length, complexity and nesting per named function, and wide lines per file", () => {
    const m = measure(tree({ "a.ts": `${longFn("big", 10)}${branchy("many", 4)}const w = "${"x".repeat(150)}";\n` }));
    assert.equal(m.functions["a.ts#big"]!.lines, 13);
    assert.equal(m.functions["a.ts#many"]!.cc, 5);
    assert.equal(m.wide["a.ts"], 1);
  });
  it("counts a nested closure inside its parent, and keys repeated names apart", () => {
    const m = measure(tree({ "a.ts": "export const verb = { run() { const f = () => { if (1) return 1; return 2; }; return f(); } };\nexport const other = { run() { return 1; } };\n" }));
    assert.deepEqual(Object.keys(m.functions).sort(), ["a.ts#f", "a.ts#run", "a.ts#run#2"]);
    assert.equal(m.functions["a.ts#run"]!.cc, 2);
  });
});

describe("checking against the baseline", () => {
  it("passes small functions and fails a new one over the length, complexity or nesting limit", () => {
    assert.deepEqual(check(measure(tree({ "a.ts": longFn("ok", 5) })), none), []);
    const msgs = check(measure(tree({ "a.ts": `${longFn("long", LIMITS.lines + 5)}${branchy("many", LIMITS.cc + 2)}` })), none).join("\n");
    assert.match(msgs, /a\.ts#long: \d+ lines/);
    assert.match(msgs, /a\.ts#many: complexity \d+/);
  });
  it("fails a line over the width limit in a new file, and a file that gains wide lines", () => {
    const wide = `const w = "${"x".repeat(LIMITS.width)}";\n`;
    assert.match(check(measure(tree({ "a.ts": wide })), none).join("\n"), /a\.ts: 1 line\(s\) wider than/);
    assert.deepEqual(check(measure(tree({ "a.ts": wide })), { functions: {}, wide: { "a.ts": 1 } }), []);
    assert.match(check(measure(tree({ "a.ts": wide + wide })), { functions: {}, wide: { "a.ts": 1 } }).join("\n"), /gained/);
  });
  it("lets a recorded offender stay as it is, and fails when it grows in any metric", () => {
    const m = measure(tree({ "a.ts": longFn("legacy", LIMITS.lines + 20) }));
    const base = { functions: { "a.ts#legacy": { ...m.functions["a.ts#legacy"]! } }, wide: {} };
    assert.deepEqual(check(m, base), []);
    const grown = measure(tree({ "a.ts": longFn("legacy", LIMITS.lines + 21) }));
    assert.match(check(grown, base).join("\n"), /a\.ts#legacy grew: \d+ lines, recorded \d+/);
  });
  it("fails a module over its budget until a ceiling is recorded, and then fails growth past that ceiling", () => {
    const text = (chars: number) => "x\n".repeat(chars); // one character per line: no wide line
    const budget = budgetChars("core/risk");
    const over = measure(tree({ "core/risk.ts": text(budget + 100) }));
    assert.match(check(over, none).join("\n"), new RegExp(`core/risk: ${budget + 100} characters \\(budget ${budget}\\)`));
    const ceiling = over.modules["core/risk"]!;
    assert.deepEqual(check(over, { ...none, modules: { "core/risk": ceiling } }), []);
    const grown = measure(tree({ "core/risk.ts": text(budget + 101) }));
    assert.match(check(grown, { ...none, modules: { "core/risk": ceiling } }).join("\n"), /core\/risk grew: \d+ characters, ceiling \d+/);
  });
  it("counts pipeline, verbs and decisions as one module, and wrapping or indenting a line is not growth", () => {
    const m = measure(tree({ "pipeline.ts": "a b\n", "pipeline-mutate.ts": "c\n", "verbs/x.ts": "d\ne\n", "decisions/y.ts": "f\n", "core/z.ts": "g\n" }));
    assert.equal(m.modules["pipeline + verbs + decisions"], 2 + 1 + 2 + 1);
    const wrapped = measure(tree({ "pipeline.ts": "a\n    b\n", "pipeline-mutate.ts": "c\n", "verbs/x.ts": "d\ne\n", "decisions/y.ts": "f\n" }));
    assert.equal(wrapped.modules["pipeline + verbs + decisions"], 6);
  });
});

describe("tightening the baseline", () => {
  it("lowers recorded values and drops offenders that now pass, but never records a new or larger one", () => {
    const before = measure(tree({ "a.ts": longFn("legacy", LIMITS.lines + 20), "b.ts": longFn("gone", LIMITS.lines + 5) }));
    const base = { functions: before.functions, wide: {}, modules: { "core/risk": 50_000 } };
    const after2 = measure(tree({ "a.ts": longFn("legacy", LIMITS.lines + 10), "b.ts": longFn("gone", 3), "c.ts": longFn("fresh", LIMITS.lines + 50) }));
    const next = lowered(after2, base);
    assert.equal(next.functions["a.ts#legacy"]!.lines, after2.functions["a.ts#legacy"]!.lines);
    assert.equal("b.ts#gone" in next.functions, false);
    assert.equal("c.ts#fresh" in next.functions, false, "a new offender is a failure, not a baseline entry");
    assert.equal("core/risk" in (next.modules ?? {}), false, "a module back under its budget leaves the record");
  });
});

describe("the real tree", () => {
  it("meets the limits or its recorded baseline", () => {
    const root = join(import.meta.dirname, "../../..");
    const baseline = JSON.parse(readFileSync(join(root, "tools/quality-baseline.json"), "utf8"));
    assert.deepEqual(check(measure(join(root, "packages/kernel/src")), baseline), []);
  });
});
