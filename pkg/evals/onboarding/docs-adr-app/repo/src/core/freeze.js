export function canOverrideFreeze({ requester, approver }) {
  if (!requester || !approver) return false;
  return requester !== approver;
}
