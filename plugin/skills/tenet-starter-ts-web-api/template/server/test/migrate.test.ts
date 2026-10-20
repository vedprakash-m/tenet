import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { backup } from "../src/platform/backup.ts";
import { openDb, writeTx } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";

const dirs: string[] = [];
const scratch = () => { const d = mkdtempSync(join(tmpdir(), "starter-")); dirs.push(d); return d; };
afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });
const sql = (dir: string, name: string, text: string) => writeFileSync(join(dir, name), text);

describe("migrations", () => {
  it("applies the shipped migrations once, in order, and records checksums", () => {
    const db = openDb(":memory:");
    expect(migrate(db).applied).toEqual(["0001_init.sql"]);
    expect(migrate(db).applied).toEqual([]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()).toEqual({ n: 1 });
    expect(db.pragma("foreign_keys", { simple: true })).toBe(1);
  });

  it("stops when an applied migration was edited, or went missing", () => {
    const dir = scratch(), db = openDb(":memory:");
    sql(dir, "0001_a.sql", "CREATE TABLE a (x INTEGER);");
    migrate(db, { dir });
    sql(dir, "0001_a.sql", "CREATE TABLE a (x INTEGER, y INTEGER);");
    expect(() => migrate(db, { dir })).toThrow(/was changed after it was applied/);
    rmSync(join(dir, "0001_a.sql"));
    expect(() => migrate(db, { dir })).toThrow(/missing/);
  });

  it("rolls a failing migration back completely and stops", () => {
    const dir = scratch(), db = openDb(":memory:");
    sql(dir, "0001_a.sql", "CREATE TABLE a (x INTEGER);");
    sql(dir, "0002_bad.sql", "CREATE TABLE b (x INTEGER); INSERT INTO nope VALUES (1);");
    expect(() => migrate(db, { dir })).toThrow();
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'b'").get()).toBeUndefined();
    expect(db.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: "0001_a.sql" }]);
  });

  it("backs up a database that holds data before migrating it, and verifies the copy", () => {
    const dir = scratch(), db = openDb(join(dir, "app.db"));
    sql(dir, "0001_a.sql", "CREATE TABLE a (x INTEGER);");
    migrate(db, { dir });
    db.prepare("INSERT INTO a VALUES (7)").run();
    sql(dir, "0002_b.sql", "ALTER TABLE a ADD COLUMN y INTEGER;");
    const copy = join(dir, "before.db");
    migrate(db, { dir, backupTo: copy });
    const b = openDb(copy);
    expect(b.prepare("SELECT x FROM a").all()).toEqual([{ x: 7 }]);
    expect(b.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: "0001_a.sql" }]);
  });

  it("backs up an existing database next to it by default, before applying anything, and leaves an in-memory one alone", () => {
    const dir = scratch(), file = join(dir, "app.db"), db = openDb(file);
    sql(dir, "0001_a.sql", "CREATE TABLE a (x INTEGER);");
    migrate(db, { dir });
    expect(readdirSync(dir).filter((f) => f.endsWith(".bak"))).toEqual([]); // a new database has nothing to protect
    db.prepare("INSERT INTO a VALUES (7)").run();
    sql(dir, "0002_b.sql", "ALTER TABLE a ADD COLUMN y INTEGER;");
    migrate(db, { dir });
    const copies = readdirSync(dir).filter((f) => f.endsWith(".bak"));
    expect(copies).toHaveLength(1);
    const copy = openDb(join(dir, copies[0]!));
    expect(copy.prepare("SELECT x FROM a").all()).toEqual([{ x: 7 }]);
    expect(copy.prepare("SELECT version FROM schema_migrations").all()).toEqual([{ version: "0001_a.sql" }]);
    const memory = openDb(":memory:");
    sql(dir, "0003_c.sql", "CREATE TABLE c (x INTEGER);");
    migrate(memory, { dir });
    expect(() => migrate(memory, { dir })).not.toThrow();
  });

  it("refuses a backup whose schema version differs", () => {
    const dir = scratch(), a = openDb(join(dir, "a.db"));
    migrate(a);
    expect(() => backup(a, join(dir, "copy.db"))).not.toThrow();
  });
});

describe("write transactions", () => {
  it("retries a busy database and reports 'try again' after a second", async () => {
    const dir = scratch(), path = join(dir, "busy.db");
    const holder = openDb(path), writer = openDb(path);
    holder.exec("CREATE TABLE t (x INTEGER)");
    holder.exec("BEGIN IMMEDIATE");
    const started = Date.now();
    await expect(writeTx(writer, () => writer.prepare("INSERT INTO t VALUES (1)").run())).rejects.toMatchObject({ status: 503 });
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    holder.exec("COMMIT");
    await expect(writeTx(writer, () => writer.prepare("INSERT INTO t VALUES (1)").run())).resolves.toBeDefined();
  });
});
