import { z } from "zod";
import { KernelError } from "./errors.ts";
import { hashOf } from "./ids.ts";
import { allowedByRules, DEFAULT_EXCEPTION, DEFAULT_RULES, matches } from "./exclusions.ts";
import type { Exclusion, Op, ReadEpoch, ReadUse } from "./exclusions.ts";
import type { BasisElement } from "./schemas.ts";

const kinds = z.enum(["no-read", "no-model-send", "no-edit", "no-export", "no-routine-scan"]);
const Scope = z.strictObject({
  workspaceRoot: z.literal("."),
  mode: z.enum(["folded", "exact-authenticated"]),
  policyRevision: z.string().min(1),
  volumeMode: z.strictObject({
    admission: z.enum(["case-insensitive", "case-sensitive-proof", "mode-unavailable-folded"]),
    provenance: z.enum(["authenticated-volume-resolver-v1", "unavailable"]),
  }),
}).refine(scope => {
  const { admission, provenance } = scope.volumeMode;
  return admission === "mode-unavailable-folded"
    ? scope.mode === "folded" && provenance === "unavailable"
    : provenance === "authenticated-volume-resolver-v1"
      && scope.mode === (admission === "case-sensitive-proof" ? "exact-authenticated" : "folded");
});
const Matcher = z.strictObject({
  version: z.literal(1), normalization: z.literal("NFC"), unicodeVersion: z.literal("16.0"),
  caseFold: z.literal("unicode-16-default-case-fold"), globGrammar: z.literal("tenet-exclusion-glob-v1"),
  scopes: z.array(Scope).length(1),
  rules: z.array(z.strictObject({
    pattern: z.string().min(1), kinds: z.array(kinds).min(1),
    source: z.enum(["default-secret", "kernel-only", "configured"]),
  })),
  exceptions: z.tuple([z.strictObject({ pattern: z.literal(".env.example"), target: z.literal("default-secret") })]),
});
export type PacketExclusionMatcher = z.infer<typeof Matcher>;

const refuse = (): never => {
  throw new KernelError("capability-missing", "the packet exclusion matcher cannot be enforced completely", { exit: 2 });
};

/** This consumer isolates one workspace; unsupported mixed-volume scopes refuse instead of sharing a weak matcher. */
export function consumePacketExclusions(value: unknown) {
  const parsed = Matcher.safeParse(value);
  if (!parsed.success) return refuse();
  const descriptor = parsed.data;
  for (const required of DEFAULT_RULES) {
    if (!descriptor.rules.some(rule => rule.source === required.source && rule.pattern === required.pattern
      && required.kinds.every(kind => rule.kinds.includes(kind)))) return refuse();
  }
  try { for (const rule of descriptor.rules) matches(rule.pattern, "packet-validation"); }
  catch { return refuse(); }
  const mode = descriptor.scopes[0]!.mode;
  return (op: Op, path: string, use?: ReadUse, current?: ReadEpoch): boolean =>
    allowedByRules(op, path, descriptor.rules, use, current, mode);
}

export function packetExclusions(effective: readonly Exclusion[] = []) {
  const rules = [...DEFAULT_RULES.map(rule => ({ ...rule, kinds: [...rule.kinds] })),
    ...effective.map(rule => ({ pattern: rule.pattern, kinds: [...rule.kinds], source: "configured" as const }))];
  const matcher: PacketExclusionMatcher = {
    version: 1, normalization: "NFC", unicodeVersion: "16.0", caseFold: "unicode-16-default-case-fold",
    globGrammar: "tenet-exclusion-glob-v1",
    scopes: [{
      workspaceRoot: ".", mode: "folded", policyRevision: hashOf(rules),
      volumeMode: { admission: "mode-unavailable-folded", provenance: "unavailable" },
    }],
    rules, exceptions: [{ ...DEFAULT_EXCEPTION }],
  };
  consumePacketExclusions(matcher);
  return {
    mechanism: "cooperative", matcher,
    guidance: [
      "Validate the complete matcher before every read or search; unsupported fields or scopes require capability-missing.",
      "Apply NFC, pinned Unicode 16.0 default folding in folded scopes, and tenet-exclusion-glob-v1 before matching.",
      "Globs use *, ** and ?; / anchors a pattern at the workspace root; otherwise a suffix or directory prefix can match.",
      "Union source-labeled restrictions. The .env.example leaf exception removes only the default .env secret rule.",
      "no-read and default secret/kernel-only rules forbid every read, including explicit requests.",
      "no-routine-scan forbids routine inventory/search; an explicit read requires current exact-path policy/question/facts.",
      "An explicit kernel read never authorizes model send, edits, export or delegation.",
      "no-model-send forbids model content and per-file identities; no-export forbids export; no-edit forbids modification.",
      "Never inspect .tenet or reserved temporaries. Tool availability is not permission; host enforcement is cooperative.",
    ],
  };
}

export function modelPathFilter(exclusions: readonly Exclusion[] = []) {
  const consumer = consumePacketExclusions(packetExclusions(exclusions).matcher);
  return (path: string) => consumer("model-send", path, { kind: "routine-inventory" });
}

export const modelBasisElements = (elements: readonly BasisElement[], eligible: (path: string) => boolean) =>
  elements.map(element => {
    const { testFile, support, outputs, ...rest } = element;
    return {
      ...rest, ...(testFile && eligible(testFile) ? { testFile } : {}),
      ...(support ? { support: support.filter(eligible) } : {}), ...(outputs ? { outputs: outputs.filter(eligible) } : {}),
    };
  });
