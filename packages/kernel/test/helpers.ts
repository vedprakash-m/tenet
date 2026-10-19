import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { systemClock, systemRandom } from "../src/adapters/system.ts";
import { FsStore } from "../src/adapters/store-fs.ts";
import { emptyState } from "../src/core/state.ts";

// Tests never depend on the developer's own Git configuration: identity is set per repository, nothing else is read.
process.env.GIT_CONFIG_GLOBAL = "/dev/null";
process.env.GIT_CONFIG_NOSYSTEM = "1";

export const tmp = (prefix = "tenet-t-"): string => realpathSync(mkdtempSync(join(tmpdir(), prefix)));
export const cleanup = (dir: string) => rmSync(dir, { recursive: true, force: true });

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
