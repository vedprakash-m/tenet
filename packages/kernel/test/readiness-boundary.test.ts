import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_TEST, project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("execution readiness at the check boundary", () => {
  for (const version of ["99.0.0", null]) it(`refuses ${version ?? "a missing runner"} after open without spawning [EVD-03]`, async () => {
    const p = project(); roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "runner changed", lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    rmSync(join(p.root, "node_modules"));
    p.write("node_modules/vitest/vitest.mjs", "require('fs').writeFileSync('unexpected-spawn', 'bad');\n");
    if (version) p.write("node_modules/vitest/package.json", JSON.stringify({ version }));
    const r = await p.call("check", { h, stage: "baseline" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === (version ? "adapter-unsupported-version" : "capability-missing")));
    assert.equal(existsSync(join(p.root, "unexpected-spawn")), false);
    const w = Object.values(p.ports().store.read()!.state.work)[0]!;
    assert.equal(w.session.inCall, undefined);
    assert.equal(w.budget.checksLaunched, 0);
  });

  for (const path of ["package.json", "node_modules/vitest/package.json"]) it(`respects no-read for stack metadata ${path} [SEC-14]`, async () => {
    const p = project(); roots.push(p.root);
    p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: path, kinds: ["no-read"] }] }));
    const r = await p.call("open", { profile: "feature", request: "excluded metadata", lane: "quick" });
    assert.equal(r.exit, 2, JSON.stringify(r));
    assert.ok(r.reasons.some(r => r.code === "capability-missing" && /policy|excluded/.test(r.message)));
  });
});
