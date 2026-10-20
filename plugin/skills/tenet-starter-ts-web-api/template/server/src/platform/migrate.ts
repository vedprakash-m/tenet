// Numbered, forward-only SQL migrations, one transaction each, recorded with a checksum. A failure rolls back and stops;
// a changed checksum stops startup. A database that already holds data is backed up (and the copy verified) before migrating,
// beside the file unless the caller says where.
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { backup } from "./backup.ts";
import type { Db } from "./db.ts";

export const MIGRATIONS_DIR = join(import.meta.dirname, "../../migrations");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export interface MigrateOptions { dir?: string; backupTo?: string }
interface Migration { version: string; sql: string; checksum: string }

const load = (dir: string): Migration[] =>
  readdirSync(dir).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort().map((version) => {
    const sql = readFileSync(join(dir, version), "utf8");
    return { version, sql, checksum: sha(sql) };
  });

/** The migrations not yet applied; an applied one that changed or vanished is an error. */
function pending(files: Migration[], done: Map<string, string>, dir: string): Migration[] {
  for (const f of files) {
    const prior = done.get(f.version);
    if (prior !== undefined && prior !== f.checksum) throw new Error(`migration ${f.version} was changed after it was applied; add a new migration instead`);
  }
  for (const v of done.keys()) if (!files.some((f) => f.version === v)) throw new Error(`applied migration ${v} is missing from ${dir}`);
  return files.filter((f) => !done.has(f.version));
}

/** Where the pre-migration copy goes when the caller names none: next to the database file; an in-memory database has none. */
const beside = (db: Db, version: string): string | undefined =>
  db.memory ? undefined : `${db.name}.before-${version.replace(/\.sql$/, "")}-${Date.now()}.bak`;

export function migrate(db: Db, opts: MigrateOptions = {}): { applied: string[] } {
  db.exec("CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL)");
  const dir = opts.dir ?? MIGRATIONS_DIR;
  const done = new Map((db.prepare("SELECT version, checksum FROM schema_migrations").all() as Array<{ version: string; checksum: string }>).map((r) => [r.version, r.checksum]));
  const todo = pending(load(dir), done, dir);
  if (!todo.length) return { applied: [] };

  const copy = opts.backupTo ?? beside(db, todo[0]!.version);
  if (done.size > 0 && copy) backup(db, copy);
  for (const m of todo) {
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare("INSERT INTO schema_migrations (version, checksum, applied_at) VALUES (?, ?, ?)").run(m.version, m.checksum, Date.now());
    })();
  }
  const bad = db.prepare("PRAGMA foreign_key_check").all();
  if (bad.length) throw new Error(`foreign key violations after migrating: ${JSON.stringify(bad.slice(0, 3))}`);
  return { applied: todo.map((m) => m.version) };
}
