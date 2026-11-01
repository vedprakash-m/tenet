import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { buildApp } from "../src/app.ts";
import { loadConfig } from "../src/platform/config.ts";

it("redacts authentication fields at the structured log root and in request/response objects", () => {
  const child = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--experimental-strip-types", "--input-type=module", "--eval", `
    import { buildApp } from "./server/src/app.ts";
    import { loadConfig } from "./server/src/platform/config.ts";
    const app = await buildApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "info", DATABASE_URL: ":memory:" }));
    const value = ["synthetic", "private", "marker"].join("-");
    const logger = app.log.child({}, { serializers: { req: value => value, res: value => value } });
    logger.info({
      password: value, currentPassword: value, newPassword: value, csrfToken: value,
      body: { password: value, currentPassword: value, newPassword: value, csrfToken: value },
      req: { headers: { cookie: value, authorization: value, "x-csrf-token": value } },
      res: { headers: { "set-cookie": value } }, safe: "retained"
    }, "redaction control");
    await app.close();
  `], { cwd: process.cwd(), encoding: "utf8", timeout: 10_000 });
  expect(child.error).toBeUndefined();
  expect(child.signal).toBeNull();
  expect(child.status, child.stderr).toBe(0);
  expect(child.stderr).toBe("");
  expect(child.stdout).not.toContain(["synthetic", "private", "marker"].join("-"));
  const lines = child.stdout.trim().split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
  const log = lines.find(line => line.msg === "redaction control");
  expect(log).toMatchObject({
    level: 30, safe: "retained",
    password: "[redacted]", currentPassword: "[redacted]", newPassword: "[redacted]", csrfToken: "[redacted]", // privacy-ok: redaction sentinel, not credentials
    body: { password: "[redacted]", currentPassword: "[redacted]", newPassword: "[redacted]", csrfToken: "[redacted]" }, // privacy-ok: redaction sentinel, not credentials
    req: { headers: { cookie: "[redacted]", authorization: "[redacted]", "x-csrf-token": "[redacted]" } },
    res: { headers: { "set-cookie": "[redacted]" } },
  });
});

it("keeps health and expected/unexpected errors correlated without publishing internal errors", async () => {
  const app = await buildApp(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent", DATABASE_URL: ":memory:" }));
  app.get("/failure-control", () => { throw new Error("SELECT private_column FROM internal_table"); });
  try {
    const health = await app.inject({ url: "/api/health", headers: { "x-request-id": "untrusted-caller-id" } });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok" });
    const ids = new Set([health.headers["x-request-id"]]);
    for (const [url, status, code] of [["/missing-control", 404, "not-found"], ["/failure-control", 500, "internal"]] as const) {
      const response = await app.inject({ url, headers: { "x-request-id": "untrusted-caller-id" } });
      expect(response.statusCode).toBe(status);
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
      const id = response.headers["x-request-id"];
      expect(id).toMatch(/^[a-f0-9-]{36}$/);
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      expect(response.json()).toEqual({
        type: `urn:problem:${code}`, title: code.replaceAll("-", " "), status, correlationId: id, instance: url,
        ...(status === 500 ? { detail: "Something went wrong on our side." } : {}),
      });
      expect(response.body).not.toMatch(/SELECT|private_column|internal_table|stack|Error:/);
    }
  } finally { await app.close(); }
});
