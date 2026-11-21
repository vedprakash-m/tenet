// GIT-09: Tenet's shared files (INTENT.md, docs/hardening.md, decision files) reconciled by ID on integration. The pure
// merge runs everywhere; the real-Git integration cases change state and run only where mutating work is allowed (Linux, macOS CI).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { planShared } from "../src/core/shared-merge.ts";
import type { MergeSide } from "../src/core/shared-merge.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const block = (id: string, body: string) => `<!-- tenet:begin ${id} -->\n${body}\n<!-- tenet:end ${id} -->\n`;
const intent = (...blocks: string[]) => `# Intent\n\nOur own notes.\n\n${blocks.join("\n")}`;
type Files = Record<string, string | null>;
const snap = (files: Files) => new Map(Object.entries(files).filter((e): e is [string, string] => e[1] !== null));
const SEED = "0123456789abcdef";
/** The plan for INTENT.md alone (strings), or for several files (maps). */
const plan = (b: string | null | Files, o: string | Files, t: string | Files, sides?: Record<string, MergeSide>) => {
  const as = (x: string | null | Files) => (typeof x === "object" && x !== null ? snap(x) : snap({ "INTENT.md": x }));
  return planShared({ base: as(b), ours: as(o), theirs: as(t), seed: SEED, ...(sides ? { sides } : {}) });
};
const merged = (...args: Parameters<typeof plan>) => {
  const m = plan(...args);
  assert.ok(m.ok, JSON.stringify(m));
  return { ...m, text: m.files.get("INTENT.md") ?? "" };
};
const decision = (id: string, title: string, extra = "") => `---\nid: ${id}\nstatus: accepted\ndate: 2026-11-15\n---\n# ${title}\n${extra}`;

describe("shared files merged by ID [GIT-09]", () => {
  const req1 = block("REQ-001-aaa", "**REQ-001-aaa Greets by name**");
  const base = intent(req1);

  it("takes one-sided changes and blocks with different IDs from both sides, keeping the human text [GIT-09]", () => {
    const ours = intent(req1, block("REQ-002-bbb", "**REQ-002-bbb Base adds this**"));
    const theirs = intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by full name**"), block("CNS-003-ccc", "**CNS-003-ccc Work adds this**"));
    const m = merged(base, ours, theirs);
    assert.deepEqual(m.collisions, []);
    assert.match(m.text, /^# Intent\n\nOur own notes\.\n/);
    assert.match(m.text, /Greets by full name/);
    assert.match(m.text, /REQ-002-bbb Base adds this/);
    assert.match(m.text, /CNS-003-ccc Work adds this/);
    assert.equal(plan(base, m.text, m.text).ok, true, "the result parses again");
  });

  it("reports the same existing ID changed differently on both sides as a content collision, the work side proposed [GIT-09]", () => {
    const ours = intent(block("REQ-001-aaa", "**REQ-001-aaa Greets politely**"));
    const theirs = intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by full name**"));
    const m = merged(base, ours, theirs);
    assert.equal(m.collisions.length, 1);
    const c = m.collisions[0]!;
    assert.deepEqual([c.kind, c.id, c.path, c.side], ["content", "REQ-001-aaa", "INTENT.md", "work"]);
    assert.match(c.base!, /Greets by name/);
    assert.match(c.ours!, /Greets politely/);
    assert.match(c.theirs!, /Greets by full name/);
    assert.match(m.text, /Greets by full name/);
    assert.doesNotMatch(m.text, /Greets politely/);
    const t = merged(base, ours, theirs, { "REQ-001-aaa": "target" });
    assert.equal(t.collisions[0]!.side, "target");
    assert.match(t.text, /Greets politely/, "the user may keep the target branch's text for that ID");
    assert.doesNotMatch(t.text, /Greets by full name/);
  });

  it("re-suffixes an ID both sides created, with its examples and the work branch's links, the same way every time [GIT-09]", () => {
    const ours = intent(req1, block("REQ-002-bbb", "**REQ-002-bbb Base meaning**\n- EX-002-bbb.1 base example"));
    const theirs = intent(
      req1,
      block("REQ-002-bbb", "**REQ-002-bbb Work meaning**\n- EX-002-bbb.1 work example"),
      block("DEC-003-ddd", "**DEC-003-ddd Choose a format** (accepted, 2026-11-10)\n- Affects: REQ-002-bbb"),
    );
    const m = merged(base, ours, theirs);
    assert.equal(m.collisions.length, 1);
    const c = m.collisions[0]!;
    assert.equal(c.kind, "duplicate");
    assert.equal(c.id, "REQ-002-bbb");
    assert.match(c.renamedTo!, /^REQ-002-[a-z2-7]{3}$/);
    assert.notEqual(c.renamedTo, "REQ-002-bbb");
    const core = c.renamedTo!.slice(4);
    assert.match(m.text, /<!-- tenet:begin REQ-002-bbb -->\n\*\*REQ-002-bbb Base meaning/);
    assert.ok(m.text.includes(`<!-- tenet:begin ${c.renamedTo} -->\n**${c.renamedTo} Work meaning**\n- EX-${core}.1 work example`));
    assert.ok(m.text.includes(`- Affects: ${c.renamedTo}`), "a link in a block the work branch added follows the new ID");
    assert.equal(merged(base, ours, theirs).text, m.text, "the proposal is deterministic");
  });

  it("rewrites a mention in a block only the work branch changed, and refuses one in a block both changed alike [GIT-09]", () => {
    const cns = block("CNS-004-eee", "**CNS-004-eee Keep it short**");
    const b = intent(req1, cns);
    const ours = intent(req1, cns, block("REQ-002-bbb", "**REQ-002-bbb Base meaning**"));
    const theirs = intent(req1, block("CNS-004-eee", "**CNS-004-eee Keep it short; see REQ-002-bbb**"), block("REQ-002-bbb", "**REQ-002-bbb Work meaning**"));
    const m = merged(b, ours, theirs);
    const to = m.renames.get("REQ-002-bbb")!;
    assert.ok(m.text.includes(`Keep it short; see ${to}`), "the work branch's own edit follows the new ID");
    const both = block("CNS-004-eee", "**CNS-004-eee Keep it short; see REQ-002-bbb**");
    const refused = plan(b, intent(req1, both, block("REQ-002-bbb", "**REQ-002-bbb Base meaning**")), intent(req1, both, block("REQ-002-bbb", "**REQ-002-bbb Work meaning**")));
    assert.equal(refused.ok, false, "a mention both branches wrote cannot be attributed");
  });

  it("treats the same ID created with the same content on both sides as one block [GIT-09]", () => {
    const both = intent(req1, block("REQ-002-bbb", "**REQ-002-bbb Same**"));
    const m = merged(base, both, both.replace(/\n/g, "\r\n"));
    assert.deepEqual(m.collisions, []);
    assert.equal(m.text, both);
  });

  it("proposes nothing when both sides changed the text outside the blocks, a marker is damaged, or a file is not text [GIT-09]", () => {
    const ours = intent(req1).replace("Our own notes.", "Base notes.");
    const theirs = intent(req1).replace("Our own notes.", "Work notes.");
    assert.equal(plan(base, ours, theirs).ok, false);
    assert.equal(plan(base, intent(req1, block("REQ-005-fff", "x")), `${intent(req1)}<!-- tenet:begin REQ-009-zzz -->\n`).ok, false);
    assert.equal(plan(base, intent(req1, block("REQ-005-fff", "x")), intent(req1, block("REQ-006-ggg", "bad \u0000 byte"))).ok, false);
  });

  it("merges docs/hardening.md blocks by ID and keeps the human text one side changed [GIT-09]", () => {
    const h = (...blocks: string[]) => `# Hardening\n\nRead this before you ship.\n\n${blocks.join("\n")}`;
    const a = block("HARDENING-wk_aaaaaaaaaa", "**Prototype W-0001: unhardened**");
    const b2 = block("HARDENING-wk_bbbbbbbbbb", "**Prototype W-0002: unhardened**");
    const m = plan({ "docs/hardening.md": h() }, { "docs/hardening.md": h(a) }, { "docs/hardening.md": h(b2).replace("Read this", "Please read this") });
    assert.ok(m.ok, JSON.stringify(m));
    const text = m.files.get("docs/hardening.md")!;
    assert.match(text, /Please read this before you ship/);
    assert.match(text, /HARDENING-wk_aaaaaaaaaa/);
    assert.match(text, /HARDENING-wk_bbbbbbbbbb/);
    assert.deepEqual(m.collisions, []);
  });

  it("reports a decision file changed on both sides as a content collision, and a deletion as a null side [GIT-09]", () => {
    const p = "docs/decisions/0003-DEC-003-ddd-format.md";
    const b = { [p]: decision("DEC-003-ddd", "Format") };
    const m = plan(b, { [p]: decision("DEC-003-ddd", "Format: JSON") }, { [p]: decision("DEC-003-ddd", "Format: YAML") });
    assert.ok(m.ok, JSON.stringify(m));
    assert.deepEqual(m.collisions.map((c) => [c.kind, c.id, c.path, c.side]), [["content", "DEC-003-ddd", p, "work"]]);
    assert.match(m.files.get(p)!, /YAML/);
    const del = plan(b, { [p]: decision("DEC-003-ddd", "Format: JSON") }, {});
    assert.ok(del.ok, JSON.stringify(del));
    assert.equal(del.files.get(p), null, "the work branch deleted it: the proposal deletes it");
    assert.equal(del.collisions[0]!.theirs, null);
  });

  it("renames the work branch's decision file created with the same ID, in its name, front matter and body [GIT-09]", () => {
    const same = "docs/decisions/0007-DEC-007-abc-cache.md", other = "docs/decisions/0007-DEC-007-abc-store.md";
    const ours = { [same]: decision("DEC-007-abc", "Cache in memory") };
    for (const workPath of [same, other]) {
      const m = plan({}, ours, { [workPath]: decision("DEC-007-abc", "Cache on disk", "See DEC-007-abc.\n") });
      assert.ok(m.ok, JSON.stringify(m));
      const to = m.renames.get("DEC-007-abc")!;
      const newPath = workPath.replace("DEC-007-abc", to);
      const text = m.files.get(newPath)!;
      assert.ok(text.startsWith(`---\nid: ${to}\n`), text);
      assert.ok(text.includes(`See ${to}.`), text);
      if (workPath === same) assert.match(m.files.get(same)!, /Cache in memory/, "the target branch's file keeps its path");
      else assert.equal(m.files.get(other), null, "the work branch's copy at its old path is removed");
      assert.deepEqual(m.collisions.map((c) => [c.kind, c.id, c.renamedTo]), [["duplicate", "DEC-007-abc", to]]);
      assert.equal(m.names.get(workPath.slice(workPath.lastIndexOf("/") + 1)), newPath.slice(newPath.lastIndexOf("/") + 1));
    }
  });

  it("gives a duplicate one new ID in every file it is in [GIT-09]", () => {
    const p = "docs/decisions/0007-DEC-007-abc-cache.md";
    const m = plan(
      { "INTENT.md": base },
      { "INTENT.md": intent(req1, block("DEC-007-abc", "**DEC-007-abc Memory**")), [p]: decision("DEC-007-abc", "Memory") },
      { "INTENT.md": intent(req1, block("DEC-007-abc", "**DEC-007-abc Disk**")), [p]: decision("DEC-007-abc", "Disk") },
    );
    assert.ok(m.ok, JSON.stringify(m));
    assert.equal(new Set(m.collisions.map((c) => c.renamedTo)).size, 1, JSON.stringify(m.collisions));
  });

  it("gives no proposal for a decision file whose front matter id is not the ID in its name [GIT-09]", () => {
    const p = "docs/decisions/0007-DEC-007-abc-cache.md";
    const m = plan({}, { [p]: decision("DEC-007-abc", "Memory") }, { [p]: decision("DEC-009-zzz", "Disk") });
    assert.equal(m.ok, false);
    assert.match((m as { why: string }).why, /front matter/);
  });
});

const POSIX = { skip: process.platform === "win32" && "mutating work is refused on Windows" };
const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const textOf = (f: { file: string }) => readFileSync(f.file, "utf8");
const D3 = "docs/decisions/0003-DEC-003-ddd-format.md";
const START = intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by name**"));

/** Writes (or with null removes) project files. */
function put(p: Project, files: Files) {
  for (const [path, text] of Object.entries(files)) text === null ? rmSync(join(p.root, path)) : p.write(path, text);
}
const has = (p: Project, ref: string, path: string) => p.git("ls-tree", "--name-only", ref, "--", path) === path;

/** A finished contract; then the work branch and main each commit their own changes to the files given. */
async function diverged(p: Project, sides: { start?: Files; work: Files; target: Files }) {
  put(p, { "INTENT.md": START, ...sides.start });
  p.git("add", "-A"); p.git("commit", "-qm", "intent");
  const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
  const h = o.handle!;
  // Managed blocks with no `.tenet/` look like lost local records (CON-07): keep the fresh start the test assumes.
  assert.equal(o.questions?.[0]?.id, "reconstruction-review", JSON.stringify(o));
  await p.call("decide", { h, kind: "adopt", target: "reconstruction", answers: { "reconstruction-review": "fresh" } });
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  const f = await finishFixture(p, { h, subject: "Add greet" });
  assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
  const work = p.git("branch", "--show-current");
  put(p, sides.work);
  p.git("add", "-A"); p.git("commit", "-qm", "work edits shared files");
  p.git("switch", "-q", "main");
  put(p, sides.target);
  p.git("add", "-A"); p.git("commit", "-qm", "main edits shared files");
  p.git("switch", "-q", work);
  return { h, work };
}

/** Both branches change REQ-001-aaa and create REQ-002-bbb with different meanings, so INTENT.md conflicts. */
const DEFAULT = {
  work: { "INTENT.md": intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by full name**"), block("REQ-002-bbb", "**REQ-002-bbb Work rule**")) },
  target: { "INTENT.md": intent(block("REQ-001-aaa", "**REQ-001-aaa Greets politely**"), block("REQ-002-bbb", "**REQ-002-bbb Base rule**")) },
};
/** Git merges INTENT.md cleanly, but both branches created REQ-002-bbb in different places. */
const head2 = "# Intent\n\nOur own notes.\n\n";
const CNS = block("CNS-009-iii", "**CNS-009-iii Plain words**");
const CLEAN_DUP = {
  start: { "INTENT.md": `${head2}${block("REQ-001-aaa", "**REQ-001-aaa Greets by name**")}\n${CNS}` },
  work: { "INTENT.md": `${head2}${block("REQ-002-bbb", "**REQ-002-bbb Work rule**")}\n${block("REQ-001-aaa", "**REQ-001-aaa Greets by name**")}\n${CNS}` },
  target: { "INTENT.md": `${head2}${block("REQ-001-aaa", "**REQ-001-aaa Greets by name**")}\n${CNS}\n${block("REQ-002-bbb", "**REQ-002-bbb Base rule**")}` },
};

describe("integrate proposes Tenet's shared files merged by ID for confirmation [GIT-09]", () => {
  it("asks with every proposed file before the editor moves, and the merge commit holds exactly those files [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p, {
      start: { [D3]: decision("DEC-003-ddd", "Format") },
      work: { ...DEFAULT.work, [D3]: decision("DEC-003-ddd", "Format: YAML") },
      target: { ...DEFAULT.target, [D3]: decision("DEC-003-ddd", "Format: JSON") },
    });
    const head = p.git("rev-parse", "HEAD"), mainTip = p.git("rev-parse", "main");
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "shared-merge-proposed");
    const q = r.questions![0]!;
    assert.equal(q.id, "shared-merge");
    assert.match(q.question, /conflicts only in Tenet's shared files/);
    assert.ok(q.options!.every((o) => !o.recommended), "a content collision drops one side's change: nothing is recommended");
    const proposal = d(r).proposal;
    assert.deepEqual(proposal.collisions.map((c: any) => [c.kind, c.id]).sort(), [["content", "DEC-003-ddd"], ["content", "REQ-001-aaa"], ["duplicate", "REQ-002-bbb"]]);
    const files = Object.fromEntries(proposal.files.map((f: any) => [f.path, f]));
    assert.deepEqual(Object.keys(files).sort(), ["INTENT.md", D3]);
    assert.match(textOf(files["INTENT.md"]), /Greets by full name/);
    assert.match(textOf(files[D3]), /YAML/);
    assert.equal(p.git("branch", "--show-current"), work, "the editor never left the work branch");
    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.equal(p.git("rev-parse", "main"), mainTip, "nothing is written before the answer");

    const ok = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.equal(d(ok).mode, "merge");
    assert.equal(p.git("branch", "--show-current"), "main");
    assert.deepEqual(p.git("show", "-s", "--format=%P", "HEAD").split(" "), [mainTip, head], "an ordinary merge commit");
    assert.equal(p.git("show", "HEAD:INTENT.md"), textOf(files["INTENT.md"]).trimEnd(), "the merge holds exactly the confirmed text");
    assert.equal(p.git("show", `HEAD:${D3}`), textOf(files[D3]).trimEnd());
    assert.equal(p.git("status", "--porcelain"), "");
  });

  it("moves nothing on cancel, and asks again instead of applying an old answer when a tip moved [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p, DEFAULT);
    const first = await p.call("integrate", { h });
    assert.equal(first.questions![0]!.id, "shared-merge");
    const no = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "cancel" } });
    assert.equal(no.exit, 0, JSON.stringify(no));
    assert.equal(p.git("branch", "--show-current"), work);

    const ask = await p.call("integrate", { h });
    const shown = d(ask).proposal.files[0].sha256;
    p.git("switch", "-q", "main");
    p.write("INTENT.md", intent(block("REQ-001-aaa", "**REQ-001-aaa Greets politely**"), block("REQ-002-bbb", "**REQ-002-bbb Base rule, revised**")));
    p.git("add", "-A"); p.git("commit", "-qm", "main moves again");
    const mainTip = p.git("rev-parse", "main");
    p.git("switch", "-q", work);
    const stale = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(stale.exit, 3, JSON.stringify(stale));
    assert.equal(stale.reasons[0]!.code, "shared-merge-proposed");
    assert.notEqual(d(stale).proposal.files[0].sha256, shown, "a fresh proposal from the current tips");
    assert.equal(p.git("rev-parse", "main"), mainTip, "the old answer applied nothing");
    assert.equal(p.git("branch", "--show-current"), work);
  });

  it("lets the user keep the target branch's text for a content collision, shown before it is applied [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p, DEFAULT);
    await p.call("integrate", { h });
    const bad = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "revise", "REQ-002-bbb": "target" } });
    assert.equal(bad.exit, 1, "a duplicate is not a content collision: no side to choose");
    const rev = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "revise", "REQ-001-aaa": "target" } });
    assert.equal(rev.exit, 3, JSON.stringify(rev));
    const text = textOf(d(rev).proposal.files.find((f: any) => f.path === "INTENT.md"));
    assert.match(text, /Greets politely/);
    assert.equal(p.git("branch", "--show-current"), work, "revising moves nothing");
    const ok = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply", "REQ-001-aaa": "target" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.equal(p.git("show", "HEAD:INTENT.md"), text.trimEnd());
  });

  it("asks when Git merges cleanly but both branches created one ID, and renames its tags only in work-only files [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h } = await diverged(p, {
      start: CLEAN_DUP.start,
      work: { ...CLEAN_DUP.work, "src/work-only.test.ts": "// @tenet EX-002-bbb.1\n" },
      target: { ...CLEAN_DUP.target, "src/base-only.test.ts": "// @tenet EX-002-bbb.1\n" },
    });
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.match(r.questions![0]!.question, /merges cleanly in Git, but REQ-002-bbb was created on both branches/);
    const { files, collisions } = d(r).proposal;
    assert.deepEqual(collisions.map((c: any) => [c.kind, c.id]), [["duplicate", "REQ-002-bbb"]]);
    const to = collisions[0].renamedTo, core = to.slice(4);
    assert.deepEqual(files.map((f: any) => f.path).sort(), ["INTENT.md", "src/work-only.test.ts"]);
    const ok = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.equal(p.git("show", "HEAD:src/work-only.test.ts"), `// @tenet EX-${core}.1`);
    assert.equal(p.git("show", "HEAD:src/base-only.test.ts"), "// @tenet EX-002-bbb.1", "the target branch's tag keeps its ID");
    const merged = p.git("show", "HEAD:INTENT.md");
    assert.equal(merged.split("tenet:begin REQ-002-bbb ").length, 2, "one block keeps the ID");
    assert.equal(merged.split(`tenet:begin ${to} `).length, 2, "the work branch's block has the new one");
  });

  it("refuses when the ID both created is mentioned in a file both branches changed [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const notes = Array.from({ length: 10 }, (_, i) => `line ${i}`);
    const { h, work } = await diverged(p, {
      start: { ...CLEAN_DUP.start, "docs/notes.md": `${notes.join("\n")}\n` },
      work: { ...CLEAN_DUP.work, "docs/notes.md": `${["see REQ-002-bbb", ...notes.slice(1)].join("\n")}\n` },
      target: { ...CLEAN_DUP.target, "docs/notes.md": `${[...notes.slice(0, 9), "last"].join("\n")}\n` },
    });
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "integration-conflict");
    assert.match(r.reasons[0]!.message, /docs\/notes\.md/);
    assert.equal(p.git("branch", "--show-current"), work);
  });

  it("refuses when the ID both created is mentioned in a locked acceptance test [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p, {
      start: CLEAN_DUP.start,
      work: { ...CLEAN_DUP.work, "src/greet.test.ts": `${GREET_TEST}// @tenet EX-002-bbb.1\n` },
      target: CLEAN_DUP.target,
    });
    assert.ok(p.ports().store.read()!.state.locks.some((l) => l.path === "src/greet.test.ts"), "the test is locked");
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "integration-conflict");
    assert.match(r.reasons[0]!.message, /src\/greet\.test\.ts is a locked acceptance test that mentions REQ-002-bbb/);
    assert.equal(p.git("branch", "--show-current"), work);
  });

  it("renames the work branch's decision file when both branches created one ID in different files [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const mine = "docs/decisions/0007-DEC-007-abc-disk.md", theirs = "docs/decisions/0007-DEC-007-abc-memory.md";
    const { h } = await diverged(p, { work: { [mine]: decision("DEC-007-abc", "Disk") }, target: { [theirs]: decision("DEC-007-abc", "Memory") } });
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    const { files, collisions } = d(r).proposal;
    const to = collisions[0].renamedTo, moved = mine.replace("DEC-007-abc", to);
    assert.deepEqual(files.map((f: any) => [f.path, !!f.delete, f.renamedFrom ?? null]).sort(), [[mine, true, null], [moved, false, mine]].sort());
    const ok = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.ok(has(p, "HEAD", theirs) && has(p, "HEAD", moved) && !has(p, "HEAD", mine));
    assert.match(p.git("show", `HEAD:${moved}`), new RegExp(`^---\\nid: ${to}\\n`));
  });

  it("integrates without a question when Git merges cleanly and no ID collides [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h } = await diverged(p, {
      start: CLEAN_DUP.start,
      work: { "INTENT.md": `${head2}${block("CNS-010-jjj", "**CNS-010-jjj Work rule**")}\n${CLEAN_DUP.start["INTENT.md"].slice(head2.length)}` },
      target: { "INTENT.md": `${CLEAN_DUP.start["INTENT.md"]}\n${block("REQ-011-kkk", "**REQ-011-kkk Base rule**")}` },
    });
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(d(r).mode, "merge");
  });

  it("keeps Git's own conflict for another file, docs/architecture.md prose, or a proposed file with uncommitted edits [GIT-09]", POSIX, async () => {
    for (const [extra, dirty, pattern] of [
      [{ work: { "src/greet.ts": "export const greet = (_n: string): string => 'work';\n" }, target: { "src/greet.ts": "export const greet = (_n: string): string => 'main';\n" } }, false, /src\/greet\.ts/],
      [{ start: { "docs/architecture.md": "A\n" }, work: { "docs/architecture.md": "B\n" }, target: { "docs/architecture.md": "C\n" } }, false, /docs\/architecture\.md/],
      [{}, true, /uncommitted edits/],
    ] as const) {
      const p = project(); roots.push(p.root);
      const x = extra as { start?: Files; work?: Files; target?: Files };
      const { h, work } = await diverged(p, { start: x.start ?? {}, work: { ...DEFAULT.work, ...x.work }, target: { ...DEFAULT.target, ...x.target } });
      if (dirty) p.write("INTENT.md", `${DEFAULT.work["INTENT.md"]}\nmy own note\n`);
      const r = await p.call("integrate", { h });
      assert.equal(r.exit, 3, JSON.stringify(r));
      assert.equal(r.reasons[0]!.code, "integration-conflict");
      assert.match(r.reasons[0]!.message, pattern);
      assert.equal(p.git("branch", "--show-current"), work);
    }
  });

  it("commits nothing when Git would change a confirmed file while staging it [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const path = "docs/decisions/0007-DEC-007-abc-cache.md";
    const { h } = await diverged(p, {
      work: { [path]: decision("DEC-007-abc", "Disk").replace(/\n/g, "\r\n") },
      target: { [path]: decision("DEC-007-abc", "Memory"), ".gitattributes": "*.md text\n" },
    });
    const mainTip = p.git("rev-parse", "main");
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    const ok = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(ok.exit, 2, JSON.stringify(ok));
    assert.equal(p.git("rev-parse", "main"), mainTip, "no merge commit");
    assert.equal(existsSync(join(p.root, ".git", "MERGE_HEAD")), false, "the merge was aborted");
  });

  for (const point of ["after-merge", "before-commit"]) {
    it(`reports an apply killed ${point} as uncertain, never as not having happened [GIT-09]`, POSIX, async () => {
      const p = project(); roots.push(p.root);
      const { h } = await diverged(p, DEFAULT);
      const mainTip = p.git("rev-parse", "main");
      await p.call("integrate", { h });
      const input = { h, kind: "shared-merge", answers: { "shared-merge": "apply" } };
      const child = spawn(process.execPath, [join(import.meta.dirname, "fixtures/crash-shared-merge.ts"), p.root, JSON.stringify(input), point], { stdio: "ignore" });
      assert.equal(await new Promise((res) => child.on("exit", (_c, s) => res(s))), "SIGKILL");
      assert.equal(p.git("rev-parse", "main"), mainTip);
      const r = await p.call("integrate", { h });
      assert.ok(r.effects?.uncertain.some((e) => /still merging/.test(e)), JSON.stringify(r));
      assert.ok(!r.effects?.completed.some((e) => /did not happen/.test(e)), JSON.stringify(r.effects));
    });
  }
});
