// The project folder as an adapter: the only code that writes files the user will see. Never overwrites.
import { createHash, randomUUID } from "node:crypto";
import { isUtf8 } from "node:buffer";
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Project, ProjectReadCause, ProjectReadResult, RecipeFile } from "../ports/types.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion, Op } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";

// Bounded project-file reads (TS §7.4, CON-03): a config file Tenet reads (policy, intent, manifest, lockfile) is
// never loaded past this size, so a huge or hostile file cannot be pulled fully into memory.
const MAX_READ_BYTES = 20 * 1024 * 1024;

/** Keep typed read admission separate from programmer failures without changing legacy kernel refusals. */
class ProjectRefusal extends KernelError {
  readonly readCause: ProjectReadCause;
  constructor(cause: ProjectReadCause, message: string) {
    super(cause === "too-large" ? "project-file-too-large" : "capability-missing", message, { exit: 2 });
    this.readCause = cause;
  }
}

export class FsProject implements Project {
  private root: string;
  private exclusions: readonly Exclusion[] = [];
  constructor(root: string) { this.root = realpathSync(root); }
  setExclusions(exclusions: readonly Exclusion[]): void { this.exclusions = exclusions; }

  /** Normalize before policy checks; links are data, never aliases for a project file operation. */
  private at(rel: string, op: Op): string {
    const p = resolve(this.root, rel);
    if (!p.startsWith(this.root + sep)) throw new ProjectRefusal("outside", `path escapes the project: ${rel}`);
    const normalized = relative(this.root, p).split(sep).join("/");
    if (!allowed(op, normalized, this.exclusions)) throw new ProjectRefusal("excluded", `the project policy forbids ${op} of ${normalized}`);
    let part = this.root;
    const parts = normalized.split("/");
    for (const [i, name] of parts.entries()) {
      part = join(part, name);
      try {
        const st = lstatSync(part);
        if (st.isSymbolicLink()) throw new ProjectRefusal("linked", `a link in project path ${normalized} cannot be followed`);
        if (i < parts.length - 1 ? !st.isDirectory() : !st.isFile()) throw new ProjectRefusal("not-regular", `${normalized} is not a regular project file`);
      } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") break; throw e; }
    }
    return p;
  }

  writeNew(files: readonly RecipeFile[]): void {
    for (const f of files) this.publish(f.path, f.content, f.mode, true);
  }

  hashes(paths: readonly string[]): Record<string, string | null> {
    return Object.fromEntries(paths.map((rel) => {
      const content = this.content(rel);
      return [rel, content === null ? null : createHash("sha256").update(content).digest("hex")];
    }));
  }

  private content(rel: string, maxBytes = MAX_READ_BYTES, bounded = false): Buffer | null {
    let fd = -1;
    try {
      fd = openSync(this.at(rel, "read"), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const st = fstatSync(fd);
      if (!st.isFile()) throw new ProjectRefusal("not-regular", `${rel} is not a regular project file`);
      if (st.size > maxBytes) {
        const mb = maxBytes / (1024 * 1024);
        throw new ProjectRefusal("too-large", `${rel} exceeds the ${mb} MB bounded read limit`);
      }
      const bytes = Buffer.alloc(bounded ? Math.min(st.size + 1, maxBytes) : st.size + 1);
      let count = 0;
      while (count < bytes.length) {
        const n = readSync(fd, bytes, count, bytes.length - count, count);
        if (!n) break;
        count += n;
      }
      const after = fstatSync(fd);
      if (count !== st.size || after.size !== st.size || after.mtimeMs !== st.mtimeMs || after.ctimeMs !== st.ctimeMs)
        throw new ProjectRefusal("moved", `${rel} changed during its bounded read; retry against stable input`);
      return bytes.subarray(0, count);
    } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
    finally { if (fd >= 0) closeSync(fd); }
  }

  read(rel: string): string | null { return this.content(rel)?.toString("utf8") ?? null; }

  readBounded(rel: string, maxBytes: number): ProjectReadResult {
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_READ_BYTES) throw new RangeError("invalid project read byte limit");
    try {
      const bytes = this.content(rel, maxBytes, true);
      if (bytes === null) return { status: "unavailable", cause: "missing" };
      if (!isUtf8(bytes)) return { status: "unavailable", cause: "invalid-utf8" };
      return { status: "available", text: bytes.toString("utf8"), sha256: createHash("sha256").update(bytes).digest("hex") };
    } catch (error) {
      if (error instanceof ProjectRefusal) return { status: "unavailable", cause: error.readCause };
      const code = (error as NodeJS.ErrnoException | null)?.code;
      if (code === "ELOOP") return { status: "unavailable", cause: "linked" };
      if (code === "EISDIR" || code === "ENOTDIR") return { status: "unavailable", cause: "not-regular" };
      if (["EACCES", "EPERM", "EIO", "EMFILE", "ENFILE", "ENAMETOOLONG", "EAGAIN", "ETIMEDOUT", "ENXIO", "ENODEV"].includes(code ?? ""))
        return { status: "unavailable", cause: "unreadable" };
      throw error;
    }
  }

  write(rel: string, content: string): void { this.publish(rel, content); }

  private publish(rel: string, content: string, mode?: number, exclusive = false): void {
    const p = this.at(rel, "edit");
    mkdirSync(dirname(p), { recursive: true });
    this.at(rel, "edit");
    let permissions = mode ?? 0o600;
    if (mode === undefined) { try { permissions = lstatSync(p).mode & 0o777; } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } }
    const temp = join(dirname(p), `.tenet-write-${randomUUID()}.tmp`);
    const fd = openSync(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    const owned = fstatSync(fd);
    const ownsTemp = () => {
      try { const st = lstatSync(temp); return st.isFile() && !st.isSymbolicLink() && st.dev === owned.dev && st.ino === owned.ino; }
      catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return false; throw e; }
    };
    try {
      writeFileSync(fd, content); fchmodSync(fd, permissions); fsyncSync(fd);
      this.at(rel, "edit");
      if (!ownsTemp()) throw new KernelError("capability-missing", "the project temporary file changed; no file was published", { exit: 2 });
      if (exclusive) linkSync(temp, p); else renameSync(temp, p);
      this.syncParents(p);
    } finally {
      try { if (ownsTemp()) { rmSync(temp); this.syncParents(temp); } }
      finally { closeSync(fd); }
    }
  }

  private syncParents(path: string): void {
    for (let dir = dirname(path);; dir = dirname(dir)) {
      const fd = openSync(dir, constants.O_RDONLY | constants.O_NOFOLLOW);
      try { fsyncSync(fd); } finally { closeSync(fd); }
      if (dir === this.root) break;
    }
  }

  remove(paths: readonly string[]): void {
    for (const rel of paths) {
      const path = this.at(rel, "edit");
      try { lstatSync(path); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") continue; throw e; }
      rmSync(path); this.syncParents(path);
    }
  }
}

