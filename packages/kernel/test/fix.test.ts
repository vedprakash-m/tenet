// "Fix findings 1 and 3" implements only those findings and reuses what the review found (RES-06, TS §2.4): the named findings
// become the contract's open findings, its scope is where they are, and a change anywhere else needs a disposition.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project({ "src/other.ts": "export const other = 1;\n" }); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const FINDINGS = [
  { n: 1, severity: "major", location: { path: "src/greet.ts", line: 1 }, claim: "greet ignores its argument", evidence: "returns an empty string" },
  { n: 3, severity: "minor", location: { path: "src/other.ts" }, claim: "other is unused" },
];
const openFix = (p: Project, findings: unknown = FINDINGS) =>
  p.call("open", { profile: "fix", request: "fix findings 1 and 3", findings, lane: "quick" });

describe("fixing named findings [RES-06]", () => {
  it("needs the findings it is to fix", async () => {
    const p = fresh();
    const r = await p.call("open", { profile: "fix", request: "fix findings 1 and 3" });
    assert.equal(r.exit, 1, JSON.stringify(r));
    assert.match(r.reasons[0]!.message, /findings/);
  });

  it("makes the named findings the contract's open findings, scoped to where they are", async () => {
    const p = fresh();
    const o = await openFix(p);
    assert.equal(o.exit, 0, JSON.stringify(o));
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.deepEqual(w.findings.map((f) => [f.id, f.n, f.state, f.severity]), [["FND-1", 1, "valid", "major"], ["FND-3", 3, "valid", "minor"]]);
    assert.deepEqual(w.scope.paths, ["src/greet.ts", "src/other.ts"]);
    assert.match(w.request, /findings 1 and 3/);
  });

  it("asks for a disposition when the fix changes a file the findings do not name, and not for one they do", async () => {
    const p = fresh();
    const h = (await openFix(p)).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    p.write("src/extra.ts", "export const extra = 2;\n");
    const c = await p.call("check", { h, touched: ["src/greet.ts", "src/extra.ts"] });
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.deepEqual(w.attention.filter((a) => a.pattern === "outside the named findings").map((a) => a.path), ["src/extra.ts"], JSON.stringify(c.reasons));
    const f = await finishFixture(p, { h });
    assert.notEqual(d(f).endpoint, "checked-local");
    assert.ok(f.reasons.some((r) => r.code === "major-undisposed" && /extra\.ts/.test(r.message)), JSON.stringify(f.reasons));
  });

  it("does not finish checked while a named major finding is still open", async () => {
    const p = fresh();
    const h = (await openFix(p)).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] });
    const f = await finishFixture(p, { h });
    assert.ok(f.reasons.some((r) => r.code === "major-undisposed" && /greet ignores its argument/.test(r.message)), JSON.stringify(f.reasons));
  });
});
