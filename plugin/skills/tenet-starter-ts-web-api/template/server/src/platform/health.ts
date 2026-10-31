import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { HealthResponse } from "../../../shared/schemas.ts";
import { errorResponses } from "./openapi.ts";

/** `{status: "ok"}`, plus the run token only when Tenet started this server and set one. */
export function registerHealth(app: FastifyInstance): void {
  app.withTypeProvider<ZodTypeProvider>().get("/api/health", { schema: { security: [], response: { 200: HealthResponse, ...errorResponses } }, config: { rateLimit: false } }, async () => ({ status: "ok" as const, ...(app.config.runToken ? { runToken: app.config.runToken } : {}) }));
}
