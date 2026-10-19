import type { Db } from "./db.ts";

export interface UserRow { id: string; email: string; role: "admin" | "member"; password_hash: string; created_at: number }

export const findUserByEmail = (db: Db, email: string): UserRow | undefined => db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
export const findUserById = (db: Db, id: string): UserRow | undefined => db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
export const countUsers = (db: Db): number => (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n;
export const insertUser = (db: Db, u: UserRow): void => void db.prepare("INSERT INTO users (id, email, role, password_hash, created_at) VALUES (@id, @email, @role, @password_hash, @created_at)").run(u);
export const setPasswordHash = (db: Db, id: string, hash: string): void => void db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, id);
