// Changing a setting: the interpreted read-back, and confirmation before loosening what is enforced (CFG-01, PRD §7.5-7.6).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import { interpretChange, needsConfirmation } from "../src/core/config.ts";
import type { Layers } from "../src/core/config.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const layers = (local: Record<string, unknown> = {}, shared: Record<string, unknown> = {}): Layers =>
  ({ shared, local, task: {}, adoption: { intent: "undecided", policy: "undecided" } }) as Layers;
const POSIX = { skip: process.platform === "win32" && "mutating work is refused on Windows" };

describe("interpreting a settings change [CFG-01]", () => {
  it("[CFG-01] reports the effective value before and after, when it takes effect, and how to undo it", () => {
    const r = interpretChange("protected_paths", layers(), layers({ protected_paths: ["db/**"] }), "project", undefined);
    assert.deepEqual([r.before, r.after], [[], ["db/**"]]);
    assert.match(r.takesEffect, /before the next affected edit/);
    assert.match(r.undo, /"reset":true/);
    const s = interpretChange("style", layers({ style: "guided" }), layers({ style: "concise" }), "project", "guided");
    assert.equal(s.takesEffect, "immediately");
    assert.match(s.undo, /"value":"guided"/);
  });

  it("[CFG-01] tightening and preferences save at once; loosening, altering a check and any command change need confirmation", () => {
    assert.deepEqual(needsConfirmation("protected_paths", layers(), layers({ protected_paths: ["db/**"] })), []);
    assert.deepEqual(needsConfirmation("lane", layers({ lane: "deep" }), layers({ lane: "quick" })), []);
    assert.equal(needsConfirmation("protected_paths", layers({ protected_paths: ["db/**"] }), layers()).length, 1);
    const types = { id: "types", property: "no type errors", tool: "tsc" };
    assert.equal(needsConfirmation("required_checks", layers({ required_checks: [types] }), layers({ required_checks: [{ ...types, tool: "x" }] })).length, 1);
    assert.equal(needsConfirmation("commands", layers(), layers({ commands: { test: { argv: ["vitest"] } } })).length, 1);
    assert.equal(needsConfirmation("dependency_policy", layers(), layers({ dependency_policy: { min_release_age_days: 7 } })).length, 0);
    assert.equal(needsConfirmation("dependency_policy", layers({ dependency_policy: { unknown_age: "deny" } }), layers()).length, 1);
    assert.deepEqual(needsConfirmation("protected_paths", layers({ protected_paths: ["db/**"] }, { protected_paths: ["db/**"] }), layers({}, { protected_paths: ["db/**"] })), [],
      "removing a project copy of a path the shared policy still protects changes nothing in force");
  });
});

describe("decide config asks before loosening [CFG-01]", POSIX, () => {
  const setup = async () => {
    const p = project();
    roots.push(p.root);
    const h = (await p.call("open", { profile: "investigate", request: "look around" })).handle!;
    const set = await p.call("decide", { h, kind: "config", target: "protected_paths", propose: { value: ["db/**"], scope: "project" } });
    return { p, h, set };
  };
  const local = (p: ReturnType<typeof project>) => p.ports().store.read()!.state.config;

  it("[CFG-01] a tightening saves at once with the interpreted read-back", async () => {
    const { set } = await setup();
    assert.equal(set.exit, 0, JSON.stringify(set));
    const i = (set.data as any).interpreted;
    assert.deepEqual([i.setting, i.scope, i.before, i.after], ["protected_paths", "project", [], ["db/**"]]);
    assert.ok(i.undo && i.takesEffect);
  });

  it("[CFG-01] removing a protected path asks first and saves nothing; confirm saves; keep clears the question", async () => {
    const { p, h } = await setup();
    const before = local(p);
    const remove = { h, kind: "config", target: "protected_paths", propose: { reset: true, scope: "project" } };
    const asked = await p.call("decide", remove);
    assert.equal(asked.exit, 3, JSON.stringify(asked));
    assert.equal(asked.questions![0]!.id, "config-confirm");
    assert.match(asked.questions![0]!.question, /drops db\/\*\*/);
    assert.deepEqual(local(p), before, "nothing is saved before the answer");
    const kept = await p.call("decide", { ...remove, answers: { "config-confirm": "keep" } });
    assert.equal(kept.exit, 0, JSON.stringify(kept));
    assert.deepEqual(local(p), before);
    assert.equal(p.ports().store.read()!.state.pending.length, 0, "keep closes the question");
    assert.equal((await p.call("decide", remove)).exit, 3, "asked again after keep");
    const done = await p.call("decide", { ...remove, answers: { "config-confirm": "confirm" } });
    assert.equal(done.exit, 0, JSON.stringify(done));
    assert.deepEqual(local(p).local.protected_paths, undefined);
    assert.deepEqual((done.data as any).interpreted.after, []);
  });

  it("[CFG-01] a confirmation for a different change is not accepted", async () => {
    const { p, h } = await setup();
    await p.call("decide", { h, kind: "config", target: "protected_paths", propose: { reset: true, scope: "project" } });
    const other = await p.call("decide", { h, kind: "config", target: "protected_paths", propose: { value: [], scope: "project" }, answers: { "config-confirm": "confirm" } });
    assert.equal(other.exit, 3, JSON.stringify(other));
    assert.deepEqual(local(p).local.protected_paths, ["db/**"]);
  });
});
