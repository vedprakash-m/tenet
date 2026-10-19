// Real Clock and Random for production wiring; tests substitute deterministic ones.
import { randomBytes } from "node:crypto";
import type { Clock, Random } from "../ports/types.ts";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567";

export const systemClock: Clock = { now: () => new Date().toISOString(), ms: () => Date.now() };

export const systemRandom: Random = {
  base32(n) {
    const b = randomBytes(n);
    return Array.from(b, (x) => ALPHABET[x & 31]).join("");
  },
};
