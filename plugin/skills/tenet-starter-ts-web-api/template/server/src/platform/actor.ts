// Who is making this request. Resolved once per request in app.ts; routes ask for it with requireActor.
import type { FastifyRequest } from "fastify";
import type { Config } from "./config.ts";
import type { Db } from "./db.ts";
import { AppError } from "./errors.ts";
import type { SessionRow } from "./session/sessions.repository.ts";
import type { UserRow } from "./users.repository.ts";

export interface Actor { user: UserRow; session: SessionRow }

declare module "fastify" {
  interface FastifyRequest { actor: Actor | null }
  interface FastifyInstance { db: Db; config: Config; now: () => number }
}

/** The signed-in actor, or a 401. */
export function requireActor(req: FastifyRequest): Actor {
  if (!req.actor) throw new AppError(401, "unauthenticated", "Sign in to continue.");
  return req.actor;
}
