// Passwords: asynchronous scrypt (N=2^15, r=8, p=1) with a constant-time compare. Hashing is bounded by a semaphore
// (4 at once, 16 waiting, then 429) so a burst of sign-ins cannot take the event loop or memory down.
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { AppError } from "../errors.ts";

const N = 2 ** 15, R = 8, P = 1, KEYLEN = 32, MAXMEM = 64 * 1024 * 1024;
const MAX_ACTIVE = 4, MAX_QUEUED = 16;

let active = 0;
const queue: Array<() => void> = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_ACTIVE) {
    if (queue.length >= MAX_QUEUED) throw new AppError(429, "too-many-requests", "Too many sign-in attempts at once; try again shortly.");
    await new Promise<void>((resolve) => queue.push(resolve));
  } else active++;
  try {
    return await fn();
  } finally {
    const next = queue.shift();
    if (next) next(); // the slot passes straight to the next waiter
    else active--;
  }
}

const derive = (password: string, salt: Buffer, n = N): Promise<Buffer> =>
  new Promise((resolve, reject) => scrypt(password, salt, KEYLEN, { N: n, r: R, p: P, maxmem: MAXMEM }, (e, key) => (e ? reject(e) : resolve(key))));

export const hashPassword = (password: string): Promise<string> =>
  slot(async () => {
    const salt = randomBytes(16);
    return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${(await derive(password, salt)).toString("base64")}`;
  });

export const verifyPassword = (password: string, stored: string): Promise<boolean> =>
  slot(async () => {
    const [scheme, n, , , salt, hash] = stored.split("$");
    if (scheme !== "scrypt" || !salt || !hash) return false;
    const expected = Buffer.from(hash, "base64");
    const actual = await derive(password, Buffer.from(salt, "base64"), Number(n));
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });

/** A real hash of a random password, verified against when the account does not exist, so timing does not reveal accounts. */
let decoy: Promise<string> | undefined;
export const decoyHash = (): Promise<string> => (decoy ??= hashPassword(randomBytes(18).toString("base64")));
