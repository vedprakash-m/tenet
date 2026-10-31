// The filesystem Store (TS §7): one state document replaced atomically, a transaction lock with guarded stale-break,
// an append-only log with torn-write repair, hash-named blobs and the workspace marker.
import { accessSync, chmodSync, closeSync, constants, existsSync, fchmodSync, fstatSync, fsyncSync, ftruncateSync, readdirSync, linkSync, lstatSync, mkdirSync, openSync, readSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isUtf8 } from "node:buffer";
import { join, relative, sep } from "node:path";
import { z } from "zod";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import type { Random } from "../core/ids.ts";
import { SCHEMA_VERSION, State } from "../core/schemas.ts";
import { accountingCheckpoint, recoverAccounting } from "../core/budget.ts";
import { addMonths, reduceJournal } from "../core/journal-reduce.ts";
import type { Months } from "../core/journal-reduce.ts";
import { recoveredState } from "../core/state.ts";
import { schemaStatus } from "../core/versions.ts";
import type { Clock, EvictReport, Footprint, LogEntry, Quarantined, Store, Tx } from "../ports/types.ts";
import { isAlive, procStart } from "./proc.ts";
import { quarantine, QUARANTINE_JOURNAL } from "./quarantine-fs.ts";

interface Marker { workspaceId: string; tag: string; nonce: string; schema: number; dev: number; ino: number }
interface LockInfo { pid: number; procStart: string; nonce: string; verb: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_RECORD = 50 * 1024 * 1024;
const LogBase = z.object({ t: z.string().min(1) });
const LogRecord = z.discriminatedUnion("kind", [
  LogBase.extend({ kind: z.literal("intent"), effect: z.string().min(1), id: z.string().min(1), op: z.unknown() }).passthrough(),
  LogBase.extend({ kind: z.literal("result"), effect: z.string().min(1), id: z.string().min(1), outcome: z.unknown() }).passthrough(),
  LogBase.extend({ kind: z.literal("call"), verb: z.string().min(1), exit: z.number().int().min(0).max(5),
    revision: z.number().int().nonnegative() }).passthrough(),
  LogBase.extend({ kind: z.literal("accounting") }).passthrough(),
]);

function parseRecord(text: string): unknown {
  const parsed: unknown = JSON.parse(text);
  const pending: Array<[unknown, number]> = [[parsed, 0]];
  while (pending.length) {
    const [value, depth] = pending.pop()!;
    if (depth > 64) throw new KernelError("unsupported-record", "a private record exceeds the depth bound");
    if (value && typeof value === "object") for (const item of Object.values(value)) pending.push([item, depth + 1]);
  }
  return parsed;
}

function readJournal(text: string): { entries: LogEntry[]; keep: number } {
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

function readRecord(path: string, journal = false, corruptAsNull = false): string | null {
  let descriptor = -1;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(descriptor);
    if (!info.isFile() || info.size > MAX_RECORD) {
      throw new KernelError("unsupported-record", "a private record is not a regular file within the 50 MB bound");
    }
    const buffer = Buffer.alloc(info.size + 1);
    let offset = 0;
    while (offset < buffer.length) {
      const count = readSync(descriptor, buffer, offset, buffer.length - offset, offset);
      if (!count) break;
      offset += count;
    }
    const after = fstatSync(descriptor);
    if (offset !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs) {
      throw new KernelError("unsupported-record", "a private record changed during its bounded read");
    }
    const content = buffer.subarray(0, offset);
    if (!isUtf8(journal ? content.subarray(0, content.lastIndexOf(0x0a) + 1) : content)) {
      if (corruptAsNull) return null;
      throw new KernelError("unsupported-record", "a private record contains invalid UTF-8");
    }
    return content.toString("utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof KernelError) throw error;
    throw new KernelError("unsupported-record", "a private record cannot be read safely");
  } finally { if (descriptor >= 0) closeSync(descriptor); }
}

const readJson = <T>(p: string): T | null => {
  try {
    const text = readRecord(p);
    return text === null ? null : parseRecord(text) as T;
  } catch { return null; }
};

function admissionRecord(path: string, marker = false): unknown {
  try {
    const text = readRecord(path, false, true);
    return text === null ? null : parseRecord(text);
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    if (marker) throw new KernelError("marker-mismatch", "the ownership marker cannot be read safely");
    throw new KernelError("unsupported-record", `unsupported private record: ${error instanceof Error ? error.message : "unsafe read"}`);
  }
}

function fsyncDir(dir: string) {
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeSynced(path: string, data: string) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600);
  try {
    if (!fstatSync(fd).isFile()) throw new KernelError("unsupported-record", "private writes require a regular file");
    fchmodSync(fd, 0o600); ftruncateSync(fd, 0); writeFileSync(fd, data); fsyncSync(fd);
  } finally { closeSync(fd); }
}

/** The latest modification time anywhere under a folder, so a folder with recently used packets is never called stale. */
function newestMtime(path: string): number {
  let newest = 0;
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      const st = lstatSync(join(dir, n));
      newest = Math.max(newest, st.mtimeMs);
      if (st.isDirectory()) walk(join(dir, n));
    }
  };
  try { newest = lstatSync(path).mtimeMs; walk(path); } catch { /* unreadable: the folder's own time stands */ }
  return newest;
}

/** Storage limits (PRD §4.4.3, TS §7.6); tests lower them, and `afterSummaries` is a crash seam for the reduction. */
export interface StoreOptions {
  lockWaitMs?: number; compactAtBytes?: number; ceilingBytes?: number; reserveBytes?: number; runFileCapBytes?: number;
  journalDays?: number; afterSummaries?: () => void;
}

export class FsStore implements Store {
  readonly dir: string;
  private root: string;
  private clock: Clock;
  private rand: Random;
  private lockWaitMs: number;
  private quarantined?: Quarantined;
  private opts: StoreOptions;

  constructor(root: string, clock: Clock, rand: Random, opts: StoreOptions = {}) {
    this.opts = opts;
    this.root = root;
    this.dir = join(root, ".tenet");
    this.clock = clock;
    this.rand = rand;
    this.lockWaitMs = opts.lockWaitMs ?? 3000;
  }

  private p(f: string): string {
    if (f.startsWith("/") || f.split("/").includes("..")) throw new KernelError("unsupported-record", "invalid state path");
    let path = this.dir;
    for (const part of ["", ...f.split("/")]) {
      path = part ? join(path, part) : path;
      try {
        if (lstatSync(path).isSymbolicLink()) throw new KernelError("marker-mismatch", "a link inside .tenet is not permitted");
      } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
    }
    return path;
  }

  exists(): boolean { return existsSync(this.p("marker")); }

  admit(): void {
    const marker = admissionRecord(this.p("marker"), true) as Marker | null;
    const here = lstatSync(this.dir, { throwIfNoEntry: false });
    if (!marker || !here || marker.dev !== here.dev || marker.ino !== here.ino) return;
    const blocked = () => { throw new KernelError("unsupported-record", "owned state needs a compatible kernel; nothing was changed"); };
    if (marker.schema !== SCHEMA_VERSION) blocked();
    for (const name of ["migration-transition.json", "migration-privacy.json"]) {
      if (lstatSync(this.p(name), { throwIfNoEntry: false })) blocked();
    }
    for (const name of ["state", "state.prev"]) {
      const record = admissionRecord(this.p(name));
      if (schemaStatus(record, SCHEMA_VERSION) === "unsupported") blocked();
    }
  }

  private marker(): Marker | null {
    const m = readJson<Marker>(this.p("marker"));
    if (!m || !/^ws_[a-z2-7]{10}$/.test(m.workspaceId) || !/^[a-z0-9]{4}$/.test(m.tag) || m.schema !== SCHEMA_VERSION || !m.nonce) {
      throw new KernelError("marker-mismatch", "the ownership marker is invalid");
    }
    const st = statSync(this.dir);
    // A copied directory has a new inode: its contents are inert (quarantine decision, TS §7.5).
    if (m.dev !== st.dev || m.ino !== st.ino) {
      throw new KernelError("marker-mismatch", "this .tenet directory was copied or moved from elsewhere");
    }
    return m;
  }

  read(): { state: State; recovered: boolean } | null {
    this.admit();
    if (!this.exists()) return null;
    this.marker();
    for (const [file, recovered] of [["state", false], ["state.prev", true]] as const) {
      const raw = readJson<unknown>(this.p(file));
      const parsed = raw ? State.safeParse(raw) : null;
      if (parsed?.success) {
        const m = this.marker()!;
        if (parsed.data.workspaceId !== m.workspaceId || parsed.data.tag !== m.tag) {
          throw new KernelError("marker-mismatch", "the state belongs to another workspace");
        }
        const records = this.readLog();
        const state = recovered ? recoveredState(parsed.data, this.clock.now(), records) : recoverAccounting(parsed.data, records).state;
        return { state, recovered };
      }
    }
    if (!existsSync(this.p("state"))) return null; // marker written, first state not yet published
    throw new KernelError("unsupported-record", "the state document cannot be read and no previous revision exists");
  }

  // ------------------------------------------------------------ lock
  private async acquire(verb: string): Promise<LockInfo> {
    this.admit();
    this.p("marker"); // refuse even a dangling directory link before creating anything
    try {
      mkdirSync(this.dir, { mode: 0o700 });
      this.ensureMarker();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    let trusted = false;
    try {
      trusted = !!this.marker();
    } catch (e) {
      if (!(e instanceof KernelError) || e.reasons[0]?.code !== "marker-mismatch") throw e;
    }
    const here = lstatSync(this.dir);
    if (!trusted || readdirSync(this.dir).some((name) => name.startsWith(QUARANTINE_JOURNAL))) {
      if (verb !== "open") throw new KernelError("marker-mismatch", "this ownership marker needs quarantine; open a fresh contract first", { exit: 3 });
      const bootstrap = `quarantine-bootstrap-${here.dev}-${here.ino}.lock`;
      const isOwned = () => {
        try { return !!this.marker(); }
        catch { return false; }
      };
      this.quarantined = await quarantine(this.dir, this.clock, this.rand, (name) => this.p(name), isOwned, async (fn) => {
        const lock = await this.claim("quarantine", bootstrap);
        try { this.admit(); chmodSync(this.dir, 0o700); return fn(); }
        finally { this.release(lock, bootstrap); }
      });
    }
    this.admit();
    return this.claim(verb);
  }

  private async claim(verb: string, name = "lock"): Promise<LockInfo> {
    this.admit();
    const me: LockInfo = { ...this.self(), nonce: this.rand.base32(12), verb };
    const tmp = this.p(`${name}.${me.nonce}`);
    writeSynced(tmp, JSON.stringify(me));
    const deadline = Date.now() + this.lockWaitMs;
    try {
      for (;;) {
        this.admit();
        try { linkSync(tmp, this.p(name)); return me; } // atomic exclusive create with complete content
        catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        const held = this.readLock(name);
        if (Date.now() > deadline) throw new KernelError("kernel-busy", held ? `held by ${held.verb} (pid ${held.pid})` : undefined);
        if (held && !isAlive(held.pid, held.procStart)) await this.breakStale(held, me, name);
        else await sleep(15 + Math.floor(Math.random() * 25));
      }
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  /** Guarded break: no fresh lock can exist while the stale one does, so two breakers never remove a live lock. */
  private async breakStale(dead: LockInfo, me: LockInfo, name = "lock"): Promise<void> {
    this.admit();
    const guard = this.p(`${name}.break`);
    try {
      const g = this.p(`${name}.break.${me.nonce}`);
      writeSynced(g, JSON.stringify(me));
      try { linkSync(g, guard); } finally { rmSync(g, { force: true }); }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const other = this.readLock(`${name}.break`);
      // A dead guard is never broken automatically: its owner died mid-break (TS §7.3).
      if (other && !isAlive(other.pid, other.procStart)) throw new KernelError("lock-recovery-needed");
      await sleep(20);
      return;
    }
    try {
      const now = this.readLock(name);
      this.admit();
      if (now && now.nonce === dead.nonce) unlinkSync(this.p(name));
    } finally {
      rmSync(guard, { force: true });
    }
  }

  private release(me: LockInfo, name = "lock") {
    const held = this.readLock(name);
    if (held?.nonce === me.nonce) rmSync(this.p(name), { force: true });
  }

  async repairLock(): Promise<{ removed: string[] }> {
    this.admit();
    const dead: Record<string, LockInfo> = {};
    for (const f of ["lock", "lock.break"]) {
      const h = this.readLock(f);
      if (h && isAlive(h.pid, h.procStart)) throw new KernelError("kernel-busy", `${f} is held by a live process`);
      if (h) dead[f] = h;
    }
    const removed: string[] = [];
    // Re-read each file immediately before removing it rather than trusting the check above: if a fresh claim
    // landed between the two loops, its nonce differs from the one just confirmed dead, and it is left alone
    // (the same guard `breakStale` uses), so a manual repair can never remove a live process's lock (AGT-08).
    for (const f of ["lock", "lock.break"]) {
      const was = dead[f];
      if (!was) continue;
      const now = this.readLock(f);
      this.admit();
      if (now && now.nonce === was.nonce) { rmSync(this.p(f)); removed.push(f); }
    }
    return { removed };
  }

  private readLock(name: string): LockInfo | null {
    const h = readJson<LockInfo>(this.p(name));
    if (!h && !existsSync(this.p(name))) return null;
    if (!h || !Number.isSafeInteger(h.pid) || h.pid < 1 || typeof h.procStart !== "string" || !h.procStart.trim() || typeof h.nonce !== "string" || !h.nonce || typeof h.verb !== "string") throw new KernelError("lock-recovery-needed", "the lock has no trusted process identity; it was not removed");
    return h;
  }

  // ------------------------------------------------------------ transaction
  async transaction<T>(verb: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const me = await this.acquire(verb);
    try {
      this.admit();
      chmodSync(this.dir, 0o700);
      for (const name of ["marker", "state", "state.prev", "log"]) {
        if (existsSync(this.p(name))) chmodSync(this.p(name), 0o600);
      }
      if (!existsSync(this.p(".gitignore"))) writeFileSync(this.p(".gitignore"), "*\n");
      this.repairLogTail();
      const read = this.exists() ? this.read() : null;
      if (this.quarantined && read?.state.quarantine?.nonce === this.quarantined.nonce) this.finishQuarantine();
      const store = this;
      let published = read?.state ?? null;
      const tx: Tx = {
        get state() { return published; },
        recovered: read?.recovered ?? false,
        ...(this.quarantined ? { quarantined: this.quarantined } : {}),
        ensure: () => store.ensureMarker(),
        publish: (next) => { published = store.publishState(next); },
        call: (entry) => store.append({ kind: "call", ...entry }),
        intent: (effect, id, op) => store.append({ kind: "intent", effect, id, op }),
        result: (effect, id, outcome) => store.append({ kind: "result", effect, id, outcome }),
        unresolved: () => store.unresolved(),
        evict: (keep) => store.evict(keep),
        recent: (n) => { const log = store.readLog(); return n === undefined ? log : log.slice(-n); },
      };
      return await fn(tx);
    } finally {
      this.release(me);
    }
  }

  private ensureMarker(): { workspaceId: string; tag: string } {
    this.admit();
    const existing = this.exists() ? this.marker() : null;
    if (existing) return existing;
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    const st = statSync(this.dir);
    const m: Marker = { workspaceId: `ws_${this.rand.base32(10)}`, tag: this.rand.base32(4), nonce: this.rand.base32(12), schema: SCHEMA_VERSION, dev: st.dev, ino: st.ino };
    writeSynced(this.p("marker"), JSON.stringify(m));
    fsyncDir(this.dir);
    return m;
  }

  private publishState(next: State) {
    const current = this.exists() ? this.read()?.state : undefined;
    const doc = State.parse({ ...next, revision: (current?.revision ?? 0) + 1 });
    if (doc.workSeq || doc.generationSeq) this.append(accountingCheckpoint(doc, current));
    const tmp = this.p("state.tmp");
    writeSynced(tmp, JSON.stringify(doc));
    if (existsSync(this.p("state"))) {
      rmSync(this.p("state.prev.tmp"), { force: true });
      linkSync(this.p(this.read()?.recovered ? "state.prev" : "state"), this.p("state.prev.tmp"));
      renameSync(this.p("state.prev.tmp"), this.p("state.prev"));
    }
    if ((this.read()?.state.revision ?? 0) !== (current?.revision ?? 0)) throw new KernelError("revision-conflict");
    renameSync(tmp, this.p("state"));
    fsyncDir(this.dir);
    if (this.quarantined && doc.quarantine?.nonce === this.quarantined.nonce) this.finishQuarantine();
    return doc;
  }

  private finishQuarantine() {
    rmSync(this.p(`${QUARANTINE_JOURNAL}${this.quarantined!.nonce}`), { force: true });
    fsyncDir(this.dir); this.quarantined = undefined;
  }

  // ------------------------------------------------------------ log
  private repairLogTail() {
    this.admit();
    const path = this.p("log");
    const text = readRecord(path, true);
    if (!text) return;
    const { keep } = readJournal(text);
    if (keep !== text.length) writeSynced(path, text.slice(0, keep));
  }

  private append(entry: Omit<LogEntry, "t">) {
    this.admit();
    const serialized = `${JSON.stringify({ t: this.clock.now(), ...entry })}\n`;
    const bytes = Buffer.byteLength(serialized, "utf8");
    if (bytes > MAX_RECORD) throw new KernelError("unsupported-record", "a journal entry exceeds the 50 MB record bound");
    readJournal(serialized);
    const flags = constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW | constants.O_NONBLOCK;
    const fd = openSync(this.p("log"), flags, 0o600);
    try {
      const info = fstatSync(fd);
      if (!info.isFile()) throw new KernelError("unsupported-record", "the journal is not a regular file");
      if (info.size + bytes > MAX_RECORD) throw new KernelError("storage-protected-full", "the journal reached its record bound");
      writeFileSync(fd, serialized);
      fsyncSync(fd);
    } finally { closeSync(fd); }
  }

  readLog(): LogEntry[] {
    return readJournal(readRecord(this.p("log"), true) ?? "").entries;
  }

  private unresolved() {
    const log = this.readLog();
    const done = new Set(log.filter((e) => e.kind === "result").map((e) => JSON.stringify([e.effect, e.id])));
    return log.filter((e) => e.kind === "intent" && !done.has(JSON.stringify([e.effect, e.id]))).map((e) => ({ effect: e.effect!, id: e.id!, op: e.op }));
  }

  // ------------------------------------------------------------ blobs and temp
  putBlob(content: string): string {
    this.admit();
    if (Buffer.byteLength(content, "utf8") > MAX_RECORD) {
      throw new KernelError("unsupported-record", "a blob exceeds the 50 MB record bound");
    }
    const h = sha256(content);
    mkdirSync(this.p("blobs"), { recursive: true, mode: 0o700 });
    if (this.readBlob(h) === null) writeSynced(this.p(`blobs/${h}`), content);
    return h;
  }
  readBlob(hash: string): string | null {
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new KernelError("unsupported-record", "invalid blob hash");
    const content = readRecord(this.p(`blobs/${hash}`));
    if (content !== null && sha256(content) !== hash) throw new KernelError("unsupported-record", "blob hash mismatch");
    return content;
  }

  tempDir(name: string): string {
    this.admit();
    const m = this.exists() ? this.marker() : null;
    if (name.startsWith("/") || name.split("/").some(p => !p || p === "." || p === "..")) throw new KernelError("run-dir-unavailable", "invalid temp directory name");
    let dir = tmpdir();
    for (const part of [`tenet-${m?.workspaceId ?? "unbound"}`, ...name.split("/")]) {
      dir = join(dir, part);
      try {
        try { mkdirSync(dir, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        const st = lstatSync(dir);
        if (st.isSymbolicLink() || !st.isDirectory()) throw new Error("temp storage contains a link or non-directory");
        chmodSync(dir, 0o700);
      } catch (e) { throw new KernelError("run-dir-unavailable", String(e)); }
    }
    return dir;
  }

  async alive(pid: number, start: string): Promise<boolean> { return isAlive(pid, start); }
  self() {
    const start = procStart(process.pid);
    if (!start) throw new KernelError("capability-missing", "this process's start identity cannot be inspected; no transaction lock was acquired", { exit: 2 });
    return { pid: process.pid, procStart: start };
  }
  writeArtifact(dir: string, name: string, content: string): string {
    this.admit();
    if (!name || name.includes("/") || name === "." || name === "..") throw new KernelError("run-dir-unavailable", "invalid artifact name");
    const id = this.exists() ? this.marker()!.workspaceId : "unbound";
    const rel = relative(join(tmpdir(), `tenet-${id}`), dir);
    const path = join(this.tempDir(rel), name);
    writeSynced(path, content);
    return path;
  }
  sweepTemp(maxAgeMs: number, keep: readonly string[]): number {
    const base = this.tempBase();
    if (!base) return 0;
    let removed = 0;
    const old = (p: string) => { try { return Date.now() - lstatSync(p).mtimeMs > maxAgeMs; } catch { return false; } };
    for (const group of ["", "manifests", "review"]) {
      const dir = group ? join(base, group) : base;
      let names: string[] = [];
      try {
        if (!lstatSync(dir).isDirectory()) continue;
        names = readdirSync(dir);
      } catch { continue; }
      for (const n of names) {
        const p = join(dir, n);
        if ((group === "" && !n.startsWith("run-")) || keep.some((k) => k === p || k.startsWith(`${p}${sep}`))) continue;
        if (old(p)) { rmSync(p, { recursive: true, force: true }); removed++; }
      }
    }
    return removed;
  }
  // ------------------------------------------------------------ eviction (CON-08, specs/storage-retention.md v2)
  private replaceSynced(path: string, data: string) {
    this.admit();
    writeSynced(`${path}.tmp`, data);
    renameSync(`${path}.tmp`, path);
    fsyncDir(this.dir);
  }
  private prevRevision(): number | null {
    try { return State.parse(JSON.parse(readRecord(this.p("state.prev")) ?? "null")).revision; } catch { return null; }
  }
  /** Old journal records become monthly counts in summaries.json, written first and keyed by the journal they came from. */
  private reduceLog(nowMs: number): string | undefined {
    const text = readRecord(this.p("log"), true) ?? "";
    if (Buffer.byteLength(text) < (this.opts.compactAtBytes ?? 5 * 1024 * 1024)) return undefined;
    const revision = this.read()?.state.revision ?? 0;
    const protectFromRevision = Math.min(revision, this.prevRevision() ?? revision);
    const reduced = (() => {
      try { readJournal(text); return reduceJournal(text, { nowMs, days: this.opts.journalDays ?? 90, protectFromRevision }); } catch { return null; }
    })();
    if (!reduced) return "The journal was left untouched: it holds a record this kernel does not recognize.";
    if (!reduced.removed) return undefined;
    const from = sha256(text);
    let prior: { from?: string; months?: Months } = {};
    try { prior = JSON.parse(readRecord(this.p("summaries.json")) ?? "{}"); } catch { /* a damaged file is rebuilt from this reduction */ }
    const months = prior.from === from ? (prior.months ?? {}) : addMonths(prior.months ?? {}, reduced.months);
    this.replaceSynced(this.p("summaries.json"), JSON.stringify({ version: 1, from, months }));
    this.opts.afterSummaries?.();
    this.replaceSynced(this.p("log"), reduced.text);
    return `Reduced the journal: ${reduced.removed} records older than 90 days are now monthly counts (summaries.json); `
      + "unresolved effects and recent history are kept.";
  }
  /** Oldest run folders first, by newest file time, until the cap holds; folders in `keep` stay. */
  private capRunFiles(keep: readonly string[]): string | undefined {
    const base = this.tempBase();
    if (!base) return undefined;
    const entries = ["", "manifests", "review"].flatMap((g) => {
      const dir = g ? join(base, g) : base;
      try {
        if (!lstatSync(dir).isDirectory()) return [];
        return readdirSync(dir).filter((n) => g || n.startsWith("run-")).map((n) => join(dir, n));
      } catch { return []; }
    }).map((path) => ({ path, bytes: this.sizeOf(path), at: newestMtime(path) })).sort((a, b) => a.at - b.at);
    let total = entries.reduce((n, e) => n + e.bytes, 0), removed = 0;
    const cap = this.opts.runFileCapBytes ?? 200 * 1024 * 1024;
    for (const e of entries) {
      if (total <= cap) break;
      if (keep.some((k) => k === e.path || k.startsWith(`${e.path}${sep}`))) continue;
      rmSync(e.path, { recursive: true, force: true }); total -= e.bytes; removed++;
    }
    return removed ? `Removed ${removed} old run folder(s): run files were over their cap.` : undefined;
  }
  evict(keep: readonly string[]): EvictReport {
    this.admit();
    const notes = [this.reduceLog(Date.parse(this.clock.now())), this.capRunFiles(keep)].filter((x): x is string => !!x);
    let classes: Array<{ name: string; bytes: number }> = [];
    try { classes = readdirSync(this.dir).map((name) => ({ name, bytes: this.sizeOf(join(this.dir, name)) })).sort((a, b) => b.bytes - a.bytes); } catch { /* no store yet */ }
    const total = classes.reduce((n, c) => n + c.bytes, 0);
    const overCeiling = total > (this.opts.ceilingBytes ?? 50 * 1024 * 1024) - (this.opts.reserveBytes ?? 5 * 1024 * 1024);
    return { ...(notes.length ? { message: notes.join(" ") } : {}), overCeiling, largest: classes.slice(0, 3) };
  }
  private sizeOf(path: string): number {
    try {
      const st = lstatSync(path);
      return st.isDirectory() ? readdirSync(path).reduce((n, f) => n + this.sizeOf(join(path, f)), 0) : st.size;
    } catch { return 0; }
  }
  residue(): { tenet: Footprint | null; temp: Footprint | null } {
    const measure = (path: string): Footprint | null => {
      let files = 0, bytes = 0;
      const walk = (dir: string) => {
        for (const n of readdirSync(dir)) {
          const st = lstatSync(join(dir, n));
          if (st.isDirectory()) walk(join(dir, n)); else { files++; bytes += st.size; }
        }
      };
      try { if (!lstatSync(path).isDirectory()) return null; walk(path); } catch { return null; }
      return { path, files, bytes };
    };
    return { tenet: measure(this.dir), temp: this.exists() ? measure(join(tmpdir(), `tenet-${this.marker()!.workspaceId}`)) : null };
  }
  cleanTemp(scope: "project" | "machine", minAgeMs: number, remove: boolean): { removed: string[]; kept: string[] } {
    this.admit();
    const own = this.exists() ? `tenet-${this.marker()!.workspaceId}` : null;
    const named = scope === "project"
      ? (own ? [own] : [])
      : (() => { try { return readdirSync(tmpdir()).filter((n) => /^tenet-ws_[a-z0-9]+$/.test(n)); } catch { return []; } })();
    const out = { removed: [] as string[], kept: [] as string[] };
    for (const n of named) {
      const p = join(tmpdir(), n);
      try {
        const st = lstatSync(p);
        if (!st.isDirectory()) continue;
        if (n !== own) { out.kept.push(p); continue; }
        if (Date.now() - newestMtime(p) < minAgeMs) { out.kept.push(p); continue; }
        if (remove) rmSync(p, { recursive: true, force: true });
        out.removed.push(p);
      } catch { /* gone or unreadable: nothing of ours to remove */ }
    }
    return out;
  }
  purge(texts: readonly string[]): number {
    const base = this.tempBase();
    const needles = texts.filter((t) => t.length > 0);
    if (!base || !needles.length) return 0;
    let removed = 0;
    const visit = (dir: string) => {
      let names: string[] = [];
      try { names = readdirSync(dir); }
      catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return; throw e; }
      for (const n of names) {
        const p = join(dir, n);
        try {
          const st = lstatSync(p);
          if (st.isDirectory()) visit(p);
          else if (st.isFile()) {
            const text = readRecord(p);
            if (text && needles.some((t) => text.includes(t))) {
              rmSync(p, { force: true });
              removed++;
            }
          }
        } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      }
    };
    const manifests = join(base, "manifests");
    if (lstatSync(manifests, { throwIfNoEntry: false })?.isDirectory()) visit(manifests);
    return removed;
  }
  private tempBase(): string | null {
    this.admit();
    try {
      if (!this.exists()) return null;
      const base = join(tmpdir(), `tenet-${this.marker()!.workspaceId}`);
      return lstatSync(base).isDirectory() ? base : null;
    } catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return null; throw e; }
  }
  canWrite(): boolean { try { accessSync(this.root, constants.W_OK); return true; } catch { return false; } }
}
