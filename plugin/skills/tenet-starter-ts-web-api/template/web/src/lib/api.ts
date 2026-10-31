import { CsrfResponse, Problem, SessionResponse } from "../../../shared/schemas.ts";
import type { SignInRequest } from "../../../shared/schemas.ts";

export class ApiError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function request(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response;
  try { response = await fetch(path, { ...init, credentials: "same-origin" }); }
  catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError(0, "We couldn't connect. Check your connection and try again.");
  }
  if (response.status === 204) return undefined;
  let body: unknown;
  try { body = await response.json(); }
  catch { throw new ApiError(response.status, "The server returned an unreadable response. Try again."); }
  if (!response.ok) {
    const problem = Problem.safeParse(body);
    throw new ApiError(response.status, problem.success ? problem.data.detail ?? problem.data.title : "The request failed. Try again.");
  }
  return body;
}

export async function loadSession(signal?: AbortSignal): Promise<SessionResponse | null> {
  try { return SessionResponse.parse(await request("/api/auth/me", { signal })); }
  catch (error) { if (error instanceof ApiError && error.status === 401) return null; throw error; }
}

export async function signIn(body: SignInRequest): Promise<SessionResponse> {
  const { csrfToken } = CsrfResponse.parse(await request("/api/auth/csrf"));
  SessionResponse.parse(await request("/api/auth/sign-in", {
    method: "POST", headers: { "content-type": "application/json", "x-csrf-token": csrfToken }, body: JSON.stringify(body),
  }));
  const current = await loadSession();
  if (!current) throw new ApiError(401, "Your sign-in could not be confirmed. Try again.");
  return current;
}

export async function signOut(csrfToken: string): Promise<void> {
  try { await request("/api/auth/sign-out", { method: "POST", headers: { "x-csrf-token": csrfToken } }); }
  catch (error) { if (!(error instanceof ApiError && error.status === 401)) throw error; }
  if (await loadSession()) throw new ApiError(409, "You are still signed in. Try signing out again.");
}

export const errorMessage = (error: unknown): string => error instanceof ApiError
  ? error.message : "We couldn't verify the server's response. Try again.";
