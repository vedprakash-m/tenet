import { spawnSync } from "node:child_process";
// Exercise actual HTTP/session writes against a separate SQLite connection holding the write lock.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/platform/config.ts";
import { openDb, writeTx } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";
import { createSession } from "../src/platform/session/session.ts";
import { insertUser } from "../src/platform/users.repository.ts";

it.each(["session", "sign-out"])("retries the contended %s write, returns bounded 503, and permits recovery [QLT-01, QLT-12]", async mode => {
  const dir = mkdtempSync(join(tmpdir(), "starter-session-busy-")), path = join(dir, "app.db");
  const db = openDb(path), holder = openDb(path);
  const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: path });
  migrate(db);
  insertUser(db, { id: "member", email: "member@example.test", role: "member", password_hash: "x", created_at: 0 });
  const { cookie, session } = createSession(db, "member", config.cookieSecret, Date.now());
  const app = await buildApp(config, { db });
  let holdSignOut = mode === "sign-out";
  // Acquire after the application's session hook, exposing the distinct sign-out delete window.
  app.addHook("preHandler", async req => {
    if (holdSignOut && req.url === "/api/auth/sign-out") { holder.exec("BEGIN IMMEDIATE"); holdSignOut = false; }
  });
  try {
    await app.ready();
    if (mode === "session") holder.exec("BEGIN IMMEDIATE");
    const started = Date.now();
    const response = await app.inject(mode === "session"
      ? { method: "GET", url: "/api/auth/me", cookies: { sid: cookie } }
      : { method: "POST", url: "/api/auth/sign-out", cookies: { sid: cookie }, headers: { "x-csrf-token": session.csrf } });
    expect(holder.inTransaction).toBe(true);
    expect(response.statusCode, response.body).toBe(503);
    expect(response.json()).toMatchObject({ status: 503, type: "urn:problem:busy" });
    expect(Date.now() - started).toBeGreaterThanOrEqual(900);
    expect(Date.now() - started).toBeLessThan(5000);
    expect(response.cookies.some(c => c.name === "sid" && c.value === "")).toBe(false);
    expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get(session.id)).toEqual({ id: session.id });
    holder.exec("ROLLBACK");
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: cookie } })).statusCode).toBe(200);
    if (mode === "sign-out") {
      expect((await app.inject({ method: "POST", url: "/api/auth/sign-out", cookies: { sid: cookie }, headers: { "x-csrf-token": session.csrf } })).statusCode).toBe(204);
      expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: cookie } })).statusCode).toBe(401);
    }
  } finally {
    if (holder.inTransaction) holder.exec("ROLLBACK");
    holder.close(); await app.close(); db.close(); rmSync(dir, { recursive: true, force: true });
  }
}, 10_000);

it("never starts a delayed retry's effects after its absolute wait budget [QLT-01, QLT-12]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "starter-late-retry-")), path = join(dir, "app.db");
  const db = openDb(path), holder = openDb(path); migrate(db);
  let effects = 0;
  const insert = () => { effects++; db.prepare("INSERT INTO users (id, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)").run("late", "late@example.test", "member", "unused", 0); };
  try {
    holder.exec("BEGIN IMMEDIATE");
    const pending = writeTx(db, insert).then(() => ({ kind: "committed" }), error => ({ kind: "refused", error }));
    // A real blocked event loop delays the scheduled retry; the original writer is released afterward.
    const blocked = spawnSync(process.execPath, ["-e", "setTimeout(() => {}, 1300)"], { timeout: 4000 });
    expect(blocked.status).toBe(0); holder.exec("ROLLBACK");
    expect(await pending).toMatchObject({ kind: "refused", error: { status: 503, code: "busy" } });
    expect(effects).toBe(0); expect(db.prepare("SELECT id FROM users WHERE id = 'late'").get()).toBeUndefined();
    await writeTx(db, insert);
    expect(effects).toBe(1); expect(db.prepare("SELECT id FROM users WHERE id = 'late'").get()).toEqual({ id: "late" });
  } finally {
    if (holder.inTransaction) holder.exec("ROLLBACK");
    holder.close(); db.close(); rmSync(dir, { recursive: true, force: true });
  }
});
