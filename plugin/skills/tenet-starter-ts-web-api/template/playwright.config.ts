// EVD-13 (TS §9.3 Servers): Tenet allocates the free port and the run token (PORT, TENET_RUN_TOKEN) and passes a
// dedicated test database (DATABASE_URL) as this run's own environment; Playwright's webServer starts the real
// server under that same environment and this config only reads it back, never choosing its own.
import { defineConfig } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";

const port = process.env.PORT ?? "3100";
process.env.TENET_RUN_TOKEN ??= randomUUID();
// Traces and screenshots live in the run's own temp directory, never the project tree (TS §9.3 Run directory);
// outside Tenet, TMPDIR is unset and Playwright's own default applies.
const outputDir = process.env.TMPDIR ? join(process.env.TMPDIR, "playwright-output") : "test-results";

export default defineConfig({
  testDir: "server/test/e2e",
  timeout: 30_000,
  ...(outputDir ? { outputDir } : {}),
  use: { baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    // Plain node, not tsx: tsx's own IPC socket path can exceed the platform's socket-path length limit inside
    // Tenet's run directory (a real failure found live, not a style preference). `--experimental-strip-types` is
    // the explicit flag on this recipe's minimum Node (22.12); 22.18+ strips by default, and the flag is accepted
    // either way. tsconfig's `erasableSyntaxOnly` keeps every file within what stripping (no transform) can run.
    command: `${process.execPath} --experimental-strip-types server/test/support/browser-server.ts`,
    env: { PORT: port, DATABASE_URL: process.env.DATABASE_URL ?? resolve(outputDir, "e2e.db") },
    url: `http://127.0.0.1:${port}/api/health`,
    reuseExistingServer: false,
    timeout: 20_000,
  },
});
