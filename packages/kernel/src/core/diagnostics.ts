import { z } from "zod";
import { redact } from "./redact.ts";
import { WorkState, type State } from "./schemas.ts";
import { CHECK_OUTCOME, TERMINATION } from "./trace.ts";
import type { LogEntry } from "../ports/types.ts";

export const DIAGNOSTICS_BYTES = 4000;
const natural = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Call = z.object({
  verb: z.string(), exit: z.number().int().min(0).max(5), revision: natural,
  t: z.iso.datetime(), durationMs: natural.optional(),
  termination: z.enum(Object.keys(TERMINATION) as [keyof typeof TERMINATION, ...Array<keyof typeof TERMINATION>]).optional(),
  checkOutcome: z.enum(Object.keys(CHECK_OUTCOME) as [keyof typeof CHECK_OUTCOME, ...Array<keyof typeof CHECK_OUTCOME>]).optional(),
});

/** Diagnostics-only additions; ordinary responses retain their existing redaction behavior. */
export function redactDiagnostics(text: string): string {
  return redact(text)
    .replace(/((?:password|passwd|secret|token|credential|api[_-]?key|access[_-]?key|private[_-]?key)["']?\s*[:=]\s*["']?)[^\s"',;]+/gi,
      "$1[redacted]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted email]")
    .replace(/\b[A-Z]:[\\/](?:Users|Documents and Settings)[\\/][^\s"'<>]*/gi, "[redacted personal path]")
    .replace(/\/(?:home|Users)\/[^\s"'<>]*/g, "[redacted personal path]");
}

/** A closed projection, never a copy of state, prompts, journal payloads or host-reported usage. */
export function diagnosticsText(state: State | null, log: readonly LogEntry[], version: string,
  platform: string, verbs: readonly string[]): string {
  const calls: z.infer<typeof Call>[] = [];
  let invalidCalls = 0, totalCalls = 0;
  for (const entry of log) {
    if (entry.kind !== "call") continue;
    totalCalls++;
    const parsed = Call.safeParse(entry);
    if (!parsed.success || !verbs.includes(parsed.data.verb)) { invalidCalls++; continue; }
    calls.push(parsed.data);
    if (calls.length > 20) calls.shift();
  }
  const counts = Object.fromEntries(WorkState.options.map(status =>
    [status, Object.values(state?.work ?? {}).filter(w => w.state === status).length]));
  const projection = {
    format: "tenet-diagnostics-1",
    kernel: { version: redactDiagnostics(version).slice(0, 100), platform: redactDiagnostics(platform).slice(0, 40) },
    state: { initialized: !!state, schema: state?.schema ?? null, revision: state?.revision ?? null, work: counts },
    calls, omitted: { calls: totalCalls - calls.length, invalidCalls, otherRecords: log.length - totalCalls },
    provenance: { kernel: "observed", state: state ? "validated local snapshot" : "absent",
      journal: state ? "validated local snapshot; reduced history is not included" : "absent",
      host: "unknown", model: "unknown", permission: "unknown" },
    redaction: { categories: ["keys", "tokens", "credentials", "personal paths", "emails"],
      limitation: "Heuristic redaction of likely sensitive text, not a guarantee. No upload is performed." },
  };
  let text = redactDiagnostics(JSON.stringify(projection, null, 2)) + "\n";
  while (Buffer.byteLength(text) > DIAGNOSTICS_BYTES && calls.length) {
    calls.shift(); projection.omitted.calls++;
    text = redactDiagnostics(JSON.stringify(projection, null, 2)) + "\n";
  }
  return text;
}
