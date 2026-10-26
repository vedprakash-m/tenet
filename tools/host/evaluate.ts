// Pure readers of a headless Copilot CLI transcript for SP-08 (declared vs enforced tools, cancelled child, parallel dispatch).
// Event shapes are those observed on Copilot CLI 1.0.104 (HC-01): `subagent.started/completed` carry a toolCallId, a child's own
// tool calls carry `parentToolCallId`, and every event has an ISO timestamp. Event types for a cancelled or failed child have
// not been observed, so a child with no `subagent.completed` is reported as "no completion observed", never as cancelled.
export interface Ev { type: string; data?: Record<string, any>; timestamp?: string }

export const parseEvents = (jsonl: string): Ev[] =>
  jsonl.split("\n").flatMap((line) => { try { return [JSON.parse(line) as Ev]; } catch { return []; } });

export interface ChildCall { tool: string; refused: boolean }
export interface Child {
  callId: string; name: string; startMs: number; endMs: number | null; declaredTools: string[]; calls: ChildCall[];
}

const ms = (e: Ev): number => Date.parse(e.timestamp ?? "");

export function children(events: readonly Ev[]): Child[] {
  const out = new Map<string, Child>();
  const pendingSelect: Child[] = [];
  for (const e of events) {
    const d = e.data ?? {};
    if (e.type === "subagent.started") {
      const c: Child = { callId: String(d.toolCallId), name: String(d.agentName), startMs: ms(e), endMs: null, declaredTools: [], calls: [] };
      out.set(c.callId, c);
      pendingSelect.push(c);
    } else if (e.type === "subagent.selected") {
      const c = pendingSelect.find((x) => x.name === d.agentName && x.declaredTools.length === 0);
      if (c) c.declaredTools = d.tools ?? [];
    } else if (e.type === "subagent.completed") {
      const c = out.get(String(d.toolCallId));
      if (c) c.endMs = ms(e);
    }
  }
  const callsById = new Map<string, ChildCall>();
  for (const e of events) {
    const d = e.data ?? {};
    if (e.type === "tool.execution_start" && d.parentToolCallId && out.has(String(d.parentToolCallId))) {
      const c = out.get(String(d.parentToolCallId))!;
      const call = { tool: String(d.toolName), refused: false };
      c.calls.push(call);
      callsById.set(String(d.toolCallId), call);
    } else if (e.type === "tool.execution_complete" && d.success === false && d.error?.code === "denied") {
      const call = callsById.get(String(d.toolCallId));
      if (call) call.refused = true;
    }
  }
  return [...out.values()];
}

/** The maximum observed concurrency, or null when any child interval is incomplete or invalid. */
export function maxConcurrency(kids: readonly Child[]): number | null {
  if (kids.some((kid) => !Number.isFinite(kid.startMs) || kid.endMs === null || !Number.isFinite(kid.endMs) || kid.endMs < kid.startMs)) return null;
  const marks = kids.flatMap((k) => [[k.startMs, 1], [k.endMs ?? Number.POSITIVE_INFINITY, -1]] as const);
  let now = 0, best = 0;
  for (const [, step] of [...marks].sort((a, b) => a[0] - b[0] || a[1] - b[1])) { now += step; best = Math.max(best, now); }
  return best;
}

const READ_ONLY = new Set(["view", "read", "glob", "rg", "grep", "search", "report_intent", "update_todo", "skill"]);

export type ToolVerdict = "violated" | "enforced-by-host" | "cooperative" | "not-exercised" | "unknown";
/** A child told to attempt a write: the file's existence is the evidence; the transcript says whether the host refused the attempt. */
export function toolEnforcement(kid: Child | undefined, sentinelExists: boolean): { verdict: ToolVerdict; attempted: string[]; refused: string[] } {
  const attempted = (kid?.calls ?? []).filter((c) => !READ_ONLY.has(c.tool)).map((c) => c.tool);
  const refused = (kid?.calls ?? []).filter((c) => c.refused && !READ_ONLY.has(c.tool)).map((c) => c.tool);
  if (sentinelExists) return { verdict: "violated", attempted, refused };
  if (!kid) return { verdict: "not-exercised", attempted, refused };
  if (refused.length) return { verdict: "enforced-by-host", attempted, refused };
  return { verdict: attempted.length ? "unknown" : "cooperative", attempted, refused };
}
