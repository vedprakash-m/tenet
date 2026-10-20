// Constant-time comparison of two secrets. Lengths are compared in bytes: two strings of the same number of characters can differ
// in byte length, and timingSafeEqual throws on that instead of answering.
import { timingSafeEqual } from "node:crypto";

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
