import { z } from "zod";
import { hashOf, sha256 } from "./ids.ts";
import { KernelError } from "./errors.ts";
import { ownRecord } from "./schemas.ts";
import { parseUniqueRecord } from "./private-record.ts";

export const StorageHash = z.string().regex(/^[0-9a-f]{64}$/);
export const StorageId = z.string().regex(/^(?:[a-z2-7]{24}|[0-9a-f]{32})$/);
export const StorageCount = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const DecimalIdentity = z.string().regex(/^(?:0|[1-9][0-9]{0,39})$/);
const OpaqueProviderValue = z.string().refine(value => {
  const bytes = new TextEncoder().encode(value).length;
  return bytes >= 1 && bytes <= 1024 && !/[\uD800-\uDFFF]/u.test(value);
});
export const ProviderObjectGenerationV1 = z.strictObject({
  version: z.literal(1), domain: z.literal("store-object-generation-v1"), opaque: OpaqueProviderValue,
});
export const ProviderMountDiscriminatorV1 = z.strictObject({
  version: z.literal(1), domain: z.literal("store-mount-binding-v1"), opaque: OpaqueProviderValue,
});
export const StableIdentity = z.strictObject({
  dev: DecimalIdentity, ino: DecimalIdentity,
  type: z.enum(["file", "directory"]), links: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  objectGeneration: ProviderObjectGenerationV1,
});
export const StableFileIdentity = StableIdentity.extend({ type: z.literal("file"), links: z.literal(1) });
export const OwnedLeaf = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
  .refine(path => !path.endsWith(".") && path !== "." && path !== "..");
export const FileProof = z.strictObject({
  path: OwnedLeaf, identity: StableFileIdentity, bytes: StorageCount, sha256: StorageHash,
});
const Counts = ownRecord(StorageCount);
const MonthCounts = z.strictObject({
  calls: Counts, exits: Counts, intents: StorageCount, results: StorageCount, accounting: StorageCount,
});
export const StorageMonth = MonthCounts.extend({
  workSeq: StorageCount.nullable(), generationSeq: StorageCount.nullable(),
});
const monthKey = /^(?:[0-9]{4})-(?:0[1-9]|1[0-2])$/;
export const StorageMonths = ownRecord(StorageMonth).refine(months => Object.keys(months).every(key => monthKey.test(key)));
export const LegacySummaryV1 = z.strictObject({
  version: z.literal(1), from: z.string(), batchId: z.string().optional(), months: ownRecord(MonthCounts),
});
export const LegacyBaseV2 = z.union([
  z.strictObject({ kind: z.literal("legacy-v1"), version: z.literal(1), sha256: StorageHash }),
  z.strictObject({ kind: z.literal("declared-absence") }),
]);
export const SummaryV2 = z.strictObject({
  version: z.literal(2), batchId: StorageId, from: StorageHash, months: StorageMonths, legacyBase: LegacyBaseV2.nullable(),
});
export const JournalGenerationPath = z.string().regex(/^log\.(?:sealed|retained)-[a-z2-7\d]{24,32}(?:-\d+)?$/);
const Generation = FileProof.extend({
  path: JournalGenerationPath,
  id: StorageId, first: z.string().min(1), last: z.string().min(1),
});
export const JournalIndexV1 = z.strictObject({
  version: z.literal(1),
  active: z.strictObject({ path: z.literal("log"), identity: StableFileIdentity }),
  summary: FileProof.extend({ path: z.literal("summaries.json"), batchId: StorageId }),
  sealed: z.array(Generation),
}).refine(index => new Set(index.sealed.map(item => item.path)).size === index.sealed.length);
export type StorageMonth = z.infer<typeof StorageMonth>;
export type StorageMonths = Record<string, StorageMonth>;
export type SummaryV2 = z.infer<typeof SummaryV2>;
export type JournalIndexV1 = z.infer<typeof JournalIndexV1>;
export type StableIdentity = z.infer<typeof StableIdentity>;
export type FileProof = z.infer<typeof FileProof>;

/** This conversion does not grant exact history or discharge an ambiguous legacy baseline. */
export function migrateLegacySummary(text: string | null, batchId: string, provedFresh: boolean): SummaryV2 {
  const legacy = text === null ? null : LegacySummaryV1.parse(parseUniqueRecord(text));
  const months = Object.fromEntries(Object.entries(legacy?.months ?? {}).map(([month, counts]) =>
    [month, { ...counts, workSeq: null, generationSeq: null }]));
  return SummaryV2.parse({
    version: 2, batchId, from: text === null ? hashOf(null) : sha256(text), months,
    legacyBase: text !== null ? { kind: "legacy-v1", version: 1, sha256: sha256(text) }
      : provedFresh ? null : { kind: "declared-absence" },
  });
}

function checkedSum(left: number, right: number): number {
  const sum = left + right;
  if (!Number.isSafeInteger(sum)) {
    throw new KernelError("storage-accounting-unknown", "storage summary counts exceed the exact integer bound");
  }
  return sum;
}

function mergeCounts(left: Record<string, number>, right: Record<string, number>): Record<string, number> {
  return Object.fromEntries([...new Set([...Object.keys(left), ...Object.keys(right)])].map(key => [
    key, checkedSum(Object.hasOwn(left, key) ? left[key]! : 0, Object.hasOwn(right, key) ? right[key]! : 0),
  ]));
}

export function mergeStorageMonths(left: StorageMonths, right: StorageMonths): StorageMonths {
  const admittedLeft = StorageMonths.parse(left), admittedRight = StorageMonths.parse(right);
  const entries = [...new Set([...Object.keys(admittedLeft), ...Object.keys(admittedRight)])].map(month => {
    const a = admittedLeft[month], b = admittedRight[month];
    if (!a || !b) return [month, a ?? b] as const;
    return [month, {
      calls: mergeCounts(a.calls, b.calls), exits: mergeCounts(a.exits, b.exits),
      intents: checkedSum(a.intents, b.intents), results: checkedSum(a.results, b.results),
      accounting: checkedSum(a.accounting, b.accounting),
      workSeq: a.workSeq === null || b.workSeq === null ? null : Math.max(a.workSeq, b.workSeq),
      generationSeq: a.generationSeq === null || b.generationSeq === null ? null : Math.max(a.generationSeq, b.generationSeq),
    }] as const;
  });
  return StorageMonths.parse(Object.fromEntries(entries));
}
