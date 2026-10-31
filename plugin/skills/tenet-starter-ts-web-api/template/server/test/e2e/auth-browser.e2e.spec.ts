import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { browserEmail, browserPassword } from "../support/browser-identities.ts";

async function openSignIn(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
}
async function fillSignIn(page: Page) {
  await page.getByLabel("Email", { exact: true }).fill(browserEmail);
  await page.getByLabel("Password", { exact: true }).fill(browserPassword);
}
async function accessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations).toEqual([]);
}

test("the signed-out browser shows a labeled accessible sign-in form [QLT-01, QLT-03, QLT-14]", async ({ page }) => {
  await openSignIn(page);
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await accessible(page);
});

test("keyboard validation and authentication failure preserve input and focus the error [QLT-14]", async ({ page }) => {
  await openSignIn(page);
  await page.keyboard.press("Tab"); await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.type("not-an-email"); await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-invalid", "true");
  await page.keyboard.press("Tab"); await page.keyboard.press("Enter");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("not-an-email");
  await accessible(page);
  await page.getByLabel("Email", { exact: true }).fill(browserEmail);
  await page.getByLabel("Password", { exact: true }).fill("an incorrect synthetic password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("That email and password do not match.");
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(browserEmail);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("an incorrect synthetic password");
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  await accessible(page);
});

test("sign-in is confirmed by a fresh read, survives reload, and sign-out is confirmed [QLT-01, QLT-12]", async ({ page, context }) => {
  await openSignIn(page);
  let posted = false, confirmed = false;
  page.on("request", request => { if (request.url().endsWith("/api/auth/sign-in")) posted = true; });
  page.on("response", response => { if (posted && response.url().endsWith("/api/auth/me") && response.status() === 200) confirmed = true; });
  await fillSignIn(page); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeFocused();
  expect(confirmed).toBe(true);
  await expect(page.getByText(browserEmail, { exact: true })).toBeVisible();
  const cookie = (await context.cookies()).find(cookie => cookie.name === "sid")!;
  expect(cookie.httpOnly).toBe(true); expect(cookie.sameSite).toBe("Lax");
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await accessible(page);
  await page.reload(); await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.keyboard.press("Tab"); await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeFocused();
  expect((await page.request.get("/api/auth/me")).status()).toBe(401);
  expect((await context.cookies()).some(cookie => cookie.name === "sid")).toBe(false);
});

test("a pending sign-in announces loading and cannot submit twice [QLT-14]", async ({ page }) => {
  await openSignIn(page); await fillSignIn(page);
  let release!: () => void, started!: () => void, calls = 0;
  const held = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  await page.route("**/api/auth/sign-in", async route => { calls++; started(); await held; await route.continue(); });
  try {
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await entered;
    await expect(page.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    await expect(page.getByRole("status")).toHaveText("Checking your account…");
    await page.locator("form").evaluate(form => { if (!(form instanceof HTMLFormElement)) throw new Error("expected the sign-in form"); form.requestSubmit(); form.requestSubmit(); });
    expect(calls).toBe(1); await accessible(page);
  } finally { release(); }
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
});

test("failed session loading is distinct from signed out and can be retried [QLT-14]", async ({ page }) => {
  await page.route("**/api/auth/me", route => route.abort());
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "We couldn't load your session" })).toBeVisible();
  await expect(page.getByRole("alert")).toBeFocused(); await accessible(page);
  await page.unroute("**/api/auth/me");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeFocused();
});

for (const status of [403, 409]) test(`a ${status} response retains the form and offers recovery [QLT-14]`, async ({ page }) => {
  await openSignIn(page); await fillSignIn(page);
  await page.route("**/api/auth/sign-in", route => route.fulfill({ status, json: {
    type: "about:blank", title: "Try again", status, detail: "The request could not be completed. Try again.", correlationId: "browser-fixture",
  } }));
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue(browserEmail);
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(browserPassword);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await accessible(page);
});

test("a revoked session is rechecked on navigation, without a cached success [QLT-12]", async ({ page }) => {
  await openSignIn(page); await fillSignIn(page); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  const session = await (await page.request.get("/api/auth/me")).json() as { csrfToken: string };
  expect((await page.request.post("/api/auth/sign-out", { headers: { "x-csrf-token": session.csrfToken } })).status()).toBe(204);
  await page.reload(); await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
});

test("an unconfirmed sign-out retains the account and can be retried [QLT-14]", async ({ page }) => {
  await openSignIn(page); await fillSignIn(page); await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.route("**/api/auth/sign-out", route => route.abort());
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("alert")).toBeFocused();
  await expect(page.getByRole("heading", { name: "You're signed in" })).toBeVisible();
  await page.unroute("**/api/auth/sign-out");
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible();
});
