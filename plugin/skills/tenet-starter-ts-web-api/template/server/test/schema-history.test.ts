// Validate the actual backup/migration boundary, not only a known migration filename (QLT-07).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { expect, it } from "vitest";
import { backup } from "../src/platform/backup.ts";
import { openDb } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";
import { pendingRestore, recoverRestore, restore } from "../src/platform/restore.ts";

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "starter-history-")), path = join(dir, "app.db"), copy = join(dir, "copy.db");
  const db = openDb(path); migrate(db);
  db.prepare("INSERT INTO users VALUES ('backup-user', 'backup@example.test', 'member', 'x', 1)").run();
  backup(db, copy);
  db.prepare("UPDATE users SET id = 'live-user', email = 'live@example.test'").run();
  db.close();
  return { dir, path, copy };
}
function corrupt(path: string, kind: string) {
  const db = new Database(path);
  try {
    db.pragma("foreign_keys = OFF");
    if (kind === "checksum") db.prepare("UPDATE schema_migrations SET checksum = 'wrong'").run();
    if (kind === "history") db.prepare("DELETE FROM schema_migrations WHERE version = (SELECT MIN(version) FROM schema_migrations)").run();
    if (kind === "foreign-key") db.prepare("INSERT INTO sessions VALUES ('orphan', 'missing-user', 'synthetic', 1, 1, 2)").run();
  } finally { db.close(); }
}

it.each(["checksum", "history", "foreign-key"])("rejects a %s-incompatible backup before moving live data [QLT-07]", kind => {
  const { dir, path, copy } = fixture();
  try {
    corrupt(copy, kind);
    const before = readFileSync(path);
    expect(() => restore(copy, path)).toThrow(/checksum|changed|history|schema|foreign key/i);
    expect(readFileSync(path)).toEqual(before);
    expect(pendingRestore(path)).toBeNull();
    expect(readdirSync(dir).filter(name => /before-restore|restoring|owner|in-progress/.test(name))).toEqual([]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("refuses a retroactive migration before backup or data changes [QLT-07]", () => {
  const dir = mkdtempSync(join(tmpdir(), "starter-migration-order-")), path = join(dir, "app.db");
  const db = openDb(path);
  try {
    writeFileSync(join(dir, "0001_a.sql"), "CREATE TABLE a (value INTEGER);");
    writeFileSync(join(dir, "0003_c.sql"), "CREATE TABLE c (value INTEGER);");
    migrate(db, { dir });
    db.prepare("INSERT INTO a VALUES (7)").run();
    writeFileSync(join(dir, "0002_retroactive.sql"), "DROP TABLE a;");
    expect(() => migrate(db, { dir })).toThrow(/history|order|prefix|forward/i);
    expect(db.prepare("SELECT value FROM a").all()).toEqual([{ value: 7 }]);
    expect(db.prepare("SELECT version FROM schema_migrations ORDER BY version").all()).toEqual([{ version: "0001_a.sql" }, { version: "0003_c.sql" }]);
    expect(readdirSync(dir).filter(name => name.endsWith(".bak"))).toEqual([]);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});

it("revalidates a changed backup after intent, keeps recovery fenced and rolls back to live data [QLT-07]", () => {
  const { dir, path, copy } = fixture();
  try {
    const child = spawnSync(process.execPath, ["--experimental-strip-types", join(import.meta.dirname, "support/restore-child.ts"), copy, path, "marked"], { encoding: "utf8", timeout: 10_000, killSignal: "SIGKILL" });
    expect(child.signal, child.stderr).toBe("SIGKILL");
    corrupt(copy, "checksum");
    expect(() => recoverRestore(path, "finish")).toThrow(/checksum|changed/i);
    expect(pendingRestore(path)).not.toBeNull();
    expect(() => openDb(path)).toThrow(/unfinished/);
    expect(recoverRestore(path, "rollback")).toMatch(/original database is back/);
    expect(pendingRestore(path)).toBeNull();
    const db = openDb(path);
    try { expect(db.prepare("SELECT id FROM users").all()).toEqual([{ id: "live-user" }]); }
    finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

it("rolls back the current migration when its foreign-key postflight fails [QLT-07]", () => {
  const dir = mkdtempSync(join(tmpdir(), "starter-migration-fk-")), db = openDb(":memory:");
  try {
    writeFileSync(join(dir, "0001_a.sql"), "CREATE TABLE parent (id INTEGER PRIMARY KEY); CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));");
    migrate(db, { dir });
    db.pragma("foreign_keys = OFF"); db.prepare("INSERT INTO child VALUES (1, 99)").run(); db.pragma("foreign_keys = ON");
    writeFileSync(join(dir, "0002_b.sql"), "CREATE TABLE later (value TEXT);");
    expect(() => migrate(db, { dir })).toThrow(/foreign key/);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'later'").get()).toBeUndefined();
    expect(db.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: "0001_a.sql" }]);
    expect(db.prepare("SELECT * FROM child").all()).toEqual([{ id: 1, parent_id: 99 }]);
  } finally { db.close(); rmSync(dir, { recursive: true, force: true }); }
});
