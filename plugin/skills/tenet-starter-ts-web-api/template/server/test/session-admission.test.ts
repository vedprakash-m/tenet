import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { admissionApp } from "./support/admission.ts";
import { buildApp } from "../src/app.ts";
import { openDb } from "../src/platform/db.ts";
import { readSession, createSession, IDLE_MS } from "../src/platform/session/session.ts";
import { hashPassword, verifyPassword } from "../src/platform/auth/passwords.ts";
import { AppError } from "../src/platform/errors.ts";

it.each(["live", "expired"])("reads a %s session under an external writer without maintenance [QLT-12]", async kind => {
  const dir = mkdtempSync(join(tmpdir(), "admission-read-")), path = join(dir, "app.db");
  const db = openDb(path), holder = openDb(path), c = await admissionApp({ db });
  try {
    const before = db.prepare("SELECT * FROM sessions ORDER BY id").all(); holder.exec("BEGIN IMMEDIATE");
    const found = readSession(db, c.first.cookie, c.config.cookieSecret, kind === "live" ? 2000 : 1000 + IDLE_MS);
    expect(found?.user.id).toBe(kind === "live" ? "first" : undefined);
    expect(holder.inTransaction).toBe(true); expect(db.prepare("SELECT * FROM sessions ORDER BY id").all()).toEqual(before);
  } finally { holder.exec("ROLLBACK"); holder.close(); await c.close(); rmSync(dir, { recursive: true, force: true }); }
});

it("answers the no-cookie status path without an available database [QLT-12]", async () => {
  const c = await admissionApp(); await c.app.ready(); c.db.close();
  try {
    const response = await c.app.inject({ method: "GET", url: "/api/auth/me?fresh=1" });
    expect(response.statusCode).toBe(401); expect(response.headers["x-ratelimit-limit"]).toBe("6000");
    expect(response.cookies).toEqual([]);
  } finally { await c.app.close(); }
});

it.each(["revoke", "password", "idle", "absolute", "role"])("rechecks authority after a %s change between admission and maintenance [QLT-12]", async mode => {
  const dir = mkdtempSync(join(tmpdir(), "admission-race-")), path = join(dir, "app.db");
  let now = 1000; const db = openDb(path), writer = openDb(path), c = await admissionApp({ db, now: () => now });
  const password = "real synthetic password", changed = "changed synthetic password";
  if (mode === "password") db.prepare("UPDATE users SET password_hash = ? WHERE id = 'first'").run(await hashPassword(password));
  if (mode === "role") db.prepare("UPDATE users SET role = 'admin' WHERE id = 'first'").run();
  const other = mode === "password" ? await buildApp(c.config, { db: writer, now: () => now }) : undefined;
  const otherSession = mode === "password" ? createSession(writer, "first", c.config.cookieSecret, now) : undefined;
  c.app.get("/api/authority-probe", async req => {
    if (!req.actor) throw new AppError(401, "unauthenticated", "Sign in to continue.");
    if (mode === "role" && req.actor.user.role !== "admin") throw new AppError(403, "forbidden", "Not allowed.");
    return { userId: req.actor.user.id };
  });
  c.app.addHook("onRequest", async req => {
    if (req.routeOptions.url !== "/api/authority-probe") return;
    expect(req.actor).toBeNull();
    expect((writer.prepare("SELECT last_seen_at FROM sessions WHERE id = ?").get(c.first.session.id) as { last_seen_at: number }).last_seen_at).toBe(1000);
    if (mode === "revoke") writer.prepare("DELETE FROM sessions WHERE id = ?").run(c.first.session.id);
    if (mode === "role") writer.prepare("UPDATE users SET role = 'member' WHERE id = 'first'").run();
    if (mode === "idle") now += IDLE_MS;
    if (mode === "absolute") writer.prepare("UPDATE sessions SET expires_at = ? WHERE id = ?").run(now, c.first.session.id);
    if (other && otherSession) {
      const result = await other.inject({ method: "POST", url: "/api/auth/password", cookies: { sid: otherSession.cookie }, headers: { "x-csrf-token": otherSession.session.csrf }, payload: { currentPassword: password, newPassword: changed } });
      expect(result.statusCode, result.body).toBe(200);
    }
  });
  try {
    now = 1001;
    const response = await c.app.inject({ method: "GET", url: "/api/authority-probe", cookies: { sid: c.first.cookie } });
    expect(response.statusCode, response.body).toBe(mode === "role" ? 403 : 401);
    if (mode !== "role") expect(db.prepare("SELECT id FROM sessions WHERE id = ?").get(c.first.session.id)).toBeUndefined();
    if (mode === "password") {
      const row = db.prepare("SELECT password_hash FROM users WHERE id = 'first'").get() as { password_hash: string };
      expect(await verifyPassword(changed, row.password_hash)).toBe(true);
    }
  } finally { if (other) await other.close(); writer.close(); await c.close(); rmSync(dir, { recursive: true, force: true }); }
});

it("bounds all attempts by network before parsing or contended session work [QLT-12]", async () => {
  const dir = mkdtempSync(join(tmpdir(), "admission-coarse-")), path = join(dir, "app.db");
  const db = openDb(path), holder = openDb(path), c = await admissionApp({ db });
  try {
    for (let n = 0; n < 6000; n++) {
      const response = await c.app.inject({ method: "GET", url: "/api/health", headers: { "x-forwarded-for": `127.0.${Math.floor(n / 250)}.${n % 250 + 1}` } });
      expect(response.statusCode).toBe(n < 120 ? 200 : 429);
      expect(response.headers["x-ratelimit-limit"]).toBe("120");
    }
    holder.exec("BEGIN IMMEDIATE"); const before = db.prepare("SELECT * FROM sessions ORDER BY id").all();
    const refused = await c.app.inject({ method: "POST", url: "/api/auth/password", cookies: { sid: c.first.cookie }, headers: { "content-type": "application/json" }, payload: "not JSON" });
    expect(refused.statusCode).toBe(429); expect(refused.headers["x-ratelimit-limit"]).toBe("6000");
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0); expect(holder.inTransaction).toBe(true);
    expect(db.prepare("SELECT * FROM sessions ORDER BY id").all()).toEqual(before);
    holder.exec("ROLLBACK");
    expect((await c.app.inject({ method: "GET", url: "/api/health", remoteAddress: "127.0.0.2" })).statusCode).toBe(200);
  } finally { if (holder.inTransaction) holder.exec("ROLLBACK"); holder.close(); await c.close(); rmSync(dir, { recursive: true, force: true }); }
});
