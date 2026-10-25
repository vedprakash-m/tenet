import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { parseEvents, children, maxConcurrency, toolEnforcement } from "../../../tools/host/evaluate.ts";
import { z } from "zod";
import { decodeJson, ProtocolValidationError, readBoundedRegularFile } from "./protocol.ts";

const MAX_FIXTURE_BYTES = 1024 * 1024;
const MAX_EVENTS = 10_000;
const MAX_STRING_BYTES = 4 * 1024;
const ID = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_STRING_BYTES);
const boundedText = z.string().min(1).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_STRING_BYTES);
const timestamp = z.string().datetime({ offset: true }).refine((value) => Buffer.byteLength(value, "utf8") <= MAX_STRING_BYTES && Number.isFinite(Date.parse(value)));
const deniedError = z.strictObject({ code: boundedText });

const Event = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("subagent.started"), timestamp, data: z.strictObject({ toolCallId: ID, agentName: boundedText }) }),
  z.strictObject({ type: z.literal("subagent.selected"), timestamp, data: z.strictObject({ agentName: boundedText, tools: z.array(boundedText).max(100) }) }),
  z.strictObject({ type: z.literal("subagent.completed"), timestamp, data: z.strictObject({ toolCallId: ID }) }),
  z.strictObject({ type: z.literal("tool.execution_start"), timestamp, data: z.strictObject({ toolCallId: ID, toolName: boundedText, parentToolCallId: ID }) }),
  z.strictObject({ type: z.literal("tool.execution_complete"), timestamp, data: z.strictObject({ toolCallId: ID, success: z.boolean(), error: deniedError.optional() }) }),
]);

const ChildCall = z.strictObject({ tool: boundedText, refused: z.boolean() });
const Child = z.strictObject({
  callId: ID, name: boundedText, startMs: z.number().int().safe(), endMs: z.number().int().safe().nullable(),
  declaredTools: z.array(boundedText), calls: z.array(ChildCall),
});
const ToolVerdict = z.strictObject({
  callId: ID, verdict: z.enum(["violated", "enforced-by-host", "cooperative", "not-exercised", "unknown"]),
  attempted: z.array(boundedText), refused: z.array(boundedText),
});
const Expected = z.strictObject({ children: z.array(Child), maxConcurrency: z.number().int().safe().nonnegative().nullable(), toolVerdicts: z.array(ToolVerdict) });
const ReplayFixture = z.strictObject({
  schemaVersion: z.literal(1), fixtureId: ID, sourceTier: z.literal("synthetic"),
  events: z.array(Event).max(MAX_EVENTS), sentinelExists: z.boolean(), expected: Expected,
}).superRefine((fixture, context) => {
  const childIds = new Set<string>();
  const startedNames = new Set<string>();
  const childNameCounts = new Map<string, number>();
  const selectedNames = new Set<string>();
  const toolIds = new Set<string>();
  for (const event of fixture.events) {
    if (event.type === "subagent.started") childNameCounts.set(event.data.agentName, (childNameCounts.get(event.data.agentName) ?? 0) + 1);
  }
  for (const [index, event] of fixture.events.entries()) {
    if (event.type === "subagent.started") {
      if (childIds.has(event.data.toolCallId)) context.addIssue({ code: "custom", path: ["events", index], message: "duplicate child start ID" });
      childIds.add(event.data.toolCallId);
      startedNames.add(event.data.agentName);
    }
    if (event.type === "subagent.selected") {
      if (!startedNames.has(event.data.agentName)) context.addIssue({ code: "custom", path: ["events", index], message: "selection must follow a matching child start" });
      if (childNameCounts.get(event.data.agentName) !== 1) context.addIssue({ code: "custom", path: ["events", index], message: "selection requires a unique child name" });
      if (selectedNames.has(event.data.agentName)) context.addIssue({ code: "custom", path: ["events", index], message: "child selection cannot repeat" });
      selectedNames.add(event.data.agentName);
    }
    if (event.type === "tool.execution_start") {
      if (toolIds.has(event.data.toolCallId)) context.addIssue({ code: "custom", path: ["events", index], message: "duplicate tool start ID" });
      toolIds.add(event.data.toolCallId);
      if (!childIds.has(event.data.parentToolCallId)) context.addIssue({ code: "custom", path: ["events", index], message: "tool parent must start first" });
    }
    if (event.type === "tool.execution_complete" && !toolIds.has(event.data.toolCallId)) {
      context.addIssue({ code: "custom", path: ["events", index], message: "tool completion must follow a start" });
    }
    if (event.type === "subagent.completed" && !childIds.has(event.data.toolCallId)) {
      context.addIssue({ code: "custom", path: ["events", index], message: "child completion must follow a start" });
    }
  }
});

export interface ReplayResult {
  fixtureId: string;
  fixtureSha256: string;
  sourceTier: "synthetic";
  result: "replay-passed";
  output: z.infer<typeof Expected>;
}

export function replayFixtureFile(path: string): ReplayResult {
  const bytes = readBoundedRegularFile(path, MAX_FIXTURE_BYTES);
  const parsed = ReplayFixture.safeParse(decodeJson(bytes));
  if (!parsed.success) throw new ProtocolValidationError("replay-invalid");
  const fixture = parsed.data;
  const jsonl = fixture.events.map((event) => JSON.stringify(event)).join("\n");
  const parsedEvents = parseEvents(jsonl);
  if (parsedEvents.length !== fixture.events.length) throw new ProtocolValidationError("replay-events-invalid");
  const childrenResult = children(parsedEvents);
  const output = {
    children: childrenResult,
    maxConcurrency: maxConcurrency(childrenResult),
    toolVerdicts: childrenResult.map((child) => ({ callId: child.callId, ...toolEnforcement(child, fixture.sentinelExists) })),
  };
  if (!isDeepStrictEqual(output, fixture.expected)) throw new ProtocolValidationError("replay-mismatch");
  return {
    fixtureId: fixture.fixtureId,
    fixtureSha256: createHash("sha256").update(bytes).digest("hex"),
    sourceTier: "synthetic",
    result: "replay-passed",
    output,
  };
}