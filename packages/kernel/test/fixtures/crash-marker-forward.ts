import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";

const [workspace, point] = [process.argv[2]!, process.argv[3]!];
const operationId = "a".repeat(32);
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
const die = () => process.kill(process.pid, "SIGKILL");
const originalOpen = fs.openSync, originalSync = fs.fsyncSync, originalRename = fs.renameSync;
const originalRemove = fs.rmSync;
const descriptors = new Map<number, string>();
const windowsDirectorySync = process.platform === "win32";
const slash = (path: string) => path.replaceAll("\\", "/");
fs.openSync = ((path: fs.PathLike, flags: fs.OpenMode, mode?: number) => {
  const fd = originalOpen(path, flags, mode);
  descriptors.set(fd, slash(String(path)));
  return fd;
}) as typeof fs.openSync;
fs.fsyncSync = (fd) => {
  const path = descriptors.get(fd);
  try { originalSync(fd); }
  catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (!windowsDirectorySync || (code !== "EPERM" && code !== "EINVAL") ||
        !fs.fstatSync(fd).isDirectory()) throw error;
  }
  if (point === "after-marker-file-sync" && path?.endsWith("/.tenet/marker.tmp-" + operationId)) die();
  if (point === "after-state-file-sync" && path?.endsWith("/.tenet/state.tmp-" + operationId)) die();
  if (point === "after-recovery-temp-sync" && path?.endsWith(`migration-recovery-v3.json.tmp-${operationId}`)) die();
};
fs.renameSync = (from, to) => {
  const target = slash(String(to));
  originalRename(from, to);
  if (point === "after-marker-rename" && target.endsWith("/.tenet/marker")) die();
  if (point === "after-state-rename" && target.endsWith("/.tenet/state")) die();
  if (point === "after-recovery-rename" && target.endsWith("/migration-recovery-v3.json")) die();
  if (target.endsWith("/migration-evidence-v2/" + operationId + "/target.json") &&
      point === "after-target-rename") die();
  if (target.endsWith("/migration-evidence-v2/" + operationId + "/evidence.json") &&
      point === "after-evidence-rename") die();
  if (target.endsWith("/.tenet/migration-transition.json")) {
    const phase = JSON.parse(fs.readFileSync(target, "utf8")).phase;
    if (point === `after-${phase}`) die();
  }
};
fs.rmSync = ((path: fs.PathLike, options?: fs.RmOptions) => {
  originalRemove(path, options);
  if (point === "after-transition-removal" && slash(String(path)).endsWith("/migration-transition.json")) die();
}) as typeof fs.rmSync;
syncBuiltinESMExports();

const { publishCandidateTarget } = await import("../../src/adapters/marker-rollback.ts");
try {
  const result = publishCandidateTarget(workspace, {
    operationId,
    state: '{"schema":3,"revision":9,"newer":true}',
    previousBridgeDigest: "d".repeat(64),
    previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
    writes: [
      { path: "state.prev", bytes: '{"schema":3,"revision":8}' },
      { path: "log", bytes: "target log" },
      { path: "target-only", bytes: "remove" },
    ],
    removes: [`blobs/${"d".repeat(64)}`],
    qualification,
    binding,
  });
  console.log(JSON.stringify({ ok: true, result }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : String(error) }));
}
