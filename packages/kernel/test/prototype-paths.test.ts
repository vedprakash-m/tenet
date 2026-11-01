// Repository filenames are data, including names also present on Object.prototype.
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, project } from "./support/fixture.ts";
import { gather, unauthorizedEdits, verdictInput } from "../src/verbs/facts.ts";
import { PUBLISH } from "../src/verbs/recover-effects.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = () => { const p = project(); roots.push(p.root); return p; };

describe("filename membership in private records", () => {
  for (const path of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
    it(`keeps an undeclared ${path} file unexplained [GIT-08, AC-25]`, async () => {
      const p = fresh(); await p.call("open", { profile: "feature", request: "greeting", lane: "quick" });
      p.write(path, "human-owned bytes\n");
      const ports = p.ports(), state = ports.store.read()!.state, w = Object.values(state.work)[0]!;
      const facts = await gather(ports, w);
      assert.ok(facts.att.unexplained.includes(path), JSON.stringify(facts.att));
      assert.ok(!facts.tenetPaths.includes(path));
      assert.ok(!facts.reviewPaths.includes(path));
      assert.equal(p.git("ls-files", "--", path), "");
    });

    it(`does not exempt a declared protected ${path} edit as recipe content [WRK-03, AC-25]`, async () => {
      const p = fresh(); await p.call("open", { profile: "feature", request: "greeting", lane: "quick", protectedPaths: [path] });
      p.write(path, "declared change\n");
      const ports = p.ports(), state = ports.store.read()!.state, w = { ...Object.values(state.work)[0]!, touched: [{ path }] };
      const facts = await gather(ports, w);
      assert.deepEqual(unauthorizedEdits(ports, w, facts), [path]);
      assert.equal(verdictInput(ports, state, w, facts).behavioralChange, true, "an inherited value is not vetted source");
    });
  }

  it("never commits a human's constructor file and continues safely after explicit not-mine attribution [AC-25]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "greeting", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL); p.write("constructor", "human-owned bytes\n");
    await p.call("check", { h, touched: ["src/greet.ts"] });
    const refused = await finishFixture(p, { h, subject: "Greeting" });
    assert.equal(p.git("ls-files", "--", "constructor"), "", "no unowned file may enter the commit");
    assert.ok(refused.questions?.some(q => q.id === "unexplained"), JSON.stringify(refused));
    const answer = await p.call("decide", { h, kind: "unexplained", answers: { unexplained: "not-mine" } });
    assert.equal(answer.exit, 0, JSON.stringify(answer));
    await p.call("check", { h, touched: ["src/greet.ts"] });
    const finished = await finishFixture(p, { h, subject: "Greeting" });
    assert.equal((finished.data as { endpoint?: string })?.endpoint, "checked-local", JSON.stringify(finished));
    assert.equal(p.git("ls-files", "--", "constructor"), "");
    assert.equal(readFileSync(join(p.root, "constructor"), "utf8"), "human-owned bytes\n");
  });

  it("replays a scaffold whose expected filename is constructor instead of mistaking it for an existing vetted entry [CON-03]", async () => {
    const p = fresh(); await p.call("open", { profile: "feature", request: "scaffold recovery" });
    const ports = p.ports();
    await ports.store.transaction("fixture", async tx => {
      const w = Object.values(tx.state!.work)[0]!;
      const recovery = { ports, tx, state: tx.state!, completed: [] as string[], uncertain: [] as string[] };
      PUBLISH.scaffold!(recovery, { work: w.id, expected: { constructor: "a".repeat(64) }, protect: [], recipe: { id: "fixture", version: "1.0.0", checks: [] } }, { completed: true });
      assert.equal(Object.hasOwn(recovery.state.work[w.id]!.vetted, "constructor"), true);
      assert.equal(recovery.state.work[w.id]!.vetted.constructor, "a".repeat(64));
      assert.equal(recovery.completed.length, 1);
    });
  });

  it("does not revise unrelated assertion locks when a disposition target names an inherited support key [TDD-04]", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "greeting", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, touched: ["src/greet.ts"] });
    p.write("constructor", "unrelated human data\n");
    const before = p.ports().store.read()!.state;
    assert.ok(before.locks.length > 0);
    const result = await p.call("decide", { h, kind: "disposition", target: "constructor", propose: { reason: "This is unrelated to the acceptance test." } });
    assert.equal(result.exit, 1, JSON.stringify(result));
    assert.ok(result.reasons.some(r => r.code === "revision-conflict" && /nothing called constructor/.test(r.message)), JSON.stringify(result));
    assert.deepEqual(p.ports().store.read()!.state.locks, before.locks);
  });
});
