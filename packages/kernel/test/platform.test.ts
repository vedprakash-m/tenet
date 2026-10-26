import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { z } from "zod";
import { runVerb } from "../src/pipeline.ts";
import type { OpClass, Verb } from "../src/pipeline.ts";
import { mutationSupported } from "../src/core/risk.ts";
import { readinessOf } from "../src/verbs/common.ts";
import { VERBS } from "../src/verbs/index.ts";
import { createPorts } from "../src/wire.ts";
import { cleanup, tmp } from "./helpers.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const scratch = () => { const root = tmp("tenet-platform-"); roots.push(root); return root; };

describe("platform admission before mutation [INS-06, INS-12]", () => {
  it("doctor cannot report success while the same platform fact blocks plugin readiness [INS-04]", async () => {
    for (const platform of ["win32", "freebsd", "darwin", "linux"] as const) {
      const root = scratch();
      const base = createPorts(root);
      const probe = await base.git.probe();
      const detected = base.stack.detect(root);
      base.git.probe = async () => ({
        ...probe, isRepo: true, state: "ok", identity: true, version: "git synthetic",
      });
      base.stack.detect = () => ({
        ...detected, language: "ts-js", typescript: true, depsInstalled: true,
        runner: "vitest", runnerVersion: "3.0.0", runnerSupported: true,
      });
      const ports = { ...base, platform };
      const response = await runVerb(ports, VERBS, "inspect", { view: "doctor" });
      const data = response.data as {
        ok: boolean; readiness: { plugin: { ready: boolean; blockedBy?: string[] } };
      };
      assert.ok(data, JSON.stringify(response));
      const supported = platform === "darwin" || platform === "linux";
      assert.equal(data.readiness.plugin.ready, supported, JSON.stringify(response));
      assert.equal(data.ok, supported, JSON.stringify(response));
      assert.equal(response.exit, supported ? 0 : 2, JSON.stringify(response));
      if (!supported) assert.ok(data.readiness.plugin.blockedBy?.includes("platform"));
      assert.equal(existsSync(join(root, ".tenet")), false);
    }
  });

  it("uses the same platform fact for admission and readiness", async () => {
    for (const platform of ["darwin", "linux", "win32", "freebsd"] as const) {
      const ports = { ...createPorts(scratch()), platform };
      const supported = platform === "darwin" || platform === "linux";
      assert.equal(mutationSupported(platform), supported);
      assert.equal(readinessOf(ports, await ports.git.probe()).platformOk, supported);
    }
    assert.equal(createPorts(scratch()).platform, process.platform);
  });

  for (const platform of ["win32", "freebsd"] as const) {
    it(`refuses ${platform} before any store access or verb effect`, async () => {
      const root = scratch(), calls: string[] = [];
      const base = createPorts(root);
      const ports = {
        ...base, platform,
        store: new Proxy(base.store, {
          get(_target, key) {
            calls.push(String(key));
            throw new Error(`unexpected store access: ${String(key)}`);
          },
        }),
      };
      const verb: Verb = {
        name: "mutation", schema: z.strictObject({}), class: () => "mutating",
        preLock: async () => { calls.push("preLock"); },
        identity: async () => { calls.push("identity"); },
        run: () => { calls.push("run"); return { resp: {} }; },
      };
      const response = await runVerb(ports, { mutation: verb }, "mutation", {});
      assert.equal(response.exit, 2, JSON.stringify(response));
      assert.deepEqual(response.reasons.map(r => r.code), ["capability-missing"]);
      assert.match(response.reasons[0]!.message, new RegExp(platform));
      assert.deepEqual(calls, []);
      assert.equal(existsSync(join(root, ".tenet")), false);
    });

    for (const cls of ["stateless", "read-only"] satisfies OpClass[]) {
      it(`keeps ${cls} calls available on ${platform}`, async () => {
        const root = scratch();
        const ports = { ...createPorts(root), platform };
        const verb: Verb = {
          name: "inspectable", schema: z.strictObject({}), class: () => cls,
          run: () => ({ resp: { data: "inspected" } }),
        };
        const response = await runVerb(ports, { inspectable: verb }, "inspectable", {});
        assert.equal(response.exit, 0, JSON.stringify(response));
        assert.equal(response.data, "inspected");
        assert.equal(existsSync(join(root, ".tenet")), false);
      });
    }
  }

  it("leaves existing corrupt state and pending lock recovery untouched", async () => {
    const root = scratch(), state = join(root, ".tenet");
    mkdirSync(state);
    const original = {
      marker: "not a marker\n", state: "not state\n", "lock.break": "not a lock\n",
    };
    for (const [name, content] of Object.entries(original)) writeFileSync(join(state, name), content);
    const ports = { ...createPorts(root), platform: "win32" as const };
    const response = await runVerb(ports, VERBS, "open", { profile: "plan", request: "plan a greeting" });
    assert.equal(response.exit, 2, JSON.stringify(response));
    assert.equal(response.reasons[0]?.code, "capability-missing");
    assert.deepEqual(readdirSync(state).sort(), Object.keys(original).sort());
    for (const [name, content] of Object.entries(original)) assert.equal(readFileSync(join(state, name), "utf8"), content);
  });

  it("refuses a real editing request on Windows without creating local state", async () => {
    const root = scratch();
    const ports = { ...createPorts(root), platform: "win32" as const };
    const response = await runVerb(ports, VERBS, "open", {
      profile: "feature", request: "add a greeting", lane: "quick",
    });
    assert.equal(response.exit, 2, JSON.stringify(response));
    assert.equal(response.reasons[0]?.code, "capability-missing");
    assert.equal(existsSync(join(root, ".tenet")), false);
    assert.equal((await runVerb(ports, VERBS, "inspect", { view: "help" })).exit, 0);
  });

  it("still validates input before reporting the platform boundary", async () => {
    const ports = { ...createPorts(scratch()), platform: "win32" as const };
    const response = await runVerb(ports, VERBS, "open", { profile: "invalid" });
    assert.equal(response.exit, 1);
    assert.equal(response.reasons[0]?.code, "invalid-input");
    const unknown = await runVerb(ports, VERBS, "unknown", {});
    assert.equal(unknown.exit, 1);
    assert.equal(unknown.reasons[0]?.code, "unknown-verb");
  });
});
