// The lints are tested like product code: each rule has a fixture that must fail, so a lint that stops catching shows up.
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { lintArch } from "../../../tools/lint-arch.ts";
import { lintPayload, parseCommand } from "../../../tools/lint-skills.ts";
import { cleanup, tmp } from "./helpers.ts";

const dirs: string[] = [];
const scratch = () => { const d = tmp("tenet-lint-"); dirs.push(d); return d; };
after(() => dirs.forEach(cleanup));

const PLUGIN = join(import.meta.dirname, "../../../plugin");
const copy = () => { const d = scratch(); cpSync(PLUGIN, d, { recursive: true, filter: (s) => !/\/kernel(\/|$)|\/schemas(\/|$)/.test(s) }); return d; };
const edit = (root: string, rel: string, fn: (s: string) => string) => writeFileSync(join(root, rel), fn(readFileSync(join(root, rel), "utf8")));

describe("lint-skills [ENG-03]", () => {
  it("passes the shipped payload [ENG-01]", () => assert.deepEqual(lintPayload(PLUGIN), []));

  it("fails an unknown verb, flag, decision kind and a call that does not satisfy its schema", () => {
    const d = copy();
    edit(d, "skills/tenet-build/SKILL.md", (s) => `${s}\nRun \`tenet bogus --h <handle>\`, \`tenet check --h <handle> --nope 1\`, \`tenet decide nonsense --h <handle>\` and \`tenet check --h W1 --stage candidate\`.\n`);
    const p = lintPayload(d).join("\n");
    assert.match(p, /no verb "bogus"/);
    assert.match(p, /unknown flag --nope/);
    assert.match(p, /no decision kind "nonsense"/);
    assert.match(p, /handle looks like/);
  });

  it("fails a next action the coordinator does not handle, and a missing steering row", () => {
    const d = copy();
    edit(d, "skills/tenet/SKILL.md", (s) => s.replace(/`recheck`/g, "recheck").replace(/^\| "do it" .*$/m, ""));
    const p = lintPayload(d).join("\n");
    assert.match(p, /next action "recheck" is not handled/);
    assert.match(p, /the word "do it" must have a steering row in exactly one skill, found 0/);
  });

  it("fails a body over budget, a dispatch outside the allowlist, a missing resource and an unknown skill name", () => {
    const d = copy();
    edit(d, "skills/tenet-build/SKILL.md", (s) => `${s}\n${"word ".repeat(17000)}\nSee resources/missing.md and load \`tenet-ghost\`.\n`);
    edit(d, "com.github.copilot/agents/tenet.agent.md", (s) => s.replace("agents: ['tenet-reviewer']", "agents: ['tenet-reviewer', 'rogue']"));
    const p = lintPayload(d).join("\n");
    assert.match(p, /tenet-build\/SKILL.md: body is \d+ tokens, budget 4000/);
    assert.match(p, /"rogue", which is not on the allowlist/);
    assert.match(p, /resource resources\/missing.md does not exist/);
    assert.match(p, /names "tenet-ghost"/);
  });

  it("fails a secret, an unscoped claim and an enforcement claim, and honors the lint-ok marker", () => {
    const d = copy();
    edit(d, "skills/tenet-intake/SKILL.md", (s) => `${s}\nThis is production-ready.\nIt prevents tampering.\ntoken ghp_${"a".repeat(30)}\nSay secure anyway. <!-- lint-ok -->\n`);
    const p = lintPayload(d);
    assert.ok(p.some((x) => /unscoped claim/.test(x)));
    assert.ok(p.some((x) => /claims enforcement/.test(x)));
    assert.ok(p.some((x) => /secret/.test(x)));
    assert.equal(p.filter((x) => /unscoped claim/.test(x)).length, 1, "the marked line is exempt");
  });

  it("fails a paragraph of 60 words that appears twice", () => {
    const d = copy();
    const para = Array.from({ length: 70 }, (_, i) => `w${i}`).join(" ");
    edit(d, "skills/tenet-intake/SKILL.md", (s) => `${s}\n${para}\n`);
    edit(d, "skills/tenet-build/SKILL.md", (s) => `${s}\n${para}\n`);
    assert.match(lintPayload(d).join("\n"), /repeats a paragraph/);
  });

  it("fails front matter that a YAML parser rejects, such as an unquoted colon in a description", () => {
    const d = copy();
    edit(d, "skills/tenet-build/SKILL.md", (s) => s.replace(/^description: ".*"$/m, "description: Test-first work: write the red"));
    assert.match(lintPayload(d).join("\n"), /front matter is not valid YAML/);
  });

  it("parses command lines the way the command line will", () => {
    assert.deepEqual(parseCommand("tenet check --h <handle> --stage baseline|candidate [--targeted]"), { verb: "check", input: { h: "W1.1.abcd", stage: "baseline" } });
    assert.deepEqual(parseCommand("tenet decide dirty-overlap --h <handle> --answer dirty-overlap=include").input, { kind: "dirty-overlap", h: "W1.1.abcd", answers: { "dirty-overlap": "include" } });
  });
});

describe("lint-arch", () => {
  const src = (files: Record<string, string>) => {
    const d = scratch();
    for (const [rel, text] of Object.entries(files)) { mkdirSync(join(d, rel, ".."), { recursive: true }); writeFileSync(join(d, rel), text); }
    return d;
  };
  it("passes the real source tree", () => assert.deepEqual(lintArch(join(import.meta.dirname, "../src")).problems, []));
  it("fails I/O and adapter imports in core, and I/O in verbs", () => {
    const p = lintArch(src({
      "core/a.ts": 'import { readFileSync } from "node:fs";\nimport { x } from "../adapters/store-fs.ts";\nexport const a = 1;',
      "verbs/b.ts": 'import { execFileSync } from "node:child_process";\nexport const b = 1;',
    })).problems.join("\n");
    assert.match(p, /core\/a.ts:1: node:fs: I\/O belongs in adapters/);
    assert.match(p, /core\/a.ts:2: core\/ may import only core/);
    assert.match(p, /verbs\/b.ts:1: node:child_process/);
  });
  it("fails vm, worker_threads, eval and computed import() everywhere", () => {
    const p = lintArch(src({ "adapters/c.ts": 'import vm from "node:vm";\nconst m = await import(name);\neval("1");\nexport {};' })).problems.join("\n");
    assert.match(p, /node:vm is banned/);
    assert.match(p, /computed dynamic import/);
    assert.match(p, /code evaluation/);
  });
  it("fails an endpoint set outside the verdict and a counter changed outside the budget", () => {
    const p = lintArch(src({
      "verbs/d.ts": 'export const f = (w: any) => ({ endpoint: "checked-local", attempts: w.attempts + 1 });',
      "core/verdict.ts": 'export const g = () => ({ endpoint: "checked-local" });',
    })).problems.join("\n");
    assert.match(p, /verbs\/d.ts:1: only core\/verdict.ts produces an endpoint/);
    assert.match(p, /verbs\/d.ts:1: only core\/budget.ts changes a counter/);
    assert.doesNotMatch(p, /^core\/verdict\.ts:/m);
  });
});
