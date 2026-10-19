// Sign-in, sign-out, the current actor and password change. Failure is uniform: the response never says whether the
// account exists, and the time it takes does not either (a decoy hash is verified for unknown accounts).
import { randomBytes } from "node:crypto";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { ChangePasswordRequest, SessionResponse, SignInRequest } from "../../../../shared/schemas.ts";
import { requireActor } from "../actor.ts";
import { writeTx } from "../db.ts";
import { AppError } from "../errors.ts";
import { ABSOLUTE_MS, COOKIE, createSession, deleteSession } from "../session/session.ts";
import { deleteUserSessions } from "../session/sessions.repository.ts";
import { findUserByEmail, setPasswordHash } from "../users.repository.ts";
import { PRE_COOKIE } from "./csrf.ts";
import { decoyHash, hashPassword, verifyPassword } from "./passwords.ts";

export function registerAuthRoutes(app: FastifyInstance): void {
  const r = app.withTypeProvider<ZodTypeProvider>();
  const secure = app.config.env === "production";
  const setSession = (reply: FastifyReply, cookie: string) =>
    void reply.setCookie(COOKIE, cookie, { httpOnly: true, sameSite: "lax", path: "/", secure, maxAge: ABSOLUTE_MS / 1000 });

  r.get("/api/auth/csrf", async (_req, reply) => {
    const token = randomBytes(32).toString("hex");
    void reply.setCookie(PRE_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", secure });
    return { csrfToken: token };
  });

  r.post("/api/auth/sign-in", {
    schema: { body: SignInRequest },
    // 5 attempts a minute per IP and account; the global limit still bounds one IP trying many accounts.
    config: { rateLimit: { max: 5, timeWindow: "1 minute", hook: "preHandler", keyGenerator: (req: { ip: string; body?: unknown }) => `${req.ip}|${(req.body as { email?: string } | undefined)?.email ?? ""}` } },
  }, async (req, reply) => {
    const { email, password } = req.body;
    const user = findUserByEmail(app.db, email);
    const ok = await verifyPassword(password, user?.password_hash ?? (await decoyHash()));
    if (!user || !ok) throw new AppError(401, "invalid-credentials", "That email and password do not match.");
    // Rotate: the session that was presented, if any, is gone before the new one exists.
    const old = req.actor?.session.id;
    const { cookie, session } = await writeTx(app.db, () => {
      if (old) deleteSession(app.db, old);
      return createSession(app.db, user.id, app.config.cookieSecret, app.now());
    });
    setSession(reply, cookie);
    return SessionResponse.parse({ user: { id: user.id, email: user.email, role: user.role }, csrfToken: session.csrf });
  });

  r.post("/api/auth/sign-out", async (req, reply) => {
    const actor = requireActor(req);
    deleteSession(app.db, actor.session.id);
    void reply.clearCookie(COOKIE, { path: "/" });
    return reply.status(204).send();
  });

  r.get("/api/auth/me", async (req) => {
    const { user, session } = requireActor(req);
    return SessionResponse.parse({ user: { id: user.id, email: user.email, role: user.role }, csrfToken: session.csrf });
  });

  r.post("/api/auth/password", { schema: { body: ChangePasswordRequest } }, async (req, reply) => {
    const { user } = requireActor(req);
    if (!(await verifyPassword(req.body.currentPassword, user.password_hash))) throw new AppError(403, "invalid-credentials", "The current password is not right.");
    const hash = await hashPassword(req.body.newPassword);
    // Every session of this user is revoked, including this one; a fresh one is issued so the caller stays signed in.
    const { cookie, session } = await writeTx(app.db, () => {
      setPasswordHash(app.db, user.id, hash);
      deleteUserSessions(app.db, user.id);
      return createSession(app.db, user.id, app.config.cookieSecret, app.now());
    });
    setSession(reply, cookie);
    return SessionResponse.parse({ user: { id: user.id, email: user.email, role: user.role }, csrfToken: session.csrf });
  });
}
