// The one place that opens the database. WAL, foreign keys, a short busy timeout, and immediate transactions for writes
// that protect an invariant; a busy database is retried with jitter for up to a second, then reported as "try again".
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { AppError } from "./errors.ts";

export type Db = Database.Database;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
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
  for (;;) {
    try {
      return db.transaction(fn).immediate();
    } catch (e) {
      const busy = (e as { code?: string }).code?.startsWith("SQLITE_BUSY");
      if (!busy) throw e;
      if (Date.now() > deadline) throw new AppError(503, "busy", "The database is busy; try again.");
      await sleep(20 + Math.floor(Math.random() * 60));
    }
  }
}
