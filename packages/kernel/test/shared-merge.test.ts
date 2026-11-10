// GIT-09: Tenet's shared INTENT.md reconciled by ID on integration. The pure merge runs everywhere; the real-Git
// integration cases change state and run only where mutating work is allowed (Linux and macOS CI).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeShared } from "../src/core/shared-merge.ts";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const block = (id: string, body: string) => `<!-- tenet:begin ${id} -->\n${body}\n<!-- tenet:end ${id} -->\n`;
const intent = (...blocks: string[]) => `# Intent\n\nOur own notes.\n\n${blocks.join("\n")}`;
const merged = (b: string | null, o: string, t: string) => {
  const m = mergeShared(b, o, t);
  assert.ok(m.ok, JSON.stringify(m));
  return m;
};

describe("shared INTENT.md merge by ID [GIT-09]", () => {
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
    assert.equal(mergeShared(base, m.text, m.text).ok, true, "the result parses again");
  });

  it("reports the same existing ID changed differently on both sides as a content collision with the three texts [GIT-09]", () => {
    const ours = intent(block("REQ-001-aaa", "**REQ-001-aaa Greets politely**"));
    const theirs = intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by full name**"));
    const m = merged(base, ours, theirs);
    assert.equal(m.collisions.length, 1);
    const c = m.collisions[0]!;
    assert.equal(c.kind, "content");
    assert.equal(c.id, "REQ-001-aaa");
    assert.match(c.base!, /Greets by name/);
    assert.match(c.ours!, /Greets politely/);
    assert.match(c.theirs!, /Greets by full name/);
    assert.match(m.text, /Greets by full name/, "the proposal takes the work being integrated");
    assert.doesNotMatch(m.text, /Greets politely/);
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

  it("treats the same ID created with the same content on both sides as one block [GIT-09]", () => {
    const both = intent(req1, block("REQ-002-bbb", "**REQ-002-bbb Same**"));
    const m = merged(base, both, both.replace(/\n/g, "\r\n"));
    assert.deepEqual(m.collisions, []);
    assert.equal(m.text, both);
  });

  it("proposes nothing when both sides changed the text outside the blocks or a marker is damaged [GIT-09]", () => {
    const ours = intent(req1).replace("Our own notes.", "Base notes.");
    const theirs = intent(req1).replace("Our own notes.", "Work notes.");
    assert.equal(mergeShared(base, ours, theirs).ok, false);
    assert.equal(mergeShared(base, intent(req1), `${intent(req1)}<!-- tenet:begin REQ-009-zzz -->\n`).ok, false);
  });
});

const POSIX = { skip: process.platform === "win32" && "mutating work is refused on Windows" };
const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

/** A finished contract whose work branch and main each changed the same INTENT.md block after it was committed on main. */
async function diverged(p: Project, extra?: () => void) {
  p.write("INTENT.md", intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by name**")));
  p.git("add", "-A"); p.git("commit", "-qm", "intent");
  const o = await p.call("open", { profile: "feature", request: "greeting", scopePaths: ["src/greet.ts"], lane: "quick" });
  const h = o.handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST);
  await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
  const f = await finishFixture(p, { h, subject: "Add greet" });
  assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
  const work = p.git("branch", "--show-current");
  p.write("INTENT.md", intent(block("REQ-001-aaa", "**REQ-001-aaa Greets by full name**"), block("REQ-002-bbb", "**REQ-002-bbb Work rule**")));
  p.git("add", "-A"); p.git("commit", "-qm", "work edits intent");
  p.git("switch", "-q", "main");
  p.write("INTENT.md", intent(block("REQ-001-aaa", "**REQ-001-aaa Greets politely**"), block("REQ-002-bbb", "**REQ-002-bbb Base rule**")));
  extra?.();
  p.git("add", "-A"); p.git("commit", "-qm", "main edits intent");
  p.git("switch", "-q", work);
  return { h, work };
}

describe("integrate proposes a merged INTENT.md for confirmation [GIT-09]", () => {
  it("asks with the proposal and collisions before the editor moves, and applies exactly that text on confirmation [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p);
    const head = p.git("rev-parse", "HEAD"), mainTip = p.git("rev-parse", "main");
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "shared-merge-proposed");
    assert.equal(r.questions![0]!.id, "shared-merge");
    const proposal = d(r).proposal;
    assert.equal(proposal.path, "INTENT.md");
    assert.deepEqual(proposal.collisions.map((c: any) => [c.kind, c.id]), [["content", "REQ-001-aaa"], ["duplicate", "REQ-002-bbb"]]);
    assert.match(proposal.text, /Greets by full name/);
    assert.equal(p.git("branch", "--show-current"), work, "the editor never left the work branch");
    assert.equal(p.git("rev-parse", "HEAD"), head);
    assert.equal(p.git("rev-parse", "main"), mainTip, "nothing is written before the answer");

    const ok = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    assert.equal(d(ok).mode, "merge");
    assert.equal(p.git("branch", "--show-current"), "main");
    assert.deepEqual(p.git("show", "-s", "--format=%P", "HEAD").split(" "), [mainTip, head], "an ordinary merge commit");
    assert.equal(p.git("show", "HEAD:INTENT.md"), proposal.text.trimEnd(), "the merge holds exactly the confirmed text");
    assert.equal(p.git("status", "--porcelain"), "");
  });

  it("moves nothing on cancel, and asks again instead of applying an old answer when a tip moved [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p);
    const first = await p.call("integrate", { h });
    assert.equal(first.questions![0]!.id, "shared-merge");
    const no = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "cancel" } });
    assert.equal(no.exit, 0, JSON.stringify(no));
    assert.equal(p.git("branch", "--show-current"), work);

    const ask = await p.call("integrate", { h });
    const shown = d(ask).proposal.text;
    p.git("switch", "-q", "main");
    p.write("INTENT.md", intent(block("REQ-001-aaa", "**REQ-001-aaa Greets politely**"), block("REQ-002-bbb", "**REQ-002-bbb Base rule, revised**")));
    p.git("add", "-A"); p.git("commit", "-qm", "main moves again");
    const mainTip = p.git("rev-parse", "main");
    p.git("switch", "-q", work);
    const stale = await p.call("decide", { h, kind: "shared-merge", answers: { "shared-merge": "apply" } });
    assert.equal(stale.exit, 3, JSON.stringify(stale));
    assert.equal(stale.reasons[0]!.code, "shared-merge-proposed");
    assert.notEqual(d(stale).proposal.text, shown, "a fresh proposal from the current tips");
    assert.equal(p.git("rev-parse", "main"), mainTip, "the old answer applied nothing");
    assert.equal(p.git("branch", "--show-current"), work);
  });

  it("keeps Git's own conflict when another file also conflicts [GIT-09]", POSIX, async () => {
    const p = project(); roots.push(p.root);
    const { h, work } = await diverged(p, () => p.write("src/greet.ts", "export const greet = (_n: string): string => 'main';\n"));
    const r = await p.call("integrate", { h });
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.equal(r.reasons[0]!.code, "integration-conflict");
    assert.match(r.reasons[0]!.message, /INTENT\.md/);
    assert.equal(p.git("branch", "--show-current"), work);
  });
});
