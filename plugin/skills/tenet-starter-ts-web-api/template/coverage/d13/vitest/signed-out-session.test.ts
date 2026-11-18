import { expect, it } from "vitest";
import { admissionApp } from "../../../server/test/support/admission.ts";

it("rejects a preserved session credential after confirmed sign-out [COV-signed-out-session]", async () => {
  const c = await admissionApp();
  try {
    const cookie = c.first.cookie;
    const signedOut = await c.app.inject({
      method: "POST",
      url: "/api/auth/sign-out",
      cookies: { sid: cookie },
      headers: { "x-csrf-token": c.first.session.csrf },
    });
    expect(signedOut.statusCode).toBe(204);
    const stale = await c.app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { sid: cookie },
    });
    expect(stale.statusCode).toBe(401);
    expect(c.db.prepare("SELECT id FROM sessions WHERE id = ?").get(c.first.session.id)).toBeUndefined();
  } finally {
    await c.close();
  }
});
