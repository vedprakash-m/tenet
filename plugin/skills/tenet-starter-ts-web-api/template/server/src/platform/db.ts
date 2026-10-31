// The one place that opens the database. WAL, foreign keys, a short busy timeout, and immediate transactions for writes
// that protect an invariant; a busy database is retried with jitter for up to a second, then reported as "try again".
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError } from "./errors.ts";
import { pendingRestore } from "./restore.ts";

export type Db = Database.Database;

export function openDb(path: string): Db {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
    if (pendingRestore(path)) throw new Error("A restore is unfinished: run `npm run restore -- --finish` or `--rollback` before starting.");
  }
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 250");
  return db;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Runs `fn` in an immediate transaction. SQLITE_BUSY is retried with jitter up to one second in total. */
export async function writeTx<T>(db: Db, fn: () => T): Promise<T> {
  const deadline = Date.now() + 1000;
  const checkDeadline = () => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AppError(503, "busy", "The database is busy; try again.");
    return remaining;
  };
  for (;;) {
    checkDeadline();
    try {
      return db.transaction(() => { checkDeadline(); return fn(); }).immediate();
    } catch (e) {
      const busy = (e as { code?: string }).code?.startsWith("SQLITE_BUSY");
      if (!busy) throw e;
      await sleep(Math.min(checkDeadline(), 20 + Math.floor(Math.random() * 60)));
    }
  }
}
