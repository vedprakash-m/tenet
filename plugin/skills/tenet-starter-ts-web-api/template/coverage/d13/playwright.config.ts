import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "../..");
const port = process.env.PORT ?? "3100";
process.env.TENET_RUN_TOKEN ??= randomUUID();
const outputDir = process.env.TMPDIR
  ? join(process.env.TMPDIR, "playwright-output")
  : join(tmpdir(), `tenet-coverage-${process.pid}`);

export default defineConfig({
  testDir: "./playwright",
  timeout: 30_000,
  outputDir,
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    command: `"${process.execPath}" --experimental-strip-types server/test/support/browser-server.ts`,
    cwd: root,
    env: { PORT: port, DATABASE_URL: process.env.DATABASE_URL ?? resolve(outputDir, "e2e.db") },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
