import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, finishFixture, focusFixture, project } from "./support/fixture.ts";

const roots: string[] = [];
const types = { id: "types", property: "the project compiles", tool: "tsc" };
after(() => roots.forEach(cleanup));

describe("required-check composition", () => {
  for (const conflict of [
    { ...types, property: "a stronger compilation contract" },
    { ...types, population: "server/**/*.ts" },
    { ...types, tool: "mypy" },
  ]) it(`blocks a hidden same-ID requirement before launch: ${JSON.stringify(conflict)} [CFG-11, EVD-01]`, async () => {
    const p = project({ "tenet.policy.json": JSON.stringify({ required_checks: [types] }) }); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "check conflict", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    await p.call("decide", { h, kind: "config", target: "required_checks", propose: { value: [conflict] } });
    p.write("src/greet.test.ts", GREET_TEST);
    const r = await p.call("check", { h, stage: "baseline" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(x => x.code === "capability-missing" && /types.*defined differently/.test(x.message)), JSON.stringify(r));
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.budget.checksLaunched, 0); assert.equal(w.receipts.length, 0); assert.equal(w.session.inCall, undefined);
    const settings = await p.call("inspect", { view: "settings", topic: "required_checks", h });
    assert.ok((settings.data as any).setting.limits.some((s: string) => /blocked.*reconcil/.test(s)));
  });

  it("caps existing green evidence while definitions conflict, and reset restores the prior verdict [EVD-01, CON-09]", async () => {
    const p = project({ "tenet.policy.json": JSON.stringify({ required_checks: [types] }), "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true, module: "NodeNext", target: "ES2023", noEmit: true, allowImportingTsExtensions: true, skipLibCheck: true, types: [] } }) }); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "conflict after green", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST); await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL); await p.call("check", { h, stage: "candidate", touched: ["src/greet.ts"] });
    await focusFixture(p, h);
    await p.call("decide", { h, kind: "config", target: "required_checks", propose: { value: [{ ...types, property: "different" }] } });
    const before = readFileSync(join(p.root, ".tenet/state"));
    const why = await p.call("inspect", { view: "why", h });
    assert.notEqual((why.data as any).endpoint, "checked-local");
    assert.ok(why.reasons.some(x => /defined differently/.test(x.message)), JSON.stringify(why));
    assert.deepEqual(readFileSync(join(p.root, ".tenet/state")), before);
    assert.equal((await p.call("decide", { h, kind: "config", target: "required_checks", propose: { reset: true } })).exit, 0);
    assert.equal(((await p.call("inspect", { view: "why", h })).data as any).endpoint, "checked-local");
    await p.call("decide", { h, kind: "config", target: "required_checks", propose: { value: [{ ...types, property: "different" }] } });
    const f = await finishFixture(p, { h, noCommit: true });
    assert.notEqual((f.data as any).endpoint, "checked-local");
  });
});
