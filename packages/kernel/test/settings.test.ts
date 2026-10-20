// Settings through the verbs: `decide config`, `inspect settings` and the places `open` reads them (PRD §7.5-7.7).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => { for (const r of roots) cleanup(r); });
const fresh = (files?: Record<string, string>): Project => { const p = project(files); roots.push(p.root); return p; };
const state = (p: Project) => p.ports().store.read()!.state;
const d = (r: { data?: unknown }) => r.data as Record<string, any>;
const open = (p: Project, over: Record<string, unknown> = {}) => p.call("open", { profile: "investigate", request: "look around", ...over });

describe("decide config [CFG-06, CFG-07]", () => {
  it("a plain preference applies to this task only; a project one is kept and revisioned [LRN-01]", async () => {
    const p = fresh();
    const h = (await open(p)).handle!;
    const task = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "concise" } });
    assert.equal(d(task).scope, "task", JSON.stringify(task));
    assert.equal(state(p).config.revision, 0, "a task override makes no project revision");
    assert.equal(d(await p.call("inspect", { view: "settings", topic: "style", h })).setting.value, "concise");
    assert.equal(d(await p.call("inspect", { view: "settings", topic: "style" })).setting.value, "balanced", "another contract still sees the default");

    const proj = await p.call("decide", { h, kind: "config", target: "style", propose: { value: "guided", scope: "project" } });
    assert.equal(d(proj).changed, true);
    assert.equal(state(p).config.revision, 1);
    const seen = d(await p.call("inspect", { view: "settings", topic: "style", h })).setting;
    assert.equal(seen.value, "concise", "the task override is more specific");
    assert.deepEqual(seen.overridden.map((o: any) => [o.source, o.value]), [["project", "guided"], ["default", "balanced"]]);
  });

  it("reapplying an unchanged setting creates no revision, and a reset restores the inherited value", async () => {
    const p = fresh();
    const h = (await open(p)).handle!;
    await p.call("decide", { h, kind: "config", target: "integration", propose: { value: "never" } });
    const again = await p.call("decide", { h, kind: "config", target: "integration", propose: { value: "never" }, again: true });
    assert.equal(d(again).changed, false);
    assert.equal(state(p).config.revision, 1);
    await p.call("decide", { h, kind: "config", target: "integration", propose: { reset: true } });
    assert.equal(d(await p.call("inspect", { view: "settings", topic: "integration" })).setting.value, "offer");
  });

  it("rejects an unknown key, a malformed value and a scope the setting does not have, changing nothing", async () => {
    const p = fresh();
    const h = (await open(p)).handle!;
    for (const [target, propose] of [["no_such", { value: 1 }], ["lane", { value: "turbo" }], ["protected_paths", { value: ["x"], scope: "task" }], ["shared_memory", { value: "adopted" }]] as const) {
      const r = await p.call("decide", { h, kind: "config", target, propose });
      assert.equal(r.exit, 2, `${target}: ${JSON.stringify(r)}`);
      assert.equal(r.reasons[0]!.code, "restriction-key-unknown");
    }
    assert.equal(state(p).config.revision, 0);
  });

  it("keeps a restriction a person set: a protected path from the project settings applies to the next contract", async () => {
    const p = fresh();
    const h = (await open(p)).handle!;
    await p.call("decide", { h, kind: "config", target: "protected_paths", propose: { value: ["db/**"] } });
    await p.call("stop", { h, mode: "pause" });
    await open(p, { request: "second" });
    assert.deepEqual(Object.values(state(p).work).at(-1)!.scope.protected, ["db/**"]);
  });
});

describe("inspect settings [CFG-05]", () => {
  it("lists every effective value, and explains one with its source, adoption state and how to change it", async () => {
    const p = fresh({ "tenet.policy.json": JSON.stringify({ protected_paths: ["infra/**"] }) });
    const all = d(await p.call("inspect", { view: "settings" })).settings;
    assert.equal(Object.keys(all).length, 12);
    assert.deepEqual(all.protected_paths, ["infra/**"], "restrictions in a shared file apply before it is adopted");
    const one = d(await p.call("inspect", { view: "settings", topic: "protected_paths" })).setting;
    assert.equal(one.source, "shared policy");
    assert.equal(one.adoption, "undecided");
    assert.match(one.howToChange, /decide config/);
    assert.equal((await p.call("inspect", { view: "settings", topic: "nope" })).exit, 2);
  });
});

describe("open reads the settings", () => {
  it("uses the lane preference as the default lane, never below the floor", async () => {
    const p = fresh();
    const h = (await open(p)).handle!;
    await p.call("decide", { h, kind: "config", target: "lane", propose: { value: "deep", scope: "project" } });
    await p.call("stop", { h, mode: "pause" });
    const o = await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"] });
    assert.equal(d(o).lane, "deep", JSON.stringify(o));
    const explicit = await p.call("stop", { h: o.handle!, mode: "pause" }).then(() => p.call("open", { profile: "feature", request: "again", scopePaths: ["src/greet.ts"], lane: "quick" }));
    assert.notEqual(d(explicit).lane, "deep", "an explicit request for this contract wins over the default");
  });

  it("hands the coordinator its presentation settings, with this task's overrides", async () => {
    const p = fresh();
    const o = await open(p);
    assert.deepEqual(d(o).settings, { style: "balanced", checkpoints: "milestones", resource_mode: "normal" });
    await p.call("decide", { h: o.handle!, kind: "config", target: "style", propose: { value: "concise" } });
    const resumed = await p.call("open", { profile: "investigate", request: "look around", resume: true });
    assert.equal(d(resumed).settings.style, "concise");
  });

  it("says when a shared file's restrictions apply before it is adopted", async () => {
    const p = fresh({ "tenet.policy.json": JSON.stringify({ protected_paths: ["db/**"] }) });
    const o = await open(p);
    assert.ok(o.reasons.some((r) => r.code === "policy-applied"), JSON.stringify(o.reasons));
    assert.deepEqual(Object.values(state(p).work).at(-1)!.scope.protected, ["db/**"]);
  });
});
