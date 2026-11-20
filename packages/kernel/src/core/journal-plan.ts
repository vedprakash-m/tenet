import { z } from "zod";
import { AccountingCheckpoint } from "./schemas.ts";
import { Timing } from "./timing.ts";
import { KernelError } from "./errors.ts";
import { stableStringify } from "./ids.ts";
import { parseUniqueRecord } from "./private-record.ts";
import { StorageCount, mergeStorageMonths } from "./storage-records.ts";
import type { StorageMonths, StorageMonth } from "./storage-records.ts";
import { KEEP_NEWEST } from "./journal-reduce.ts";

const Base = z.strictObject({ t: z.iso.datetime({ offset: true }) });
const Intent = Base.extend({ kind: z.literal("intent"), effect: z.string().min(1), id: z.string().min(1), op: z.unknown() });
const Result = Base.extend({
  kind: z.literal("result"), effect: z.string().min(1), id: z.string().min(1), outcome: z.unknown(),
});
const Call = Base.extend({
  kind: z.literal("call"), verb: z.string().min(1), exit: z.number().int().min(0).max(5), revision: StorageCount,
  timing: Timing.optional(), work: z.string().regex(/^W-[0-9]+$/).optional(), intentRevision: StorageCount.optional(),
  startedAt: z.iso.datetime({ offset: true }).optional(), durationMs: z.number().nonnegative().optional(),
  termination: z.enum(["completed", "cancelled", "timeout", "crashed"]).optional(),
  checkOutcome: z.enum(["pass", "fail", "inconclusive", "skipped"]).optional(),
  role: z.literal("unknown").optional(), model: z.literal("unknown").optional(), permission: z.literal("unknown").optional(),
  visibilityGaps: z.array(z.enum(["role", "model", "permission"])).optional(),
});
const Record = z.union([Intent, Result, Call, AccountingCheckpoint.extend({ t: Base.shape.t })]);
type Record = z.infer<typeof Record>;
type PairRecord = z.infer<typeof Intent> | z.infer<typeof Result>;
type Publication = "exact" | "not-applied" | "unknown";
export interface JournalPair {
  effect: string; id: string;
  intent: { generation: string; offset: number; record: z.infer<typeof Intent> };
  result: { generation: string; offset: number; record: z.infer<typeof Result> };
}
export interface ReductionOptions {
  nowMs: number; days: number; protectFromRevision: number;
  protectedIds: ReadonlySet<string>; protectedPaths: ReadonlySet<string>;
  published?: (pair: JournalPair) => { current: Publication; previous: Publication };
}
interface Row {
  generation: string; offset: number; bytes: string; record: Record | null; protected: boolean;
}
const PUBLISHERS = new Set(["scaffold", "hardening", "adopt", "branch", "integration", "commit"]);
const key = (record: PairRecord) => JSON.stringify([record.effect, record.id]);
const emptyMonth = (): StorageMonth => ({
  calls: {}, exits: {}, intents: 0, results: 0, accounting: 0, workSeq: 0, generationSeq: 0,
});
const pairRecord = (record: Record | null): record is PairRecord => record?.kind === "intent" || record?.kind === "result";

export function shouldSeal(completeBytes: number, triggerBytes: number): boolean {
  if (!Number.isSafeInteger(completeBytes) || completeBytes < 0 ||
    !Number.isSafeInteger(triggerBytes) || triggerBytes < 1) throw new RangeError("invalid journal byte boundary");
  return completeBytes >= triggerBytes;
}

function readRows(generation: { id: string; text: string }): Row[] {
  if (generation.text && !generation.text.endsWith("\n")) {
    throw new KernelError("storage-accounting-unknown", "a sealed generation has an incomplete record");
  }
  const rows: Row[] = [];
  let offset = 0, unknown = false;
  for (const line of generation.text.split("\n").slice(0, -1)) {
    let record: Record | null = null;
    if (line.trim()) {
      let raw: unknown;
      try { raw = parseUniqueRecord(line); }
      catch { throw new KernelError("storage-accounting-unknown", "a sealed generation contains a damaged record"); }
      const parsed = Record.safeParse(raw);
      if (parsed.success && stableStringify(parsed.data) === stableStringify(raw) &&
        (parsed.data.kind !== "intent" || Object.hasOwn(raw!, "op")) &&
        (parsed.data.kind !== "result" || Object.hasOwn(raw!, "outcome"))) record = parsed.data;
      else unknown = true;
    }
    rows.push({ generation: generation.id, offset, bytes: line + "\n", record, protected: false });
    offset += Buffer.byteLength(line + "\n", "utf8");
  }
  if (unknown) for (const row of rows) row.protected = true;
  return rows;
}

function candidates(rows: Row[], options: ReductionOptions): Map<string, Row[]> {
  const pairs = new Map<string, Row[]>();
  const recent = new Set(rows.filter(row => row.record).slice(-KEEP_NEWEST));
  const cutoff = options.nowMs - options.days * 86_400_000;
  for (const row of rows) {
    const record = row.record;
    row.protected ||= !record || recent.has(row) || Date.parse(record.t) >= cutoff;
    if (!pairRecord(record)) continue;
    const op = record.kind === "intent" ? record.op : null;
    const path = op && typeof op === "object" && "runDir" in op ? op.runDir : null;
    row.protected ||= options.protectedIds.has(record.id) || (typeof path === "string" && options.protectedPaths.has(path));
    const group = pairs.get(key(record)) ?? [];
    group.push(row); pairs.set(key(record), group);
  }
  return pairs;
}

function admittedPair(rows: Row[]): JournalPair | null {
  if (rows.length !== 2 || rows.some(row => row.protected)) return null;
  const [intent, result] = rows;
  if (intent?.record?.kind !== "intent" || result?.record?.kind !== "result") return null;
  if (!PUBLISHERS.has(intent.record.effect)) return null;
  const outcome = result.record.outcome;
  if (!outcome || typeof outcome !== "object" || !Object.hasOwn(outcome, "completed") ||
    !("completed" in outcome) || outcome.completed !== true) return null;
  if (intent.record.effect === "branch") {
    const branch = z.strictObject({ completed: z.literal(true), branch: z.string().min(1) }).safeParse(outcome);
    const op = z.strictObject({
      work: z.string().min(1), from: z.string().nullable(), to: z.string().min(1),
    }).safeParse(intent.record.op);
    if (!branch.success || !op.success || branch.data.branch !== op.data.to) return null;
  }
  return {
    effect: intent.record.effect, id: intent.record.id,
    intent: { generation: intent.generation, offset: intent.offset, record: intent.record },
    result: { generation: result.generation, offset: result.offset, record: result.record },
  };
}

function exactPair(rows: Row[], options: ReductionOptions): boolean {
  const pair = admittedPair(rows);
  if (!pair || !options.published) return false;
  try {
    const proof = options.published(pair);
    return proof.current === "exact" && proof.previous === "exact";
  } catch {
    // A throwing publisher supplies no proof; both source records remain protected.
    return false;
  }
}

function delta(record: Record): StorageMonths {
  const month = emptyMonth();
  if (record.kind === "call") {
    Object.defineProperty(month.calls, record.verb, { value: 1, enumerable: true });
    month.exits[String(record.exit)] = 1;
  } else if (record.kind === "intent") month.intents = 1;
  else if (record.kind === "result") month.results = 1;
  else {
    month.accounting = 1;
    month.workSeq = record.workSeq;
    month.generationSeq = record.generationSeq;
  }
  return { [record.t.slice(0, 7)]: month };
}

/** Plans only. Publication proofs must come from the closed pure publishers over both admitted durable copies. */
export function planJournalReduction(generations: Array<{ id: string; text: string }>, options: ReductionOptions) {
  if (!Number.isFinite(options.nowMs) || !Number.isFinite(options.days) || options.days < 0 ||
    !Number.isSafeInteger(options.protectFromRevision) || options.protectFromRevision < 0) {
    throw new RangeError("invalid reduction time or accounting boundary");
  }
  if (new Set(generations.map(generation => generation.id)).size !== generations.length) {
    throw new KernelError("storage-accounting-unknown", "journal generation identities are duplicated");
  }
  const rows = generations.flatMap(readRows), groups = candidates(rows, options);
  const exact = new Set([...groups].filter(([, group]) => exactPair(group, options)).map(([id]) => id));
  let removed = 0, months: StorageMonths = {};
  const retained = new Map(generations.map(generation => [generation.id, ""]));
  for (const row of rows) {
    const record = row.record;
    const removable = record?.kind === "call" ||
      (record?.kind === "accounting" && record.revision < options.protectFromRevision && record.complete &&
        record.inFlight.length === 0) || (pairRecord(record) && exact.has(key(record)));
    if (row.protected || !record || !removable) {
      retained.set(row.generation, retained.get(row.generation)! + row.bytes);
    } else {
      months = mergeStorageMonths(months, delta(record));
      removed++;
    }
  }
  return { removed, months, retained: [...retained].map(([id, text]) => ({ id, text })) };
}
