import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PluginHost } from "../src/adapters/host-plugin.ts";
import { CapabilityCache, UNKNOWN } from "../src/core/capabilities.ts";
import type { Recipes } from "../src/ports/types.ts";
import { hashOf } from "../src/core/ids.ts";
import { State } from "../src/core/schemas.ts";
import { emptyState } from "../src/core/state.ts";
import { capabilitiesState } from "../src/pipeline-capabilities.ts";
import { runVerb } from "../src/pipeline.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { project } from "./support/fixture.ts";
import { cleanup } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("capability cache [INS-05]", () => {
  const fixture = () => {
    const binding = Object.fromEntries(Object.entries(UNKNOWN).map(([name, cap]) =>
      [name, { ...cap, dependencies: name === "instructionFiles" ? ["AGENTS.md"] : [] }]));
    binding.harness = { value: "local", source: "static", dependencies: [] };
    const recipes: Recipes = { text: () => JSON.stringify(binding), load: () => null };
    let digest: string | null = hashOf("a");
    let available = true;
    const read = () => available
      ? digest === null ? { status: "unavailable" as const, cause: "missing" as const }
        : { status: "available" as const, text: "not retained", sha256: digest }
      : { status: "unavailable" as const, cause: "excluded" as const };
    const prepare = (cache?: CapabilityCache, over = {}) => {
      const host = new PluginHost(recipes, "host-1");
      host.prepare({ pluginVersion: "plugin-1", policyHash: hashOf("policy-1"), at: "2026-11-07T00:00:00Z", read, ...over }, cache);
      return host;
    };
    return { binding, prepare, change: (value: string | null) => { digest = value; }, exclude: () => { available = false; }, recipes, read };
  };

  it("reuses matching entries with the original timestamp across host instances", () => {
    const f = fixture(), first = f.prepare(), cache = first.cache();
    assert.equal(CapabilityCache.safeParse(cache).success, true);
    const second = f.prepare(cache, { at: "2026-11-08T00:00:00Z" });
    assert.equal(second.capabilities().harness.provenance?.reused, true);
    assert.equal(second.capabilities().harness.provenance?.probedAt, "2026-11-07T00:00:00Z");
    assert.deepEqual(second.cache(), cache);
  });

  it("reprobes only declared dependencies on mutation, deletion and addition", () => {
    const f = fixture();
    let cache = f.prepare().cache();
    for (const value of ["b", null, "c"]) {
      f.change(value === null ? null : hashOf(value));
      const host = f.prepare(cache);
      assert.equal(host.capabilities().instructionFiles.provenance?.reused, false);
      assert.equal(host.capabilities().harness.provenance?.reused, true);
      cache = host.cache();
    }
    assert.equal(f.prepare(cache).capabilities().instructionFiles.provenance?.reused, true);
  });

  it("invalidates every capability for each global key component", () => {
    const f = fixture(), cache = f.prepare().cache();
    for (const over of [{ pluginVersion: "plugin-2" }, { policyHash: hashOf("policy-2") }]) {
      for (const cap of Object.values(f.prepare(cache, over).capabilities())) assert.equal(cap.provenance?.reused, false);
    }
    const changedHost = new PluginHost(f.recipes, "host-2");
    changedHost.prepare({ pluginVersion: "plugin-1", policyHash: hashOf("policy-1"), at: "t", read: f.read }, cache);
    for (const cap of Object.values(changedHost.capabilities())) assert.equal(cap.provenance?.reused, false);
  });

  it("binds the declaration and refuses reuse for unknown host identity or unavailable inputs", () => {
    const f = fixture(), cache = f.prepare().cache();
    f.binding.harness = { value: "changed", source: "static", dependencies: [] };
    assert.equal(f.prepare(cache).capabilities().harness.provenance?.reused, false);
    f.exclude();
    const excluded = f.prepare(cache);
    assert.equal(excluded.capabilities().instructionFiles.value, "unknown");
    assert.match(excluded.capabilities().instructionFiles.evidence ?? "", /excluded/);
    assert.equal(excluded.cache().instructionFiles, undefined);
    assert.equal(excluded.capabilities().harness.provenance?.reused, false);
    const unknownHost = new PluginHost(f.recipes);
    unknownHost.prepare({ pluginVersion: "plugin-1", policyHash: hashOf("policy-1"), at: "t", read: f.read }, cache);
    for (const cap of Object.values(unknownHost.capabilities())) assert.equal(cap.provenance?.reused, false);
  });

  it("degrades only the dependent capability and rejects unsafe declarations", () => {
    const f = fixture(), cache = f.prepare().cache();
    f.exclude();
    const host = f.prepare(cache);
    assert.equal(host.capabilities().harness.provenance?.reused, true);
    assert.equal(host.capabilities().instructionFiles.provenance?.reused, false);
    f.binding.harness = { value: "local", source: "static", dependencies: ["../outside"] };
    assert.equal(f.prepare(cache).capabilities().harness.value, "unknown");
  });

  it("does not turn a no-op or preview into a state publication", () => {
    const p = project();
    roots.push(p.root);
    const host = fixture().prepare(), ports = { ...p.ports(), host };
    const current = { ...emptyState("workspace", "tag"), capabilityCache: host.cache() };
    for (const verb of ["open", "decide", "finish"]) {
      assert.equal(capabilitiesState(ports, undefined, verb), undefined);
      assert.equal(capabilitiesState(ports, current, verb), current);
    }
  });

  it("persists across fresh calls, ignores unrelated files, and never writes from status or doctor", async () => {
    const p = project();
    roots.push(p.root);
    const call = (verb: string, input: Record<string, unknown>) => runVerb(
      createPorts(p.root, { PATH: process.env.PATH, HOME: process.env.HOME, TENET_HOST_VERSION: "host-1" }), VERBS, verb, input);
    const opened = await call("open", { profile: "plan", request: "plan a greeting" });
    if (process.platform === "win32") {
      assert.equal(opened.exit, 2);
      assert.match(opened.reasons[0]?.message ?? "", /mutating work is unavailable/);
      assert.equal(existsSync(join(p.root, ".tenet")), false);
      return;
    }
    assert.equal(opened.exit, 0, JSON.stringify(opened));
    const file = join(p.root, ".tenet", "state");
    const before = readFileSync(file, "utf8"), stored = State.parse(JSON.parse(before));
    assert.ok(stored.capabilityCache?.harness);
    const status = await call("inspect", { view: "status" });
    const caps = (status.data as { capabilities: ReturnType<PluginHost["capabilities"]> }).capabilities;
    assert.equal(caps.harness.provenance?.reused, true);
    p.write("unrelated.txt", "outside the declaration");
    assert.equal((await call("inspect", { view: "status" })).exit, 0);
    assert.equal(readFileSync(file, "utf8"), before);
    p.write("AGENTS.md", "changed relevant input");
    const changed = await call("inspect", { view: "status" });
    const changedCaps = (changed.data as { capabilities: ReturnType<PluginHost["capabilities"]> }).capabilities;
    assert.equal(changedCaps.instructionFiles.provenance?.reused, false);
    assert.equal(changedCaps.harness.provenance?.reused, true);
    await call("inspect", { view: "doctor" });
    assert.equal(readFileSync(file, "utf8"), before);
    const { capabilityCache: _cache, ...legacy } = stored;
    assert.equal(State.safeParse(legacy).success, true);
    assert.equal(JSON.stringify(stored.capabilityCache).includes("changed relevant input"), false);
  });
});
