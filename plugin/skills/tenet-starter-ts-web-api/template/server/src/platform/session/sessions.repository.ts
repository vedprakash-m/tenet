import type { Db } from "../db.ts";

export interface SessionRow { id: string; user_id: string; csrf: string; created_at: number; last_seen_at: number; expires_at: number }

export const insertSession = (db: Db, s: SessionRow): void => void db.prepare("INSERT INTO sessions (id, user_id, csrf, created_at, last_seen_at, expires_at) VALUES (@id, @user_id, @csrf, @created_at, @last_seen_at, @expires_at)").run(s);
export const findSession = (db: Db, id: string): SessionRow | undefined => db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as SessionRow | undefined;
export const touchSession = (db: Db, id: string, now: number): void => void db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(now, id);
export const deleteSession = (db: Db, id: string): void => void db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
export const deleteUserSessions = (db: Db, userId: string): void => void db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
