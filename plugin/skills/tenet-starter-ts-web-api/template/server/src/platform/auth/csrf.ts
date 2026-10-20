// CSRF: every state-changing request carries a token. With a session it must equal the token stored on the session row;
// without one (sign-in) it must equal the pre-session cookie, set by GET /api/auth/csrf (double submit).
import { safeEqual } from "../safe-equal.ts";

export const PRE_COOKIE = "pre_csrf";
export const HEADER = "x-csrf-token";
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export const isStateChanging = (method: string): boolean => !SAFE.has(method.toUpperCase());

export function tokensMatch(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && safeEqual(a, b);
}
