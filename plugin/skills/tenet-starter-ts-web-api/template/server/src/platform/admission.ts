import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AppError } from "./errors.ts";
import { assertRateMetadata, sealRateMetadata } from "./rate-metadata.ts";
import { COOKIE, readSession } from "./session/session.ts";

type Check = ReturnType<FastifyInstance["createRateLimit"]>;
type Branch = { kind: "anonymous" } | { kind: "status" } | { kind: "user"; id: string };

async function enforce(check: Check, req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const limit = await check(req);
  if (limit.isAllowed) return;
  reply.headers({ "x-ratelimit-limit": limit.max, "x-ratelimit-remaining": limit.remaining, "x-ratelimit-reset": limit.ttlInSeconds });
  if (limit.isExceeded) {
    void reply.header("retry-after", limit.ttlInSeconds);
    throw new AppError(429, "too-many-requests", "Too many requests; try again shortly.");
  }
}

function branch(app: FastifyInstance, req: FastifyRequest): Branch {
  const route = req.routeOptions.url;
  if (!route || route === "/api/health" || route === "/api/auth/sign-in" || route === "/api/auth/csrf") return { kind: "anonymous" };
  if (req.method === "GET" && route === "/api/auth/me" && !Object.hasOwn(req.cookies, COOKIE)) return { kind: "status" };
  const found = readSession(app.db, req.cookies[COOKIE], app.config.cookieSecret, app.now());
  return found ? { kind: "user", id: found.user.id } : { kind: "anonymous" };
}

export async function registerAdmission(app: FastifyInstance): Promise<void> {
  await app.register(rateLimit, { global: false, max: 6000, timeWindow: "1 minute" });
  const identities = new WeakMap<FastifyRequest, string>();
  const userKey = (req: FastifyRequest) => {
    const id = identities.get(req);
    if (id === undefined) throw new Error("Missing verified admission identity");
    return id;
  };
  const coarse = app.createRateLimit();
  const anonymous = app.createRateLimit({ max: 120 });
  const user = app.createRateLimit({ max: 300, keyGenerator: userKey });
  const password = app.createRateLimit({ max: 5, keyGenerator: userKey });
  const routes: Array<{ config?: unknown }> = [];
  app.addHook("onRoute", options => { routes.push(options); });
  app.addHook("onReady", done => {
    try { for (const route of routes) assertRateMetadata(route.config); done(); }
    catch (error) { done(error as Error); }
  });
  app.addHook("onRequest", async (req, reply) => {
    sealRateMetadata(req.routeOptions.config);
    await enforce(coarse, req, reply);
    const selected = branch(app, req);
    if (selected.kind === "status") return;
    if (selected.kind === "anonymous") return enforce(anonymous, req, reply);
    // A request-local quota key, deleted before handlers; never an actor or authority cache.
    identities.set(req, selected.id);
    try {
      await enforce(user, req, reply);
      if (req.method === "POST" && req.routeOptions.url === "/api/auth/password") await enforce(password, req, reply);
    } finally { identities.delete(req); }
  });
}
