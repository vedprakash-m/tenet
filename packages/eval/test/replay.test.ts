import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
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

  it("rejects child/tool start ID collisions in either order before comparison", () => {
    const root = scratch();
    const child = (callId: string, name: string, startMs: number, endMs: number, calls: unknown[]) =>
      ({ callId, name, startMs, endMs, declaredTools: [], calls });
    const cases = [
      {
        events: [
          start(0, "subagent.started", { toolCallId: "shared", agentName: "agent" }),
          start(1, "tool.execution_start", { toolCallId: "shared", toolName: "create", parentToolCallId: "shared" }),
          start(2, "tool.execution_complete", { toolCallId: "shared", success: false, error: { code: "denied" } }),
          start(3, "subagent.completed", { toolCallId: "shared" }),
        ],
        expected: {
          children: [child("shared", "agent", 1792843200000, 1792843203000, [{ tool: "create", refused: true }])],
          maxConcurrency: 1,
          toolVerdicts: [{ callId: "shared", verdict: "enforced-by-host", attempted: ["create"], refused: ["create"] }],
        },
      },
      {
        events: [
          start(0, "subagent.started", { toolCallId: "parent", agentName: "parent-agent" }),
          start(1, "tool.execution_start", { toolCallId: "shared", toolName: "create", parentToolCallId: "parent" }),
          start(2, "subagent.started", { toolCallId: "shared", agentName: "child-agent" }),
          start(3, "tool.execution_complete", { toolCallId: "shared", success: false, error: { code: "denied" } }),
          start(4, "subagent.completed", { toolCallId: "shared" }),
          start(5, "subagent.completed", { toolCallId: "parent" }),
        ],
        expected: {
          children: [
            child("parent", "parent-agent", 1792843200000, 1792843205000, [{ tool: "create", refused: true }]),
            child("shared", "child-agent", 1792843202000, 1792843204000, []),
          ],
          maxConcurrency: 2,
          toolVerdicts: [
            { callId: "parent", verdict: "enforced-by-host", attempted: ["create"], refused: ["create"] },
            { callId: "shared", verdict: "cooperative", attempted: [], refused: [] },
          ],
        },
      },
    ];
    const errors = cases.map((input, index) => {
      const { path } = writeFixture(root, fixture(`colliding-start-${index}`, input.events, false, input.expected));
      try { replayFixtureFile(path); return null; }
      catch (error) { return (error as { code?: string }).code; }
    });
    assert.deepEqual(errors, ["replay-invalid", "replay-invalid"]);
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

  it("rejects malformed UTF-8 and enforces the exact fixture-byte limit", () => {
    const root = scratch();
    const path = join(root, "bounded.json");
    writeFileSync(path, Buffer.from([0x7b, 0xff, 0x7d]));
    assert.throws(() => replayFixtureFile(path), { code: "invalid-utf8" });
    const bytes = Buffer.from(JSON.stringify(fixture("bounded-bytes", [], false,
      { children: [], maxConcurrency: 0, toolVerdicts: [] })));
    const atLimit = Buffer.concat([bytes, Buffer.alloc(1024 * 1024 - bytes.length, 0x20)]);
    writeFileSync(path, atLimit);
    assert.equal(replayFixtureFile(path).fixtureSha256, createHash("sha256").update(atLimit).digest("hex"));
    writeFileSync(path, Buffer.concat([atLimit, Buffer.from(" ")]));
    assert.throws(() => replayFixtureFile(path), { code: "unsafe-file" });
  });

  it("enforces the event-count limit within the fixture-byte limit", () => {
    const root = scratch();
    const opened = start(0, "subagent.started", { toolCallId: "c", agentName: "a" });
    const completed = start(1, "subagent.completed", { toolCallId: "c" });
    const expected: Expected = {
      children: [{ callId: "c", name: "a", startMs: 1792843200000, endMs: 1792843201000, declaredTools: [], calls: [] }],
      maxConcurrency: 1,
      toolVerdicts: [{ callId: "c", verdict: "cooperative", attempted: [], refused: [] }],
    };
    // Repeated completions have no new start identity; v1 forbids duplicate starts, not duplicate completions.
    for (const count of [10_000, 10_001]) {
      const events = [opened, ...Array<SyntheticEvent>(count - 1).fill(completed)];
      const bytes = Buffer.from(JSON.stringify(fixture("bounded-events", events, false, expected)));
      assert.ok(bytes.length <= 1024 * 1024, "exercise event count independently of the file bound");
      const path = join(root, `events-${count}.json`);
      writeFileSync(path, bytes);
      if (count === 10_000) assert.deepEqual(replayFixtureFile(path).output, expected);
      else assert.throws(() => replayFixtureFile(path), { code: "replay-invalid" });
    }
  });

  it("measures event text limits in UTF-8 bytes while retaining valid non-ASCII text", () => {
    const root = scratch();
    const name = "é".repeat(2048);
    const expected: Expected = {
      children: [{ callId: "c", name, startMs: 1792843200000, endMs: 1792843201000, declaredTools: [], calls: [] }],
      maxConcurrency: 1,
      toolVerdicts: [{ callId: "c", verdict: "cooperative", attempted: [], refused: [] }],
    };
    for (const text of [name, name + "é"]) {
      const events = [start(0, "subagent.started", { toolCallId: "c", agentName: text }),
        start(1, "subagent.completed", { toolCallId: "c" })];
      const input = writeFixture(root, fixture("bounded-utf8", events, false, expected));
      if (text === name) assert.deepEqual(replayFixtureFile(input.path).output, expected);
      else assert.throws(() => replayFixtureFile(input.path), { code: "replay-invalid" });
    }
  });

  it("keeps poison strings inert under process, network and filesystem-write traps", () => {
    const root = scratch();
    const marker = join(root, "poison-marker");
    const poison = `globalThis.__replayPoisonExecuted = true; require("node:fs").writeFileSync(${JSON.stringify(marker)}, "poison");`;
    const events = [
      start(0, "subagent.started", { toolCallId: "child", agentName: poison }),
      start(1, "subagent.selected", { agentName: poison, tools: [poison] }),
      start(2, "tool.execution_start", { toolCallId: "tool", toolName: poison, parentToolCallId: "child" }),
      start(3, "tool.execution_complete", { toolCallId: "tool", success: false, error: { code: poison } }),
      start(4, "subagent.completed", { toolCallId: "child" }),
    ];
    const expected: Expected = {
      children: [{ callId: "child", name: poison, startMs: 1792843200000, endMs: 1792843204000,
        declaredTools: [poison], calls: [{ tool: poison, refused: false }] }],
      maxConcurrency: 1,
      toolVerdicts: [{ callId: "child", verdict: "unknown", attempted: [poison], refused: [] }],
    };
    const input = writeFixture(root, fixture("inert-poison", events, false, expected));
    const script = `
      import assert from "node:assert/strict";
      import fs from "node:fs";
      import fsp from "node:fs/promises";
      import cp from "node:child_process";
      import net from "node:net";
      import tls from "node:tls";
      import http from "node:http";
      import https from "node:https";
      import http2 from "node:http2";
      import dgram from "node:dgram";
      import { syncBuiltinESMExports } from "node:module";
      const attempted = [];
      const deny = name => (...args) => { attempted.push(name); throw new Error("effect-trap:" + name); };
      for (const key of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"])
        cp[key] = deny("child_process." + key);
      cp.ChildProcess.prototype.spawn = deny("ChildProcess.spawn");
      const mutations = ["writeFile", "appendFile", "write", "writev", "truncate", "ftruncate", "copyFile", "cp",
        "rename", "unlink", "rm", "rmdir", "mkdir", "mkdtemp", "link", "symlink", "chmod", "fchmod", "lchmod",
        "chown", "fchown", "lchown", "utimes", "futimes", "lutimes", "fsync", "fdatasync"];
      for (const name of mutations) {
        for (const key of [name, name + "Sync"]) if (typeof fs[key] === "function") fs[key] = deny("fs." + key);
        if (typeof fsp[name] === "function") fsp[name] = deny("fsp." + name);
      }
      fs.createWriteStream = deny("fs.createWriteStream");
      const open = fs.openSync;
      fs.openSync = (path, flags, ...args) => {
        const writeFlags = fs.constants.O_WRONLY | fs.constants.O_RDWR | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_APPEND;
        if (typeof flags === "string" ? flags !== "r" : (flags & writeFlags) !== 0) return deny("fs.openSync.write")(path);
        return open(path, flags, ...args);
      };
      fs.open = deny("fs.open");
      fsp.open = deny("fsp.open");
      for (const [module, names] of [[net, ["connect", "createConnection"]], [tls, ["connect"]],
        [http, ["request", "get"]], [https, ["request", "get"]], [http2, ["connect"]], [dgram, ["createSocket"]]])
        for (const key of names) module[key] = deny(key);
      net.Socket.prototype.connect = deny("Socket.connect");
      net.Server.prototype.listen = deny("Server.listen");
      dgram.Socket.prototype.send = deny("datagram.send");
      dgram.Socket.prototype.connect = deny("datagram.connect");
      dgram.Socket.prototype.bind = deny("datagram.bind");
      globalThis.fetch = deny("fetch");
      globalThis.WebSocket = deny("WebSocket");
      globalThis.__replayPoisonExecuted = false;
      syncBuiltinESMExports();
      const { replayFixtureFile } = await import(${JSON.stringify(pathToFileURL(resolve("packages/eval/src/replay.ts")).href)});
      const first = replayFixtureFile(${JSON.stringify(input.path)});
      const second = replayFixtureFile(${JSON.stringify(input.path)});
      assert.deepEqual(first.output, ${JSON.stringify(expected)});
      assert.equal(JSON.stringify(first), JSON.stringify(second));
      assert.equal(first.sourceTier, "synthetic");
      assert.equal(globalThis.__replayPoisonExecuted, false);
      assert.deepEqual(attempted, []);
      process.stdout.write(JSON.stringify({ result: first.result, sourceTier: first.sourceTier, effects: attempted }));
    `;
    const stripTypes = Number(process.versions.node.split(".")[0]) < 24 ? ["--experimental-strip-types"] : [];
    const result = spawnSync(process.execPath, [...stripTypes, "--input-type=module", "--eval", script],
      { encoding: "utf8", timeout: 15_000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { result: "replay-passed", sourceTier: "synthetic", effects: [] });
    assert.equal(existsSync(marker), false);
    assert.deepEqual(readFileSync(input.path), input.bytes);
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
