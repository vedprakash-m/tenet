export function sanitizeForLog(payload) {
  const copy = { ...payload };
  if ("cardNumber" in copy) copy.cardNumber = "[REDACTED]";
  if ("cvv" in copy) copy.cvv = "[REDACTED]";
  return copy;
}
