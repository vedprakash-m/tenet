import { closeSync, constants, fstatSync, openSync, readSync } from "node:fs";
import { isUtf8 } from "node:buffer";
import { sha256 } from "../core/ids.ts";
import type { ReflogCursorV1 } from "../core/commit-proof.ts";

/** Physical reflog projection v1: ordered old/new OIDs, ordinal selector and raw message, CRLF separated. */
export function reflogCursor(path: string, ref: string): ReflogCursorV1 {
  let fd = -1;
  const unavailable = (reason: string): ReflogCursorV1 => ({ available: false, reason });
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const before = fstatSync(fd);
    if (!before.isFile() || before.size > 1_048_576) return unavailable("reflog absent or exceeds byte bound");
    const bytes = Buffer.alloc(before.size + 1), count = readSync(fd, bytes, 0, bytes.length, 0);
    const after = fstatSync(fd);
    if (count !== before.size || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs)
      return unavailable("reflog changed during read");
    const raw = bytes.subarray(0, count);
    if (!isUtf8(raw) || !raw.length || raw.at(-1) !== 10) return unavailable("reflog incomplete");
    const lines = raw.toString("utf8").replace(/\r\n/g, "\n").slice(0, -1).split("\n");
    if (lines.length > 10_000) return unavailable("reflog exceeds entry bound");
    const projection: string[] = [];
    for (const [index, line] of lines.entries()) {
      const match = /^([a-f0-9]{40}) ([a-f0-9]{40}) (.+)\t(.*)$/.exec(line);
      if (!match) return unavailable("reflog projection unsupported");
      projection.push(JSON.stringify([match[1], match[2], `${ref}@{${lines.length - index - 1}}`, match[3], match[4]]));
    }
    const text = projection.join("\n") + "\n", length = Buffer.byteLength(text);
    if (length > 1_048_576) return unavailable("reflog projection exceeds byte bound");
    return { available: true, ref, bytes: length, entries: lines.length, sha256: sha256(text), git: "physical-reflog-v1" };
  } catch (error) {
    return unavailable(`reflog unreadable: ${(error as NodeJS.ErrnoException).code ?? "unknown"}`);
  } finally { if (fd >= 0) closeSync(fd); }
}
