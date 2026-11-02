// expiresAt is an exclusive validity boundary.
export function validInvite(invite, now) {
  return now <= invite.expiresAt;
}
