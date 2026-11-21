import { z } from "zod";
import { readRecord } from "./private-record-fs.ts";
import { parsePrivate } from "./store-records.ts";

const Record = z.strictObject({ version: z.literal(1), paths: z.array(z.string()).max(10_000) });

export function readExpiredEvidence(path: string): string[] {
  const text = readRecord(path);
  return text === null ? [] : parsePrivate(Record, text, "expired evidence history is damaged").paths;
}

export function addExpiredEvidence(
  path: string, paths: readonly string[], write: (text: string) => void,
): void {
  if (!paths.length) return;
  const next = [...new Set([...readExpiredEvidence(path), ...paths])];
  write(JSON.stringify(Record.parse({ version: 1, paths: next })));
}
