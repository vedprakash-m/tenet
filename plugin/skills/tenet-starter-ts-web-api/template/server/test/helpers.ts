import { buildApp } from "../src/app.ts";
import type { Deps } from "../src/app.ts";
import { hashPassword } from "../src/platform/auth/passwords.ts";
import { loadConfig } from "../src/platform/config.ts";
import { openDb } from "../src/platform/db.ts";
import { migrate } from "../src/platform/migrate.ts";
import { insertUser } from "../src/platform/users.repository.ts";

export const PASSWORD = "correct horse battery staple";

export async function testApp(deps: Deps = {}, env: Record<string, string> = {}) {
  const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: ":memory:", ...env });
  const db = deps.db ?? openDb(":memory:");
  migrate(db);
  if (!deps.db) insertUser(db, { id: "u1", email: "ada@example.test", role: "member", password_hash: await hashPassword(PASSWORD), created_at: 0 });
  const app = await buildApp(config, { ...deps, db });
  await app.ready();
  return { app, db, config };
}

type App = Awaited<ReturnType<typeof testApp>>["app"];

/** Signs in the way a browser does: fetch the pre-session token, then post with it. */
export async function signIn(app: App, email = "ada@example.test", password = PASSWORD) {
  const pre = await app.inject({ method: "GET", url: "/api/auth/csrf" });
  const preToken = (pre.json() as { csrfToken: string }).csrfToken;
  const res = await app.inject({ method: "POST", url: "/api/auth/sign-in", headers: { "x-csrf-token": preToken }, cookies: { pre_csrf: preToken }, payload: { email, password } });
  const sid = res.cookies.find((c) => c.name === "sid")?.value;
  const csrf = res.statusCode === 200 ? (res.json() as { csrfToken: string }).csrfToken : undefined;
  return { res, sid, csrf, preToken };
}
