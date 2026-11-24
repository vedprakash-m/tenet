import { readFileSync } from "node:fs";
import { mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { writeAtomic } from "../core/fs.js";
import { git } from "../core/git.js";
import { ulid } from "../core/hash.js";
import { message } from "../core/messages.js";
import { fail, version } from "../core/output.js";
import {
  contextSummary,
  contextWithFindings,
  specificationStates,
  type ContextInput,
} from "../context/index.js";
import { check } from "../specs/check.js";

export type McpIo = {
  cwd?: string;
  args?: string[];
  stdin?: NodeJS.ReadableStream;
  stdout?: { write(value: string | Uint8Array): unknown };
  stderr?: { write(value: string | Uint8Array): unknown };
  now?: () => Date;
};

type JsonRpcId = string | number | null;
type JsonObject = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: JsonObject;
  outputSchema: JsonObject;
};

type WorkState = {
  id: string;
  title: string | null;
  stage: string | null;
  status: string | null;
};

const supportedProtocols = new Set(["2025-11-25", "2025-06-18"]);
const schemaRoot = fileURLToPath(new URL("../../kit/schemas/results/", import.meta.url));

function jsonSchema(filename: string): JsonObject {
  return JSON.parse(readFileSync(path.join(schemaRoot, filename), "utf8")) as JsonObject;
}

const contextSchema = jsonSchema("context.json");
const checkSchema = jsonSchema("check.json");
const mcpSchema = jsonSchema("mcp.json");
const definitions = (
  mcpSchema.$defs && typeof mcpSchema.$defs === "object" && !Array.isArray(mcpSchema.$defs)
    ? mcpSchema.$defs
    : {}
) as Record<string, unknown>;

function definition(name: string): JsonObject {
  const value = definitions[name];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`MCP result schema is missing ${name}`);
  }
  return value as JsonObject;
}

const tools: Tool[] = [
  {
    name: "tenet_context",
    description: "Select blessed specification context for paths, IDs, or a query.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        paths: { type: "array", items: { type: "string" } },
        ids: { type: "array", items: { type: "string" } },
        query: { type: "string" },
        include_drafts: { type: "boolean" },
        budget_tokens: { type: "integer", minimum: 1 },
      },
    },
    outputSchema: contextSchema,
  },
  {
    name: "tenet_check",
    description: "Check specification structure and integrity.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        paths: { type: "array", items: { type: "string" } },
      },
    },
    outputSchema: checkSchema,
  },
  {
    name: "tenet_status",
    description: "Report the policy level, specification states, and an optional work item state.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { work: { type: "string" } },
    },
    outputSchema: definition("status"),
  },
  {
    name: "tenet_next",
    description: "List pending specification blessings and the next actions.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: { work: { type: "string" } },
    },
    outputSchema: definition("next"),
  },
  {
    name: "tenet_propose",
    description: "Write an acceptance or escalation proposal into a work item packet.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        kind: { enum: ["acceptance", "escalation"] },
        work: { type: "string" },
        payload: {},
      },
      required: ["kind", "work", "payload"],
    },
    outputSchema: definition("propose"),
  },
];

function object(value: unknown): JsonObject | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function hasId(request: JsonObject): boolean {
  return Object.hasOwn(request, "id");
}

function errorResponse(id: JsonRpcId, code: number, message: string): JsonObject {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function resultResponse(id: JsonRpcId, result: unknown): JsonObject {
  return { jsonrpc: "2.0", id, result };
}

function line(io: { stdout: { write(value: string | Uint8Array): unknown } }, value: unknown): void {
  io.stdout.write(`${JSON.stringify(value)}\n`);
}

function validateStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${field} must be an array of strings`);
  }
  return value as string[];
}

function parseContextArguments(value: unknown, cwd: string): ContextInput {
  const args = object(value) ?? {};
  const paths = validateStringArray(args.paths, "paths");
  const ids = validateStringArray(args.ids, "ids");
  if (args.query !== undefined && typeof args.query !== "string") throw new Error("query must be a string");
  if (args.include_drafts !== undefined && typeof args.include_drafts !== "boolean") {
    throw new Error("include_drafts must be a boolean");
  }
  if (args.budget_tokens !== undefined &&
    (typeof args.budget_tokens !== "number" ||
      !Number.isFinite(args.budget_tokens) ||
      args.budget_tokens <= 0)
  ) {
    throw new Error("budget_tokens must be positive and finite");
  }
  for (const key of Object.keys(args)) {
    if (!["paths", "ids", "query", "include_drafts", "budget_tokens"].includes(key)) {
      throw new Error(`unknown context argument: ${key}`);
    }
  }
  return {
    cwd,
    ...(paths ? { paths } : {}),
    ...(ids ? { ids } : {}),
    ...(typeof args.query === "string" ? { query: args.query } : {}),
    ...(typeof args.include_drafts === "boolean" ? { include_drafts: args.include_drafts } : {}),
    ...(typeof args.budget_tokens === "number" ? { budget_tokens: args.budget_tokens } : {}),
  };
}

async function packet(
  cwd: string,
  work: string,
): Promise<{ path: string; directory: string; state: WorkState }> {
  const { policy } = await specificationStates(cwd);
  const packets = path.join(cwd, ...policy.paths.records.split("/"), "packets");
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(packets, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new Error(`unknown work item: ${work}`);
    throw error;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const filename = path.join(packets, entry.name, "packet.yaml");
    let raw: string;
    try {
      raw = await readFile(filename, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    const data = parse(raw) as JsonObject;
    if (typeof data.id !== "string" || data.id !== work) continue;
    const relative = portableRelative(cwd, filename);
    return {
      path: relative,
      directory: path.dirname(filename),
      state: {
        id: data.id,
        title: typeof data.title === "string" ? data.title : null,
        stage: typeof data.stage === "string" ? data.stage : null,
        status: typeof data.status === "string" ? data.status : null,
      },
    };
  }
  throw new Error(`unknown work item: ${work}`);
}

function portableRelative(root: string, filename: string): string {
  return path.relative(root, filename).replaceAll("\\", "/");
}

async function statusTool(cwd: string, args: JsonObject): Promise<JsonObject> {
  const { policy, specs } = await specificationStates(cwd);
  const result: JsonObject = { level: policy.level, specs };
  if (args.work !== undefined) {
    if (typeof args.work !== "string" || args.work.length === 0) throw new Error("work must be a string");
    result.work = (await packet(cwd, args.work)).state;
  }
  for (const key of Object.keys(args)) {
    if (key !== "work") throw new Error(`unknown status argument: ${key}`);
  }
  return result;
}

async function nextTool(cwd: string, args: JsonObject): Promise<JsonObject> {
  if (args.work !== undefined) {
    if (typeof args.work !== "string" || args.work.length === 0) throw new Error("work must be a string");
    await packet(cwd, args.work);
  }
  for (const key of Object.keys(args)) {
    if (key !== "work") throw new Error(`unknown next argument: ${key}`);
  }
  const { specs } = await specificationStates(cwd);
  const nextActions = specs
    .filter((spec) => spec.state === "draft" || spec.state === "deferred")
    .map((spec) => ({
      who: "Owner",
      action: "bless",
      reason: `${spec.path}#${spec.section} is ${spec.state}`,
      command: "tenet bless",
      path: spec.path,
      section: spec.section,
    }));
  return { next_actions: nextActions };
}

async function proposeTool(
  cwd: string,
  args: JsonObject,
  now: () => Date,
): Promise<{ path: string }> {
  for (const key of Object.keys(args)) {
    if (!["kind", "work", "payload"].includes(key)) throw new Error(`unknown propose argument: ${key}`);
  }
  if (args.kind !== "acceptance" && args.kind !== "escalation") {
    throw new Error("kind must be acceptance or escalation");
  }
  if (typeof args.work !== "string" || args.work.length === 0) throw new Error("work must be a string");
  if (!Object.hasOwn(args, "payload")) throw new Error("payload is required");
  const found = await packet(cwd, args.work);
  const proposals = path.join(found.directory, "proposals");
  await mkdir(proposals, { recursive: true });
  const timestamp = now();
  const filename = path.join(proposals, `${ulid(timestamp)}.json`);
  const relative = portableRelative(cwd, filename);
  await writeAtomic(filename, `${JSON.stringify({
    kind: args.kind,
    work: args.work,
    payload: args.payload,
  }, null, 2)}\n`);
  try {
    await git(["add", "--", relative], { cwd });
    const commitEnv: NodeJS.ProcessEnv = {
      GIT_AUTHOR_NAME: "Tenet",
      GIT_AUTHOR_EMAIL: "tenet@localhost",
      GIT_COMMITTER_NAME: "Tenet",
      GIT_COMMITTER_EMAIL: "tenet@localhost",
      GIT_AUTHOR_DATE: timestamp.toISOString(),
      GIT_COMMITTER_DATE: timestamp.toISOString(),
    };
    await git(
      [
        "commit",
        "--only",
        "--no-verify",
        "--no-gpg-sign",
        "-m",
        `tenet: propose ${args.kind} for ${args.work}`,
        "--",
        relative,
      ],
      { cwd, env: commitEnv },
    );
  } catch (error) {
    try {
      await git(["reset", "--quiet", "--", relative], { cwd });
    } catch {
      // Preserve the original commit failure.
    }
    try {
      await rm(filename, { force: true });
    } catch {
      // Preserve the original commit failure.
    }
    throw error;
  }
  return { path: relative };
}

function textForResult(name: string, result: JsonObject): string {
  if (name === "tenet_context") return JSON.stringify(result);
  if (name === "tenet_check") return "Tenet check completed.";
  return `${JSON.stringify(result, null, 2)}\n`;
}

async function callTool(
  cwd: string,
  name: string,
  rawArguments: unknown,
  now: () => Date,
): Promise<{ text: string; result: JsonObject }> {
  const args = rawArguments === undefined ? {} : object(rawArguments);
  if (args === null) throw new Error("arguments must be an object");
  if (name === "tenet_context") {
    const details = await contextWithFindings(parseContextArguments(args, cwd));
    return {
      text: contextSummary(details.result, details.findings, details.validBlessedSections),
      result: details.result as unknown as JsonObject,
    };
  }
  if (name === "tenet_check") {
    for (const key of Object.keys(args)) if (key !== "paths") throw new Error(`unknown check argument: ${key}`);
    const paths = validateStringArray(args.paths, "paths");
    const result = await check({ cwd, ...(paths ? { paths } : {}) });
    return { text: textForResult(name, result as unknown as JsonObject), result: result as unknown as JsonObject };
  }
  if (name === "tenet_status") {
    const result = await statusTool(cwd, args);
    return { text: textForResult(name, result), result };
  }
  if (name === "tenet_next") {
    const result = await nextTool(cwd, args);
    return { text: textForResult(name, result), result };
  }
  if (name === "tenet_propose") {
    const result = await proposeTool(cwd, args, now);
    return { text: textForResult(name, result), result };
  }
  throw new Error(`unknown tool: ${name}`);
}

async function request(
  value: unknown,
  io: Required<Pick<McpIo, "cwd" | "stdout">> & McpIo,
): Promise<JsonObject | null> {
  const requestValue = object(value);
  if (!requestValue) return errorResponse(null, -32600, "Invalid Request");
  const id: JsonRpcId = hasId(requestValue) &&
    (typeof requestValue.id === "string" || typeof requestValue.id === "number" || requestValue.id === null)
    ? requestValue.id as JsonRpcId
    : null;
  if (
    requestValue.jsonrpc !== "2.0" ||
    typeof requestValue.method !== "string" ||
    (hasId(requestValue) && id === null && requestValue.id !== null)
  ) {
    return hasId(requestValue) ? errorResponse(id, -32600, "Invalid Request") : null;
  }
  if (!hasId(requestValue)) return null;

  if (requestValue.method === "initialize") {
    const params = object(requestValue.params);
    const requested = typeof params?.protocolVersion === "string" ? params.protocolVersion : "";
    return resultResponse(id, {
      protocolVersion: supportedProtocols.has(requested) ? requested : "2025-11-25",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "tenet", version },
    });
  }
  if (requestValue.method === "ping") return resultResponse(id, {});
  if (requestValue.method === "tools/list") return resultResponse(id, { tools });
  if (requestValue.method === "tools/call") {
    const params = object(requestValue.params);
    if (!params || typeof params.name !== "string") return errorResponse(id, -32602, "Invalid params");
    try {
      const { text, result } = await callTool(
        io.cwd,
        params.name,
        params.arguments,
        io.now ?? (() => new Date()),
      );
      return resultResponse(id, {
        content: [{ type: "text", text }],
        structuredContent: result,
        isError: false,
      });
    } catch {
      return errorResponse(id, -32602, "Invalid params");
    }
  }
  return errorResponse(id, -32601, "Method not found");
}

export async function serveMcp(input: McpIo = {}): Promise<void> {
  const io = {
    cwd: path.resolve(input.cwd ?? process.cwd()),
    stdin: input.stdin ?? process.stdin,
    stdout: input.stdout ?? process.stdout,
    ...input,
  } as Required<Pick<McpIo, "cwd" | "stdin" | "stdout">> & McpIo;
  if (io.stdout === io.stderr) {
    const words = message("TN-USAGE-MCP", {
      command: "mcp",
      detail: "the MCP protocol cannot share its stdout stream with --json",
    });
    throw fail("TN-USAGE-MCP", words.message, words.fix);
  }
  const marker = process.argv.indexOf("mcp");
  const args = input.args ?? (marker < 0 ? [] : cliPositionals(process.argv.slice(marker + 1)));
  if (args.length > 0) {
    const words = message("TN-USAGE-MCP", {
      command: "mcp",
      detail: `unexpected positional arguments: ${args.join(", ")}`,
    });
    throw fail("TN-USAGE-MCP", words.message, words.fix);
  }
  const lines = createInterface({ input: io.stdin, crlfDelay: Infinity });
  for await (const source of lines) {
    if (source.trim() === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(source);
    } catch {
      line(io, errorResponse(null, -32700, "Parse error"));
      continue;
    }
    const response = await request(parsed, io);
    if (response) line(io, response);
  }
}

function cliPositionals(argv: string[]): string[] {
  const positionals: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index] ?? "";
    if (value === "--cwd") {
      index += 1;
    } else if (
      value !== "--json" &&
      value !== "--quiet" &&
      value !== "--verbose" &&
      value !== "--offline" &&
      !value.startsWith("--cwd=")
    ) {
      positionals.push(value);
    }
  }
  return positionals;
}
