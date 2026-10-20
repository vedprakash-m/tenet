import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
describe("destructive stop approval [SEC-13, CON-10]", () => {
  it("previews abandonment in advisory chat, then closes only on confirmation", async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "first", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    const preview = await p.call("stop", { h, mode: "abandon" });
    assert.equal(preview.exit, 3);
    assert.equal(preview.questions?.[0]?.id, "abandon-confirm");
    assert.equal(preview.questions?.[0]?.channel, "chat");
    assert.ok(preview.reasons.some(r => r.code === "approval-gate" && /advisory/.test(r.message)));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.state, "executing");
    assert.ok(p.ports().store.read()!.state.sourceOwner);
    const no = await p.call("decide", { h, kind: "abandon-confirm", answers: { "abandon-confirm": "cancel" } });
    assert.equal(no.exit, 0);
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.state, "executing");
    await p.call("stop", { h, mode: "abandon", again: true });
    const yes = await p.call("decide", { h, kind: "abandon-confirm", answers: { "abandon-confirm": "abandon" } });
    assert.equal(yes.exit, 0, JSON.stringify(yes));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.state, "cancelled");
    assert.equal(p.ports().store.read()!.state.sourceOwner, undefined);
  });
});
