import { lstatSync } from "node:fs";
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
