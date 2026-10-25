// A session is valid before its expiry instant; at that instant it has expired.
export function isExpired(session, now) {
  return now >= session.expiresAt;
}
