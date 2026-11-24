import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { catFileBatch, git, writeRefFiles } from "../core/git.js";
import { jcs } from "../core/hash.js";
import type { ProofCard } from "../types/generated.js";
import type { VerificationBundle } from "./bundle.js";

const recordsRef = "refs/tenet/records";
type Run = Pick<VerificationBundle["run"], "id" | "attempt">;
export type RecordEntry = {
  work: string;
  run: Run;
  startedAt: string;
  at: string;
  card: ProofCard;
  rules?: ProofCard["rules"];
};
export type RunLocator = Run & { startedAt: string; evaluation_id: string };
type Lines = Record<string, string>;
export type RecordsSnapshot = { tip: string | null; files: Lines };
export interface RecordsStore {
  read(paths: string[]): Promise<RecordsSnapshot>;
  write(snapshot: RecordsSnapshot, files: Lines, message: string): Promise<boolean>;
}

function safeKey(value: string): string {
  if (!/^[A-Za-z0-9-]+$/.test(value)) throw new Error("invalid record key");
  return value;
}

export function recordsFiles(entry: RecordEntry, snapshot: RecordsSnapshot): Lines {
  const prefix = `proof/${safeKey(entry.work)}/`;
  const id = safeKey(entry.card.evaluation_id);
  const key = `${prefix}${id}/${safeKey(entry.run.id)}-${entry.run.attempt}.json`;
  const latest = `${prefix}latest`;
  const month = `rules/${entry.at.slice(0, 7)}.jsonl`;
  const content = `${jcs(entry.card)}\n`;
  const existing = snapshot.files[key];
  if (existing !== undefined) {
    if (existing !== content) throw new Error("record key already holds different content");
    return {};
  }
  const files: Lines = { [key]: content };
  const previous = snapshot.files[latest];
  const last = previous ? JSON.parse(previous) as RunLocator : undefined;
  if (!last || Date.parse(entry.startedAt) > Date.parse(last.startedAt) ||
    (Date.parse(entry.startedAt) === Date.parse(last.startedAt) && entry.run.id === last.id && entry.run.attempt > last.attempt)) {
    files[latest] = `${jcs({ ...entry.run, startedAt: entry.startedAt, evaluation_id: id })}\n`;
  }
  const outcomes = entry.rules ?? entry.card.rules;
  if (outcomes.length) {
    const lines = outcomes.map(({ rule, mode, would_block }) => jcs({
      evaluation_id: id, run: entry.run, pr: entry.work === "main" ? null : Number(entry.work.slice(3)),
      rule, mode, would_block, at: entry.at,
    }));
    files[month] = `${(snapshot.files[month] ?? "") + lines.join("\n")}\n`;
  }
  return files;
}

export async function keepRecord(
  store: RecordsStore,
  entry: RecordEntry,
  wait: () => Promise<unknown> = () => delay(500 + Math.floor(Math.random() * 2501)),
): Promise<boolean> {
  const prefix = `proof/${safeKey(entry.work)}/`;
  const paths = [
    `${prefix}${safeKey(entry.card.evaluation_id)}/${safeKey(entry.run.id)}-${entry.run.attempt}.json`,
    `${prefix}latest`,
    `rules/${entry.at.slice(0, 7)}.jsonl`,
  ];
  for (let retry = 0; retry <= 8; retry += 1) {
    const snapshot = await store.read(paths);
    const files = recordsFiles(entry, snapshot);
    if (!Object.keys(files).length) return true;
    if (await store.write(snapshot, files, `tenet: proof ${entry.card.evaluation_id}`)) return true;
    if (retry < 8) await wait();
  }
  return false;
}

export class GitRecords implements RecordsStore {
  constructor(private readonly cwd: string) {}

  async read(paths: string[]): Promise<RecordsSnapshot> {
    const options = { cwd: this.cwd };
    const listing = await git(["ls-remote", "origin", recordsRef], options);
    if (!listing.trim()) return { tip: null, files: {} };
    const oid = listing.trim().split(/\s+/)[0] ?? "";
    if (!/^[a-f0-9]{40,64}$/.test(oid)) throw new Error("invalid records ref");
    await git(["fetch", "--no-tags", "--no-write-fetch-head", "origin", oid], options);
    const blobs = await catFileBatch(oid, paths, options);
    return { tip: oid, files: Object.fromEntries([...blobs].map(([key, bytes]) => [key, bytes.toString("utf8")])) };
  }

  async write(snapshot: RecordsSnapshot, files: Lines, description: string): Promise<boolean> {
    const cwd = this.cwd;
    const options = { cwd };
    const staging = `refs/tenet/staging/${randomUUID()}`;
    try {
      let base = snapshot.tip;
      if (!base) {
        const empty = (await git(["mktree"], { cwd, input: "" })).trim();
        base = (await git(["commit-tree", empty, "-m", "tenet: records root"], {
          cwd, env: {
            ...process.env, GIT_AUTHOR_NAME: "tenet-recorder", GIT_AUTHOR_EMAIL: "tenet-recorder@localhost",
            GIT_COMMITTER_NAME: "tenet-recorder", GIT_COMMITTER_EMAIL: "tenet-recorder@localhost",
          },
        })).trim();
      }
      await git(["update-ref", staging, base], options);
      const commit = await writeRefFiles(staging, files, description, options);
      try {
        await git(["push", `--force-with-lease=${recordsRef}:${snapshot.tip ?? ""}`, "origin", `${commit}:${recordsRef}`], options);
        return true;
      } catch { return false; }
    } finally {
      await git(["update-ref", "-d", staging], options).catch(() => undefined);
    }
  }
}
