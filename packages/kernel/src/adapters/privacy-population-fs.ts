import { isUtf8 } from "node:buffer";
import { KernelError } from "../core/errors.ts";
import { stableStringify } from "../core/ids.ts";
import {
  admitPopulationPhase, PrivacyMigrationTransitionV3,
  type PopulationObservation, type PrivacyTransitionV3,
} from "../core/migration-transition.ts";
import { parseUniqueRecord } from "../core/private-record.ts";
import type { FileProof } from "../core/storage-records.ts";
import { DigestKeyFiles } from "./digest-key-fs.ts";
import { StorageV3Files } from "./storage-v3-write.ts";

const NAME = "migration-transition.json";
const same = (a: unknown, b: unknown) => stableStringify(a) === stableStringify(b);
const refused = () => new KernelError(
  "storage-accounting-unknown", "the coupled privacy population or its admission changed; publication is held", { exit: 2 },
);
type Tuple = PrivacyTransitionV3["privacy"]["journal"]["before"];
type Image = { record: PrivacyTransitionV3; proof: FileProof };
const proofOf = (tuple: Tuple, path = tuple.path): FileProof => {
  if (tuple.presence !== "present" || !("bytes" in tuple) || !("sha256" in tuple)) throw refused();
  const bytes = Number(tuple.bytes);
  if (!Number.isSafeInteger(bytes)) throw refused();
  return { path, identity: tuple.identity, bytes, sha256: tuple.sha256 };
};

/** Fresh/repair population only. Migration snapshots and P92 invalidation remain separate required admissions. */
export class PrivacyPopulationWriter {
  private files: StorageV3Files;
  private keys: DigestKeyFiles;
  private verify: (row: PrivacyTransitionV3) => boolean;
  constructor(files: StorageV3Files, keys: DigestKeyFiles, verify: (row: PrivacyTransitionV3) => boolean) {
    this.files = files; this.keys = keys; this.verify = verify;
  }
  private admit(raw: unknown): PrivacyTransitionV3 {
    const parsed = PrivacyMigrationTransitionV3.safeParse(raw);
    if (!parsed.success || !same(raw, parsed.data) || parsed.data.kind === "migration-forward") throw refused();
    const row = structuredClone(parsed.data), before = stableStringify(row);
    if (this.verify(row) !== true || stableStringify(row) !== before) throw refused();
    return structuredClone(row);
  }
  load(): Image | null {
    const current = this.files.read(NAME);
    if (!current) return null;
    if (!isUtf8(current.bytes)) throw refused();
    let raw: unknown;
    try { raw = parseUniqueRecord(current.bytes.toString("utf8")); } catch { throw refused(); }
    const record = this.admit(raw);
    if (current.bytes.toString("utf8") !== stableStringify(record) + "\n") throw refused();
    return { record, proof: current.proof };
  }
  private observedTuple(before: Tuple, after = before): Tuple {
    if ("privateCopy" in before || "privateCopy" in after) throw refused();
    const current = this.files.read(before.path);
    for (const tuple of [before, after]) {
      if (tuple.presence === "absent" ? current === null : current && same(current.proof, proofOf(tuple))) return tuple;
    }
    throw refused();
  }
  private observation(row: PrivacyTransitionV3): PopulationObservation {
    return {
      targets: Object.fromEntries(row.privacy.targets.map(target =>
        [target.path, this.observedTuple(target.before, target.after)])),
      key: this.keys.read("digest.key") ?? row.privacy.keyRecord.before,
      journal: this.observedTuple(row.privacy.journal.before),
    };
  }
  private current(expected: Image): Image {
    const image = this.load();
    if (!image || !same(image.proof, expected.proof) ||
      !admitPopulationPhase(image.record, this.observation(image.record))) throw refused();
    return image;
  }
  prepare(raw: unknown): Image {
    this.files.requireAtomicMove();
    const row = this.admit(raw);
    if (row.phase !== "prepared" || !admitPopulationPhase(row, this.observation(row)) ||
      this.keys.read("digest.key") !== null) throw refused();
    if (!same(this.keys.read(row.privacy.keyRecord.tempPath), row.privacy.keyRecord.after)) throw refused();
    for (const target of row.privacy.targets) {
      if (!same(target.before, target.after)) this.files.verify(proofOf(target.after, target.tempPath));
    }
    this.files.absent(NAME);
    const proof = this.files.replace(NAME, null, Buffer.from(stableStringify(row) + "\n"), `${NAME}.tmp-${row.operationId}`);
    return this.current({ record: row, proof });
  }
  private publishTarget(image: Image, path: string): void {
    const row = this.current(image).record, target = row.privacy.targets.find(item => item.path === path);
    if (!target) throw refused();
    const observed = this.observedTuple(target.before, target.after);
    if (same(observed, target.after)) return;
    const staged = proofOf(target.after, target.tempPath);
    this.files.verify(staged);
    this.current(image);
    if (target.before.presence === "present") {
      this.files.replaceStaged(path, proofOf(target.before), staged);
    } else this.files.move(staged, path);
  }
  private advance(image: Image, phase: PrivacyTransitionV3["phase"]): Image {
    this.current(image);
    const record = this.admit({ ...image.record, phase });
    const proof = this.files.replace(NAME, image.proof, Buffer.from(stableStringify(record) + "\n"),
      `${NAME}.tmp-${record.operationId}`);
    return this.current({ record, proof });
  }
  resume(onBoundary: (boundary: string) => void = () => {}): void {
    let image = this.load();
    if (!image) return;
    this.files.requireAtomicMove();
    this.current(image);
    if (image.record.phase === "prepared") {
      if (image.record.kind === "fresh-init") for (const path of ["summaries.json", "journal-index.json"]) {
        this.publishTarget(image, path); onBoundary(path);
      }
      const captured = image;
      this.keys.install(image.record.privacy.keyRecord, () => { this.current(captured); return true; });
      onBoundary("digest.key");
      image = this.advance(image, "key"); onBoundary("key");
    }
    const steps = [
      ["key", "state.prev", "previous", "previous"], ["previous", "state", "state", "state-phase"],
      ["state", "marker", "marker", "marker-phase"],
    ] as const;
    for (const [phase, path, next, boundary] of steps) if (image.record.phase === phase) {
      this.publishTarget(image, path); onBoundary(path);
      image = this.advance(image, next); onBoundary(boundary);
    }
    if (image.record.phase === "marker") { image = this.advance(image, "remove"); onBoundary("remove"); }
    if (image.record.phase !== "remove") throw refused();
    this.current(image);
    this.files.remove(image.proof); onBoundary("removed");
  }
}
