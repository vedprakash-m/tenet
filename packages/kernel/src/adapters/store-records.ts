import {
  closeSync, constants, fchmodSync, fstatSync, fsyncSync, ftruncateSync,
  mkdirSync, openSync, readdirSync, writeFileSync,
} from "node:fs";
import { z } from "zod";
import { CommitIntentV1, CommitProofV1, proofKey, proofMatchesIntent } from "../core/commit-proof.ts";
import { KernelError } from "../core/errors.ts";
import { sha256, stableStringify } from "../core/ids.ts";
import type { LogEntry } from "../ports/types.ts";
import { MAX_RECORD, parseRecord, parseUniqueRecord, readRecord } from "./private-record-fs.ts";

export function fsyncDirectory(dir: string) {
  const fd = openSync(dir, "r");
  try {
    try { fsyncSync(fd); } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EINVAL")) throw error;
    }
  } finally { closeSync(fd); }
}
export function writeSyncedRecord(path: string, data: string) {
  if (Buffer.byteLength(data, "utf8") > MAX_RECORD) {
    throw new KernelError("unsupported-record", "a private record exceeds the 50 MB bound");
  }
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new KernelError("unsupported-record", "private writes require a regular file");
    fchmodSync(fd, 0o600); ftruncateSync(fd, 0); writeFileSync(fd, data); fsyncSync(fd);
  } finally { closeSync(fd); }
}

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
  output: z.string(),
  removed: z.number().int().positive(),
  summary: SummaryRecord,
});
export type CompactionPendingRecord = z.infer<typeof CompactionPending>;

export function readCompactionPending(path: string): CompactionPendingRecord | null {
  const text = readRecord(path);
  if (text === null) return null;
  const pending = parsePrivate(
    CompactionPending, text, "the pending compaction is damaged; the journal was left untouched",
  );
  if (sha256(pending.output) !== pending.outputHash) {
    throw new KernelError("storage-accounting-unknown", "the pending compaction output is damaged");
  }
  return pending;
}

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
type PathOf = (name: string) => string;
const COMMIT_PROOF_DIRECTORY = "git/commit-proofs-v1";

function commitProofIntentFor(log: readonly LogEntry[], proof: CommitProofV1): boolean {
  const entries = log.filter(e => e.kind === "intent" && e.effect === "commit" && e.id === proof.run);
  if (entries.length !== 1) return false;
  const intent = CommitIntentV1.safeParse(entries[0]!.op);
  return intent.success && proofMatchesIntent(proof, intent.data);
}
function commitProofResultFor(log: readonly LogEntry[], proof: CommitProofV1): boolean {
  const entries = log.filter(e => e.kind === "result" && e.effect === "commit" && e.id === proof.run);
  if (entries.length !== 1) return false;
  const out = entries[0]!.outcome as { completed?: unknown; commit?: unknown; tree?: unknown; foreign?: unknown; proof?: unknown };
  return out?.completed === true && out.commit === proof.commit && out.tree === proof.observedTree &&
    stableStringify(out.foreign) === stableStringify(proof.foreign) &&
    stableStringify(out.proof) === stableStringify(proof);
}
export function writeCommitProof(
  p: PathOf,
  value: CommitProofV1,
  log: readonly LogEntry[],
  workspace: string,
  beforeWrite?: (bytes: number) => void,
): void {
  const proof = CommitProofV1.parse(value);
  if (proof.workspace !== workspace || !commitProofIntentFor(log, proof))
    throw new KernelError("effect-uncertain", "commit proof does not match exactly one captured intent");
  const file = p(`${COMMIT_PROOF_DIRECTORY}/${proofKey(proof)}`), text = stableStringify(proof), prior = readRecord(file);
  if (prior !== null) {
    if (stableStringify(parseUniqueRecord(prior)) !== text)
      throw new KernelError("effect-uncertain", "conflicting private commit proof");
    return;
  }
  beforeWrite?.(Buffer.byteLength(text, "utf8"));
  mkdirSync(p("git"), { recursive: true, mode: 0o700 });
  mkdirSync(p(COMMIT_PROOF_DIRECTORY), { mode: 0o700, recursive: true });
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new KernelError("effect-uncertain", "commit proof is not a regular record");
    writeFileSync(fd, text); fsyncSync(fd);
  } finally { closeSync(fd); }
  for (const dir of [p(COMMIT_PROOF_DIRECTORY), p("git"), p("")]) {
    const handle = openSync(dir, "r");
    try { fsyncSync(handle); } finally { closeSync(handle); }
  }
}
export function readCommitProofs(p: PathOf, log: readonly LogEntry[], workspace: string): CommitProofV1[] {
  let names: string[];
  try { names = readdirSync(p(COMMIT_PROOF_DIRECTORY)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (names.length > 20_000) throw new KernelError("undo-conflict", "commit proof inventory exceeds its bound");
  const proofs: CommitProofV1[] = [];
  for (const name of names) {
    if (!/^[a-f0-9]{64}$/.test(name)) throw new KernelError("undo-conflict", "unexpected private commit proof record");
    const text = readRecord(p(`${COMMIT_PROOF_DIRECTORY}/${name}`));
    if (!text || Buffer.byteLength(text) > 1_048_576) throw new KernelError("undo-conflict", "missing or oversized commit proof");
    const proof = CommitProofV1.parse(parseUniqueRecord(text));
    if (name !== proofKey(proof) || proof.workspace !== workspace)
      throw new KernelError("undo-conflict", "private commit proof identity mismatch");
    if (commitProofIntentFor(log, proof) && commitProofResultFor(log, proof)) proofs.push(proof);
  }
  return proofs;
}
