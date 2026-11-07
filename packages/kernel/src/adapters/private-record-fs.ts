import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import type { Stats } from "node:fs";
import { isUtf8 } from "node:buffer";
import { KernelError } from "../core/errors.ts";

export const MAX_RECORD = 50 * 1024 * 1024;

export function parseRecord(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  const pending: Array<[unknown, number]> = [[parsed, 0]];
  while (pending.length) {
    const [value, depth] = pending.pop()!;
    if (depth > 64) throw new KernelError("unsupported-record", "a private record exceeds the depth bound");
    if (value && typeof value === "object") for (const item of Object.values(value)) pending.push([item, depth + 1]);
  }
  return parsed;
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
    return text === null ? null : parseRecord(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    if (marker) throw new KernelError("marker-mismatch", "the ownership marker cannot be read safely");
    throw new KernelError("unsupported-record", `unsupported private record: ${error instanceof Error ? error.message : "unsafe read"}`);
  }
}
