// buildApp(config): plugins, platform routes, features, the error handler. Importing this never listens or touches the disk
// beyond the database it is given; server.ts is the only entry point that listens.
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import Fastify from "fastify";
import type { FastifyInstance } from "fastify";
import { serializerCompiler, validatorCompiler } from "fastify-type-provider-zod";
import "./platform/actor.ts";
import { registerAdmission } from "./platform/admission.ts";
import type { Config } from "./platform/config.ts";
import { HEADER, PRE_COOKIE, isStateChanging, tokensMatch } from "./platform/auth/csrf.ts";
import { openDb, writeTx } from "./platform/db.ts";
import type { Db } from "./platform/db.ts";
import { AppError, problem } from "./platform/errors.ts";
import { registerOpenApi } from "./platform/openapi.ts";
import { registerHealth } from "./platform/health.ts";
import { loggerOptions, requestId } from "./platform/logging.ts";
import { migrate } from "./platform/migrate.ts";
import { registerAuthRoutes } from "./platform/auth/routes.ts";
import { COOKIE, resolveSession } from "./platform/session/session.ts";

export interface Deps { db?: Db; now?: () => number }

export async function buildApp(config: Config, deps: Deps = {}): Promise<FastifyInstance> {
  const db = deps.db ?? openDb(config.databaseUrl);
  migrate(db);
  const now = deps.now ?? Date.now;
  const app = Fastify({
    logger: loggerOptions(config.logLevel), genReqId: requestId, bodyLimit: 100_000, requestTimeout: 5000,
    // The 500 handler below is the only place that ever sees an unexpected error.
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  app.decorate("db", db);
  app.decorate("config", config);
  app.decorate("now", now);
  app.decorateRequest("actor", null);

  await registerOpenApi(app);
  await app.register(helmet);
  await app.register(cookie);
  app.addHook("onRequest", async (req, reply) => { void reply.header("x-request-id", req.id); });
  await registerAdmission(app);

  // Re-read current authority after admission; invalid cookies are cleared for admitted requests.
  app.addHook("preHandler", async (req, reply) => {
    const raw = req.cookies[COOKIE];
    const found = raw ? await writeTx(db, () => resolveSession(db, raw, config.cookieSecret, now())) : undefined;
    if (found) req.actor = { user: found.user, session: found.session };
    else if (raw) void reply.clearCookie(COOKIE, { path: "/" });
    // CSRF: bound to the session row, or to the pre-session cookie when there is no session (sign-in).
    if (isStateChanging(req.method)) {
      const sent = req.headers[HEADER];
      const token = Array.isArray(sent) ? sent[0] : sent;
      const expected = req.actor ? req.actor.session.csrf : req.cookies[PRE_COOKIE];
      if (!tokensMatch(token, expected)) throw new AppError(403, "csrf", "The request is missing a valid CSRF token.");
    }
  });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, req, reply) => {
    if (err instanceof AppError) return reply.status(err.status).send(problem(err.status, err.code, err.message, req.id, req.url));
    if (err.validation) return reply.status(400).send(problem(400, "invalid-request", "The request did not match the expected shape.", req.id, req.url));
    if (err.statusCode === 429) return reply.status(429).send(problem(429, "too-many-requests", "Too many requests; try again shortly.", req.id, req.url));
    if (err.statusCode && err.statusCode < 500) return reply.status(err.statusCode).send(problem(err.statusCode, "bad-request", undefined, req.id, req.url));
    req.log.error({ err }, "unhandled error"); // the stack goes to the log, never to the client
    return reply.status(500).send(problem(500, "internal", "Something went wrong on our side.", req.id, req.url));
  });
  app.setNotFoundHandler((req, reply) => reply.status(404).send(problem(404, "not-found", undefined, req.id, req.url)));

  registerHealth(app);
  registerAuthRoutes(app);
  // Features register here, each behind its index.ts: await app.register(featureRoutes)

  app.addHook("onClose", async () => { if (!deps.db) db.close(); });
  return app;
}
