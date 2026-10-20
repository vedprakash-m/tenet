import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
describe("active-chat takeover [CON-02, AGT-08]", () => {
  it("an unrelated contract's open question cannot bypass takeover", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const other = (await p.call("open", { profile: "plan", request: "another plan" })).handle!;
    const asked = await p.call("decide", { h: other, kind: "basis", propose: { ...BASIS, elements: [...BASIS.elements, { kind: "assumption", origin: "tenet", text: "an unconfirmed assumption" }] } });
    assert.equal(asked.exit, 3);
    const resumed = await p.call("open", { profile: "feature", request: "first", resume: true });
    assert.equal(resumed.exit, 3);
    assert.equal(resumed.questions?.[0]?.id, "takeover-check");
    assert.match(resumed.handle!, /^W1\./);
  });
  it("asks once, fences both generations until confirmation, and resumes only after the answer", async () => {
    const p = project(); roots.push(p.root);
    const old = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h: old, kind: "basis", propose: BASIS });
    const resumed = await p.call("open", { profile: "feature", request: "first", resume: true });
    assert.equal(resumed.exit, 3);
    assert.equal(resumed.questions?.[0]?.id, "takeover-check");
    assert.equal(resumed.questions?.[0]?.channel, "chat");
    const h = resumed.handle!;
    assert.notEqual(h, old);
    const twice = await p.call("open", { profile: "feature", request: "first", resume: true });
    assert.equal(twice.handle, h, "one question never allocates another generation on retry");
    const stale = await p.call("check", { h: old });
    assert.equal(stale.reasons[0]?.code, "stale-session");
    const premature = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(premature.exit, 3);
    assert.equal(premature.questions?.[0]?.id, "takeover-check");
    const wait = await p.call("decide", { h, kind: "takeover-check", answers: { "takeover-check": "wait" } });
    assert.equal(wait.exit, 3);
    assert.ok(p.ports().store.read()!.state.pending.some(q => q.id === "takeover-check"));
    const yes = await p.call("decide", { h, kind: "takeover-check", answers: { "takeover-check": "stopped" } });
    assert.equal(yes.exit, 0, JSON.stringify(yes));
    assert.ok(!p.ports().store.read()!.state.pending.some(q => q.id === "takeover-check"));
    assert.equal((await p.call("decide", { h, kind: "basis", propose: BASIS })).exit, 0);
  });
});
