import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test, type TestContext } from "node:test";
import { run } from "../../dist/cli.js";
import { validate } from "../../dist/core/schema.js";
import { parseDoc } from "../../dist/specs/parse.js";
import { fakeTty } from "../helpers/fakeTty.ts";
import { tmpRepo, type TemporaryRepository } from "../helpers/tmpRepo.ts";

const filename = "tenet/intent.md";
const body = "## Vision\n- V-1 Keep the queue small. {origin: asked}\n\n## Requirements\n- R-1 Retry once. {origin: asked; serves: V-1}\n";

function commit(repo: TemporaryRepository, name: string) {
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", name]);
  return repo.git(["rev-parse", "HEAD"]).trim();
}

async function cli(repo: TemporaryRepository, args: string[], input = "") {
  const io = fakeTty(input);
  const code = await run([...args, "--json"], { cwd: repo.path, ...io, checkEnvironment: false });
  return { code, response: JSON.parse(io.stdout.text), text: io.stderr.text };
}

async function setup(t: TestContext) {
  const repo = await tmpRepo("spec-front-matter");
  t.after(repo.cleanup);
  await repo.write(".gitignore", ".tenet/\n");
  await repo.write("tenet.yaml", "standard: 0.1.0-alpha.0\nkit_path: kit\nlevel: observe\nowners: [{id: ved, name: Ved, roles: [owner]}]\n");
  await repo.write("README.md", "# Synthetic queue\n");
  const revision = commit(repo, "sources");
  const assignment = await cli(repo, ["onboard", "--inventory-only", "--layout", "one-file"]);
  assert.equal(assignment.code, 0, JSON.stringify(assignment.response));
  return { repo, revision };
}

test("[AC-A1] [R2-13] check and board report a missing header at the assigned path", async (t) => {
  const { repo } = await setup(t);
  await repo.write(filename, body);
  await repo.write("tenet/unassigned.md", "---\ntenet: 0\nsections: []\n---\n## Non-specification note\n");
  const checked = await cli(repo, ["check"]);
  assert.equal(checked.code, 1);
  assert.deepEqual(checked.response.errors.map(({ code, file }: { code: string; file: string }) => [code, file]),
    [["TN-SPEC-NO-FRONT", filename]]);
  const board = fakeTty();
  assert.equal(await run(["board"], { cwd: repo.path, ...board, checkEnvironment: false }), 1);
  assert.doesNotMatch(board.stdout.text, /No specifications found/);
  assert.match(board.stderr.text, /tenet\/intent\.md/);
  assert.match(board.stderr.text, /Run .*tenet fix/);
});

test("[AC-A2] [R2-13] fix fills missing fields and preserves valid front matter", async (t) => {
  const { repo, revision } = await setup(t);
  await repo.write(filename, "---\ntenet: {version: '1.7', owner: ved, x-team: queue}\nsections:\n  requirements: {applies_to: ['src/**'], x-role: queue}\nx-project: queue\n---\n" + body);
  commit(repo, "partial front matter");
  const fixed = await cli(repo, ["fix"]);
  assert.equal(fixed.code, 0, JSON.stringify(fixed.response));
  const doc = parseDoc(filename, await readFile(path.join(repo.path, filename), "utf8"));
  assert.equal(validate("spec-front-matter", doc.front).ok, true);
  assert.deepEqual(doc.front?.tenet, { spec: 1, doc: "intent", level: "L1", version: "1.7", owner: "ved", drafted_from: revision, "x-team": "queue" });
  assert.equal(doc.front?.["x-project"], "queue");
  const sections = doc.front?.sections as Record<string, Record<string, unknown>>;
  assert.equal(sections.requirements?.["x-role"], "queue");
  assert.deepEqual(sections.requirements?.applies_to, ["src/**"]);
  assert.equal(sections.vision?.level, "L0");
  for (const section of doc.sections) assert.equal(sections[section.slug]?.digest, section.digest);
  assert.deepEqual((await cli(repo, ["fix"])).response.result.changes, []);
  commit(repo, "repaired draft");
  assert.equal((await cli(repo, ["onboard", "--card"])).code, 0);
});

test("[AC-A3] [R2-13] drafting skill sequence reaches check, card and blessing", async (t) => {
  const skill = await readFile("kit/skills/draft-specs/SKILL.md", "utf8");
  assert.ok(skill.includes("Don't write YAML front matter by hand. Run `tenet fix` to add it, then run `tenet check` and fix every citation finding until checks pass on the draft."));
  const { repo, revision } = await setup(t);
  await repo.write(".tenet/onboard/interview.json", JSON.stringify({ questions: [{
    id: "purpose", text: "What should the queue do?", answer: "Keep the queue small and retry once.",
    answered_at: "2026-11-26T00:00:00Z",
  }] }));
  await repo.write(filename, body);
  assert.equal((await cli(repo, ["fix"])).code, 0);
  assert.equal((await cli(repo, ["check"])).code, 0);
  const fixed = parseDoc(filename, await readFile(path.join(repo.path, filename), "utf8"));
  const tenet = fixed.front?.tenet as { drafted_from?: string } | undefined;
  assert.equal(tenet?.drafted_from, revision);
  commit(repo, "draft from interview");
  const card = await cli(repo, ["onboard", "--card"]);
  assert.equal(card.code, 0, JSON.stringify(card.response));
  assert.match(card.response.result.card, /Requirements · 1 statement/);
  const bless = await cli(repo, ["bless"], "\nbless\nbless\n");
  assert.equal(bless.code, 0, JSON.stringify(bless.response));
  assert.equal(bless.response.result.blessed, 2);
});

test("[AC-A4] [AC-A1] [R2-16] every command points to the invalid maps before blessing prompts", async (t) => {
  const { repo } = await setup(t);
  const malformed = "---\ntenet: '~0.1'\nsections:\n  - {id: vision, heading: Vision, level: L0}\n---\n" + body;
  await repo.write(filename, malformed);
  for (const args of [["check"], ["fix"], ["board"], ["onboard", "--card"], ["bless"]]) {
    const { code, response, text } = await cli(repo, args, "\nbless\nbless\n");
    assert.equal(code, 1, JSON.stringify(response));
    const error = response.errors.find(({ code }: { code: string }) => code === "TN-SCHEMA");
    assert.equal(error?.file, filename, JSON.stringify(response));
    assert.match(error.message, /\/tenet must be a map/);
    assert.match(error.message, /\/sections must be a map/);
    assert.match(error.fix, /tenet fix/);
    assert.doesNotMatch(text, /Who is blessing|bless \/ edit/);
  }
  assert.equal(await readFile(path.join(repo.path, filename), "utf8"), malformed);
  const checked = await cli(repo, ["check"]);
  assert.match(checked.response.errors[0]?.fix, /Replace \/tenet and \/sections with YAML maps/);
  await repo.write(filename, "---\ntenet: {}\nsections: {}\n---\n" + body);
  assert.equal((await cli(repo, ["fix"])).code, 0);
  assert.equal((await cli(repo, ["check"])).code, 0);
  assert.equal((await cli(repo, ["bless"], "\nbless\nbless\n")).code, 0);
});

test("[AC-A5] [R2-13] following the card repair instruction makes the retry pass", async (t) => {
  const { repo } = await setup(t);
  await repo.write(filename, body);
  const first = await cli(repo, ["onboard", "--card"]);
  assert.equal(first.response.errors[0]?.code, "TN-SPEC-NO-FRONT");
  assert.match(first.response.errors[0]?.fix, /tenet fix.*Commit the repaired draft/);
  assert.equal((await cli(repo, ["fix"])).code, 0);
  commit(repo, "add the repaired draft");
  assert.equal((await cli(repo, ["onboard", "--card"])).code, 0);
});
