import { KernelError } from "./errors.ts";

export const MAX_RECORD = 50 * 1024 * 1024;

export function parseRecord(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  checkDepth(parsed, 0);
  return parsed;
}

/** Returns the parsed key count; recursion stops at depth 65. */
function checkDepth(value: unknown, depth: number): number {
  if (depth > 64) throw new KernelError("unsupported-record", "a private record exceeds the depth bound");
  if (!value || typeof value !== "object") return 0;
  let keys = 0;
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) keys += checkDepth(value[i], depth + 1);
  else for (const key in value) keys += 1 + checkDepth((value as Record<string, unknown>)[key], depth + 1);
  return keys;
}

/** Duplicate decoded keys are visible only before JSON.parse discards them. */
export function parseUniqueRecord(text: string): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_RECORD) {
    throw new KernelError("unsupported-record", "a private record exceeds the 50 MB bound");
  }
  const parsed: unknown = JSON.parse(text), keys = checkDepth(parsed, 0);
  if (JSON.stringify(parsed) !== text && keys !== declaredKeys(text)) {
    throw new KernelError("unsupported-record", "a private record has duplicate keys");
  }
  return parsed;
}

function declaredKeys(text: string): number {
  let count = 0, colon = text.indexOf(":"), slash = text.indexOf("\\");
  for (let i = 0; ;) {
    const open = text.indexOf('"', i), stop = open === -1 ? text.length : open;
    for (; colon !== -1 && colon < stop; colon = text.indexOf(":", colon + 1)) if (colon >= i) count++;
    if (open === -1) return count;
    let close = text.indexOf('"', open + 1);
    if (slash !== -1 && slash <= open) slash = text.indexOf("\\", open + 1);
    if (slash !== -1 && slash < close) {
      for (close = open + 1; text.charCodeAt(close) !== 34; close += text.charCodeAt(close) === 92 ? 2 : 1);
    }
    i = close + 1;
  }
}
