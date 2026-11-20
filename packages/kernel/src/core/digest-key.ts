import { createHmac, timingSafeEqual } from "node:crypto";

export interface DigestKey { id: string; key: Uint8Array }

const MAGIC = new Uint8Array([0x54, 0x4b, 0x31, 0]);
const DOMAIN = "tenet-digest-key-record-v1";
const check = (key: Uint8Array, id: Uint8Array) =>
  createHmac("sha256", key).update(DOMAIN).update(id).digest();

/** Callers supply independently generated entropy; no user or repository content enters this record. */
export function encodeDigestKey(id: Uint8Array, key: Uint8Array): Buffer {
  if (id.byteLength !== 16 || key.byteLength !== 32) throw new RangeError("invalid digest-key entropy lengths");
  return Buffer.concat([MAGIC, id, key, check(key, id)]);
}

export function parseDigestKey(bytes: Uint8Array): DigestKey | null {
  if (bytes.byteLength !== 84) return null;
  const record = new Uint8Array(bytes);
  if (!timingSafeEqual(record.subarray(0, 4), MAGIC)) return null;
  const id = record.subarray(4, 20), key = record.subarray(20, 52);
  if (!timingSafeEqual(check(key, id), record.subarray(52))) return null;
  return { id: Buffer.copyBytesFrom(id).toString("hex"), key: new Uint8Array(key) };
}
