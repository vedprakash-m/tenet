import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const kit = path.join(root, "kit");
const { validate } = (await import(pathToFileURL(path.join(root, "src", "core", "schema.ts")).href)) as typeof import(
  "../../src/core/schema.js"
);

const read = (...parts: string[]) => readFile(path.join(kit, ...parts), "utf8");
const tokens = (text: string) => Math.ceil(text.length / 4);
const frontMatter = (text: string): unknown => {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  return match ? parse(match[1]) : undefined;
};

const specTemplates = ["intent", "vision", "requirements", "design", "experience", "plan"];

test("every specification template's front matter is valid at the starter stage (before tenet fix)", async () => {
  for (const name of specTemplates) {
    const data = frontMatter(await read("templates", `${name}.md`));
    assert.ok(data, `${name}.md has front matter`);
    const result = validate("spec-front-matter", data);
    assert.equal(result.ok, true, `${name}.md: ${JSON.stringify(result.errors)}`);
  }
});

test("front matter after onboarding records its revisions and stays valid", async () => {
  const data = frontMatter(await read("templates", "intent.md")) as { tenet: Record<string, unknown> };
  data.tenet.drafted_from = "0123abc";
  data.tenet.drafted_at_rev = "4567def";
  assert.equal(validate("spec-front-matter", data).ok, true);
});

test("the template set named by CP-0012 is complete", async () => {
  const names = new Set(await readdir(path.join(kit, "templates")));
  for (const name of [...specTemplates, "pull-request", "agents-block", "escalation"]) {
    assert.ok(names.has(`${name}.md`), `kit/templates/${name}.md exists`);
  }
});

test("the minimal pack carries the alpha.0 pack fields (tech spec §6.2)", async () => {
  const pack = parse(await read("packs", "minimal", "pack.yaml")) as Record<string, unknown>;
  for (const key of ["pack", "version", "description", "phases", "stations", "loop_backs", "lanes", "human_touches", "work_types", "rules_alpha0"]) {
    assert.ok(key in pack, `pack.yaml has ${key}`);
  }
  const rules = (pack.rules_alpha0 as { id: string }[]).map((rule) => rule.id);
  assert.ok(rules.includes("acceptance-passed"));
  assert.ok(!rules.includes("acceptance-proven"));
});

test("[AB-B4] [F-12] skills use installed names and stay within their 2,000-token budget", async () => {
  for (const name of ["draft-specs", "work-a-change", "review-with-findings"]) {
    const text = await read("skills", name, "SKILL.md");
    assert.ok(tokens(text) <= 2000, `${name}: ${tokens(text)} tokens`);
    assert.equal(frontMatter(text) && (frontMatter(text) as Record<string, unknown>).name, `tenet-${name}`);
  }
});

test("agent cards and the default practices are present with front matter", async () => {
  for (const name of ["drafter", "spec-reviewer"]) {
    const card = frontMatter(await read("agents", `${name}.md`)) as Record<string, unknown> | undefined;
    assert.ok(card, `${name}.md has front matter`);
    assert.equal(card.name, name);
  }
  assert.ok((await read("practices", "default.md")).trim().length > 0);
});

test("a blessed section must say how it was recorded and where its blessed copy is", async () => {
  const data = frontMatter(await read("templates", "intent.md")) as { sections: Record<string, Record<string, unknown>> };
  data.sections.vision.state = "blessed";
  assert.equal(validate("spec-front-matter", data).ok, false);
});

test("the minimal pack and every agent card validate through the schema registry", async () => {
  const pack = validate("pack", parse(await read("packs", "minimal", "pack.yaml")));
  assert.equal(pack.ok, true, JSON.stringify(pack.errors));
  for (const name of ["drafter", "spec-reviewer"]) {
    const card = validate("agent-card", frontMatter(await read("agents", `${name}.md`)));
    assert.equal(card.ok, true, `${name}: ${JSON.stringify(card.errors)}`);
  }
});
