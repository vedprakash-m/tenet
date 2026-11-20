import { z } from "zod";

export const CommitSigningObservation = z.union([
  z.strictObject({
    source: z.literal("git-executable"), population: z.literal("commit-signing"), state: z.literal("absent"),
    basis: z.enum(["default-disabled", "explicitly-disabled"]), claim: z.literal("listed-execution-input-absent"),
  }),
  z.strictObject({
    source: z.literal("git-executable"), population: z.literal("commit-signing"), state: z.literal("present"),
    basis: z.literal("enabled"), claim: z.literal("signing-execution-selected"),
  }),
  z.strictObject({
    source: z.literal("git-executable"), population: z.literal("commit-signing"), state: z.literal("unknown"),
    basis: z.literal("indeterminate"),
    cause: z.enum(["missing", "malformed", "ambiguous-precedence", "stale", "unreadable", "unsupported-selector"]),
  }),
]);
export type CommitSigningObservation = z.infer<typeof CommitSigningObservation>;

const Count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const Usage = z.strictObject({
  complete: z.boolean(), cycle: z.boolean(), files: Count, largestFileBytes: Count, sourceBytes: Count,
  includeDirectives: Count, maxIncludeEdges: Count, configEntries: Count,
  controlBytes: Count, controlValues: Count, controlDepth: Count,
  stdoutBytes: Count, stderrBytes: Count, elapsedMs: z.number().finite().nonnegative(),
});
type DomainAdmission = { status: "within-limits" } |
  { status: "unknown"; cause: "malformed" | "provider-incomplete" | "limit-exceeded" };

const MIB = 1024 * 1024;
const BOUNDS = [
  ["files", 50_000], ["largestFileBytes", 20 * MIB], ["sourceBytes", 44 * MIB],
  ["includeDirectives", 50_000], ["maxIncludeEdges", 64], ["configEntries", 100_000],
  ["controlBytes", MIB], ["controlValues", 100_000], ["controlDepth", 64],
  ["stdoutBytes", 10 * MIB], ["stderrBytes", 10 * MIB], ["elapsedMs", 120_000],
] as const;

/** Resource admission grants neither executable consent nor an immutable provider lease. */
export function admitCommitDomainUsage(usage: unknown): DomainAdmission {
  const parsed = Usage.safeParse(usage);
  if (!parsed.success) return { status: "unknown", cause: "malformed" };
  const observed = parsed.data;
  if (!observed.complete || observed.cycle) return { status: "unknown", cause: "provider-incomplete" };
  if (BOUNDS.some(([field, limit]) => observed[field] > limit)) return { status: "unknown", cause: "limit-exceeded" };
  if (observed.sourceBytes < observed.largestFileBytes || observed.sourceBytes > observed.files * observed.largestFileBytes ||
      observed.includeDirectives > observed.configEntries || observed.maxIncludeEdges > observed.includeDirectives)
    return { status: "unknown", cause: "malformed" };
  return { status: "within-limits" };
}
