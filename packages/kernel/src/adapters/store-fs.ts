// The filesystem Store (TS §7): one state document replaced atomically, a transaction lock with guarded stale-break,
// an append-only log with torn-write repair, hash-named blobs and the workspace marker.
import { accessSync, chmodSync, closeSync, constants, existsSync, fstatSync, fsyncSync, readdirSync, linkSync, lstatSync, mkdirSync, openSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { AsyncLocalStorage } from "node:async_hooks";
import { dirname, isAbsolute, join, relative, sep } from "node:path";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import type { Random } from "../core/ids.ts";
import { LEGACY_SCHEMA_VERSIONS, parseStateRecord, SCHEMA_VERSION, State } from "../core/schemas.ts";
import { accountingCheckpoint, recoverAccounting } from "../core/budget.ts";
import { addMonths, reduceJournal } from "../core/journal-reduce.ts";
import type { Months } from "../core/journal-reduce.ts";
import { recoveredState } from "../core/state.ts";
import { schemaStatus } from "../core/versions.ts";
import { releasedStorage, reservedStorage } from "../core/storage-reservation.ts";
import type { Clock, EvictReport, Footprint, LogEntry, Quarantined, Store, Tx } from "../ports/types.ts";
import { isAlive, procStart } from "./proc.ts";
import { admissionRecord, MAX_RECORD, parseRecord, readJson, readRecord, readTerminal } from "./private-record-fs.ts";
import { quarantine, QUARANTINE_JOURNAL } from "./quarantine-fs.ts";
import {
  fsyncDirectory as fsyncDir, parsePrivate, readCommitProofs, readCompactionPending, readJournal, SummaryRecord,
  writeCommitProof, writeSyncedRecord as writeSynced,
} from "./store-records.ts";
import { newestMtime, recentWithStaged, stagedRunGrowth } from "./store-staging.ts";
import type { LockInfo, StagedWrite, WriteContext } from "./store-staging.ts";
import type { MigrationGuard } from "./marker-rollback.ts";
import type { CommitProofV1 } from "../core/commit-proof.ts";

interface Marker { workspaceId: string; tag: string; nonce: string; schema: number; dev: number; ino: number }
interface Journal { text: string; entries: LogEntry[]; keep: number }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Storage limits (PRD §4.4.3, TS §7.6); tests lower them, and `afterSummaries` is a crash seam for the reduction. */
export interface StoreOptions {
  lockWaitMs?: number; compactAtBytes?: number; ceilingBytes?: number; reserveBytes?: number; runFileCapBytes?: number;
  journalDays?: number; afterSummaries?: () => void; migrationGuard?: MigrationGuard;
}

export class FsStore implements Store {
  readonly dir: string;
  private root: string;
  private clock: Clock;
  private rand: Random;
  private lockWaitMs: number;
  private quarantined?: Quarantined;
  private opts: StoreOptions;
  // Admission verdicts for state and state.prev, keyed by file identity: a changed file is read and parsed again.
  private admitted = new Map<string, string>();
  // The record admission just parsed, handed once to the next read of that same file version so it is not parsed twice.
  private parsed = new Map<string, { id: string; value: unknown }>();
  private unseenJournal?: Journal;
  private writes = new AsyncLocalStorage<WriteContext>();

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
  authorizeMutation(verb: string, input: unknown): void {
    this.opts.migrationGuard?.authorize(verb, input);
  }
  history(): "absent" | "complete" | "uncertain" {
    this.admit();
    if (!this.exists()) return "absent";
    return this.read() && existsSync(this.p("log")) ? "complete" : "uncertain";
  }
  storageBytes(): number {
    const measured = this.measure(this.dir);
    if (measured.accounting !== "known") {
      throw new KernelError("storage-accounting-unknown", "Tenet storage cannot be measured safely");
    }
    return measured.bytes;
  }

  admit(): void {
    const blocked = () => { throw new KernelError("unsupported-record", "owned state needs a compatible kernel; nothing was changed"); };
    if (this.opts.migrationGuard) this.opts.migrationGuard.admit();
    else {
      const terminal = readTerminal(this.p("migration-terminal.json"));
      if (terminal && terminal.outcome !== "rolled-back") blocked();
    }
    const marker = admissionRecord(this.p("marker"), true) as Marker | null;
    const here = lstatSync(this.dir, { throwIfNoEntry: false });
    if (!marker || !here || marker.dev !== here.dev || marker.ino !== here.ino) return;
    if (!(LEGACY_SCHEMA_VERSIONS as readonly number[]).includes(marker.schema) && marker.schema !== SCHEMA_VERSION) blocked();
    for (const name of ["migration-transition.json", "migration-privacy.json"]) {
      if (lstatSync(this.p(name), { throwIfNoEntry: false })) blocked();
    }
    for (const name of ["state", "state.prev"]) {
      const id = this.fileId(name, true);
      if (id && this.admitted.get(name) === id) continue;
      const record = admissionRecord(this.p(name));
      const schema = record && typeof record === "object" && "schema" in record
        ? (record as { schema: unknown }).schema
        : undefined;
      if (record !== null && schemaStatus(record, SCHEMA_VERSION) !== "supported" &&
        !(LEGACY_SCHEMA_VERSIONS as readonly number[]).includes(schema as number)) blocked();
      if (id) this.admitted.set(name, id); else this.admitted.delete(name);
      if (id && record !== null) this.parsed.set(name, { id, value: record }); else this.parsed.delete(name);
    }
  }

  /** Admission's parse of `name`, used at most once and only while the file is the version admission read. */
  private takeParsed(name: string): unknown {
    const hit = this.parsed.get(name);
    this.parsed.delete(name);
    return hit && hit.id === this.fileId(name, true) ? hit.value : null;
  }

  /** Identity of a store file; any replacement or content write changes it. `ctime` also tracks link-count changes. */
  private fileId(name: string, ctime = false): string | null {
    const st = lstatSync(this.p(name), { bigint: true, throwIfNoEntry: false });
    return st ? `${st.dev}:${st.ino}:${st.size}:${st.mtimeNs}${ctime ? `:${st.ctimeNs}` : ""}` : null;
  }

  private inWrite<T>(context: WriteContext, fn: () => T): T {
    if (!context.active || this.readLock("lock")?.nonce !== context.lock.nonce) {
      throw new KernelError("unsupported-record", "the writer operation no longer holds its transaction lock");
    }
    this.admit();
    return fn();
  }

  private write<T>(fn: () => T): T {
    this.admit();
    this.opts.migrationGuard?.assert();
    const active = this.writes.getStore();
    if (active) return this.inWrite(active, fn);
    const here = lstatSync(this.dir, { throwIfNoEntry: false });
    if (!here) return fn();
    this.marker();
    const me: LockInfo = { ...this.self(), nonce: this.rand.base32(12), verb: "direct-write" };
    const tmp = this.p(`lock.${me.nonce}`);
    writeSynced(tmp, JSON.stringify(me));
    try {
      try { linkSync(tmp, this.p("lock")); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        throw new KernelError("kernel-busy", "a direct writer needs the exclusive transaction lock");
      }
      const context = { lock: me, active: true, staged: [] as StagedWrite[], transactional: false };
      try { return this.writes.run(context, () => this.inWrite(context, fn)); }
      finally { context.active = false; this.release(me); }
    } finally { rmSync(tmp, { force: true }); }
  }

  private async admitBeforeLock(name: string, deadline: number): Promise<void> {
    for (;;) try { this.admit(); return; } catch (e) {
      if (!(e instanceof KernelError && e.reasons[0]?.code === "unsupported-record" && e.message === "a private record changed during its bounded read")) throw e;
      // A writer may finish and release the lock between its replacement and this check, so an unheld lock is retried too.
      const held = this.readLock(name);
      // A holder can release the lock and exit between that read and the liveness check; only a lock that still names
      // the dead holder is stale.
      if (held && !isAlive(held.pid, held.procStart) && this.readLock(name)?.nonce === held.nonce) throw e;
      if (Date.now() > deadline) throw held ? new KernelError("kernel-busy", `held by ${held.verb} (pid ${held.pid})`) : e;
      await sleep(20);
    }
  }

  private marker(): Marker | null {
    const m = readJson<Marker>(this.p("marker"));
    if (!m || !/^ws_[a-z2-7]{10}$/.test(m.workspaceId) || !/^[a-z0-9]{4}$/.test(m.tag) ||
      (!(LEGACY_SCHEMA_VERSIONS as readonly number[]).includes(m.schema) && m.schema !== SCHEMA_VERSION) || !m.nonce) {
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
      const raw = this.takeParsed(file) ?? readJson<unknown>(this.p(file));
      const parsed = raw ? parseStateRecord(raw) : null;
      if (parsed?.success) {
        const m = this.marker()!;
        if (parsed.data.workspaceId !== m.workspaceId || parsed.data.tag !== m.tag) {
          throw new KernelError("marker-mismatch", "the state belongs to another workspace");
        }
        const records = this.journal(true).entries; // only reduced into the state below, never handed out
        const state = recovered ? recoveredState(parsed.data, this.clock.now(), records) : recoverAccounting(parsed.data, records).state;
        return { state, recovered };
      }
    }
    if (!existsSync(this.p("state"))) return null; // marker written, first state not yet published
    throw new KernelError("unsupported-record", "the state document cannot be read and no previous revision exists");
  }

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
    const deadline = Date.now() + this.lockWaitMs;
    await this.admitBeforeLock(name, deadline);
    const me: LockInfo = { ...this.self(), nonce: this.rand.base32(12), verb };
    const tmp = this.p(`${name}.${me.nonce}`);
    writeSynced(tmp, JSON.stringify(me));
    try {
      for (;;) {
        await this.admitBeforeLock(name, deadline);
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

  async transaction<T>(verb: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    this.opts.migrationGuard?.assert();
    const directoryExisted = !!lstatSync(this.p("."), { throwIfNoEntry: false });
    const existed = this.exists();
    const me = await this.acquire(verb);
    const context: WriteContext = { lock: me, active: true, staged: [], transactional: true };
    try {
      this.admit();
      this.opts.migrationGuard?.accept();
      const read = this.exists() ? this.read() : null;
      const priorScope = existed && !this.quarantined ? null : this.retentionScope();
      const history = read && existsSync(this.p("log")) ? "complete"
        : priorScope?.exists || (!this.quarantined && (existed || directoryExisted)) ? "uncertain"
        : "newly-created";
      if (history !== "uncertain") {
        chmodSync(this.dir, 0o700);
        for (const name of ["marker", "state", "state.prev", "log"]) {
          const path = this.p(name), mode = lstatSync(path, { throwIfNoEntry: false })?.mode;
          if (mode !== undefined && (mode & 0o7777) !== 0o600) chmodSync(path, 0o600);
        }
        if (!existsSync(this.p(".gitignore"))) writeFileSync(this.p(".gitignore"), "*\n");
        this.repairLogTail();
      }
      if (this.quarantined && read?.state.quarantine?.nonce === this.quarantined.nonce) this.finishQuarantine();
      const store = this;
      let published = read?.state ?? null;
      const tx: Tx = {
        get state() { return published; },
        recovered: read?.recovered ?? false,
        history,
        ...(this.quarantined ? { quarantined: this.quarantined } : {}),
        allowReserve: () => { context.reserveAllowed = true; },
        get reserveAllowed() { return context.reserveAllowed ?? false; },
        ensure: () => store.inWrite(context, () => {
          const marker = store.ensureMarker();
          if (history === "newly-created") store.ensureCreationRoot(context);
          return marker;
        }),
        publish: (next) => store.inWrite(context, () => {
          const staged = State.parse({ ...next, revision: (published?.revision ?? 0) + 1 });
          context.staged.push({ kind: "state", value: staged });
          published = staged;
        }),
        reservePublish: (next, reservedJournalBytes = 0) => store.inWrite(context, () => {
          store.assertStagedGrowth(context, next, reservedJournalBytes);
        }),
        flush: () => store.commitStaged(context),
        call: (entry) => store.stageLog(context, { kind: "call", ...entry }),
        intent: (effect, id, op) => store.stageLog(context, { kind: "intent", effect, id, op }),
        result: (effect, id, outcome) => store.stageLog(context, { kind: "result", effect, id, outcome }),
        unresolved: () => store.unresolved(context),
        evict: (keep, apply = true) => store.inWrite(context, () => store.evictInLock(keep, apply)),
        recent: (n) => {
          const log = recentWithStaged(store.readLog(), context);
          return n === undefined ? log : log.slice(-n);
        },
      };
      return await this.writes.run(context, async () => {
        const result = await fn(tx);
        this.commitStaged(context);
        return result;
      });
    } finally {
      context.active = false;
      this.opts.migrationGuard?.release();
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
  private ensureCreationRoot(context: WriteContext) {
    if (context.creationIdentity) return;
    const scope = this.retentionScope();
    if (scope.exists) {
      throw new KernelError("state-history-unknown", "the project temp root existed before first-state creation");
    }
    mkdirSync(scope.path, { mode: 0o700 });
    fsyncDir(tmpdir());
    const created = this.retentionScope();
    if (!created.exists || created.identity === "absent") {
      throw new KernelError("state-history-unknown", "the project temp root could not be durably identified");
    }
    context.creationIdentity = created.identity.split(":").slice(0, 2).join(":");
    if (!existsSync(this.p("log"))) writeSynced(this.p("log"), "");
  }

  private statePublication(next: State, reservedJournalBytes: number) {
    const context = this.writes.getStore();
    if (context?.creationIdentity) {
      const scope = this.retentionScope();
      if (!scope.identity.startsWith(`${context.creationIdentity}:`)) {
        throw new KernelError("state-history-unknown", "the project temp root changed during first-state publication");
      }
    }
    const before = this.exists() ? this.read() : null;
    const current = before?.state;
    const doc = State.parse({ ...next, revision: (current?.revision ?? 0) + 1 });
    const serialized = JSON.stringify(doc);
    const checkpoint = doc.workSeq || doc.generationSeq ? accountingCheckpoint(doc, current) : null;
    const checkpointBytes = checkpoint
      ? Buffer.byteLength(JSON.stringify({ t: this.clock.now(), ...checkpoint }), "utf8")
      : 0;
    this.assertStoreGrowth(
      Buffer.byteLength(serialized, "utf8") + checkpointBytes + reservedJournalBytes,
      context?.reserveAllowed ?? false,
    );
    return { before, current, doc, serialized, checkpoint };
  }

  private publishState(next: State, reservedJournalBytes = 0) {
    const { before, current, doc, serialized, checkpoint } =
      this.statePublication(next, reservedJournalBytes);
    const seen = this.fileId("state");
    if (checkpoint) this.append(checkpoint);
    const tmp = this.p("state.tmp");
    writeSynced(tmp, serialized);
    if (existsSync(this.p("state"))) {
      rmSync(this.p("state.prev.tmp"), { force: true });
      linkSync(this.p(before?.recovered ? "state.prev" : "state"), this.p("state.prev.tmp"));
      renameSync(this.p("state.prev.tmp"), this.p("state.prev"));
    }
    const moved = this.fileId("state") !== seen;
    if (moved && (this.read()?.state.revision ?? 0) !== (current?.revision ?? 0)) throw new KernelError("revision-conflict");
    renameSync(tmp, this.p("state"));
    fsyncDir(this.dir);
    const creationIdentity = this.writes.getStore()?.creationIdentity;
    if (creationIdentity && !this.retentionScope().identity.startsWith(`${creationIdentity}:`)) {
      throw new KernelError("state-history-unknown",
        "the project temp root changed during state publication; a restart remains uncertain");
    }
    const marker = this.marker();
    if (marker && (LEGACY_SCHEMA_VERSIONS as readonly number[]).includes(marker.schema)) {
      this.replaceSynced(this.p("marker"), JSON.stringify({ ...marker, schema: SCHEMA_VERSION }));
    }
    for (const name of ["state", "state.prev"]) {
      const id = this.fileId(name, true);
      if (id) this.admitted.set(name, id);
    }
    if (this.quarantined && doc.quarantine?.nonce === this.quarantined.nonce) this.finishQuarantine();
    return doc;
  }

  private finishQuarantine() {
    rmSync(this.p(`${QUARANTINE_JOURNAL}${this.quarantined!.nonce}`), { force: true });
    fsyncDir(this.dir); this.quarantined = undefined;
  }

  private repairLogTail() {
    const { text, keep } = this.journal(true);
    if (keep !== text.length) writeSynced(this.p("log"), text.slice(0, keep));
  }

  private append(entry: Omit<LogEntry, "t">) {
    this.admit();
    const serialized = `${JSON.stringify({ t: this.clock.now(), ...entry })}\n`;
    const bytes = Buffer.byteLength(serialized, "utf8");
    this.assertStoreGrowth(bytes, this.writes.getStore()?.reserveAllowed ?? false);
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
    return this.journal().entries;
  }

  /** The journal's records. `unseen`: the caller hands none of them out, so the next read may take this parse instead of
   *  parsing again (NFR-01), extended by any records appended since. Taken once, so no two callers share a record. */
  private journal(unseen = false): Journal {
    this.admit();
    const text = readRecord(this.p("log"), true) ?? "", prior = this.unseenJournal;
    this.unseenJournal = undefined;
    let parsed: { entries: LogEntry[]; keep: number };
    if (prior && prior.keep === prior.text.length && text.startsWith(prior.text)) { // every record of `prior` is still there
      const rest = readJournal(text.slice(prior.text.length));
      parsed = { entries: [...prior.entries, ...rest.entries], keep: prior.keep + rest.keep };
    } else parsed = readJournal(text);
    const read = { text, ...parsed };
    if (unseen) this.unseenJournal = read;
    return read;
  }

  private unresolved(context = this.writes.getStore()) {
    const read = this.journal(), log = read.entries;
    const staged = (context?.staged ?? [])
      .flatMap((entry) => entry.kind === "log" ? [entry.value] : []);
    const complete = [...log, ...staged];
    const done = new Set(complete.filter((e) => e.kind === "result").map((e) => JSON.stringify([e.effect, e.id])));
    const open = complete.filter((e) => e.kind === "intent" && !done.has(JSON.stringify([e.effect, e.id])))
      .map((e) => ({ effect: e.effect!, id: e.id!, op: e.op }));
    if (!open.length) this.unseenJournal = read; // no record of this parse was handed out
    return open;
  }
  private stageLog(context: WriteContext, entry: Omit<LogEntry, "t"> & { kind: LogEntry["kind"] }) {
    this.inWrite(context, () => {
      const serialized: LogEntry = { t: this.clock.now(), ...entry };
      readJournal(JSON.stringify(serialized) + "\n");
      context.staged.push({ kind: "log", value: serialized });
    });
  }
  private assertStagedGrowth(
    context: WriteContext,
    prospectiveState?: State,
    reservedJournalBytes = 0,
  ) {
    let logBytes = reservedJournalBytes;
    let stateBytes = 0;
    let blobBytes = 0;
    let checkpointBytes = 0;
    let priorState = this.read()?.state;
    let prospectiveStateValue = prospectiveState ?? priorState;
    for (const entry of context.staged) {
      if (entry.kind === "log") logBytes += Buffer.byteLength(JSON.stringify(entry.value), "utf8") + 1;
      if (entry.kind === "blob") blobBytes += Buffer.byteLength(entry.content, "utf8");
      if (entry.kind === "state") {
        stateBytes = Math.max(stateBytes, Buffer.byteLength(JSON.stringify(entry.value), "utf8"));
        const checkpoint = entry.value.workSeq || entry.value.generationSeq
          ? accountingCheckpoint(entry.value, priorState)
          : null;
        if (checkpoint) {
          checkpointBytes += Buffer.byteLength(
            JSON.stringify({ t: this.clock.now(), ...checkpoint }),
            "utf8",
          );
        }
        priorState = entry.value;
        prospectiveStateValue = entry.value;
      }
    }
    if (prospectiveState) {
      stateBytes = Math.max(stateBytes, Buffer.byteLength(JSON.stringify(prospectiveState), "utf8"));
      const checkpoint = prospectiveState.workSeq || prospectiveState.generationSeq
        ? accountingCheckpoint(prospectiveState, priorState)
        : null;
      if (checkpoint) {
        checkpointBytes += Buffer.byteLength(
          JSON.stringify({ t: this.clock.now(), ...checkpoint }),
          "utf8",
        );
      }
      prospectiveStateValue = prospectiveState;
    }
    const previous = this.read()?.state;
    const currentReserved = reservedStorage(previous);
    const prospectiveReserved = reservedStorage(prospectiveStateValue);
    const stagedBytes = logBytes + blobBytes + stateBytes + checkpointBytes;
    for (const work of Object.values(previous?.work ?? {})) {
      const inCall = work.session.inCall;
      if (!inCall?.storageReservedBytes || inCall.storageBaselineBytes === undefined) continue;
      const stillReserved = Object.values(prospectiveStateValue?.work ?? {})
        .some((candidate) => candidate.session.inCall?.runId === inCall.runId);
      if (!stillReserved && this.storageBytes() + stagedBytes >
          inCall.storageBaselineBytes + inCall.storageReservedBytes) {
        throw new KernelError("storage-reserve-full",
          "The external job's final state exceeds its admitted storage reservation; no result was published",
          { exit: 2 });
      }
    }
    const released = releasedStorage(previous, prospectiveStateValue);
    const growth = logBytes + blobBytes + checkpointBytes +
      Math.max(0, stateBytes - (previous ? Buffer.byteLength(JSON.stringify(previous), "utf8") : 0));
    if (released && growth > released) {
      throw new KernelError("storage-reserve-full",
        "The external job's final state exceeds its admitted storage reservation; no result was published",
        { exit: 2 });
    }
    this.assertStoreGrowth(
      stagedBytes +
        Math.max(0, prospectiveReserved - currentReserved),
      context.reserveAllowed ?? false,
      Math.max(0, currentReserved - prospectiveReserved),
    );
  }
  private commitStaged(context: WriteContext) {
    if (!context.staged.length) return;
    this.inWrite(context, () => {
      this.assertStagedGrowth(context);
      this.assertArtifactCapacity(context);
      context.committing = true;
      try {
        const staged = [...context.staged];
        for (const entry of staged) {
          if (entry.kind === "state") this.publishState(entry.value);
          if (entry.kind === "log") this.append(entry.value);
          if (entry.kind === "blob") {
            mkdirSync(this.p("blobs"), { recursive: true, mode: 0o700 });
            if (this.readBlob(entry.hash) === null) writeSynced(this.p(`blobs/${entry.hash}`), entry.content);
          }
          if (entry.kind === "directory") mkdirSync(entry.path, { recursive: true, mode: 0o700 });
          if (entry.kind === "artifact") {
            mkdirSync(dirname(entry.path), { recursive: true, mode: 0o700 });
            writeSynced(entry.path, entry.content);
          }
          if (entry.kind === "purge") for (const path of entry.paths) rmSync(path, { force: true });
        }
        context.staged = [];
      } finally { context.committing = false; }
    });
  }

  putCommitProof(proof: CommitProofV1): void {
    this.write(() => writeCommitProof(
      name => this.p(name),
      proof,
      this.readLog(),
      this.marker()!.workspaceId,
      bytes => this.assertStoreGrowth(bytes, this.writes.getStore()?.reserveAllowed ?? false),
    ));
  }
  commitProofs(): CommitProofV1[] {
    this.admit();
    return readCommitProofs(name => this.p(name), this.readLog(), this.marker()!.workspaceId);
  }
  putBlob(content: string): string {
    return this.write(() => {
      this.marker();
      if (Buffer.byteLength(content, "utf8") > MAX_RECORD) {
        throw new KernelError("unsupported-record", "a blob exceeds the 50 MB record bound");
      }
      this.assertStoreGrowth(Buffer.byteLength(content, "utf8"), this.writes.getStore()?.reserveAllowed ?? false);
      const h = sha256(content);
      const context = this.writes.getStore();
      if (context?.transactional && !context.committing) {
        if (!context.staged.some((entry) => entry.kind === "blob" && entry.hash === h)) {
          context.staged.push({ kind: "blob", hash: h, content });
        }
        return h;
      }
      mkdirSync(this.p("blobs"), { recursive: true, mode: 0o700 });
      if (this.readBlob(h) === null) writeSynced(this.p(`blobs/${h}`), content);
      return h;
    });
  }
  readBlob(hash: string): string | null {
    this.admit();
    if (!/^[a-f0-9]{64}$/.test(hash)) throw new KernelError("unsupported-record", "invalid blob hash");
    const content = readRecord(this.p(`blobs/${hash}`));
    const context = this.writes.getStore();
    if (content === null && context?.transactional && !context.committing) {
      const staged = context.staged.find((entry) => entry.kind === "blob" && entry.hash === hash);
      if (staged?.kind === "blob") return staged.content;
    }
    if (content !== null && sha256(content) !== hash) throw new KernelError("unsupported-record", "blob hash mismatch");
    return content;
  }

  tempDir(name: string): string {
    return this.write(() => {
      const context = this.writes.getStore();
      if (context?.transactional && !context.committing) {
        const path = this.tempPath(name, false);
        if (!context.staged.some((entry) => entry.kind === "directory" && entry.path === path)) {
          context.staged.push({ kind: "directory", path });
        }
        return path;
      }
      return this.tempPath(name, true);
    });
  }
  private tempPath(name: string, create: boolean): string {
    this.admit();
    const m = this.exists() ? this.marker() : null;
    if (isAbsolute(name) || name.includes("\\") || name.split("/").some(p => !p || p === "." || p === "..")) {
      throw new KernelError("run-dir-unavailable", "invalid temp directory name");
    }
    let dir = tmpdir();
    for (const part of [`tenet-${m?.workspaceId ?? "unbound"}`, ...name.split("/")]) {
      dir = join(dir, part);
      try {
        if (create) {
          try { mkdirSync(dir, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        }
        const st = lstatSync(dir, { throwIfNoEntry: false });
        if (!st && !create) continue;
        if (!st || st.isSymbolicLink() || !st.isDirectory()) throw new Error("temp storage contains a link or non-directory");
        if (create) chmodSync(dir, 0o700);
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
  private assertArtifactCapacity(context: WriteContext) {
    const staged = stagedRunGrowth(context);
    if (!staged.paths.length) return;
    const protection = this.journalProtection(staged.paths);
    const cap = this.capRunFiles([...protection.protectedPaths], staged.bytes);
    if (cap.accounting !== "known") {
      throw new KernelError("storage-accounting-unknown", "project run accounting changed before artifact publication");
    }
    if (cap.overCap || cap.remove.length) {
      throw new KernelError("storage-run-cap-full",
        "Project run files need admitted cleanup before artifact publication; no artifact was written");
    }
    this.assertRunScopeUnchanged(cap.scopes);
  }
  writeArtifact(dir: string, name: string, content: string): string {
    return this.write(() => {
      const path = this.artifactPath(dir, name, false);
      const context = this.writes.getStore();
      const staged = stagedRunGrowth(context, { kind: "artifact", path, content });
      const protection = this.journalProtection(staged.paths);
      const admission = this.capRunFiles(
        [...protection.protectedPaths],
        staged.bytes,
      );
      if (admission.accounting !== "known") {
        throw new KernelError("storage-accounting-unknown",
          "Tenet could not measure project run files safely; no artifact was written", { exit: 2 });
      }
      if (admission.overCap) {
        throw new KernelError("storage-run-cap-full",
          "Protected project run files use the full 200 MB budget. No ordinary change was made; " +
            "stop existing work or explicitly recover retained files before trying again.",
          { exit: 2 });
      }
      this.assertRunScopeUnchanged(admission.scopes);
      if (admission.remove.length && !(context?.transactional && !context.committing)) {
        throw new KernelError("storage-run-cap-full",
          "Eligible run-file cleanup is needed before this artifact can be written; no artifact was written",
          { exit: 2 });
      }
      if (context?.transactional && !context.committing) {
        context.staged.push({ kind: "artifact", path, content });
        return path;
      }
      this.artifactPath(dir, name, true);
      writeSynced(path, content);
      return path;
    });
  }
  readArtifact(dir: string, name: string): string | null {
    const path = this.artifactPath(dir, name);
    const context = this.writes.getStore();
    const staged = context?.transactional && !context.committing
      ? context.staged.findLast((entry) => entry.kind === "artifact" && entry.path === path)
      : undefined;
    return staged?.kind === "artifact" ? staged.content : readRecord(path);
  }
  private artifactPath(dir: string, name: string, create = false): string {
    this.admit();
    if (!name || /[/\\]/.test(name) || name === "." || name === "..") {
      throw new KernelError("run-dir-unavailable", "invalid artifact name");
    }
    const id = this.exists() ? this.marker()!.workspaceId : "unbound";
    return join(this.tempPath(relative(join(tmpdir(), `tenet-${id}`), dir).split(sep).join("/"), create), name);
  }
  private runFiles(): string[] {
    const base = this.tempBase();
    if (!base) return [];
    return ["", "manifests", "review"].flatMap((group) => {
      const dir = group ? join(base, group) : base;
      const stat = lstatSync(dir, { throwIfNoEntry: false });
      if (!stat) return [];
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error("temp group is a link or non-directory");
      return readdirSync(dir).filter((name) => group || name.startsWith("run-")).map((name) => join(dir, name));
    });
  }
  private runScopeSnapshot(): Array<{ path: string; identity: string }> {
    const base = this.tempBase();
    if (!base) return [];
    const measured = this.measure(base);
    if (measured.accounting !== "known") {
      throw new KernelError("storage-accounting-unknown",
        "the project run scope could not be measured safely; no cleanup was started");
    }
    return [{ path: base, identity: measured.identity }];
  }
  private assertRunScopeUnchanged(scopes: ReadonlyArray<{ path: string; identity: string }>) {
    const now = this.runScopeSnapshot();
    if (scopes.length !== now.length || scopes.some((scope, index) =>
      scope.path !== now[index]?.path || scope.identity !== now[index]?.identity)) {
      throw new KernelError("storage-accounting-unknown",
        "the project run scope changed after accounting; no cleanup candidate was removed");
    }
  }
  sweepTemp(maxAgeMs: number, keep: readonly string[]): number {
    return this.write(() => this.sweepTempInLock(maxAgeMs, keep));
  }
  private sweepTempInLock(maxAgeMs: number, keep: readonly string[]): number {
    keep = [...this.journalProtection([...keep, ...stagedRunGrowth(this.writes.getStore()).paths]).protectedPaths];
    const remove: Array<{ path: string; identity: string }> = [];
    for (const path of this.runFiles()) {
      if (keep.some((k) => k === path || k.startsWith(`${path}${sep}`) || path.startsWith(`${k}${sep}`))) continue;
      const measured = this.measure(path);
      if (measured.accounting !== "known") {
        throw new KernelError("storage-accounting-unknown",
          "run-file age could not be measured safely; no old folder was removed");
      }
      if (Date.now() - measured.at > maxAgeMs) remove.push({ path, identity: measured.identity });
    }
    this.assertCandidatesUnchanged(remove);
    for (const candidate of remove) rmSync(candidate.path, { recursive: true, force: true });
    return remove.length;
  }
  private replaceSynced(path: string, data: string) {
    this.admit();
    writeSynced(`${path}.tmp`, data);
    renameSync(`${path}.tmp`, path);
    fsyncDir(this.dir);
  }
  private prevRevision(): number | null {
    const text = readRecord(this.p("state.prev"));
    if (text === null) return null;
    let raw: unknown;
    try { raw = parseRecord(text); } catch {
      throw new KernelError("storage-accounting-unknown",
        "the previous state cannot be read safely; journal reduction was not started");
    }
    const previous = parseStateRecord(raw);
    if (!previous.success) {
      throw new KernelError("storage-accounting-unknown",
        "the previous state cannot be read safely; journal reduction was not started");
    }
    return previous.data.revision;
  }
  /** Old journal records become monthly counts in summaries.json, written first and keyed by the journal they came from. */
  private journalProtection(keep: readonly string[]) {
    const states: State[] = [];
    const selected = this.read()?.state;
    if (selected) states.push(selected);
    for (const entry of this.writes.getStore()?.staged ?? []) {
      if (entry.kind === "state") states.push(entry.value);
    }
    const previousText = readRecord(this.p("state.prev"));
    if (previousText !== null) {
      let raw: unknown;
      try { raw = parseRecord(previousText); } catch {
        throw new KernelError("storage-accounting-unknown",
          "the previous state cannot be read safely; journal reduction was not started");
      }
      const previous = parseStateRecord(raw);
      if (!previous.success) {
        throw new KernelError("storage-accounting-unknown",
          "the previous state cannot be read safely; journal reduction was not started");
      }
      states.push(previous.data);
    }
    const protectedIds = new Set<string>(this.unresolved().map((entry) => entry.id));
    const protectedPaths = new Set(keep);
    for (const state of states) {
      const legacy = state.project.retention?.legacyTemp.path;
      if (legacy) protectedPaths.add(legacy);
      for (const work of Object.values(state.work)) {
        if (work.session.inCall?.runId) protectedIds.add(work.session.inCall.runId);
        if (work.session.inCall?.runDir) protectedPaths.add(work.session.inCall.runDir);
        if (work.focusedReview?.id) protectedIds.add(work.focusedReview.id);
        if (work.focusedReview?.manifest) protectedPaths.add(work.focusedReview.manifest);
        for (const reservation of work.budget.reservations) {
          protectedIds.add(reservation.id);
          protectedPaths.add(reservation.manifest);
        }
      }
    }
    return { protectedIds, protectedPaths };
  }
  private projectedReduction(
    nowMs: number,
    protection: { protectedIds: ReadonlySet<string>; protectedPaths: ReadonlySet<string> },
  ): { savings: number; transientBytes: number } {
    const text = readRecord(this.p("log"), true) ?? "";
    const pending = readCompactionPending(this.p("compaction.pending.json"));
    if (pending) {
      if (sha256(text) === pending.outputHash) {
        return {
          savings: 0,
          transientBytes: Buffer.byteLength(JSON.stringify(pending.summary)),
        };
      }
      if (sha256(text) !== pending.inputHash || this.fileId("log", true) !== pending.inputIdentity) {
        throw new KernelError("storage-accounting-unknown", "the pending compaction no longer matches the journal");
      }
      return {
        savings: Math.max(0, Buffer.byteLength(text) - Buffer.byteLength(pending.output)),
        transientBytes: Buffer.byteLength(JSON.stringify(pending.summary)) + Buffer.byteLength(pending.output),
      };
    }
    if (Buffer.byteLength(text) < (this.opts.compactAtBytes ?? 5 * 1024 * 1024)) {
      return { savings: 0, transientBytes: 0 };
    }
    const reduced = this.reductionFor(text, nowMs, protection);
    const output = reduced.text;
    if (!reduced.removed) return { savings: 0, transientBytes: 0 };
    const summaryText = readRecord(this.p("summaries.json"));
    const prior = summaryText === null
      ? { version: 1 as const, from: "", months: {} as Months }
      : parsePrivate(
        SummaryRecord,
        summaryText,
        "the compaction summary is damaged or unsupported; the journal was left untouched",
      );
    const provisional = {
      version: 1 as const,
      batchId: "projection00",
      inputHash: sha256(text),
      inputIdentity: this.fileId("log", true) ?? "",
      outputHash: sha256(output),
      output,
      removed: reduced.removed,
      summary: {
        version: 1 as const,
        batchId: "projection00",
        from: sha256(text),
        months: addMonths(prior.months as Months, reduced.months),
      },
    };
    return {
      savings: Math.max(0, Buffer.byteLength(text) - Buffer.byteLength(output)),
      transientBytes: Buffer.byteLength(JSON.stringify(provisional)) +
        Buffer.byteLength(JSON.stringify(provisional.summary)) +
        Buffer.byteLength(output),
    };
  }

  private reduceLog(
    nowMs: number,
    protection: { protectedIds: ReadonlySet<string>; protectedPaths: ReadonlySet<string> },
  ): string | undefined {
    const text = readRecord(this.p("log"), true) ?? "";
    const pendingPath = this.p("compaction.pending.json");
    let pending = readCompactionPending(pendingPath);
    const inputHash = sha256(text);
    if (pending && inputHash === pending.outputHash) {
      this.replaceSynced(this.p("summaries.json"), JSON.stringify(pending.summary));
      rmSync(pendingPath, { force: true });
      fsyncDir(this.dir);
      return "Completed the interrupted journal reduction.";
    }
    if (Buffer.byteLength(text) < (this.opts.compactAtBytes ?? 5 * 1024 * 1024) && !pending) return undefined;
    const inputIdentity = this.fileId("log", true);
    if (!inputIdentity) {
      throw new KernelError("storage-accounting-unknown", "the journal changed before compaction; nothing was reduced");
    }
    if (pending && (inputHash !== pending.inputHash || inputIdentity !== pending.inputIdentity)) {
      throw new KernelError("storage-accounting-unknown", "the pending compaction no longer matches the journal");
    }
    if (!pending) {
      const reduced = this.reductionFor(text, nowMs, protection);
      if (!reduced.removed) return undefined;
      const summaryText = readRecord(this.p("summaries.json"));
      const prior = summaryText === null
        ? { version: 1 as const, from: "", months: {} as Months }
        : parsePrivate(
          SummaryRecord,
          summaryText,
          "the compaction summary is damaged or unsupported; the journal was left untouched",
        );
      pending = {
        version: 1,
        batchId: this.rand.base32(12),
        inputHash,
        inputIdentity,
        outputHash: sha256(reduced.text),
        output: reduced.text,
        removed: reduced.removed,
        summary: {
          version: 1,
          batchId: this.rand.base32(12),
          from: inputHash,
          months: addMonths(prior.months as Months, reduced.months),
        },
      };
      pending.summary.batchId = pending.batchId;
      this.replaceSynced(pendingPath, JSON.stringify(pending));
    }
    this.replaceSynced(this.p("summaries.json"), JSON.stringify(pending.summary));
    this.opts.afterSummaries?.();
    this.replaceSynced(this.p("log"), pending.output);
    rmSync(pendingPath, { force: true });
    fsyncDir(this.dir);
    return `Reduced the journal: ${pending.removed} records older than 90 days are now monthly counts (summaries.json); `
      + "unresolved effects and recent history are kept.";
  }
  private reductionFor(
    text: string,
    nowMs: number,
    protection: { protectedIds: ReadonlySet<string>; protectedPaths: ReadonlySet<string> },
  ) {
    const revision = this.read()?.state.revision ?? 0;
    try {
      readJournal(text);
      const reduced = reduceJournal(text, {
        nowMs,
        days: this.opts.journalDays ?? 90,
        protectFromRevision: Math.min(revision, this.prevRevision() ?? revision),
        ...protection,
      });
      if (reduced) return reduced;
    } catch { /* mapped to the accounting refusal below */ }
    throw new KernelError("storage-accounting-unknown",
      "the journal holds a record this kernel cannot account for; it was left untouched");
  }
  /** Oldest eligible run folders first, but never a partial cleanup before a still-over-cap refusal. */
  private capRunFiles(keep: readonly string[], additionalBytes = 0): {
    message?: string; overCap: boolean; largest: number;
    remove: Array<{ path: string; identity: string }>;
    scopes: Array<{ path: string; identity: string }>;
    accounting: "known" | "unknown" | "changed";
  } {
    let scopes: Array<{ path: string; identity: string }>;
    try { scopes = this.runScopeSnapshot(); }
    catch { return { overCap: false, largest: 0, remove: [], scopes: [], accounting: "unknown" }; }
    let paths: string[];
    try { paths = this.runFiles(); } catch {
      return { overCap: false, largest: 0, remove: [], scopes, accounting: "unknown" };
    }
    try { this.assertRunScopeUnchanged(scopes); } catch {
      return { overCap: false, largest: 0, remove: [], scopes, accounting: "changed" };
    }
    const measured = paths.map((path) => ({ path, ...this.measure(path) }));
    const incomplete = measured.find((entry) => entry.accounting !== "known");
    if (incomplete) {
      return {
        overCap: false, largest: incomplete.bytes, remove: [], scopes, accounting: incomplete.accounting,
      };
    }
    const entries = measured.map((entry) => ({
      path: entry.path, bytes: entry.bytes, identity: entry.identity, at: entry.newestAt,
    })).sort((a, b) => a.at - b.at);
    let total = entries.reduce((n, e) => n + e.bytes, 0) + additionalBytes;
    const cap = this.opts.runFileCapBytes ?? 200 * 1024 * 1024;
    const protectedPath = (path: string) => keep.some((k) =>
      k === path || k.startsWith(`${path}${sep}`) || path.startsWith(`${k}${sep}`)
    );
    const remove: typeof entries = [];
    for (const e of entries) {
      if (total <= cap) break;
      if (protectedPath(e.path)) continue;
      remove.push(e); total -= e.bytes;
    }
    if (total > cap) return {
      overCap: true,
      largest: entries.reduce((n, e) => Math.max(n, e.bytes), 0),
      remove: [],
      scopes,
      accounting: "known",
    };
    return {
      ...(remove.length ? {
        message: `Removed ${remove.length} old run folder(s): run files were over their cap.`,
      } : {}),
      overCap: false,
      largest: entries.reduce((n, e) => Math.max(n, e.bytes), 0),
      remove: remove.map((e) => ({ path: e.path, identity: e.identity })),
      scopes,
      accounting: "known",
    };
  }
  evict(keep: readonly string[], apply = true): EvictReport {
    return this.write(() => this.evictInLock(keep, apply));
  }
  private storeFootprint() {
    const classes: Array<{ name: string; bytes: number }> = [];
    let accounting: "known" | "unknown" | "changed" = "known";
    try {
      for (const name of readdirSync(this.dir)) {
        const measured = this.measure(join(this.dir, name));
        if (measured.accounting !== "known") accounting = measured.accounting;
        classes.push({ name, bytes: measured.bytes });
      }
    } catch { accounting = "unknown"; }
    return { classes: classes.sort((a, b) => b.bytes - a.bytes), accounting };
  }
  private evictInLock(keep: readonly string[], apply = true): EvictReport {
    const staged = stagedRunGrowth(this.writes.getStore());
    const protection = this.journalProtection([...keep, ...staged.paths]);
    const cap = this.capRunFiles([...protection.protectedPaths], staged.bytes);
    const projectedReduction = this.projectedReduction(Date.parse(this.clock.now()), protection);
    const { classes, accounting: classAccounting } = this.storeFootprint();
    const total = classes.reduce((n, c) => n + c.bytes, 0);
    const projected = Math.max(0, total - projectedReduction.savings);
    const peak = total + projectedReduction.transientBytes;
    const ceiling = this.opts.ceilingBytes ?? 50 * 1024 * 1024;
    if (projected > ceiling || peak > ceiling) {
      return {
        overCeiling: true,
        largest: classes.slice(0, 3),
        refusal: {
          code: "storage-protected-full",
          message: "Tenet's protected and recovery storage reached its 50 MB ceiling. No write was made; " +
            "preserve current data and reduce eligible storage before trying again.",
        },
      };
    }
    if (classAccounting !== "known" || cap.accounting !== "known") {
      return {
        overCeiling: false,
        largest: classes.slice(0, 3),
        refusal: {
          code: "storage-accounting-unknown",
          message: "Tenet could not measure storage safely. No ordinary change was made; " +
            "inspect or recover the affected path.",
        },
      };
    }
    const reserve = this.opts.reserveBytes ?? 5 * 1024 * 1024;
    const overCeiling = projected > ceiling - reserve || peak > ceiling - reserve;
    if (overCeiling) {
      return {
        overCeiling,
        largest: classes.slice(0, 3),
        refusal: {
          code: "storage-reserve-full",
          message: "This change would consume Tenet's recovery reserve. No ordinary change was made; " +
            "stop existing work or inspect residue before trying again.",
        },
      };
    }
    if (cap.overCap) {
      return {
        overCeiling: false,
        largest: cap.largest ? [{ name: "protected run files", bytes: cap.largest }] : [],
        refusal: {
          code: "storage-run-cap-full",
          message: "Protected project run files use the full 200 MB budget. No ordinary change was made; " +
            "stop existing work or explicitly recover retained files before trying again.",
        },
      };
    }
    for (const planned of cap.remove) {
      const now = this.measure(planned.path);
      if (now.accounting !== "known" || now.identity !== planned.identity) {
        return {
          overCeiling: false,
          largest: classes.slice(0, 3),
          refusal: {
            code: "storage-accounting-unknown",
            message: "Tenet could not measure storage safely. No ordinary change was made; " +
              "inspect or recover the affected path.",
          },
        };
      }
    }
    this.assertRunScopeUnchanged(cap.scopes);
    if (!apply) return { overCeiling, largest: classes.slice(0, 3) };
    const reduction = this.reduceLog(Date.parse(this.clock.now()), protection);
    const changed = this.changedRunCleanup(cap, reduction, overCeiling, classes);
    if (changed) return changed;
    for (const planned of cap.remove) rmSync(planned.path, { recursive: true, force: true });
    const notes = [reduction, cap.message].filter((x): x is string => !!x);
    return { ...(notes.length ? { message: notes.join(" ") } : {}), overCeiling, largest: classes.slice(0, 3) };
  }
  private changedRunCleanup(
    cap: ReturnType<FsStore["capRunFiles"]>,
    reduction: string | undefined,
    overCeiling: boolean,
    classes: Array<{ name: string; bytes: number }>,
  ): EvictReport | undefined {
    try {
      this.assertRunScopeUnchanged(cap.scopes);
      this.assertCandidatesUnchanged(cap.remove);
      return undefined;
    } catch (error) {
      if (!(error instanceof KernelError && error.reasons[0]?.code === "storage-accounting-unknown")) throw error;
      return {
        ...(reduction ? { message: reduction } : {}),
        uncertain: ["Journal reduction completed; project run scope changed, so no run folder was removed."],
        refusal: {
          code: "storage-accounting-unknown",
          message: "Run-file accounting changed during cleanup; dependent work was not published.",
        },
        overCeiling,
        largest: classes.slice(0, 3),
      };
    }
  }
  private measure(path: string): {
    bytes: number; at: number; newestAt: number; identity: string; accounting: "known" | "unknown" | "changed";
  } {
    let st;
    try {
      st = lstatSync(path, { bigint: true });
    } catch (error) {
      return {
        bytes: 0,
        at: 0,
        newestAt: 0,
        identity: "",
        accounting: (error as NodeJS.ErrnoException).code === "ENOENT" ? "changed" : "unknown",
      };
    }
    const identity = `${st.dev}:${st.ino}:${st.size}:${st.mtimeNs}:${st.ctimeNs}:${st.nlink}`;
    if (st.isSymbolicLink() || (!st.isDirectory() && !st.isFile())) {
      const at = Number(st.mtimeNs / 1_000_000n);
      return { bytes: 0, at, newestAt: at, identity, accounting: "changed" };
    }
    if (!st.isDirectory()) {
      const at = Number(st.mtimeNs / 1_000_000n);
      return { bytes: Number(st.size), at, newestAt: at, identity, accounting: "known" };
    }
    let names: string[];
    try { names = readdirSync(path); } catch {
      const at = Number(st.mtimeNs / 1_000_000n);
      return { bytes: 0, at, newestAt: at, identity, accounting: "unknown" };
    }
    let bytes = 0;
    const at = Number(st.mtimeNs / 1_000_000n);
    let newestAt = at;
    let accounting: "known" | "unknown" | "changed" = "known";
    const children: string[] = [];
    for (const name of names) {
      const child = this.measure(join(path, name));
      bytes += child.bytes;
      newestAt = Math.max(newestAt, child.newestAt);
      children.push(`${name}:${child.identity}`);
      if (child.accounting !== "known") accounting = child.accounting;
    }
    return { bytes, at, newestAt, identity: `${identity}[${children.join("|")}]`, accounting };
  }
  private assertCandidatesUnchanged(candidates: ReadonlyArray<{ path: string; identity: string }>) {
    for (const candidate of candidates) {
      const now = this.measure(candidate.path);
      if (now.accounting !== "known" || now.identity !== candidate.identity) {
        throw new KernelError("storage-accounting-unknown",
          "a cleanup candidate changed after measurement; no candidate was removed");
      }
    }
  }
  private assertStoreGrowth(additionalBytes: number, reserveAllowed: boolean, reservationCredit = 0) {
    const measured = this.measure(this.dir);
    if (measured.accounting !== "known") {
      throw new KernelError("storage-accounting-unknown",
        "Tenet could not measure storage safely. No ordinary change was made; inspect or recover the affected path.",
        { exit: 2 });
    }
    const logical = this.writes.getStore()?.committing
      ? 0
      : Math.max(0, reservedStorage(this.read()?.state) - reservationCredit);
    const projected = measured.bytes + additionalBytes + logical;
    const ceiling = this.opts.ceilingBytes ?? 50 * 1024 * 1024;
    if (projected > ceiling) {
      throw new KernelError("storage-protected-full",
        "Tenet's protected and recovery storage reached its 50 MB ceiling. No write was made; " +
          "preserve current data and reduce eligible storage before trying again.",
        { exit: 2 });
    }
    const ordinary = ceiling - (this.opts.reserveBytes ?? 5 * 1024 * 1024);
    if (projected > ordinary && !reserveAllowed) {
      throw new KernelError("storage-reserve-full",
        "This change would consume Tenet's recovery reserve. No ordinary change was made; " +
          "stop existing work or inspect residue before trying again.",
        { exit: 2 });
    }
  }
  residue(): { tenet: Footprint | null; temp: Footprint | null } {
    this.admit();
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
    if (remove) return this.write(() => this.cleanTempInLock(scope, minAgeMs, true));
    return this.cleanTempInLock(scope, minAgeMs, false);
  }
  private cleanTempInLock(scope: "project" | "machine", minAgeMs: number, remove: boolean): { removed: string[]; kept: string[] } {
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
    return this.write(() => this.purgeInLock(texts));
  }
  private purgeInLock(texts: readonly string[]): number {
    const base = this.tempBase();
    const needles = texts.filter((t) => t.length > 0);
    if (!base || !needles.length) return 0;
    const remove: string[] = [];
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
              remove.push(p);
            }
          }
        } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; }
      }
    };
    const manifests = join(base, "manifests");
    if (lstatSync(manifests, { throwIfNoEntry: false })?.isDirectory()) visit(manifests);
    const context = this.writes.getStore();
    if (context?.transactional && !context.committing) {
      context.staged.push({ kind: "purge", paths: remove });
    } else {
      for (const path of remove) rmSync(path, { force: true });
    }
    return remove.length;
  }
  private tempBase(): string | null {
    this.admit();
    if (!this.exists()) return null;
    const base = join(tmpdir(), `tenet-${this.marker()!.workspaceId}`);
    const stat = lstatSync(base, { throwIfNoEntry: false });
    if (!stat) return null;
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new KernelError("storage-accounting-unknown",
        "the marker-bound project temp root is linked or is not a directory");
    }
    return base;
  }
  retentionScope() {
    this.admit();
    const marker = this.marker();
    if (!marker) throw new KernelError("marker-mismatch", "the ownership marker is missing");
    const path = join(tmpdir(), `tenet-${marker.workspaceId}`);
    const st = lstatSync(path, { bigint: true, throwIfNoEntry: false });
    if (!st) return { path, identity: "absent", exists: false };
    if (!st.isDirectory() || st.isSymbolicLink()) {
      throw new KernelError("run-dir-unavailable", "the project temp scope is a link or non-directory");
    }
    return {
      path,
      identity: `${st.dev}:${st.ino}:${st.size}:${st.mtimeNs}:${st.ctimeNs}:${st.nlink}`,
      exists: true,
    };
  }
  canWrite(): boolean { try { accessSync(this.root, constants.W_OK); return true; } catch { return false; } }
}
