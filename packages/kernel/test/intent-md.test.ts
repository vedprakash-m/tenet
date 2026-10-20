// Managed blocks in INTENT.md (TS §7.8): parsing, rendering and projecting without touching the user's own text.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { blockHash, parseBlocks, projectIntent, renderIntent } from "../src/core/intent-md.ts";
import type { BasisElement } from "../src/core/schemas.ts";

type Intent = Parameters<typeof renderIntent>[0];
const el = (id: string, kind: BasisElement["kind"], text: string, of?: string): BasisElement => ({ id, origin: "tenet", kind, text, ...(of ? { of } : {}), verifiedBy: [] });
const intent = (elements: BasisElement[], over: Partial<Intent> = {}): Intent => ({
  revision: 1, overview: { purpose: "Loans for a small library", users: "librarians", preferences: [], nonGoals: [] }, elements, plan: [], records: [], ...over,
});
const REQ = [el("REQ-001-aaa", "requirement", "A loan is due in 14 days"), el("EX-001-aaa.1", "example", "borrowed on 1 May is due on 15 May", "REQ-001-aaa"), el("INV-002-bbb", "invariant", "a book is never on loan twice", "REQ-001-aaa")];
const begin = (id: string) => `<!-- tenet:begin ${id} -->`;
const end = (id: string) => `<!-- tenet:end ${id} -->`;

describe("parsing managed blocks [INT-02]", () => {
  it("finds balanced blocks with their ids and line numbers, and ignores charter markers and fenced examples", () => {
    const text = ["# Intent", "", "<!-- tenet:charter:begin -->", "x", "<!-- tenet:charter:end -->", "```", begin("REQ-9-zzz"), "```", begin("REQ-001-aaa"), "body", end("REQ-001-aaa"), ""].join("\n");
    const r = parseBlocks(text);
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.blocks.map((b) => [b.id, b.line]), [["REQ-001-aaa", 9]]);
  });

  for (const [name, lines, problem, id, line] of [
    ["a duplicate id", ["a", begin("X-1"), "1", end("X-1"), begin("X-1"), "2", end("X-1")], "duplicate", "X-1", 5],
    ["nested blocks", [begin("X-1"), begin("X-2"), end("X-2"), end("X-1")], "nested", "X-2", 2],
    ["an end without a begin", ["text", end("X-1")], "unbalanced", "X-1", 2],
    ["a begin without an end", ["text", "", begin("X-1"), "body"], "unbalanced", "X-1", 3],
    ["an end that names another block", [begin("X-1"), "body", end("X-2")], "unbalanced", "X-2", 3],
    ["a marker with no id", ["<!-- tenet:begin -->", "body"], "malformed", undefined, 1],
    ["a marker that never closes its comment", ["<!-- tenet:begin X-1", "body"], "malformed", undefined, 1],
  ] as const) {
    it(`stops with intent-markers-invalid on ${name} and shows the line`, () => {
      const r = parseBlocks(lines.join("\n"));
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.problem, problem);
      assert.equal(r.id, id);
      assert.equal(r.line, line);
      assert.ok(r.region.length > 0);
    });
  }
});

describe("rendering the intent [INT-02]", () => {
  it("puts a requirement with its examples and invariants in one block, and every other kind in its own", () => {
    const out = renderIntent(intent([...REQ, el("CNS-003-ccc", "constraint", "no new dependencies"), el("ASM-004-ddd", "assumption", "names are plain strings"), el("DEF-005-eee", "deferred", "reminders by email")]));
    assert.deepEqual([...out.keys()], ["OVERVIEW", "REQ-001-aaa", "CNS-003-ccc", "ASM-004-ddd", "DEF-005-eee"]);
    const req = out.get("REQ-001-aaa")!;
    assert.match(req, /REQ-001-aaa.*14 days/);
    assert.match(req, /EX-001-aaa\.1.*15 May/);
    assert.match(req, /INV-002-bbb.*twice/);
    assert.match(out.get("OVERVIEW")!, /Loans for a small library/);
  });
  it("renders plan items and shows an expiry on a temporary assumption", () => {
    const a: BasisElement = { ...el("ASM-004-ddd", "assumption", "UTC dates"), expiresAt: "2026-12-01" };
    const out = renderIntent(intent([a], { plan: [{ id: "PLN-006-fff", outcome: "Overdue reminders", elementIds: [], dependsOn: [], check: "reminders.test", state: "proposed" }] }));
    assert.match(out.get("ASM-004-ddd")!, /2026-12-01/);
    assert.match(out.get("PLN-006-fff")!, /Overdue reminders/);
  });
});

describe("projecting into INTENT.md [INT-02, INT-13]", () => {
  const prose = "# My library\n\nWe lend books.\nKeep this exactly.\n";

  it("creates a file from nothing, and repeating the projection changes nothing", () => {
    const first = projectIntent(null, intent(REQ), {});
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.match(first.text, /tenet:begin REQ-001-aaa/);
    const again = projectIntent(first.text, intent(REQ), first.written);
    assert.equal(again.ok && again.text, first.text);
    assert.deepEqual(again.ok && again.changed, []);
  });

  it("adopts into a file with prose, leaving every byte outside the blocks as it was", () => {
    const r = projectIntent(prose, intent(REQ), {});
    assert.equal(r.ok && r.text.startsWith(prose), true, "the user's text comes first, untouched");
    assert.equal(r.ok && r.text.length > prose.length, true);
  });

  it("keeps CRLF line endings and the text around a block when a block changes", () => {
    const crlf = prose.replace(/\n/g, "\r\n");
    const first = projectIntent(crlf, intent(REQ), {});
    assert.ok(first.ok);
    if (!first.ok) return;
    assert.equal(/[^\r]\n/.test(first.text), false, "no bare LF was introduced");
    const edited = [el("REQ-001-aaa", "requirement", "A loan is due in 21 days"), REQ[1]!, REQ[2]!];
    const next = projectIntent(first.text, intent(edited), first.written);
    assert.ok(next.ok);
    if (!next.ok) return;
    assert.deepEqual(next.changed, ["REQ-001-aaa"]);
    assert.match(next.text, /21 days/);
    assert.equal(next.text.startsWith(crlf), true);
  });

  it("does not overwrite a block a person edited, and reports it for a diff", () => {
    const first = projectIntent(prose, intent(REQ), {});
    assert.ok(first.ok);
    if (!first.ok) return;
    const edited = first.text.replace("14 days", "30 days");
    const edited2 = [el("REQ-001-aaa", "requirement", "A loan is due in 21 days"), REQ[1]!, REQ[2]!];
    const next = projectIntent(edited, intent(edited2), first.written);
    assert.ok(next.ok);
    if (!next.ok) return;
    assert.deepEqual(next.external, ["REQ-001-aaa"]);
    assert.match(next.text, /30 days/, "the person's wording stays until they accept a change");
    assert.deepEqual(next.changed, []);
  });

  it("treats a block as external when nothing records what Tenet last wrote there", () => {
    const text = `${prose}\n${begin("REQ-001-aaa")}\nsomeone else's wording\n${end("REQ-001-aaa")}\n`;
    const r = projectIntent(text, intent(REQ), {});
    assert.equal(r.ok && r.external.includes("REQ-001-aaa"), true);
  });

  it("leaves a block for an element that is no longer in the intent, and says so", () => {
    const first = projectIntent(prose, intent(REQ), {});
    assert.ok(first.ok);
    if (!first.ok) return;
    const next = projectIntent(first.text, intent([]), first.written);
    assert.ok(next.ok);
    if (!next.ok) return;
    assert.deepEqual(next.stale, ["REQ-001-aaa"]);
    assert.match(next.text, /tenet:begin REQ-001-aaa/);
  });

  it("refuses a file with damaged markers and never guesses", () => {
    const r = projectIntent(`${begin("REQ-001-aaa")}\nno end\n`, intent(REQ), {});
    assert.equal(r.ok, false);
    assert.equal(!r.ok && r.problem, "unbalanced");
  });

  it("keeps every byte outside the blocks, whatever the user wrote around them [INT-13]", () => {
    const wrap = fc.array(fc.string().filter((l) => !/tenet|```|~~~|\r|\n/.test(l)), { maxLength: 6 });
    fc.assert(fc.property(wrap, wrap, fc.constantFrom("\n", "\r\n"), (before, after, eol) => {
      const first = projectIntent(before.map((l) => l + eol).join(""), intent(REQ), {});
      if (!first.ok) return false;
      const tail = after.map((l) => l + eol).join("");
      const withTail = first.text + tail;
      const edited = intent([el("REQ-001-aaa", "requirement", "A loan is due in 21 days"), REQ[1]!, REQ[2]!]);
      const next = projectIntent(withTail, edited, first.written);
      if (!next.ok) return false;
      const head = before.map((l) => l + eol).join("");
      return next.text.startsWith(head) && next.text.endsWith(tail) && next.changed.join() === "REQ-001-aaa";
    }), { numRuns: 200 });
  });

  it("hashes a block body independent of its line endings", () => {
    assert.equal(blockHash("a\r\nb"), blockHash("a\nb"));
  });
});
