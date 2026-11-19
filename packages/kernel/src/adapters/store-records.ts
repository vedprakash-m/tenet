import { closeSync, constants, fstatSync, fsyncSync, mkdirSync, openSync, readdirSync, writeFileSync } from "node:fs";
import { CommitIntentV1, CommitProofV1, proofKey, proofMatchesIntent } from "../core/commit-proof.ts";
import { stableStringify } from "../core/ids.ts";
import { KernelError } from "../core/errors.ts";
import type { LogEntry } from "../ports/types.ts";
import { parseUniqueRecord, readRecord } from "./private-record-fs.ts";

type PathOf = (name: string) => string;
const DIRECTORY = "git/commit-proofs-v1";

function intentFor(log: readonly LogEntry[], proof: CommitProofV1): boolean {
  const entries = log.filter(e => e.kind === "intent" && e.effect === "commit" && e.id === proof.run);
  if (entries.length !== 1) return false;
  const intent = CommitIntentV1.safeParse(entries[0]!.op);
  return intent.success && proofMatchesIntent(proof, intent.data);
}
function resultFor(log: readonly LogEntry[], proof: CommitProofV1): boolean {
  const entries = log.filter(e => e.kind === "result" && e.effect === "commit" && e.id === proof.run);
  if (entries.length !== 1) return false;
  const out = entries[0]!.outcome as { completed?: unknown; commit?: unknown; tree?: unknown; foreign?: unknown; proof?: unknown };
  return out?.completed === true && out.commit === proof.commit && out.tree === proof.observedTree &&
    stableStringify(out.foreign) === stableStringify(proof.foreign) &&
    stableStringify(out.proof) === stableStringify(proof);
}
export function writeCommitProof(p: PathOf, value: CommitProofV1, log: readonly LogEntry[], workspace: string): void {
  const proof = CommitProofV1.parse(value);
  if (proof.workspace !== workspace || !intentFor(log, proof))
    throw new KernelError("effect-uncertain", "commit proof does not match exactly one captured intent");
  mkdirSync(p("git"), { recursive: true, mode: 0o700 });
  mkdirSync(p(DIRECTORY), { mode: 0o700, recursive: true });
  const file = p(`${DIRECTORY}/${proofKey(proof)}`), text = stableStringify(proof), prior = readRecord(file);
  if (prior !== null) {
    if (stableStringify(parseUniqueRecord(prior)) !== text)
      throw new KernelError("effect-uncertain", "conflicting private commit proof");
    return;
  }
  const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new KernelError("effect-uncertain", "commit proof is not a regular record");
    writeFileSync(fd, text); fsyncSync(fd);
  } finally { closeSync(fd); }
  for (const dir of [p(DIRECTORY), p("git"), p("")]) {
    const handle = openSync(dir, "r");
    try { fsyncSync(handle); } finally { closeSync(handle); }
  }
}
export function readCommitProofs(p: PathOf, log: readonly LogEntry[], workspace: string): CommitProofV1[] {
  let names: string[];
  try { names = readdirSync(p(DIRECTORY)); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  if (names.length > 20_000) throw new KernelError("undo-conflict", "commit proof inventory exceeds its bound");
  const proofs: CommitProofV1[] = [];
  for (const name of names) {
    if (!/^[a-f0-9]{64}$/.test(name)) throw new KernelError("undo-conflict", "unexpected private commit proof record");
    const text = readRecord(p(`${DIRECTORY}/${name}`));
    if (!text || Buffer.byteLength(text) > 1_048_576) throw new KernelError("undo-conflict", "missing or oversized commit proof");
    const proof = CommitProofV1.parse(parseUniqueRecord(text));
    if (name !== proofKey(proof) || proof.workspace !== workspace)
      throw new KernelError("undo-conflict", "private commit proof identity mismatch");
    if (intentFor(log, proof) && resultFor(log, proof)) proofs.push(proof);
  }
  return proofs;
}
