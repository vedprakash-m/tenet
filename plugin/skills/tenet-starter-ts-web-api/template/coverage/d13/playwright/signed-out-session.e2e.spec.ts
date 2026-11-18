import { test, expect } from "@playwright/test";
import { browserEmail, browserPassword } from "../../../server/test/support/browser-identities.ts";

test("rejects a preserved session credential after confirmed sign-out [COV-signed-out-session]", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email", { exact: true }).fill(browserEmail);
  await page.getByLabel("Password", { exact: true }).fill(browserPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're signed in", exact: true })).toBeVisible();

  const cookie = (await page.context().cookies()).find((value) => value.name === "sid");
  expect(cookie).toBeDefined();
  const session = await (await page.request.get("/api/auth/me")).json() as { csrfToken: string };
  const signedOut = await page.request.post("/api/auth/sign-out", {
    headers: { "x-csrf-token": session.csrfToken },
  });
  expect(signedOut.status()).toBe(204);
  expect((await page.context().cookies()).some((value) => value.name === "sid")).toBe(false);

  const stale = await page.request.get("/api/auth/me", {
    headers: { cookie: `sid=${cookie!.value}` },
  });
  expect(stale.status()).toBe(401);
});
