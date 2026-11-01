// Independent SQLite writers change authority after the request has read it. Password hashing stays real.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/platform/config.ts";
import { openDb } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";
import { hashPassword, verifyPassword } from "../src/platform/auth/passwords.ts";
import { createSession, IDLE_MS } from "../src/platform/session/session.ts";
import { insertUser } from "../src/platform/users.repository.ts";
import { PASSWORD, signIn } from "./helpers.ts";

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "auth-freshness-")), path = join(dir, "app.db");
  const db = openDb(path), writer = openDb(path);
  const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: path });
  let now = 1000;
  migrate(db);
  const hash = await hashPassword(PASSWORD);
  insertUser(db, { id: "u1", email: "ada@example.test", role: "admin", password_hash: hash, created_at: 0 });
  const app = await buildApp(config, { db, now: () => now });
  return { db, writer, app, config, hash, advance: () => { now += IDLE_MS; }, close: async () => {
    vi.restoreAllMocks(); await app.close(); writer.close(); db.close(); rmSync(dir, { recursive: true, force: true });
  } };
}

it.each(["password", "delete", "email", "role"])("sign-in uses current authority after a concurrent %s change [QLT-12]", async mode => {
  const c = await fixture();
  const replacement = await hashPassword("a different synthetic password");
  let changed = false;
  const prepare = c.db.prepare.bind(c.db);
  // Observe the real credential read, then commit through another connection before the handler can proceed.
  vi.spyOn(c.db, "prepare").mockImplementation(sql => {
    const statement = prepare(sql);
    if (sql === "SELECT * FROM users WHERE email = ?") {
      const get = statement.get.bind(statement);
      vi.spyOn(statement, "get").mockImplementation((...args) => {
        const row = get(...args);
        if (!changed) {
          changed = true;
          if (mode === "password") c.writer.prepare("UPDATE users SET password_hash = ? WHERE id = 'u1'").run(replacement);
          if (mode === "delete") c.writer.prepare("DELETE FROM users WHERE id = 'u1'").run();
          if (mode === "email") c.writer.prepare("UPDATE users SET email = 'other@example.test' WHERE id = 'u1'").run();
          if (mode === "role") c.writer.prepare("UPDATE users SET role = 'member' WHERE id = 'u1'").run();
        }
        return row;
      });
    }
    return statement;
  });
  try {
    const result = await signIn(c.app);
    expect(changed).toBe(true);
    expect(result.res.statusCode, result.res.body).toBe(mode === "role" ? 200 : 401);
    if (mode === "role") expect(result.res.json().user.role).toBe("member");
    else {
      expect(result.res.json().type).toBe("urn:problem:invalid-credentials");
      expect(result.sid).toBeUndefined();
      expect(c.db.prepare("SELECT id FROM sessions").all()).toEqual([]);
    }
  } finally { await c.close(); }
});

it.each(["password", "revoke", "idle", "absolute", "role"])("password change revalidates its session and verified hash after a concurrent %s change [QLT-12]", async mode => {
  const c = await fixture();
  const original = createSession(c.db, "u1", c.config.cookieSecret, 1000);
  const concurrentHash = await hashPassword("a concurrently changed password");
  let changed = false;
  // This hook follows the application's maintenance/CSRF hook, so req.actor is a genuine earlier snapshot.
  c.app.addHook("preHandler", async req => {
    if (req.url !== "/api/auth/password") return;
    expect(req.actor?.user.password_hash).toBe(c.hash);
    changed = true;
    if (mode === "password") c.writer.prepare("UPDATE users SET password_hash = ? WHERE id = 'u1'").run(concurrentHash);
    if (mode === "revoke") c.writer.prepare("DELETE FROM sessions WHERE id = ?").run(original.session.id);
    if (mode === "idle") c.advance();
    if (mode === "absolute") c.writer.prepare("UPDATE sessions SET expires_at = 1000 WHERE id = ?").run(original.session.id);
    if (mode === "role") c.writer.prepare("UPDATE users SET role = 'member' WHERE id = 'u1'").run();
  });
  try {
    await c.app.ready();
    const response = await c.app.inject({ method: "POST", url: "/api/auth/password", cookies: { sid: original.cookie },
      headers: { "x-csrf-token": original.session.csrf }, payload: { currentPassword: PASSWORD, newPassword: "my replacement synthetic password" } });
    expect(changed).toBe(true);
    expect(response.statusCode, response.body).toBe(mode === "role" ? 200 : mode === "password" ? 403 : 401);
    const user = c.writer.prepare("SELECT password_hash FROM users WHERE id = 'u1'").get() as { password_hash: string };
    if (mode === "role") {
      expect(response.json().user.role).toBe("member");
      expect(await verifyPassword("my replacement synthetic password", user.password_hash)).toBe(true);
      expect(c.writer.prepare("SELECT id FROM sessions WHERE id = ?").get(original.session.id)).toBeUndefined();
    } else {
      expect(user.password_hash).toBe(mode === "password" ? concurrentHash : c.hash);
      if (mode !== "password") expect(response.cookies.some(cookie => cookie.name === "sid" && cookie.value === "")).toBe(true);
      expect(response.cookies.some(cookie => cookie.name === "sid" && cookie.value !== "")).toBe(false);
      const sessions = c.writer.prepare("SELECT id FROM sessions").all();
      expect(sessions).toEqual(mode === "revoke" ? [] : [{ id: original.session.id }]);
    }
  } finally { await c.close(); }
});

it("permits only one concurrent password replacement from sessions for the old password [QLT-12]", async () => {
  const c = await fixture();
  const sessions = [createSession(c.db, "u1", c.config.cookieSecret, 1000), createSession(c.db, "u1", c.config.cookieSecret, 1000)];
  const replacements = ["first replacement synthetic password", "second replacement synthetic password"];
  try {
    await c.app.ready();
    const responses = await Promise.all(sessions.map((s, i) => c.app.inject({ method: "POST", url: "/api/auth/password",
      cookies: { sid: s.cookie }, headers: { "x-csrf-token": s.session.csrf },
      payload: { currentPassword: PASSWORD, newPassword: replacements[i] } })));
    expect(responses.map(r => r.statusCode).sort()).toEqual([200, 401]);
    const winner = responses.findIndex(r => r.statusCode === 200);
    const row = c.writer.prepare("SELECT password_hash FROM users WHERE id = 'u1'").get() as { password_hash: string };
    expect(await verifyPassword(replacements[winner]!, row.password_hash)).toBe(true);
    expect(c.writer.prepare("SELECT id FROM sessions").all()).toHaveLength(1);
    for (const s of sessions) expect(c.writer.prepare("SELECT id FROM sessions WHERE id = ?").get(s.session.id)).toBeUndefined();
  } finally { await c.close(); }
});

it.each(["sign-in", "password"])("rechecks %s authority after a real busy transaction retry [QLT-12]", async mode => {
  const c = await fixture();
  const original = createSession(c.db, "u1", c.config.cookieSecret, 1000);
  const replacement = await hashPassword("a concurrent replacement password");
  let contended = false;
  c.app.addHook("preHandler", async req => {
    if (req.url === `/api/auth/${mode}`) c.writer.exec("BEGIN IMMEDIATE");
  });
  const transaction = c.db.transaction.bind(c.db);
  vi.spyOn(c.db, "transaction").mockImplementation(fn => {
    const tx = transaction(fn), immediate = tx.immediate;
    const observed = ((...args: unknown[]) => {
      try { return immediate(...args); }
      catch (error) {
        if (!contended && (error as { code?: string }).code === "SQLITE_BUSY") {
          contended = true;
          c.writer.prepare("UPDATE users SET password_hash = ? WHERE id = 'u1'").run(replacement);
          c.writer.prepare("DELETE FROM sessions WHERE user_id = 'u1'").run();
          c.writer.exec("COMMIT");
        }
        throw error;
      }
    }) as typeof tx.immediate;
    return Object.assign(tx.bind(undefined), { default: tx.default, deferred: tx.deferred, immediate: observed, exclusive: tx.exclusive });
  });
  try {
    await c.app.ready();
    const response = mode === "sign-in" ? (await signIn(c.app)).res : await c.app.inject({
      method: "POST", url: "/api/auth/password", cookies: { sid: original.cookie }, headers: { "x-csrf-token": original.session.csrf },
      payload: { currentPassword: PASSWORD, newPassword: "my replacement synthetic password" },
    });
    expect(contended).toBe(true);
    expect(response.statusCode, response.body).toBe(401);
    expect(response.cookies.some(cookie => cookie.name === "sid" && cookie.value !== "")).toBe(false);
    expect(c.writer.prepare("SELECT password_hash FROM users WHERE id = 'u1'").get()).toEqual({ password_hash: replacement });
    expect(c.writer.prepare("SELECT id FROM sessions").all()).toEqual([]);
  } finally { if (c.writer.inTransaction) c.writer.exec("ROLLBACK"); await c.close(); }
});
