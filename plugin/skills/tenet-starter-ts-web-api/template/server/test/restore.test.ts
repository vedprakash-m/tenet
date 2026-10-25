import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { spawnSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";
import { backup } from "../src/platform/backup.ts";
import { openDb } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";
import { takeOwner } from "../src/platform/owner.ts";
import { pendingRestore, recoverRestore, restore, STEPS } from "../src/platform/restore.ts";

const dirs: string[] = [];
const scratch = () => { const d = mkdtempSync(join(tmpdir(), "starter-restore-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

/** A migrated database file with one user, a verified backup of it, and then a destructive change to the live file. */
function damaged() {
  const dir = scratch(), path = join(dir, "app.db"), copy = join(dir, "good.bak");
  const db = openDb(path);
  migrate(db);
  db.prepare("INSERT INTO users (id, email, password_hash, role, created_at) VALUES ('u1', 'a@example.com', 'x', 'member', 1)").run();
  backup(db, copy);
  db.prepare("DELETE FROM users").run();
  db.close();
  return { dir, path, copy };
}
const users = (path: string) => { const d = new Database(path, { readonly: true }); try { return d.prepare("SELECT id FROM users").all(); } finally { d.close(); } };

describe("restore", () => {
  it("puts a verified backup back, keeps the replaced database aside, and says which code it needs", () => {
    const { dir, path, copy } = damaged();
    expect(users(path)).toEqual([]);
    const r = restore(copy, path);
    expect(users(path)).toEqual([{ id: "u1" }]);
    expect(r.schemaVersion).toBe("0001_init.sql");
    expect(r.compatibleWith).toMatch(/0001_init\.sql/);
    expect(r.keptAside && existsSync(r.keptAside)).toBe(true);
    expect(users(r.keptAside!)).toEqual([]);
    expect(readdirSync(dir).filter((f) => f === "app.db-wal" || f === "app.db-shm"), "no log of the replaced database is left beside the restored one").toEqual([]);
  });

  it("refuses a backup that fails its integrity check, and changes nothing", () => {
    const { path, copy } = damaged();
    writeFileSync(copy, "this is not a database");
    expect(() => restore(copy, path)).toThrow(/backup/);
    expect(users(path)).toEqual([]);
  });

  it("refuses a backup written by newer code than this one", () => {
    const { path, copy } = damaged();
    const d = new Database(copy);
    d.prepare("INSERT INTO schema_migrations (version, checksum, applied_at) VALUES ('9999_future.sql', 'x', 1)").run();
    d.close();
    expect(() => restore(copy, path)).toThrow(/newer/);
    expect(users(path)).toEqual([]);
  });

  it("refuses to replace a database another connection is writing", () => {
    const { path, copy } = damaged();
    const busy = new Database(path);
    busy.exec("BEGIN EXCLUSIVE");
    try {
      expect(() => restore(copy, path)).toThrow(/in use/);
    } finally {
      busy.exec("ROLLBACK");
      busy.close();
    }
    expect(users(path)).toEqual([]);
  });
});

const CHILD = join(import.meta.dirname, "support", "restore-child.ts");
const killedAfter = (backupFile: string, path: string, step: string) =>
  spawnSync(process.execPath, ["--import", "tsx", CHILD, backupFile, path, step], { encoding: "utf8" });

/** A live database holding only 'u2', and a verified backup holding only 'u1'. */
function twoSided() {
  const dir = scratch(), path = join(dir, "app.db"), copy = join(dir, "good.bak");
  const db = openDb(path);
  migrate(db);
  db.prepare("INSERT INTO users (id, email, password_hash, role, created_at) VALUES ('u1', 'a@example.com', 'x', 'member', 1)").run();
  backup(db, copy);
  db.prepare("DELETE FROM users").run();
  db.prepare("INSERT INTO users (id, email, password_hash, role, created_at) VALUES ('u2', 'b@example.com', 'x', 'member', 1)").run();
  db.close();
  return { dir, path, copy };
}

describe("restore ownership", () => {
  it("refuses while a live process holds the database owner file, even when it holds no lock", () => {
    const { path, copy } = twoSided();
    const release = takeOwner(path);
    try {
      expect(() => restore(copy, path)).toThrow(/in use/);
    } finally {
      release();
    }
    expect(users(path)).toEqual([{ id: "u2" }]);
  });

  it("removes an owner file left by a process that is gone", () => {
    const { path, copy } = twoSided();
    writeFileSync(`${path}.owner`, JSON.stringify({ pid: 2 ** 22 + 12345, start: "Thu Jan  1 00:00:00 1970" }));
    restore(copy, path);
    expect(users(path)).toEqual([{ id: "u1" }]);
    expect(existsSync(`${path}.owner`)).toBe(false);
  });

  it("refuses a backup that is the live database or one of its log files", () => {
    const { path } = twoSided();
    expect(() => restore(path, path)).toThrow(/live database/);
    writeFileSync(`${path}-wal`, "");
    expect(() => restore(`${path}-wal`, path)).toThrow(/live database/);
  });

  it("the server cannot open the database while a restore is unfinished", () => {
    const { path, copy } = twoSided();
    killedAfter(copy, path, "marked");
    expect(pendingRestore(path)).toBeTruthy();
    expect(() => openDb(path)).toThrow(/restore.*unfinished/i);
    expect(() => restore(copy, path)).toThrow(/unfinished/i);
  });
});

describe("a restore killed at every step keeps the data", () => {
  for (const step of STEPS) {
    it(`after "${step}": finish completes it and rollback returns the original`, () => {
      const finishing = twoSided();
      const killed = killedAfter(finishing.copy, finishing.path, step);
      expect(killed.signal, killed.stderr).toBe("SIGKILL");
      if (step === "owned" || step === "validated") {
        // nothing has moved yet: the original is untouched, and a fresh restore takes over the dead process's owner file
        expect(pendingRestore(finishing.path)).toBeNull();
        expect(users(finishing.path)).toEqual([{ id: "u2" }]);
        restore(finishing.copy, finishing.path);
        expect(users(finishing.path)).toEqual([{ id: "u1" }]);
        return;
      }
      if (step !== "unmarked") expect(pendingRestore(finishing.path)).toBeTruthy();
      recoverRestore(finishing.path, "finish");
      expect(pendingRestore(finishing.path)).toBeNull();
      expect(readdirSync(finishing.dir).filter((f) => /owner|in-progress|restoring|-wal|-shm/.test(f))).toEqual([]);
      expect(users(finishing.path)).toEqual([{ id: "u1" }]);

      const rolling = twoSided();
      killedAfter(rolling.copy, rolling.path, step);
      if (step === "unmarked") return; // the restore had already finished; there is nothing to roll back
      recoverRestore(rolling.path, "rollback");
      expect(pendingRestore(rolling.path)).toBeNull();
      expect(readdirSync(rolling.dir).filter((f) => /owner|in-progress|restoring|-shm/.test(f))).toEqual([]);
      expect(users(rolling.path)).toEqual([{ id: "u2" }]);
    });
  }
});
