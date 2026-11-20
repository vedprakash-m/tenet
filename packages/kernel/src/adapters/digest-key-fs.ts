import {
  closeSync, constants, fstatSync, fsyncSync, lstatSync, openSync, readSync, writeSync,
} from "node:fs";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { encodeDigestKey, parseDigestKey } from "../core/digest-key.ts";
import { stableStringify } from "../core/ids.ts";
import { ProviderObjectGenerationV1, StorageId } from "../core/storage-records.ts";
import type { PrivacyTransitionV3 } from "../core/migration-transition.ts";

type KeyAfter = PrivacyTransitionV3["privacy"]["keyRecord"]["after"];
interface KeyAdmission {
  assertOwned(): void; syncDirectory(): void;
  renameNoReplace?: (source: string, target: string) => void;
  objectGeneration?: (path: string, descriptor: number) => unknown;
}
export type StagedDigestKey = Pick<PrivacyTransitionV3["privacy"]["keyRecord"], "tempPath" | "after">;
const refused = () => new KernelError(
  "unsupported-record", "the coupled digest-key file is unavailable or invalid; nothing was replaced", { exit: 2 },
);

/** No key content hash is computed or returned. Epoch invalidation remains in the coupled State transaction. */
export class DigestKeyFiles {
  private dir: string;
  private admission: KeyAdmission;
  constructor(dir: string, admission: KeyAdmission) {
    this.dir = dir;
    this.admission = admission;
  }
  private path(name: string): string {
    if (name !== "digest.key" && !/^digest\.key\.tmp-(?:[a-z2-7]{24}|[0-9a-f]{32})$/.test(name)) throw refused();
    this.admission.assertOwned();
    const root = lstatSync(this.dir);
    if (!root.isDirectory() || root.isSymbolicLink()) throw refused();
    return join(this.dir, name);
  }
  read(name: string): KeyAfter | null {
    const path = this.path(name), before = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    if (!before) return null;
    if (typeof this.admission.objectGeneration !== "function") throw refused();
    if (!before.isFile() || before.nlink !== 1n || before.size !== 84n) throw refused();
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd, { bigint: true });
      const generation = ProviderObjectGenerationV1.safeParse(this.admission.objectGeneration(path, fd));
      if (!generation.success) throw refused();
      if (stat.dev !== before.dev || stat.ino !== before.ino || stat.size !== 84n || stat.nlink !== 1n ||
        (process.platform !== "win32" && (stat.mode & 0o077n) !== 0n)) throw refused();
      const bytes = Buffer.alloc(85);
      let offset = 0;
      while (offset < bytes.length) {
        const count = readSync(fd, bytes, offset, bytes.length - offset, offset);
        if (!count) break;
        offset += count;
      }
      const after = fstatSync(fd, { bigint: true }), named = lstatSync(path, { bigint: true });
      if (offset !== 84 || after.size !== stat.size || after.mtimeNs !== stat.mtimeNs || after.ctimeNs !== stat.ctimeNs ||
        named.dev !== stat.dev || named.ino !== stat.ino || named.nlink !== 1n) throw refused();
      const key = parseDigestKey(bytes.subarray(0, 84));
      if (!key) throw refused();
      const rechecked = ProviderObjectGenerationV1.safeParse(this.admission.objectGeneration(path, fd));
      if (!rechecked.success || stableStringify(rechecked.data) !== stableStringify(generation.data)) throw refused();
      this.admission.assertOwned();
      return {
        presence: "present", identity: {
          dev: String(stat.dev), ino: String(stat.ino), type: "file", links: 1, objectGeneration: generation.data,
        },
        bytes: 84, magic: [84, 75, 49, 0], digestKeyId: key.id,
      };
    } finally { closeSync(fd); }
  }
  stage(operationId: string, id: Uint8Array, key: Uint8Array): StagedDigestKey {
    if (typeof this.admission.objectGeneration !== "function") throw refused();
    StorageId.parse(operationId);
    const name = `digest.key.tmp-${operationId}`, path = this.path(name);
    if (lstatSync(path, { throwIfNoEntry: false })) throw refused();
    const bytes = encodeDigestKey(id, key);
    const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
      constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const count = writeSync(fd, bytes, offset, bytes.length - offset);
        if (count <= 0) throw refused();
        offset += count;
      }
      fsyncSync(fd);
    } finally { closeSync(fd); }
    this.admission.syncDirectory();
    const after = this.read(name);
    if (!after || after.digestKeyId !== Buffer.from(id).toString("hex")) throw refused();
    return { tempPath: name, after };
  }
  install(expected: StagedDigestKey, admitCoupledTransaction: () => boolean): KeyAfter {
    if (admitCoupledTransaction() !== true) throw refused();
    const current = this.read("digest.key");
    if (current) {
      if (stableStringify(current) !== stableStringify(expected.after) || this.read(expected.tempPath) !== null) throw refused();
      return current;
    }
    if (typeof this.admission.renameNoReplace !== "function") throw refused();
    const temp = this.read(expected.tempPath);
    if (!temp || stableStringify(temp) !== stableStringify(expected.after)) throw refused();
    if (admitCoupledTransaction() !== true || this.read("digest.key") !== null) throw refused();
    this.admission.renameNoReplace(this.path(expected.tempPath), this.path("digest.key"));
    this.admission.syncDirectory();
    const published = this.read("digest.key");
    if (stableStringify(published) !== stableStringify(expected.after)) throw refused();
    return published!;
  }
}
