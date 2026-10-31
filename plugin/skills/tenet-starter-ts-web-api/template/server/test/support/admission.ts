import { buildApp } from "../../src/app.ts";
import { requireActor } from "../../src/platform/actor.ts";
import { loadConfig } from "../../src/platform/config.ts";
import { openDb } from "../../src/platform/db.ts";
import type { Db } from "../../src/platform/db.ts";
import { migrate } from "../../src/platform/migrate.ts";
import { createSession } from "../../src/platform/session/session.ts";
import { insertUser } from "../../src/platform/users.repository.ts";

export async function admissionApp(options: { db?: Db; now?: () => number } = {}) {
  const db = options.db ?? openDb(":memory:"), now = options.now ?? (() => 1000);
  migrate(db);
  for (const id of ["first", "second"]) insertUser(db, { id, email: `${id}@example.test`, role: "member", password_hash: "unused", created_at: 0 });
  const config = loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: ":memory:" });
  const first = createSession(db, "first", config.cookieSecret, now());
  const second = createSession(db, "second", config.cookieSecret, now());
  const app = await buildApp(config, { db, now });
  app.get("/api/admission-probe", async req => ({ userId: requireActor(req).user.id }));
  return { app, db, config, first, second, close: async () => { try { await app.close(); } finally { db.close(); } } };
}
