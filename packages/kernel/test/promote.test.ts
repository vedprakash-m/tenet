// `open --profile promote` (WRK-07, TS §12.9): hardening an unhardened prototype. The kernel's own contribution
// is narrow — the profile is allowed to proceed, and its lane floor never drops below Standard — because
// Standard's own existing rule (fresh review only, never same-session) is already exactly WRK-07's "require a
// fresh review before checked-local." TDD-04 preservation and distinguishing-test evidence is the same general
// machinery every profile already uses; nothing new was needed there.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

describe("prototype promotion [WRK-07]", () => {
  it("proceeds (no longer refused), recommending Standard with no risk signals at all", async () => {
    const p = fresh();
    const o = await p.call("open", { profile: "promote", request: "harden the prototype's auth shortcuts" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    assert.equal(d(o).lane, "standard");
  });

  it("clamps an explicit request for Quick up to Standard, and says the floor cannot be lowered", async () => {
    const p = fresh();
    const o = await p.call("open", { profile: "promote", request: "harden the prototype", lane: "quick" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    assert.equal(d(o).lane, "standard");
    assert.ok(o.reasons.some((r) => r.code === "budget-warning" && /standard.*floor/i.test(r.message)), JSON.stringify(o.reasons));
  });

  it("never reaches checked-local from a same-session review, only a fresh one", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "promote", request: "harden the prototype's auth shortcuts" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const candidate = await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    assert.equal(candidate.exit, 0, JSON.stringify(candidate));

    const sameSession = await p.call("findings", { h, result: reviewResult(d(candidate), { dispatchMode: "same-session" }) });
    assert.equal(sameSession.exit, 0, JSON.stringify(sameSession));
    const why = await p.call("inspect", { h, view: "why" });
    assert.notEqual(d(why).endpoint, "checked-local", "a same-session review never counts for a promotion");
    assert.ok(why.reasons.some((r) => r.code === "reduced-independence" && !r.note), "reduced independence blocks here, it is not a mere note");

    const retry = await p.call("packet", { h, role: "reviewer", retry: true });
    assert.equal(retry.exit, 0, JSON.stringify(retry));
    const fresh2 = await p.call("findings", { h, result: reviewResult(d(retry)) }); // default dispatchMode: subagent-fresh
    assert.equal(fresh2.exit, 0, JSON.stringify(fresh2));
    const f = await p.call("finish", { h, subject: "Harden the prototype" });
    assert.equal(d(f).endpoint, "checked-local", JSON.stringify(f.reasons));
  });
});
