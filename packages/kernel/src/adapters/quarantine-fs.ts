// Copied records are inert. Journal every move before acting and resume only against the same directory identities.
import {
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { SCHEMA_VERSION } from "../core/schemas.ts";
import type { Clock, Quarantined, Random } from "../ports/types.ts";

const Marker = z.strictObject({
  workspaceId: z.string().regex(/^ws_[a-z2-7]{10}$/),
  tag: z.string().regex(/^[a-z2-7]{4}$/),
  nonce: z.string().regex(/^[a-z2-7]{12}$/),
  schema: z.literal(SCHEMA_VERSION),
  dev: z.number().int(),
  ino: z.number().int(),
});
const Journal = z.strictObject({
  marker: Marker,
  path: z.string().regex(/^quarantine-\d{4}-\d{2}-\d{2}-[a-z2-7]{12}$/),
  phase: z.enum(["moving", "moved"]),
  entries: z
    .array(
      z.strictObject({
        name: z
          .string()
          .min(1)
          .max(255)
          .refine((n) => !n.includes("/") && n !== "." && n !== ".."),
        dev: z.number().int(),
        ino: z.number().int(),
      }),
    )
    .max(10000),
});
export const QUARANTINE_JOURNAL = "quarantine-in-progress-";
const refuse = (message: string): never => {
  throw new KernelError("marker-mismatch", message, { exit: 3 });
};

function synced(path: string, content: string, exclusive = false): void {
  const flags =
    constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | (exclusive ? constants.O_EXCL : constants.O_TRUNC);
  const fd = openSync(path, flags, 0o600);
  try {
    writeFileSync(fd, content);
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function syncDir(path: string): void {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function read(path: string): unknown {
  let fd = -1;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > 2 * 1024 * 1024) return null;
    const buffer = Buffer.alloc(st.size + 1);
    const n = readSync(fd, buffer, 0, buffer.length, 0);
    return n > st.size ? null : JSON.parse(buffer.subarray(0, n).toString("utf8"));
  } catch {
    return null;
  } finally {
    if (fd >= 0) closeSync(fd);
  }
}

type Journal = z.infer<typeof Journal>;
interface Scope {
  dir: string;
  root: { dev: number; ino: number };
  at: (name: string) => string;
  clock: Clock;
  rand: Random;
  bookkeeping: (name: string) => boolean;
}

function matches(path: string, e: { dev: number; ino: number }): boolean {
  try {
    const st = lstatSync(path);
    return !st.isSymbolicLink() && st.dev === e.dev && st.ino === e.ino;
  } catch {
    return false;
  }
}

/** Journals of an earlier, unfinished quarantine of this directory. */
function earlierJournals(s: Scope, owned: () => boolean): { name: string; record: Journal }[] {
  return readdirSync(s.dir)
    .filter((name) => name.startsWith(QUARANTINE_JOURNAL))
    .flatMap((name) => {
      const record = Journal.safeParse(read(s.at(name)));
      if (!record.success && !existsSync(s.at(name)) && owned()) return []; // another opener published and cleaned it
      if (!record.success) refuse("an invalid quarantine journal was left untouched");
      return record.data!.marker.dev === s.root.dev && record.data!.marker.ino === s.root.ino
        ? [{ name, record: record.data! }]
        : [];
    });
}

/** Write the journal that names every imported entry before any of them moves. */
function startJournal(s: Scope): { journal: Journal; journalName: string } {
  const nonce = s.rand.base32(12);
  const names = readdirSync(s.dir).filter((name) => !s.bookkeeping(name));
  if (names.length > 10000) refuse("too many imported entries to quarantine in one bounded journal");
  const entries = names.map((name) => {
    const st = lstatSync(s.at(name));
    return { name, dev: st.dev, ino: st.ino };
  });
  const marker = {
    workspaceId: `ws_${s.rand.base32(10)}`,
    tag: s.rand.base32(4),
    nonce,
    schema: SCHEMA_VERSION,
    dev: s.root.dev,
    ino: s.root.ino,
  };
  const journal: Journal = { marker, path: `quarantine-${s.clock.now().slice(0, 10)}-${nonce}`, phase: "moving", entries };
  const journalName = `${QUARANTINE_JOURNAL}${nonce}`;
  const temp = s.at(`quarantine-journal-${nonce}.tmp`);
  synced(temp, JSON.stringify(journal), true);
  renameSync(temp, s.at(journalName));
  syncDir(s.dir);
  return { journal, journalName };
}

function checkJournal(s: Scope, journal: Journal, journalName: string): void {
  if (journalName !== `${QUARANTINE_JOURNAL}${journal.marker.nonce}` || !journal.path.endsWith(journal.marker.nonce)) {
    refuse("the quarantine journal identity is invalid");
  }
  const sourceNames = journal.entries.map((e) => e.name);
  if (
    new Set(sourceNames).size !== sourceNames.length ||
    sourceNames.some((name) => name === journalName || name === journal.path || s.bookkeeping(name))
  ) {
    refuse("the quarantine journal contains duplicate or reserved source entries");
  }
}

function ensureTarget(target: string): void {
  try {
    mkdirSync(target, { mode: 0o700 });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
  }
  if (!lstatSync(target).isDirectory()) refuse("the quarantine destination is not a directory");
}

/** Move each journaled entry that is still where it was, then record the phase as moved. */
function moveEntries(s: Scope, journal: Journal, journalName: string): Journal {
  const target = s.at(journal.path);
  for (const entry of journal.entries) {
    const from = s.at(entry.name);
    const to = s.at(`${journal.path}/${entry.name}`);
    if (matches(to, entry) && !existsSync(from)) continue;
    if (!matches(from, entry) || existsSync(to))
      refuse("an imported entry changed during quarantine; no existing destination was overwritten");
    renameSync(from, to);
    syncDir(target);
    syncDir(s.dir);
  }
  const allowed = new Set([journalName, journal.path]);
  if (readdirSync(s.dir).some((name) => !allowed.has(name) && !s.bookkeeping(name))) {
    refuse("new entries appeared during quarantine; no fresh authority was published");
  }
  const moved: Journal = { ...journal, phase: "moved" };
  const temp = s.at(`quarantine-journal-${s.rand.base32(12)}.tmp`);
  synced(temp, JSON.stringify(moved), true);
  renameSync(temp, s.at(journalName));
  syncDir(s.dir);
  return moved;
}

/** Publish the fresh marker once, or confirm an earlier attempt published the same one. */
function publishMarker(s: Scope, journal: Journal): void {
  const marker = s.at("marker");
  if (existsSync(marker)) {
    const prior = Marker.safeParse(read(marker));
    if (!prior.success || JSON.stringify(prior.data) !== JSON.stringify(journal.marker)) {
      refuse("the fresh marker differs from the quarantine journal");
    }
    return;
  }
  const temp = s.at(`quarantine-marker-${s.rand.base32(12)}.tmp`);
  synced(temp, JSON.stringify(journal.marker), true);
  try {
    linkSync(temp, marker);
    syncDir(s.dir);
  } finally {
    rmSync(temp, { force: true });
  }
}

/** Recheck ownership under a stable bootstrap lock, so a waiting opener cannot quarantine freshly published state. */
export async function quarantine(
  dir: string,
  clock: Clock,
  rand: Random,
  at: (name: string) => string,
  owned: () => boolean,
  locked: <T>(fn: () => T) => Promise<T>,
): Promise<Quarantined | undefined> {
  return locked(() => {
    const root = lstatSync(dir);
    const bootstrap = `quarantine-bootstrap-${root.dev}-${root.ino}.lock`;
    const s: Scope = {
      dir,
      root,
      at,
      clock,
      rand,
      bookkeeping: (name) => name === bootstrap || name.startsWith(`${bootstrap}.`),
    };
    const records = earlierJournals(s, owned);
    if (records.length > 1) refuse("several quarantine journals claim this directory; no authority was published");
    if (!records.length && owned()) return undefined;
    const begun = records[0] ? { journal: records[0].record, journalName: records[0].name } : startJournal(s);
    let { journal } = begun;
    checkJournal(s, journal, begun.journalName);
    ensureTarget(at(journal.path));
    if (journal.phase === "moving") journal = moveEntries(s, journal, begun.journalName);
    if (!journal.entries.every((entry) => matches(at(`${journal.path}/${entry.name}`), entry))) {
      refuse("a quarantined entry no longer matches the journal");
    }
    publishMarker(s, journal);
    return { path: journal.path, nonce: journal.marker.nonce, entries: journal.entries.length };
  });
}
