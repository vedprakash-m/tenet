import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyWebhookSignature(rawBody, headerSig, secret) {
  if (!headerSig || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(headerSig, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
