// A separate owned source server prevents intentional exhaustion contaminating other journeys.
import { fork } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { test, expect } from "@playwright/test";
import { browserEmail, browserPassword } from "../support/browser-identities.ts";

test("anonymous exhaustion cannot block a verified reload and confirmed sign-out [QLT-01, QLT-12, QLT-14]", async ({ page }) => {
  const directory = mkdtempSync(join(tmpdir(), "browser-admission-")), runToken = randomUUID();
  const child = fork("server/test/support/browser-server.ts", [], { execArgv: ["--experimental-strip-types"], env: { ...process.env, PORT: "0", DATABASE_URL: join(directory, "app.db"), TENET_RUN_TOKEN: runToken }, stdio: ["ignore", "ignore", "pipe", "ipc"] });
  let diagnostics = ""; child.stderr?.on("data", data => { diagnostics = (diagnostics + String(data)).slice(-2000); });
  const closed = new Promise<void>(resolve => { child.once("exit", () => resolve()); child.once("error", () => resolve()); });
  try {
    const port = await new Promise<number>((resolve, reject) => {
      const done = () => { clearTimeout(timer); child.off("message", ready); child.off("exit", failed); child.off("error", failed); };
      const failed = () => { done(); reject(new Error(`owned browser server failed: ${diagnostics}`)); };
      const ready = (message: unknown) => {
        const value = message as { kind?: string; port?: number };
        if (value.kind === "browser-ready" && typeof value.port === "number") { done(); resolve(value.port); }
      };
      const timer = setTimeout(failed, 15_000);
      child.on("message", ready); child.once("exit", failed); child.once("error", failed);
    });
    const base = `http://127.0.0.1:${port}`;
    expect((await (await page.request.get(base + "/api/health")).json()).runToken).toBe(runToken);
    await page.goto(base);
    await page.getByLabel("Email", { exact: true }).fill(browserEmail);
    await page.getByLabel("Password", { exact: true }).fill(browserPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { name: "You're signed in", exact: true })).toBeVisible();
    let exhausted = false;
    for (let n = 0; n <= 120; n++) {
      const response = await page.request.get(base + "/api/health");
      if (response.status() === 429) { expect(response.headers()["x-ratelimit-limit"]).toBe("120"); exhausted = true; break; }
      expect(response.status()).toBe(200);
    }
    expect(exhausted).toBe(true);
    await page.reload();
    await expect(page.getByRole("heading", { name: "You're signed in", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeFocused();
    expect((await page.context().cookies()).some(cookie => cookie.name === "sid")).toBe(false);
    const confirmed = await page.request.get(base + "/api/auth/me");
    expect(confirmed.status()).toBe(401); expect(confirmed.headers()["x-ratelimit-limit"]).toBe("6000");
  } finally {
    await page.close();
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
    await Promise.race([closed, sleep(3000, undefined, { ref: false })]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    await closed; rmSync(directory, { recursive: true, force: true });
  }
});
