// The quality ratchet (copilot-instructions: simplicity first). New code meets the limits; existing offenders are recorded in
// a baseline and may only shrink. Each rule has a fixture that must fail, so a gate that stops catching shows up.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, check, lowered, measure } from "../../../tools/lint-quality.ts";
import { cleanup, tmp } from "./helpers.ts";

const dirs: string[] = [];
after(() => dirs.forEach(cleanup));
const tree = (files: Record<string, string>) => {
  const d = tmp("tenet-quality-");
  dirs.push(d);
  for (const [rel, text] of Object.entries(files)) { mkdirSync(join(d, rel, ".."), { recursive: true }); writeFileSync(join(d, rel), text); }
  return d;
};
const longFn = (name: string, body: number) => `export function ${name}(x: number): number {\n${"  x += 1;\n".repeat(body)}  return x;\n}\n`;
const branchy = (name: string, n: number) => `export function ${name}(x: number): number {\n${Array.from({ length: n }, (_, i) => `  if (x === ${i}) return ${i};`).join("\n")}\n  return -1;\n}\n`;
const none = { functions: {}, wide: {} };

describe("measuring", () => {
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
  it("fails the aggregate when the verbs, decisions and pipeline size grows past its record; wrapping a line does not count as growth", () => {
    const m = measure(tree({ "pipeline.ts": "export const a = 1;\n", "verbs/x.ts": "export const b = 1;\nexport const c = 2;\n" }));
    const chars = "export const a = 1;\n".length + "export const b = 1;\nexport const c = 2;\n".length;
    assert.equal(m.core, chars);
    assert.match(check(m, { ...none, core: chars - 1 }).join("\n"), new RegExp(`grew: ${chars} characters, recorded ${chars - 1}`));
    assert.deepEqual(check(m, { ...none, core: chars }), []);
  });
});

describe("tightening the baseline", () => {
  it("lowers recorded values and drops offenders that now pass, but never records a new or larger one", () => {
    const before = measure(tree({ "a.ts": longFn("legacy", LIMITS.lines + 20), "b.ts": longFn("gone", LIMITS.lines + 5) }));
    const base = { functions: before.functions, wide: {} };
    const after2 = measure(tree({ "a.ts": longFn("legacy", LIMITS.lines + 10), "b.ts": longFn("gone", 3), "c.ts": longFn("fresh", LIMITS.lines + 50) }));
    const next = lowered(after2, base);
    assert.equal(next.functions["a.ts#legacy"]!.lines, after2.functions["a.ts#legacy"]!.lines);
    assert.equal("b.ts#gone" in next.functions, false);
    assert.equal("c.ts#fresh" in next.functions, false, "a new offender is a failure, not a baseline entry");
  });
});

describe("the real tree", () => {
  it("meets the limits or its recorded baseline", () => {
    const root = join(import.meta.dirname, "../../..");
    const baseline = JSON.parse(readFileSync(join(root, "tools/quality-baseline.json"), "utf8"));
    assert.deepEqual(check(measure(join(root, "packages/kernel/src")), baseline), []);
  });
});
