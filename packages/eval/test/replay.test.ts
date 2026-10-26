import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { replayFixtureFile } from "../src/replay.ts";
import { maxConcurrency } from "../../../tools/host/evaluate.ts";
import { projectScratch } from "../../../tools/test-scratch.ts";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

type SyntheticEvent = { type: string; timestamp: string; data: Record<string, unknown> };
type Expected = { children: Array<Record<string, unknown>>; maxConcurrency: number | null; toolVerdicts: Array<Record<string, unknown>> };

function fixture(fixtureId: string, events: SyntheticEvent[], sentinelExists: boolean, expected: Expected) {
  return { schemaVersion: 1, fixtureId, sourceTier: "synthetic", events, sentinelExists, expected };
}

function scratch() {
  const root = projectScratch("tenet-offline-replay-");
  roots.push(root);
  return root;
}

function writeFixture(root: string, value: unknown, name = "replay.json") {
  const path = join(root, name);
  const bytes = Buffer.from(JSON.stringify(value, null, 2));
  writeFileSync(path, bytes);
  return { path, bytes };
}

const start = (seconds: number, type: string, data: Record<string, unknown>): SyntheticEvent => ({
  type,
  timestamp: new Date(Date.UTC(2026, 9, 24, 12, 0, seconds)).toISOString(),
  data,
});

describe("offline synthetic observation replay", () => {
  it("keeps reversed child intervals unknown without changing valid overlap", () => {
    const child = { callId: "child-one", name: "agent", startMs: 10, endMs: 5, declaredTools: [], calls: [] };
    assert.equal(maxConcurrency([child]), null);
    assert.equal(maxConcurrency([{ ...child, endMs: 20 }]), 1);
  });
  it("replays an exact tool-call denial and emits the frozen complete result", () => {
    const root = scratch();
    const events = [
      start(0, "subagent.started", { toolCallId: "child-1", agentName: "tenet:tenet-analyst" }),
      start(1, "tool.execution_start", { toolCallId: "tool-1", toolName: "create", parentToolCallId: "child-1" }),
      start(2, "tool.execution_start", { toolCallId: "tool-2", toolName: "delete", parentToolCallId: "child-1" }),
      start(3, "tool.execution_complete", { toolCallId: "tool-1", success: false, error: { code: "denied" } }),
      start(4, "subagent.completed", { toolCallId: "child-1" }),
    ];
    const expected: Expected = {
      children: [{ callId: "child-1", name: "tenet:tenet-analyst", startMs: 1792843200000, endMs: 1792843204000, declaredTools: [], calls: [{ tool: "create", refused: true }, { tool: "delete", refused: false }] }],
      maxConcurrency: 1,
      toolVerdicts: [{ callId: "child-1", verdict: "enforced-by-host", attempted: ["create", "delete"], refused: ["create"] }],
    };
    const input = writeFixture(root, fixture("exact-denial", events, false, expected));
    const result = replayFixtureFile(input.path);
    assert.equal(result.fixtureSha256, createHash("sha256").update(input.bytes).digest("hex"));
    assert.deepEqual(result.output, expected);
    assert.equal(result.sourceTier, "synthetic");
  });

  it("keeps generic tool failures unknown and never promotes them to host enforcement", () => {
    const root = scratch();
    const events = [
      start(0, "subagent.started", { toolCallId: "child-1", agentName: "tenet:tenet-analyst" }),
      start(1, "tool.execution_start", { toolCallId: "tool-1", toolName: "create", parentToolCallId: "child-1" }),
      start(2, "tool.execution_complete", { toolCallId: "tool-1", success: false, error: { code: "tool_error" } }),
      start(3, "subagent.completed", { toolCallId: "child-1" }),
    ];
    const expected: Expected = {
      children: [{ callId: "child-1", name: "tenet:tenet-analyst", startMs: 1792843200000, endMs: 1792843203000, declaredTools: [], calls: [{ tool: "create", refused: false }] }],
      maxConcurrency: 1,
      toolVerdicts: [{ callId: "child-1", verdict: "unknown", attempted: ["create"], refused: [] }],
    };
    const { path } = writeFixture(root, fixture("generic-error", events, false, expected));
    assert.deepEqual(replayFixtureFile(path).output, expected);
  });

  it("reports incomplete overlap as unknown instead of extending a child interval", () => {
    const root = scratch();
    const events = [
      start(0, "subagent.started", { toolCallId: "child-1", agentName: "tenet:tenet-analyst" }),
      start(1, "subagent.started", { toolCallId: "child-2", agentName: "tenet:tenet-analyst" }),
      start(2, "subagent.completed", { toolCallId: "child-2" }),
    ];
    const expected: Expected = {
      children: [
        { callId: "child-1", name: "tenet:tenet-analyst", startMs: 1792843200000, endMs: null, declaredTools: [], calls: [] },
        { callId: "child-2", name: "tenet:tenet-analyst", startMs: 1792843201000, endMs: 1792843202000, declaredTools: [], calls: [] },
      ],
      maxConcurrency: null,
      toolVerdicts: [
        { callId: "child-1", verdict: "cooperative", attempted: [], refused: [] },
        { callId: "child-2", verdict: "cooperative", attempted: [], refused: [] },
      ],
    };
    const { path } = writeFixture(root, fixture("incomplete-child", events, false, expected));
    assert.deepEqual(replayFixtureFile(path).output, expected);
  });

  it("preserves a uniquely attributable selected tool list", () => {
    const root = scratch();
    const events = [
      start(0, "subagent.started", { toolCallId: "child-1", agentName: "tenet:tenet-analyst" }),
      start(1, "subagent.selected", { agentName: "tenet:tenet-analyst", tools: ["read", "search"] }),
      start(2, "subagent.completed", { toolCallId: "child-1" }),
    ];
    const expected: Expected = {
      children: [{ callId: "child-1", name: "tenet:tenet-analyst", startMs: 1792843200000, endMs: 1792843202000, declaredTools: ["read", "search"], calls: [] }],
      maxConcurrency: 1,
      toolVerdicts: [{ callId: "child-1", verdict: "cooperative", attempted: [], refused: [] }],
    };
    const { path } = writeFixture(root, fixture("unique-selection", events, false, expected));
    assert.deepEqual(replayFixtureFile(path).output, expected);
  });

  it("rejects orphaned, repeated, or ambiguous same-name selection events", () => {
    const root = scratch();
    const base = fixture("bad-selection", [], false, { children: [], maxConcurrency: 0, toolVerdicts: [] });
    const cases = [
      { ...base, events: [start(0, "subagent.selected", { agentName: "missing", tools: ["read"] })] },
      { ...base, events: [start(0, "subagent.started", { toolCallId: "child-1", agentName: "same" }), start(1, "subagent.selected", { agentName: "same", tools: [] }), start(2, "subagent.selected", { agentName: "same", tools: ["read"] })] },
      { ...base, events: [start(0, "subagent.started", { toolCallId: "child-1", agentName: "same" }), start(1, "subagent.started", { toolCallId: "child-2", agentName: "same" }), start(2, "subagent.selected", { agentName: "same", tools: ["read"] })] },
    ];
    for (const [index, value] of cases.entries()) {
      const { path } = writeFixture(root, value, `bad-selection-${index}.json`);
      assert.throws(() => replayFixtureFile(path));
    }
  });

  it("repeats the same synthetic fixture byte-for-byte without adding evidence tier", () => {
    const root = scratch();
    const expected: Expected = { children: [], maxConcurrency: 0, toolVerdicts: [] };
    const input = writeFixture(root, fixture("empty-observations", [], false, expected));
    const first = replayFixtureFile(input.path);
    const second = replayFixtureFile(input.path);
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.equal(first.sourceTier, "synthetic");
    assert.equal(first.result, "replay-passed");
  });

  it("rejects unsupported source tiers, unknown fields, invalid variants, and duplicate keys", () => {
    const root = scratch();
    const base = fixture("bad-shape", [], false, { children: [], maxConcurrency: 0, toolVerdicts: [] });
    for (const [index, value] of [
      { ...base, sourceTier: "T3" },
      { ...base, extra: true },
      { ...base, events: [{ ...start(0, "subagent.started", { toolCallId: "c", agentName: "agent" }), data: { toolCallId: "c", agentName: "agent", extra: true } }] },
    ].entries()) {
      const { path } = writeFixture(root, value, `invalid-${index}.json`);
      assert.throws(() => replayFixtureFile(path));
    }
    const duplicate = join(root, "duplicate.json");
    writeFileSync(duplicate, '{"schemaVersion":1,"schemaVersion":1}');
    assert.throws(() => replayFixtureFile(duplicate));
  });

  it("rejects identifiers and timestamps longer than the per-string byte bound", () => {
    const root = scratch();
    const expected: Expected = { children: [], maxConcurrency: 0, toolVerdicts: [] };
    const oversizedFixtureId = fixture("x".repeat(4097), [], false, expected);
    assert.throws(() => replayFixtureFile(writeFixture(root, oversizedFixtureId).path));
    const oversizedEvent = fixture("bounded-id", [start(0, "subagent.started", { toolCallId: "x".repeat(4097), agentName: "agent" })], false, expected);
    assert.throws(() => replayFixtureFile(writeFixture(root, oversizedEvent, "oversized-event.json").path));
  });

  it("rejects linked replay fixtures and never touches their target", () => {
    const root = scratch();
    const { path: target } = writeFixture(root, fixture("link-target", [], false, { children: [], maxConcurrency: 0, toolVerdicts: [] }));
    const linked = join(root, "linked.json");
    symlinkSync(target, linked);
    assert.throws(() => replayFixtureFile(linked));
    assert.ok(resolve(target).startsWith(resolve(root)));
  });

  it("CLI repeats deterministic output without executing a grader or external reference", () => {
    const root = scratch();
    const input = writeFixture(root, fixture("cli-replay", [], false, { children: [], maxConcurrency: 0, toolVerdicts: [] }));
    const cli = resolve("tools/eval.ts");
    const major = Number(process.versions.node.split(".")[0]);
    const stripTypes = major < 24 ? ["--experimental-strip-types"] : [];
    const run = () => spawnSync(process.execPath, [...stripTypes, cli, "--capture", input.path], { encoding: "utf8" });
    const first = run(), second = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout, second.stdout);
    const output = JSON.parse(first.stdout);
    assert.equal(output.sourceTier, "synthetic");
    assert.equal(output.result, "replay-passed");
  });
});
