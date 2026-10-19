import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/platform/auth/passwords.ts";
import { loadConfig } from "../src/platform/config.ts";
import { ABSOLUTE_MS, IDLE_MS } from "../src/platform/session/session.ts";
import { PASSWORD, signIn, testApp } from "./helpers.ts";

describe("sign-in and sessions", () => {
  it("signs in with a pre-session token, sets a signed HttpOnly SameSite=Lax cookie, and returns the actor and a CSRF token", async () => {
    const { app } = await testApp();
    const { res, sid } = await signIn(app);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { email: "ada@example.test", role: "member" } });
    const cookie = res.cookies.find((c) => c.name === "sid")!;
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.sameSite).toBe("Lax");
    expect(sid).toMatch(/^[0-9a-f]{64}\.[\w-]+$/);
    const me = await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: sid! } });
    expect(me.statusCode).toBe(200);
  });

  it("does not say whether the account exists, and treats a wrong password and an unknown email alike", async () => {
    const { app } = await testApp();
    const wrong = await signIn(app, "ada@example.test", "wrong password here");
    const unknown = await signIn(app, "nobody@example.test", "whatever password");
    expect(wrong.res.statusCode).toBe(401);
    expect(unknown.res.statusCode).toBe(401);
    expect(wrong.res.json()).toEqual({ ...unknown.res.json(), correlationId: wrong.res.json().correlationId, instance: unknown.res.json().instance });
  });

  it("requires a CSRF token on every state-changing request, bound to the session", async () => {
    const { app } = await testApp();
    const noPre = await app.inject({ method: "POST", url: "/api/auth/sign-in", payload: { email: "ada@example.test", password: PASSWORD } });
    expect(noPre.statusCode).toBe(403);
    expect(noPre.json().type).toBe("urn:problem:csrf");
    const { sid, csrf, preToken } = await signIn(app);
    const out = await app.inject({ method: "POST", url: "/api/auth/sign-out", cookies: { sid: sid! } });
    expect(out.statusCode).toBe(403);
    const pre = await app.inject({ method: "POST", url: "/api/auth/sign-out", cookies: { sid: sid! }, headers: { "x-csrf-token": preToken } });
    expect(pre.statusCode).toBe(403);
    const ok = await app.inject({ method: "POST", url: "/api/auth/sign-out", cookies: { sid: sid! }, headers: { "x-csrf-token": csrf! } });
    expect(ok.statusCode).toBe(204);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: sid! } })).statusCode).toBe(401);
  });

  it("rotates on sign-in: the presented session is gone once the new one exists", async () => {
    const { app } = await testApp();
    const first = await signIn(app);
    const again = await app.inject({ method: "POST", url: "/api/auth/sign-in", cookies: { sid: first.sid!, pre_csrf: first.preToken }, headers: { "x-csrf-token": first.csrf! }, payload: { email: "ada@example.test", password: PASSWORD } });
    expect(again.statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: first.sid! } })).statusCode).toBe(401);
  });

  it("expires after 8 idle hours and after 7 days absolute, and a forged or tampered cookie is just signed out", async () => {
    let t = 1_000_000;
    const { app } = await testApp({ now: () => t });
    const a = await signIn(app);
    t += IDLE_MS - 1;
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: a.sid! } })).statusCode).toBe(200);
    t += IDLE_MS;
    const idle = await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: a.sid! } });
    expect(idle.statusCode).toBe(401);
    expect(idle.cookies.find((c) => c.name === "sid")?.value).toBe("");

    // Staying active never extends past 7 days: poll just inside the idle window until the absolute limit passes.
    const b = await signIn(app);
    const start = t;
    for (let i = 0; i < 25; i++) {
      t += IDLE_MS - 1000;
      const status = (await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: b.sid! } })).statusCode;
      expect(status, `${(t - start) / 3600_000} hours in`).toBe(t - start < ABSOLUTE_MS ? 200 : 401);
    }
    expect(ABSOLUTE_MS).toBe(7 * 24 * 3600_000);

    const c = await signIn(app);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: `${c.sid!.slice(0, -2)}xx` } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: "nonsense" } })).statusCode).toBe(401);
  });

  it("revokes every session of the user on password change, and keeps the caller signed in with a fresh one", async () => {
    const { app } = await testApp();
    const one = await signIn(app);
    const two = await signIn(app);
    const res = await app.inject({ method: "POST", url: "/api/auth/password", cookies: { sid: one.sid! }, headers: { "x-csrf-token": one.csrf! }, payload: { currentPassword: PASSWORD, newPassword: "a brand new passphrase" } });
    expect(res.statusCode).toBe(200);
    const fresh = res.cookies.find((c) => c.name === "sid")!.value;
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: one.sid! } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: two.sid! } })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/api/auth/me", cookies: { sid: fresh } })).statusCode).toBe(200);
    expect((await signIn(app, "ada@example.test", "a brand new passphrase")).res.statusCode).toBe(200);
    expect((await signIn(app)).res.statusCode).toBe(401);
  });

  it("limits sign-in to 5 attempts a minute per IP and account", async () => {
    const { app } = await testApp();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) codes.push((await signIn(app, "ada@example.test", "wrong password here")).res.statusCode);
    expect(codes.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(codes.slice(5)).toEqual([429, 429]);
  });
});

describe("passwords", () => {
  it("hashes with scrypt and a fresh salt, verifies in constant time, and rejects a different password", async () => {
    const a = await hashPassword("pw one pw one"), b = await hashPassword("pw one pw one");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$32768$8$1$")).toBe(true);
    expect(await verifyPassword("pw one pw one", a)).toBe(true);
    expect(await verifyPassword("pw two pw two", a)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("errors, headers and health", () => {
  it("answers problem JSON with a correlation id and no stack or SQL, and validates request shape", async () => {
    const { app } = await testApp();
    const missing = await app.inject({ method: "GET", url: "/api/nope" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toMatchObject({ type: "urn:problem:not-found", status: 404 });
    expect(missing.headers["x-request-id"]).toBe(missing.json().correlationId);
    const pre = await app.inject({ method: "GET", url: "/api/auth/csrf" });
    const token = pre.json().csrfToken as string;
    const bad = await app.inject({ method: "POST", url: "/api/auth/sign-in", headers: { "x-csrf-token": token }, cookies: { pre_csrf: token }, payload: { email: "not-an-email" } });
    expect(bad.statusCode).toBe(400);
    expect(JSON.stringify(bad.json())).not.toMatch(/stack|SELECT|at \w+ \(/);
  });

  it("sends security headers", async () => {
    const { app } = await testApp();
    const res = await app.inject({ method: "GET", url: "/api/health" });
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });

  it("reports health, and the run token only when one is set", async () => {
    const plain = await testApp();
    expect((await plain.app.inject({ url: "/api/health" })).json()).toEqual({ status: "ok" });
    const tokened = await testApp({}, { TENET_RUN_TOKEN: "run-123" });
    expect((await tokened.app.inject({ url: "/api/health" })).json()).toEqual({ status: "ok", runToken: "run-123" });
  });

  it("binds to the loopback interface only and refuses a production start without a secret", () => {
    expect(loadConfig({ NODE_ENV: "test" }).host).toBe("127.0.0.1");
    expect(() => loadConfig({ NODE_ENV: "production" })).toThrow(/COOKIE_SECRET/);
    expect(loadConfig({ NODE_ENV: "production", COOKIE_SECRET: "x".repeat(32) }).env).toBe("production");
  });
});
