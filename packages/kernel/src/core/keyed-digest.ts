import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { stableStringify } from "./ids.ts";

const WorkId = z.string().regex(/^wk_[a-z2-7]{10}$/);
const Generation = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const utf8 = new TextEncoder();
const Kind = z.enum([
  "adopt-intent-v1", "adopt-policy-v1", "shared-merge-v1", "baseline-failures-v1", "undo-inverse-v1",
]);
const GitOid = z.strictObject({ provider: z.literal("git"), value: z.string().regex(/^[0-9a-f]{40}$/) });
const GitPathOid = GitOid.extend({ domain: z.literal("git-path-oid-v1") });
const FailureSlot = z.strictObject({
  obligation: z.string().regex(/^OB-[A-Za-z0-9._-]{1,64}$/),
  slot: z.string().regex(/^(?:COV-[a-z0-9-]{1,48}|EX-[A-Za-z0-9._-]{1,64})$/),
  failureKind: z.enum(["assertion", "timeout", "type-error", "configuration", "lint-error", "compile-or-import"]),
});
const BaselineFacts = z.strictObject({
  work: WorkId, generation: Generation,
  classification: z.enum(["pre-existing", "changed", "unknown"]),
  classificationWhy: z.enum(["sealed-match", "sealed-miss", "sealed-unknown"]),
  failureSlots: z.array(FailureSlot),
});
const UndoFacts = z.strictObject({
  work: WorkId, generation: Generation, targetWork: WorkId,
  currentTip: GitOid, integratedCommit: GitOid.nullable(), ownedCommits: z.array(GitOid),
  inverseTree: GitOid, pathProjections: z.array(GitPathOid), laterCommitIds: z.array(GitOid),
});
type P87Kind = z.infer<typeof Kind>;
export type P87Admission =
  | { status: "known"; kind: "baseline-failures-v1"; version: 1; facts: z.infer<typeof BaselineFacts> }
  | { status: "known"; kind: "undo-inverse-v1"; version: 1; facts: z.infer<typeof UndoFacts> }
  | { status: "unknown"; kind?: P87Kind; cause: "outside-closed-domain" | "malformed" };

function slotOrder(a: z.infer<typeof FailureSlot>, b: z.infer<typeof FailureSlot>): number {
  for (const field of ["obligation", "slot", "failureKind"] as const) {
    if (a[field] !== b[field]) return a[field] < b[field] ? -1 : 1;
  }
  return 0;
}

/** Free-form producers cannot obtain a known projection by supplying an opaque-looking hash. */
export function admitP87(kind: string, facts: unknown): P87Admission {
  const parsedKind = Kind.safeParse(kind);
  if (!parsedKind.success) return { status: "unknown", cause: "outside-closed-domain" };
  if (kind === "baseline-failures-v1") {
    const parsed = BaselineFacts.safeParse(facts);
    if (!parsed.success) return { status: "unknown", kind, cause: "malformed" };
    parsed.data.failureSlots.sort(slotOrder);
    return { status: "known", kind, version: 1, facts: parsed.data };
  }
  if (kind === "undo-inverse-v1") {
    const parsed = UndoFacts.safeParse(facts);
    return parsed.success
      ? { status: "known", kind, version: 1, facts: parsed.data }
      : { status: "unknown", kind, cause: "malformed" };
  }
  return { status: "unknown", kind: parsedKind.data, cause: "outside-closed-domain" };
}

/** Re-admission here prevents a mutated or asserted producer value from entering HMAC. */
export function keyedQuestionHash(key: Uint8Array, workspace: string, admission: unknown): string | null {
  if (!admission || typeof admission !== "object") return null;
  const wrapper = z.strictObject({
    status: z.literal("known"), kind: Kind, version: z.literal(1), facts: z.unknown(),
  }).safeParse(admission);
  if (!wrapper.success) return null;
  const admitted = admitP87(wrapper.data.kind, wrapper.data.facts);
  if (admitted.status !== "known") return null;
  if (key.byteLength !== 32) throw new RangeError("a question binding requires a 32-byte key");
  if (!/^ws_[a-z2-7]{10}$/.test(workspace)) throw new RangeError("a question binding requires a workspace ID");
  return "k1:" + createHmac("sha256", key).update(stableStringify({
    version: 1, domain: "tenet-question-binding", workspace, kind: admitted.kind, facts: admitted.facts,
  })).digest("hex");
}

export function sameQuestionHash(left: string, right: string): boolean {
  const format = /^k1:[0-9a-f]{64}$/;
  return format.test(left) && format.test(right) &&
    timingSafeEqual(utf8.encode(left), utf8.encode(right));
}
