import { z } from "zod";
import { hashOf, sha256, stableStringify } from "./ids.ts";
import { retentionOriginalActionSchema } from "./retention-original-action.ts";
import { DirectoryIdentity } from "./marker-identity.ts";
import type { RetentionOriginalAction, RetentionProjection } from "./retention-original-action.ts";
import {
  FileProof, JournalGenerationPath, OwnedLeaf, ProviderMountDiscriminatorV1, StableFileIdentity, StableIdentity,
  StorageCount, StorageHash, StorageId, StorageMonths,
} from "./storage-records.ts";

const RetainedPath = JournalGenerationPath.refine(path => path.startsWith("log.retained-"));
const RESERVED = new Set([
  "state", "state.prev", "marker", "digest.key", "log", "summaries.json", "journal-index.json",
  "compaction.retention.json", "cleanup.retention.json", "compaction.pending.json", "migration-transition.json",
]);
const SealGate = z.strictObject({
  state: z.enum(["preparing", "rotated", "cancelled"]), sourceIdentityBefore: StableFileIdentity,
  sourceHashBefore: StorageHash, rotateAfterHash: StorageHash.nullable(),
});
const ExclusiveToken = z.string().regex(/^[a-z2-7]{24}$/);
const SealedPath = JournalGenerationPath.refine(path => path.startsWith("log.sealed-"));
export const ReservationMountBindingV1 = z.strictObject({
  version: z.literal(1), tokenNamespace: z.literal("store-rotation-reservation-v1"), root: DirectoryIdentity,
  directory: StableIdentity.extend({ type: z.literal("directory") }), discriminator: ProviderMountDiscriminatorV1,
});
export const EmptyRotationReservationV1 = z.strictObject({
  version: z.literal(1), exclusiveNameToken: ExclusiveToken, path: z.literal("log.next"),
  mount: ReservationMountBindingV1, identity: StableFileIdentity, bytes: z.literal(0), sha256: z.literal(sha256("")),
});
export const RotationIndexTempProofV1 = z.strictObject({
  version: z.literal(1), exclusiveNameToken: ExclusiveToken, path: z.literal("rotation-index.tmp"),
  mount: ReservationMountBindingV1, identity: StableFileIdentity, bytes: StorageCount, sha256: StorageHash,
  authorization: z.strictObject({
    runId: z.string().min(1).nullable(), batchId: StorageId, generationId: StorageId,
    operationToken: z.string().min(1), originalActionHash: StorageHash,
    progressVersion: z.literal(1), progressPhase: z.literal("seal"), reservation: EmptyRotationReservationV1,
    logSource: FileProof.extend({ path: z.literal("log") }),
    logDestination: z.strictObject({ path: z.literal("log"), identity: StableFileIdentity }),
    sealedPath: SealedPath, indexBefore: FileProof.extend({ path: z.literal("journal-index.json") }),
    indexAfterHash: StorageHash, indexSourcePath: z.literal("rotation-index.tmp"),
    indexDestinationPath: z.literal("journal-index.json"), promotionPhase: z.literal("rotation-index-v1"),
  }),
});
const Rotation = z.strictObject({
  sealedPath: SealedPath, next: EmptyRotationReservationV1,
  indexBeforeHash: StorageHash, indexAfterHash: StorageHash, indexTemp: RotationIndexTempProofV1,
});
const StateProof = z.strictObject({ identity: StableFileIdentity, hash: StorageHash });
const StatePair = z.strictObject({ current: StateProof, previous: StateProof });
const ReplaceProof = z.strictObject({
  beforeHash: StorageHash, afterHash: StorageHash.nullable(), tempPath: OwnedLeaf, tempIdentity: StableFileIdentity.nullable(),
});
const RetentionReportProof = z.strictObject({
  inputHash: StorageHash, responseHash: StorageHash,
  stateBeforeIdentity: StableFileIdentity, stateBeforeHash: StorageHash,
  stateAfterIdentity: StableFileIdentity, stateAfterHash: StorageHash,
  callHash: StorageHash, logBeforeHash: StorageHash, logAfterHash: StorageHash, originalActionHash: StorageHash,
});
const Output = z.strictObject({
  ordinal: StorageCount, path: RetainedPath, identity: StableFileIdentity,
  sourceStart: StorageCount, sourceEnd: StorageCount, bytes: StorageCount.positive(), sha256: StorageHash,
});
const OutputOrigin = z.strictObject({
  ordinal: StorageCount, tempPath: OwnedLeaf, finalPath: RetainedPath,
  sourceStart: StorageCount, sourceEnd: StorageCount, bytes: StorageCount.positive(), sha256: StorageHash,
  tempIdentity: StableFileIdentity.nullable(),
});
const same = (left: unknown, right: unknown) => stableStringify(left) === stableStringify(right);

function validRotation(phase: string, gate: z.infer<typeof SealGate>, rotation: z.infer<typeof Rotation>): boolean {
  if (phase !== "seal" && gate.state !== "rotated") return false;
  return gate.state === "rotated" ? gate.rotateAfterHash === rotation.indexAfterHash : gate.rotateAfterHash === null;
}

function validOwnedPaths(paths: string[]): boolean {
  const normalized = paths.map(path => path.toLowerCase());
  return !normalized.some(path => RESERVED.has(path)) && new Set(normalized).size === normalized.length;
}

function validOutputRanges(
  outputs: z.infer<typeof Output>[], origin: z.infer<typeof OutputOrigin> | null,
  cursor: number, sourceBytes: number, chunk: number,
): boolean {
  if ((cursor === 0) !== (chunk === 0)) return false;
  if (new Set(outputs.map(output => output.ordinal)).size !== outputs.length) return false;
  for (let index = 0; index < outputs.length; index++) {
    const output = outputs[index]!, previous = outputs[index - 1];
    if (output.ordinal >= chunk || output.sourceStart > output.sourceEnd || output.sourceEnd > cursor ||
      output.bytes > output.sourceEnd - output.sourceStart ||
      (previous && (output.sourceStart < previous.sourceEnd || output.ordinal <= previous.ordinal))) return false;
  }
  return origin === null || (origin.ordinal === chunk && origin.sourceStart === cursor && origin.sourceEnd >= origin.sourceStart &&
    origin.sourceEnd <= sourceBytes && origin.bytes <= origin.sourceEnd - origin.sourceStart &&
    !outputs.some(output => output.ordinal === origin.ordinal));
}

function matchesFinalState(finalState: z.infer<typeof StatePair> | null, proof: z.infer<typeof StatePair>): boolean {
  return finalState === null || (same(finalState.current, {
    identity: proof.current.identity, hash: proof.current.hash,
  }) && same(finalState.previous, {
    identity: proof.previous.identity, hash: proof.previous.hash,
  }));
}

function validReport(
  report: z.infer<typeof RetentionReportProof> | null, phase: string, originalActionHash: string,
  finalState: z.infer<typeof StatePair> | null,
): boolean {
  return report === null || (phase === "report" && report.originalActionHash === originalActionHash &&
    finalState !== null && same(report.stateBeforeIdentity, finalState.current.identity) &&
    report.stateBeforeHash === finalState.current.hash);
}

/** Wire admission only; filesystem origin and the mandatory P93 verifier remain separate gates. */
export function retentionProgressSchema<P extends RetentionProjection>(privacy: {
  projection: z.ZodType<P>; effect: z.ZodType<string>;
  token: z.ZodType<string>; runId: z.ZodType<string>;
}) {
  return z.strictObject({
    version: z.literal(1), batchId: StorageId, generationId: StorageId,
    originalAction: retentionOriginalActionSchema(privacy),
    phase: z.enum(["seal", "scan", "retained-output", "summary", "index", "remove", "report"]),
    sealGate: SealGate,
    source: z.strictObject({ identity: StableFileIdentity, bytes: StorageCount, sha256: StorageHash }),
    rotation: Rotation,
    cursor: StorageCount, chunk: StorageCount, monthDelta: StorageMonths, outputs: z.array(Output),
    outputOrigin: OutputOrigin.nullable(), summary: ReplaceProof, retainedIndex: ReplaceProof,
    publisherProof: z.strictObject({
      current: StateProof.extend({ path: z.literal("state"), revision: StorageCount }),
      previous: StateProof.extend({ path: z.literal("state.prev"), revision: StorageCount }),
      exactResults: z.array(z.strictObject({
        generation: StorageId, offset: StorageCount,
        effect: z.enum(["scaffold", "hardening", "adopt", "branch", "integration", "commit"]), id: z.string().min(1),
      })),
    }),
    finalState: StatePair.nullable(), report: RetentionReportProof.nullable(),
  }).refine(row => {
    if (row.batchId !== row.generationId || row.originalAction.progress.batchId !== row.batchId ||
      row.originalAction.progress.generationId !== row.generationId || row.rotation.next.exclusiveNameToken !== row.batchId) return false;
    if (!same(row.source.identity, row.sealGate.sourceIdentityBefore) ||
      row.source.sha256 !== row.sealGate.sourceHashBefore || row.cursor > row.source.bytes) return false;
    if (!validIndexAuthorization(row)) return false;
    if (!validRotation(row.phase, row.sealGate, row.rotation)) return false;
    if (row.phase === "seal" && (row.cursor !== 0 || row.outputs.length !== 0 || row.outputOrigin !== null)) return false;
    if (!["seal", "scan", "retained-output"].includes(row.phase) &&
      (row.cursor !== row.source.bytes || row.outputOrigin !== null)) return false;
    if (!validOwnedPaths([
      row.rotation.sealedPath, row.rotation.next.path, row.rotation.indexTemp.path, row.summary.tempPath, row.retainedIndex.tempPath,
      ...row.outputs.map(output => output.path),
      ...(row.outputOrigin === null ? [] : [row.outputOrigin.tempPath, row.outputOrigin.finalPath]),
    ])) return false;
    if (!validOutputRanges(row.outputs, row.outputOrigin, row.cursor, row.source.bytes, row.chunk)) return false;
    if ((row.phase === "remove" || row.phase === "report") && row.finalState === null) return false;
    if (!matchesFinalState(row.finalState, row.publisherProof)) return false;
    return validReport(row.report, row.phase, hashOf(row.originalAction), row.finalState);
  });
}

export type RetentionProgress<P extends RetentionProjection> = z.infer<ReturnType<typeof retentionProgressSchema<P>>>;

function validIndexAuthorization(row: {
  batchId: string; generationId: string; originalAction: RetentionOriginalAction<RetentionProjection>;
  source: Omit<FileProof, "path">; rotation: z.infer<typeof Rotation>;
}): boolean {
  const temp = row.rotation.indexTemp;
  return temp.exclusiveNameToken !== row.rotation.next.exclusiveNameToken &&
    same(temp.mount, row.rotation.next.mount) && temp.sha256 === row.rotation.indexAfterHash &&
    temp.authorization.indexBefore.sha256 === row.rotation.indexBeforeHash &&
    same(temp.authorization, rotationIndexAuthorization(row, temp.authorization.indexBefore));
}

export function rotationIndexAuthorization<P extends RetentionProjection>(
  row: {
    batchId: string; generationId: string; originalAction: RetentionOriginalAction<P>;
    source: Omit<FileProof, "path">; rotation: Omit<z.infer<typeof Rotation>, "indexTemp">;
  }, indexBefore: FileProof,
): z.infer<typeof RotationIndexTempProofV1>["authorization"] {
  return {
    runId: row.originalAction.runId, batchId: row.batchId, generationId: row.generationId,
    operationToken: row.originalAction.intent.token, originalActionHash: hashOf(row.originalAction),
    progressVersion: 1, progressPhase: "seal", reservation: row.rotation.next,
    logSource: { path: "log", ...row.source }, logDestination: { path: "log", identity: row.rotation.next.identity },
    sealedPath: row.rotation.sealedPath, indexBefore: { ...indexBefore, path: "journal-index.json" },
    indexAfterHash: row.rotation.indexAfterHash, indexSourcePath: "rotation-index.tmp",
    indexDestinationPath: "journal-index.json", promotionPhase: "rotation-index-v1",
  };
}

function countsPreserved(before: Record<string, unknown>, after: Record<string, unknown>): boolean {
  return Object.entries(before).every(([key, value]) => {
    const next = after[key];
    if (typeof value === "number") return typeof next === "number" && next >= value;
    return !!value && typeof value === "object" && !!next && typeof next === "object" &&
      countsPreserved(value as Record<string, unknown>, next as Record<string, unknown>);
  });
}

/** Both arguments must already satisfy the strict wire schema and the P93 phase admission. */
export function validRetentionUpdate<P extends RetentionProjection>(before: RetentionProgress<P>, after: RetentionProgress<P>): boolean {
  const transitions = {
    seal: ["seal", "scan"], scan: ["scan", "retained-output", "summary"],
    "retained-output": ["retained-output", "scan"], summary: ["summary", "index"],
    index: ["index", "remove"], remove: ["remove", "report"], report: ["report"],
  };
  if (!transitions[before.phase].includes(after.phase) || after.cursor < before.cursor || after.chunk < before.chunk) return false;
  for (const field of ["originalAction", "batchId", "generationId", "source", "rotation", "publisherProof"] as const) {
    if (!same(before[field], after[field])) return false;
  }
  if (before.sealGate.state !== "preparing" && !same(before.sealGate, after.sealGate)) return false;
  if (!countsPreserved(before.monthDelta, after.monthDelta) || after.outputs.length < before.outputs.length ||
    !before.outputs.every((output, index) => same(output, after.outputs[index]))) return false;
  return replacementProofsPreserved(before, after) && cursorUpdateValid(before, after) && originUpdateValid(before, after);
}

function cursorUpdateValid<P extends RetentionProjection>(before: RetentionProgress<P>, after: RetentionProgress<P>): boolean {
  if (before.cursor === after.cursor) {
    return before.chunk === after.chunk && same(before.monthDelta, after.monthDelta) && same(before.outputs, after.outputs);
  }
  return ["scan", "retained-output"].includes(before.phase) && after.phase === "scan" &&
    after.chunk === before.chunk + 1 && (after.outputs.length === before.outputs.length || before.outputOrigin !== null);
}

function replacementProofsPreserved<P extends RetentionProjection>(before: RetentionProgress<P>, after: RetentionProgress<P>): boolean {
  for (const field of ["summary", "retainedIndex"] as const) {
    if (before[field].beforeHash !== after[field].beforeHash || before[field].tempPath !== after[field].tempPath ||
      (before[field].afterHash !== null && before[field].afterHash !== after[field].afterHash) ||
      (before[field].tempIdentity !== null && !same(before[field].tempIdentity, after[field].tempIdentity))) return false;
  }
  for (const field of ["finalState", "report"] as const) {
    if (before[field] !== null && !same(before[field], after[field])) return false;
  }
  return true;
}

function originUpdateValid<P extends RetentionProjection>(before: RetentionProgress<P>, after: RetentionProgress<P>): boolean {
  if (before.outputOrigin !== null && !same(before.outputOrigin, after.outputOrigin)) {
    if (before.outputOrigin.tempIdentity === null && after.outputOrigin !== null &&
      same({ ...before.outputOrigin, tempIdentity: after.outputOrigin.tempIdentity }, after.outputOrigin)) return true;
    const origin = before.outputOrigin, { tempPath: _temp, tempIdentity, finalPath, ...proof } = origin;
    const committed = after.outputs.find(output => output.ordinal === origin.ordinal);
    if (after.outputOrigin !== null || tempIdentity === null || !committed ||
      !same(committed, { ...proof, path: finalPath, identity: tempIdentity }) ||
      after.cursor !== origin.sourceEnd || after.chunk !== origin.ordinal + 1) return false;
  }
  return true;
}
