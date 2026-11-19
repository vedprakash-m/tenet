import { KernelError } from "../core/errors.ts";
import type { Entry } from "../ports/types.ts";

const malformed = (): never => {
  throw new KernelError("capability-missing", "Git returned malformed index records; no inventory was admitted", { exit: 2 });
};

export function decodeGitOutput(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes); }
  catch { return malformed(); }
}

/** Nonzero stage OIDs are validated transiently, never retained as a stage-zero identity. */
export function parseIndexRecords(value: string | Uint8Array): { entries: Map<string, Entry>; unmerged: Set<string> } {
  const text = typeof value === "string" ? value : decodeGitOutput(value);
  const entries = new Map<string, Entry>(), unmerged = new Set<string>(), seen = new Set<string>();
  if (text && !text.endsWith("\0")) return malformed();
  for (const record of text ? text.slice(0, -1).split("\0") : []) {
    const tab = record.indexOf("\t"), path = record.slice(tab + 1);
    const header = /^(100644|100755|120000|160000) ([a-f0-9]{40}) ([0-3])$/.exec(record.slice(0, tab));
    if (tab < 0 || !header || !path || path.startsWith("/")
      || path.split("/").some(part => !part || part === "." || part === "..")) return malformed();
    const [, mode, blob, stage] = header;
    const key = `${path}\0${stage}`;
    if (seen.has(key) || stage === "0" && unmerged.has(path) || stage !== "0" && entries.has(path)) return malformed();
    seen.add(key);
    if (stage === "0") entries.set(path, { path, mode: mode!, blob: blob! });
    else unmerged.add(path);
  }
  return { entries, unmerged };
}
