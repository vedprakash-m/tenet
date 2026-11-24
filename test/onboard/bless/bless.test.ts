import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { test, type TestContext } from "node:test";
import { pathToFileURL } from "node:url";
import { Ajv2020 } from "ajv/dist/2020.js";
import { run } from "../../../dist/cli.js";
import { runBless } from "../../../dist/onboard/bless.js";
import { onboardingCard } from "../../../dist/onboard/card.js";
import { parseDoc } from "../../../dist/specs/parse.js";
import { validate } from "../../../dist/core/schema.js";
import { fakeTty } from "../../helpers/fakeTty.ts";
import { tmpRepo, type TemporaryRepository } from "../../helpers/tmpRepo.ts";

const filename = "tenet/intent.md";
const copy = "tenet/blessed/tenet__intent.md/requirements.md";
const log = "tenet/blessed/log.jsonl";
const requirement = "- R-1 Retry once. {origin: observed; cites: src/retry.ts:1}";
const date = "2026-11-23T10:00:00Z";
function spec(body: string, fields = "") {
  return `---\ntenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: ved${fields}}\nsections: {}\n---\n${body.trimEnd()}\n`;
}
const config = `standard: 0.1.0-alpha.0
kit_path: kit
level: observe
owners:
  - {id: ved, name: Ved, roles: [owner]}
specs:
  documents:
    - {path: intent.md, level: L1}
`;
const at = () => new Date(date);
function commit(repo: TemporaryRepository, words: string) {
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", words]);
  return repo.git(["rev-parse", "HEAD"]).trim();
}

async function setup(t: TestContext, body?: string) {
  const repo = await tmpRepo("bless");
  t.after(repo.cleanup);
  await repo.write("tenet.yaml", config);
  await repo.write("src/retry.ts", "const times = 1;\n");
  if (body) await repo.write(filename, spec(body));
  commit(repo, "fixture");
  return repo;
}

function raw(repo: TemporaryRepository, file = filename) {
  return readFile(path.join(repo.path, file), "utf8");
}
async function state(repo: TemporaryRepository, section = "requirements") {
  return parseDoc(filename, await raw(repo)).sections.find(({ slug }) => slug === section);
}
async function speak(repo: TemporaryRepository, input: string, extra = {}) {
  const tty = fakeTty(input);
  const result = await runBless({ cwd: repo.path }, { ...tty, now: at, ...extra });
  return { ...result, text: tty.stdout.text };
}

test("bless refuses non-terminal input with exit 2 through the public CLI", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  const shell = fakeTty();
  const code = await run(["--json", "bless"], {
    cwd: repo.path, stdin: Readable.from(["1\nbless\n"]), stdout: shell.stdout, stderr: shell.stderr, checkEnvironment: false,
  });
  assert.equal(code, 2);
  assert.equal(JSON.parse(shell.stdout.text).errors[0].code, "TN-BLESS-NO-TTY");
  assert.equal((await state(repo))?.state, "draft");
  await assert.rejects(raw(repo, copy), { code: "ENOENT" });
});

test("an inferred statement left unresolved refuses the blessing", async (t) => {
  const repo = await setup(t, "## Requirements\n- R-1 Retry once. {origin: inferred}");
  const result = await speak(repo, "1\nbless\nleave\n");
  assert.equal(result.findings[0]?.code, "TN-BLESS-INFERRED");
  assert.equal(result.result?.blessed, 0);
  assert.equal((await state(repo))?.state, "draft");
  await assert.rejects(raw(repo, copy), { code: "ENOENT" });
});

test("adoption records the chosen owner on a list item and a table row", async (t) => {
  const repo = await setup(t, [
    "## Requirements",
    "- R-1 Retry once. {origin: inferred}",
    "",
    "| ID | Requirement | Origin |",
    "|---|---|---|",
    "| R-2 | Keep the receipt. | inferred |",
  ].join("\n"));
  const result = await speak(repo, "1\nbless\nadopt\n");
  assert.deepEqual(result.findings, []);
  const requirements = (await state(repo))?.requirements ?? [];
  assert.deepEqual(requirements.map(({ id, origin, adopted_by }) => [id, origin, adopted_by]), [
    ["R-1", "asked", "ved"], ["R-2", "asked", "ved"],
  ]);
});

const openConflict = [
  "## Requirements", requirement, "## Conflicts",
  "- [ ] CF-1 (section: requirements) Sources disagree. | 1: retry twice | 2: retry once",
].join("\n");

test("an open conflict is offered before the section and blocks blessing when postponed", async (t) => {
  const repo = await setup(t, openConflict);
  const result = await speak(repo, "1\n3\nbless\n");
  assert.equal(result.findings[0]?.code, "TN-BLESS-OPEN-CONFLICT");
  assert.match(result.text, /Conflict CF-1/);
  assert.doesNotMatch(result.text, /Requirements \(/);
  assert.equal((await state(repo))?.state, "draft");
});

test("a contradictory conflict choice requires editing the affected statement before resolution", async (t) => {
  const repo = await setup(t, openConflict);
  const unchanged = await speak(repo, "1\n1\nR-1\nbless\n", { edit: async () => {} });
  assert.match(unchanged.text, /still open/);
  assert.equal(unchanged.findings[0]?.code, "TN-BLESS-OPEN-CONFLICT");

  let edits = 0;
  const fixed = await speak(repo, "1\n1\nR-1\nbless\n", {
    edit: async (file: string) => {
      assert.equal(path.normalize(file), path.join(repo.path, filename));
      const content = await readFile(file, "utf8");
      await writeFile(file, content.replace("Retry once.", "Retry twice.").replace("origin: observed", "origin: asked"));
      edits++;
    },
  });
  assert.equal(edits, 1);
  assert.deepEqual(fixed.findings, []);
  assert.equal(fixed.result?.blessed, 1);
  assert.match(await raw(repo), /\[x\] CF-1.*resolution: retry twice/);
  assert.match(await raw(repo, copy), /Retry twice/);
});

test("an interruption preserves finished sections and the matching log entry", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}\n\n## Design\nStore no secrets.\n`);
  const before = repo.git(["rev-parse", "HEAD"]);
  const result = await speak(repo, "1\nbless\n");
  assert.deepEqual(result.findings, []);
  assert.equal(result.result?.blessed, 1);
  assert.equal((await state(repo))?.state, "blessed");
  assert.equal((await state(repo, "design"))?.state, "draft");
  assert.equal(repo.git(["rev-parse", "HEAD"]), before);
  const lines = (await raw(repo, log)).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0]), {
    doc: filename, section: "requirements", action: "bless", by: "ved", at: date, minutes: 0,
    statements: { drafted: null, kept: null, edited: null, adopted: null, added: null },
  });
  assert.match(result.text, /git commit -m "Bless specifications"/);
});

test("re-blessing an edited section bumps its version and uses the recorded draft for metrics", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  const draft = repo.git(["rev-parse", "HEAD"]).trim();
  await repo.write(filename, spec(`## Requirements\n${requirement}`, `, drafted_at_rev: "${draft}"`));
  assert.equal((await speak(repo, "1\nbless\n")).result?.blessed, 1);
  assert.match(await raw(repo), /version: ["']?0\.1/);
  assert.match(await raw(repo, copy), /Retry once/);
  await repo.write(filename, (await raw(repo)).replace("Retry once.", "Retry twice."));
  assert.equal((await speak(repo, "1\nbless\n")).result?.blessed, 1);
  assert.match(await raw(repo), /version: ["']?0\.2/);
  assert.match(await raw(repo, copy), /Retry twice/);
  const last = JSON.parse((await raw(repo, log)).trim().split("\n").at(-1));
  assert.deepEqual(last.statements, { drafted: 1, kept: 0, edited: 1, adopted: 0, added: 0 });
  assert.equal(validate("spec-front-matter", parseDoc(filename, await raw(repo)).front).ok, true);
});

test("rejecting an edit can restore the blessed copy while draft reject and defer stay distinct", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  await speak(repo, "1\nbless\n");
  const original = await raw(repo, copy);
  const edited = (await raw(repo)).replace("Retry once.", "Retry twice.");
  await repo.write(filename, edited);
  const retained = await speak(repo, "1\nreject\nn\n");
  assert.equal(retained.result?.rejected, 1);
  assert.equal((await state(repo))?.state, "blessed");
  assert.match(await raw(repo), /Retry twice/);
  const restored = await speak(repo, "1\nreject\ny\n");
  assert.equal(restored.result?.rejected, 1);
  assert.equal(await raw(repo, copy), original);
  assert.match(await raw(repo), /Retry once/);

  await repo.write(filename, spec(`## Requirements\n${requirement}\n\n## Design\nStore no secrets.`));
  const result = await speak(repo, "1\nreject\ndefer\n");
  assert.equal(result.result?.rejected, 1);
  assert.equal(result.result?.deferred, 1);
  assert.equal((await state(repo))?.state, "rejected");
  assert.equal((await state(repo, "design"))?.state, "deferred");
});

test("confirm uses the anchor sidecar after a squash and preserves a separate text edit", async (t) => {
  const seed = await setup(t, `## Requirements\n${requirement}`);
  const oldHead = seed.git(["rev-parse", "HEAD"]).trim();
  await seed.write(filename, spec(`## Requirements\n${requirement}`, `, drafted_at_rev: "${oldHead}"`));
  const blessed = await speak(seed, "1\nbless\n");
  assert.deepEqual(blessed.findings, []);
  const oldCopy = await raw(seed, copy);
  await seed.write(filename, (await raw(seed)).replace("Retry once.", "Retry twice."));
  await seed.write("src/retry.ts", "const times = 2;\n");
  commit(seed, "update source and propose a draft");
  const squashed = seed.git(["commit-tree", "HEAD^{tree}", "-m", "squash"]).trim();
  seed.git(["update-ref", "refs/heads/squashed", squashed]);
  const local = await tmpRepo("shallow-container");
  t.after(local.cleanup);
  const cloned = path.join(local.path, "clone");
  local.git(["clone", "-q", "--depth", "1", "--branch", "squashed", pathToFileURL(seed.path).href, cloned]);
  assert.equal(local.git(["-C", cloned, "rev-parse", "--is-shallow-repository"]).trim(), "true");
  assert.throws(() => local.git(["-C", cloned, "cat-file", "-e", oldHead]));
  const tty = fakeTty("1\nconfirm\ny\n");
  const result = await runBless({ cwd: cloned }, { ...tty, now: at });
  assert.deepEqual(result.findings, []);
  assert.equal(result.result?.confirmed, 1);
  assert.match(tty.stdout.text, /Old src\/retry\.ts:1:\nconst times = 1;/);
  assert.match(tty.stdout.text, /New src\/retry\.ts:1:\nconst times = 2;/);
  assert.equal(await readFile(path.join(cloned, copy), "utf8"), oldCopy);
  const live = parseDoc(filename, await readFile(path.join(cloned, filename), "utf8"));
  assert.deepEqual(live.sections[0]?.flags, ["edited"]);
  assert.equal(live.sections[0]?.blessed_at_rev, squashed);
  const last = JSON.parse((await readFile(path.join(cloned, log), "utf8")).trim().split("\n").at(-1));
  assert.equal(last.statements.drafted, null);
});

test("a failed log write does not leave the section blessed or publish a new sidecar", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  await mkdir(path.join(repo.path, log), { recursive: true });
  const before = await raw(repo);
  const result = await speak(repo, "1\nbless\n");
  assert.equal(result.findings[0]?.code, "TN-INTERNAL");
  assert.equal(await raw(repo), before);
  await assert.rejects(raw(repo, copy), { code: "ENOENT" });
  await assert.rejects(raw(repo, `${copy}.anchors.json`), { code: "ENOENT" });
});

test("bless JSON uses the result schema and keeps every prompt on stderr", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  const shell = fakeTty("1\nbless\n");
  const code = await run(["--json", "bless", "--doc", "intent", "--section", "requirements"], {
    cwd: repo.path, ...shell, now: at, checkEnvironment: false,
  });
  const envelope = JSON.parse(shell.stdout.text);
  assert.equal(code, 0, shell.stderr.text);
  assert.equal(envelope.command, "bless");
  const schema = JSON.parse(await readFile("kit/schemas/results/bless.json", "utf8"));
  assert.equal(new Ajv2020().compile(schema)(envelope.result), true);
  assert.match(shell.stderr.text, /Who is blessing/);
  assert.match(shell.stderr.text, /Retry once/);
});

test("onboard --card counts sources and origins, records the draft commit, and repeats exactly", async (t) => {
  const repo = await setup(t);
  const inventoryRef = repo.git(["rev-parse", "HEAD"]).trim();
  const io = fakeTty();
  assert.equal(await run(["--json", "onboard", "--inventory-only"], { cwd: repo.path, ...io, checkEnvironment: false }), 0);
  await repo.write(filename, spec(openConflict));
  const draft = commit(repo, "draft specification");
  const card = await onboardingCard({ cwd: repo.path, pr: 12 });
  assert.equal(card, [
    `### Tenet onboarding · drafted from ${inventoryRef.slice(0, 7)} · nothing is in force until you bless it`,
    "Read: 1 source file, 0 test files, 0 instruction files · Skipped: none",
    "✓ all 1 citations checked against the code",
    "Conflicts (settle these first)",
    "  ! CF-1 Sources disagree.",
    "Sections (about 1 minute)",
    "  Requirements · 1 statement · 1 observed · 1 min",
    "→ gh pr checkout 12, then tenet bless in your terminal (or edit the files first)",
    "",
  ].join("\n"));
  const marked = await raw(repo);
  assert.equal((parseDoc(filename, marked).front?.tenet as { drafted_at_rev: string } | undefined)?.drafted_at_rev, draft);
  assert.equal(await onboardingCard({ cwd: repo.path, pr: 12 }), card);
  assert.equal(await raw(repo), marked);
  assert.equal(repo.git(["rev-parse", "HEAD"]).trim(), draft);
  const output = fakeTty();
  assert.equal(await run(["--json", "onboard", "--card"], { cwd: repo.path, ...output, checkEnvironment: false }), 0);
  assert.match(JSON.parse(output.stdout.text).result, /gh pr checkout <n>/);
});

test("onboarding card refuses to pin a draft that differs from HEAD", async (t) => {
  const repo = await setup(t);
  const io = fakeTty();
  assert.equal(await run(["--json", "onboard"], { cwd: repo.path, ...io, checkEnvironment: false }), 0);
  await repo.write(filename, spec(`## Requirements\n${requirement}`));
  await assert.rejects(onboardingCard({ cwd: repo.path }), { code: "TN-SUBJ-DIRTY" });
  assert.doesNotMatch(await raw(repo), /drafted_at_rev/);
});

test("onboard --card explains that a draft is needed before it writes anything", async (t) => {
  const repo = await setup(t);
  const inventory = fakeTty();
  assert.equal(await run(["--json", "onboard"], { cwd: repo.path, ...inventory, checkEnvironment: false }), 0);
  const request = fakeTty();
  assert.equal(await run(["--json", "onboard", "--card"], { cwd: repo.path, ...request, checkEnvironment: false }), 2);
  assert.match(JSON.parse(request.stdout.text).errors[0].message, /commit a specification draft/);
  await assert.rejects(raw(repo), { code: "ENOENT" });
});

test("bless discovers the one-file intent only when specs.documents is empty or omitted", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  await repo.write("tenet.yaml", config.replace("path: intent.md", "path: vision.md"));
  assert.equal((await speak(repo, "1\nbless\n")).result?.blessed, 0);
  await repo.write("tenet.yaml", config.split("specs:")[0]);
  const result = await speak(repo, "1\nbless\n");
  assert.deepEqual(result.findings, []);
  assert.equal(result.result?.blessed, 1);
  assert.match(await raw(repo, copy), /Retry once/);
});

test("self blessing offers configured IDs and falls back to ownersFor", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  await repo.write("CODEOWNERS", "/tenet/intent.md @platform\n");
  await repo.write("tenet.yaml", config.split("owners:")[0]);
  const result = await speak(repo, "1\nbless\n");
  assert.deepEqual(result.findings, []);
  assert.match(result.text, /Who is blessing\? 1\. @platform/);
  assert.equal(JSON.parse(await raw(repo, log)).by, "@platform");
});

test("re-blessing increments a legacy suffix or appends one when absent", async (t) => {
  const repo = await setup(t, `## Requirements\n${requirement}`);
  await repo.write(filename, (await raw(repo)).replace('"0.1"', '"v1"'));
  assert.equal((await speak(repo, "1\nbless\n")).result?.blessed, 1);
  assert.match(await raw(repo), /version: "?v1"?,/);
  await repo.write(filename, (await raw(repo)).replace("Retry once.", "Retry twice."));
  assert.equal((await speak(repo, "1\nbless\n")).result?.blessed, 1);
  assert.match(await raw(repo), /version: "?v1\.1"?,/);
  await repo.write(filename, (await raw(repo)).replace("Retry twice.", "Retry again."));
  assert.equal((await speak(repo, "1\nbless\n")).result?.blessed, 1);
  assert.match(await raw(repo), /version: "?v1\.2"?,/);
});

test("the log keeps one action per finished section and accounts for kept adoptions and deletions", async (t) => {
  const draftBody = "## Requirements\n- R-1 Retry once. {origin: inferred}\n- R-2 Keep a receipt. {origin: asked}\n\n## Design\nKeep local state.";
  const repo = await setup(t, draftBody);
  const draft = repo.git(["rev-parse", "HEAD"]).trim();
  await repo.write(filename, spec(draftBody.replace("- R-2 Keep a receipt. {origin: asked}\n", ""), `, drafted_at_rev: "${draft}"`));
  const result = await speak(repo, "1\nbless\nadopt\nlater\n");
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.result, { blessed: 1, confirmed: 0, rejected: 0, deferred: 1, minutes: 0 });
  const rows = (await raw(repo, log)).trim().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(rows.map(({ section, action, statements }) => [section, action, statements]), [
    ["requirements", "bless", { drafted: 2, kept: 1, edited: 1, adopted: 1, added: 0 }],
    ["design", "defer", { drafted: 1, kept: 1, edited: 0, adopted: 0, added: 0 }],
  ]);
});

test("conflict review uses the named heading and affects IDs, and requires a substantive edit", async (t) => {
  const body = "## Requirements\n- R-1 Retry once. {origin: asked}\n- R-2 Store a receipt. {origin: asked}\n" +
    "## Conflicts\n- [ ] CF-1 (section: Requirements) (affects: R-1) Sources disagree. | 1: retry twice";
  const repo = await setup(t, body);
  const result = await speak(repo, "1\n1\nR-2\nR-1\n", {
    edit: async (file: string) => writeFile(file, (await raw(repo)).replace("Retry once.", "Retry  once.")),
  });
  assert.match(result.text, /Choose one of the listed options/);
  assert.match(result.text, /Edit R-1/);
  assert.equal(result.findings[0]?.code, "TN-BLESS-OPEN-CONFLICT");
  assert.doesNotMatch(await raw(repo), /resolution:/i);
});

test("a checked conflict with uppercase Resolution is accepted without a new prompt", async (t) => {
  const body = "## Requirements\n- R-1 Retry once. {origin: asked}\n" +
    "## Conflicts\n- [x] CF-1 (section: Requirements) Sources disagree. | Resolution: retry once";
  const repo = await setup(t, body);
  const result = await speak(repo, "1\nbless\n");
  assert.deepEqual(result.findings, []);
  assert.equal(result.result?.blessed, 1);
  assert.doesNotMatch(result.text, /Conflict CF-1/);
});
