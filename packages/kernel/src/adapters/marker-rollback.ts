import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  openSync,
  readSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import { DirectoryIdentity, MarkerV3 } from "../core/marker-identity.ts";
import {
  LegacyMarker,
  MarkerTransitionV3,
  MigrationRecoveryV3,
  RollbackEvidenceV2,
  RollbackPostcondition,
  RollbackSetManifestV2,
  RollbackSourceSnapshotV3,
  RollbackTerminalAcceptedV2,
  RollbackTerminalV2,
} from "../core/marker-transition.ts";
import type {
  MarkerTransitionV3 as MarkerTransition,
  PreviousVersionsV2,
  RollbackEvidenceV2 as RollbackEvidence,
  RollbackSourceSnapshotV3 as SourceSnapshot,
} from "../core/marker-transition.ts";
import {
  candidateManifest,
  canonicalCandidateRecord,
  inventoryCandidate,
  syncCandidateDirectory,
  syncCandidateFile,
  writeCandidateFile,
} from "./marker-snapshot.ts";
import type { InventoryEntry } from "./marker-snapshot.ts";
import { parseUniqueRecord, readRecord, readTerminal } from "./private-record-fs.ts";
import { Terminal } from "../core/migration-terminal.ts";
import { AccountingCheckpoint, State } from "../core/schemas.ts";
import { accountingCheckpoint, newBudget } from "../core/budget.ts";
import { readQualifiedDirectoryIdentity } from "./marker-identity-fs.ts";
import type { IdentityQualification } from "./marker-identity-fs.ts";
import { verifyCandidateMarker } from "./marker-binding.ts";
import type { MarkerBindingPort } from "../ports/types.ts";
import { sameDirectoryIdentity } from "../core/marker-identity.ts";
import { withCandidateLocks } from "./marker-lock.ts";

type PublishOptions = {
  operationId: string;
  state: string;
  previousBridgeDigest: string;
  previous: PreviousVersionsV2;
  writes: Array<{ path: string; bytes: string | Buffer }>;
  removes: string[];
  qualification: IdentityQualification;
  binding: MarkerBindingPort;
};
type RestoreOptions = {
  operationId: string;
  previousBridgeDigest: string;
  qualification: IdentityQualification;
  binding: MarkerBindingPort;
};
type SnapshotGraph = {
  source: ReturnType<typeof RollbackSetManifestV2.parse>;
  snapshot: SourceSnapshot;
  sourceSetDigest: string;
  sourceManifestSha256: string;
  snapshotSha256: string;
  objects: Map<string, Buffer>;
};

const refuse = (detail: string): never => {
  throw new KernelError("unsupported-record", `candidate rollback refused: ${detail}`, { exit: 4 });
};

function safePath(path: string): void {
  if (!path || path.startsWith("/") || path.includes("\\") || path.includes("\0") || path.includes(":") ||
      path.split("/").some((part) => !part || part === "." || part === "..")) refuse(`unsafe path ${path}`);
}

function bridgeRecord<T>(path: string, schema: z.ZodType<T>): { raw: string; record: T } {
  const raw = readRecord(path);
  if (raw === null) return refuse(`missing ${path}`);
  try {
    const record = schema.parse(parseUniqueRecord(raw));
    if (raw !== canonicalCandidateRecord(record)) refuse(`noncanonical ${path}`);
    return { raw, record };
  } catch (error) {
    if (error instanceof KernelError) throw error;
    return refuse(`invalid ${path}`);
  }
}

export function admitCandidateAcceptance(
  root: string,
  operationId: string,
  bridgeDigest: string,
  sourceMustMatch = false,
) {
  const graph = admitCandidateRollbackEvidence(root, operationId, bridgeDigest, sourceMustMatch);
  const acceptedPath = join(root, ".tenet", `migration-evidence-v2/${operationId}/accepted.json`);
  const { record: accepted } = bridgeRecord(acceptedPath, RollbackTerminalAcceptedV2);
  if (accepted.operationId !== operationId || accepted.terminal !== graph.terminal ||
      accepted.evidence !== graph.evidence || accepted.bridgeDigest !== bridgeDigest ||
      accepted.bindingDigest !== graph.bindingDigest) {
    refuse("the terminal acceptance no longer binds the admitted graph");
  }
  return accepted;
}

function admitCompletedBridge(
  root: string,
  operationId: string,
  terminal: ReturnType<typeof RollbackTerminalV2.parse>,
): void {
  const directory = join(root, ".tenet", `migration-evidence-v2/${operationId}`);
  const acceptedPath = join(directory, "accepted.json");
  const { record: accepted } = bridgeRecord(acceptedPath, RollbackTerminalAcceptedV2);
  if (existsSync(join(directory, "evidence.json"))) {
    admitCandidateAcceptance(root, operationId, terminal.bridgeDigest, false);
  } else if (accepted.operationId !== operationId || accepted.bridgeDigest !== terminal.bridgeDigest ||
      accepted.bindingDigest !== terminal.bindingDigest) {
    refuse("the completed acceptance does not bind the pinned terminal");
  }
  const terminalBytes = readRecord(join(root, ".tenet/migration-terminal.json"));
  const { record: postcondition } = bridgeRecord(join(directory, "postcondition.json"), RollbackPostcondition);
  if (!terminalBytes || postcondition.operationId !== operationId ||
      postcondition.acceptance !== sha256(canonicalCandidateRecord(accepted)) ||
      postcondition.terminal !== sha256(terminalBytes) ||
      postcondition.bridgeDigest !== terminal.bridgeDigest ||
      postcondition.schema !== 2) {
    refuse("the completed postcondition does not bind the pinned bridge terminal");
  }
  const evidence = join(directory, "evidence.json");
  if (existsSync(evidence)) {
    admitCandidateCleanupEvidence(root, operationId, {
      terminal: postcondition.terminal,
      evidence: postcondition.evidence,
      snapshot: postcondition.snapshot,
      bridgeDigest: postcondition.bridgeDigest,
      bindingDigest: accepted.bindingDigest,
    });
  }
}

export function authorizeMigrationMutation(
  root: string,
  terminalPath: string,
  bridgeDigest: string | undefined,
  bridgeRequest: string | undefined,
  verb: string,
  input: unknown,
): boolean {
  const text = readRecord(terminalPath);
  if (text === null || !bridgeDigest) return false;
  const terminal = bridgeTerminal(text);
  if (terminal && !existsSync(join(root, ".tenet",
    `migration-evidence-v2/${terminal.operationId}/postcondition.json`))) {
    const request = input && typeof input === "object" ? input as { profile?: unknown; request?: unknown } : {};
    if (verb !== "open" || request.profile !== "plan" || request.request !== bridgeRequest) {
      throw new KernelError("unsupported-record",
        "the rollback bridge only permits the exact ordinary plan probe before postcondition success");
    }
    return true;
  }
  return false;
}

export function assertMigrationMutation(
  root: string,
  terminalPath: string,
  bridgeDigest: string | undefined,
  authorized: boolean,
): void {
  const text = readRecord(terminalPath);
  if (text === null || !bridgeDigest) return;
  const terminal = bridgeTerminal(text);
  if (terminal && !authorized && !existsSync(join(root, ".tenet",
    `migration-evidence-v2/${terminal.operationId}/postcondition.json`))) {
    throw new KernelError("unsupported-record",
      "the rollback bridge cannot mutate before the ordinary plan postcondition");
  }
}

function bridgeTerminal(text: string): ReturnType<typeof RollbackTerminalV2.parse> | null {
  let raw: unknown;
  try { raw = parseUniqueRecord(text); }
  catch { throw new KernelError("unsupported-record", "the migration terminal record is invalid"); }
  if (!raw || typeof raw !== "object" || !("protocolVersion" in raw) || raw.protocolVersion !== 2) return null;
  const parsed = RollbackTerminalV2.safeParse(raw);
  if (!parsed.success) throw new KernelError("unsupported-record", "the migration terminal record is invalid");
  return parsed.data;
}

export interface MigrationGuard {
  admit(): void;
  authorize(verb: string, input: unknown): void;
  accept(): void;
  assert(): void;
  release(): void;
}

export function createMigrationGuard(
  root: string,
  digest: string | undefined,
  request: string | undefined,
  invalid: boolean,
): MigrationGuard {
  const terminal = join(root, ".tenet/migration-terminal.json");
  let authorized = false;
  const verified = () => {
    if (invalid) {
      throw new KernelError(
        "unsupported-record",
        "the selected schema-2 rollback bridge does not match the installed executable",
        { exit: 4 },
      );
    }
  };
  return {
    admit: () => { verified(); admitMigrationTerminal(root, terminal, digest); },
    authorize: (verb, input) => {
      verified();
      authorized = authorizeMigrationMutation(root, terminal, digest, request, verb, input);
    },
    accept: () => {
      verified();
      assertMigrationMutation(root, terminal, digest, authorized);
      admitMigrationTerminal(root, terminal, digest, true);
    },
    assert: () => { verified(); assertMigrationMutation(root, terminal, digest, authorized); },
    release: () => { authorized = false; },
  };
}

function bytesOrNull(path: string): Buffer | null {
  return existsSync(path) ? readFileSync(path) : null;
}

function readStrict<T>(path: string, schema: { parse(value: unknown): T }): T {
  const text = readRecord(path);
  if (text === null) return refuse(`missing ${path}`);
  try { return schema.parse(parseUniqueRecord(text)); }
  catch { return refuse(`invalid ${path}`); }
}

function replace(root: string, path: string, bytes: Buffer, tempSuffix: string): void {
  safePath(path);
  const final = join(root, path);
  mkdirSync(dirname(final), { recursive: true, mode: 0o700 });
  const temp = `${final}.tmp-${tempSuffix}`;
  if (existsSync(temp)) {
    if (!readFileSync(temp).equals(bytes)) refuse(`the replacement temporary for ${path} is partial`);
    syncCandidateFile(temp);
  } else if (existsSync(final) && readFileSync(final).equals(bytes)) {
    syncCandidateFile(final);
    syncCandidateDirectory(dirname(final));
    return;
  } else writeCandidateFile(temp, bytes, true);
  renameSync(temp, final);
  syncCandidateDirectory(dirname(final));
}

function removePath(root: string, path: string): void {
  safePath(path);
  const final = join(root, path);
  if (!existsSync(final)) return;
  rmSync(final, { recursive: true, force: true });
  syncCandidateDirectory(dirname(final));
}

function transition(root: string, operationId: string): MarkerTransition {
  const record = readStrict(join(root, "migration-transition.json"), MarkerTransitionV3);
  if (record.operationId !== operationId) refuse("the transition belongs to another operation");
  return record;
}

function setTransition(root: string, current: MarkerTransition, phase: MarkerTransition["phase"]): MarkerTransition {
  if (current.phase === phase) return current;
  const next = MarkerTransitionV3.parse({ ...current, phase });
  replace(root, "migration-transition.json", Buffer.from(canonicalCandidateRecord(next)), next.operationId);
  return next;
}

function readCandidateObject(path: string): Buffer {
  let fd = -1;
  try {
    const named = lstatSync(path);
    if (named.isSymbolicLink() || !named.isFile()) {
      return refuse("a snapshot object is linked or not a regular file");
    }
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 50 * 1024 * 1024) {
      return refuse("a snapshot object is not a bounded regular file");
    }
    const buffer = Buffer.alloc(stat.size);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(fd, buffer, offset, buffer.length - offset, offset);
      if (!count) break;
      offset += count;
    }
    const after = fstatSync(fd);
    if (offset !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs) {
      return refuse("a snapshot object changed during admission");
    }
    return buffer;
  } catch (error) {
    if (error instanceof KernelError) throw error;
    return refuse("a snapshot object cannot be read no-follow");
  } finally {
    if (fd >= 0) closeSync(fd);
  }
}

function admittedSnapshotObject(
  root: string,
  operationId: string,
  entry: SnapshotGraph["source"]["entries"][number],
  captured: SnapshotGraph["snapshot"]["entries"][number],
): Buffer | null {
  if (entry.path !== captured.path || entry.kind !== captured.kind || entry.sha256 !== captured.sha256 ||
      entry.mode !== captured.mode) {
    refuse(`snapshot entry ${entry.path} disagrees with the source manifest`);
  }
  if (entry.kind !== "file" || captured.kind !== "file") return null;
  const objectPath = join(root, `migration-snapshot-v3/${operationId}`, captured.object);
  if (!existsSync(objectPath)) refuse(`snapshot object ${captured.object} is missing`);
  const raw = readCandidateObject(objectPath);
  if (String(raw.length) !== captured.bytes || sha256(raw) !== captured.sha256) {
    refuse(`snapshot object ${captured.object} has changed bytes`);
  }
  return raw;
}

function sourceGraph(root: string, operationId: string): SnapshotGraph {
  const sourcePath = `migration-evidence-v2/${operationId}/source.json`;
  const snapshotPath = `migration-snapshot-v3/${operationId}/snapshot.json`;
  const sourceBytes = readRecord(join(root, sourcePath));
  const snapshotBytes = readRecord(join(root, snapshotPath));
  if (sourceBytes === null || snapshotBytes === null) {
    return refuse("the retained source manifest or snapshot is missing");
  }
  const source = readStrict(join(root, sourcePath), RollbackSetManifestV2);
  const snapshot = readStrict(join(root, snapshotPath), RollbackSourceSnapshotV3);
  if (source.operationId !== operationId || snapshot.operationId !== operationId ||
      snapshot.sourceManifest !== sourcePath || snapshot.sourceManifestSha256 !== sha256(sourceBytes) ||
      snapshot.sourceSetDigest !== sha256(stableStringify({ version: 1, marker: source.marker, entries: source.entries }))) {
    refuse("the source manifest and snapshot disagree");
  }
  if (source.entries.length !== snapshot.entries.length) refuse("the source and snapshot populations differ");
  const objects = new Map<string, Buffer>();
  for (const [index, entry] of source.entries.entries()) {
    const raw = admittedSnapshotObject(root, operationId, entry, snapshot.entries[index]!);
    if (raw) objects.set(entry.sha256!, raw);
  }
  const objectNames = readdirSync(join(root, `migration-snapshot-v3/${operationId}/objects`)).sort();
  const expected = [...new Set([...objects.keys()])].sort();
  if (stableStringify(objectNames) !== stableStringify(expected)) refuse("the snapshot object set is not exact");
  return {
    source,
    snapshot,
    sourceSetDigest: snapshot.sourceSetDigest,
    sourceManifestSha256: sha256(sourceBytes),
    snapshotSha256: sha256(snapshotBytes),
    objects,
  };
}

function sourceBytes(graph: SnapshotGraph, path: string): Buffer {
  const entry = graph.snapshot.entries.find((candidate) => candidate.path === path && candidate.kind === "file");
  if (!entry || entry.kind !== "file") return refuse(`snapshot file ${path} is missing`);
  const bytes = graph.objects.get(entry.sha256);
  if (!bytes) return refuse(`snapshot object for ${path} is missing`);
  return bytes;
}

function snapshotHash(graph: SnapshotGraph, path: string): string | null {
  const entry = graph.snapshot.entries.find((candidate) => candidate.path === path);
  if (!entry || entry.kind === "absent") return null;
  if (entry.kind !== "file") refuse(`snapshot path ${path} is not a file`);
  return entry.sha256;
}

function requireSourcePopulation(
  root: string,
  operationId: string,
  graph: SnapshotGraph,
  temp?: { path: string; bytes: Buffer },
): void {
  const marker = graph.objects.get(graph.source.marker);
  if (!marker) return refuse("the source marker object is missing");
  const now = inventoryCandidate(root, operationId);
  if (temp) {
    const index = now.findIndex((entry) => entry.path === temp.path);
    if (index >= 0) {
      const entry = now[index]!;
      if (entry.kind !== "file" || !entry.bytes?.equals(temp.bytes)) refuse(`the ${temp.path} prefix changed`);
      now.splice(index, 1);
    }
  }
  const current = candidateManifest(now, marker, operationId, "source");
  if (canonicalCandidateRecord(current) !== canonicalCandidateRecord(graph.source)) {
    refuse("the live source no longer matches the finite manifest");
  }
}

function writeRecord(
  root: string,
  relative: string,
  record: unknown,
  operationId: string,
  admitExisting = false,
): string {
  const text = canonicalCandidateRecord(record);
  const final = join(root, relative);
  const bytes = Buffer.from(text);
  if (admitExisting && existsSync(final) && !readFileSync(final).equals(bytes)) {
    refuse(`existing record ${relative} differs from the admitted target`);
  }
  replace(root, relative, bytes, operationId);
  return sha256(text);
}

function targetDigest(manifest: ReturnType<typeof candidateManifest>): string {
  return sha256(stableStringify({ version: 1, marker: manifest.marker, entries: manifest.entries }));
}

function bindingDigest(
  graph: SnapshotGraph,
  targetBaselineDigest: string,
  markerIdentity: RollbackEvidence["markerIdentity"],
  previous: PreviousVersionsV2,
): string {
  return bindingDigestParts(graph.sourceSetDigest, targetBaselineDigest, markerIdentity, previous);
}

function bindingDigestParts(
  sourceSetDigest: string,
  targetBaselineDigest: string,
  markerIdentity: RollbackEvidence["markerIdentity"],
  previous: PreviousVersionsV2,
): string {
  return sha256(stableStringify({
    version: 1,
    sourceSetDigest,
    targetBaselineDigest,
    markerIdentity: {
      kind: markerIdentity.kind,
      platform: markerIdentity.platform,
      architecture: markerIdentity.architecture,
      filesystem: markerIdentity.filesystem,
      dev: markerIdentity.dev,
      ino: markerIdentity.ino,
      birthNs: markerIdentity.birthNs,
      bindingKind: markerIdentity.bindingKind,
      keyIdOrNull: markerIdentity.keyId,
    },
    previous,
  }));
}

function evidenceRecord(
  operationId: string,
  graph: SnapshotGraph,
  target: ReturnType<typeof candidateManifest>,
  targetSha256: string,
  marker: MarkerV3,
  previous: PreviousVersionsV2,
  bridgeDigest: string,
): RollbackEvidence {
  const baseline = targetDigest(target);
  return RollbackEvidenceV2.parse({
    format: 2,
    operationId,
    source: {
      locator: `migration-evidence-v2/${operationId}/source.json`,
      sha256: graph.sourceManifestSha256,
      sourceSetDigest: graph.sourceSetDigest,
    },
    target: {
      locator: `migration-evidence-v2/${operationId}/target.json`,
      sha256: targetSha256,
      targetBaselineDigest: baseline,
    },
    snapshot: {
      locator: `migration-snapshot-v3/${operationId}/snapshot.json`,
      sha256: graph.snapshotSha256,
    },
    bindingDigest: bindingDigest(graph, baseline, {
      ...marker.identity,
      bindingKind: marker.binding.kind,
      keyId: marker.binding.kind === "host-key-v1" ? marker.binding.keyId : null,
    }, previous),
    bridgeDigest,
    markerIdentity: {
      ...marker.identity,
      bindingKind: marker.binding.kind,
      keyId: marker.binding.kind === "host-key-v1" ? marker.binding.keyId : null,
    },
    previous,
  });
}

const FORWARD_PHASES: MarkerTransition["phase"][] = [
  "prepared", "marker-installed", "state-published", "migration-evidence-installed",
];

function forwardAtLeast(phase: MarkerTransition["phase"], wanted: MarkerTransition["phase"]): boolean {
  const at = FORWARD_PHASES.indexOf(phase), target = FORWARD_PHASES.indexOf(wanted);
  if (at < 0 || target < 0) refuse("a rollback phase reached forward publication");
  return at >= target;
}

function sourceValue(graph: SnapshotGraph, path: string): Buffer | null | undefined {
  const entry = graph.snapshot.entries.find((candidate) => candidate.path === path);
  if (!entry) return undefined;
  if (entry.kind === "absent") return null;
  if (entry.kind !== "file") return refuse(`source path ${path} is not a file`);
  return graph.objects.get(entry.sha256) ?? refuse(`source object for ${path} is missing`);
}

function forwardWrite(
  root: string,
  path: string,
  desired: Buffer,
  graph: SnapshotGraph,
  operationId: string,
  allowSource: boolean,
): void {
  const final = join(root, path);
  const current = existsSync(final) ? readFileSync(final) : null;
  if (current && current.equals(desired)) return;
  const source = sourceValue(graph, path);
  if (!allowSource) refuse(`forward path ${path} is not at its published target after ${"state-published"}`);
  if (source === undefined && current !== null || source instanceof Buffer && current && !current.equals(source) ||
      source === null && current !== null) {
    refuse(`forward path ${path} changed outside its admitted source or desired target`);
  }
  replace(root, path, desired, operationId);
}

function forwardRemove(root: string, path: string, graph: SnapshotGraph, allowSource: boolean): void {
  const final = join(root, path);
  if (!existsSync(final)) return;
  if (!allowSource) refuse(`forward path ${path} reappeared after state-published`);
  const source = sourceValue(graph, path);
  if (!(source instanceof Buffer) || !readFileSync(final).equals(source)) {
    refuse(`forward removal ${path} changed outside its admitted source`);
  }
  removePath(root, path);
}

function admitRecoveryFinal(root: string, operationId: string, text: Buffer): void {
  const final = join(root, "migration-recovery-v3.json");
  const temp = `${final}.tmp-${operationId}`;
  if (existsSync(final)) {
    if (!readFileSync(final).equals(text)) refuse("the recovery record differs from the expected operation");
    syncCandidateFile(final);
    syncCandidateDirectory(root);
    return;
  }
  if (existsSync(temp)) {
    if (!readFileSync(temp).equals(text)) refuse("the recovery temporary record is partial or foreign");
    syncCandidateFile(temp);
  } else writeCandidateFile(temp, text, true);
  renameSync(temp, final);
  syncCandidateDirectory(root);
}

function installForwardMarker(
  root: string,
  options: PublishOptions,
  graph: SnapshotGraph,
  current: MarkerTransition,
): { marker: MarkerV3; current: MarkerTransition } {
  const marker = MarkerV3.parse(current.marker);
  const observed = readQualifiedDirectoryIdentity(root, options.qualification);
  if (!sameDirectoryIdentity(observed, marker.identity)) refuse("the transition root identity changed");
  verifyCandidateMarker(marker, options.binding);
  const markerText = Buffer.from(canonicalCandidateRecord(marker));
  if (current.phase === "prepared") {
    const now = bytesOrNull(join(root, "marker"));
    if (now && !now.equals(markerText) && !now.equals(sourceBytes(graph, "marker"))) {
      refuse("the forward marker prefix has a third value");
    }
    if (!now?.equals(markerText)) requireSourcePopulation(root, options.operationId, graph, {
      path: `marker.tmp-${options.operationId}`,
      bytes: markerText,
    });
    replace(root, "marker", markerText, options.operationId);
    current = setTransition(root, current, "marker-installed");
  } else if (!bytesOrNull(join(root, "marker"))?.equals(markerText)) {
    refuse("the schema-3 marker changed after marker installation");
  }
  return { marker, current };
}

function publishForwardState(
  root: string,
  options: PublishOptions,
  graph: SnapshotGraph,
  current: MarkerTransition,
): MarkerTransition {
  if (!forwardAtLeast(current.phase, "state-published")) {
    for (const change of options.writes) {
      forwardWrite(
        root,
        change.path,
        Buffer.isBuffer(change.bytes) ? change.bytes : Buffer.from(change.bytes),
        graph,
        options.operationId,
        true,
      );
    }
    forwardWrite(root, "state", Buffer.from(options.state), graph, options.operationId, true);
    for (const path of options.removes) forwardRemove(root, path, graph, true);
    current = setTransition(root, current, "state-published");
  } else {
    for (const change of options.writes) {
      forwardWrite(
        root,
        change.path,
        Buffer.isBuffer(change.bytes) ? change.bytes : Buffer.from(change.bytes),
        graph,
        options.operationId,
        false,
      );
    }
    forwardWrite(root, "state", Buffer.from(options.state), graph, options.operationId, false);
    for (const path of options.removes) forwardRemove(root, path, graph, false);
  }
  return current;
}

function publishForwardRecords(
  root: string,
  options: PublishOptions,
  graph: SnapshotGraph,
  marker: MarkerV3,
  current: MarkerTransition,
): { targetBaselineSha256: string } {
  const now = inventoryCandidate(root, options.operationId);
  const targetMarker = now.find((entry) => entry.path === "marker" && entry.kind === "file")!;
  const target = candidateManifest(now, targetMarker.bytes!, options.operationId, "target");
  const targetPath = `migration-evidence-v2/${options.operationId}/target.json`;
  const targetSha256 = writeRecord(root, targetPath, target, options.operationId, true);
  const evidence = evidenceRecord(
    options.operationId, graph, target, targetSha256, marker, options.previous, options.previousBridgeDigest,
  );
  const evidencePath = `migration-evidence-v2/${options.operationId}/evidence.json`;
  const evidenceSha256 = writeRecord(root, evidencePath, evidence, options.operationId, true);
  if (!forwardAtLeast(current.phase, "migration-evidence-installed")) {
    current = setTransition(root, current, "migration-evidence-installed");
  }
  const recovery = MigrationRecoveryV3.parse({
    format: 3,
    operationId: options.operationId,
    outcome: "applied",
    sourceManifest: `migration-evidence-v2/${options.operationId}/source.json`,
    sourceManifestSha256: graph.sourceManifestSha256,
    sourceSnapshot: `migration-snapshot-v3/${options.operationId}/snapshot.json`,
    sourceSnapshotSha256: graph.snapshotSha256,
    targetBaselineSha256: targetDigest(target),
    previousBridgeDigest: options.previousBridgeDigest,
    evidence: { locator: evidencePath, sha256: evidenceSha256 },
    previous: options.previous,
    rollbackEligible: true,
  });
  const recoveryText = Buffer.from(canonicalCandidateRecord(recovery));
  admitRecoveryFinal(root, options.operationId, recoveryText);
  rmSync(join(root, "migration-transition.json"));
  syncCandidateDirectory(root);
  return { targetBaselineSha256: targetDigest(target) };
}

function completedForward(root: string, options: PublishOptions) {
  const transitionPath = join(root, "migration-transition.json");
  if (existsSync(transitionPath)) return null;
  if (!existsSync(join(root, "migration-recovery-v3.json"))) {
    refuse("forward completion is missing both transition and recovery");
  }
  const retained = retainedRecords(root, options.operationId, options.previousBridgeDigest);
  exactTarget(root, options.operationId, retained.target);
  if (!retained.recovery) return refuse("the completed forward prefix has no recovery record");
  const liveMarker = MarkerV3.parse(JSON.parse(readFileSync(join(root, "marker"), "utf8")));
  const observed = readQualifiedDirectoryIdentity(root, options.qualification);
  if (!sameDirectoryIdentity(observed, liveMarker.identity)) {
    refuse("the completed forward marker no longer names this directory");
  }
  verifyCandidateMarker(liveMarker, options.binding);
  return { targetBaselineSha256: retained.recovery.targetBaselineSha256 };
}

function publishCandidateTargetUnlocked(workspace: string, options: PublishOptions): { targetBaselineSha256: string } {
  const root = join(workspace, ".tenet");
  const graph = sourceGraph(root, options.operationId);
  const completed = completedForward(root, options);
  if (completed) return completed;
  let current = transition(root, options.operationId);
  if (current.kind !== "migration-forward" || !FORWARD_PHASES.includes(current.phase) ||
      current.recovery.rollbackEligible || current.recovery.snapshotSha256 !== graph.snapshotSha256) {
    refuse("the forward transition is not the admitted prepared prefix");
  }
  const installed = installForwardMarker(root, options, graph, current);
  current = publishForwardState(root, options, graph, installed.current);
  return publishForwardRecords(root, options, graph, installed.marker, current);
}

function recoveryMatches(
  recovery: ReturnType<typeof MigrationRecoveryV3.parse>,
  graph: SnapshotGraph,
  evidence: RollbackEvidence,
  operationId: string,
  previousBridgeDigest: string,
): boolean {
  return recovery.operationId === operationId && recovery.rollbackEligible && recovery.outcome === "applied" &&
    recovery.previousBridgeDigest === previousBridgeDigest &&
    recovery.sourceManifest === `migration-evidence-v2/${operationId}/source.json` &&
    recovery.sourceManifestSha256 === graph.sourceManifestSha256 &&
    recovery.sourceSnapshot === `migration-snapshot-v3/${operationId}/snapshot.json` &&
    recovery.sourceSnapshotSha256 === graph.snapshotSha256 &&
    recovery.evidence.locator === `migration-evidence-v2/${operationId}/evidence.json` &&
    canonicalCandidateRecord(recovery.previous) === canonicalCandidateRecord(evidence.previous);
}

function evidenceMatches(
  root: string,
  operationId: string,
  graph: SnapshotGraph,
  evidence: RollbackEvidence,
  target: ReturnType<typeof candidateManifest>,
): boolean {
  const targetPath = join(root, `migration-evidence-v2/${operationId}/target.json`);
  return evidence.source.sha256 === graph.sourceManifestSha256 &&
    evidence.source.locator === `migration-evidence-v2/${operationId}/source.json` &&
    evidence.source.sourceSetDigest === graph.sourceSetDigest &&
    evidence.target.locator === `migration-evidence-v2/${operationId}/target.json` &&
    evidence.snapshot.locator === `migration-snapshot-v3/${operationId}/snapshot.json` &&
    evidence.snapshot.sha256 === graph.snapshotSha256 &&
    evidence.target.sha256 === sha256(readFileSync(targetPath)) &&
    evidence.bindingDigest === bindingDigest(graph, targetDigest(target), evidence.markerIdentity, evidence.previous);
}

function retainedRecords(root: string, operationId: string, previousBridgeDigest: string) {
  const graph = sourceGraph(root, operationId);
  const recoveryPath = join(root, "migration-recovery-v3.json");
  const recovery = existsSync(recoveryPath) ? readStrict(recoveryPath, MigrationRecoveryV3) : null;
  const evidence = readStrict(
    join(root, `migration-evidence-v2/${operationId}/evidence.json`),
    RollbackEvidenceV2,
  );
  const target = readStrict(join(root, `migration-evidence-v2/${operationId}/target.json`), RollbackSetManifestV2);
  if (evidence.operationId !== operationId || target.operationId !== operationId ||
      evidence.bridgeDigest !== previousBridgeDigest ||
      (recovery !== null && !recoveryMatches(recovery, graph, evidence, operationId, previousBridgeDigest))) {
    refuse("the eligible forward record does not match the requested operation");
  }
  if (recovery && (recovery.targetBaselineSha256 !== targetDigest(target) ||
      recovery.evidence.sha256 !== sha256(readFileSync(
        join(root, `migration-evidence-v2/${operationId}/evidence.json`),
      )))) {
    refuse("the retained recovery record does not match the target evidence");
  }
  if (!evidenceMatches(root, operationId, graph, evidence, target)) {
    refuse("the retained evidence does not recompute from the exact source and target graph");
  }
  return { graph, recovery, evidence, target };
}

function exactTarget(root: string, operationId: string, target: ReturnType<typeof candidateManifest>): void {
  const now = inventoryCandidate(root, operationId);
  const marker = now.find((entry) => entry.path === "marker" && entry.kind === "file")!;
  if (canonicalCandidateRecord(candidateManifest(now, marker.bytes!, operationId, "target")) !==
      canonicalCandidateRecord(target)) refuse("the live target differs from its admitted baseline");
}

function matchesEntry(actual: InventoryEntry | undefined, expected: InventoryEntry): boolean {
  if (!actual) return expected.kind === "absent";
  if (actual.kind !== expected.kind || actual.mode !== expected.mode) return false;
  return actual.kind !== "file" || expected.kind !== "file" || actual.sha256 === expected.sha256;
}

function exactRestorePrefix(
  root: string,
  operationId: string,
  graph: SnapshotGraph,
  target: ReturnType<typeof candidateManifest>,
): void {
  const current = inventoryCandidate(root, operationId);
  const actual = new Map(current.map((entry) => [entry.path, entry]));
  const source = graph.source.entries.map((entry) => ({ entry, map: "source" as const }));
  const targetEntries = target.entries.map((entry) => ({ entry, map: "target" as const }));
  const paths = new Set([...source.map((item) => item.entry.path), ...targetEntries.map((item) => item.entry.path)]);
  for (const path of paths) {
    const present = actual.get(path);
    const choices = [...source, ...targetEntries].filter((item) => item.entry.path === path).map((item) => item.entry);
    if (!choices.some((choice) => matchesEntry(present, choice)) &&
        !(present === undefined && (
          targetEntries.some((item) => item.entry.path === path) && !source.some((item) => item.entry.path === path) ||
          source.some((item) => item.entry.path === path) && !targetEntries.some((item) => item.entry.path === path)
        ))) {
      refuse(`live path ${path} is neither the exact target nor exact source value`);
    }
  }
  for (const path of actual.keys()) {
    if (!paths.has(path)) refuse(`unadmitted target path ${path} appeared during rollback`);
  }
}

function stageSource(
  root: string,
  graph: SnapshotGraph,
  operationId: string,
  selected: ReadonlySet<string>,
): Map<string, string> {
  const staging = join(root, `migration-rollback-v3/${operationId}/stage`);
  mkdirSync(staging, { recursive: true, mode: 0o700 });
  const paths = new Map<string, string>();
  for (const [index, entry] of graph.snapshot.entries.entries()) {
    if (entry.kind !== "file" || !selected.has(entry.path)) continue;
    const name = `${index}-${sha256(entry.path)}`;
    const final = join(staging, name);
    const bytes = graph.objects.get(entry.sha256)!;
    if (existsSync(final)) {
      if (!readFileSync(final).equals(bytes) || (lstatSync(final).mode & 0o7777) !== Number.parseInt(entry.mode, 8)) {
        refuse(`the rollback stage ${entry.path} changed`);
      }
    } else {
      const temp = `${final}.tmp-${operationId}`;
      if (existsSync(temp)) {
        if (!readFileSync(temp).equals(bytes)) refuse(`the rollback stage ${entry.path} is partial`);
      } else writeCandidateFile(temp, bytes, true);
      chmodSync(temp, Number.parseInt(entry.mode, 8));
      syncCandidateFile(temp);
      renameSync(temp, final);
      syncCandidateDirectory(staging);
    }
    paths.set(entry.path, final);
  }
  return paths;
}

function beginRollback(
  root: string,
  operationId: string,
  graph: SnapshotGraph,
  bridgeDigest: string,
): MarkerTransition {
  const markerBytes = sourceBytes(graph, "marker");
  const marker = LegacyMarker.parse(parseUniqueRecord(markerBytes.toString("utf8")));
  return MarkerTransitionV3.parse({
    format: 3,
    protocol: "marker-v3",
    operationId,
    kind: "migration-rollback",
    phase: "rollback-prepared",
    root: MarkerV3.parse(JSON.parse(readFileSync(join(root, "marker"), "utf8"))).identity,
    marker,
    source: {
      marker: graph.source.marker,
      state: graph.source.entries.find((entry) => entry.path === "state")?.sha256 ?? null,
    },
    recovery: {
      manifest: `migration-evidence-v2/${operationId}/source.json`,
      manifestSha256: graph.sourceManifestSha256,
      snapshot: `migration-snapshot-v3/${operationId}/snapshot.json`,
      snapshotSha256: graph.snapshotSha256,
      previousBridgeDigest: bridgeDigest,
      rollbackEligible: false,
    },
  });
}

function removeTargetOnly(root: string, graph: SnapshotGraph, target: InventoryEntry[], operationId: string): void {
  const wanted = new Set(graph.snapshot.entries.map((entry) => entry.path));
  for (const entry of [...target].sort((a, b) => b.path.length - a.path.length)) {
    if (!wanted.has(entry.path) || graph.snapshot.entries.some((source) =>
      source.path === entry.path && source.kind === "absent")) removePath(root, entry.path);
  }
  void operationId;
}

function restoreEntry(
  root: string,
  graph: SnapshotGraph,
  staged: Map<string, string>,
  path: string,
  operationId: string,
): void {
  const entry = graph.snapshot.entries.find((candidate) => candidate.path === path)!;
  if (!entry) return refuse(`snapshot entry ${path} is missing`);
  if (entry.kind === "directory") {
    const final = join(root, entry.path);
    if (existsSync(final) && !lstatSync(final).isDirectory()) {
      rmSync(final, { recursive: true, force: true });
      syncCandidateDirectory(dirname(final));
    }
    mkdirSync(final, { recursive: true, mode: Number.parseInt(entry.mode, 8) });
    chmodSync(final, Number.parseInt(entry.mode, 8));
    syncCandidateDirectory(dirname(final));
    syncCandidateDirectory(final);
    return;
  }
  if (entry.kind === "absent") {
    removePath(root, entry.path);
    return;
  }
  const final = join(root, entry.path);
  const bytes = staged.get(entry.path);
  if (!bytes) return refuse(`staged source ${entry.path} is missing`);
  if (existsSync(final) && lstatSync(final).isFile() &&
      readFileSync(final).equals(readFileSync(bytes)) &&
      (lstatSync(final).mode & 0o7777) === Number.parseInt(entry.mode, 8)) return;
  replace(root, entry.path, readFileSync(bytes), operationId);
  chmodSync(final, Number.parseInt(entry.mode, 8));
  syncCandidateDirectory(dirname(final));
}

function restorePopulation(
  root: string,
  graph: SnapshotGraph,
  staged: Map<string, string>,
  operationId: string,
  skip: Set<string>,
): string[] {
  const restored: string[] = [];
  const ordinary = inventoryCandidate(root, operationId);
  removeTargetOnly(root, graph, ordinary, operationId);
  const directories = graph.snapshot.entries.filter((entry) => entry.kind === "directory")
    .sort((a, b) => a.path.length - b.path.length);
  for (const entry of directories) {
    if (skip.has(entry.path)) continue;
    restoreEntry(root, graph, staged, entry.path, operationId);
    restored.push(entry.path);
  }
  for (const entry of graph.snapshot.entries) {
    if (entry.kind !== "file" || skip.has(entry.path)) continue;
    restoreEntry(root, graph, staged, entry.path, operationId);
    restored.push(entry.path);
  }
  return restored;
}

function terminalRecord(
  operationId: string,
  graph: SnapshotGraph,
  evidence: RollbackEvidenceV2,
  bridgeDigest: string,
  previous: PreviousVersionsV2,
  recoveryEvidence: { locator: string; sha256: string },
) {
  return RollbackTerminalV2.parse({
    operationId,
    protocolVersion: 2,
    versions: { from: 3, to: 2 },
    outcome: "rolled-back",
    sourceSetDigest: graph.sourceSetDigest,
    bindingDigest: evidence.bindingDigest,
    bridgeDigest,
    evidence: recoveryEvidence,
    previous,
  });
}

export function admitCandidateRollbackEvidence(
  workspace: string,
  operationId: string,
  previousBridgeDigest: string,
  sourceMustMatch = true,
) {
  const root = join(workspace, ".tenet");
  if (existsSync(join(root, "migration-transition.json")) || existsSync(join(root, "migration-recovery-v3.json"))) {
    refuse("rollback evidence is still fenced by transition or recovery state");
  }
  const { graph, evidence, target } = retainedRecords(root, operationId, previousBridgeDigest);
  const terminalPath = join(root, "migration-terminal.json");
  const terminal = readStrict(terminalPath, RollbackTerminalV2);
  const evidencePath = join(root, `migration-evidence-v2/${operationId}/evidence.json`);
  const evidenceSha256 = sha256(readFileSync(evidencePath));
  const markerBytes = sourceBytes(graph, "marker");
  const marker = LegacyMarker.parse(parseUniqueRecord(markerBytes.toString("utf8")));
  if (marker.schema !== 2) refuse("the restored prior marker is not schema 2");
  const state = JSON.parse(sourceBytes(graph, "state").toString("utf8")) as {
    schema?: number; workspaceId?: string; tag?: string;
  };
  if (state.schema !== 2 || state.workspaceId !== marker.workspaceId || state.tag !== marker.tag) {
    refuse("the restored prior state is not exact schema-2 marker state");
  }
  if (terminal.operationId !== operationId || terminal.bridgeDigest !== previousBridgeDigest ||
      terminal.sourceSetDigest !== graph.sourceSetDigest || terminal.bindingDigest !== evidence.bindingDigest ||
      terminal.evidence.locator !== `migration-evidence-v2/${operationId}/evidence.json` ||
      terminal.evidence.sha256 !== evidenceSha256 ||
      evidence.source.sha256 !== graph.sourceManifestSha256 ||
      evidence.snapshot.sha256 !== graph.snapshotSha256 ||
      evidence.target.sha256 !== sha256(readFileSync(join(root, evidence.target.locator))) ||
      evidence.target.targetBaselineDigest !== targetDigest(target) ||
      canonicalCandidateRecord(evidence.previous) !== canonicalCandidateRecord(terminal.previous)) {
    refuse("the restored terminal and retained evidence do not recompute");
  }
  if (sourceMustMatch) requireSourcePopulation(root, operationId, graph);
  else {
    const liveMarker = JSON.parse(readFileSync(join(root, "marker"), "utf8")) as {
      schema?: number; workspaceId?: string; tag?: string;
    };
    const liveState = JSON.parse(readFileSync(join(root, "state"), "utf8")) as {
      schema?: number; workspaceId?: string; tag?: string;
    };
    if (liveMarker.schema !== 2 || liveState.schema !== 2 ||
        liveMarker.workspaceId !== liveState.workspaceId || liveMarker.tag !== liveState.tag) {
      refuse("the postcondition no longer has admitted schema-2 marker/state continuity");
    }
  }
  return {
    terminal: sha256(readFileSync(terminalPath)),
    evidence: evidenceSha256,
    snapshot: graph.snapshotSha256,
    bridgeDigest: previousBridgeDigest,
    bindingDigest: terminal.bindingDigest,
    marker: sha256(markerBytes),
  };
}

export function admitCandidateRollbackProbe(
  workspace: string,
  operationId: string,
  previousBridgeDigest: string,
  request: string,
  maxCalls = 1,
  requireCall = false,
) {
  const root = join(workspace, ".tenet");
  const accepted = existsSync(join(root, `migration-evidence-v2/${operationId}/accepted.json`));
  const admitted = admitCandidateRollbackEvidence(
    workspace, operationId, previousBridgeDigest, !accepted,
  );
  const graph = sourceGraph(root, operationId);
  const markerBytes = sourceBytes(graph, "marker");
  const stateBytes = sourceBytes(graph, "state");
  const previousHash = snapshotHash(graph, "state.prev");
  const markerNow = bytesOrNull(join(root, "marker"));
  if (!markerNow?.equals(markerBytes)) refuse("the ordinary probe changed the restored marker");
  const sourceState = State.parse(parseUniqueRecord(stateBytes.toString("utf8")));
  const currentRaw = readRecord(join(root, "state"));
  if (currentRaw === null) return refuse("the restored state disappeared before the ordinary probe");
  const currentState = State.parse(parseUniqueRecord(currentRaw));
  const unchanged = currentRaw === stateBytes.toString("utf8");
  if (unchanged) admitProbePublicationPrefix(root, graph, sourceState);
  else admitProbeDelta(
    root, graph, sourceState, currentState, stateBytes, request, maxCalls, requireCall,
  );
  return {
    terminal: admitted.terminal,
    evidence: admitted.evidence,
    snapshot: admitted.snapshot,
    bridgeDigest: admitted.bridgeDigest,
    workspaceId: currentState.workspaceId,
    schema: currentState.schema,
    source: {
      marker: sha256(markerBytes),
      state: sha256(stateBytes),
      previous: previousHash,
    },
    alreadyStarted: !unchanged,
  };
}

function admitProbeDelta(
  root: string,
  graph: SnapshotGraph,
  sourceState: ReturnType<typeof State.parse>,
  currentState: ReturnType<typeof State.parse>,
  sourceBytes: Buffer,
  request: string,
  maxCalls: number,
  requireCall: boolean,
): void {
  admitProbeState(root, sourceState, currentState, sourceBytes, request);
  admitProbeJournal(root, graph, sourceState, currentState, maxCalls, requireCall);
}

function admitProbeState(
  root: string,
  sourceState: ReturnType<typeof State.parse>,
  currentState: ReturnType<typeof State.parse>,
  sourceBytes: Buffer,
  request: string,
): void {
  if (readRecord(join(root, "state.prev")) !== sourceBytes.toString("utf8")) {
    refuse("the ordinary probe did not preserve the exact restored state as state.prev");
  }
  const added = Object.keys(currentState.work).filter((id) => !Object.hasOwn(sourceState.work, id));
  if (added.length !== 1 || currentState.revision !== sourceState.revision + 1) {
    refuse("the ordinary probe state delta is not the one proposed plan call");
  }
  const work = currentState.work[added[0]!]!;
  if (work.profile !== "plan" || work.request !== request || work.state !== "proposed" ||
      work.grants.length || work.session.inCall || currentState.sourceOwner) {
    refuse("the ordinary probe created authority or an active process");
  }
  const normalized = {
    ...currentState,
    revision: sourceState.revision,
    generationSeq: sourceState.generationSeq,
    workSeq: sourceState.workSeq,
    work: sourceState.work,
  };
  if (canonicalCandidateRecord(normalized) !== canonicalCandidateRecord(sourceState)) {
    const changed = [...new Set([...Object.keys(sourceState), ...Object.keys(normalized)])].filter((key) =>
      canonicalCandidateRecord(normalized[key as keyof typeof normalized]) !==
      canonicalCandidateRecord(sourceState[key as keyof typeof sourceState]));
    refuse(`the ordinary probe changed facts outside the one plan contract: ${changed.join(",")}`);
  }
}

function sourceJournal(graph: SnapshotGraph): Buffer<ArrayBufferLike> {
  const sourceLog = graph.snapshot.entries.find((entry) => entry.path === "log");
  let before: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  if (sourceLog?.kind === "file") {
    const object = graph.objects.get(sourceLog.sha256);
    if (!object) return refuse("the ordinary probe source journal object is missing");
    before = object;
  }
  return before;
}

function admitProbeJournal(
  root: string,
  graph: SnapshotGraph,
  sourceState: ReturnType<typeof State.parse>,
  currentState: ReturnType<typeof State.parse>,
  maxCalls: number,
  requireCall: boolean,
): void {
  const before = sourceJournal(graph);
  const currentLog = bytesOrNull(join(root, "log")) ?? Buffer.alloc(0);
  if (currentLog.length < before.length || !currentLog.subarray(0, before.length).equals(before)) {
    refuse("the ordinary probe did not retain the exact source journal prefix");
  }
  const appended = currentLog.subarray(before.length).toString("utf8").split("\n").filter(Boolean);
  const checkpoints: Array<ReturnType<typeof AccountingCheckpoint.parse>> = [];
  let calls = 0;
  for (const line of appended) {
    const call = parseUniqueRecord(line);
    if (call && typeof call === "object" && (call as { kind?: unknown }).kind === "accounting") {
      checkpoints.push(AccountingCheckpoint.parse(call));
      continue;
    }
    admitProbeCall(line);
    calls++;
  }
  const checkpointCount = checkpoints.length;
  if (checkpointCount < 1 || checkpointCount > 2 ||
      currentState.workSeq !== sourceState.workSeq + checkpointCount ||
      currentState.generationSeq !== sourceState.generationSeq + checkpointCount ||
      calls > maxCalls || (requireCall && calls === 0)) {
    refuse("the ordinary probe appended an unexpected journal delta");
  }
  if (checkpointCount === 1) {
    const { t: _t, ...body } = checkpoints[0]!;
    if (canonicalCandidateRecord(body) !== canonicalCandidateRecord(accountingCheckpoint(currentState, sourceState))) {
      refuse("the ordinary probe accounting checkpoint does not match its admitted state delta");
    }
  } else {
    if (!admitProbePrefix(checkpoints[0]!, sourceState)) {
      refuse("the ordinary probe's recovered accounting prefix is invalid");
    }
    const recovered = State.parse({
      ...sourceState, workSeq: sourceState.workSeq + 1, generationSeq: sourceState.generationSeq + 1,
    });
    const { t: _t, ...body } = checkpoints[1]!;
    if (canonicalCandidateRecord(body) !== canonicalCandidateRecord(accountingCheckpoint(currentState, recovered))) {
      refuse("the recovered ordinary probe checkpoint does not match its retry delta");
    }
  }
}

function admitProbePublicationPrefix(
  root: string,
  graph: SnapshotGraph,
  sourceState: ReturnType<typeof State.parse>,
): void {
  const sourceLog = graph.snapshot.entries.find((entry) => entry.path === "log");
  let before: Buffer<ArrayBufferLike> = Buffer.alloc(0);
  if (sourceLog?.kind === "file") {
    const object = graph.objects.get(sourceLog.sha256);
    if (!object) return refuse("the ordinary probe source journal object is missing");
    before = object;
  }
  const currentLog = bytesOrNull(join(root, "log")) ?? Buffer.alloc(0);
  if (currentLog.length === before.length && currentLog.equals(before)) return;
  if (currentLog.length < before.length || !currentLog.subarray(0, before.length).equals(before)) {
    refuse("the ordinary probe publication changed the source journal prefix");
  }
  const appended = currentLog.subarray(before.length).toString("utf8").split("\n").filter(Boolean);
  if (appended.length !== 1) refuse("the ordinary probe publication has an unexpected journal prefix");
  const parsed = AccountingCheckpoint.parse(parseUniqueRecord(appended[0]!));
  if (!admitProbePrefix(parsed, sourceState)) {
    refuse(`the ordinary probe accounting prefix does not match its source counters: `
      + `${parsed.revision}/${sourceState.revision},${parsed.workSeq}/${sourceState.workSeq},`
      + `${parsed.generationSeq}/${sourceState.generationSeq},complete=${parsed.complete},`
      + `inFlight=${parsed.inFlight.length},entries=${parsed.entries.length},`
      + `generation=${parsed.entries[0]?.generation},budget=${canonicalCandidateRecord(parsed.entries[0]?.budget)}`);
  }
}

function admitProbePrefix(
  parsed: ReturnType<typeof AccountingCheckpoint.parse>,
  sourceState: ReturnType<typeof State.parse>,
): boolean {
  if (parsed.workspaceId !== sourceState.workspaceId ||
      parsed.revision !== sourceState.revision + 1 ||
      parsed.workSeq !== sourceState.workSeq + 1 ||
      parsed.generationSeq !== sourceState.generationSeq + 1 ||
      parsed.complete !== true || parsed.inFlight.length !== 0 || parsed.entries.length !== 1) return false;
  const entry = parsed.entries[0]!;
  const timing = {
    active: entry.budget.activeMinutesSinceCheckIn,
    total: entry.budget.activeMinutesTotal,
    last: entry.budget.lastCall,
  };
  const comparable = {
    ...entry.budget, activeMinutesSinceCheckIn: 0, activeMinutesTotal: 0, lastCall: undefined,
  };
  if (!/^wk_[a-z2-7]{10}$/.test(entry.work) || entry.generation !== sourceState.generationSeq + 1 ||
      !Number.isFinite(timing.active) || timing.active < 0 || timing.active !== timing.total ||
      timing.last?.exit !== 0 || typeof timing.last?.at !== "string" ||
      canonicalCandidateRecord(comparable) !== canonicalCandidateRecord(newBudget())) {
    return false;
  }
  return true;
}

function admitProbeCall(line: string): void {
  const call = parseUniqueRecord(line);
  if (!call || typeof call !== "object" || (call as { kind?: unknown }).kind !== "call" ||
      (call as { verb?: unknown }).verb !== "open" || (call as { exit?: unknown }).exit !== 0) {
    refuse("the ordinary probe appended a non-call or unsuccessful journal record");
  }
}

export function admitMigrationTerminal(
  root: string,
  path: string,
  bridgeDigest?: string,
  accept = false,
): void {
  const text = bridgeDigest ? readRecord(path) : null;
  const terminal = bridgeDigest
    ? text === null ? null : parseBridgeTerminal(text)
    : readTerminal(path);
  if (!terminal) return;
  if (terminal.outcome !== "rolled-back") {
    throw new KernelError("unsupported-record", "owned state needs a compatible kernel; nothing was changed");
  }

  function parseBridgeTerminal(text: string) {
    try {
      const raw = parseUniqueRecord(text);
      const protocol = raw && typeof raw === "object" && "protocolVersion" in raw
        ? (raw as { protocolVersion?: unknown }).protocolVersion
        : undefined;
      return protocol === 2 ? RollbackTerminalV2.parse(raw) : Terminal.parse(raw);
    } catch {
      throw new KernelError("unsupported-record", "the migration terminal record is invalid");
    }
  }
  if ("protocolVersion" in terminal && terminal.protocolVersion === 2) {
    if (!bridgeDigest || bridgeDigest !== terminal.bridgeDigest) {
      throw new KernelError("unsupported-record", "owned state needs a compatible kernel; nothing was changed");
    }
    const evidenceDir = join(root, ".tenet", `migration-evidence-v2/${terminal.operationId}`);
    const final = join(evidenceDir, "postcondition.json");
    const accepted = join(evidenceDir, "accepted.json");
    if (existsSync(final)) admitCompletedBridge(root, terminal.operationId, terminal);
    else {
      if (existsSync(accepted)) admitCandidateAcceptance(root, terminal.operationId, terminal.bridgeDigest, false);
      else admitCandidateRollbackEvidence(root, terminal.operationId, terminal.bridgeDigest);
    }
    if (accept && !existsSync(accepted)) {
      acceptCandidateRollbackUnlocked(root, terminal.operationId, terminal.bridgeDigest);
    }
  }
}

export function admitCandidateCleanupEvidence(
  workspace: string,
  operationId: string,
  expected: { terminal: string; evidence: string; snapshot: string; bridgeDigest: string; bindingDigest: string },
): void {
  const root = join(workspace, ".tenet");
  const evidencePath = join(root, `migration-evidence-v2/${operationId}/evidence.json`);
  if (!existsSync(evidencePath)) refuse("cleanup evidence is missing");
  const terminalPath = join(root, "migration-terminal.json");
  const terminal = readStrict(terminalPath, RollbackTerminalV2);
  const evidence = readStrict(evidencePath, RollbackEvidenceV2);
  const evidenceHash = sha256(readFileSync(evidencePath));
  const targetPath = join(root, `migration-evidence-v2/${operationId}/target.json`);
  if (terminal.operationId !== operationId || evidence.operationId !== operationId ||
      expected.terminal !== sha256(readFileSync(terminalPath)) || expected.evidence !== evidenceHash ||
      terminal.bridgeDigest !== expected.bridgeDigest || evidence.bridgeDigest !== expected.bridgeDigest ||
      terminal.bindingDigest !== expected.bindingDigest ||
      terminal.evidence.locator !== `migration-evidence-v2/${operationId}/evidence.json` ||
      terminal.evidence.sha256 !== evidenceHash || terminal.sourceSetDigest !== evidence.source.sourceSetDigest ||
      terminal.bindingDigest !== evidence.bindingDigest ||
      evidence.snapshot.sha256 !== expected.snapshot ||
      (existsSync(targetPath) && sha256(readFileSync(targetPath)) !== evidence.target.sha256) ||
      evidence.bindingDigest !== bindingDigestParts(
        evidence.source.sourceSetDigest, evidence.target.targetBaselineDigest,
        evidence.markerIdentity, evidence.previous,
      )) {
    refuse("the retained cleanup evidence no longer matches the terminal or postcondition");
  }
  const snapshot = join(root, evidence.snapshot.locator);
  if (!existsSync(snapshot) || sha256(readFileSync(snapshot)) !== expected.snapshot) {
    refuse("the retained source snapshot changed after postcondition success");
  }
}

function acceptCandidateRollbackUnlocked(
  workspace: string,
  operationId: string,
  previousBridgeDigest: string,
) {
  const root = join(workspace, ".tenet");
  const admitted = admitCandidateRollbackEvidence(workspace, operationId, previousBridgeDigest);
  const accepted = RollbackTerminalAcceptedV2.parse({
    format: 2,
    operationId,
    terminal: admitted.terminal,
    evidence: admitted.evidence,
    bridgeDigest: previousBridgeDigest,
    bindingDigest: admitted.bindingDigest,
  });
  const bytes = Buffer.from(canonicalCandidateRecord(accepted));
  const directory = join(root, `migration-evidence-v2/${operationId}`);
  const final = join(directory, "accepted.json");
  if (existsSync(final)) {
    if (!readFileSync(final).equals(bytes)) refuse("the existing terminal acceptance differs");
    syncCandidateFile(final);
    syncCandidateDirectory(directory);
  } else {
    const temp = `${final}.tmp`;
    if (existsSync(temp)) {
      if (!readFileSync(temp).equals(bytes)) refuse("the terminal acceptance temporary record differs");
      syncCandidateFile(temp);
    } else writeCandidateFile(temp, bytes, true);
    renameSync(temp, final);
    syncCandidateDirectory(directory);
  }
  const reread = RollbackTerminalAcceptedV2.parse(parseUniqueRecord(readFileSync(final, "utf8")));
  if (canonicalCandidateRecord(reread) !== bytes.toString("utf8")) {
    refuse("the terminal acceptance did not re-admit");
  }
  return { acceptance: sha256(bytes), terminal: admitted.terminal, evidence: admitted.evidence,
    snapshot: admitted.snapshot, bridgeDigest: previousBridgeDigest };
}

export function acceptCandidateRollback(
  workspace: string,
  operationId: string,
  previousBridgeDigest: string,
) {
  return withCandidateLocks(workspace, operationId, () =>
    acceptCandidateRollbackUnlocked(workspace, operationId, previousBridgeDigest));
}

function admitRollbackContext(workspace: string, options: RestoreOptions) {
  const root = join(workspace, ".tenet");
  const retained = retainedRecords(root, options.operationId, options.previousBridgeDigest);
  const { graph, recovery, target } = retained;
  const observed = readQualifiedDirectoryIdentity(root, options.qualification);
  const { bindingKind: _bindingKind, keyId: _keyId, ...recordedIdentity } = retained.evidence.markerIdentity;
  const expectedIdentity = DirectoryIdentity.parse(recordedIdentity);
  if (!sameDirectoryIdentity(observed, expectedIdentity)) refuse("the rollback root identity changed");
  const marker = JSON.parse(readFileSync(join(root, "marker"), "utf8")) as { schema?: number };
  if (marker.schema === 3) verifyCandidateMarker(MarkerV3.parse(marker), options.binding);
  const terminalPath = join(root, "migration-terminal.json"), transitionPath = join(root, "migration-transition.json");
  if (!existsSync(transitionPath) && existsSync(terminalPath) && !recovery) {
    requireSourcePopulation(root, options.operationId, graph);
    readStrict(terminalPath, RollbackTerminalV2);
    return { ...retained, root, terminalPath, transitionPath, current: null };
  }
  if (!existsSync(transitionPath)) {
    exactTarget(root, options.operationId, target);
    if (!recovery) refuse("rollback eligibility disappeared before a transition");
  } else exactRestorePrefix(root, options.operationId, graph, target);
  const current = existsSync(transitionPath)
    ? readStrict(transitionPath, MarkerTransitionV3)
    : beginRollback(root, options.operationId, graph, options.previousBridgeDigest);
  if (current.kind !== "migration-rollback" || current.operationId !== options.operationId) {
    refuse("the rollback transition does not name this operation");
  }
  if (!existsSync(transitionPath)) {
    replace(root, "migration-transition.json", Buffer.from(canonicalCandidateRecord(current)), options.operationId);
  }
  return { ...retained, root, terminalPath, transitionPath, current };
}

function restoreRollbackPrefix(context: ReturnType<typeof admitRollbackContext>, options: RestoreOptions) {
  const { root, graph, current: started } = context;
  if (!started) return { current: null, restored: [] as string[] };
  let current = started;
  const primaryPaths = new Set(["state", "marker"]);
  const previousPaths = new Set(graph.snapshot.entries
    .filter((entry) => entry.kind === "file" && !primaryPaths.has(entry.path))
    .map((entry) => entry.path));
  const staged = stageSource(root, graph, options.operationId, previousPaths);
  if (current.phase === "rollback-prepared") current = setTransition(root, current, "rollback-previous-staged");
  for (const [path, stage] of stageSource(root, graph, options.operationId, primaryPaths)) staged.set(path, stage);
  if (!staged.has("state") || !staged.has("marker")) refuse("the primary state and marker are not both staged");
  if (["rollback-prepared", "rollback-previous-staged"].includes(current.phase)) {
    current = setTransition(root, current, "rollback-primary-staged");
  }
  const before = ["rollback-prepared", "rollback-previous-staged", "rollback-primary-staged"].includes(current.phase);
  const restored = before ? restorePopulation(root, graph, staged, options.operationId, primaryPaths) : [];
  if (before) current = setTransition(root, current, "rollback-previous-restored");
  if (current.phase === "rollback-previous-restored") {
    restoreEntry(root, graph, staged, "state", options.operationId);
    restored.push("state");
    current = setTransition(root, current, "rollback-primary-restored");
  }
  if (current.phase === "rollback-primary-restored") {
    removePath(root, "migration-recovery-v3.json");
    current = setTransition(root, current, "rollback-recovery-removed");
  }
  if (current.phase === "rollback-recovery-removed") {
    restoreEntry(root, graph, staged, "marker", options.operationId);
    current = setTransition(root, current, "rollback-marker-restored");
  }
  restored.push("marker");
  return { current, restored };
}

function finishRollback(
  context: ReturnType<typeof admitRollbackContext>,
  options: RestoreOptions,
  current: MarkerTransition,
): void {
  const { root, graph, recovery, evidence, terminalPath, transitionPath } = context;
  const recoveryEvidence = recovery?.evidence ?? {
    locator: `migration-evidence-v2/${options.operationId}/evidence.json`,
    sha256: sha256(readFileSync(join(root, `migration-evidence-v2/${options.operationId}/evidence.json`))),
  };
  const terminal = terminalRecord(
    options.operationId, graph, evidence, options.previousBridgeDigest, evidence.previous, recoveryEvidence,
  );
  const expected = Buffer.from(canonicalCandidateRecord(terminal));
  requireSourcePopulation(root, options.operationId, graph, {
    path: `migration-terminal.json.tmp-${options.operationId}`,
    bytes: expected,
  });
  if (existsSync(terminalPath)) {
    if (!readFileSync(terminalPath).equals(expected)) refuse("the existing rollback terminal differs");
    syncCandidateFile(terminalPath);
    syncCandidateDirectory(root);
  } else replace(root, "migration-terminal.json", expected, options.operationId);
  setTransition(root, current, "rollback-terminal-published");
  rmSync(transitionPath);
  syncCandidateDirectory(root);
}

function restoreCandidateSnapshotUnlocked(
  workspace: string,
  options: RestoreOptions,
): { restored: string[]; snapshotSha256: string } {
  const context = admitRollbackContext(workspace, options);
  const progress = restoreRollbackPrefix(context, options);
  if (!progress.current) return { restored: [], snapshotSha256: context.graph.snapshotSha256 };
  finishRollback(context, options, progress.current);
  return { restored: progress.restored, snapshotSha256: context.graph.snapshotSha256 };
}

export function publishCandidateTarget(
  workspace: string,
  options: PublishOptions,
): ReturnType<typeof publishCandidateTargetUnlocked> {
  return withCandidateLocks(workspace, options.operationId, () => publishCandidateTargetUnlocked(workspace, options));
}

export function restoreCandidateSnapshot(
  workspace: string,
  options: RestoreOptions,
): ReturnType<typeof restoreCandidateSnapshotUnlocked> {
  return withCandidateLocks(workspace, options.operationId, () => restoreCandidateSnapshotUnlocked(workspace, options));
}
