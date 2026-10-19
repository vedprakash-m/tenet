// Structured logs with redaction, and a correlation ID on every request and response.
import { randomUUID } from "node:crypto";
import type { FastifyServerOptions } from "fastify";

export const REDACT = ["req.headers.cookie", "req.headers.authorization", "req.headers['x-csrf-token']", "res.headers['set-cookie']", "*.password", "*.currentPassword", "*.newPassword", "*.csrfToken"];

export function loggerOptions(level: string): FastifyServerOptions["logger"] {
  return level === "silent" ? false : { level, redact: { paths: REDACT, censor: "[redacted]" } };
}

export const requestId = (): string => randomUUID();
