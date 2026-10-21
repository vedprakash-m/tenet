// The filesystem Store (TS §7): one state document replaced atomically, a transaction lock with guarded stale-break,
// an append-only log with torn-write repair, hash-named blobs and the workspace marker.
import { accessSync, chmodSync, closeSync, constants, existsSync, fchmodSync, fstatSync, fsyncSync, readdirSync, linkSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import type { Random } from "../core/ids.ts";
import { SCHEMA_VERSION, State } from "../core/schemas.ts";
import { accountingCheckpoint, recoverAccounting } from "../core/budget.ts";
import { recoveredState } from "../core/state.ts";
import type { Clock, LogEntry, Quarantined, Store, Tx } from "../ports/types.ts";
import { isAlive, procStart } from "./proc.ts";
import { quarantine, QUARANTINE_JOURNAL } from "./quarantine-fs.ts";

interface Marker { workspaceId: string; tag: string; nonce: string; schema: number; dev: number; ino: number }
interface LockInfo { pid: number; procStart: string; nonce: string; verb: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_RECORD = 50 * 1024 * 1024;
const readJson = <T>(p: string): T | null => {
  let fd = -1;
  try {
    fd = openSync(p, constants.O_RDONLY | constants.O_NOFOLLOW);
    const st = fstatSync(fd);
    if (!st.isFile() || st.size > MAX_RECORD) return null;
    const buffer = Buffer.alloc(st.size + 1), n = readSync(fd, buffer, 0, buffer.length, 0);
    if (n > st.size) return null;
    const parsed: unknown = JSON.parse(buffer.subarray(0, n).toString("utf8"));
    const pending: Array<[unknown, number]> = [[parsed, 0]];
    while (pending.length) {
      const [value, depth] = pending.pop()!;
      if (depth > 64) return null;
      if (value && typeof value === "object") for (const item of Object.values(value)) pending.push([item, depth + 1]);
    }
    return parsed as T;
  } catch { return null; }
  finally { if (fd >= 0) closeSync(fd); }
};

function fsyncDir(dir: string) {
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeSynced(path: string, data: string) {
  const fd = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try { fchmodSync(fd, 0o600); writeFileSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
}

export class FsStore implements Store {
  readonly dir: string;
  private root: string;
  private clock: Clock;
  private rand: Random;
  private lockWaitMs: number;
  private quarantined?: Quarantined;

  constructor(root: string, clock: Clock, rand: Random, opts: { lockWaitMs?: number } = {}) {
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
    this.p("marker"); // refuse even a dangling directory link before creating anything
    try {
      mkdirSync(this.dir, { mode: 0o700 });
      this.ensureMarker();
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
    chmodSync(this.dir, 0o700);
    let trusted = false;
    try {
      trusted = !!this.marker();
    } catch (e) {
      if (!(e instanceof KernelError) || e.reasons[0]?.code !== "marker-mismatch") throw e;
    }
    const rawMarker = readJson<Marker>(this.p("marker"));
    const here = lstatSync(this.dir);
    if (rawMarker && rawMarker.dev === here.dev && rawMarker.ino === here.ino && Number.isSafeInteger(rawMarker.schema) && rawMarker.schema >= 0 && rawMarker.schema !== SCHEMA_VERSION) {
      throw new KernelError("unsupported-record", "this owned state needs a compatible kernel or an approved migration; it was not quarantined", { exit: 4 });
    }
    if (!trusted || readdirSync(this.dir).some((name) => name.startsWith(QUARANTINE_JOURNAL))) {
      if (verb !== "open") throw new KernelError("marker-mismatch", "this ownership marker needs quarantine; open a fresh contract first", { exit: 3 });
      const bootstrap = `quarantine-bootstrap-${here.dev}-${here.ino}.lock`;
      const isOwned = () => {
        try { return !!this.marker(); }
        catch { return false; }
      };
      this.quarantined = await quarantine(this.dir, this.clock, this.rand, (name) => this.p(name), isOwned, async (fn) => {
        const lock = await this.claim("quarantine", bootstrap);
        try { return fn(); }
        finally { this.release(lock, bootstrap); }
      });
    }
    chmodSync(this.dir, 0o700);
    for (const name of ["marker", "state", "state.prev", "log"]) {
      if (existsSync(this.p(name))) chmodSync(this.p(name), 0o600);
    }
    if (!existsSync(this.p(".gitignore"))) writeFileSync(this.p(".gitignore"), "*\n");
    return this.claim(verb);
  }

  private async claim(verb: string, name = "lock"): Promise<LockInfo> {
    const me: LockInfo = { ...this.self(), nonce: this.rand.base32(12), verb };
    const tmp = this.p(`${name}.${me.nonce}`);
    writeSynced(tmp, JSON.stringify(me));
    const deadline = Date.now() + this.lockWaitMs;
    try {
      for (;;) {
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
      this.repairLogTail();
      const read = this.exists() ? this.read() : null;
      if (this.quarantined && read?.state.quarantine?.nonce === this.quarantined.nonce) this.finishQuarantine();
      const store = this;
      const tx: Tx = {
        state: read?.state ?? null,
        recovered: read?.recovered ?? false,
        ...(this.quarantined ? { quarantined: this.quarantined } : {}),
        ensure: () => store.ensureMarker(),
        publish: (next) => store.publishState(next),
        call: (entry) => store.append({ kind: "call", ...entry }),
        intent: (effect, id, op) => store.append({ kind: "intent", effect, id, op }),
        result: (effect, id, outcome) => store.append({ kind: "result", effect, id, outcome }),
        unresolved: () => store.unresolved(),
        recent: (n) => store.readLog().slice(-n),
      };
      return await fn(tx);
    } finally {
      this.release(me);
    }
  }

  private ensureMarker(): { workspaceId: string; tag: string } {
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
  }

  private finishQuarantine() {
    rmSync(this.p(`${QUARANTINE_JOURNAL}${this.quarantined!.nonce}`), { force: true });
    fsyncDir(this.dir); this.quarantined = undefined;
  }

  // ------------------------------------------------------------ log
  private repairLogTail() {
    const path = this.p("log");
    if (!existsSync(path)) return;
    const text = readFileSync(path, "utf8");
    if (!text) return;
    if (text.endsWith("\n")) {
      const body = text.slice(0, -1);
      if (!body) return;
      const start = body.lastIndexOf("\n") + 1;
      try { JSON.parse(body.slice(start)); return; } catch { /* torn line that happens to end in a newline */ }
      // Keep every complete line before the torn one; a single torn line leaves nothing.
      writeSynced(path, body.slice(0, start));
      return;
    }
    // A final line with no trailing newline is a torn write: truncate it; its effect is treated as intent-only.
    const keep = text.slice(0, text.lastIndexOf("\n") + 1);
    writeSynced(path, keep);
  }

  private append(entry: Omit<LogEntry, "t">) {
    const fd = openSync(this.p("log"), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT, 0o600);
    try { writeFileSync(fd, `${JSON.stringify({ t: this.clock.now(), ...entry })}\n`); fsyncSync(fd); } finally { closeSync(fd); }
  }

  readLog(): LogEntry[] {
    if (!existsSync(this.p("log"))) return [];
    return readFileSync(this.p("log"), "utf8").split("\n").filter(Boolean).flatMap((l) => { try { return [JSON.parse(l) as LogEntry]; } catch { return []; } });
  }

  private unresolved() {
    const log = this.readLog();
    const done = new Set(log.filter((e) => e.kind === "result").map((e) => `${e.effect}:${e.id}`));
    return log.filter((e) => e.kind === "intent" && !done.has(`${e.effect}:${e.id}`)).map((e) => ({ effect: e.effect!, id: e.id!, op: e.op }));
  }

  // ------------------------------------------------------------ blobs and temp
  putBlob(content: string): string {
    const h = sha256(content);
    mkdirSync(this.p("blobs"), { recursive: true, mode: 0o700 });
    if (!existsSync(this.p(`blobs/${h}`))) writeSynced(this.p(`blobs/${h}`), content);
    return h;
  }
  readBlob(hash: string): string | null {
    try { return readFileSync(this.p(`blobs/${hash}`), "utf8"); } catch { return null; }
  }

  tempDir(name: string): string {
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
    const old = (p: string) => { try { return Date.now() - statSync(p).mtimeMs > maxAgeMs; } catch { return false; } };
    for (const group of ["", "manifests", "review"]) {
      const dir = group ? join(base, group) : base;
      let names: string[] = [];
      try { names = readdirSync(dir); } catch { continue; }
      for (const n of names) {
        const p = join(dir, n);
        if ((group === "" && !n.startsWith("run-")) || keep.some((k) => k === p || k.startsWith(`${p}/`))) continue;
        if (old(p)) { rmSync(p, { recursive: true, force: true }); removed++; }
      }
    }
    return removed;
  }
  private tempBase(): string | null { try { return this.exists() ? join(tmpdir(), `tenet-${this.marker()!.workspaceId}`) : null; } catch { return null; } }
  canWrite(): boolean { try { accessSync(this.root, constants.W_OK); return true; } catch { return false; } }
}
