import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import type { LogEntry } from "../ports/types.ts";
import { parseRecord } from "./private-record-fs.ts";

const LogBase = z.object({ t: z.string().min(1) });
const LogRecord = z.discriminatedUnion("kind", [
  LogBase.extend({ kind: z.literal("intent"), effect: z.string().min(1), id: z.string().min(1), op: z.unknown() }).passthrough(),
  LogBase.extend({ kind: z.literal("result"), effect: z.string().min(1), id: z.string().min(1), outcome: z.unknown() }).passthrough(),
  LogBase.extend({ kind: z.literal("call"), verb: z.string().min(1), exit: z.number().int().min(0).max(5),
    revision: z.number().int().nonnegative() }).passthrough(),
  LogBase.extend({ kind: z.literal("accounting") }).passthrough(),
]);
const MonthRecord = z.strictObject({
  calls: z.record(z.string(), z.number().int().nonnegative()),
  exits: z.record(z.string(), z.number().int().nonnegative()),
  intents: z.number().int().nonnegative(),
  results: z.number().int().nonnegative(),
  accounting: z.number().int().nonnegative(),
});
export const SummaryRecord = z.strictObject({
  version: z.literal(1),
  from: z.string(),
  batchId: z.string().optional(),
  months: z.record(z.string(), MonthRecord),
});
export const CompactionPending = z.strictObject({
  version: z.literal(1),
  batchId: z.string(),
  inputHash: z.string(),
  inputIdentity: z.string(),
  outputHash: z.string(),
  summary: SummaryRecord,
});
export type CompactionPendingRecord = z.infer<typeof CompactionPending>;

export function parsePrivate<T>(schema: z.ZodType<T>, text: string, message: string): T {
  try {
    return schema.parse(parseRecord(text));
  } catch {
    throw new KernelError("storage-accounting-unknown", message);
  }
}

export function readJournal(text: string): { entries: LogEntry[]; keep: number } {
  const lines = text.split("\n"), entries: LogEntry[] = [];
  let keep = 0;
  for (let index = 0; index < lines.length - 1; index++) {
    const line = lines[index]!;
    if (!line) { keep++; continue; }
    let record: unknown;
    try { record = parseRecord(line); }
    catch (error) {
      if (error instanceof SyntaxError && index === lines.length - 2) return { entries, keep };
      throw new KernelError("unsupported-record", "the journal contains a corrupt complete record");
    }
    const parsed = LogRecord.safeParse(record);
    if (!parsed.success || (parsed.data.kind === "intent" && !Object.hasOwn(record!, "op")) ||
      (parsed.data.kind === "result" && !Object.hasOwn(record!, "outcome"))) {
      throw new KernelError("unsupported-record", "the journal contains an unsupported record");
    }
    entries.push(parsed.data);
    keep += line.length + 1;
  }
  return { entries, keep };
}
