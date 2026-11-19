import {
  closeSync,
  constants,
  existsSync,
  fsyncSync,
  lstatSync,
  openSync,
  readFileSync,
  linkSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { KernelError } from "../core/errors.ts";
import { isAlive, procStart } from "./proc.ts";

interface LockInfo { pid: number; procStart: string; nonce: string; verb: string }

const refuse = (code: "kernel-busy" | "lock-recovery-needed", detail: string): never => {
  throw new KernelError(code, detail, { exit: 2 });
};

function syncDir(path: string): void {
  const fd = openSync(path, "r");
  try {
    try { fsyncSync(fd); }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (process.platform !== "win32" || (code !== "EPERM" && code !== "EINVAL")) throw error;
    }
  } finally { closeSync(fd); }
}

function writeLock(path: string, value: LockInfo, exclusive: boolean): void {
  const flags = constants.O_WRONLY | constants.O_CREAT | constants.O_NOFOLLOW |
    (exclusive ? constants.O_EXCL : constants.O_TRUNC);
  const fd = openSync(path, flags, 0o600);
  try {
    writeFileSync(fd, JSON.stringify(value));
    fsyncSync(fd);
  } finally { closeSync(fd); }
}

function held(path: string): LockInfo | null {
  const stat = lstatSync(path, { throwIfNoEntry: false });
  if (!stat) return null;
  if (stat.isSymbolicLink() || !stat.isFile()) {
    return refuse("lock-recovery-needed", "the candidate operation found a linked or nonregular lock");
  }
  try {
    const value = JSON.parse(readFileSync(path, "utf8")) as LockInfo;
    if (!Number.isSafeInteger(value.pid) || value.pid < 1 || !value.procStart || !value.nonce || !value.verb) {
      return refuse("lock-recovery-needed", "the candidate operation found a malformed lock");
    }
    return value;
  } catch (error) {
    if (error instanceof KernelError) throw error;
    return refuse("lock-recovery-needed", "the candidate operation could not admit its lock");
  }
}

function self(operationId: string): LockInfo {
  const start = procStart(process.pid) ?? (process.platform === "win32" ? `pid-${process.pid}` : null);
  if (!start) return refuse("lock-recovery-needed", "this process has no admitted start identity");
  return { pid: process.pid, procStart: start, nonce: operationId, verb: "marker-continuity" };
}

function breakDead(dir: string, name: string, dead: LockInfo, mine: LockInfo): void {
  const guard = join(dir, `${name}.break`);
  if (existsSync(guard)) refuse("lock-recovery-needed", "a dead guard prevents recursive lock repair");
  const temp = join(dir, `${name}.break.${mine.pid}.${mine.nonce}`);
  writeLock(temp, mine, true);
  try {
    linkSync(temp, guard);
    const now = held(join(dir, name));
    if (now?.nonce === dead.nonce && now.pid === dead.pid) rmSync(join(dir, name));
    syncDir(dir);
  } finally {
    if (existsSync(guard)) rmSync(guard);
    if (existsSync(temp)) rmSync(temp);
    syncDir(dir);
  }
}

function claim(dir: string, name: string, operationId: string): LockInfo {
  const mine = self(operationId);
  const final = join(dir, name);
  const temp = join(dir, `${name}.${mine.pid}.${operationId}.tmp`);
  writeLock(temp, mine, true);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        linkSync(temp, final);
        syncDir(dir);
        return mine;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      }
      const other = held(final);
      if (!other) continue;
      if (isAlive(other.pid, other.procStart)) refuse("kernel-busy", `held by ${other.verb} (pid ${other.pid})`);
      breakDead(dir, name, other, mine);
    }
    return refuse("kernel-busy", `the candidate operation could not claim ${name}`);
  } finally {
    if (existsSync(temp)) rmSync(temp);
  }
}

function release(dir: string, name: string, mine: LockInfo): void {
  const current = held(join(dir, name));
  if (current?.pid === mine.pid && current.nonce === mine.nonce) rmSync(join(dir, name));
  syncDir(dir);
}

export function withCandidateLocks<T>(workspace: string, operationId: string, fn: () => T): T {
  const dir = join(workspace, ".tenet");
  const stat = lstatSync(dir, { bigint: true });
  const bootstrap = `quarantine-bootstrap-${Number(stat.dev)}-${Number(stat.ino)}.lock`;
  const first = claim(dir, bootstrap, operationId);
  let second: LockInfo | undefined;
  try {
    second = claim(dir, "lock", operationId);
    return fn();
  } finally {
    if (second) release(dir, "lock", second);
    release(dir, bootstrap, first);
  }
}
