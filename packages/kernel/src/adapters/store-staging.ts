import { lstatSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import type { State } from "../core/schemas.ts";
import type { LogEntry } from "../ports/types.ts";

export interface LockInfo { pid: number; procStart: string; nonce: string; verb: string }
export type StagedWrite =
  | { kind: "state"; value: State }
  | { kind: "log"; value: LogEntry }
  | { kind: "blob"; hash: string; content: string }
  | { kind: "directory"; path: string }
  | { kind: "artifact"; path: string; content: string }
  | { kind: "purge"; paths: string[] };
export interface WriteContext {
  lock: LockInfo;
  active: boolean;
  creationIdentity?: string;
  reserveAllowed?: boolean;
  committing?: boolean;
  transactional?: boolean;
  staged: StagedWrite[];
}

export function recentWithStaged(disk: LogEntry[], context: WriteContext): LogEntry[] {
  return [...disk, ...context.staged.flatMap(entry => entry.kind === "log" ? [structuredClone(entry.value)] : [])];
}

/** The latest modification time anywhere under a folder. */
export function newestMtime(path: string): number {
  let newest = 0;
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const stat = lstatSync(join(dir, name));
      newest = Math.max(newest, stat.mtimeMs);
      if (stat.isDirectory()) walk(join(dir, name));
    }
  };
  try { newest = lstatSync(path).mtimeMs; walk(path); } catch { /* unreadable: the folder's own time stands */ }
  return newest;
}

export function stagedRunGrowth(context?: WriteContext, extra?: Extract<StagedWrite, { kind: "artifact" }>) {
  const sizes = new Map<string, number>();
  for (const entry of [...(context?.staged ?? []), ...(extra ? [extra] : [])]) {
    if (entry.kind === "artifact") {
      sizes.set(entry.path, Math.max(sizes.get(entry.path) ?? 0, Buffer.byteLength(entry.content, "utf8")));
    }
  }
  let bytes = 0;
  for (const [path, size] of sizes) {
    const current = lstatSync(path, { throwIfNoEntry: false });
    if (current && !current.isFile()) {
      throw new KernelError("storage-accounting-unknown", "a staged artifact is no longer a regular file");
    }
    bytes += Math.max(0, size - (current?.size ?? 0));
  }
  return { paths: [...sizes.keys()], bytes };
}
