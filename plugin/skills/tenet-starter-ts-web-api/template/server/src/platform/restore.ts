// Restore a verified backup over the database file (TS §12.5). The restore tool takes the owner file, writes a marker naming
// where the originals move, moves the database with its -wal and -shm aside, copies the backup in and verifies it, then removes
// the marker. A restore killed at any step leaves the marker; the server will not start until it is finished or rolled back.
import Database from "better-sqlite3";
import { closeSync, copyFileSync, existsSync, fsyncSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { MIGRATIONS_DIR, loadMigrations, pendingMigrations } from "./migrate.ts";
import { takeOwner } from "./owner.ts";

export interface Restored { schemaVersion: string; compatibleWith: string; keptAside?: string }
export const STEPS = ["owned", "validated", "marked", "moved", "copied", "verified", "unmarked"] as const;
export type Step = (typeof STEPS)[number];
interface Marker { backup: string; aside: string; at: number }

const SUFFIXES = ["", "-wal", "-shm"] as const;
const markerPath = (to: string) => `${to}.restore-in-progress`;

/** The schema version of a database file, after integrity, compatible history/checksums and foreign-key checks. */
function verified(file: string): string {
  let copy: Database.Database | undefined;
  try {
    copy = new Database(file, { readonly: true });
    const check = copy.pragma("integrity_check", { simple: true });
    if (check !== "ok") throw new Error(`failed its integrity check: ${String(check)}`);
    const rows = copy.prepare("SELECT version, checksum FROM schema_migrations ORDER BY version").all() as Array<{ version: string; checksum: string }>;
    pendingMigrations(loadMigrations(MIGRATIONS_DIR), new Map(rows.map(row => [row.version, row.checksum])), MIGRATIONS_DIR);
    if (!rows.length && copy.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'schema_migrations' LIMIT 1").get()) throw new Error("the backup has an unrecorded schema history");
    if (copy.prepare("PRAGMA foreign_key_check").get()) throw new Error("the backup has foreign key violations");
    return rows.at(-1)?.version ?? "";
  } catch (e) {
    throw new Error(`the backup cannot be restored: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    copy?.close();
  }
}

/** Takes the write lock, folds the log into the file and lets go; fails when another connection is using the database. */
function assertIdle(path: string): void {
  if (!existsSync(path)) return;
  const db = new Database(path, { timeout: 0 });
  try {
    db.exec("BEGIN EXCLUSIVE");
    db.exec("ROLLBACK");
    db.pragma("wal_checkpoint(TRUNCATE)");
  } catch {
    throw new Error("the database is in use; stop the app before restoring");
  } finally {
    db.close();
  }
}

function writeDurable(path: string, text: string): void {
  writeFileSync(`${path}.tmp`, text, { mode: 0o600 });
  const fd = openSync(`${path}.tmp`, "r+");
  try { fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(`${path}.tmp`, path);
}

/** The unfinished restore beside this database, or null. */
export function pendingRestore(to: string): Marker | null {
  try { return JSON.parse(readFileSync(markerPath(to), "utf8")) as Marker; } catch { return existsSync(markerPath(to)) ? { backup: "", aside: "", at: 0 } : null; }
}

const isAlias = (backup: string, to: string): boolean => {
  const real = (p: string) => { try { return realpathSync(p); } catch { return p; } };
  return SUFFIXES.some((s) => real(backup) === real(`${to}${s}`));
};

/** Moves each live file (database, -wal, -shm) that has no twin aside yet; once the restored database is in place, nothing moves. */
function moveAside(to: string, aside: string): void {
  if (existsSync(to) && existsSync(aside)) return;
  for (const s of SUFFIXES) if (existsSync(`${to}${s}`) && !existsSync(`${aside}${s}`)) renameSync(`${to}${s}`, `${aside}${s}`);
}

/** Copies the backup in atomically and checks the copy before it becomes the database. */
function install(backup: string, to: string): string {
  copyFileSync(backup, `${to}.restoring`);
  const schemaVersion = verified(`${to}.restoring`);
  for (const s of ["-wal", "-shm"]) rmSync(`${to}.restoring${s}`, { force: true });
  renameSync(`${to}.restoring`, to);
  return schemaVersion;
}

export function restore(backup: string, to: string, opts: { after?: (step: Step) => void } = {}): Restored {
  const at = (step: Step) => opts.after?.(step);
  if (pendingRestore(to)) throw new Error("an earlier restore is unfinished; run `npm run restore -- --finish` or `--rollback`");
  const release = takeOwner(to);
  at("owned");
  try {
    if (isAlias(backup, to)) throw new Error("the backup is the live database or one of its log files; choose a separate backup file");
    const schemaVersion = verified(backup);
    assertIdle(to);
    at("validated");
    const had = existsSync(to);
    const aside = `${to}.before-restore-${Date.now()}`;
    writeDurable(markerPath(to), JSON.stringify({ backup, aside, at: Date.now() } satisfies Marker));
    at("marked");
    moveAside(to, aside);
    at("moved");
    install(backup, to);
    at("copied");
    verified(to);
    at("verified");
    rmSync(markerPath(to), { force: true });
    release();
    at("unmarked");
    return {
      schemaVersion, ...(had ? { keptAside: aside } : {}),
      compatibleWith: `code with migrations through ${schemaVersion} or later; older code cannot read this data`,
    };
  } catch (e) {
    if (!pendingRestore(to)) release();
    throw e;
  }
}

/** Finishes an interrupted restore from the marker, or puts the originals back. Either way the marker goes last. */
export function recoverRestore(to: string, mode: "finish" | "rollback"): string {
  const marker = pendingRestore(to);
  if (!marker) return "there is no unfinished restore";
  const release = takeOwner(to);
  try {
    if (mode === "finish") {
      if (!marker.backup) throw new Error("the restore marker is unreadable; roll back instead");
      moveAside(to, marker.aside);
      install(marker.backup, to);
      verified(to);
    } else {
      for (const s of SUFFIXES) {
        if (!existsSync(`${marker.aside}${s}`)) continue;
        rmSync(`${to}${s}`, { force: true });
        renameSync(`${marker.aside}${s}`, `${to}${s}`);
      }
      rmSync(`${to}.restoring`, { force: true });
    }
    rmSync(markerPath(to), { force: true });
    return mode === "finish" ? "the restore is finished" : "the original database is back";
  } finally {
    release();
  }
}
