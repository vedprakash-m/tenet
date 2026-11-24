import { createHash, randomBytes } from "node:crypto";
import { clockNow, type Clock } from "./clock.js";

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const encoder = new TextEncoder();
let previousTimestamp = -1;
let previousRandomness = 0n;

export function sha256(value: string | NodeJS.ArrayBufferView): string {
  return createHash("sha256")
    .update(typeof value === "string" ? encoder.encode(value.replaceAll("\r\n", "\n")) : value)
    .digest("hex");
}

export function sha256Text(value: NodeJS.ArrayBufferView): string {
  return sha256(Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString("utf8")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n"));
}

function encodeBase32(value: bigint, length: number): string {
  let output = "";
  let remaining = value;
  for (let index = 0; index < length; index += 1) {
    output = crockford[Number(remaining & 31n)] + output;
    remaining >>= 5n;
  }
  return output;
}

function encodeBytesBase32(bytes: Uint8Array): string {
  let bits = 0;
  let buffer = 0;
  let output = "";
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += crockford[(buffer >>> bits) & 31] ?? "";
      buffer &= 2 ** bits - 1;
    }
  }
  if (bits > 0) output += crockford[(buffer << (5 - bits)) & 31] ?? "";
  return output;
}

function canonicalString(value: string): string {
  for (const character of value) {
    // The string iterator keeps each valid surrogate pair together.
    const code = character.charCodeAt(0);
    if (character.length === 1 && code >= 0xd800 && code <= 0xdfff) {
      throw Object.assign(new TypeError("RFC 8785 does not allow unpaired surrogates"), {
        code: "TN-SCHEMA",
      });
    }
  }
  return JSON.stringify(value);
}
function canonicalize(value: unknown, active: WeakSet<object>): string {
  if (value === null || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("RFC 8785 does not allow non-finite numbers");
    return JSON.stringify(value);
  }
  if (typeof value === "string") return canonicalString(value);
  if (typeof value !== "object") throw new TypeError(`RFC 8785 does not allow ${String(value)}`);

  if (active.has(value)) throw new TypeError("RFC 8785 does not allow cycles");
  active.add(value);
  try {
    if (Array.isArray(value)) {
      const items: string[] = [];
      for (let index = 0; index < value.length; index += 1) items.push(canonicalize(value[index], active));
      return `[${items.join(",")}]`;
    }
    if (value instanceof Date || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) {
      throw new TypeError("RFC 8785 only allows JSON values");
    }
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${canonicalString(key)}:${canonicalize(record[key], active)}`).join(",")}}`;
  } finally {
    active.delete(value);
  }
}

export function jcs(value: unknown): string {
  return canonicalize(value, new WeakSet());
}

export function ulid(now: Clock | Date | number | string): string {
  const time = clockNow(now).getTime();
  if (!Number.isSafeInteger(time) || time < 0 || time >= 2 ** 48) {
    throw new RangeError("ULID time must be an unsigned 48-bit millisecond value");
  }

  if (time === previousTimestamp) {
    previousRandomness += 1n;
    if (previousRandomness >= 1n << 80n) throw new RangeError("ULID randomness overflow within one millisecond");
  } else {
    const random = randomBytes(10);
    previousTimestamp = time;
    previousRandomness = BigInt(`0x${random.toString("hex")}`);
  }

  return encodeBase32(BigInt(time), 10) + encodeBase32(previousRandomness, 16);
}

export function alias(
  value: string,
  occupied?: Iterable<string> | ((candidate: string) => boolean),
): string {
  const digest = createHash("sha256").update(value, "utf8").digest();
  const encoded = encodeBytesBase32(digest);
  let length = 6;
  let candidate = encoded.slice(0, length);
  const used = typeof occupied === "function" ? undefined : new Set(occupied);
  const exists = typeof occupied === "function" ? occupied : (item: string) => used?.has(item) ?? false;
  while (exists(candidate)) {
    length += 1;
    if (length > encoded.length) throw new RangeError("no unique alias is available");
    candidate = encoded.slice(0, length);
  }
  return candidate;
}
