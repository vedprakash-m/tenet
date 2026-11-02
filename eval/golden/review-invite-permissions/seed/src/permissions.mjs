// Only owner/admin actors may invite.
export function mayInvite(actor) {
  if (!actor) return false;
  return actor.role !== "guest";
}
