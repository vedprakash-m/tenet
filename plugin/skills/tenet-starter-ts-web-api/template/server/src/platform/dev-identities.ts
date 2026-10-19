// Development identities: on the first run an admin and a member are seeded with random 24-character passwords, saved to
// .env.local (git-ignored, excluded from Tenet's reads by default). They are printed to stderr at startup only when no
// run token is set, so they never reach Tenet's run directories, responses or traces.
import { randomBytes, randomUUID } from "node:crypto";
import { appendFileSync } from "node:fs";
import { hashPassword } from "./auth/passwords.ts";
import type { Db } from "./db.ts";
import { countUsers, insertUser } from "./users.repository.ts";

const password = (): string => randomBytes(18).toString("base64url").slice(0, 24);

export async function seedDevIdentities(db: Db, envFile: string, now: number): Promise<Array<{ email: string; role: string; password: string }> | undefined> {
  if (countUsers(db) > 0) return undefined;
  const made = [
    { email: "admin@example.test", role: "admin", password: password() },
    { email: "member@example.test", role: "member", password: password() },
  ];
  for (const u of made) insertUser(db, { id: randomUUID(), email: u.email, role: u.role as "admin" | "member", password_hash: await hashPassword(u.password), created_at: now });
  appendFileSync(envFile, made.map((u) => `DEV_${u.role.toUpperCase()}_EMAIL=${u.email}\nDEV_${u.role.toUpperCase()}_PASSWORD=${u.password}\n`).join(""), { mode: 0o600 });
  return made;
}
