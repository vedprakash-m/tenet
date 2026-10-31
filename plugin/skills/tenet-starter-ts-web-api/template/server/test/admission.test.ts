import { expect, it } from "vitest";
import { admissionApp } from "./support/admission.ts";
import { createSession, IDLE_MS, ABSOLUTE_MS } from "../src/platform/session/session.ts";
import { hashPassword } from "../src/platform/auth/passwords.ts";

it("isolates authenticated operations and session confirmation from anonymous exhaustion [QLT-01, QLT-12]", async () => {
  const c = await admissionApp();
  try {
    for (let n = 0; n < 120; n++) expect((await c.app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(200);
    expect((await c.app.inject({ method: "GET", url: "/api/health" })).statusCode).toBe(429);
    const result = await c.app.inject({ method: "GET", url: "/api/admission-probe", cookies: { sid: c.first.cookie } });
    expect(result.statusCode, result.body).toBe(200); expect(result.json()).toEqual({ userId: "first" });
    expect(result.headers["x-ratelimit-limit"]).toBe("300");
    expect((await c.app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: c.first.cookie } })).statusCode).toBe(200);
    const out = await c.app.inject({ method: "POST", url: "/api/auth/sign-out", cookies: { sid: c.first.cookie }, headers: { "x-csrf-token": c.first.session.csrf } });
    expect(out.statusCode).toBe(204);
    expect(c.db.prepare("SELECT id FROM sessions WHERE id = ?").get(c.first.session.id)).toBeUndefined();
    expect((await c.app.inject({ method: "GET", url: "/api/auth/me?next=/api/health" })).statusCode).toBe(401);
    expect((await c.app.inject({ method: "GET", url: "/api/admission-probe?next=/api/auth/me" })).statusCode).toBe(429);
    expect((await c.app.inject({ method: "GET", url: "/api/not-found", cookies: { sid: c.second.cookie } })).statusCode).toBe(429);
    expect((await c.app.inject({ method: "POST", url: "/api/auth/sign-in?next=/api/admission-probe", cookies: { sid: c.second.cookie }, payload: {} })).statusCode).toBe(429);
  } finally { await c.close(); }
});

it("keeps the user ceiling across sessions and IPs without touching refused sessions [QLT-01, QLT-12]", async () => {
  let now = 1000; const c = await admissionApp({ now: () => now });
  try {
    for (let n = 0; n < 300; n++) expect((await c.app.inject({ method: "GET", url: "/api/admission-probe", cookies: { sid: c.first.cookie } })).statusCode).toBe(200);
    const otherSession = createSession(c.db, "first", c.config.cookieSecret, now);
    now = 2000;
    const before = c.db.prepare("SELECT * FROM sessions ORDER BY id").all();
    for (const [cookie, remoteAddress] of [[c.first.cookie, "127.0.0.1"], [otherSession.cookie, "127.0.0.2"]] as const) {
      const response = await c.app.inject({ method: "GET", url: "/api/admission-probe", cookies: { sid: cookie! }, remoteAddress });
      expect(response.statusCode).toBe(429); expect(response.headers["x-ratelimit-limit"]).toBe("300");
      expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
    }
    expect(c.db.prepare("SELECT * FROM sessions ORDER BY id").all()).toEqual(before);
    expect((await c.app.inject({ method: "GET", url: "/api/admission-probe", cookies: { sid: c.second.cookie } })).statusCode).toBe(200);
  } finally { await c.close(); }
});

it.each(["empty", "forged", "revoked", "missing-user", "idle", "absolute"])("never grants a user bucket or cheap status path to a %s cookie [QLT-12]", async kind => {
  let now = 1000; const c = await admissionApp({ now: () => now });
  try {
    let cookie = c.first.cookie;
    if (kind === "empty") cookie = "";
    if (kind === "forged") cookie += "wrong";
    if (kind === "revoked") c.db.prepare("DELETE FROM sessions WHERE id = ?").run(c.first.session.id);
    if (kind === "missing-user") { c.db.pragma("foreign_keys = OFF"); c.db.prepare("DELETE FROM users WHERE id = 'first'").run(); c.db.pragma("foreign_keys = ON"); }
    if (kind === "idle") now += IDLE_MS;
    if (kind === "absolute") { c.db.prepare("UPDATE sessions SET last_seen_at = ?").run(now + ABSOLUTE_MS); now += ABSOLUTE_MS; }
    const before = c.db.prepare("SELECT * FROM sessions ORDER BY id").all();
    for (let n = 0; n < 120; n++) await c.app.inject({ method: "GET", url: "/api/health" });
    const response = await c.app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: cookie } });
    expect(response.statusCode).toBe(429); expect(response.headers["x-ratelimit-limit"]).toBe("120");
    expect(response.cookies.some(value => value.name === "sid")).toBe(false);
    expect(c.db.prepare("SELECT * FROM sessions ORDER BY id").all()).toEqual(before);
    expect((await c.app.inject({ method: "GET", url: "/api/auth/me" })).statusCode).toBe(401);
  } finally { await c.close(); }
});

it("keeps password attempts per verified user across session/IP changes [QLT-12]", async () => {
  let now = 1000; const c = await admissionApp({ now: () => now });
  try {
    const hash = await hashPassword("real synthetic password"); c.db.prepare("UPDATE users SET password_hash = ?").run(hash);
    const attempt = (cookie: string, csrf: string, remoteAddress = "127.0.0.1") => c.app.inject({ method: "POST", url: "/api/auth/password", cookies: { sid: cookie }, remoteAddress, headers: { "x-csrf-token": csrf }, payload: { currentPassword: "incorrect synthetic password", newPassword: "another synthetic password" } });
    for (let n = 0; n < 5; n++) expect((await attempt(c.first.cookie, c.first.session.csrf)).statusCode).toBe(403);
    const rotated = createSession(c.db, "first", c.config.cookieSecret, now); now = 2000;
    const before = c.db.prepare("SELECT * FROM sessions ORDER BY id").all();
    const refused = await attempt(rotated.cookie, rotated.session.csrf, "127.0.0.2");
    expect(refused.statusCode).toBe(429); expect(refused.headers["x-ratelimit-limit"]).toBe("5");
    expect(c.db.prepare("SELECT * FROM sessions ORDER BY id").all()).toEqual(before);
    expect((await attempt(c.second.cookie, c.second.session.csrf)).statusCode).toBe(403);
  } finally { await c.close(); }
});
