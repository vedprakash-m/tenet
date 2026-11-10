// Rebuilding from the repository after `.tenet/` is lost (CON-07): only what INTENT.md and Git still show comes back,
// behind one question; no receipt, grant, consent, trust entry or lock is ever created from it.
import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { GitCli } from "../src/adapters/git-cli.ts";
import { projectIntent } from "../src/core/intent-md.ts";
import { recoverIntent } from "../src/core/reconstruct.ts";
import type { BasisElement, State } from "../src/core/schemas.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const posixOnly = { skip: process.platform === "win32" && "mutating work is refused on Windows" };

const INTENT: State["project"]["intent"] = {
  revision: 3,
  overview: { purpose: "Lend books", users: "Librarians", preferences: ["plain words"], nonGoals: ["payments"] },
  elements: [
    { id: "REQ-001-abc", origin: "request", kind: "requirement", text: "a loan is due in 14 days",
      verifiedBy: [{ method: "obligation", ref: "o1" }] },
    { id: "EX-001-abc.1", origin: "request", kind: "example", of: "REQ-001-abc", text: "borrowed 1 May, due 15 May", testFile: "t.ts",
      verifiedBy: [] },
    { id: "INV-002-def", origin: "tenet", kind: "invariant", of: "REQ-001-abc", text: "a due date is never in the past", verifiedBy: [] },
    { id: "CNS-003-ghi", origin: "request", kind: "constraint", text: "no network", expiresAt: "2027-01-01", verifiedBy: [] },
    { id: "DEC-004-jkl", origin: "request", kind: "decision", text: "Store loans: in SQLite", verifiedBy: { notApplicable: "a decision" } },
  ],
  plan: [
    { id: "PLN-005-mno", outcome: "Loans", elementIds: ["REQ-001-abc"], dependsOn: [], check: "npm test", state: "done", work: "wk_x" },
    { id: "PLN-006-pqr", outcome: "Returns", elementIds: [], dependsOn: ["PLN-005-mno"], check: "", state: "accepted" },
  ],
  records: [{
    id: "DEC-004-jkl", title: "Store loans", status: "accepted", date: "2026-10-01T10:00:00.000Z", context: "one machine",
    decision: "in SQLite", consequences: "a file to back up", alternatives: [{ option: "Postgres", why: "a server to run" }],
    links: ["REQ-001-abc"], quote: "use sqlite",
  }],
};
const rendered = (): string => {
  const p = projectIntent("# Library\n\nOur own words stay ours.\n", INTENT, {});
  assert.ok(p.ok);
  return p.text;
};

describe("reading intent back from INTENT.md [CON-07]", () => {
  it("recovers every block Tenet wrote, with no verification, plan links or plan states it cannot prove [CON-07]", () => {
    const r = recoverIntent(rendered());
    assert.ok(r.ok);
    assert.deepEqual(r.skipped, []);
    assert.deepEqual(r.intent.overview, INTENT.overview);
    assert.deepEqual(r.ids, [...INTENT.elements.map((e) => e.id), ...INTENT.plan.map((p) => p.id)]);
    for (const e of INTENT.elements) {
      const got: BasisElement = r.intent.elements.find((x) => x.id === e.id)!;
      assert.equal(got.text, e.text, e.id); assert.equal(got.kind, e.kind, e.id); assert.equal(got.of, e.of, e.id);
      assert.equal(got.expiresAt, e.expiresAt, e.id);
      assert.equal(got.origin, "tenet", "provenance is Tenet's reading, not the user's request");
      assert.equal(got.testFile, undefined, "a test file is not in the rendering and is not guessed");
      if (e.kind !== "decision") assert.deepEqual(got.verifiedBy, [], "no verification is carried over");
    }
    assert.deepEqual(r.intent.plan.map((p) => [p.id, p.state, p.elementIds, p.work]), [
      ["PLN-005-mno", "proposed", [], undefined], ["PLN-006-pqr", "proposed", [], undefined],
    ]);
    assert.deepEqual(r.intent.plan[1]!.dependsOn, ["PLN-005-mno"]);
    const rec = r.intent.records[0]!;
    assert.deepEqual({ ...rec, date: rec.date }, { ...INTENT.records[0]!, date: "2026-10-01", quote: "" });
  });

  it("lists a hand-edited block as not recovered and recovers nothing from damaged markers [CON-07]", () => {
    const edited = rendered().replace("**REQ-001-abc a loan is due in 14 days**", "REQ-001-abc: loans are due in 30 days, said Ana");
    const r = recoverIntent(edited);
    assert.ok(r.ok);
    assert.deepEqual(r.skipped, ["REQ-001-abc"]);
    assert.equal(r.intent.elements.some((e) => e.id === "REQ-001-abc" || e.id === "EX-001-abc.1"), false);
    assert.ok(r.intent.elements.some((e) => e.id === "CNS-003-ghi"));
    const broken = recoverIntent(`${rendered()}<!-- tenet:begin REQ-009-zzz -->\nno end\n`);
    assert.equal(broken.ok, false);
  });
});

describe("Tenet's marks in Git history [CON-07]", () => {
  it("counts commits per work label on all refs, ignores forged huge labels, and lists unmerged work branches [CON-07]", async () => {
    const root = tmp("tenet-rc7-"); roots.push(root);
    initRepo(root);
    const commit = (file: string, msg: string) => { write(root, file, file); git(root, "add", "-A"); git(root, "commit", "-qm", msg); };
    commit("a", "start");
    const main = git(root, "rev-parse", "--abbrev-ref", "HEAD");
    commit("b", "Loans\n\nTenet-Work: W-0003");
    git(root, "branch", "tenet/w-0003-loans");
    commit("c", "Forged\n\nTenet-Work: W-99999999999");
    git(root, "checkout", "-qb", "tenet/w-0007-returns");
    commit("d", "Returns\n\nTenet-Work: W-0007");
    commit("e", "Returns, more\n\nTenet-Work: W-0007");
    git(root, "checkout", "-q", main);
    const h = await new GitCli(root).tenetHistory();
    assert.deepEqual(h.labels, { "W-0003": 1, "W-0007": 2 });
    assert.deepEqual(h.unmerged, ["tenet/w-0007-returns"]);
    assert.equal(h.shallow, false);
  });
});

/** A repository that holds Tenet's marks but no `.tenet/`: as after `rm -r .tenet`, or in a fresh clone. */
function lostRecords(): Project {
  const p = project({ "INTENT.md": rendered() }); roots.push(p.root);
  p.write("docs/loans.md", "loans\n"); p.git("add", "-A"); p.git("commit", "-qm", "Loans\n\nTenet-Work: W-0007");
  return p;
}
const opened = (p: Project) =>
  p.call("open", { profile: "feature", request: "add returns", scopePaths: ["src/greet.ts"], lane: "standard" });
const stored = (p: Project) => p.ports().store.read()!.state;
const answer = (p: Project, h: string, a: "use" | "fresh") =>
  p.call("decide", { h, kind: "adopt", target: "reconstruction", answers: { "reconstruction-review": a } });

describe("open after local records are lost [CON-07]", () => {
  it("asks one question, continues work labels past history, and creates no authority or evidence [CON-07]", posixOnly, async () => {
    const p = lostRecords();
    const intentBefore = readFileSync(join(p.root, "INTENT.md"));
    const r = await opened(p);
    assert.equal(r.exit, 3, JSON.stringify(r));
    assert.deepEqual(r.questions?.map((q) => q.id), ["reconstruction-review"]);
    assert.equal(r.questions![0]!.channel, "chat");
    assert.match(r.questions![0]!.question, /2 plan items/);
    const note = r.reasons.find((x) => x.code === "reconstructed-from-repository")!;
    assert.match(note.message, /W-0007 \(1 commit\)/);
    assert.match(note.message, /not recoverable: grants, consents and approvals; check receipts/);
    const s = stored(p);
    assert.equal(Object.values(s.work)[0]!.label, "W-0008", "a new label never repeats one in history");
    assert.deepEqual([s.consents, s.trust, s.locks, s.project.intent.elements], [[], [], [], []]);
    const w = Object.values(s.work)[0]!;
    assert.deepEqual([w.grants, w.receipts, w.reviews], [[], [], []]);
    assert.equal(s.project.adoption.intent, "undecided");

    const fenced = await p.call("decide", { h: r.handle!, kind: "basis", propose: BASIS });
    assert.equal(fenced.exit, 3, "nothing builds on an empty intent while the question is open");
    assert.ok(fenced.questions?.some((q) => q.id === "reconstruction-review"));

    const used = await answer(p, r.handle!, "use");
    assert.equal(used.exit, 0, JSON.stringify(used));
    const after = stored(p);
    assert.deepEqual(after.project.intent.elements.map((e) => e.id), INTENT.elements.map((e) => e.id));
    assert.deepEqual(after.project.reconstructed?.elementIds.length, INTENT.elements.length + INTENT.plan.length);
    assert.deepEqual([after.consents, after.trust, after.locks], [[], [], []]);
    assert.equal(after.pending.some((q) => q.id === "reconstruction-review"), false);
    assert.equal(after.project.adoption.intent, "undecided", "the file must be adopted again before Tenet writes into it");
    assert.deepEqual(readFileSync(join(p.root, "INTENT.md")), intentBefore, "INTENT.md is only read");

    const again = await p.call("open", { profile: "investigate", request: "look around" });
    assert.equal(again.questions?.some((q) => q.id === "reconstruction-review") ?? false, false, "asked once");
    assert.equal(again.reasons.some((x) => x.code === "reconstructed-from-repository"), false);
  });

  it("starts fresh on request and never asks again [CON-07]", posixOnly, async () => {
    const p = lostRecords();
    const r = await opened(p);
    const fresh = await answer(p, r.handle!, "fresh");
    assert.equal(fresh.exit, 0, JSON.stringify(fresh));
    const s = stored(p);
    assert.deepEqual([s.project.intent.elements, s.project.intent.plan], [[], []]);
    assert.equal(s.pending.some((q) => q.id === "reconstruction-review"), false);
    assert.equal(s.project.reconstructed, undefined);
    assert.equal((await p.call("decide", { h: r.handle!, kind: "basis", propose: BASIS })).exit, 0, "the fence is gone");
  });

  it("asks again, recovering nothing, when INTENT.md changed after the question [CON-07]", posixOnly, async () => {
    const p = lostRecords();
    const r = await opened(p);
    p.write("INTENT.md", rendered().replace("no network", "no network at all"));
    const stale = await answer(p, r.handle!, "use");
    assert.equal(stale.exit, 3, JSON.stringify(stale));
    assert.equal(stale.questions?.[0]?.id, "reconstruction-review");
    assert.notEqual(stale.questions?.[0]?.bind.factsHash, r.questions?.[0]?.bind.factsHash);
    assert.deepEqual(stored(p).project.intent.elements, []);
  });

  it("reads back what Tenet itself wrote after `.tenet/` is deleted [CON-07]", posixOnly, async () => {
    const p = project(); roots.push(p.root);
    const h = (await opened(p)).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("decide", { h, kind: "adopt", target: "intent" });
    const done = await p.call("decide", { h, kind: "adopt", target: "intent", answers: { "adopt-confirm": "confirm" } });
    assert.equal(done.exit, 0, JSON.stringify(done));
    const original = stored(p).project.intent.elements.map((e) => [e.id, e.kind, e.text]);
    rmSync(join(p.root, ".tenet"), { recursive: true, force: true });
    const r = await opened(p);
    assert.equal(r.questions?.[0]?.id, "reconstruction-review", JSON.stringify(r));
    await answer(p, r.handle!, "use");
    assert.deepEqual(stored(p).project.intent.elements.map((e) => [e.id, e.kind, e.text]), original);
    assert.deepEqual(stored(p).trust, []);
  });

  it("changes nothing for a repository with no Tenet marks [CON-07]", posixOnly, async () => {
    const p = project(); roots.push(p.root);
    const r = await opened(p);
    assert.equal(r.reasons.some((x) => x.code === "reconstructed-from-repository"), false);
    assert.equal(Object.values(stored(p).work)[0]!.label, "W-0001");
  });
});
