import { closeSync, constants, fstatSync, lstatSync, openSync, readSync } from "node:fs";
import { isUtf8 } from "node:buffer";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { parseDigestKey } from "../core/digest-key.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import { MAX_RECORD, parseUniqueRecord } from "../core/private-record.ts";
import { JournalIndexV1, OwnedLeaf, ProviderObjectGenerationV1, SummaryV2 } from "../core/storage-records.ts";
import type { FileProof } from "../core/storage-records.ts";

const changed = () => new KernelError("storage-accounting-unknown", "schema-3 storage evidence is unavailable or changed");
const badKey = () => new KernelError("unsupported-record", "the digest key is unavailable or invalid; nothing was replaced");
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);
interface OwnedBytes { bytes: Buffer; identity: FileProof["identity"]; mode: bigint }

/** Read-side interface only. The caller must hold the Store lock and supply marker-owner admission. */
export class Schema3StorageReader {
  private dir: string;
  private assertOwned: () => void;
  private objectGeneration?: (path: string, descriptor: number) => unknown;
  constructor(dir: string, assertOwned: () => void, objectGeneration?: (path: string, descriptor: number) => unknown) {
    this.dir = dir;
    this.assertOwned = assertOwned;
    this.objectGeneration = objectGeneration;
  }
  private generation(path: string, descriptor: number) {
    if (typeof this.objectGeneration !== "function") throw changed();
    const result = ProviderObjectGenerationV1.safeParse(this.objectGeneration(path, descriptor));
    if (!result.success) throw changed();
    return result.data;
  }

  private read(name: string, bound = MAX_RECORD): OwnedBytes | null {
    OwnedLeaf.parse(name);
    this.assertOwned();
    let fd = -1;
    try {
      const path = join(this.dir, name), before = lstatSync(path, { bigint: true, throwIfNoEntry: false });
      if (!before) return null;
      if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(bound)) throw changed();
      fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const stamp = fstatSync(fd, { bigint: true });
      const generation = this.generation(path, fd);
      if (stamp.dev !== before.dev || stamp.ino !== before.ino || !stamp.isFile() ||
        stamp.nlink !== 1n || stamp.size > BigInt(bound) || stamp.size !== before.size) throw changed();
      const bytes = Buffer.alloc(Number(stamp.size) + 1);
      let offset = 0;
      while (offset < bytes.length) {
        const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
        if (!count) break;
        offset += count;
      }
      const after = fstatSync(fd, { bigint: true }), named = lstatSync(path, { bigint: true });
      if (offset !== Number(stamp.size) || after.size !== stamp.size ||
        after.mtimeNs !== stamp.mtimeNs || after.ctimeNs !== stamp.ctimeNs ||
        named.dev !== stamp.dev || named.ino !== stamp.ino || named.nlink !== 1n) throw changed();
      if (!same(generation, this.generation(path, fd))) throw changed();
      this.assertOwned();
      return {
        bytes: bytes.subarray(0, offset), mode: after.mode,
        identity: { dev: String(stamp.dev), ino: String(stamp.ino), type: "file", links: 1, objectGeneration: generation },
      };
    } catch (error) {
      if (error instanceof KernelError) throw error;
      throw changed();
    } finally { if (fd >= 0) closeSync(fd); }
  }

  private required(name: string): OwnedBytes {
    const record = this.read(name);
    if (!record) throw changed();
    return record;
  }

  private text(record: OwnedBytes): string {
    if (!isUtf8(record.bytes)) throw changed();
    return record.bytes.toString("utf8");
  }

  private verified(expected: FileProof): OwnedBytes {
    const record = this.required(expected.path);
    if (!same(record.identity, expected.identity) || record.bytes.length !== expected.bytes ||
      sha256(record.bytes) !== expected.sha256) throw changed();
    return record;
  }

  /** No transition, cleanup or compaction prefix is guessed from a settled-store read. */
  admitSettled() {
    this.assertOwned();
    for (const name of ["migration-transition.json", "migration-privacy.json", "compaction.pending.json",
      "compaction.retention.json", "cleanup.retention.json", "log.next"]) {
      if (lstatSync(join(this.dir, name), { throwIfNoEntry: false })) throw changed();
    }
    try {
      const indexRecord = this.required("journal-index.json");
      const index = JournalIndexV1.parse(parseUniqueRecord(this.text(indexRecord)));
      const summary = SummaryV2.parse(parseUniqueRecord(this.text(this.verified(index.summary))));
      if (summary.batchId !== index.summary.batchId) throw changed();
      const journals: Array<{ proof: FileProof; text: string }> = index.sealed.map(proof => ({
        proof, text: this.text(this.verified(proof)),
      }));
      const active = this.required("log");
      if (!same(active.identity, index.active.identity)) throw changed();
      journals.push({
        proof: { path: "log", identity: active.identity, bytes: active.bytes.length, sha256: sha256(active.bytes) },
        text: this.text(active),
      });
      this.assertOwned();
      return { index, summary, journals };
    } catch (error) {
      if (error instanceof KernelError) throw error;
      throw changed();
    }
  }

  digestKey(expectedId: string) {
    this.assertOwned();
    let record: OwnedBytes | null;
    try { record = this.read("digest.key", 84); }
    catch (error) {
      if (error instanceof KernelError && error.reasons[0]?.code === "marker-mismatch") throw error;
      throw badKey();
    }
    if (!record) return null;
    const parsed = parseDigestKey(record.bytes);
    if (!parsed || parsed.id !== expectedId || (process.platform !== "win32" && (record.mode & 0o077n) !== 0n)) throw badKey();
    return parsed;
  }
}
