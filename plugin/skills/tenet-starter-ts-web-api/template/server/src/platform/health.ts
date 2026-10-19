import type { FastifyInstance } from "fastify";

/** `{status: "ok"}`, plus the run token only when Tenet started this server and set one. */
export function registerHealth(app: FastifyInstance): void {
  app.get("/api/health", { config: { rateLimit: false } }, async () => ({ status: "ok", ...(app.config.runToken ? { runToken: app.config.runToken } : {}) }));
}
