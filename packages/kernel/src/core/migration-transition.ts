import { z } from "zod";
import { sha256, stableStringify } from "./ids.ts";
import { MAX_RECORD } from "./private-record.ts";
import { DirectoryIdentity, MarkerV3 } from "./marker-identity.ts";
import {
  DecimalIdentity, OwnedLeaf, StableFileIdentity, StorageHash, StorageId,
} from "./storage-records.ts";

export const PRIVACY_POPULATION = [
  "digest.key", "state.prev", "state", "marker", "summaries.json", "journal-index.json",
] as const;
const ORDINARY = ["state.prev", "state", "marker", "summaries.json", "journal-index.json"] as const;
const PrivacyPhase = z.enum([
  "prepared", "snapshot", "key", "previous", "state", "marker", "migration-evidence-installed", "remove",
]);
const TargetName = z.enum(ORDINARY);
const TuplePath = z.union([
  OwnedLeaf,
  z.string().regex(/^migration-evidence-v2\/[0-9a-f]{32}\/(?:source|target|evidence)\.json$/),
]);
const FileAbsent = z.strictObject({
  presence: z.literal("absent"), path: TuplePath,
  identity: z.null(), bytes: z.null(), sha256: z.null(), schema: z.null(),
});
const FilePresent = z.strictObject({
  presence: z.literal("present"), path: TuplePath, identity: StableFileIdentity,
  bytes: DecimalIdentity, sha256: StorageHash, schema: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});
export const FileTupleV3 = z.discriminatedUnion("presence", [FileAbsent, FilePresent]);
export const LegacyPrivateSourceTupleV3 = z.discriminatedUnion("presence", [
  z.strictObject({
    presence: z.literal("absent"), path: OwnedLeaf, identity: z.null(), schema: z.null(),
    privateCopy: z.literal("absent"),
  }),
  z.strictObject({
    presence: z.literal("present"), path: OwnedLeaf, identity: StableFileIdentity,
    schema: z.union([z.literal(1), z.literal(2), z.literal(3)]), privateCopy: z.literal("required"),
  }),
]);
const SourceTuple = z.union([LegacyPrivateSourceTupleV3, FileTupleV3]);
const Target = z.strictObject({ path: TargetName, before: SourceTuple, after: FileTupleV3, tempPath: OwnedLeaf });
const KeyBefore = z.strictObject({ presence: z.literal("absent"), identity: z.null(), bytes: z.null() });
const KeyAfter = z.strictObject({
  presence: z.literal("present"), identity: StableFileIdentity, bytes: z.literal(84),
  magic: z.tuple([z.literal(84), z.literal(75), z.literal(49), z.literal(0)]),
  digestKeyId: z.string().regex(/^[0-9a-f]{32}$/),
});
const PrivacyFields = z.strictObject({
  afterSchema: z.literal(3),
  populationVersion: z.literal(2), populationMembers: z.tuple([
    z.literal("digest.key"), z.literal("state.prev"), z.literal("state"),
    z.literal("marker"), z.literal("summaries.json"), z.literal("journal-index.json"),
  ]),
  populationHash: StorageHash, afterSnapshotHash: StorageHash,
  digestKeyId: z.string().regex(/^[0-9a-f]{32}$/),
  keyRecord: z.strictObject({ path: z.literal("digest.key"), before: KeyBefore, after: KeyAfter, tempPath: OwnedLeaf }),
});
const CleanTarget = Target.extend({ before: FileTupleV3 });
const CleanJournal = z.strictObject({ path: z.literal("log"), before: FileTupleV3, final: FileTupleV3 });
const Privacy = z.discriminatedUnion("operation", [
  PrivacyFields.extend({
    operation: z.literal("privacy-schema-3-migration"), beforeSchema: z.literal(2),
    targets: z.array(Target).length(5),
    journal: z.strictObject({
      path: z.literal("log"), before: LegacyPrivateSourceTupleV3, final: LegacyPrivateSourceTupleV3,
    }),
  }),
  PrivacyFields.extend({
    operation: z.literal("privacy-schema-3-fresh"), beforeSchema: z.null(),
    targets: z.array(CleanTarget).length(5), journal: CleanJournal,
  }),
  PrivacyFields.extend({
    operation: z.literal("digest-key-repair-v3"), beforeSchema: z.literal(3),
    targets: z.array(CleanTarget).length(5), journal: CleanJournal,
  }),
]);
export const PrivateSnapshotRefV3 = z.strictObject({
  provider: z.literal("store-private-snapshot-v1"),
  handle: z.string().min(1).refine(value => new TextEncoder().encode(value).length <= MAX_RECORD),
  copySetVersion: z.literal(1), capture: z.enum(["reserved", "complete"]),
});
const Snapshot = z.strictObject({
  sourceAttestationPath: z.string().regex(/^migration-evidence-v2\/[0-9a-f]{32}\/source\.json$/),
  sourceAttestationSha256: StorageHash, sourceAttestationProof: FileTupleV3,
  privateSource: PrivateSnapshotRefV3,
});
const EvidenceFile = z.strictObject({ path: z.string(), sha256: StorageHash, proof: FileTupleV3.nullable() });
const Evidence = z.strictObject({
  target: EvidenceFile, evidence: EvidenceFile,
  recovery: EvidenceFile.extend({ path: z.literal("migration-recovery-v3.json"), tempPath: OwnedLeaf }),
  previousBridgeDigest: StorageHash,
});
const Base = z.strictObject({
  format: z.literal(3), protocol: z.literal("migration-transition-v3"), protocolVersion: z.literal(2),
  operationId: StorageId, kind: z.enum(["fresh-init", "migration-forward", "digest-key-repair"]),
  phase: PrivacyPhase, root: z.unknown(), marker: z.unknown(),
  privacy: Privacy, snapshot: Snapshot.optional(), evidence: Evidence.optional(),
});
export type PrivacyTransitionV3 = z.infer<typeof Base>;
type Population = Pick<z.infer<typeof Privacy>, "operation" | "populationVersion" | "populationMembers" | "keyRecord" | "targets">;
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);

function compareUtf8(left: string, right: string): number {
  const encoder = new TextEncoder(), a = encoder.encode(left), b = encoder.encode(right);
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] !== b[index]) return a[index]! - b[index]!;
  }
  return a.length - b.length;
}

function canonicalMigrationJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new TypeError("noncanonical migration integer");
    return JSON.stringify(value);
  }
  if (typeof value === "string") {
    for (const point of value) {
      const code = point.codePointAt(0)!;
      if (code >= 0xd800 && code <= 0xdfff) throw new TypeError("invalid migration Unicode");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalMigrationJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("noncanonical migration JSON");
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort(compareUtf8).map(key =>
    `${canonicalMigrationJson(key)}:${canonicalMigrationJson(object[key])}`).join(",")}}`;
}

const CleanAfter = z.discriminatedUnion("presence", [
  FileAbsent.omit({ path: true }), FilePresent.omit({ path: true }),
]);

/** Only generated clean after proofs enter these v2 domains; source metadata is never traversed. */
export function transitionHashes(population: Population) {
  const { operation, populationVersion, populationMembers, keyRecord, targets } = population;
  if (populationVersion !== 2) throw new TypeError("unsupported migration population");
  const afterSnapshotHash = sha256(`tenet:migration-transition-v3:after-snapshot:v2\0${canonicalMigrationJson({
    operation, protocolVersion: 2, populationVersion,
    key: { after: KeyAfter.parse(keyRecord.after) },
    targets: targets.map(target => {
      const { path: _path, ...after } = target.after;
      return { after: CleanAfter.parse(after) };
    }),
  })}`);
  const populationHash = sha256(`tenet:migration-transition-v3:population:v2\0${canonicalMigrationJson({
    canonicalVersion: 1, protocolVersion: 2, populationVersion, members: populationMembers, afterSnapshotHash,
  })}`);
  return { populationHash, afterSnapshotHash };
}

function validTargets(row: PrivacyTransitionV3): boolean {
  const p = row.privacy;
  if (p.targets.length !== ORDINARY.length) return false;
  if (!same(p.journal.before, p.journal.final) || p.journal.before.path !== "log") return false;
  if (p.keyRecord.tempPath !== `digest.key.tmp-${row.operationId}` || p.digestKeyId !== p.keyRecord.after.digestKeyId) return false;
  for (let index = 0; index < ORDINARY.length; index++) {
    const target = p.targets[index]!;
    if (target.path !== ORDINARY[index] || target.before.path !== target.path || target.after.path !== target.path) return false;
    if (target.tempPath !== `${target.path}.tmp-${row.operationId}` || target.after.presence !== "present") return false;
    if (target.after.schema !== 3) return false;
  }
  try {
    const hashes = transitionHashes(p);
    return p.populationHash === hashes.populationHash && p.afterSnapshotHash === hashes.afterSnapshotHash;
  } catch {
    return false;
  }
}

function validEvidence(row: PrivacyTransitionV3): boolean {
  const s = row.snapshot, e = row.evidence;
  if (!s || !e) return false;
  const dir = `migration-evidence-v2/${row.operationId}`;
  if (s.sourceAttestationPath !== `${dir}/source.json` ||
    !validEvidenceProof({ path: s.sourceAttestationPath, sha256: s.sourceAttestationSha256, proof: s.sourceAttestationProof }) ||
    s.sourceAttestationProof.presence !== "present") return false;
  if (e.target.path !== `${dir}/target.json` || e.evidence.path !== `${dir}/evidence.json`) return false;
  if (e.recovery.tempPath !== `migration-recovery-v3.json.tmp-${row.operationId}`) return false;
  if (!validSnapshotPhase(row.phase, s)) return false;
  if (![e.target, e.evidence, e.recovery].every(validEvidenceProof)) return false;
  const installed = row.phase === "migration-evidence-installed" || row.phase === "remove";
  if (installed && (!e.target.proof || !e.evidence.proof)) return false;
  if (!installed && e.recovery.proof) return false;
  if (!installed && row.phase !== "marker" && (e.target.proof || e.evidence.proof || e.recovery.proof)) return false;
  if (e.evidence.proof && !e.target.proof) return false;
  return row.phase !== "remove" || e.recovery.proof !== null;
}

function validEvidenceProof(file: z.infer<typeof EvidenceFile>): boolean {
  return file.proof === null || (file.proof.presence === "present" &&
    file.proof.path === file.path && file.proof.sha256 === file.sha256);
}

function validSnapshotPhase(phase: PrivacyTransitionV3["phase"], snapshot: z.infer<typeof Snapshot>): boolean {
  return snapshot.privateSource.capture === (phase === "prepared" ? "reserved" : "complete");
}

function validOperation(row: PrivacyTransitionV3): boolean {
  const p = row.privacy;
  if (p.operation === "privacy-schema-3-migration") {
    return row.kind === "migration-forward" && /^[0-9a-f]{32}$/.test(row.operationId) &&
      p.beforeSchema === 2 && validSource(row, 2) && validEvidence(row);
  }
  if (row.snapshot !== undefined || row.evidence !== undefined ||
    row.phase === "snapshot" || row.phase === "migration-evidence-installed") return false;
  if (!/^[a-z2-7]{24}$/.test(row.operationId)) return false;
  if (p.operation === "privacy-schema-3-fresh") {
    return row.kind === "fresh-init" && p.beforeSchema === null &&
      p.targets.every(target => target.before.presence === "absent" && !("privateCopy" in target.before)) &&
      p.journal.before.presence === "absent" && !("privateCopy" in p.journal.before);
  }
  return row.kind === "digest-key-repair" && p.beforeSchema === 3 && validSource(row, 3) &&
    p.targets.every(target => target.before.presence === "present" && target.before.schema === 3 &&
      !("privateCopy" in target.before)) &&
    p.targets.filter(target => target.path === "summaries.json" || target.path === "journal-index.json")
      .every(target => same(target.before, target.after));
}

function validSource(row: PrivacyTransitionV3, schema: 2 | 3): boolean {
  const journal = row.privacy.journal.before;
  if (journal.presence !== "present" || journal.schema !== schema ||
    ("privateCopy" in journal) !== (schema === 2)) return false;
  const targets = row.privacy.targets;
  for (const path of ["marker", "state.prev", "state"]) {
    const before = targets.find(target => target.path === path)?.before;
    if (!before || before.presence !== "present" || before.schema !== schema) return false;
    if (path !== "marker" && ("privateCopy" in before) !== (schema === 2)) return false;
  }
  return true;
}

/** The marker owner supplies its strict schemas; this module does not qualify a host or authenticate ownership. */
export function privacyTransitionSchema(interfaces: { directoryIdentity: z.ZodType; marker: z.ZodType }) {
  return Base.extend({ root: interfaces.directoryIdentity, marker: interfaces.marker })
    .refine(validTargets, "the exact privacy target population is required")
    .refine(validOperation, "operation-specific source, phase, snapshot and evidence are required");
}

/** Published marker wire interface only; neither host admission nor schema-3 activation. */
export const PrivacyMigrationTransitionV3 = privacyTransitionSchema({
  directoryIdentity: DirectoryIdentity, marker: MarkerV3,
});

export interface PopulationObservation {
  targets: Record<string, z.infer<typeof SourceTuple>>;
  key: z.infer<typeof KeyBefore> | z.infer<typeof KeyAfter>;
  journal: z.infer<typeof SourceTuple>;
}

function tupleMatches(observed: unknown, expected: z.infer<typeof SourceTuple>): boolean {
  const parsed = ("privateCopy" in expected ? LegacyPrivateSourceTupleV3 : FileTupleV3).safeParse(observed);
  return parsed.success && same(parsed.data, expected);
}

function populationMatches(row: PrivacyTransitionV3, observed: PopulationObservation, after: ReadonlySet<string>): boolean {
  if (Object.keys(observed.targets).length !== ORDINARY.length) return false;
  if (!tupleMatches(observed.journal, row.privacy.journal.before)) return false;
  const expectedKey = after.has("digest.key") ? row.privacy.keyRecord.after : row.privacy.keyRecord.before;
  const key = (expectedKey.presence === "present" ? KeyAfter : KeyBefore).safeParse(observed.key);
  if (!key.success || !same(key.data, expectedKey)) return false;
  return row.privacy.targets.every(target =>
    tupleMatches(observed.targets[target.path], after.has(target.path) ? target.after : target.before));
}

/** This admits the population row only; snapshot and evidence admission are separate required interfaces. */
export function admitPopulationPhase(row: PrivacyTransitionV3, observed: PopulationObservation): boolean {
  const migrated = row.privacy.operation === "privacy-schema-3-migration";
  const repaired = row.privacy.operation === "digest-key-repair-v3";
  const storage = repaired ? [] : ["summaries.json", "journal-index.json"];
  if (row.phase === "prepared" && migrated) return populationMatches(row, observed, new Set());
  if (row.phase === "prepared" || row.phase === "snapshot") {
    const prefix = [...storage, "digest.key"];
    return prefix.some((_, count) => populationMatches(row, observed, new Set(prefix.slice(0, count)))) ||
      populationMatches(row, observed, new Set(prefix));
  }
  const fixed = [...storage, "digest.key"];
  const count = { key: 0, previous: 1, state: 2, marker: 3, "migration-evidence-installed": 3, remove: 3 }[row.phase];
  const stateOrder = ["state.prev", "state", "marker"];
  const before = new Set([...fixed, ...stateOrder.slice(0, count)]);
  if (populationMatches(row, observed, before)) return true;
  return count < 3 && populationMatches(row, observed, new Set([...before, stateOrder[count]!]));
}
