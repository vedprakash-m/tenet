import { isUtf8 } from "node:buffer";
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { stableStringify } from "../core/ids.ts";
import { parseUniqueRecord } from "../core/private-record.ts";
import { validRetentionUpdate, type RetentionProgress } from "../core/retention-records.ts";
import type { RetentionProjection } from "../core/retention-original-action.ts";
import type { FileProof } from "../core/storage-records.ts";
import { StorageV3Files } from "./storage-v3-write.ts";

export interface ProgressImage<P extends RetentionProjection> { record: RetentionProgress<P>; proof: FileProof }
const NAME = "compaction.retention.json";
const refused = () => new KernelError(
  "storage-accounting-unknown", "retention progress or its original-action bindings are unavailable or changed", { exit: 2 },
);

/** P93 verifies every loaded and proposed action, including the exact phase's intent/run evidence. */
export class RetentionProgressStore<P extends RetentionProjection> {
  private files: StorageV3Files;
  private schema: z.ZodType<RetentionProgress<P>>;
  private verify: (record: RetentionProgress<P>) => boolean;
  constructor(files: StorageV3Files, schema: z.ZodType<RetentionProgress<P>>, verify: (record: RetentionProgress<P>) => boolean) {
    this.files = files;
    this.schema = schema;
    this.verify = verify;
  }
  private admit(raw: unknown): RetentionProgress<P> {
    const parsed = this.schema.safeParse(raw);
    if (!parsed.success || stableStringify(raw) !== stableStringify(parsed.data)) throw refused();
    const record = structuredClone(parsed.data), before = stableStringify(record);
    if (this.verify(record) !== true || stableStringify(record) !== before) throw refused();
    return structuredClone(record);
  }
  load(): ProgressImage<P> | null {
    const current = this.files.read(NAME);
    if (!current) return null;
    if (!isUtf8(current.bytes)) throw refused();
    let raw: unknown;
    try { raw = parseUniqueRecord(current.bytes.toString("utf8")); } catch { throw refused(); }
    const record = this.admit(raw);
    if (current.bytes.toString("utf8") !== stableStringify(record) + "\n") throw refused();
    return { record, proof: current.proof };
  }
  validate(raw: unknown): RetentionProgress<P> { return this.admit(raw); }
  create(raw: unknown): ProgressImage<P> {
    const record = this.admit(raw);
    if (record.phase !== "seal" || record.sealGate.state !== "preparing") throw refused();
    this.files.absent(NAME);
    return this.publish(null, record);
  }
  update(before: ProgressImage<P>, raw: unknown): ProgressImage<P> {
    this.files.verify(before.proof);
    const current = this.load(), record = this.admit(raw);
    if (!current || stableStringify(current.proof) !== stableStringify(before.proof) ||
      stableStringify(current.record.originalAction) !== stableStringify(record.originalAction) ||
      !validRetentionUpdate(current.record, record)) throw refused();
    return this.publish(current.proof, record);
  }
  private publish(before: FileProof | null, record: RetentionProgress<P>): ProgressImage<P> {
    const bytes = Buffer.from(stableStringify(record) + "\n");
    const proof = this.files.replace(NAME, before, bytes, `${NAME}.tmp-${record.batchId}`);
    const current = this.load();
    if (!current || stableStringify(current.proof) !== stableStringify(proof)) throw refused();
    return current;
  }
  complete(before: ProgressImage<P>, verifyReport: (record: RetentionProgress<P>) => boolean): void {
    this.files.verify(before.proof);
    const current = this.load();
    if (!current || current.record.phase !== "report" || current.record.report === null ||
      verifyReport(structuredClone(current.record)) !== true) throw refused();
    this.files.verify(before.proof);
    this.files.remove(before.proof);
  }
}
