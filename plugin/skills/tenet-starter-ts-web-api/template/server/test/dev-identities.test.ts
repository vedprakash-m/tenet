import { fork } from "node:child_process";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { afterEach, describe, expect, it } from "vitest";
import { verifyPassword } from "../src/platform/auth/passwords.ts";
import { openDb } from "../src/platform/db.ts";
import type { Db } from "../src/platform/db.ts";
import { seedDevIdentities } from "../src/platform/dev-identities.ts";
import { migrate } from "../src/platform/migrate.ts";
import { countUsers, findUserByEmail, insertUser } from "../src/platform/users.repository.ts";

const dirs: string[] = [];
const databases: Db[] = [];
const scratch = () => { const dir = mkdtempSync(join(tmpdir(), "starter-seed-")); dirs.push(dir); return dir; };
const database = (file: string) => { const db = openDb(file); databases.push(db); migrate(db); return db; };
afterEach(() => {
  for (const db of databases.splice(0)) if (db.open) db.close();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

async function matchingCredentials(db: Db, envFile: string) {
  const text = readFileSync(envFile, "utf8"), env = parseEnv(text);
  for (const role of ["ADMIN", "MEMBER"]) {
    const email = env[`DEV_${role}_EMAIL`]!, password = env[`DEV_${role}_PASSWORD`]!;
    expect(text.match(new RegExp(`^DEV_${role}_EMAIL=`, "gm"))).toHaveLength(1);
    expect(text.match(new RegExp(`^DEV_${role}_PASSWORD=`, "gm"))).toHaveLength(1);
    expect(password).toHaveLength(24);
    const user = findUserByEmail(db, email)!;
    expect(user.role).toBe(role.toLowerCase());
    expect(await verifyPassword(password, user.password_hash)).toBe(true);
  }
}

async function killAt(file: string, envFile: string, boundary: string) {
  const child = fork(new URL("support/seed-crash.mjs", import.meta.url), [file, envFile, boundary], {
    execArgv: ["--experimental-strip-types"], silent: true,
  });
  let reached = false, output = "";
  child.stderr!.on("data", (chunk: Buffer) => { output += chunk.toString(); });
  const timer = setTimeout(() => child.kill("SIGKILL"), 15_000);
  try {
    await new Promise<void>((resolve, reject) => {
      child.once("error", reject);
      child.once("message", (message) => {
        reached = message === boundary;
        child.kill("SIGKILL");
      });
      child.once("exit", (_code, signal) => {
        if (reached && signal === "SIGKILL") resolve();
        else reject(new Error(`seed child did not reach ${boundary}: ${output}`));
      });
    });
  } finally { clearTimeout(timer); }
}

describe("development identities", () => {
  it("publishes exactly two matching accounts and preserves credentials on later starts", async () => {
    const dir = scratch(), envFile = join(dir, ".env.local"), db = database(join(dir, "app.db"));
    writeFileSync(envFile, "CUSTOM_SETTING=keep\n");
    const made = await seedDevIdentities(db, envFile, 123);
    expect(made?.map((u) => u.role)).toEqual(["admin", "member"]);
    expect(countUsers(db)).toBe(2);
    await matchingCredentials(db, envFile);
    const saved = readFileSync(envFile, "utf8");
    expect(saved).toContain("CUSTOM_SETTING=keep\n");
    expect(await seedDevIdentities(db, envFile, 456)).toBeUndefined();
    expect(readFileSync(envFile, "utf8")).toBe(saved);
    if (process.platform !== "win32") expect(statSync(envFile).mode & 0o777).toBe(0o600);
  });

  it("rolls back both users when the second real SQLite insert fails and can retry", async () => {
    const dir = scratch(), envFile = join(dir, ".env.local"), file = join(dir, "app.db"), db = database(file);
    db.exec("CREATE TRIGGER fail_member BEFORE INSERT ON users WHEN NEW.role = 'member' BEGIN SELECT RAISE(ABORT, 'controlled second insert'); END;");
    await expect(seedDevIdentities(db, envFile, 123)).rejects.toThrow("controlled second insert");
    expect(countUsers(db)).toBe(0);
    expect(existsSync(envFile)).toBe(false);
    db.close();
    const restarted = database(file);
    restarted.exec("DROP TRIGGER fail_member");
    await seedDevIdentities(restarted, envFile, 456);
    await matchingCredentials(restarted, envFile);
  });

  it("rolls back both users when credential publication fails, cleans its temp and can retry", async () => {
    const dir = scratch(), envFile = join(dir, ".env.local"), db = database(join(dir, "app.db"));
    mkdirSync(envFile);
    await expect(seedDevIdentities(db, envFile, 123)).rejects.toThrow();
    expect(countUsers(db)).toBe(0);
    expect(readdirSync(dir).filter((name) => name.startsWith(".env.local."))).toEqual([]);
    rmSync(envFile, { recursive: true });
    await seedDevIdentities(db, envFile, 456);
    await matchingCredentials(db, envFile);
  });

  it("does not seed over unrelated existing users or modify their env file", async () => {
    const dir = scratch(), envFile = join(dir, ".env.local"), db = database(join(dir, "app.db"));
    insertUser(db, { id: "existing", email: "existing@example.test", role: "member", password_hash: "untouched", created_at: 1 });
    const text = "CUSTOM_SETTING=keep\n";
    writeFileSync(envFile, text);
    expect(await seedDevIdentities(db, envFile, 123)).toBeUndefined();
    expect(countUsers(db)).toBe(1);
    expect(findUserByEmail(db, "existing@example.test")?.password_hash).toBe("untouched");
    expect(readFileSync(envFile, "utf8")).toBe(text);
  });

  it("rolls back both users on a real credential-file write error", async () => {
    const dir = scratch(), parent = join(dir, "missing"), envFile = join(parent, ".env.local"), db = database(join(dir, "app.db"));
    await expect(seedDevIdentities(db, envFile, 123)).rejects.toMatchObject({ code: "ENOENT" });
    expect(countUsers(db)).toBe(0);
    expect(existsSync(envFile)).toBe(false);
    mkdirSync(parent);
    await seedDevIdentities(db, envFile, 456);
    await matchingCredentials(db, envFile);
  });

  it("rechecks the empty database after hashing when two seed calls overlap", async () => {
    const dir = scratch(), envFile = join(dir, ".env.local"), db = database(join(dir, "app.db"));
    const results = await Promise.all([seedDevIdentities(db, envFile, 123), seedDevIdentities(db, envFile, 456)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(countUsers(db)).toBe(2);
    await matchingCredentials(db, envFile);
  });

  it("refuses uncertain existing development credentials without changing them or adding users", async () => {
    const dir = scratch(), envFile = join(dir, ".env.local"), db = database(join(dir, "app.db"));
    const text = "CUSTOM_SETTING=keep\nexport DEV_ADMIN_PASSWORD=human-value\n"; // privacy-ok
    writeFileSync(envFile, text);
    await expect(seedDevIdentities(db, envFile, 123)).rejects.toThrow("existing development credentials");
    expect(countUsers(db)).toBe(0);
    expect(readFileSync(envFile, "utf8")).toBe(text);
  });

  for (const boundary of ["before-commit", "after-commit"]) {
    it(`preserves the published pair after a real child is killed ${boundary}`, async () => {
      const dir = scratch(), file = join(dir, "app.db"), envFile = join(dir, ".env.local");
      database(file).close();
      writeFileSync(envFile, "CUSTOM_SETTING=keep\n");
      await killAt(file, envFile, boundary);
      const published = readFileSync(envFile, "utf8"), db = database(file);
      expect(countUsers(db)).toBe(boundary === "before-commit" ? 0 : 2);
      if (boundary === "before-commit") {
        await expect(seedDevIdentities(db, envFile, 456)).rejects.toThrow("existing development credentials");
        expect(countUsers(db)).toBe(0);
      } else {
        expect(await seedDevIdentities(db, envFile, 456)).toBeUndefined();
        await matchingCredentials(db, envFile);
      }
      expect(readFileSync(envFile, "utf8")).toContain("CUSTOM_SETTING=keep\n");
      expect(readFileSync(envFile, "utf8")).toBe(published);
    }, 20_000);
  }
});
