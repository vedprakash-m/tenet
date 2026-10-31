// Documentation metadata uses the same Zod schemas as runtime validation/serialization.
// These security declarations describe the actor/CSRF hooks; they do not enforce authorization.
import swagger from "@fastify/swagger";
import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform, jsonSchemaTransformObject } from "fastify-type-provider-zod";
import { HEADER, PRE_COOKIE } from "./auth/csrf.ts";
import { COOKIE } from "./session/session.ts";
import { Problem } from "../../../shared/schemas.ts";

export const errorResponses = { default: Problem };
export const sessionSecurity = [{ session: [] }];
export const mutationSecurity = [{ session: [], csrf: [] }];
export const signInSecurity = [{ preSession: [], csrf: [] }, ...mutationSecurity];

export async function registerOpenApi(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      openapi: "3.1.0", info: { title: "Application API", version: "0.0.0" },
      components: { securitySchemes: {
        session: { type: "apiKey", in: "cookie", name: COOKIE, description: "HttpOnly session cookie issued by sign-in." },
        preSession: { type: "apiKey", in: "cookie", name: PRE_COOKIE, description: "Pre-session cookie issued by GET /api/auth/csrf." },
        csrf: { type: "apiKey", in: "header", name: HEADER, description: "Token bound to the current session, or to the pre-session cookie before sign-in." },
      } },
    },
    transform: jsonSchemaTransform, transformObject: jsonSchemaTransformObject,
  });
}
