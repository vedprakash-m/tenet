import { z } from "zod";
import { DirectoryIdentity, MarkerV3 } from "./marker-identity.ts";

const SHA = z.string().regex(/^[a-f0-9]{64}$/);
const DECIMAL = z.string().regex(/^(?:0|[1-9][0-9]{0,39})$/);
const OPERATION = z.string().regex(/^[0-9a-f]{32}$/);
const LOCATOR = (operation: RegExp) => z.string().regex(operation);

export const LegacyMarker = z.strictObject({
  schema: z.literal(2),
  workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/),
  tag: z.string().regex(/^[a-z0-9]{4}$/),
  nonce: z.string(),
  dev: z.number().finite(),
  ino: z.number().finite(),
});

export const MarkerTransitionV3 = z.strictObject({
  format: z.literal(3),
  protocol: z.literal("marker-v3"),
  operationId: OPERATION,
  kind: z.enum(["migration-forward", "migration-rollback"]),
  phase: z.enum([
    "prepared",
    "marker-installed",
    "state-published",
    "migration-evidence-installed",
    "rollback-prepared",
    "rollback-previous-staged",
    "rollback-primary-staged",
    "rollback-previous-restored",
    "rollback-primary-restored",
    "rollback-recovery-removed",
    "rollback-marker-restored",
    "rollback-terminal-published",
  ]),
  root: DirectoryIdentity,
  marker: z.union([MarkerV3, LegacyMarker]),
  source: z.strictObject({ marker: SHA.nullable(), state: SHA.nullable() }),
  recovery: z.strictObject({
    manifest: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/source\.json$/),
    manifestSha256: SHA,
    snapshot: LOCATOR(/^migration-snapshot-v3\/[0-9a-f]{32}\/snapshot\.json$/),
    snapshotSha256: SHA,
    previousBridgeDigest: SHA,
    rollbackEligible: z.boolean(),
  }),
});
export type MarkerTransitionV3 = z.infer<typeof MarkerTransitionV3>;

const Path = z.string().min(1).max(1024).refine((path) =>
  !path.startsWith("/") &&
  !path.includes("\\") &&
  !path.includes("\0") &&
  !path.includes(":") &&
  path.split("/").every((part) => part !== "" && part !== "." && part !== ".."));
const Mode = z.string().regex(/^(?:0|[0-7]{3,4})$/);
const BaseEntry = {
  path: Path,
  marker: z.enum(["source", "reference"]),
};

export const RollbackSetEntryV2 = z.discriminatedUnion("kind", [
  z.strictObject({
    ...BaseEntry,
    kind: z.literal("file"),
    sha256: SHA,
    mode: Mode,
  }),
  z.strictObject({
    ...BaseEntry,
    kind: z.literal("directory"),
    sha256: z.null(),
    mode: Mode,
  }),
  z.strictObject({
    ...BaseEntry,
    kind: z.literal("absent"),
    sha256: z.null(),
    mode: z.null(),
  }),
]);
export type RollbackSetEntryV2 = z.infer<typeof RollbackSetEntryV2>;

export const RollbackSetManifestV2 = z.strictObject({
  format: z.literal(2),
  operationId: OPERATION,
  side: z.enum(["source", "target"]),
  marker: SHA,
  entries: z.array(RollbackSetEntryV2).min(1).max(10_000),
});
export type RollbackSetManifestV2 = z.infer<typeof RollbackSetManifestV2>;

export const RollbackSnapshotEntryV3 = z.discriminatedUnion("kind", [
  z.strictObject({
    path: Path,
    kind: z.literal("file"),
    sha256: SHA,
    mode: Mode,
    bytes: DECIMAL,
    object: z.string().regex(/^objects\/[0-9a-f]{64}$/),
  }),
  z.strictObject({
    path: Path,
    kind: z.literal("directory"),
    sha256: z.null(),
    mode: Mode,
    bytes: z.null(),
    object: z.null(),
  }),
  z.strictObject({
    path: Path,
    kind: z.literal("absent"),
    sha256: z.null(),
    mode: z.null(),
    bytes: z.null(),
    object: z.null(),
  }),
]);
export type RollbackSnapshotEntryV3 = z.infer<typeof RollbackSnapshotEntryV3>;

export const RollbackSourceSnapshotV3 = z.strictObject({
  format: z.literal(3),
  operationId: OPERATION,
  sourceManifest: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/source\.json$/),
  sourceManifestSha256: SHA,
  sourceSetDigest: SHA,
  entries: z.array(RollbackSnapshotEntryV3).min(1).max(10_000),
});
export type RollbackSourceSnapshotV3 = z.infer<typeof RollbackSourceSnapshotV3>;

const SemVer = z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/);
export const PreviousVersionsV2 = z.strictObject({
  tenet: SemVer,
  adapter: SemVer,
  schema: z.literal(2),
  recipe: z.strictObject({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/),
    version: SemVer,
  }).nullable(),
});
export type PreviousVersionsV2 = z.infer<typeof PreviousVersionsV2>;

export const RollbackEvidenceV2 = z.strictObject({
  format: z.literal(2),
  operationId: OPERATION,
  source: z.strictObject({
    locator: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/source\.json$/),
    sha256: SHA,
    sourceSetDigest: SHA,
  }),
  target: z.strictObject({
    locator: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/target\.json$/),
    sha256: SHA,
    targetBaselineDigest: SHA,
  }),
  snapshot: z.strictObject({
    locator: LOCATOR(/^migration-snapshot-v3\/[0-9a-f]{32}\/snapshot\.json$/),
    sha256: SHA,
  }),
  bindingDigest: SHA,
  bridgeDigest: SHA,
  markerIdentity: DirectoryIdentity.extend({
    bindingKind: z.enum(["host-key-v1", "none"]),
    keyId: z.string().regex(/^[a-z2-7]{24}$/).nullable(),
  }),
  previous: PreviousVersionsV2,
});
export type RollbackEvidenceV2 = z.infer<typeof RollbackEvidenceV2>;

export const MigrationRecoveryV3 = z.strictObject({
  format: z.literal(3),
  operationId: OPERATION,
  outcome: z.enum(["applied", "forfeited"]),
  sourceManifest: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/source\.json$/),
  sourceManifestSha256: SHA,
  sourceSnapshot: LOCATOR(/^migration-snapshot-v3\/[0-9a-f]{32}\/snapshot\.json$/),
  sourceSnapshotSha256: SHA,
  targetBaselineSha256: SHA,
  previousBridgeDigest: SHA,
  evidence: z.strictObject({
    locator: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/evidence\.json$/),
    sha256: SHA,
  }),
  previous: PreviousVersionsV2,
  rollbackEligible: z.boolean(),
}).superRefine((record, context) => {
  if ((record.outcome === "applied") !== record.rollbackEligible) context.addIssue({
    code: "custom", message: "outcome and rollback eligibility disagree",
  });
});
export type MigrationRecoveryV3 = z.infer<typeof MigrationRecoveryV3>;

export const RollbackTerminalV2 = z.strictObject({
  operationId: OPERATION,
  protocolVersion: z.literal(2),
  versions: z.strictObject({ from: z.literal(3), to: z.literal(2) }),
  outcome: z.literal("rolled-back"),
  sourceSetDigest: SHA,
  bindingDigest: SHA,
  bridgeDigest: SHA,
  evidence: z.strictObject({
    locator: LOCATOR(/^migration-evidence-v2\/[0-9a-f]{32}\/evidence\.json$/),
    sha256: SHA,
  }),
  previous: PreviousVersionsV2,
});
export type RollbackTerminalV2 = z.infer<typeof RollbackTerminalV2>;

export const RollbackTerminalAcceptedV2 = z.strictObject({
  format: z.literal(2),
  operationId: OPERATION,
  terminal: SHA,
  evidence: SHA,
  bridgeDigest: SHA,
  bindingDigest: SHA,
});
export type RollbackTerminalAcceptedV2 = z.infer<typeof RollbackTerminalAcceptedV2>;

export const RollbackPostcondition = z.strictObject({
  format: z.literal(2),
  operationId: OPERATION,
  acceptance: SHA,
  terminal: SHA,
  evidence: SHA,
  snapshot: SHA,
  bridgeDigest: SHA,
  marker: SHA,
  sourceState: SHA,
  sourceStatePrevious: SHA.nullable(),
  probeState: SHA,
  probeStatePrevious: SHA.nullable(),
  workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/),
  schema: z.literal(2),
  probe: z.strictObject({
    verb: z.literal("open"),
    profile: z.literal("plan"),
    requestDigest: SHA,
    handle: z.string().regex(/^wk_[a-z2-7]{10}$/),
    exit: z.literal(0),
    resultDigest: SHA,
  }),
});
export type RollbackPostcondition = z.infer<typeof RollbackPostcondition>;
