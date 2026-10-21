// The project folder as an adapter: the only code that writes files the user will see. Never overwrites.
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import type { Project, RecipeFile } from "../ports/types.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion, Op } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";

// Bounded project-file reads (TS §7.4, CON-03): a config file Tenet reads (policy, intent, manifest, lockfile) is
// never loaded past this size, so a huge or hostile file cannot be pulled fully into memory.
const MAX_READ_BYTES = 20 * 1024 * 1024;

export class FsProject implements Project {
  private root: string;
  private exclusions: readonly Exclusion[] = [];
  constructor(root: string) { this.root = realpathSync(root); }
  setExclusions(exclusions: readonly Exclusion[]): void { this.exclusions = exclusions; }

  /** Normalize before policy checks; links are data, never aliases for a project file operation. */
  private at(rel: string, op: Op): string {
    const p = resolve(this.root, rel);
    if (!p.startsWith(this.root + sep)) throw new KernelError("capability-missing", `path escapes the project: ${rel}`, { exit: 2 });
    const normalized = relative(this.root, p).split(sep).join("/");
    if (!allowed(op, normalized, this.exclusions)) throw new KernelError("capability-missing", `the project policy forbids ${op} of ${normalized}`, { exit: 2 });
    let part = this.root;
    const parts = normalized.split("/");
    for (const [i, name] of parts.entries()) {
      part = join(part, name);
      try {
        const st = lstatSync(part);
        if (st.isSymbolicLink()) throw new KernelError("capability-missing", `a link in project path ${normalized} cannot be followed`, { exit: 2 });
        if (i < parts.length - 1 ? !st.isDirectory() : !st.isFile()) throw new KernelError("capability-missing", `${normalized} is not a regular project file`, { exit: 2 });
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

  private content(rel: string): Buffer | null {
    let fd = -1;
    try {
      fd = openSync(this.at(rel, "read"), constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const st = fstatSync(fd);
      if (!st.isFile()) throw new KernelError("capability-missing", `${rel} is not a regular project file`, { exit: 2 });
      if (st.size > MAX_READ_BYTES) {
        const mb = MAX_READ_BYTES / (1024 * 1024);
        throw new KernelError("project-file-too-large", `${rel} exceeds the ${mb} MB bounded read limit`, { exit: 2 });
      }
      return readFileSync(fd);
    } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
    finally { if (fd >= 0) closeSync(fd); }
  }

  read(rel: string): string | null { return this.content(rel)?.toString("utf8") ?? null; }

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

