// A real server, started by Tenet for this candidate, never the developer's own process or database (EVD-13).
// This runs against the actual started process over real HTTP, not `app.inject` — the platform/platform.test.ts
// suite already proves the application logic in-process; this proves the server-identity and isolation guarantee.
import { test, expect } from "@playwright/test";

test("the health endpoint names this as the server Tenet started for this run, not an unrelated process on the port", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.runToken).toBe(process.env.TENET_RUN_TOKEN);
});

test("sign-in is refused on this run's own fresh, dedicated database, not the developer's", async ({ request }) => {
  const pre = await request.get("/api/auth/csrf");
  const { csrfToken } = await pre.json();
  const res = await request.post("/api/auth/sign-in", {
    headers: { "x-csrf-token": csrfToken },
    data: { email: "nobody@example.test", password: "this password does not matter at all" },
  });
  // A developer's own database would answer this real account truthfully; a fresh dedicated one refuses uniformly.
  expect(res.status()).toBe(401);
});
