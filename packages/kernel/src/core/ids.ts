// Identifiers, stable hashing and the handle format (TS §6.4, §7.9). Pure: randomness comes from the Random port.
import { createHash } from "node:crypto";
import type { BasisElement } from "./schemas.ts";

export interface Random {
  base32(n: number): string; // lowercase base32 alphabet
}

export const sha256 = (s: string | Uint8Array): string => createHash("sha256").update(s).digest("hex");

/** JSON with sorted keys, so equal values always hash equally. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}

export const hashOf = (v: unknown): string => sha256(stableStringify(v));

export const workLabel = (n: number): string => `W-${String(n).padStart(4, "0")}`;
export const workId = (rand: Random): string => `wk_${rand.base32(10)}`;

/** Handle `W7.3.k7q`: contract label number, session generation, workspace tag (TS §6.4). */
export const formatHandle = (labelN: number, generation: number, tag: string): string => `W${labelN}.${generation}.${tag}`;
export function parseHandle(h: string): { labelN: number; generation: number; tag: string } | null {
  const m = /^W(\d+)\.(\d+)\.([a-z0-9]{4})$/.exec(h);
  return m ? { labelN: Number(m[1]), generation: Number(m[2]), tag: m[3]! } : null;
}

const SEQ = /^[A-Z]+-(\d+)-/;
/** Highest sequence number already used by any element, so allocation never collides on one branch (INT-10). */
export function highestSeq(elements: readonly Pick<BasisElement, "id">[]): number {
  let max = 0;
  for (const e of elements) {
    const m = SEQ.exec(e.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max;
}

/** `REQ-012-q7k`; examples are `EX-012-q7k.1`, numbered per requirement. */
export const elementId = (prefix: string, seq: number, suffix: string): string =>
  `${prefix}-${String(seq).padStart(3, "0")}-${suffix}`;

export const KIND_PREFIX: Record<BasisElement["kind"], string> = {
  requirement: "REQ", example: "EX", invariant: "INV", constraint: "CNS", assumption: "ASM", decision: "DEC", deferred: "DEF",
};
