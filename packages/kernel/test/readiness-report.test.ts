// Distinguishing plugin-ready, project-ready and action-ready, reported only when relevant to the current
// task (INS-04). No tech-spec or ux-spec section names a mechanism for this; the shape here groups readiness
// probes and the verdict's own reasons that already exist, with no new gating logic (see plan.md §12.3/§13).
import { after, describe, it } from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, GREET_IMPL, GREET_TEST, focusFixture, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

describe("readiness states: plugin-ready, project-ready, action-ready [INS-04]", () => {
  it("doctor reports plugin-ready and project-ready as true on a healthy project", async () => {
    const r = await fresh().call("inspect", { view: "doctor" });
    assert.deepEqual(d(r).readiness, { plugin: { ready: true }, project: { ready: true } });
  });

  it("doctor names what is missing when the project itself is the cause, leaving plugin-ready unaffected", async () => {
    const p = fresh();
    rmSync(join(p.root, "node_modules"), { recursive: true, force: true });
    const r = await p.call("inspect", { view: "doctor" });
    assert.equal(d(r).readiness.plugin.ready, true);
    assert.equal(d(r).readiness.project.ready, false);
    assert.ok(d(r).readiness.project.blockedBy.includes("dependencies installed"), JSON.stringify(d(r).readiness));
  });

  it("why reports action-ready true once the contract reaches checked-local, naming nothing further", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    await p.call("check", { h, touched: ["src/greet.ts"] });
    await focusFixture(p, h);
    const r = await p.call("inspect", { h, view: "why" });
    assert.equal(d(r).endpoint, "checked-local", JSON.stringify(d(r)));
    assert.deepEqual(d(r).readiness, { action: { ready: true } });
  });

  it("why reports action-ready false, naming the protected-path block, without re-probing plugin or project", async () => {
    const p = project({ "db/001.sql": "create table a (id int);\n" });
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], protectedPaths: ["db/**"], lane: "standard" })).handle!;
    await p.call("decide", { h, kind: "basis", propose: BASIS });
    p.write("src/greet.test.ts", GREET_TEST);
    await p.call("check", { h, stage: "baseline" });
    p.write("src/greet.ts", GREET_IMPL);
    p.write("db/001.sql", "create table a (id int, name text);\n");
    await p.call("check", { h, stage: "candidate", touched: ["db/001.sql"] });
    const r = await p.call("inspect", { h, view: "why" });
    assert.equal(d(r).readiness.action.ready, false);
    assert.ok(d(r).readiness.action.blockedBy.includes("authority-needed"), JSON.stringify(d(r).readiness));
  });
});
