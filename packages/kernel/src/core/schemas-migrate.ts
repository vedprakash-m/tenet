import { z } from "zod";
import { Obligation, ReceiptV2 } from "./schemas.ts";
import { ClosedFailureKind } from "./privacy-types.ts";
import { isReasonCode } from "./reasons.ts";
import type { ReasonCode } from "./reasons.ts";
import { KernelError } from "./errors.ts";
import { CanonicalDecimal, DirectoryIdentity, sameDirectoryIdentity } from "./marker-identity.ts";

const Nat = z.number().int().nonnegative();
const RegisteredReason = z.custom<ReasonCode>(value => typeof value === "string" && isReasonCode(value));
const History = z.strictObject({ status: ReceiptV2.shape.status, at: z.iso.datetime().optional() });
export const LegacyReceiptV3 = z.strictObject({
  kind: Obligation.shape.kind.optional(),
  stage: ReceiptV2.shape.stage, source: ReceiptV2.shape.source, scope: ReceiptV2.shape.scope,
  status: ReceiptV2.shape.status, durationMs: z.number().nonnegative(), exit: Nat.optional(),
  counts: z.strictObject({
    discovered: Nat, executed: Nat, passed: Nat, failed: Nat, skipped: Nat, focused: Nat,
  }).optional(),
  checkInputId: z.literal("legacy-unavailable"), candidate: z.literal("legacy-unavailable"),
  failures: z.array(z.never()).max(0), failureKinds: z.array(ClosedFailureKind).max(ClosedFailureKind.options.length),
  qualifiers: ReceiptV2.shape.qualifiers.refine(values => values.includes("history-unavailable")),
  reasons: z.array(RegisteredReason), history: z.array(History).max(3).optional(),
  privacy: z.strictObject({ identity: z.literal("legacy-unproven"), messages: z.literal("none") }),
});
export type LegacyReceiptV3 = z.infer<typeof LegacyReceiptV3>;

const MigrationFileIdentity = z.strictObject({
  dev: CanonicalDecimal, ino: CanonicalDecimal, type: z.literal("file"), links: z.literal(1),
});
export const SnapshotFileIdentityV1 = MigrationFileIdentity;
export const P91CompletionWitnessV1 = z.strictObject({
  witnessVersion: z.literal(1), protocol: z.literal("p91-completion-v1"), sourceSchema: z.literal(2),
  storeRoot: DirectoryIdentity,
  marker: z.strictObject({
    workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/), tag: z.string().regex(/^[a-z2-7]{4}$/),
    nonce: z.string().regex(/^[a-z2-7]{12}$/),
  }),
  state: z.strictObject({
    primary: z.strictObject({ identity: MigrationFileIdentity, revision: Nat.safe() }),
    previous: z.strictObject({ identity: MigrationFileIdentity, revision: Nat.safe() }),
    generationSeq: Nat.safe(), workSeq: Nat.safe(),
  }),
  fences: z.strictObject({
    history: z.literal("complete"), reconstructionPending: z.literal(false),
    p91Transition: z.literal("absent"), p91Recovery: z.literal("absent"),
  }),
  bridgeDigest: z.string().regex(/^[a-f0-9]{64}$/),
});
export type P91CompletionWitnessV1 = z.infer<typeof P91CompletionWitnessV1>;
export const PrivateSnapshotRefV3 = z.strictObject({
  provider: z.literal("store-private-snapshot-v1"),
  // The existing private-record transport ceiling also bounds an opaque provider token; it is never parsed as a path.
  handle: z.string().min(1).max(50 * 1024 * 1024),
  copySetVersion: z.literal(1), capture: z.enum(["reserved", "complete"]),
});
export type PrivateSnapshotRefV3 = z.infer<typeof PrivateSnapshotRefV3>;
export const PrivateSnapshotRequestV1 = z.strictObject({
  operationId: z.string().regex(/^[a-f0-9]{32}$/), storeRoot: DirectoryIdentity,
  p91Completion: P91CompletionWitnessV1, copySetVersion: z.literal(1),
}).refine(value => sameDirectoryIdentity(value.storeRoot, value.p91Completion.storeRoot));
export type PrivateSnapshotRequestV1 = z.infer<typeof PrivateSnapshotRequestV1>;
export const ProviderSnapshotAttestationV3 = z.strictObject({
  format: z.literal(3), operationId: z.string().regex(/^[a-f0-9]{32}$/), sourceSchema: z.literal(2),
  p91Completion: P91CompletionWitnessV1, snapshot: PrivateSnapshotRefV3,
});
export type ProviderSnapshotAttestationV3 = z.infer<typeof ProviderSnapshotAttestationV3>;
const SourceLeaf = z.enum(["state.prev", "state", "marker", "summaries.json", "journal-index.json", "log"]);
export const LegacyPrivateSourceTupleV3 = z.discriminatedUnion("presence", [
  z.strictObject({
    presence: z.literal("absent"), path: SourceLeaf, identity: z.null(), schema: z.null(), privateCopy: z.literal("absent"),
  }),
  z.strictObject({
    presence: z.literal("present"), path: SourceLeaf, identity: MigrationFileIdentity,
    schema: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]), privateCopy: z.literal("required"),
  }),
]);
const MigrationCleanAfter = z.strictObject({
  presence: z.literal("present"), identity: MigrationFileIdentity, bytes: CanonicalDecimal,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  schema: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
});
const migrationTarget = <P extends string>(path: P) => z.strictObject({ path: z.literal(path), after: MigrationCleanAfter });
export const MigrationAfterSnapshotProjectionV1 = z.strictObject({
  operation: z.enum(["privacy-schema-3-migration", "privacy-schema-3-fresh", "digest-key-repair-v3"]),
  populationVersion: z.literal(2),
  key: z.strictObject({
    path: z.literal("digest.key"),
    after: z.strictObject({
      presence: z.literal("present"), identity: MigrationFileIdentity, bytes: z.literal(84),
      magic: z.literal("TK1\0"), digestKeyId: z.string().regex(/^[a-f0-9]{32}$/),
    }),
  }),
  targets: z.tuple([
    migrationTarget("state.prev"), migrationTarget("state"), migrationTarget("marker"),
    migrationTarget("summaries.json"), migrationTarget("journal-index.json"),
  ]),
}).refine(record => record.targets.slice(0, 3).every(target => target.after.schema === 3));

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const OperationId = z.string().regex(/^[a-f0-9]{32}$/);
const EvidencePath = z.string().regex(/^migration-evidence-v2\/[a-f0-9]{32}\/(?:source|target|evidence)\.json$/);
export const MigrationFileTupleV3 = MigrationCleanAfter.extend({
  path: z.union([SourceLeaf, EvidencePath, z.literal("migration-recovery-v3.json")]),
});
export type MigrationFileTupleV3 = z.infer<typeof MigrationFileTupleV3>;
const forwardTarget = <P extends string>(path: P) => z.strictObject({
  path: z.literal(path), before: LegacyPrivateSourceTupleV3,
  after: MigrationFileTupleV3, tempPath: z.string().regex(/^[a-z.-]+\.tmp-[a-f0-9]{32}$/),
}).refine(value => value.before.path === path && value.after.path === path);

/** Only the forward privacy arm of the normative MigrationTransitionV3 wire is admitted here. */
export const PrivacyForwardTransitionV3 = z.strictObject({
  format: z.literal(3), protocol: z.literal("migration-transition-v3"), protocolVersion: z.literal(2),
  operationId: OperationId, kind: z.literal("migration-forward"),
  phase: z.enum(["prepared", "snapshot", "key", "previous", "state", "marker", "migration-evidence-installed", "remove"]),
  root: DirectoryIdentity,
  marker: z.strictObject({
    schema: z.literal(2), workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/), tag: z.string().regex(/^[a-z2-7]{4}$/),
    nonce: z.string().regex(/^[a-z2-7]{12}$/), dev: z.number().finite(), ino: z.number().finite(),
  }),
  privacy: z.strictObject({
    operation: z.literal("privacy-schema-3-migration"), beforeSchema: z.literal(2), afterSchema: z.literal(3),
    populationVersion: z.literal(2),
    populationMembers: z.tuple([
      z.literal("digest.key"), z.literal("state.prev"), z.literal("state"), z.literal("marker"),
      z.literal("summaries.json"), z.literal("journal-index.json"),
    ]),
    populationHash: SHA, afterSnapshotHash: SHA,
    targets: z.tuple([
      forwardTarget("state.prev"), forwardTarget("state"), forwardTarget("marker"),
      forwardTarget("summaries.json"), forwardTarget("journal-index.json"),
    ]),
    journal: z.strictObject({
      path: z.literal("log"), before: LegacyPrivateSourceTupleV3, final: LegacyPrivateSourceTupleV3,
    }),
    digestKeyId: z.string().regex(/^[a-f0-9]{32}$/),
    keyRecord: z.strictObject({
      path: z.literal("digest.key"),
      before: z.strictObject({ presence: z.literal("absent"), identity: z.null(), bytes: z.null() }),
      after: MigrationAfterSnapshotProjectionV1.shape.key.shape.after,
      tempPath: z.string().regex(/^digest\.key\.tmp-[a-f0-9]{32}$/),
    }),
  }),
  snapshot: z.strictObject({
    sourceAttestationPath: EvidencePath, sourceAttestationSha256: SHA,
    sourceAttestationProof: MigrationFileTupleV3, privateSource: PrivateSnapshotRefV3,
  }),
  evidence: z.strictObject({
    target: z.strictObject({ path: EvidencePath, sha256: SHA, proof: MigrationFileTupleV3.nullable() }),
    evidence: z.strictObject({ path: EvidencePath, sha256: SHA, proof: MigrationFileTupleV3.nullable() }),
    recovery: z.strictObject({
      path: z.literal("migration-recovery-v3.json"),
      tempPath: z.string().regex(/^migration-recovery-v3\.json\.tmp-[a-f0-9]{32}$/), sha256: SHA,
      proof: MigrationFileTupleV3.nullable(),
    }),
    previousBridgeDigest: SHA,
  }),
});
export type PrivacyForwardTransitionV3 = z.infer<typeof PrivacyForwardTransitionV3>;

export function projectLegacyReceipt(value: unknown): LegacyReceiptV3 {
  const parsed = ReceiptV2.strict().safeParse(value);
  if (!parsed.success) throw new KernelError("unsupported-record", "The legacy receipt is malformed.");
  const source = parsed.data, kind = Obligation.shape.kind.safeParse(source.kind);
  const kinds = [...(source.failureKinds ?? []), ...(source.failures ?? []).map(failure => failure.kind)]
    .flatMap(value => { const kind = ClosedFailureKind.safeParse(value); return kind.success ? [kind.data] : []; });
  const projected = LegacyReceiptV3.safeParse({
    ...(kind.success ? { kind: kind.data } : {}),
    stage: source.stage, source: source.source, scope: source.scope, status: source.status,
    durationMs: source.durationMs, ...(source.exit === undefined ? {} : { exit: source.exit }),
    ...(source.counts === undefined ? {} : { counts: source.counts }),
    checkInputId: "legacy-unavailable", candidate: "legacy-unavailable",
    failures: [], failureKinds: [...new Set(kinds)],
    qualifiers: [...new Set([...source.qualifiers, "history-unavailable"])], reasons: source.reasons.filter(isReasonCode),
    ...(source.history === undefined ? {} : { history: source.history.map(entry => ({
      status: entry.status, ...(z.iso.datetime().safeParse(entry.at).success ? { at: entry.at } : {}),
    })) }),
    privacy: { identity: "legacy-unproven", messages: "none" },
  });
  if (!projected.success) throw new KernelError("unsupported-record", "The legacy receipt summary is outside the closed domain.");
  return projected.data;
}
