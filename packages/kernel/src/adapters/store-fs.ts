// The filesystem Store (TS §7): one state document replaced atomically, a transaction lock with guarded stale-break,
// an append-only log with torn-write repair, hash-named blobs and the workspace marker.
import { accessSync, closeSync, constants, existsSync, fsyncSync, readdirSync, linkSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import type { Random } from "../core/ids.ts";
import { SCHEMA_VERSION, State } from "../core/schemas.ts";
import type { Clock, LogEntry, Store, Tx } from "../ports/types.ts";
import { isAlive, procStart } from "./proc.ts";

interface Marker { workspaceId: string; tag: string; nonce: string; schema: number; dev: number; ino: number }
interface LockInfo { pid: number; procStart: string; nonce: string; verb: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = <T>(p: string): T | null => { try { return JSON.parse(readFileSync(p, "utf8")) as T; } catch { return null; } };

function fsyncDir(dir: string) {
  const fd = openSync(dir, "r");
  try { fsyncSync(fd); } finally { closeSync(fd); }
}
function writeSynced(path: string, data: string) {
  const fd = openSync(path, "w", 0o600);
  try { writeSync(fd, data); fsyncSync(fd); } finally { closeSync(fd); }
}

export class FsStore implements Store {
  readonly dir: string;
  private root: string;
  private clock: Clock;
  private rand: Random;
  private lockWaitMs: number;

  constructor(root: string, clock: Clock, rand: Random, opts: { lockWaitMs?: number } = {}) {
    this.root = root;
    this.dir = join(root, ".tenet");
    this.clock = clock;
    this.rand = rand;
    this.lockWaitMs = opts.lockWaitMs ?? 3000;
  }

  private p = (f: string) => join(this.dir, f);

  exists(): boolean { return existsSync(this.p("marker")); }

  private marker(): Marker | null {
    const m = readJson<Marker>(this.p("marker"));
    if (!m) return null;
    const st = statSync(this.dir);
    // A copied directory has a new inode: its contents are inert (quarantine decision, TS §7.5).
    if (m.dev !== st.dev || m.ino !== st.ino) throw new KernelError("marker-mismatch", "this .tenet directory was copied or moved from elsewhere");
    return m;
  }

  read(): { state: State; recovered: boolean } | null {
    if (!this.exists()) return null;
    this.marker();
    for (const [file, recovered] of [["state", false], ["state.prev", true]] as const) {
      const raw = readJson<unknown>(this.p(file));
      const parsed = raw ? State.safeParse(raw) : null;
      if (parsed?.success) return { state: parsed.data, recovered };
    }
    if (!existsSync(this.p("state"))) return null; // marker written, first state not yet published
    throw new KernelError("unsupported-record", "the state document cannot be read and no previous revision exists");
  }

  // ------------------------------------------------------------ lock
  private async acquire(verb: string): Promise<LockInfo> {
    mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    if (!existsSync(this.p(".gitignore"))) writeFileSync(this.p(".gitignore"), "*\n");
    const me: LockInfo = { pid: process.pid, procStart: procStart(process.pid) ?? "", nonce: this.rand.base32(12), verb };
    const tmp = this.p(`lock.${me.nonce}`);
    writeSynced(tmp, JSON.stringify(me));
    const deadline = Date.now() + this.lockWaitMs;
    try {
      for (;;) {
        try { linkSync(tmp, this.p("lock")); return me; } // atomic exclusive create with complete content
        catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; }
        const held = readJson<LockInfo>(this.p("lock"));
        if (Date.now() > deadline) throw new KernelError("kernel-busy", held ? `held by ${held.verb} (pid ${held.pid})` : undefined);
        if (held && !isAlive(held.pid, held.procStart)) await this.breakStale(held, me);
        else await sleep(15 + Math.floor(Math.random() * 25));
      }
    } finally {
      rmSync(tmp, { force: true });
    }
  }

  /** Guarded break: no fresh lock can exist while the stale one does, so two breakers never remove a live lock. */
  private async breakStale(dead: LockInfo, me: LockInfo): Promise<void> {
    const guard = this.p("lock.break");
    try {
      const g = this.p(`lock.break.${me.nonce}`);
      writeSynced(g, JSON.stringify(me));
      try { linkSync(g, guard); } finally { rmSync(g, { force: true }); }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const other = readJson<LockInfo>(guard);
      // A dead guard is never broken automatically: its owner died mid-break (TS §7.3).
      if (other && !isAlive(other.pid, other.procStart)) throw new KernelError("lock-recovery-needed");
      await sleep(20);
      return;
    }
    try {
      const now = readJson<LockInfo>(this.p("lock"));
      if (now && now.nonce === dead.nonce) unlinkSync(this.p("lock"));
    } finally {
      rmSync(guard, { force: true });
    }
  }

  private release(me: LockInfo) {
    const held = readJson<LockInfo>(this.p("lock"));
    if (held?.nonce === me.nonce) rmSync(this.p("lock"), { force: true });
  }

  async repairLock(): Promise<{ removed: string[] }> {
    const removed: string[] = [];
    for (const f of ["lock", "lock.break"]) {
      const h = readJson<LockInfo>(this.p(f));
      if (h && isAlive(h.pid, h.procStart)) throw new KernelError("kernel-busy", `${f} is held by a live process`);
    }
    for (const f of ["lock", "lock.break"]) if (existsSync(this.p(f))) { rmSync(this.p(f)); removed.push(f); }
    return { removed };
  }

  // ------------------------------------------------------------ transaction
  async transaction<T>(verb: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    const me = await this.acquire(verb);
    try {
      this.repairLogTail();
      const read = this.exists() ? this.read() : null;
      const store = this;
      const tx: Tx = {
        state: read?.state ?? null,
        recovered: read?.recovered ?? false,
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
    const doc: State = { ...next, revision: (current?.revision ?? 0) + 1 };
    State.parse(doc); // fail closed on integrity: never publish a document the next reader would reject
    const tmp = this.p("state.tmp");
    writeSynced(tmp, JSON.stringify(doc));
    if (existsSync(this.p("state"))) {
      rmSync(this.p("state.prev.tmp"), { force: true });
      linkSync(this.p("state"), this.p("state.prev.tmp"));
      renameSync(this.p("state.prev.tmp"), this.p("state.prev"));
    }
    const moved = readJson<{ revision: number }>(this.p("state"));
    if ((moved?.revision ?? 0) !== (current?.revision ?? 0)) throw new KernelError("revision-conflict");
    renameSync(tmp, this.p("state"));
    fsyncDir(this.dir);
  }

  // ------------------------------------------------------------ log
  private repairLogTail() {
    const path = this.p("log");
    if (!existsSync(path)) return;
    const text = readFileSync(path, "utf8");
    if (!text || text.endsWith("\n")) {
      const lines = text.split("\n").filter(Boolean);
      if (!lines.length) return;
      try { JSON.parse(lines.at(-1)!); return; } catch { /* torn line that happens to end in a newline */ }
    }
    // A final line that does not parse is a torn write: truncate it; its effect is treated as intent-only.
    const keep = text.slice(0, text.lastIndexOf("\n") + 1);
    writeSynced(path, keep);
  }

  private append(entry: Omit<LogEntry, "t">) {
    const fd = openSync(this.p("log"), constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT, 0o600);
    try { writeSync(fd, `${JSON.stringify({ t: this.clock.now(), ...entry })}\n`); fsyncSync(fd); } finally { closeSync(fd); }
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
    const dir = join(tmpdir(), `tenet-${m?.workspaceId ?? "unbound"}`, name);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    return dir;
  }

  async alive(pid: number, start: string): Promise<boolean> { return isAlive(pid, start); }
  self() { return { pid: process.pid, procStart: procStart(process.pid) ?? "" }; }
  writeArtifact(dir: string, name: string, content: string): string {
    const path = join(dir, name);
    writeFileSync(path, content, { mode: 0o600 });
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
