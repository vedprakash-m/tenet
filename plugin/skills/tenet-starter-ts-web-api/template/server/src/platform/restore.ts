// Restore a verified backup over the database file: the backup is checked first, the file it replaces is kept aside, and
// nothing is restored while another connection holds the database. Never a raw copy over an active file.
import Database from "better-sqlite3";
import { copyFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { MIGRATIONS_DIR } from "./migrate.ts";

export interface Restored { schemaVersion: string; compatibleWith: string; keptAside?: string }

const versionsOf = (db: Database.Database): string[] =>
  (db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as Array<{ version: string }>).map((r) => r.version);

/** The backup's schema version, after it passes an integrity check and names only migrations this code knows. */
function verified(backup: string): string {
  const known = new Set(readdirSync(MIGRATIONS_DIR).filter((f) => /^\d{4}_.+\.sql$/.test(f)));
  let copy: Database.Database | undefined;
  try {
    copy = new Database(backup, { readonly: true });
    const check = copy.pragma("integrity_check", { simple: true });
    if (check !== "ok") throw new Error(`failed its integrity check: ${String(check)}`);
    const versions = versionsOf(copy);
    const unknown = versions.find((v) => !known.has(v));
    if (unknown) throw new Error(`it was written by newer code (migration ${unknown}); restore it with the code that wrote it`);
    return versions.at(-1) ?? "";
  } catch (e) {
    throw new Error(`the backup cannot be restored: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    copy?.close();
  }
}

/** Takes the write lock, folds the log into the file and lets go; fails when another connection is using the database. */
function assertIdle(path: string): void {
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

export function restore(backup: string, to: string): Restored {
  const schemaVersion = verified(backup);
  let keptAside: string | undefined;
  try {
    assertIdle(to);
    keptAside = `${to}.before-restore-${Date.now()}`;
    renameSync(to, keptAside);
  } catch (e) {
    if ((e as { code?: string }).code !== "ENOENT" && !(e instanceof Error && /Cannot open|unable to open/i.test(e.message))) throw e;
    keptAside = undefined;
  }
  for (const suffix of ["-wal", "-shm"]) rmSync(`${to}${suffix}`, { force: true });
  copyFileSync(backup, `${to}.restoring`);
  renameSync(`${to}.restoring`, to);
  return {
    schemaVersion, ...(keptAside ? { keptAside } : {}),
    compatibleWith: `code with migrations through ${schemaVersion} or later; older code cannot read this data`,
  };
}
