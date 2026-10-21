// The host binding's capability descriptor: core reads capabilities, never host names (ENG-02, PRD 3.8.2, TS §4.4).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, tmp } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import { controlsFor } from "../src/core/controls.ts";
import { Descriptor, UNKNOWN } from "../src/core/capabilities.ts";
import { lintArch } from "../../../tools/lint-arch.ts";
import { newContract } from "../src/core/state.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const d = (r: { data?: unknown }) => r.data as Record<string, any>;

describe("capability descriptor [ENG-02]", () => {
  it("ships with the host binding, validates, and says unknown where nothing was observed", async () => {
    const p = project();
    roots.push(p.root);
    const caps = p.ports().host.capabilities();
    assert.ok(Descriptor.safeParse(caps).success);
    assert.equal(caps.harness.source, "static");
    assert.equal(caps.approvalMode.value, "unknown", "approval mode is never inferred");
    for (const [key, cap] of Object.entries(caps)) {
      if (cap.source === "unknown") assert.equal(cap.value, "unknown", `${key}: an unobserved capability claims nothing`);
      if (cap.source === "observed") assert.ok(cap.evidence, `${key}: an observation names its evidence`);
    }
  });

  it("is shown by doctor", async () => {
    const p = project();
    roots.push(p.root);
    const r = await p.call("inspect", { view: "doctor" });
    assert.equal(d(r).capabilities.harness.value, "local");
  });

  it("decides how a review's independence is worded: observed isolation is said to be observed", () => {
    const w = { ...newContract({ id: "W", label: "W-0001", profile: "feature", request: "x", lane: "standard", floor: "standard", level: "L3", generation: 1, now: "t", version: "v", assessment: {}, scopePaths: [], protectedPaths: [], gitMode: "git", base: null, branch: null, start: { head: null, branch: null, staged: [], dirty: [] } }) };
    w.reviews = [{ reservation: "R", mode: "full", candidate: "c", basisHash: "b", uncovered: [], verified: [], independence: "subagent-fresh", status: "completed", files: {} }];
    const note = (isolation: Descriptor["subagents"]) => controlsFor(w, "checked-local", { ...UNKNOWN, subagents: isolation }).controls.find((c) => c.control === "review independence")!.note;
    assert.match(note({ value: "unknown", source: "unknown" }), /not observed/);
    assert.match(note({ value: "isolated", source: "observed", evidence: "VS Code, 2026-10-19" }), /observed.*VS Code, 2026-10-19/);
  });

  it("is checked: core, verbs, decisions and the pipeline name no host", () => {
    const src = tmp("tenet-arch-");
    roots.push(src);
    mkdirSync(join(src, "core"), { recursive: true });
    writeFileSync(join(src, "core/x.ts"), 'export const where = "VS Code";\n');
    writeFileSync(join(src, "core/ok.ts"), "export const fine = 1;\n");
    const bad = lintArch(src).problems.join("\n");
    assert.match(bad, /core\/x\.ts:1: names a host/);
    assert.doesNotMatch(bad, /ok\.ts/);
  });
});
