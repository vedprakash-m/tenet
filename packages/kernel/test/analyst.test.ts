// Analyst packets: read-only researcher/architect/security assignments (AGT-03, AGT-05, AGT-11, TS §5.4-5.5).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";

const roots: string[] = [];
const fresh = () => { const p = project(); roots.push(p.root); return p; };
after(() => roots.forEach(cleanup));

const d = (r: { data?: unknown }) => r.data as Record<string, any>;

const analystResult = (t: Record<string, any>, over: Record<string, unknown> = {}) => ({
  kind: "analyst", manifest: t.manifest, reservation: t.reservation, attempt: t.attempt, role: t.role,
  status: "completed", dispatchMode: t.dispatchMode, revision: t.revision,
  artifacts: ["src/greet.ts:1"], findings: [{ location: { path: "src/greet.ts", line: 1 }, claim: "no issue found", evidence: "src/greet.ts:1" }],
  openDependencies: [], ...over,
});
const templateOf = (path: string) => JSON.parse(readFileSync(path, "utf8")).resultTemplate;

describe("packet analyst [AGT-03]", () => {
  it("dispatches a researcher without a basis, and findings records the result", async () => {
    const p = fresh();
    const o = await p.call("open", { profile: "investigate", request: "how are greetings tested?" });
    const h = o.handle!;
    const r = await p.call("packet", { h, role: "analyst", analystRole: "researcher", question: "How is greet() tested today?" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(d(r).analyst.role, "researcher");
    assert.ok(r.next.some((n) => n.action === "analyst" && n.required));
    const manifest = JSON.parse(readFileSync(d(r).analyst.manifest, "utf8"));
    assert.equal(manifest.question, "How is greet() tested today?");
    assert.match(manifest.rubric, /evidence from the repository/);
    assert.equal(manifest.resultTemplate.kind, "analyst");

    const f = await p.call("findings", { h, result: analystResult(templateOf(d(r).analyst.manifest)) });
    assert.equal(f.exit, 0, JSON.stringify(f));
    assert.equal(d(f).status, "completed");
    assert.equal(d(f).recorded, 1);
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.analyses.length, 1);
    assert.equal(w.analyses[0]!.role, "researcher");
    assert.equal(w.analyses[0]!.question, "How is greet() tested today?");
    assert.equal(w.budget.reservations.length, 0, "the reservation settles");
  });

  it("requires both --analyst-role and --question", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "investigate", request: "x" })).handle!;
    const r = await p.call("packet", { h, role: "analyst" });
    assert.equal(r.exit, 1, JSON.stringify(r));
  });

  it("dispatches several analysts in parallel on one declared revision (AGT-03)", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "x", lane: "standard" })).handle!;
    const r1 = await p.call("packet", { h, role: "analyst", analystRole: "researcher", question: "Where is greet used?" });
    const r2 = await p.call("packet", { h, role: "analyst", analystRole: "security", question: "Any injection risk in greet?" });
    assert.equal(r1.exit, 0, JSON.stringify(r1));
    assert.equal(r2.exit, 0, JSON.stringify(r2));
    assert.notEqual(d(r1).analyst.reservation, d(r2).analyst.reservation);
    const t1 = templateOf(d(r1).analyst.manifest), t2 = templateOf(d(r2).analyst.manifest);
    assert.equal(t1.revision, t2.revision, "both observe the same declared revision");
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.budget.reservations.length, 2, "both dispatches are live at once");

    await p.call("findings", { h, result: analystResult(t1) });
    await p.call("findings", { h, result: analystResult(t2) });
    const after2 = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(after2.analyses.length, 2);
    assert.deepEqual(new Set(after2.analyses.map((a) => a.role)), new Set(["researcher", "security"]));
  });

  it("loads the architect and security role rubrics from their resource files", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "x", lane: "standard" })).handle!;
    const arch = await p.call("packet", { h, role: "analyst", analystRole: "architect", question: "How should this be structured?" });
    const sec = await p.call("packet", { h, role: "analyst", analystRole: "security", question: "Any exposure here?" });
    const archManifest = JSON.parse(readFileSync(d(arch).analyst.manifest, "utf8"));
    const secManifest = JSON.parse(readFileSync(d(sec).analyst.manifest, "utf8"));
    assert.match(archManifest.rubric, /decision record/);
    assert.ok("sketch" in archManifest.resultTemplate);
    assert.match(secManifest.rubric, /threat note/);
    assert.ok(!("sketch" in secManifest.resultTemplate));
  });

  it("does not let partial output count as a completed answer [AGT-05]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "investigate", request: "x" })).handle!;
    const r = await p.call("packet", { h, role: "analyst", analystRole: "researcher", question: "q" });
    const f = await p.call("findings", { h, result: analystResult(templateOf(d(r).analyst.manifest), { status: "partial" }) });
    assert.equal(d(f).status, "partial");
    assert.ok(f.next.some((n) => n.action === "analyst" && n.required), "a partial result is not treated as finished");
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.analyses[0]!.status, "partial");
  });

  it("rejects a result that does not match a live reservation", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "investigate", request: "x" })).handle!;
    const r = await p.call("packet", { h, role: "analyst", analystRole: "researcher", question: "q" });
    const stale = await p.call("findings", { h, result: analystResult(templateOf(d(r).analyst.manifest), { attempt: 99 }) });
    assert.equal(stale.exit, 2, JSON.stringify(stale));
    assert.ok(stale.reasons.some((x) => x.code === "review-stale"));
  });

  it("discloses when the candidate moved after the analyst observed it [AGT-11]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "x", lane: "standard" })).handle!;
    const r = await p.call("packet", { h, role: "analyst", analystRole: "researcher", question: "q" });
    p.write("src/other.ts", "export const x = 1;\n");
    const f = await p.call("findings", { h, result: analystResult(templateOf(d(r).analyst.manifest)) });
    assert.equal(f.exit, 0, JSON.stringify(f));
    assert.ok(f.reasons.some((x) => x.code === "stale" && x.note), "a note discloses the move, but does not block");
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.analyses[0]!.stale, true);
  });
});
