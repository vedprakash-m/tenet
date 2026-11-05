// Development identities: on the first run an admin and a member are seeded with random 24-character passwords, saved to
// .env.local (git-ignored, excluded from Tenet's reads by default). They are printed to stderr at startup only when no
// run token is set, so they never reach Tenet's run directories, responses or traces.
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { hashPassword } from "./auth/passwords.ts";
import { writeTx } from "./db.ts";
import type { Db } from "./db.ts";
import { countUsers, insertUser } from "./users.repository.ts";

const password = (): string => randomBytes(18).toString("base64url").slice(0, 24);

function publishCredentials(envFile: string, text: string): void {
  let prior: string;
  try { prior = readFileSync(envFile, "utf8"); } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    prior = "";
  }
  if (/^\s*(?:export\s+)?DEV_(?:ADMIN|MEMBER)_(?:EMAIL|PASSWORD)\s*=/m.test(prior)) {
    throw new Error("The empty database has existing development credentials in its env file; reconcile the database and credentials before starting.");
  }
  const temp = `${envFile}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temp, `${prior}${prior && !prior.endsWith("\n") ? "\n" : ""}${text}`, { flag: "wx", mode: 0o600, flush: true });
    renameSync(temp, envFile);
  } finally { rmSync(temp, { force: true }); }
}

export async function seedDevIdentities(db: Db, envFile: string, now: number): Promise<Array<{ email: string; role: string; password: string }> | undefined> {
  if (countUsers(db) > 0) return undefined;
  const made = [
    { email: "admin@example.test", role: "admin", password: password() },
    { email: "member@example.test", role: "member", password: password() },
  ];
  const users = await Promise.all(made.map(async (u) => ({ id: randomUUID(), email: u.email, role: u.role as "admin" | "member", password_hash: await hashPassword(u.password), created_at: now })));
  return writeTx(db, () => {
    if (countUsers(db) > 0) return undefined;
    for (const u of users) insertUser(db, u);
    // Publish before commit: failures roll back both users; a pre-commit crash leaves credentials that require reconciliation.
    publishCredentials(envFile, made.map((u) => `DEV_${u.role.toUpperCase()}_EMAIL=${u.email}\nDEV_${u.role.toUpperCase()}_PASSWORD=${u.password}\n`).join(""));
    return made;
  });
}
