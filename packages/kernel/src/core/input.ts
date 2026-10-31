// Bound the complete transport body before any schema traversal or persistent operation (TS §6.1, §11.2).
import { redact, redactDeep } from "./redact.ts";

/** Free-text requests/quotes are redacted. Other structured input must use placeholders, never silently changed semantics. */
export function recordInput(value: Record<string, unknown>): Record<string, unknown> | null {
  const input = Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key, (key === "quote" || key === "request") && typeof item === "string" ? redact(item) : item,
  ]));
  const text = JSON.stringify(input);
  return JSON.stringify(redactDeep(input)) === text && redact(text) === text ? input : null;
}

export function inputProblem(value: unknown): string | undefined {
  const pending: Array<[unknown, number]> = [[value, 0]], seen = new Set<object>();
  let nodes = 0, bytes = 0;
  while (pending.length) {
    const [v, depth] = pending.pop()!;
    if (depth > 64) return "input exceeds depth 64";
    if (++nodes > 100_000) return "input has too many values";
    if (typeof v === "string") bytes += Buffer.byteLength(v);
    if (bytes > 1024 * 1024) return "input exceeds 1 MB";
    if (v && typeof v === "object") {
      if (seen.has(v)) return "input must be an acyclic JSON value";
      seen.add(v);
      for (const [key, item] of Object.entries(v)) { bytes += Buffer.byteLength(key); pending.push([item, depth + 1]); }
    }
  }
  try { if (Buffer.byteLength(JSON.stringify(value) ?? "null") > 1024 * 1024) return "input exceeds 1 MB"; }
  catch { return "input must be a JSON value"; }
  return undefined;
}
