import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const p = project(); roots.push(p.root); return p; };

describe("declared ignored evidence inputs", () => {
  for (const parent of [false, true]) it(`refuses ${parent ? "parent-linked" : "linked"} support instead of locking only the link spelling [SEC-06]`, async () => {
    const p = fresh(), outside = fresh(); outside.write("helper.ts", "export const helper = 1;\n");
    const support = parent ? "helpers/helper.ts" : "src/helper.ts";
    symlinkSync(parent ? outside.root : join(outside.root, "helper.ts"), join(p.root, parent ? "helpers" : "src/helper.ts"));
    const h = (await p.call("open", { profile: "feature", request: "linked support", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: { ...BASIS, elements: BASIS.elements.map(e => e.kind === "example" ? { ...e, support: [support] } : e) } });
    p.write("src/greet.test.ts", GREET_TEST);
    const r = await p.call("check", { h, stage: "baseline" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === "capability-missing"));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.budget.checksLaunched, 0);
  });
  it("runs a declared ignored acceptance file and invalidates its receipt when it changes [EVD-03]", async () => {
    const p = fresh();
    p.write(".gitignore", "node_modules\nsrc/greet.test.ts\n");
    const h = (await p.call("open", { profile: "feature", request: "ignored test", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    const red = await p.call("check", { h, stage: "baseline" });
    assert.equal(red.exit, 0, JSON.stringify(red));
    let w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.obligations[0]!.baselineMatched, true);
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] });
    p.write("src/greet.test.ts", GREET_TEST.replace('toBe("Hello, Ada!")', 'toBeTruthy()'));
    const why = await p.call("inspect", { h, view: "why" });
    assert.ok(why.reasons.some(r => r.code === "test-lock-changed" || r.code === "red-invalidated"), JSON.stringify(why));
    w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.ok(w.receipts.some(r => r.status === "pass"));
  });

  it("invalidates a red when an ignored runner configuration is introduced later [EVD-10]", async () => {
    const p = fresh(); p.write(".gitignore", "node_modules\nvitest.config.ts\n");
    const h = (await p.call("open", { profile: "feature", request: "configuration introduced", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    p.write("vitest.config.ts", "export default { test: {} };\n");
    const why = await p.call("inspect", { h, view: "why" });
    assert.ok(why.reasons.some(r => r.code === "red-invalidated"), JSON.stringify(why));
  });

  it("does not convert excluded support into baseline proof using stat alone [SEC-14]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "secret support", lane: "quick" })).handle!;
    const basis = { ...BASIS, elements: BASIS.elements.map(e => e.kind === "example" ? { ...e, support: [".env.test"] } : e) };
    await p.call("decide", { h, kind: "basis", propose: basis });
    p.write("src/greet.test.ts", GREET_TEST); p.write(".env.test", "secret=value\n");
    const r = await p.call("check", { h, stage: "baseline" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === "capability-missing" && /excluded/.test(r.message)));
    assert.equal(Object.values(p.ports().store.read()!.state.work)[0]!.budget.checksLaunched, 0);
  });
});
