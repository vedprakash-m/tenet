import { after, test, mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import {
  closeSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { tmp, cleanup } from "./helpers.ts";
import { createPrivateSnapshots } from "../src/adapters/privacy-snapshot-provider.ts";
import type { SnapshotAllocation, SnapshotStorage } from "../src/adapters/privacy-snapshot-provider.ts";
import type { PrivateSnapshotRequestV1 } from "../src/core/schemas-migrate.ts";
import { KernelError } from "../src/core/errors.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
function fixture() {
  const workspace = tmp(), privateRoot = tmp(); roots.push(workspace, privateRoot);
  const dir = join(workspace, ".tenet"); mkdirSync(dir);
  for (const name of ["state", "state.prev", "marker", "log"]) writeFileSync(join(dir, name), `private legacy bytes: ${name}`);
  const identity = (path: string) => {
    const stat = lstatSync(path, { bigint: true });
    return { dev: String(stat.dev), ino: String(stat.ino), type: "file" as const, links: 1 as const };
  };
  const stat = lstatSync(dir, { bigint: true });
  const root = {
    kind: "directory-v1" as const, platform: process.platform as "win32" | "darwin" | "linux",
    architecture: process.arch as "x64" | "arm64", filesystem: "qualified-test-fs",
    dev: String(stat.dev), ino: String(stat.ino), birthNs: String(stat.birthtimeNs),
  };
  const witness = {
    witnessVersion: 1 as const, protocol: "p91-completion-v1" as const, sourceSchema: 2 as const, storeRoot: root,
    marker: { workspaceId: "ws_aaaaaaaaaa", tag: "abcd", nonce: "aaaaaaaaaaaa" },
    state: { primary: { identity: identity(join(dir, "state")), revision: 2 },
      previous: { identity: identity(join(dir, "state.prev")), revision: 1 }, generationSeq: 0, workSeq: 0 },
    fences: { history: "complete" as const, reconstructionPending: false as const,
      p91Transition: "absent" as const, p91Recovery: "absent" as const }, bridgeDigest: "f".repeat(64),
  };
  const request: PrivateSnapshotRequestV1 = {
    operationId: "a".repeat(32), storeRoot: root, p91Completion: witness, copySetVersion: 1,
  };
  const directory = join(privateRoot, "allocation");
  let allocation: SnapshotAllocation | null = null, capacity: bigint | undefined;
  const captured = new Map<string, { bytes: Buffer; identity: ReturnType<typeof identity> }>();
  const storage: SnapshotStorage = {
    admitLockedSource: () => ({
      witness, roots: { store: dir },
      members: [
        ...["state", "state.prev", "marker", "log"].map(path => ({ root: "store" as const, path, kind: "file" as const })),
        ...["digest.key", "summaries.json", "journal-index.json"].map(path =>
          ({ root: "store" as const, path, kind: "absent" as const })),
      ],
    }),
    reserve: (requested, bytes) => {
      capacity = bytes;
      if (allocation) { assert.deepEqual(requested, allocation.request); return allocation; }
      mkdirSync(directory);
      allocation = { request: requested, directory, snapshot: {
        provider: "store-private-snapshot-v1", handle: "opaque private fixture", capture: "reserved", copySetVersion: 1,
      } };
      return allocation;
    },
    lookup: (requested, handle) => allocation && handle === allocation.snapshot.handle &&
      JSON.stringify(requested) === JSON.stringify(allocation.request) ? allocation : null,
    capture: (owned, source) => {
      for (const member of source.members) if (member.kind === "file") {
        const path = join(source.roots[member.root]!, member.path), bytes = readFileSync(path);
        if (!captured.has(member.path)) {
          captured.set(member.path, { bytes, identity: identity(path) });
          writeFileSync(join(owned.directory, `${captured.size}.copy`), bytes);
        }
      }
      allocation!.snapshot = { ...owned.snapshot, capture: "complete" };
      return allocation!.snapshot;
    },
    compare: (_owned, source) => {
      for (const member of source.members) if (member.kind === "file") {
        const old = captured.get(member.path), path = join(source.roots[member.root]!, member.path);
        if (!old || !old.bytes.equals(readFileSync(path)) || JSON.stringify(old.identity) !== JSON.stringify(identity(path)))
          return "mismatch";
      }
      return "exact";
    },
    orphan: () => allocation ? { kind: "matching", allocation } : { kind: "none" },
    // Windows tests observe protocol and exact bytes, not qualified directory fsync.
    syncDirectory: path => {
      if (process.platform !== "win32") {
        const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); }
      }
    },
  };
  return { dir, directory, request, storage, capacity: () => capacity };
}

test("[SEC-11] provider copies private bytes without any hash or legacy serialization and re-admits the same handle", () => {
  const f = fixture();
  const hash = mock.method(crypto, "createHash", () => assert.fail("private source reached hashing"));
  const stringify = JSON.stringify.bind(JSON);
  const json = mock.method(JSON, "stringify", (...args: Parameters<typeof JSON.stringify>) => {
    const result = stringify(...args);
    if (result?.includes("private legacy bytes")) assert.fail("legacy source was serialized");
    return result;
  });
  syncBuiltinESMExports();
  try {
    const provider = createPrivateSnapshots(f.storage), reserved = provider.reserve(f.request);
    assert.equal(reserved.capture, "reserved");
    assert.equal(f.capacity(), BigInt(["state", "state.prev", "marker", "log"]
      .reduce((sum, name) => sum + readFileSync(join(f.dir, name)).length, 0)) + 7n * 512n + 1048576n);
    const complete = provider.capture(f.request, reserved);
    assert.equal(complete.capture, "complete");
    assert.equal(complete.handle, reserved.handle);
    assert.equal(provider.compare(f.request, complete), "exact");
    const restarted = createPrivateSnapshots(f.storage);
    assert.deepEqual(restarted.reserve(f.request), complete);
    assert.equal(restarted.compare(f.request, complete), "exact");
    assert.equal(hash.mock.callCount(), 0);
    assert.equal(JSON.stringify(complete).includes("private legacy bytes"), false);
  } finally { hash.mock.restore(); json.mock.restore(); syncBuiltinESMExports(); }
});

test("[CON-03] same-inode changed bytes and different-inode equal bytes never compare exact", () => {
  for (const replace of [false, true]) {
    const f = fixture(), provider = createPrivateSnapshots(f.storage);
    const complete = provider.capture(f.request, provider.reserve(f.request)), path = join(f.dir, "log");
    if (replace) { renameSync(path, join(f.dir, "old-log")); writeFileSync(path, "private legacy bytes: log"); }
    else writeFileSync(path, "private legacy bytes: LOG");
    assert.notEqual(provider.compare(f.request, complete), "exact");
    assert.notEqual(createPrivateSnapshots(f.storage).compare(f.request, complete), "exact");
  }
});

test("[CON-08] capacity refusal and undeclared source paths allocate no private handle", () => {
  const f = fixture(); f.storage.reserve = () => { throw new KernelError("storage-reserve-full", "fixture"); };
  assert.throws(() => createPrivateSnapshots(f.storage).reserve(f.request), KernelError);
  assert.equal(readdirSync(join(f.directory, "..")).length, 0);
  const admit = f.storage.admitLockedSource;
  f.storage.admitLockedSource = request => {
    const source = admit(request);
    source.members.push({ root: "store", path: "../outside", kind: "file" });
    return source;
  };
  assert.throws(() => createPrivateSnapshots(f.storage).reserve(f.request), KernelError);
  assert.equal(readdirSync(join(f.directory, "..")).length, 0);
});

test("[CON-03] replayed complete reservations refuse changed private source equality", () => {
  const f = fixture(), provider = createPrivateSnapshots(f.storage);
  provider.capture(f.request, provider.reserve(f.request));
  writeFileSync(join(f.dir, "log"), "private legacy bytes: LOG");
  assert.throws(() => provider.reserve(f.request), KernelError);
});

test("[CON-03] comparison never accepts another allocation's opaque handle", () => {
  const f = fixture(), provider = createPrivateSnapshots(f.storage);
  const complete = provider.capture(f.request, provider.reserve(f.request));
  f.storage.lookup = () => ({
    request: f.request, directory: f.directory, snapshot: { ...complete, handle: "different fixture handle" },
  });
  assert.equal(provider.compare(f.request, complete), "unknown");
});

test("[SEC-11] invalid capture metadata refuses without disclosing foreign private fields", () => {
  const f = fixture(), provider = createPrivateSnapshots(f.storage), reserved = provider.reserve(f.request);
  f.storage.capture = () => ({
    ...reserved, capture: "complete", private_inventory_sentinel: "synthetic private provider data",
  });
  assert.throws(() => provider.capture(f.request, reserved), (error: unknown) =>
    error instanceof KernelError && !error.message.includes("private_inventory_sentinel"));
});
