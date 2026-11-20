import { isUtf8 } from "node:buffer";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import { parseUniqueRecord } from "../core/private-record.ts";
import { JournalIndexV1 } from "../core/storage-records.ts";
import type { FileProof } from "../core/storage-records.ts";
import type { RetentionProjection } from "../core/retention-original-action.ts";
import type { RetentionProgress } from "../core/retention-records.ts";
import { RetentionProgressStore } from "./retention-progress-fs.ts";
import type { ProgressImage } from "./retention-progress-fs.ts";
import { StorageV3Files } from "./storage-v3-write.ts";

export type RotationBoundary = "reservation-verified" | "source-renamed" | "next-renamed" | "index-published" | "gate-rotated" | "scan";
const refused = () => new KernelError(
  "storage-accounting-unknown", "the retained rotation does not match its bound source, next file and index", { exit: 2 },
);
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);
export type RotationReservation = RetentionProgress<RetentionProjection>["rotation"]["next"];
export type RotationIndexReservation = RetentionProgress<RetentionProjection>["rotation"]["indexTemp"];
export type VerifyRotationReservation = (
  reservation: RotationReservation, observedPath: "log" | "log.next",
  index: RotationIndexReservation, indexPath: "rotation-index.tmp" | "journal-index.json",
) => boolean;

/** Resumes the signed identity-bound prefix; initial next-file authorization is a separate gate. */
export function rotateBoundGeneration<P extends RetentionProjection>(
  files: StorageV3Files, store: RetentionProgressStore<P>, afterIndexBytes: Buffer,
  verifyReservation: VerifyRotationReservation,
  boundary: (phase: RotationBoundary) => void = () => {},
): ProgressImage<P> {
  let current = store.load();
  if (!current) throw refused();
  files.requireAtomicMove();
  admitRotation(files, current.record, afterIndexBytes, verifyReservation);
  files.sync();
  const row = current.record;
  const nextIdentity = row.rotation.next.identity;
  const sourceProof: FileProof = {
    path: row.rotation.sealedPath, ...row.source,
  };
  if (row.sealGate.state === "rotated") {
    verifyRotated(files, current, afterIndexBytes);
    return store.update(current, { ...row, phase: "scan" });
  }

  current = prepareNext(files, store, current, boundary);
  const active = files.read("log"), sealed = files.read(row.rotation.sealedPath);
  if (sealed) files.verify(sourceProof);
  else {
    if (!active) throw refused();
    files.verify({ ...sourceProof, path: "log" });
    files.move({ ...sourceProof, path: "log" }, row.rotation.sealedPath);
    boundary("source-renamed");
  }
  admitRotation(files, row, afterIndexBytes, verifyReservation);
  const next = files.read("log.next");
  const empty: FileProof = { path: "log", identity: nextIdentity, bytes: 0, sha256: sha256("") };
  if (next) {
    files.absent("log");
    files.move({ ...empty, path: "log.next" }, "log");
    boundary("next-renamed");
  } else files.verify(empty);
  admitRotation(files, row, afterIndexBytes, verifyReservation);
  publishIndex(files, row.rotation.indexTemp, afterIndexBytes);
  boundary("index-published");
  admitRotation(files, row, afterIndexBytes, verifyReservation);
  verifyRotated(files, current, afterIndexBytes);
  current = store.update(current, {
    ...current.record, sealGate: { ...current.record.sealGate, state: "rotated", rotateAfterHash: row.rotation.indexAfterHash },
  });
  boundary("gate-rotated");
  current = store.update(current, { ...current.record, phase: "scan" });
  boundary("scan");
  return current;
}

export function admitRotation<P extends RetentionProjection>(
  files: StorageV3Files, row: RetentionProgress<P>, bytes: Buffer, verify: VerifyRotationReservation,
): void {
  if (row.phase !== "seal" || row.sealGate.state === "cancelled" ||
    !isUtf8(bytes) || sha256(bytes) !== row.rotation.indexAfterHash) throw refused();
  const after = JournalIndexV1.safeParse(parseUniqueRecord(bytes.toString("utf8")));
  if (!after.success || bytes.toString("utf8") !== stableStringify(after.data) + "\n") throw refused();
  const selected = after.data.sealed.find(item => item.id === row.generationId);
  if (!selected || !same({ path: selected.path, identity: selected.identity, bytes: selected.bytes, sha256: selected.sha256 },
    { path: row.rotation.sealedPath, ...row.source }) ||
    !same(after.data.active.identity, row.rotation.next.identity)) throw refused();
  const before = {
    ...after.data, active: { path: "log", identity: row.source.identity },
    sealed: after.data.sealed.filter(item => item.id !== row.generationId),
  };
  if (sha256(stableStringify(before) + "\n") !== row.rotation.indexBeforeHash) throw refused();
  preflight(files, row);
  admitPrefix(files, row, verify);
}

function admitPrefix<P extends RetentionProjection>(
  files: StorageV3Files, row: RetentionProgress<P>, verify: VerifyRotationReservation,
): void {
  const source = files.read(row.rotation.sealedPath), active = files.read("log"), next = files.read("log.next");
  const index = files.read("journal-index.json");
  const temporary = files.read("rotation-index.tmp");
  if (!index) throw refused();
  const sourceAt = (path: string) => ({ path, ...row.source });
  const emptyAt = (path: string) => ({ path, identity: row.rotation.next.identity, bytes: 0, sha256: sha256("") });
  const matches = (file: ReturnType<StorageV3Files["read"]>, proof: FileProof) => !!file && same(file.proof, proof);
  const temp = row.rotation.indexTemp;
  const tempProof: FileProof = { path: temp.path, identity: temp.identity, bytes: temp.bytes, sha256: temp.sha256 };
  const before = same(index.proof, temp.authorization.indexBefore) && matches(temporary, tempProof);
  const after = !temporary && matches(index, { ...tempProof, path: "journal-index.json" });
  const initial = !source && matches(active, sourceAt("log")) && matches(next, emptyAt("log.next")) && before;
  const renamed = matches(source, sourceAt(row.rotation.sealedPath)) && !active && matches(next, emptyAt("log.next")) && before;
  const promoted = matches(source, sourceAt(row.rotation.sealedPath)) && matches(active, emptyAt("log")) && !next && (before || after);
  if (!(initial || renamed || promoted) || (row.sealGate.state === "rotated" && !(promoted && after)) ||
    verify(structuredClone(row.rotation.next), promoted ? "log" : "log.next",
      structuredClone(temp), after ? "journal-index.json" : "rotation-index.tmp") !== true) throw refused();
}

function preflight<P extends RetentionProjection>(files: StorageV3Files, row: RetentionProgress<P>): void {
  const sealed = files.read(row.rotation.sealedPath);
  files.verify({ path: sealed ? row.rotation.sealedPath : "log", ...row.source });
  for (const proof of [row.publisherProof.current, row.publisherProof.previous]) {
    const state = files.read(proof.path);
    if (!state || !same(state.proof.identity, proof.identity) || state.proof.sha256 !== proof.hash) throw refused();
  }
  const summary = files.read("summaries.json");
  if (!summary || summary.proof.sha256 !== row.summary.beforeHash) throw refused();
}

function prepareNext<P extends RetentionProjection>(
  files: StorageV3Files, store: RetentionProgressStore<P>, current: ProgressImage<P>,
  boundary: (phase: RotationBoundary) => void,
): ProgressImage<P> {
  const row = current.record, next = files.read("log.next");
  if (!next) {
    files.verify({ path: "log", identity: row.rotation.next.identity, bytes: 0, sha256: sha256("") });
    return current;
  }
  const expected = { path: "log.next", identity: row.rotation.next.identity, bytes: 0, sha256: sha256("") };
  files.verify(expected);
  const reloaded = store.load();
  if (!reloaded || !same(reloaded.proof, current.proof)) throw refused();
  boundary("reservation-verified");
  return current;
}

function publishIndex(files: StorageV3Files, temporary: RotationIndexReservation, bytes: Buffer): void {
  const index = files.read("journal-index.json");
  if (!index) throw refused();
  const staged = { path: temporary.path, identity: temporary.identity, bytes: temporary.bytes, sha256: temporary.sha256 };
  if (!files.read(temporary.path)) {
    files.verify({ ...staged, path: "journal-index.json" });
    if (!index.bytes.equals(bytes)) throw refused();
    return;
  }
  files.verify(temporary.authorization.indexBefore);
  if (!files.verify(staged).bytes.equals(bytes)) throw refused();
  files.replaceStaged("journal-index.json", temporary.authorization.indexBefore, staged);
}

function verifyRotated<P extends RetentionProjection>(
  files: StorageV3Files, current: ProgressImage<P>, index: Buffer,
): void {
  const row = current.record;
  files.verify({ path: row.rotation.sealedPath, ...row.source });
  files.verify({ path: "log", identity: row.rotation.next.identity, bytes: 0, sha256: sha256("") });
  files.absent("log.next");
  const observed = files.read("journal-index.json");
  if (!observed?.bytes.equals(index)) throw refused();
  files.absent("rotation-index.tmp");
  files.verify({
    path: "journal-index.json", identity: row.rotation.indexTemp.identity,
    bytes: row.rotation.indexTemp.bytes, sha256: row.rotation.indexTemp.sha256,
  });
}
