import { z } from "zod";
import { SemVer } from "./privacy-identity.ts";
import { sha256, stableStringify } from "./ids.ts";

const GitOID = z.templateLiteral(["git-oid:", z.string().regex(/^[a-f0-9]{40}$/)]);
const provider = {
  providerExecutable: z.strictObject({ kind: z.literal("registered-git-provider-v1"), registration: z.uuid() }),
  providerVersion: z.string().refine(value => value.startsWith("git:") && SemVer.safeParse(value.slice(4)).success),
  pathProjection: z.strictObject({ kind: z.literal("git-path-oid-v1"), oid: GitOID }),
  version: z.literal(1), oid: GitOID, observed: z.literal("fresh-single-inventory"),
};
export const GitIndexIdentity = z.union([
  z.strictObject({
    ...provider, status: z.literal("known"), domain: z.literal("git-index-entry-v1"),
    provider: z.literal("git-stage-zero-index"), providerProfile: z.literal("git-index-entry-v1"),
    mode: z.string().regex(/^[0-7]{4,6}$/), tracked: z.literal(true),
    providerBinding: z.strictObject({
      kind: z.literal("git-index-entry-v1"), operation: z.literal("ls-files-stage-zero"), helpers: z.literal("not-invoked"),
    }),
    claim: z.literal("index-entry-continuity"),
  }),
  z.strictObject({
    ...provider, status: z.literal("known"), domain: z.literal("git-provider-worktree-v1"),
    provider: z.literal("git-owned-worktree"), providerProfile: z.literal("git-worktree-no-filters-v1"),
    mode: z.enum(["100644", "100755"]), tracked: z.boolean(),
    providerBinding: z.strictObject({
      kind: z.literal("git-hash-object-no-filters-v1"), operation: z.literal("hash-object-stdin-pinned-handle"),
      filters: z.literal("no-filters"), helpers: z.literal("not-invoked"), input: z.literal("no-follow-provider-file-handle"),
      pathIdentity: z.literal("pinned-same-generation"),
    }),
    claim: z.literal("provider-object-continuity"),
  }),
  z.strictObject({
    status: z.literal("unknown"), producer: z.enum(["git-index", "git-worktree"]),
    cause: z.enum(["missing", "malformed", "stale", "moved", "provider-incomplete", "limit-exceeded"]),
  }),
]);
export type GitIndexIdentity = z.infer<typeof GitIndexIdentity>;
type InventoryAdmission =
  | {
    status: "admitted"; digest: {
      version: 1; complete: true; value: string;
      claims: { indexContinuity: number; providerObjectContinuity: number }; unknown: 0;
    };
  }
  | { status: "unknown"; producer: "git"; cause: "malformed" | "provider-incomplete" | "limit-exceeded" };

const Inventory = z.strictObject({ complete: z.boolean(), observations: z.array(GitIndexIdentity).max(50_000) });

/** Metadata projection only; source admission and fresh registration belong to the provider. */
export function admitGitInventory(observation: unknown): InventoryAdmission {
  const parsed = Inventory.safeParse(observation);
  if (!parsed.success) {
    const overflow = parsed.error.issues.some(issue => issue.code === "too_big" && issue.origin === "array" &&
      issue.path.length === 1 && issue.path[0] === "observations");
    return { status: "unknown", producer: "git", cause: overflow ? "limit-exceeded" : "malformed" };
  }
  if (!parsed.data.complete || parsed.data.observations.some(row => row.status === "unknown"))
    return { status: "unknown", producer: "git", cause: "provider-incomplete" };
  const rows = parsed.data.observations.filter(row => row.status === "known");
  if (new Set(rows.map(row => `${row.providerExecutable.registration}:${row.providerVersion}`)).size > 1)
    return { status: "unknown", producer: "git", cause: "provider-incomplete" };
  const worktree = rows.filter(row => row.claim === "provider-object-continuity").length;
  if (worktree > 20_000) return { status: "unknown", producer: "git", cause: "limit-exceeded" };
  const paths = new Set(rows.map(row => row.pathProjection.oid));
  if (paths.size !== rows.length) return { status: "unknown", producer: "git", cause: "provider-incomplete" };
  rows.sort((a, b) => a.pathProjection.oid < b.pathProjection.oid ? -1 : a.pathProjection.oid > b.pathProjection.oid ? 1 : 0);
  const projection = rows.map(row => ({
    pathProjection: row.pathProjection, mode: row.mode, oid: row.oid, tracked: row.tracked,
    providerExecutable: { registration: row.providerExecutable.registration },
    providerVersion: row.providerVersion, providerProfile: row.providerProfile,
    providerBinding: row.providerBinding, claim: row.claim,
  }));
  return {
    status: "admitted", digest: {
      version: 1, complete: true, value: sha256(stableStringify(projection)),
      claims: { indexContinuity: rows.length - worktree, providerObjectContinuity: worktree }, unknown: 0,
    },
  };
}
