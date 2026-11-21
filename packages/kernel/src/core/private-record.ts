import { KernelError } from "./errors.ts";

export const MAX_RECORD = 50 * 1024 * 1024;

export function parseRecord(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  checkDepth(parsed, 0);
  return parsed;
}

/** Recursion is safe here: it stops at depth 65. It allocates nothing per value, which matters on long histories (NFR-01).
 *  Returns the number of object keys in the parsed value. */
function checkDepth(value: unknown, depth: number): number {
  if (depth > 64) throw new KernelError("unsupported-record", "a private record exceeds the depth bound");
  if (!value || typeof value !== "object") return 0;
  let keys = 0;
  if (Array.isArray(value)) for (let i = 0; i < value.length; i++) keys += checkDepth(value[i], depth + 1);
  else for (const key in value) keys += 1 + checkDepth((value as Record<string, unknown>)[key], depth + 1);
  return keys;
}

/** Admission must see declarations that JSON.parse discards. Each key in the text becomes one property of its object
 *  unless an earlier key of that object decodes to the same name, so the parsed value has fewer keys than the text
 *  declares exactly when some object repeats a key. Count declarations without reserializing unadmitted private text. */
export function parseUniqueRecord(text: string): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_RECORD) throw new KernelError("unsupported-record", "a private record exceeds the 50 MB bound");
  const parsed: unknown = JSON.parse(text), keys = checkDepth(parsed, 0);
  if (keys !== declaredKeys(text)) {
    throw new KernelError("unsupported-record", "a private record has duplicate keys");
  }
  return parsed;
}

/** Keys declared in valid JSON text: outside strings, a colon appears only between a key and its value. */
function declaredKeys(text: string): number {
  let count = 0, inString = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === 92) escaped = true;
      else if (ch === 34) inString = false;
    } else if (ch === 34) inString = true;
    else if (ch === 58) count++;
  }
  return count;
}
