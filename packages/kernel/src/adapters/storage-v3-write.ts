import {
  closeSync, constants, fstatSync, fsyncSync, ftruncateSync, lstatSync, openSync, readSync, renameSync, unlinkSync, writeSync,
} from "node:fs";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import { MAX_RECORD } from "../core/private-record.ts";
import { FileProof, OwnedLeaf, ProviderObjectGenerationV1 } from "../core/storage-records.ts";

export interface StorageWriteAdmission {
  assertOwned(): void;
  syncDirectory?: (path: string) => void;
  renameNoReplace?: (source: string, target: string) => void;
  objectGeneration?: (path: string, descriptor: number) => unknown;
}
const refused = () => new KernelError(
  "storage-accounting-unknown", "a schema-3 writer encountered unavailable or changed storage evidence", { exit: 2 },
);
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);
function syncDirectory(path: string): void {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { fsyncSync(fd); } finally { closeSync(fd); }
}

/** Each operation requires a held Store lock and marker ownership through assertOwned. */
export class StorageV3Files {
  private dir: string;
  private admission: StorageWriteAdmission;
  constructor(dir: string, admission: StorageWriteAdmission) {
    this.dir = dir;
    this.admission = admission;
  }
  private path(name: string): string {
    OwnedLeaf.parse(name);
    if (/^digest\.key(?:\.|$)/i.test(name)) throw refused();
    this.admission.assertOwned();
    const root = lstatSync(this.dir);
    if (!root.isDirectory() || root.isSymbolicLink()) throw refused();
    return join(this.dir, name);
  }
  sync(): void {
    this.path("log");
    (this.admission.syncDirectory ?? syncDirectory)(this.dir);
    this.admission.assertOwned();
  }
  requireAtomicMove(): void {
    if (typeof this.admission.renameNoReplace !== "function") throw refused();
  }
  requireObjectGeneration(): void {
    if (typeof this.admission.objectGeneration !== "function") throw refused();
  }
  private generation(path: string, descriptor: number) {
    this.requireObjectGeneration();
    const result = ProviderObjectGenerationV1.safeParse(this.admission.objectGeneration!(path, descriptor));
    if (!result.success) throw refused();
    return result.data;
  }
  read(name: string, bound = MAX_RECORD): { proof: FileProof; bytes: Buffer } | null {
    const path = this.path(name), before = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    if (!before) return null;
    this.requireObjectGeneration();
    if (!before.isFile() || before.nlink !== 1n || before.size > BigInt(bound)) throw refused();
    const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const start = fstatSync(fd, { bigint: true });
      const objectGeneration = this.generation(path, fd);
      if (start.dev !== before.dev || start.ino !== before.ino || !start.isFile() || start.nlink !== 1n ||
        start.size !== before.size) throw refused();
      const bytes = Buffer.alloc(Number(start.size) + 1);
      let cursor = 0;
      while (cursor < bytes.length) {
        const count = readSync(fd, bytes, cursor, bytes.length - cursor, cursor);
        if (!count) break;
        cursor += count;
      }
      const end = fstatSync(fd, { bigint: true }), named = lstatSync(path, { bigint: true });
      if (cursor !== Number(start.size) || end.size !== start.size || end.mtimeNs !== start.mtimeNs ||
        end.ctimeNs !== start.ctimeNs || named.dev !== start.dev || named.ino !== start.ino || named.nlink !== 1n) throw refused();
      if (!same(objectGeneration, this.generation(path, fd))) throw refused();
      this.admission.assertOwned();
      const content = bytes.subarray(0, cursor);
      return { bytes: content, proof: {
        path: name, identity: { dev: String(start.dev), ino: String(start.ino), type: "file", links: 1, objectGeneration },
        bytes: cursor, sha256: sha256(content),
      } };
    } finally { closeSync(fd); }
  }
  verify(expected: FileProof): { proof: FileProof; bytes: Buffer } {
    const proof = FileProof.parse(expected), current = this.read(proof.path);
    if (!current || !same(current.proof, proof)) throw refused();
    return current;
  }
  absent(name: string): void {
    if (lstatSync(this.path(name), { throwIfNoEntry: false })) throw refused();
  }
  create(name: string, bytes: Buffer): FileProof {
    this.requireObjectGeneration();
    if (bytes.length > MAX_RECORD) throw refused();
    this.absent(name);
    const path = this.path(name);
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
    this.sync();
    const record = this.read(name);
    if (!record || !record.bytes.equals(bytes)) throw refused();
    return record.proof;
  }
  withEmptyReservation<T>(use: (proof: FileProof, descriptor: number) => T): T {
    return this.withReservation("log.next", Buffer.alloc(0), use);
  }
  withReservation<T>(name: string, bytes: Buffer, use: (proof: FileProof, descriptor: number) => T): T {
    this.requireObjectGeneration();
    if (bytes.length > MAX_RECORD) throw refused();
    this.absent(name);
    const fd = openSync(this.path(name), constants.O_RDWR | constants.O_CREAT | constants.O_EXCL |
      constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
    try {
      let offset = 0;
      while (offset < bytes.length) {
        const count = writeSync(fd, bytes, offset, bytes.length - offset);
        if (count <= 0) throw refused();
        offset += count;
      }
      fsyncSync(fd);
      const stat = fstatSync(fd, { bigint: true });
      if (!stat.isFile() || stat.nlink !== 1n || stat.size !== BigInt(bytes.length)) throw refused();
      const proof: FileProof = {
        path: name, identity: {
          dev: String(stat.dev), ino: String(stat.ino), type: "file", links: 1,
          objectGeneration: this.generation(this.path(name), fd),
        },
        bytes: bytes.length, sha256: sha256(bytes),
      };
      this.sync();
      this.verify(proof);
      return use(proof, fd);
    } finally { closeSync(fd); }
  }
  replace(name: string, before: FileProof | null, bytes: Buffer, temporary: string): FileProof {
    if (name === temporary) throw refused();
    if (!before) this.requireAtomicMove();
    if (before) {
      if (before.path !== name) throw refused();
      this.verify(before);
    } else this.absent(name);
    const temp = this.create(temporary, bytes);
    if (before) this.verify(before); else this.absent(name);
    this.verify(temp);
    if (before) renameSync(this.path(temporary), this.path(name));
    else this.admission.renameNoReplace!(this.path(temporary), this.path(name));
    this.sync();
    return this.verify({ ...temp, path: name }).proof;
  }
  move(before: FileProof, name: string): FileProof {
    this.requireAtomicMove();
    this.verify(before);
    this.absent(name);
    this.admission.renameNoReplace!(this.path(before.path), this.path(name));
    this.sync();
    return this.verify({ ...before, path: name }).proof;
  }
  replaceStaged(name: string, before: FileProof, staged: FileProof): FileProof {
    if (before.path !== name || staged.path === name) throw refused();
    this.verify(before);
    this.verify(staged);
    renameSync(this.path(staged.path), this.path(name));
    this.sync();
    return this.verify({ ...staged, path: name }).proof;
  }
  truncateBound(before: FileProof, onBound: (proof: FileProof) => void): FileProof {
    this.verify(before);
    const fd = openSync(this.path(before.path), constants.O_RDWR | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = fstatSync(fd, { bigint: true });
      if (!stat.isFile() || stat.nlink !== 1n || String(stat.dev) !== before.identity.dev ||
        String(stat.ino) !== before.identity.ino) throw refused();
      this.verify(before);
      onBound(before);
      this.verify(before);
      ftruncateSync(fd, 0);
      fsyncSync(fd);
      const expected = { ...before, bytes: 0, sha256: sha256("") };
      return this.verify(expected).proof;
    } finally { closeSync(fd); }
  }
  remove(before: FileProof): void {
    this.verify(before);
    unlinkSync(this.path(before.path));
    this.sync();
    this.absent(before.path);
  }
}
