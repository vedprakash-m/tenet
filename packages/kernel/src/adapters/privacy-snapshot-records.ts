import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readdirSync, renameSync, writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import {
  MigrationFileTupleV3, ProviderSnapshotAttestationV3, PrivacyForwardTransitionV3,
} from "../core/schemas-migrate.ts";
import { parseUniqueRecord, readRecord, MAX_RECORD } from "./private-record-fs.ts";

export const snapshotRefusal = (): never => {
  throw new KernelError("storage-accounting-unknown", "The private snapshot operation cannot prove its exact publication.");
};

export function readSnapshotRecord(path: string): unknown | null {
  const stat = lstatSync(path, { bigint: true, throwIfNoEntry: false });
  if (!stat) return null;
  if (!stat.isFile() || stat.nlink !== 1n || stat.isSymbolicLink()) return snapshotRefusal();
  try {
    const text = readRecord(path);
    if (text === null) return snapshotRefusal();
    return parseUniqueRecord(text);
  } catch { return snapshotRefusal(); }
}

function writeExclusive(path: string, value: unknown): void {
  const text = stableStringify(value);
  if (Buffer.byteLength(text) > MAX_RECORD) snapshotRefusal();
  const fd = openSync(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    const stat = fstatSync(fd, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n) snapshotRefusal();
    writeFileSync(fd, text); fsyncSync(fd);
  } finally { closeSync(fd); }
}

function syncFile(path: string): void {
  const before = lstatSync(path, { bigint: true });
  if (!before.isFile() || before.nlink !== 1n || before.isSymbolicLink()) snapshotRefusal();
  const fd = openSync(path, constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.nlink !== 1n || opened.dev !== before.dev || opened.ino !== before.ino) snapshotRefusal();
    fsyncSync(fd);
    const after = lstatSync(path, { bigint: true });
    if (!after.isFile() || after.nlink !== 1n || after.dev !== before.dev || after.ino !== before.ino) snapshotRefusal();
  } finally { closeSync(fd); }
}

export function attestationDirectory(
  dir: string, operationId: string, sync: (path: string) => void, create = true,
): string {
  let current = dir;
  const root = lstatSync(dir, { bigint: true });
  for (const component of ["migration-evidence-v2", operationId]) {
    const next = join(current, component);
    const stat = lstatSync(next, { bigint: true, throwIfNoEntry: false });
    if (stat && (!stat.isDirectory() || stat.isSymbolicLink() || stat.dev !== root.dev)) snapshotRefusal();
    if (!stat && !create) snapshotRefusal();
    if (!stat) mkdirSync(next, { mode: 0o700 });
    const before = lstatSync(next, { bigint: true });
    if (!before.isDirectory() || before.isSymbolicLink() || before.dev !== root.dev) snapshotRefusal();
    sync(current);
    const after = lstatSync(next, { bigint: true });
    if (!after.isDirectory() || after.isSymbolicLink() || after.dev !== before.dev ||
        after.ino !== before.ino || after.birthtimeNs !== before.birthtimeNs) snapshotRefusal();
    current = next;
  }
  return current;
}

export function admitSnapshotBefore(dir: string, draft: Omit<PrivacyForwardTransitionV3, "snapshot">): void {
  const expectedTemps = new Set([
    ...draft.privacy.targets.map(target => target.tempPath), draft.privacy.keyRecord.tempPath,
    `migration-transition.json.tmp-${draft.operationId}`,
  ]);
  if (readdirSync(dir).some(name => /\.tmp(?:$|[-.])/.test(name) && !expectedTemps.has(name))) snapshotRefusal();
  for (const path of ["digest.key", "journal-index.json", "migration-recovery-v3.json"])
    if (lstatSync(join(dir, path), { throwIfNoEntry: false })) snapshotRefusal();
  const tuples = [...draft.privacy.targets.map(target => target.before), draft.privacy.journal.before];
  for (const before of tuples) {
    const stat = lstatSync(join(dir, before.path), { bigint: true, throwIfNoEntry: false });
    if (before.presence === "absent") { if (stat) snapshotRefusal(); continue; }
    if (!stat || !stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1n ||
        !isDeepStrictEqual(before.identity, { dev: String(stat.dev), ino: String(stat.ino), type: "file", links: 1 }))
      snapshotRefusal();
  }
}

export function publishAttestation(
  path: string, expected: ProviderSnapshotAttestationV3, sync: (path: string) => void,
): MigrationFileTupleV3 {
  const record = ProviderSnapshotAttestationV3.parse(expected), existing = readSnapshotRecord(path);
  if (existing === null) writeExclusive(path, record);
  else {
    if (!isDeepStrictEqual(ProviderSnapshotAttestationV3.safeParse(existing).data, record)) snapshotRefusal();
    syncFile(path);
  }
  sync(dirname(path));
  if (!isDeepStrictEqual(readSnapshotRecord(path), record)) snapshotRefusal();
  const { stat, text } = admittedAttestationText(path, record);
  return MigrationFileTupleV3.parse({
    presence: "present", path: `migration-evidence-v2/${record.operationId}/source.json`,
    identity: { dev: String(stat.dev), ino: String(stat.ino), type: "file", links: 1 },
    bytes: String(stat.size), sha256: sha256(text), schema: 3,
  });
}

function admittedAttestationText(path: string, expected: ProviderSnapshotAttestationV3) {
  try {
    const before = lstatSync(path, { bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.isSymbolicLink()) return snapshotRefusal();
    const text = readRecord(path, false, false, fd => {
      const opened = fstatSync(fd, { bigint: true });
      if (opened.dev !== before.dev || opened.ino !== before.ino) snapshotRefusal();
    });
    if (text === null) return snapshotRefusal();
    const parsed = ProviderSnapshotAttestationV3.safeParse(parseUniqueRecord(text));
    if (!parsed.success || !isDeepStrictEqual(parsed.data, expected)) return snapshotRefusal();
    const stat = lstatSync(path, { bigint: true });
    if (!stat.isFile() || stat.nlink !== 1n || stat.dev !== before.dev || stat.ino !== before.ino ||
        stat.size !== before.size || stat.mtimeNs !== before.mtimeNs || stat.ctimeNs !== before.ctimeNs)
      return snapshotRefusal();
    return { stat, text };
  } catch { return snapshotRefusal(); }
}

export function publishSnapshotTransition(
  dir: string, expected: PrivacyForwardTransitionV3, sync: (path: string) => void,
): PrivacyForwardTransitionV3 {
  const record = PrivacyForwardTransitionV3.parse(expected);
  const final = join(dir, "migration-transition.json"), temp = `${final}.tmp-${record.operationId}`;
  const staged = readSnapshotRecord(temp);
  if (staged === null) writeExclusive(temp, record);
  else {
    if (!isDeepStrictEqual(staged, record)) snapshotRefusal();
    syncFile(temp);
    if (!isDeepStrictEqual(readSnapshotRecord(temp), record)) snapshotRefusal();
  }
  renameSync(temp, final); sync(dir);
  const parsed = PrivacyForwardTransitionV3.safeParse(readSnapshotRecord(final));
  if (!parsed.success || !isDeepStrictEqual(parsed.data, record)) return snapshotRefusal();
  return parsed.data;
}
