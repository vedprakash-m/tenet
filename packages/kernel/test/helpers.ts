import { dropGitLocalVars } from "../src/adapters/git-env.ts";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { systemClock, systemRandom } from "../src/adapters/system.ts";
import { FsStore } from "../src/adapters/store-fs.ts";
import { emptyState } from "../src/core/state.ts";

// Tests never depend on the developer's own Git configuration: identity is set per repository, nothing else is read.
dropGitLocalVars(process.env);
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

export const tmp = (prefix = "tenet-t-"): string => realpathSync(mkdtempSync(join(tmpdir(), prefix)));

const LEGACY_EFFECTS = new Set([
  "index-sync", "commit", "integration", "undo", "scaffold", "adopt", "dependency", "hardening", "branch", "forget",
]);

export function captureLegacy(dir: string, label = "settled") {
  const destination = process.env.TENET_LEGACY_CAPTURE_DIR;
  const store = join(dir, ".tenet");
  const journal = join(store, "log");
  if (!destination || !existsSync(journal)) return;
  const records = readFileSync(journal, "utf8").split("\n").filter(Boolean).map(line => JSON.parse(line) as { kind?: string; effect?: string });
  const effects = [...new Set(records.filter(record => record.kind === "intent").map(record => record.effect ?? ""))].sort();
  if (!effects.length || effects.some(effect => !LEGACY_EFFECTS.has(effect))) return;
  const source = basename(process.argv[1] ?? "test").replace(/[^a-zA-Z0-9._-]/g, "_");
  const target = join(destination, `${source}-${label}-${basename(dir)}`);
  mkdirSync(target, { recursive: true });
  cpSync(store, join(target, ".tenet"), { recursive: true, dereference: false, errorOnExist: true });
  writeFileSync(join(target, "capture.json"), JSON.stringify({ test: source, label, effects }, null, 2) + "\n");
}

/**
 * Skip reason for tests that spawn a long-lived child and need POSIX process identity or groups. On win32 there is no
 * `ps -o lstart=` start time, process.kill(-pid) throws ESRCH, and a killed process reports no signal. Without a skip
 * such a test fails before its cleanup runs and leaks the child, which keeps the whole test file from ending.
 * False on other platforms, so nothing is skipped there.
 */
export const NO_POSIX_PROCESSES: string | false =
  process.platform === "win32" ? "win32 has no POSIX process identity, process groups or signals (ps -o lstart=, kill(-pid))" : false;

export const cleanup = (dir: string) => {
  captureLegacy(dir);
  rmSync(dir, { recursive: true, force: true });
};

export function write(root: string, rel: string, content: string) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

export const git = (root: string, ...args: string[]): string => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();

/** A repository with a committer identity of its own and no signing. */
export function initRepo(root: string) {
  git(root, "init", "-q", "-b", "main");
  git(root, "config", "user.name", "Test");
  git(root, "config", "user.email", "test@example.com");
  git(root, "config", "commit.gpgsign", "false");
}

export function newStore(root: string, opts?: { lockWaitMs?: number }) {
  return new FsStore(root, systemClock, systemRandom, opts);
}

export async function initState(root: string) {
  const store = newStore(root);
  await store.transaction("test", async (tx) => {
    const { workspaceId, tag } = tx.ensure();
    tx.publish(emptyState(workspaceId, tag));
  });
  return store;
}
