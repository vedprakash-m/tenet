import { lstatSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { KernelError } from "../core/errors.ts";
import {
  PrivateSnapshotRefV3, PrivateSnapshotRequestV1, P91CompletionWitnessV1,
} from "../core/schemas-migrate.ts";
import type { PrivateSnapshots } from "../ports/private-snapshot.ts";
import { snapshotRefusal } from "./privacy-snapshot-records.ts";

export interface SnapshotSource {
  witness: P91CompletionWitnessV1;
  roots: { store: string; retained?: string };
  members: Array<{ root: "store" | "retained"; path: string; kind: "file" | "directory" | "absent" }>;
}
export interface SnapshotAllocation {
  request: PrivateSnapshotRequestV1; snapshot: PrivateSnapshotRefV3; directory: string;
}
/** P87 owns capacity, private namespace allocation and request/orphan durability. No key operation is implemented here. */
export interface SnapshotStorage {
  admitLockedSource(request: PrivateSnapshotRequestV1): SnapshotSource;
  reserve(request: PrivateSnapshotRequestV1, capacity: bigint): SnapshotAllocation;
  lookup(request: PrivateSnapshotRequestV1, handle: string): SnapshotAllocation | null;
  /** P87's private-object layer copies/pins bytes and identities without exposing them to the caller. */
  capture(allocation: SnapshotAllocation, source: SnapshotSource): PrivateSnapshotRefV3;
  compare(allocation: SnapshotAllocation, source: SnapshotSource): "exact" | "mismatch" | "unknown";
  orphan(request: Omit<PrivateSnapshotRequestV1, "operationId">):
    | { kind: "none" | "conflict" | "unavailable" }
    | { kind: "matching"; allocation: SnapshotAllocation };
  syncDirectory(path: string): void;
}

const reserveFull = (): never => { throw new KernelError("storage-reserve-full", "The private copy set exceeds its reserve."); };
function memberPath(source: SnapshotSource, member: SnapshotSource["members"][number]): string {
  const root = source.roots[member.root];
  if (!root || !isAbsolute(root)) return snapshotRefusal();
  const parts = member.path.split("/");
  if (parts.length > 64 || parts.some(part => Buffer.byteLength(part) > 255) ||
      Buffer.byteLength(join(root, ...parts)) > 4096) return reserveFull();
  if (parts.some(part => !part || part === "." || part === ".." || /[\\:\0]/.test(part)) ||
      /^(?:lock(?:\.|$)|migration-transition\.json|migration-evidence-v2(?:\/|$))/.test(member.path) ||
      /\.tmp-[a-f0-9]{32}$/.test(member.path)) return snapshotRefusal();
  const rootStat = lstatSync(root, { bigint: true });
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return snapshotRefusal();
  let path = root;
  for (const part of parts.slice(0, -1)) {
    path = join(path, part);
    const stat = lstatSync(path, { bigint: true });
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== rootStat.dev) return snapshotRefusal();
  }
  return join(root, ...parts);
}

function memberBytes(
  source: SnapshotSource, member: SnapshotSource["members"][number], paths: Set<string>, identities: Set<string>,
): bigint {
  const path = memberPath(source, member);
  if (paths.has(path)) return snapshotRefusal();
  paths.add(path);
  const stat = lstatSync(path, { bigint: true, throwIfNoEntry: false });
  if (member.kind === "absent") { if (stat) return snapshotRefusal(); return 0n; }
  if (!stat || stat.isSymbolicLink()) return snapshotRefusal();
  const rootStat = lstatSync(source.roots[member.root]!, { bigint: true });
  if (stat.dev !== rootStat.dev) return snapshotRefusal();
  if (member.kind === "directory") { if (!stat.isDirectory()) return snapshotRefusal(); return 0n; }
  if (member.kind !== "file" || !stat.isFile() || stat.nlink !== 1n) return snapshotRefusal();
  const id = `${stat.dev}:${stat.ino}`;
  if (identities.has(id)) return snapshotRefusal();
  identities.add(id);
  if (stat.size > 20_971_520n) return reserveFull();
  return stat.size;
}

function admitSourceRoles(request: PrivateSnapshotRequestV1, source: SnapshotSource): void {
  for (const path of ["state", "state.prev", "marker", "log"])
    if (!source.members.some(member => member.root === "store" && member.path === path && member.kind === "file"))
      return snapshotRefusal();
  if (!source.members.some(member => member.root === "store" && member.path === "summaries.json" &&
      (member.kind === "file" || member.kind === "absent"))) return snapshotRefusal();
  for (const path of ["digest.key", "journal-index.json"])
    if (!source.members.some(member => member.root === "store" && member.path === path && member.kind === "absent"))
      return snapshotRefusal();
  for (const [path, expected] of [
    ["state", request.p91Completion.state.primary], ["state.prev", request.p91Completion.state.previous],
  ] as const) {
    const stat = lstatSync(join(source.roots.store, path), { bigint: true });
    if (!isDeepStrictEqual(expected.identity, { dev: String(stat.dev), ino: String(stat.ino), type: "file", links: 1 }))
      return snapshotRefusal();
  }
}

function sourceCapacity(request: PrivateSnapshotRequestV1, source: SnapshotSource): bigint {
  const witness = P91CompletionWitnessV1.safeParse(source.witness);
  if (!witness.success || !isDeepStrictEqual(witness.data, request.p91Completion)) return snapshotRefusal();
  if (source.members.length > 50_000) return reserveFull();
  const root = lstatSync(source.roots.store, { bigint: true });
  if (!root.isDirectory() || root.isSymbolicLink() || String(root.dev) !== request.storeRoot.dev ||
      String(root.ino) !== request.storeRoot.ino || String(root.birthtimeNs) !== request.storeRoot.birthNs)
    return snapshotRefusal();
  const paths = new Set<string>(), identities = new Set<string>();
  let bytes = 0n;
  for (const member of source.members) {
    bytes += memberBytes(source, member, paths, identities);
    if (bytes > 47_185_920n) return reserveFull();
  }
  admitSourceRoles(request, source);
  return bytes + BigInt(source.members.length) * 512n + 1_048_576n;
}

function admitAllocation(request: PrivateSnapshotRequestV1, value: SnapshotAllocation | null): SnapshotAllocation {
  if (!value || !isDeepStrictEqual(value.request, request)) return snapshotRefusal();
  const snapshot = PrivateSnapshotRefV3.safeParse(value.snapshot);
  if (!snapshot.success) return snapshotRefusal();
  return { ...value, snapshot: snapshot.data };
}

function admittedSource(storage: SnapshotStorage, request: PrivateSnapshotRequestV1): { source: SnapshotSource; capacity: bigint } {
  try {
    const source = storage.admitLockedSource(request);
    return { source, capacity: sourceCapacity(request, source) };
  } catch (error) {
    if (error instanceof KernelError) throw error;
    return snapshotRefusal();
  }
}

export function createPrivateSnapshots(storage: SnapshotStorage): PrivateSnapshots {
  return {
    reserve: input => {
      const request = PrivateSnapshotRequestV1.parse(input), measured = admittedSource(storage, request);
      const allocation = admitAllocation(request, storage.reserve(request, measured.capacity));
      if (allocation.snapshot.capture === "complete" && storage.compare(allocation, measured.source) !== "exact")
        return snapshotRefusal();
      return allocation.snapshot;
    },
    capture: (input, reference) => {
      const request = PrivateSnapshotRequestV1.parse(input), snapshot = PrivateSnapshotRefV3.parse(reference);
      const allocation = admitAllocation(request, storage.lookup(request, snapshot.handle));
      if (allocation.snapshot.handle !== snapshot.handle) return snapshotRefusal();
      const measured = admittedSource(storage, request);
      const captured = PrivateSnapshotRefV3.safeParse(storage.capture(allocation, measured.source));
      if (!captured.success) return snapshotRefusal();
      const result = captured.data;
      if (result.handle !== snapshot.handle || result.capture !== "complete" ||
          storage.compare(allocation, measured.source) !== "exact") return snapshotRefusal();
      return result;
    },
    compare: (input, reference) => {
      try {
        const request = PrivateSnapshotRequestV1.parse(input), snapshot = PrivateSnapshotRefV3.parse(reference);
        const allocation = admitAllocation(request, storage.lookup(request, snapshot.handle));
        if (allocation.snapshot.handle !== snapshot.handle || snapshot.capture !== "complete" ||
            allocation.snapshot.capture !== "complete") return "unknown";
        const { source } = admittedSource(storage, request);
        const result = storage.compare(allocation, source);
        return result === "exact" || result === "mismatch" ? result : "unknown";
      } catch { return "unknown"; }
    },
    orphan: input => {
      const request = PrivateSnapshotRequestV1.omit({ operationId: true }).parse(input);
      const result = storage.orphan(request);
      if (result.kind !== "matching") {
        if (!["none", "conflict", "unavailable"].includes(result.kind) || Object.keys(result).length !== 1)
          return snapshotRefusal();
        return { kind: result.kind };
      }
      const allocation = admitAllocation({ ...request, operationId: result.allocation.request.operationId }, result.allocation);
      admittedSource(storage, allocation.request);
      return { kind: "matching", operationId: allocation.request.operationId, snapshot: allocation.snapshot };
    },
  };
}
