// Copied records are inert. Journal every move before acting and resume only against the same directory identities.
import { closeSync, constants, existsSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
        name: z.string().min(1).max(255).refine((n) => !n.includes("/") && n !== "." && n !== ".."),
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
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | (exclusive ? constants.O_EXCL : constants.O_TRUNC);
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
    const bookkeeping = (name: string) => name === bootstrap || name.startsWith(`${bootstrap}.`);
    const records = readdirSync(dir)
      .filter((name) => name.startsWith(QUARANTINE_JOURNAL))
      .flatMap((name) => {
        const record = Journal.safeParse(read(at(name)));
        if (!record.success && !existsSync(at(name)) && owned()) return []; // another opener published and cleaned it
        if (!record.success) refuse("an invalid quarantine journal was left untouched");
        return record.data!.marker.dev === root.dev && record.data!.marker.ino === root.ino ? [{ name, record: record.data! }] : [];
      });
    if (records.length > 1) refuse("several quarantine journals claim this directory; no authority was published");
    if (!records.length && owned()) return undefined;
    let journal: z.infer<typeof Journal>;
    let journalName: string;
    if (records[0]) {
      journal = records[0].record;
      journalName = records[0].name;
    } else {
      const nonce = rand.base32(12);
      const names = readdirSync(dir).filter((name) => !bookkeeping(name));
      if (names.length > 10000) refuse("too many imported entries to quarantine in one bounded journal");
      const entries = names.map((name) => {
        const st = lstatSync(at(name));
        return { name, dev: st.dev, ino: st.ino };
      });
      const marker = { workspaceId: `ws_${rand.base32(10)}`, tag: rand.base32(4), nonce, schema: SCHEMA_VERSION, dev: root.dev, ino: root.ino };
      journal = { marker, path: `quarantine-${clock.now().slice(0, 10)}-${nonce}`, phase: "moving", entries };
      journalName = `${QUARANTINE_JOURNAL}${nonce}`;
      const temp = at(`quarantine-journal-${nonce}.tmp`);
      synced(temp, JSON.stringify(journal), true);
      renameSync(temp, at(journalName));
      syncDir(dir);
    }
    if (journalName !== `${QUARANTINE_JOURNAL}${journal.marker.nonce}` || !journal.path.endsWith(journal.marker.nonce)) {
      refuse("the quarantine journal identity is invalid");
    }
    const sourceNames = journal.entries.map((e) => e.name);
    if (new Set(sourceNames).size !== sourceNames.length || sourceNames.some((name) => name === journalName || name === journal.path || bookkeeping(name))) {
      refuse("the quarantine journal contains duplicate or reserved source entries");
    }
    const target = at(journal.path);
    try {
      mkdirSync(target, { mode: 0o700 });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    if (!lstatSync(target).isDirectory()) refuse("the quarantine destination is not a directory");
    const matches = (path: string, e: { dev: number; ino: number }) => {
      try {
        const st = lstatSync(path);
        return !st.isSymbolicLink() && st.dev === e.dev && st.ino === e.ino;
      } catch {
        return false;
      }
    };
    if (journal.phase === "moving") {
      for (const entry of journal.entries) {
        const from = at(entry.name);
        const to = at(`${journal.path}/${entry.name}`);
        if (matches(to, entry) && !existsSync(from)) continue;
        if (!matches(from, entry) || existsSync(to)) refuse("an imported entry changed during quarantine; no existing destination was overwritten");
        renameSync(from, to);
        syncDir(target);
        syncDir(dir);
      }
      const allowed = new Set([journalName, journal.path]);
      if (readdirSync(dir).some((name) => !allowed.has(name) && !bookkeeping(name))) {
        refuse("new entries appeared during quarantine; no fresh authority was published");
      }
      journal = { ...journal, phase: "moved" };
      const temp = at(`quarantine-journal-${rand.base32(12)}.tmp`);
      synced(temp, JSON.stringify(journal), true);
      renameSync(temp, at(journalName));
      syncDir(dir);
    }
    if (!journal.entries.every((entry) => matches(at(`${journal.path}/${entry.name}`), entry))) {
      refuse("a quarantined entry no longer matches the journal");
    }
    const marker = at("marker");
    if (existsSync(marker)) {
      const prior = Marker.safeParse(read(marker));
      if (!prior.success || JSON.stringify(prior.data) !== JSON.stringify(journal.marker)) {
        refuse("the fresh marker differs from the quarantine journal");
      }
    } else {
      const temp = at(`quarantine-marker-${rand.base32(12)}.tmp`);
      synced(temp, JSON.stringify(journal.marker), true);
      try {
        linkSync(temp, marker);
        syncDir(dir);
      } finally {
        rmSync(temp, { force: true });
      }
    }
    return { path: journal.path, nonce: journal.marker.nonce, entries: journal.entries.length };
  });
}
