// A user may decline a mandatory step. Tenet goes on only to an endpoint whose label shows what is missing, says so, and never
// lowers the floor silently (WRK-13, PRD 4.5.2: "The user declined a mandatory step").
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const open = async (p: Project) => {
  const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  return h;
};

describe("declining a step [WRK-13]", () => {
  it("records only the user's own words about a step Tenet knows", async () => {
    const p = fresh();
    const h = await open(p);
    const none = await p.call("decide", { h, kind: "decline", target: "tests" });
    assert.equal(none.exit, 2);
    assert.equal(none.reasons[0]!.code, "authority-needed");
    const odd = await p.call("decide", { h, kind: "decline", target: "everything", quote: "skip it all" });
    assert.equal(odd.exit, 1);
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.declined.length, 0, "nothing was recorded");
  });

  it("lets a user who declined the tests finish with an honest weaker result instead of being told to continue", async () => {
    const p = fresh();
    const h = await open(p);
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] }); // declares the edit; the tests it asks for do not exist
    const before = await p.call("finish", { h, noCommit: true });
    assert.equal(before.exit, 2);
    assert.ok(before.reasons.some((r) => r.code === "continue-required"));

    const q = await p.call("decide", { h, kind: "decline", target: "tests", quote: "skip the tests" });
    assert.equal(q.exit, 0, JSON.stringify(q));
    assert.equal((await p.call("decide", { h, kind: "decline", target: "tests", quote: "skip the tests" })).exit, 0);
    assert.deepEqual(Object.values(p.ports().store.read()!.state.work)[0]!.declined, ["tests"], "declining twice records it once");

    const f = await finishFixture(p, { h, noCommit: true });
    assert.equal(f.exit, 0, JSON.stringify(f));
    assert.equal(d(f).endpoint, "implemented-unverified");
    assert.equal(d(f).label, "Built, not fully checked");
    assert.equal(d(f).stopReason, "declined");
    assert.ok(f.reasons.some((r) => r.code === "declined-step" && /tests/.test(r.message)), JSON.stringify(f.reasons));
  });

  it("keeps a declined review visible and never reaches checked-local without it", async () => {
    const p = fresh();
    const h = await open(p);
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    await p.call("decide", { h, kind: "decline", target: "review", quote: "no review please" });
    const head = p.git("rev-parse", "HEAD");
    const f = await p.call("finish", { h });
    assert.equal(d(f).endpoint, "implemented-unverified", JSON.stringify(f));
    assert.ok(f.reasons.some((r) => r.code === "declined-step" && /review/.test(r.message)));
    assert.ok(f.reasons.some((r) => r.code === "review-missing"));
    assert.equal(p.git("rev-parse", "HEAD"), head, "an unchecked candidate is not committed on finish");
  });
});
