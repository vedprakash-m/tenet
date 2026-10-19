// Configuration is read once, validated, and never read from process.env elsewhere.
import { z } from "zod";

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  DATABASE_URL: z.string().default("data/app.db"),
  COOKIE_SECRET: z.string().min(32).optional(),
  TENET_RUN_TOKEN: z.string().optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export interface Config {
  env: "development" | "test" | "production";
  /** The API binds to the loopback interface only; any other binding is a consequential change (docs/hardening.md). */
  host: "127.0.0.1";
  port: number;
  databaseUrl: string;
  cookieSecret: string;
  runToken: string | undefined;
  logLevel: string;
}

export function loadConfig(source: Record<string, string | undefined> = process.env): Config {
  const e = Env.parse(source);
  if (e.NODE_ENV === "production" && !e.COOKIE_SECRET) throw new Error("COOKIE_SECRET (32+ characters) is required in production");
  // Development and test get a fixed per-process secret so a restart signs out nobody it should not; it is never used in production.
  return {
    env: e.NODE_ENV, host: "127.0.0.1", port: e.PORT, databaseUrl: e.DATABASE_URL,
    cookieSecret: e.COOKIE_SECRET ?? "development-only-secret-do-not-use-in-production-0123456789", runToken: e.TENET_RUN_TOKEN, logLevel: e.LOG_LEVEL,
  };
}
