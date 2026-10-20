// Judging a shared file against what was adopted from it (TS §7.8, §8.5, PH0-4). Pure: text and a trust entry in, a verdict out.
import { sha256 } from "./ids.ts";
import { blockHash, parseBlocks } from "./intent-md.ts";
import { effectivePolicy, parsePolicy } from "./policy.ts";
import type { Change, Policy } from "./policy.ts";

interface Entry { hash: string; restrictions: Record<string, unknown> }

export type PolicyJudgement =
  | { kind: "same" }
  | { kind: "unreadable"; message: string }
  | { kind: "changed"; restrictions: Policy; fileHash: string; applied: Change[]; pending: Change[] };

/** A tightening is in force at once; whatever loosens or changes keeps its previous value until the user accepts. */
export function judgePolicyFile(entry: Entry, text: string): PolicyJudgement {
  const fileHash = sha256(text);
  if (fileHash === entry.hash) return { kind: "same" };
  let json: unknown = null;
  try { json = JSON.parse(text); } catch { /* an unparseable file is reported by the strict parse */ }
  const parsed = parsePolicy(json);
  if (!parsed.ok) return { kind: "unreadable", message: parsed.message };
  const eff = effectivePolicy(entry.restrictions as Policy, parsed.policy, false);
  return { kind: "changed", restrictions: eff.policy, fileHash, applied: eff.applied, pending: eff.pending };
}

export type IntentJudgement =
  | { kind: "same" }
  | { kind: "invalid"; where: string }
  | { kind: "edited"; blocks: string[] }
  | { kind: "own-text"; fileHash: string };

/** A block whose body differs from what Tenet last wrote was edited by a person; text outside the blocks is theirs to change. */
export function judgeIntentFile(entry: Entry, text: string): IntentJudgement {
  const fileHash = sha256(text);
  if (fileHash === entry.hash) return { kind: "same" };
  const parsed = parseBlocks(text);
  if (!parsed.ok) return { kind: "invalid", where: `line ${parsed.line}${parsed.id ? ` around ${parsed.id}` : ""} (${parsed.problem})` };
  const written = (entry.restrictions.blocks ?? {}) as Record<string, string>;
  const blocks = parsed.blocks.filter((b) => written[b.id] !== undefined && blockHash(text.slice(b.bodyStart, b.bodyEnd)) !== written[b.id]).map((b) => b.id);
  return blocks.length ? { kind: "edited", blocks } : { kind: "own-text", fileHash };
}
