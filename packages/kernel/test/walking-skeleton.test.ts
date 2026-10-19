import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, project, reviewResult } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("walking skeleton: open → basis → red → green → review → checked-local", () => {
  it("runs the whole loop on a real repository, on a work branch from HEAD [GIT-02]", async () => {
    const p = project();
    roots.push(p.root);

    const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" });
    assert.equal(o.exit, 0, JSON.stringify(o));
    const h = o.handle!;
    assert.match(h, /^W1\.1\.[a-z0-9]{4}$/);
    assert.equal(o.next[0]!.action, "basis");

    const b = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(b.exit, 0, JSON.stringify(b));
    assert.equal(b.next[0]!.action, "test", "a distinguishing example needs its red first");
    assert.match(p.git("branch", "--show-current"), /^tenet\/w-0001-/);

    p.write("src/greet.test.ts", GREET_TEST);
    const red = await p.call("check", { h, stage: "baseline" });
    assert.equal(red.exit, 0, JSON.stringify(red));
    assert.equal(red.next[0]!.action, "implement", JSON.stringify(red));

    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, stage: "candidate" });
    assert.equal(green.exit, 0, JSON.stringify(green));
    assert.equal(green.next[0]!.action, "review", JSON.stringify(green));
    assert.equal(green.budget.attempts, "1/3");
    const data = green.data as Record<string, any>;

    const early = await p.call("finish", { h });
    assert.equal((early.data as any).endpoint, "implemented-unverified", "no review yet: the endpoint is honest");
    assert.ok(early.reasons.some((r) => r.code === "review-missing"));
  });

  it("reaches checked-local, committed, only after a fresh review reaches the candidate; the result leads with the outcome [RES-01, GIT-03]", async () => {
    const p = project();
    roots.push(p.root);
    const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" });
    const h = o.handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    const green = await p.call("check", { h, stage: "candidate" });
    const r = await p.call("findings", { h, result: reviewResult(green.data as Record<string, any>) });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.equal(r.next[0]!.action, "finish");

    const f = await p.call("finish", { h, subject: "Add greet" });
    const d = f.data as Record<string, any>;
    assert.equal(f.exit, 0, JSON.stringify(f));
    assert.equal(d.endpoint, "checked-local", JSON.stringify(f));
    assert.equal(d.scope, "committed");
    assert.equal(p.git("show", "--name-only", "--format=%B", "HEAD").split("\n").filter(Boolean).slice(-2).join(","), "src/greet.test.ts,src/greet.ts");
    assert.match(p.git("log", "-1", "--format=%B"), /Tenet-Work: W-0001/);
    assert.equal(p.git("status", "--porcelain"), "");
  });
});
