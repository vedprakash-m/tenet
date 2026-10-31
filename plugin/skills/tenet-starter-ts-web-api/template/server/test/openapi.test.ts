// Contract generation is source-bound, not a hand-maintained inventory (TS §12.1).
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/platform/config.ts";
import { signIn, testApp } from "./helpers.ts";

const content = (response: { content: Record<string, { schema: unknown }> }) => response.content["application/json"]!.schema;

describe("generated OpenAPI [QLT-01, QLT-06]", () => {
  it("describes account request/response shapes and cookie/CSRF requirements without exposing secrets", async () => {
    const { app, db } = await testApp();
    try {
      const document = JSON.parse(JSON.stringify(app.swagger()));
      expect(document.openapi).toBe("3.1.0");
      expect(Object.keys(document.paths)).toEqual(expect.arrayContaining([
        "/api/auth/csrf", "/api/auth/me", "/api/auth/password", "/api/auth/sign-in", "/api/auth/sign-out", "/api/health",
      ]));
      const routes = document.paths;
      expect(routes["/api/health"].get.security).toEqual([]);
      expect(routes["/api/auth/csrf"].get.security).toEqual([]);
      expect(routes["/api/auth/sign-in"].post.security).toContainEqual({ preSession: [], csrf: [] });
      expect(routes["/api/auth/me"].get.security).toEqual([{ session: [] }]);
      expect(routes["/api/auth/password"].post.security).toEqual([{ session: [], csrf: [] }]);
      expect(routes["/api/auth/sign-out"].post.security).toEqual([{ session: [], csrf: [] }]);
      expect(document.components.securitySchemes).toMatchObject({
        session: { type: "apiKey", in: "cookie", name: "sid" },
        preSession: { type: "apiKey", in: "cookie", name: "pre_csrf" },
        csrf: { type: "apiKey", in: "header", name: "x-csrf-token" },
      });
      const request = routes["/api/auth/sign-in"].post.requestBody.content["application/json"].schema;
      expect(request.required).toEqual(["email", "password"]);
      expect(request.properties.email).toMatchObject({ type: "string", format: "email", maxLength: 254 });
      expect(request.properties.password).toMatchObject({ type: "string", minLength: 1, maxLength: 256 });
      const session = content(routes["/api/auth/me"].get.responses[200]);
      expect(session).toMatchObject({ required: ["user", "csrfToken"], properties: { user: { required: ["id", "email", "role"], properties: { role: { enum: ["admin", "member"] } } } } });
      expect(routes["/api/auth/sign-out"].post.responses[204]).not.toHaveProperty("content");
      expect(content(routes["/api/auth/me"].get.responses.default)).toMatchObject({ required: ["type", "title", "status", "correlationId"] });
      const denied = await app.inject({ method: "GET", url: "/api/auth/me" });
      expect(denied.statusCode).toBe(401);
      expect(denied.json()).toMatchObject({ status: 401, correlationId: expect.any(String) });
      const signed = await signIn(app);
      expect(signed.res.statusCode).toBe(200);
      expect(Object.keys(signed.res.json()).sort()).toEqual(["csrfToken", "user"]);
      expect(JSON.stringify(document)).not.toMatch(/password_hash|cookieSecret|development-only-secret|ada@example\.test/);
      expect((await app.inject({ method: "GET", url: "/openapi.json" })).statusCode).toBe(404);
    } finally { await app.close(); db.close(); }
  });

  it("discovers an added feature and changes its contract when its runtime Zod schema changes", async () => {
    for (const minimum of [2, 7]) {
      const app = await buildApp(loadConfig({ NODE_ENV: "test", DATABASE_URL: ":memory:", LOG_LEVEL: "silent" }));
      try {
        app.withTypeProvider<ZodTypeProvider>().get("/api/contract-probe", {
          schema: { response: { 200: z.object({ label: z.string().min(minimum) }) } },
        }, async () => ({ label: "source-bound" }));
        await app.ready();
        const document = JSON.parse(JSON.stringify(app.swagger()));
        expect(content(document.paths["/api/contract-probe"].get.responses[200])).toMatchObject({ properties: { label: { type: "string", minLength: minimum } } });
        expect((await app.inject({ method: "GET", url: "/api/contract-probe" })).json()).toEqual({ label: "source-bound" });
      } finally { await app.close(); }
    }
  });

  it("exports repeatable JSON in a separate process without opening the ambient database or configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "starter-contract-"));
    const database = join(root, "guard.db");
    writeFileSync(database, "must remain untouched");
    try {
      const run = () => spawnSync(process.execPath, ["--experimental-strip-types", "server/src/openapi.ts"], {
        env: { ...process.env, NODE_ENV: "production", PORT: "invalid", DATABASE_URL: database, COOKIE_SECRET: "short" }, encoding: "utf8", timeout: 15_000,
      });
      const first = run(), second = run();
      expect(first.status, first.stderr).toBe(0); expect(second.status, second.stderr).toBe(0);
      expect(first.stdout).toBe(second.stdout);
      expect(JSON.parse(first.stdout)).toMatchObject({ openapi: "3.1.0", paths: { "/api/auth/me": expect.any(Object) } });
      expect(readFileSync(database, "utf8")).toBe("must remain untouched");
      expect(readdirSync(root)).toEqual(["guard.db"]);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
