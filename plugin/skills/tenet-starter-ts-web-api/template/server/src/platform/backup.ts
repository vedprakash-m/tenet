// A consistent online backup, then proof the copy is usable: its integrity check passes and it carries the same schema version.
import Database from "better-sqlite3";
import type { Db } from "./db.ts";

export function backup(db: Db, to: string): void {
  db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
  // better-sqlite3's backup() is asynchronous; VACUUM INTO writes the same consistent copy synchronously.
  db.prepare("VACUUM INTO ?").run(to);
  const copy = new Database(to, { readonly: true });
  try {
    const check = copy.pragma("integrity_check", { simple: true });
    if (check !== "ok") throw new Error(`the backup failed its integrity check: ${String(check)}`);
    const version = (d: Db) => (d.prepare("SELECT COALESCE(MAX(version), '') AS v FROM schema_migrations").get() as { v: string }).v;
    if (version(copy) !== version(db)) throw new Error("the backup has a different schema version than the database");
  } finally {
    copy.close();
  }
}
