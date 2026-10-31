import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { testApp } from "./helpers.ts";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/platform/config.ts";
import { openDb } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";
import { createSession } from "../src/platform/session/session.ts";
import { insertUser } from "../src/platform/users.repository.ts";

it("applies the shared IP ceiling to sign-in even across account keys and forwarded headers [QLT-01, QLT-12]", async () => {
  const { app, db } = await testApp();
  try {
    const pre = await app.inject({ method: "GET", url: "/api/auth/csrf" });
    const { csrfToken } = pre.json();
    for (let n = 0; n < 119; n++) expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    for (let n = 0; n < 3; n++) {
      const response = await app.inject({ method: "POST", url: "/api/auth/sign-in", cookies: { pre_csrf: csrfToken }, headers: { "x-csrf-token": csrfToken, "x-forwarded-for": `127.0.0.${n + 2}` }, payload: { email: `unknown.${n}@example.test`, password: "synthetic incorrect password" } });
      expect(response.statusCode, response.body).toBe(429);
      expect(response.json()).toMatchObject({ status: 429, type: "urn:problem:too-many-requests" });
      expect(response.headers["x-ratelimit-limit"]).toBe("120");
      expect(response.headers["x-request-id"]).toBe(response.json().correlationId);
      expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
      expect(Number(response.headers["retry-after"])).toBeLessThanOrEqual(60);
    }
    expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(429);
    expect((await app.inject({ method: "GET", url: "/api/health", remoteAddress: "127.0.0.2" })).statusCode).toBe(200);
  } finally { await app.close(); db.close(); }
});

it("retains five sign-in attempts per IP/account independently of the network ceiling [QLT-01, QLT-12]", async () => {
  const { app, db } = await testApp();
  try {
    const pre = await app.inject({ method: "GET", url: "/api/auth/csrf" });
    const { csrfToken } = pre.json();
    const attempt = (email: string, remoteAddress = "127.0.0.1") => app.inject({ method: "POST", url: "/api/auth/sign-in", remoteAddress, cookies: { pre_csrf: csrfToken }, headers: { "x-csrf-token": csrfToken }, payload: { email, password: "synthetic incorrect password" } });
    for (let n = 0; n < 5; n++) expect((await attempt("unknown@example.test")).statusCode).toBe(401);
    const refused = await attempt("unknown@example.test");
    expect(refused.statusCode).toBe(429);
    expect(refused.headers["x-ratelimit-limit"]).toBe("5");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    expect((await attempt("other@example.test")).statusCode).toBe(401);
    expect((await attempt("unknown@example.test", "127.0.0.2")).statusCode).toBe(401);
  } finally { await app.close(); db.close(); }
});

it("refuses an exhausted sign-in IP before contended session maintenance [QLT-01, QLT-12]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "starter-abuse-busy-")), path = join(dir, "app.db");
  const db = openDb(path), holder = openDb(path);
  const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: path });
  migrate(db);
  insertUser(db, { id: "member", email: "member@example.test", role: "member", password_hash: "unused", created_at: 0 });
  const { cookie } = createSession(db, "member", config.cookieSecret, Date.now());
  const before = db.prepare("SELECT * FROM sessions").all();
  const app = await buildApp(config, { db });
  try {
    for (let n = 0; n < 120; n++) expect((await app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    holder.exec("BEGIN IMMEDIATE");
    const response = await app.inject({ method: "POST", url: "/api/auth/sign-in", cookies: { sid: cookie }, payload: { email: "unknown@example.test", password: "synthetic incorrect password" } });
    expect(holder.inTransaction).toBe(true);
    expect(response.statusCode, response.body).toBe(429);
    expect(db.prepare("SELECT * FROM sessions").all()).toEqual(before);
    expect(response.cookies.some(c => c.name === "sid")).toBe(false);
  } finally {
    if (holder.inTransaction) holder.exec("ROLLBACK");
    holder.close(); await app.close(); db.close(); rmSync(dir, { recursive: true, force: true });
  }
});
