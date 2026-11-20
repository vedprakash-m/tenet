import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import { MarkerV3 } from "../../src/core/marker-identity.ts";

const [workspace, point] = [process.argv[2]!, process.argv[3]!];
const die = () => process.kill(process.pid, "SIGKILL");
const originalOpen = fs.openSync, originalWrite = fs.writeFileSync, originalSync = fs.fsyncSync;
const originalRename = fs.renameSync;
const descriptors = new Map<number, string>();
const windowsDirectorySync = process.platform === "win32";
const slash = (path: string) => path.replaceAll("\\", "/");
fs.openSync = ((path: fs.PathLike, flags: fs.OpenMode, mode?: number) => {
  const name = slash(String(path));
  if (point === "before-source-create" && name.endsWith(`${"a".repeat(32)}/source.json`)) die();
  const fd = originalOpen(path, flags, mode);
  descriptors.set(fd, name);
  return fd;
}) as typeof fs.openSync;
fs.writeFileSync = ((fd: fs.PathOrFileDescriptor, data: string | NodeJS.ArrayBufferView, options?: unknown) => {
  const path = typeof fd === "number" ? descriptors.get(fd) : slash(String(fd));
  if (point === "source-partial" && path?.endsWith(`${"a".repeat(32)}/source.json`)) die();
  originalWrite(fd, data, options as never);
  if (point === "after-source-write" && path?.endsWith(`${"a".repeat(32)}/source.json`)) die();
}) as typeof fs.writeFileSync;
fs.fsyncSync = (fd) => {
  const path = descriptors.get(fd) && slash(descriptors.get(fd)!);
  try { originalSync(fd); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!windowsDirectorySync || (code !== "EPERM" && code !== "EINVAL") ||
        !fs.fstatSync(fd).isDirectory()) throw error;
  }
  if (point === "after-source-sync" && path?.endsWith(`${"a".repeat(32)}/source.json`)) die();
  if (point === "after-evidence-sync" && path?.endsWith(`${"a".repeat(32)}`)) die();
  if (point === "after-transition-sync" && path?.includes("migration-transition.json.tmp-")) die();
  if (point === "after-object-sync" && path?.includes("migration-snapshot-v3") &&
      path.endsWith(".tmp-" + "a".repeat(32))) die();
  if (point === "after-snapshot-sync" && path?.includes("snapshot.json.tmp-")) die();
};
fs.renameSync = (from, to) => {
  const source = slash(String(from)), target = slash(String(to));
  if (point === "before-transition-rename" && target.endsWith("migration-transition.json")) die();
  originalRename(from, to);
  if (point === "after-transition-rename" && target.endsWith("migration-transition.json")) die();
  if (point === "after-object-rename" && target.includes("migration-snapshot-v3") &&
      source.endsWith(".tmp-" + "a".repeat(32))) die();
  if (point === "after-snapshot-rename" && target.endsWith("snapshot.json")) die();
};
syncBuiltinESMExports();

const { captureCandidateSnapshot } = await import("../../src/adapters/marker-snapshot.ts");
const stat = fs.lstatSync(`${workspace}/.tenet`, { bigint: true });
const qualification = {
  platform: process.platform as "darwin" | "linux" | "win32",
  architecture: process.arch as "arm64" | "x64",
  filesystem: "qualified-test-fs",
  birthTimeSource: "native-birthtime-ns",
} as const;
const binding = {
  status: () => ({ kind: "absent", capabilityHash: "c".repeat(64) } as const),
  create: () => { throw new Error("unexpected key creation"); },
  verify: () => "unavailable" as const,
};
const marker = MarkerV3.parse({
  schema: 3, workspaceId: "ws_bbbbbbbbbb", tag: "bcdf", nonce: "bbbbbbbbbbbb",
  dev: Number(stat.dev), ino: Number(stat.ino),
  identity: {
    kind: "directory-v1", platform: qualification.platform, architecture: qualification.architecture,
    filesystem: qualification.filesystem, dev: String(stat.dev), ino: String(stat.ino),
    birthNs: String(stat.birthtimeNs),
  },
  binding: { kind: "none", reason: "host-storage-verified-absent", capability: "c".repeat(64) },
});
try {
  const result = captureCandidateSnapshot(workspace, {
    operationId: "a".repeat(32),
    ownership: { kind: "attested-v1", digest: "b".repeat(64) },
    marker,
    previousBridgeDigest: "d".repeat(64),
    qualification,
    binding,
  });
  console.log(JSON.stringify({ ok: true, result }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }));
}
