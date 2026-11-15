import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import type { Stats } from "node:fs";
import { isUtf8 } from "node:buffer";
import { KernelError } from "../core/errors.ts";
import { Terminal } from "../core/migration-terminal.ts";

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
 *  declares exactly when some object repeats a key. Text the kernel wrote is the serialization of its parsed value,
 *  which never repeats a key, so that comparison settles the common case without scanning the text. */
export function parseUniqueRecord(text: string): unknown {
  if (Buffer.byteLength(text, "utf8") > MAX_RECORD) throw new KernelError("unsupported-record", "a private record exceeds the 50 MB bound");
  const parsed: unknown = JSON.parse(text), keys = checkDepth(parsed, 0);
  if (JSON.stringify(parsed) !== text && keys !== declaredKeys(text)) {
    throw new KernelError("unsupported-record", "a private record has duplicate keys");
  }
  return parsed;
}

/** Keys declared in valid JSON text: outside strings, a colon appears only between a key and its value. */
function declaredKeys(text: string): number {
  let count = 0, colon = text.indexOf(":"), slash = text.indexOf("\\");
  for (let i = 0; ;) {
    const open = text.indexOf('"', i), stop = open === -1 ? text.length : open;
    // `colon` and `slash` only move forward, so the whole scan stays linear in the text.
    for (; colon !== -1 && colon < stop; colon = text.indexOf(":", colon + 1)) if (colon >= i) count++;
    if (open === -1) return count;
    let close = text.indexOf('"', open + 1);
    if (slash !== -1 && slash <= open) slash = text.indexOf("\\", open + 1);
    if (slash !== -1 && slash < close) { // an escape before that quote: walk the string to its real end
      for (close = open + 1; text.charCodeAt(close) !== 34; close += text.charCodeAt(close) === 92 ? 2 : 1);
    }
    i = close + 1;
  }
}

export function readTerminal(path: string): Terminal | null {
  const text = readRecord(path);
  if (text === null) return null;
  try { return Terminal.parse(parseUniqueRecord(text)); }
  catch { throw new KernelError("unsupported-record", "the migration terminal record is invalid"); }
}

function matchesRead(fd: number, content: Buffer, stamp: Stats): boolean {
  const chunk = Buffer.alloc(Math.min(64 * 1024, content.length + 1));
  let offset = 0;
  for (;;) {
    const count = readSync(fd, chunk, 0, Math.min(chunk.length, content.length - offset + 1), offset);
    if (!count) break;
    if (offset + count > content.length || !chunk.subarray(0, count).equals(content.subarray(offset, offset + count))) return false;
    offset += count;
  }
  const after = fstatSync(fd);
  return offset === content.length && after.size === stamp.size && after.mtimeMs === stamp.mtimeMs && after.ctimeMs === stamp.ctimeMs;
}

export function readRecord(path: string, journal = false, corruptAsNull = false): string | null {
  let descriptor = -1;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(descriptor);
    if (!info.isFile() || info.size > MAX_RECORD) {
      throw new KernelError("unsupported-record", "a private record is not a regular file within the 50 MB bound");
    }
    const buffer = Buffer.alloc(info.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (!count) break;
      offset += count;
    }
    const after = fstatSync(descriptor);
    if (offset !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs) {
      throw new KernelError("unsupported-record", "a private record changed during its bounded read");
    }
    const content = buffer.subarray(0, offset);
    if (after.ctimeMs !== info.ctimeMs && !matchesRead(descriptor, content, after)) {
      throw new KernelError("unsupported-record", "a private record changed during its bounded read");
    }
    if (!isUtf8(journal ? content.subarray(0, content.lastIndexOf(0x0a) + 1) : content)) {
      if (corruptAsNull) return null;
      throw new KernelError("unsupported-record", "a private record contains invalid UTF-8");
    }
    return content.toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof KernelError) throw error;
    throw new KernelError("unsupported-record", "a private record cannot be read safely");
  } finally { if (descriptor >= 0) closeSync(descriptor); }
}

export const readJson = <T>(path: string): T | null => {
  try {
    const text = readRecord(path);
    return text === null ? null : parseRecord(text) as T;
  } catch { return null; }
};

export function admissionRecord(path: string, marker = false): unknown {
  try {
    const text = readRecord(path, false, true);
    return text === null ? null : parseUniqueRecord(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    if (marker) throw new KernelError("marker-mismatch", "the ownership marker cannot be read safely");
    throw new KernelError("unsupported-record", `unsupported private record: ${error instanceof Error ? error.message : "unsafe read"}`);
  }
}
