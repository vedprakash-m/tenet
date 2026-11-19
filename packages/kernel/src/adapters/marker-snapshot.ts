import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import { MarkerV3 } from "../core/marker-identity.ts";
import { sameDirectoryIdentity } from "../core/marker-identity.ts";
import type { DirectoryIdentity } from "../core/marker-identity.ts";
import {
  MarkerTransitionV3,
  RollbackSetManifestV2,
  RollbackSourceSnapshotV3,
} from "../core/marker-transition.ts";
import type {
  RollbackSetEntryV2,
  RollbackSnapshotEntryV3,
} from "../core/marker-transition.ts";
import { parseUniqueRecord, readRecord } from "./private-record-fs.ts";
import { readQualifiedDirectoryIdentity } from "./marker-identity-fs.ts";
import type { IdentityQualification } from "./marker-identity-fs.ts";
import { verifyCandidateMarker } from "./marker-binding.ts";
import type { MarkerBindingPort } from "../ports/types.ts";
import { withCandidateLocks } from "./marker-lock.ts";

const SHA = /^[a-f0-9]{64}$/;
const OPERATION = /^[0-9a-f]{32}$/;
const REQUIRED = ["marker", "state", "state.prev", "log", "summaries.json"];
const MAX_ENTRIES = 10_000;
type CandidateOptions = {
  operationId: string;
  ownership: { kind: "attested-v1"; digest: string };
  marker: MarkerV3;
  previousBridgeDigest: string;
  qualification: IdentityQualification;
  binding: MarkerBindingPort;
};
export type InventoryEntry = RollbackSetEntryV2 & { bytes?: Buffer };

const refuse = (detail: string): never => {
  throw new KernelError("unsupported-record", `candidate source snapshot refused: ${detail}`, { exit: 4 });
};

export function syncCandidateDirectory(path: string): void {
  const fd = openSync(path, "r");
  try {
    try { fsyncSync(fd); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EINVAL")) throw error;
    }
  } finally { closeSync(fd); }
}

export function writeCandidateFile(path: string, bytes: Buffer, exclusive = false): void {
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW |
    (exclusive ? constants.O_EXCL : constants.O_TRUNC);
  const fd = openSync(path, flags, 0o600);
  try {
    writeFileSync(fd, bytes);
    fchmod(fd);
  } finally { closeSync(fd); }
}

export function syncCandidateFile(path: string): void {
  const fd = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

function fchmod(fd: number): void {
  const stat = fstatSync(fd);
  if (!stat.isFile()) refuse("a private snapshot path is not a regular file");
  fsyncSync(fd);
}

export function canonicalCandidateRecord(value: unknown): string { return stableStringify(value); }

function modeOf(path: string): string { return (lstatSync(path).mode & 0o7777).toString(8); }

function excluded(path: string, operationId: string): boolean {
  return path === "migration-transition.json" ||
    path === `migration-transition.json.tmp-${operationId}` ||
    path === "migration-recovery-v3.json" ||
    path.startsWith(`migration-recovery-v3.json.tmp-${operationId}`) ||
    path === "migration-terminal.json" ||
    path === `migration-evidence-v2/${operationId}` ||
    path.startsWith(`migration-evidence-v2/${operationId}/`) ||
    path === `migration-snapshot-v3/${operationId}` ||
    path.startsWith(`migration-snapshot-v3/${operationId}/`) ||
    path === `migration-rollback-v3/${operationId}` ||
    path.startsWith(`migration-rollback-v3/${operationId}/`) ||
    /^(?:lock|lock\.break)(?:\.|$)/.test(path) ||
    /^quarantine-bootstrap-[^.]+\.lock(?:\.|$)/.test(path);
}

export function inventoryCandidate(root: string, operationId: string): InventoryEntry[] {
  const out: InventoryEntry[] = [];
  const visit = (relative: string, absolute: string): void => {
    if (excluded(relative, operationId)) return;
    if (["migration-evidence-v2", "migration-snapshot-v3", "migration-rollback-v3"].includes(relative) &&
        readdirSync(absolute).every((name) => name === operationId)) return;
    const stat = lstatSync(absolute);
    if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory())) {
      refuse(`linked or special source entry ${relative}`);
    }
    if (stat.isDirectory()) {
      out.push({ path: relative, kind: "directory", sha256: null, mode: modeOf(absolute), marker: "source" });
      for (const name of readdirSync(absolute).sort()) visit(`${relative}/${name}`, join(absolute, name));
      return;
    }
    const bytes = readFileSync(absolute);
    out.push({ path: relative, kind: "file", sha256: sha256(bytes), mode: modeOf(absolute), marker: "source", bytes });
  };
  for (const name of readdirSync(root).sort()) visit(name, join(root, name));
  for (const path of REQUIRED) {
    if (!out.some((entry) => entry.path === path) && !existsSync(join(root, path))) {
      out.push({ path, kind: "absent", sha256: null, mode: null, marker: "source" });
    }
  }
  out.sort((left, right) => Buffer.compare(Buffer.from(left.path), Buffer.from(right.path)));
  if (!out.length || out.length > MAX_ENTRIES) refuse("the finite source population is empty or too large");
  if (!out.some((entry) => entry.path === "marker" && entry.kind === "file")) refuse("the source marker is missing");
  return out;
}

export function candidateManifest(
  entries: InventoryEntry[],
  marker: Buffer,
  operationId: string,
  side: "source" | "target" = "source",
) {
  return RollbackSetManifestV2.parse({
    format: 2,
    operationId,
    side,
    marker: sha256(marker),
    entries: entries.map(({ bytes: _bytes, ...entry }) => entry),
  });
}

function sameManifest(root: string, operationId: string, current: ReturnType<typeof candidateManifest>): void {
  const bytes = readRecord(join(root, `migration-evidence-v2/${operationId}/source.json`));
  if (bytes === null) return refuse("the direct-final source manifest is missing");
  let parsed: ReturnType<typeof RollbackSetManifestV2.parse>;
  try { parsed = RollbackSetManifestV2.parse(parseUniqueRecord(bytes)); }
  catch { return refuse("the direct-final source manifest is partial or corrupt"); }
  if (bytes !== canonicalCandidateRecord(parsed) || canonicalCandidateRecord(parsed) !== canonicalCandidateRecord(current)) {
    refuse("the admitted source manifest changed");
  }
}

function snapshotOf(
  entries: InventoryEntry[],
  operationId: string,
  manifestSha256: string,
  sourceSetDigest: string,
) {
  const converted: RollbackSnapshotEntryV3[] = entries.map((entry) => {
    if (entry.kind === "file") return {
      path: entry.path, kind: "file", sha256: entry.sha256, mode: entry.mode,
      bytes: String(entry.bytes!.length), object: `objects/${entry.sha256}`,
    };
    if (entry.kind === "directory") return {
      path: entry.path, kind: "directory", sha256: null, mode: entry.mode, bytes: null, object: null,
    };
    return { path: entry.path, kind: "absent", sha256: null, mode: null, bytes: null, object: null };
  });
  return RollbackSourceSnapshotV3.parse({
    format: 3,
    operationId,
    sourceManifest: `migration-evidence-v2/${operationId}/source.json`,
    sourceManifestSha256: manifestSha256,
    sourceSetDigest,
    entries: converted,
  });
}

function requireCleanMetadata(path: string, operationId: string): void {
  if (readdirSync(join(path, `migration-snapshot-v3/${operationId}/objects`), { withFileTypes: true })
        .some((entry) => entry.name.endsWith(`.tmp-${operationId}`))) {
    refuse("an unexpected uncommitted snapshot temporary record remains");
  }
}

function publishObjects(root: string, operationId: string, entries: InventoryEntry[]): void {
  const base = join(root, `migration-snapshot-v3/${operationId}`);
  mkdirSync(join(base, "objects"), { recursive: true, mode: 0o700 });
  chmodSync(base, 0o700);
  chmodSync(join(base, "objects"), 0o700);
  for (const entry of entries) {
    if (entry.kind !== "file") continue;
    const final = join(base, "objects", entry.sha256);
    if (existsSync(final)) {
      if (!readFileSync(final).equals(entry.bytes!)) refuse(`snapshot object ${entry.sha256} changed`);
      syncCandidateFile(final);
      syncCandidateDirectory(join(base, "objects"));
      continue;
    }
    const temp = `${final}.tmp-${operationId}`;
    if (existsSync(temp)) {
      if (!readFileSync(temp).equals(entry.bytes!)) refuse(`snapshot object temporary ${entry.sha256} is partial`);
      syncCandidateFile(temp);
    } else writeCandidateFile(temp, entry.bytes!, true);
    renameSync(temp, final);
    syncCandidateDirectory(join(base, "objects"));
  }
  requireCleanMetadata(root, operationId);
  syncCandidateDirectory(base);
  syncCandidateDirectory(join(root, "migration-snapshot-v3"));
}

function publishTransition(
  root: string,
  options: CandidateOptions,
  identity: DirectoryIdentity,
  source: ReturnType<typeof candidateManifest>,
  manifestSha256: string,
  snapshot: ReturnType<typeof snapshotOf>,
): void {
  const text = canonicalCandidateRecord(MarkerTransitionV3.parse({
    format: 3,
    protocol: "marker-v3",
    operationId: options.operationId,
    kind: "migration-forward",
    phase: "prepared",
    root: identity,
    marker: options.marker,
    source: {
      marker: source.marker,
      state: source.entries.find((entry) => entry.path === "state")?.sha256 ?? null,
    },
    recovery: {
      manifest: `migration-evidence-v2/${options.operationId}/source.json`,
      manifestSha256,
      snapshot: `migration-snapshot-v3/${options.operationId}/snapshot.json`,
      snapshotSha256: sha256(canonicalCandidateRecord(snapshot)),
      previousBridgeDigest: options.previousBridgeDigest,
      rollbackEligible: false,
    },
  }));
  const final = join(root, "migration-transition.json");
  if (existsSync(final)) {
    const prior = readRecord(final);
    if (prior !== text) refuse("the prepared transition differs from this operation");
    syncCandidateFile(final);
    syncCandidateDirectory(root);
    return;
  }
  const temp = `${final}.tmp-${options.operationId}`;
  if (existsSync(temp)) {
    if (readFileSync(temp, "utf8") !== text) refuse("the prepared transition temporary record is partial");
    syncCandidateFile(temp);
  } else writeCandidateFile(temp, Buffer.from(text), true);
  renameSync(temp, final);
  syncCandidateDirectory(root);
}

function admitMarker(root: string, options: CandidateOptions) {
  if (options.ownership.kind !== "attested-v1" || !SHA.test(options.ownership.digest)) {
    refuse("the source has no admitted ownership attestation");
  }
  if (!OPERATION.test(options.operationId) || !SHA.test(options.previousBridgeDigest)) {
    refuse("the operation identity or bridge digest is invalid");
  }
  if (existsSync(join(root, "migration-terminal.json"))) {
    refuse("a pre-existing migration terminal is outside this source transition");
  }
  const marker = MarkerV3.parse(options.marker);
  const identity = readQualifiedDirectoryIdentity(root, options.qualification);
  if (!sameDirectoryIdentity(identity, marker.identity)) {
    refuse("the admitted directory identity differs from the prospective marker");
  }
  verifyCandidateMarker(marker, options.binding);
  return { marker, identity };
}

function publishSourceManifest(root: string, operationId: string) {
  const entries = inventoryCandidate(root, operationId);
  const markerEntry = entries.find((entry) => entry.path === "marker" && entry.kind === "file")!;
  const manifest = candidateManifest(entries, markerEntry.bytes!, operationId);
  const text = canonicalCandidateRecord(manifest);
  const directory = join(root, `migration-evidence-v2/${operationId}`);
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, "source.json");
  if (!existsSync(path)) writeCandidateFile(path, Buffer.from(text), true);
  else syncCandidateFile(path);
  syncCandidateDirectory(directory);
  syncCandidateDirectory(join(root, "migration-evidence-v2"));
  syncCandidateDirectory(root);
  sameManifest(root, operationId, manifest);
  const unchanged = inventoryCandidate(root, operationId);
  const marker = unchanged.find((entry) => entry.path === "marker" && entry.kind === "file")!;
  if (canonicalCandidateRecord(candidateManifest(unchanged, marker.bytes!, operationId)) !== text) {
    refuse("the source changed after direct-final manifest publication");
  }
  return { entries, manifest, text, sha256: sha256(readFileSync(path)) };
}

function publishSnapshotManifest(
  root: string,
  operationId: string,
  snapshot: ReturnType<typeof snapshotOf>,
): { path: string; sha256: string } {
  const base = join(root, `migration-snapshot-v3/${operationId}`);
  const path = join(base, "snapshot.json");
  const text = canonicalCandidateRecord(snapshot);
  if (existsSync(path)) {
    if (readFileSync(path, "utf8") !== text) refuse("the admitted snapshot manifest changed");
    syncCandidateFile(path);
  } else {
    const temp = `${path}.tmp-${operationId}`;
    if (existsSync(temp)) {
      if (readFileSync(temp, "utf8") !== text) refuse("the snapshot temporary manifest is partial");
      syncCandidateFile(temp);
    } else writeCandidateFile(temp, Buffer.from(text), true);
    renameSync(temp, path);
  }
  syncCandidateDirectory(base);
  const admitted = RollbackSourceSnapshotV3.parse(parseUniqueRecord(readRecord(path)!));
  if (canonicalCandidateRecord(admitted) !== text) refuse("the snapshot graph did not re-admit");
  return { path, sha256: sha256(readFileSync(path)) };
}

function captureCandidateSnapshotUnlocked(
  workspace: string,
  options: CandidateOptions,
): { operationId: string; manifestSha256: string; snapshotSha256: string; rollbackEligible: false } {
  const root = join(workspace, ".tenet");
  const { identity } = admitMarker(root, options);
  const source = publishSourceManifest(root, options.operationId);
  const digest = sha256(stableStringify({
    version: 1, marker: source.manifest.marker, entries: source.manifest.entries,
  }));
  const snapshot = snapshotOf(source.entries, options.operationId, source.sha256, digest);
  publishTransition(root, options, identity, source.manifest, source.sha256, snapshot);
  publishObjects(root, options.operationId, source.entries);
  const published = publishSnapshotManifest(root, options.operationId, snapshot);
  const finalEntries = inventoryCandidate(root, options.operationId);
  const finalManifest = candidateManifest(
    finalEntries,
    finalEntries.find((e) => e.path === "marker")!.bytes!,
    options.operationId,
  );
  if (canonicalCandidateRecord(finalManifest) !== source.text) refuse("the live source changed during snapshot capture");
  return {
    operationId: options.operationId,
    manifestSha256: source.sha256,
    snapshotSha256: published.sha256,
    rollbackEligible: false,
  };
}

export function captureCandidateSnapshot(
  workspace: string,
  options: CandidateOptions,
): ReturnType<typeof captureCandidateSnapshotUnlocked> {
  return withCandidateLocks(workspace, options.operationId, () => captureCandidateSnapshotUnlocked(workspace, options));
}
