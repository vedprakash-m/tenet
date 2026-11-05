// Remote Git commands (TS §10.6, GIT-05): pushing one exact commit, and the `ls-remote` read that confirms it. These are
// the only remote commands in the kernel (tools/lint-arch.ts). The caller holds the user's agreement to the remote, the
// branch and the commit; this file never forces a push and never runs a hook.
import { execFile } from "node:child_process";
import { redact } from "../core/redact.ts";
import type { Pushed, Seen } from "../core/remote.ts";
import type { RemoteRun, Runner } from "../ports/types.ts";

const GIT = ["git", "--no-pager", "-c", "core.fsmonitor=false", "-c", "protocol.ext.allow=never"];
const CONFIG_OVERRIDES = ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"];
/** No prompt can wait for a person; the test-only config overrides pass through as they do for every other Git command. */
const env = (): Record<string, string> => ({
  GIT_TERMINAL_PROMPT: "0",
  ...Object.fromEntries(CONFIG_OVERRIDES.flatMap((k) => (process.env[k] === undefined ? [] : [[k, process.env[k]!]]))),
});
const tail = (s: string) => redact(s.trim()).slice(-400);
const withoutCredentials = (url: string) => url.replace(/^([a-z][a-z0-9+.-]*:\/\/)[^/@]*@/i, "$1");

export class GitRemote {
  private root: string;
  private runner: Runner;
  constructor(root: string, runner: Runner) {
    this.root = root;
    this.runner = runner;
  }

  /** The URL a push to this remote would use, without credentials; null when no such remote is configured. */
  pushUrl(remote: string): Promise<string | null> {
    const args = [...GIT.slice(1), "remote", "get-url", "--push", remote];
    return new Promise((resolve) => {
      execFile("git", args, { cwd: this.root, encoding: "utf8", env: { ...process.env, ...env() } }, (err, out) =>
        resolve(err ? null : withoutCredentials(out.trim()) || null)
      );
    });
  }

  /** `git push <remote> <commit>:refs/heads/<branch>`: never forced, and `--no-verify` because no hook was consented to. */
  async push(remote: string, commit: string, branch: string, run: RemoteRun): Promise<{ result: Pushed; detail?: string }> {
    const argv = [...GIT, "push", "--no-verify", "--", remote, `${commit}:refs/heads/${branch}`];
    const r = await this.runner.run({ argv, cwd: this.root, runDir: run.runDir, timeoutMs: run.timeoutMs, env: env() });
    const detail = tail(`${r.stdout}${r.stderr}`);
    if (r.timedOut || r.signal) return { result: "interrupted", detail };
    return r.exit === 0 ? { result: "ok" } : { result: "rejected", detail };
  }

  /** What `git ls-remote` shows for refs/heads/<branch>: its commit, or none when absent; null when the remote cannot be read. */
  async remoteBranch(remote: string, branch: string, run: RemoteRun): Promise<Seen> {
    const ref = `refs/heads/${branch}`;
    const argv = [...GIT, "ls-remote", "--", remote, ref];
    const r = await this.runner.run({ argv, cwd: this.root, runDir: run.runDir, timeoutMs: run.timeoutMs, env: env() });
    if (r.exit !== 0 || r.timedOut || r.signal) return null;
    const row = r.stdout.split("\n").map((line) => line.split("\t")).find(([, name]) => name === ref);
    return { commit: row?.[0] ?? null };
  }
}
