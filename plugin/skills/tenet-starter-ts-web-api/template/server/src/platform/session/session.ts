// Sessions: a 256-bit random ID in a signed, HttpOnly, SameSite=Lax cookie; rotated on sign-in; every session of a user
// revoked on password change; 8-hour idle and 7-day absolute expiry; sign-out deletes the row; an invalid session is a 401.
import { createHmac, randomBytes } from "node:crypto";
import type { Db } from "../db.ts";
import { safeEqual as same } from "../safe-equal.ts";
import { findUserById } from "../users.repository.ts";
import type { UserRow } from "../users.repository.ts";
import { deleteSession, findSession, insertSession, touchSession } from "./sessions.repository.ts";
import type { SessionRow } from "./sessions.repository.ts";

export const COOKIE = "sid";
export const IDLE_MS = 8 * 3600_000;
export const ABSOLUTE_MS = 7 * 24 * 3600_000;

const mac = (id: string, secret: string) => createHmac("sha256", secret).update(id).digest("base64url");

export const newToken = (): string => randomBytes(32).toString("hex");

/** Creates a session and returns the signed cookie value that names it. */
export function createSession(db: Db, userId: string, secret: string, now: number): { cookie: string; session: SessionRow } {
  const session: SessionRow = { id: newToken(), user_id: userId, csrf: newToken(), created_at: now, last_seen_at: now, expires_at: now + ABSOLUTE_MS };
  insertSession(db, session);
  return { cookie: `${session.id}.${mac(session.id, secret)}`, session };
}

/** The live session and its user for a cookie, or undefined: a bad signature, an unknown or expired session all look the same. */
export function resolveSession(db: Db, cookie: string | undefined, secret: string, now: number): { session: SessionRow; user: UserRow } | undefined {
  if (!cookie) return undefined;
  const dot = cookie.indexOf(".");
  if (dot < 1) return undefined;
  const id = cookie.slice(0, dot);
  if (!same(cookie.slice(dot + 1), mac(id, secret))) return undefined;
  const session = findSession(db, id);
  if (!session) return undefined;
  if (now >= session.expires_at || now - session.last_seen_at >= IDLE_MS) { deleteSession(db, id); return undefined; }
  const user = findUserById(db, session.user_id);
  if (!user) return undefined;
  touchSession(db, id, now);
  return { session, user };
}

export { deleteSession };
