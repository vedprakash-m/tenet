import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, errorMessage, loadSession, signIn, signOut } from "./api.ts";

const session = { user: { id: "u1", email: "fixture@example.test", role: "member" }, csrfToken: "synthetic-csrf" };
const reply = (body: unknown, status = 200) => Response.json(body, { status });
afterEach(() => vi.restoreAllMocks());

describe("browser API boundaries", () => {
  it("confirms sign-in with an independent session read and includes same-origin cookies", async () => {
    const fresh = { ...session, user: { ...session.user, id: "fresh-user" } };
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply({ csrfToken: "pre-session" }))
      .mockResolvedValueOnce(reply(session)).mockResolvedValueOnce(reply(fresh));
    expect(await signIn({ email: session.user.email, password: "fixture" })).toEqual(fresh);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/auth/csrf", "/api/auth/sign-in", "/api/auth/me"]);
    for (const [, init] of fetch.mock.calls) expect(init?.credentials).toBe("same-origin");
    expect(fetch.mock.calls[1]![1]?.headers).toMatchObject({ "x-csrf-token": "pre-session" });
  });
  it("treats only a 401 as signed out; a server outage is an error", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply({}, 401));
    expect(await loadSession()).toBeNull();
    fetch.mockResolvedValueOnce(reply({ type: "about:blank", title: "Unavailable", status: 503, correlationId: "fixture" }, 503));
    await expect(loadSession()).rejects.toMatchObject({ status: 503, message: "Unavailable" });
  });
  it("does not use malformed success or undecodable data as session proof", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply({ unexpected: "not a session" }));
    await expect(loadSession()).rejects.toThrow();
    fetch.mockResolvedValueOnce(new Response("not JSON"));
    await expect(loadSession()).rejects.toMatchObject({ message: "The server returned an unreadable response. Try again." });
    expect(errorMessage(new Error("private implementation detail"))).not.toContain("private implementation detail");
  });
  it("requires confirmed absence after sign-out, including an already-expired session", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(reply({}, 401)).mockResolvedValueOnce(reply({}, 401));
    await expect(signOut("synthetic-csrf")).resolves.toBeUndefined();
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/auth/sign-out", "/api/auth/me"]);
  });
  it("does not claim sign-out while the server still reports a session", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response(null, { status: 204 })).mockResolvedValueOnce(reply(session));
    await expect(signOut("synthetic-csrf")).rejects.toMatchObject({ status: 409 });
  });
  it("retains aborts and reports connection errors without raw exception text", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("private network detail"));
    await expect(loadSession()).rejects.toEqual(new ApiError(0, "We couldn't connect. Check your connection and try again."));
    const controller = new AbortController(); controller.abort();
    const aborted = new DOMException("Aborted", "AbortError"); fetch.mockRejectedValueOnce(aborted);
    await expect(loadSession(controller.signal)).rejects.toBe(aborted);
  });
});
