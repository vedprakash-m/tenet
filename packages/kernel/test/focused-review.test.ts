import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
async function checked() {
  const p = project(); roots.push(p.root);
  const h = (await p.call("open", { profile: "bug", request: "small greeting fix", lane: "quick" })).handle!;
  await p.call("decide", { h, kind: "basis", propose: BASIS });
  p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
  p.write("src/greet.ts", GREET_IMPL);
  const green = await p.call("check", { h, touched: ["src/greet.ts"] });
  return { p, h, green };
}

describe("Quick focused review [AGT-09, REV-01]", () => {
  it("rejects a focused binding misreported as a fresh child", async () => {
    const { p, h, green } = await checked();
    const r = await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>, { dispatchMode: "subagent-fresh" }) });
    assert.equal(r.exit, 2);
    assert.ok(r.reasons.some(r => r.code === "review-result-invalid"));
  });
  it("cannot accept its own suppression marker", async () => {
    const { p, h } = await checked();
    p.write("src/greet.ts", `${GREET_IMPL}// @ts-ignore\nexport const legacy: number = "x";\n`);
    const green = await p.call("check", { h, touched: ["src/greet.ts"] });
    const items = Object.values(p.ports().store.read()!.state.work)[0]!.attention;
    assert.ok(items.some(a => a.marker));
    await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>, { dispatchMode: "same-session", attention: items.map(a => ({ id: a.id, disposition: "accepted", reason: "legacy shortcut" })) }) });
    const f = await p.call("finish", { h, noCommit: true });
    assert.notEqual((f.data as { endpoint: string }).endpoint, "checked-local");
    assert.ok(f.reasons.some(r => r.code === "marker-unaccepted"));
  });
  it("requires the focused pass before checked-local", async () => {
    const { p, h, green } = await checked();
    assert.equal(green.next[0]?.action, "focused-review");
    const f = await p.call("finish", { h, noCommit: true });
    assert.notEqual((f.data as { endpoint: string }).endpoint, "checked-local");
    assert.ok(f.reasons.some(r => r.code === "review-missing"));
  });
  it("records a same-session pass without a native delegation and discloses reduced independence", async () => {
    const { p, h, green } = await checked();
    const r = await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>, { dispatchMode: "same-session" }) });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.budget.delegations, 0);
    assert.equal(w.budget.reservations.length, 0);
    assert.equal(w.budget.reviewRounds, 1);
    const f = await p.call("finish", { h, noCommit: true });
    assert.equal((f.data as { endpoint: string }).endpoint, "checked-local", JSON.stringify(f));
    assert.ok(f.reasons.some(r => r.code === "reduced-independence" && r.note));
  });
});
