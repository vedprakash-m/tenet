import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import path from "node:path";
import test from "node:test";
import { serveMcp } from "../../dist/mcp/index.js";
import { contextSummary, contextWithFindings } from "../../dist/context/index.js";
import { sectionDigest } from "../../dist/specs/sections.js";

class Output {
  text = "";
  write(value: string | Uint8Array): void {
    this.text += String(value);
  }
}

async function repo(): Promise<{ cwd: string; write(filename: string, text: string): Promise<void> }> {
  const cwd = await mkdtemp(path.join(process.cwd(), ".cp45-mcp-"));
  const value = {
    cwd,
    async write(filename: string, text: string) {
      const target = path.join(cwd, ...filename.split("/"));
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, text);
    },
  };
  await value.write("tenet.yaml", JSON.stringify({
    standard: "0.1.0-alpha.0",
    kit_path: "kit",
    paths: { records: "tenet" },
    level: "observe",
    specs: { id_prefix: "R", documents: [{ path: "intent.md", level: "L1" }] },
  }));
  const body = "- R-1 Retry once. {origin: asked; cites: src/retry.ts:1}\n";
  const digest = sectionDigest(body);
  await value.write("tenet/intent.md", [
    "---",
    "tenet: {spec: 1, doc: intent, level: L1, owner: payments}",
    `sections: {requirements: ${JSON.stringify({
      state: "blessed",
      digest,
      blessed_digest: digest,
      blessed_copy: "tenet/blessed/intent/requirements.md",
      flags: [],
      anchors: {},
    })}}`,
    "---",
    "## Requirements",
    body,
  ].join("\n"));
  await value.write("tenet/blessed/intent/requirements.md", body);
  await value.write("src/retry.ts", "const retry = 1;\n");
  await value.write("tenet/packets/CP-0045-agent-context/packet.yaml", [
    "id: CP-0045",
    'title: "Agent context and MCP"',
    "stage: triage",
    "status: parked",
  ].join("\n"));
  return value;
}

async function session(
  cwd: string,
  requests: unknown[],
): Promise<{ responses: Array<Record<string, unknown>>; stderr: string }> {
  const stdout = new Output();
  const stderr = new Output();
  await serveMcp({
    cwd,
    stdin: Readable.from(requests.map((item) => `${JSON.stringify(item)}\n`)),
    stdout,
    stderr,
    now: () => new Date("2026-11-23T12:00:00Z"),
  });
  return {
    responses: stdout.text.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)),
    stderr: stderr.text,
  };
}

test("serves scripted NDJSON without replies for notifications", async () => {
  const target = await repo();
  try {
    const { responses, stderr } = await session(target.cwd, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-06-18" },
      },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "tenet_context",
          arguments: { paths: ["src/retry.ts"] },
        },
      },
      { jsonrpc: "2.0", method: "example/unknown" },
      { jsonrpc: "2.0", id: 3, method: "example/unknown" },
      { jsonrpc: "2.0", id: 4, method: "ping" },
    ]);
    assert.equal(stderr, "");
    assert.equal(responses.length, 4);
    const initialized = responses[0];
    assert.ok(initialized);
    assert.equal(
      (initialized.result as { protocolVersion: string }).protocolVersion,
      "2025-06-18",
    );
    const contextResponse = responses[1];
    assert.ok(contextResponse);
    const call = contextResponse.result as {
      content: Array<{ type: string; text: string }>;
      structuredContent: { blessed: Array<{ id: string }> };
      isError: boolean;
    };
    assert.equal(call.content[0]?.type, "text");
    assert.match(call.content[0]?.text ?? "", /R-1/);
    assert.equal(call.structuredContent.blessed[0]?.id, "R-1");
    assert.equal(call.isError, false);
    const unknown = responses[2];
    assert.ok(unknown);
    assert.equal((unknown.error as { code: number }).code, -32601);
    assert.deepEqual(responses[3]?.result, {});
    const direct = await contextWithFindings({
      cwd: target.cwd,
      paths: ["src/retry.ts"],
    });
    assert.equal(
      call.content[0]?.text,
      contextSummary(direct.result, direct.findings, direct.validBlessedSections),
    );
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("lists every alpha.0 MCP tool and their schemas", async () => {
  const target = await repo();
  try {
    const { responses } = await session(target.cwd, [
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
    ]);
    const response = responses[0];
    assert.ok(response);
    const tools = (response.result as {
      tools: Array<{ name: string; inputSchema: object; outputSchema: object }>;
    }).tools;
    assert.deepEqual(tools.map((tool) => tool.name), [
      "tenet_context",
      "tenet_check",
      "tenet_status",
      "tenet_next",
      "tenet_propose",
    ]);
    assert.ok(tools.every((tool) => tool.inputSchema && tool.outputSchema));
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("returns status and next actions from the working policy and packet", async () => {
  const target = await repo();
  try {
    const { responses } = await session(target.cwd, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "tenet_status", arguments: { work: "CP-0045" } },
      },
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "tenet_next", arguments: { work: "CP-0045" } },
      },
    ]);
    const statusResponse = responses[0];
    const nextResponse = responses[1];
    assert.ok(statusResponse);
    assert.ok(nextResponse);
    const status = (statusResponse.result as {
      structuredContent: Record<string, unknown>;
    }).structuredContent;
    assert.equal(status.level, "observe");
    assert.equal((status.work as { id: string }).id, "CP-0045");
    const next = (nextResponse.result as {
      structuredContent: { next_actions: unknown[] };
    }).structuredContent;
    assert.deepEqual(next.next_actions, []);
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("writes proposals only inside the named packet folder", async () => {
  const target = await repo();
  try {
    const { responses } = await session(target.cwd, [
      {
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "tenet_propose",
          arguments: {
            kind: "escalation",
            work: "CP-0045",
            payload: { question: "pin the exact output" },
          },
        },
      },
    ]);
    const response = responses[0];
    assert.ok(response);
    const result = (response.result as {
      structuredContent: { path: string };
    }).structuredContent;
    assert.match(result.path, /^tenet\/packets\/CP-0045-agent-context\/proposals\//);
    const saved = JSON.parse(await readFile(path.join(target.cwd, ...result.path.split("/")), "utf8"));
    assert.equal(saved.work, "CP-0045");
    assert.equal(saved.kind, "escalation");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("invalid JSON and invalid tools use standard JSON-RPC errors", async () => {
  const target = await repo();
  const stdout = new Output();
  try {
    await serveMcp({
      cwd: target.cwd,
      stdin: Readable.from([
        "{not json}\n",
        `${JSON.stringify({
          jsonrpc: "2.0",
          id: 9,
          method: "tools/call",
          params: { name: "no-such-tool", arguments: {} },
        })}\n`,
      ]),
      stdout,
      stderr: new Output(),
    });
    const responses = stdout.text.trim().split(/\r?\n/).map((line) => JSON.parse(line));
    assert.equal(responses[0]?.error?.code, -32700);
    assert.equal(responses[0]?.error?.message, "Parse error");
    assert.equal(responses[1]?.error?.code, -32602);
    assert.equal(responses[1]?.error?.message, "Invalid params");
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});

test("all JSON-RPC failures use the standard code-message pairs", async () => {
  const target = await repo();
  try {
    const { responses } = await session(target.cwd, [
      { jsonrpc: "1.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", id: 2, method: "unknown/method" },
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "tenet_context", arguments: { budget_tokens: 0 } },
      },
    ]);
    assert.deepEqual(
      responses.map((response) => response.error),
      [
        { code: -32600, message: "Invalid Request" },
        { code: -32601, message: "Method not found" },
        { code: -32602, message: "Invalid params" },
      ],
    );
  } finally {
    await rm(target.cwd, { recursive: true, force: true });
  }
});
