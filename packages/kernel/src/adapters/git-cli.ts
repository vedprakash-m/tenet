// Git through argument arrays only (TS §10). Read-only calls use the inspection profile so user configuration cannot
// change what Tenet parses; blob identities for dirty files are computed in Node; the user's index is never rewritten
// except by the exact, locked sync after a commit.
import { execFile } from "node:child_process";
import { closeSync, constants, copyFileSync, existsSync, fsyncSync, lstatSync, mkdtempSync, openSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { allowed } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import type { FileChange, Hunk } from "../core/review.ts";
import type { CommitOutcome, CommitPlan, Entry, Git, Inventory, RepoProbe, StatusEntry } from "../ports/types.ts";

const MAX_UNTRACKED = 20_000;
const INSPECT = ["--no-pager", "-c", "core.fsmonitor=false", "-c", "diff.external=", "-c", "core.quotePath=false", "-c", "color.ui=never"];
const ZERO = "0".repeat(40);

interface Out { code: number; stdout: string; stderr: string }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Hash of the hook files present (names and contents), or null when there are none: consent binds to it. */
function hookInventory(dirs: string[]): string | null {
  const seen: string[] = [];
  for (const d of dirs) {
    let names: string[] = [];
    try { names = readdirSync(d).filter((f) => !f.endsWith(".sample") && !f.startsWith(".")).sort(); } catch { continue; }
    for (const f of names) { try { seen.push(`${d.split("/").slice(-2).join("/")}/${f}:${sha256(readFileSync(join(d, f)))}`); } catch { /* a directory */ } }
  }
  return seen.length ? sha256(seen.join("\n")).slice(0, 16) : null;
}

export const gitBlob = (content: Buffer): string => createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");

export class GitCli implements Git {
  private root: string;
  constructor(root: string) { this.root = root; }

  private run(args: string[], o: { env?: Record<string, string>; input?: string; inspect?: boolean; cwd?: string } = {}): Promise<Out> {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", ...(o.inspect === false ? {} : { GIT_OPTIONAL_LOCKS: "0" }), ...o.env };
    return new Promise((resolve) => {
      const c = execFile("git", [...(o.inspect === false ? ["--no-pager"] : INSPECT), ...args], { cwd: o.cwd ?? this.root, env, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
        (err, stdout, stderr) => resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0, stdout, stderr }));
      if (o.input !== undefined) c.stdin?.end(o.input); else c.stdin?.end();
    });
  }
  private async ok(args: string[], o?: Parameters<GitCli["run"]>[1]): Promise<string> {
    const r = await this.run(args, o);
    if (r.code !== 0) throw new KernelError("repo-state-readonly", `git ${args[0]} failed: ${r.stderr.trim().slice(0, 200)}`);
    return r.stdout;
  }
  private async tryOut(args: string[]): Promise<string | null> {
    const r = await this.run(args);
    return r.code === 0 ? r.stdout.trim() : null;
  }

  // ------------------------------------------------------------ probe
  async probe(): Promise<RepoProbe> {
    const version = ((await this.tryOut(["--version"])) ?? "git not found").replace(/^git version /, "");
    const top = await this.tryOut(["rev-parse", "--show-toplevel"]);
    if (!top) return { isRepo: false, version, top: null, head: null, branch: null, state: "none", identity: false, remotes: [], hooks: null };
    const head = await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]);
    const branch = await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]);
    const gitDir = (await this.tryOut(["rev-parse", "--absolute-git-dir"])) ?? join(top, ".git");
    const busy = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"].find((f) => existsSync(join(gitDir, f)));
    const conflicts = (await this.tryOut(["diff", "--name-only", "--diff-filter=U"])) ?? "";
    let state: RepoProbe["state"] = "ok", why: string | undefined;
    if (busy) [state, why] = ["readonly", `a ${busy.replace(/_HEAD$/, "").toLowerCase()} is in progress`];
    else if (conflicts) [state, why] = ["readonly", "there are unresolved conflicts"];
    else if (head && !branch) [state, why] = ["readonly", "HEAD is detached"];
    const identity = (await this.tryOut(["var", "GIT_COMMITTER_IDENT"])) !== null;
    const remotes = ((await this.tryOut(["remote"])) ?? "").split("\n").filter(Boolean);
    const hooksDir = (await this.tryOut(["config", "core.hooksPath"])) ?? join(gitDir, "hooks");
    const hooks = hookInventory([hooksDir.startsWith("/") ? hooksDir : join(top, hooksDir), join(top, ".husky")]);
    const probe: RepoProbe = { isRepo: true, version, top, head, branch, state, identity, remotes, hooks };
    if (why) probe.why = why;
    return probe;
  }

  // ------------------------------------------------------------ inventory
  async inventory(exclude: readonly string[] = []): Promise<Inventory> {
    const head = await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]);
    const branch = await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]);
    const skip = (p: string) => p === ".tenet" || p.startsWith(".tenet/") || exclude.some((x) => p === x || p.startsWith(`${x}/`));
    const index = new Map<string, Entry>();
    for (const rec of (await this.ok(["ls-files", "-s", "-z"])).split("\0").filter(Boolean)) {
      const tab = rec.indexOf("\t");
      const [mode, blob, stage] = rec.slice(0, tab).split(" ");
      const path = rec.slice(tab + 1);
      if (stage === "0" && !skip(path)) index.set(path, { path, mode: mode!, blob: blob! });
    }
    const status = await this.parseStatus(skip);
    const untracked = status.filter((s) => s.untracked).length;
    if (untracked > MAX_UNTRACKED) throw new KernelError("inventory-too-large", `${untracked} untracked files; add them to .gitignore`);

    const entries = new Map<string, Entry>();
    for (const [p, e] of index) entries.set(p, e);
    for (const s of status) {
      if (s.blob === "") entries.delete(s.path); // deleted in the working tree
      else entries.set(s.path, { path: s.path, mode: s.mode, blob: s.blob });
    }
    const lines: string[] = [];
    for (const e of [...entries.values()].sort((a, b) => (a.path < b.path ? -1 : 1))) {
      if (allowed("scan", e.path)) lines.push(`${e.path}\t${e.mode}\t${e.blob}`);
      else lines.push(`${e.path}\t${this.stat(e.path)}`); // excluded: stat only, a stat change is a change
    }
    return { head, branch, entries, status, digest: sha256(lines.join("\n")) };
  }

  private stat(rel: string): string {
    try { const s = lstatSync(join(this.root, rel)); return `stat:${s.size}:${Math.floor(s.mtimeMs)}:${s.mode}`; } catch { return "stat:absent"; }
  }

  /** Content identity of a working-tree path: Git's blob id, computed here, never following symlinks. */
  private workBlob(rel: string): { mode: string; blob: string } | null {
    const abs = join(this.root, rel);
    try {
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) return { mode: "120000", blob: gitBlob(Buffer.from(readlinkSync(abs))) };
      if (!st.isFile()) return null;
      const mode = st.mode & 0o111 ? "100755" : "100644";
      return { mode, blob: allowed("scan", rel) ? gitBlob(readFileSync(abs)) : sha256(this.stat(rel)).slice(0, 40) };
    } catch { return null; }
  }

  private async parseStatus(skip: (p: string) => boolean): Promise<StatusEntry[]> {
    const recs = (await this.ok(["status", "--porcelain=v2", "-z", "--untracked-files=all"])).split("\0");
    const out: StatusEntry[] = [];
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i]!;
      if (!r) continue;
      const kind = r[0];
      if (kind === "?") {
        const path = r.slice(2);
        const w = skip(path) ? null : this.workBlob(path);
        if (w) out.push({ path, xy: "??", staged: false, untracked: true, mode: w.mode, blob: w.blob, indexBlob: "" });
      } else if (kind === "1" || kind === "2" || kind === "u") {
        const f = r.split(" ");
        const n = kind === "1" ? 8 : kind === "2" ? 9 : 10;
        const path = f.slice(n).join(" ");
        if (kind === "2") i++; // the original path follows as its own NUL-separated record
        if (skip(path)) continue;
        const xy = f[1]!;
        const w = this.workBlob(path);
        const indexBlob = kind === "u" ? "" : f[kind === "2" ? 7 : 7]!;
        out.push({ path, xy, staged: xy[0] !== "." && xy[0] !== "?", untracked: false, mode: w?.mode ?? f[3]!, blob: w?.blob ?? "", indexBlob });
      }
    }
    return out;
  }

  // ------------------------------------------------------------ changes (hunks for attention and manifests)
  async changes(base: string | null, paths: readonly string[], classify: (p: string) => FileChange["kind"]): Promise<FileChange[]> {
    const out: FileChange[] = [];
    const wanted = paths.filter((p) => allowed("model-send", p)); // excluded content never enters a manifest
    // One call tells which of the paths exist in the base; the rest are new files.
    const inBase = new Set(base && wanted.length ? (await this.ok(["ls-tree", "-r", "-z", "--name-only", base, "--", ...wanted.map((p) => `:(literal)${p}`)])).split("\0").filter(Boolean) : []);
    const tracked = wanted.filter((p) => inBase.has(p));
    for (const p of wanted) if (!inBase.has(p)) out.push(this.wholeFile(p, classify(p)));
    if (tracked.length) {
      const diff = await this.ok(["diff", "--no-ext-diff", "--no-textconv", "--no-color", "-U0", "--no-renames", base!, "--", ...tracked.map((p) => `:(literal)${p}`)]);
      out.push(...parseDiff(diff, classify));
      for (const p of tracked) if (!out.some((c) => c.path === p)) out.push({ path: p, kind: classify(p), hunks: [], added: 0, removed: 0 });
    }
    return out.sort((a, b) => (a.path < b.path ? -1 : 1));
  }

  private wholeFile(path: string, kind: FileChange["kind"]): FileChange {
    let lines: string[] = [];
    try { lines = readFileSync(join(this.root, path), "utf8").split("\n"); if (lines.at(-1) === "") lines.pop(); } catch { /* deleted or unreadable */ }
    return { path, kind, hunks: lines.length ? [{ line: 1, added: lines, removed: [] }] : [], added: lines.length, removed: 0 };
  }

  // ------------------------------------------------------------ commit (temporary index, TS §10.3)
  /** Builds the tree a commit of exactly these paths would have, in a temporary index the user never sees. */
  private async buildTree(plan: Pick<CommitPlan, "paths" | "deleted" | "parent">, env: Record<string, string>): Promise<string> {
    if (plan.parent) await this.ok(["read-tree", plan.parent], { env, inspect: false }); else await this.ok(["read-tree", "--empty"], { env, inspect: false });
    const live = plan.paths.filter((p) => this.workBlob(p));
    if (live.length) await this.ok(["add", "--", ...live.map((p) => `:(literal)${p}`)], { env, inspect: false });
    const gone = [...plan.deleted, ...plan.paths.filter((p) => !this.workBlob(p))];
    if (gone.length) await this.ok(["update-index", "--force-remove", "--", ...gone], { env, inspect: false });
    return (await this.ok(["write-tree"], { env, inspect: false })).trim();
  }

  async expectedTree(plan: Pick<CommitPlan, "paths" | "deleted" | "parent">): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "tenet-idx-"));
    try { return await this.buildTree(plan, { GIT_INDEX_FILE: join(dir, "index") }); } finally { rmSync(dir, { recursive: true, force: true }); }
  }

  async commit(plan: CommitPlan): Promise<CommitOutcome> {
    const fail = (reason: string, detail?: string): CommitOutcome => ({ ok: false, reason, ...(detail ? { detail } : {}), foreign: [], indexSync: "untouched", syncPaths: [] });
    const dir = mkdtempSync(join(tmpdir(), "tenet-idx-"));
    const env = { GIT_INDEX_FILE: join(dir, "index") };
    try {
      const expectedTree = await this.buildTree(plan, env);
      const baseTree = plan.parent ? (await this.ok(["rev-parse", `${plan.parent}^{tree}`])).trim() : null;
      if (expectedTree === baseTree) return { ...fail("nothing-to-commit"), expectedTree };
      const r = await this.run(["commit", "-m", plan.message, "--allow-empty-message"], { env, inspect: false });
      if (r.code !== 0) {
        const text = `${r.stdout}\n${r.stderr}`;
        const reason = /gpg|sign/i.test(text) ? "signing-unavailable" : /Author identity unknown|empty ident|tell me who you are/i.test(text) ? "git-identity-missing"
          : /index\.lock/.test(text) ? "git-locked" : "hook-failed";
        return { ...fail(reason, text.trim().slice(-400)), expectedTree };
      }
      const commit = (await this.ok(["rev-parse", "HEAD"])).trim();
      const parent = (await this.tryOut(["rev-parse", `${commit}^`])) ?? null;
      if (parent !== plan.parent) return { ...fail("hook-failed", "HEAD moved during the commit"), expectedTree };
      const tree = (await this.ok(["rev-parse", `${commit}^{tree}`])).trim();
      const changed = (await this.ok(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--root", commit])).split("\0").filter(Boolean);
      const mine = new Set([...plan.paths, ...plan.deleted]);
      const foreign = changed.filter((p) => !mine.has(p));
      const sync = await this.syncIndex(changed.filter((p) => mine.has(p)), plan.parent);
      return { ok: true, commit, tree, expectedTree, foreign, indexSync: sync, syncPaths: sync === "untouched" ? [...mine] : [] };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async reconcileCommit(parent: string | null, expectedTree: string, tenetPaths: readonly string[]): Promise<{ completed: boolean; commit?: string }> {
    const head = await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]);
    if (!head || head === parent) return { completed: false };
    if ((await this.tryOut(["rev-parse", `${head}^`])) !== parent) return { completed: false };
    const tree = await this.tryOut(["rev-parse", `${head}^{tree}`]);
    if (tree === expectedTree) return { completed: true, commit: head };
    // A hook may have reformatted Tenet files: the trees may differ only on Tenet paths.
    const diff = (await this.tryOut(["diff-tree", "-r", "--name-only", "-z", expectedTree, head])) ?? "";
    const only = diff.split("\0").filter(Boolean).every((p) => tenetPaths.includes(p));
    return only ? { completed: true, commit: head } : { completed: false };
  }

  /** Exact index sync under Git's own lock (GIT-03): only entries still equal to the old HEAD's are advanced. */
  async syncIndex(paths: readonly string[], oldHead: string | null): Promise<CommitOutcome["indexSync"]> {
    if (!paths.length) return "not-needed";
    const gitDir = (await this.ok(["rev-parse", "--absolute-git-dir"])).trim();
    if (readdirSync(gitDir).some((f) => f.startsWith("sharedindex."))) return "untouched";
    const lock = join(gitDir, "index.lock");
    let fd = -1;
    for (let i = 0; i < 3 && fd < 0; i++) {
      try { fd = openSync(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600); } catch { await sleep(40); }
    }
    if (fd < 0) return "untouched";
    const scratchDir = mkdtempSync(join(tmpdir(), "tenet-sync-"));
    try {
      const scratch = join(scratchDir, "index");
      if (existsSync(join(gitDir, "index"))) copyFileSync(join(gitDir, "index"), scratch);
      const env = { GIT_INDEX_FILE: scratch };
      const lit = paths.map((p) => `:(literal)${p}`);
      // ls-files -s prints "mode blob stage\tpath" and ls-tree prints "mode type blob\tpath": both reduce to "mode blob".
      const parse = (out: string, blobAt: number) => new Map(out.split("\0").filter(Boolean).map((r) => {
        const t = r.indexOf("\t"), f = r.slice(0, t).split(" ");
        return [r.slice(t + 1), `${f[0]} ${f[blobAt]}`] as const;
      }));
      const idx = parse(await this.ok(["ls-files", "-s", "-z", "--", ...lit], { env }), 1);
      const old = oldHead ? parse(await this.ok(["ls-tree", "-r", "-z", oldHead, "--", ...paths]), 2) : new Map<string, string>();
      const next = parse(await this.ok(["ls-tree", "-r", "-z", "HEAD", "--", ...paths]), 2);
      const info: string[] = [];
      for (const p of paths) {
        if ((idx.get(p) ?? "") !== (old.get(p) ?? "")) continue; // the user staged something else here: never touched
        const n = next.get(p);
        info.push(n ? `${n.split(" ")[0]} ${n.split(" ")[1]}\t${p}` : `0 ${ZERO}\t${p}`);
      }
      if (info.length) await this.ok(["update-index", "--index-info"], { env, input: `${info.join("\n")}\n` });
      writeSync(fd, readFileSync(scratch));
      fsyncSync(fd); closeSync(fd); fd = -1;
      renameSync(lock, join(gitDir, "index"));
      return "synced";
    } catch {
      return "untouched";
    } finally {
      if (fd >= 0) closeSync(fd);
      rmSync(lock, { force: true });
      rmSync(scratchDir, { recursive: true, force: true });
    }
  }

  async ancestors(commits: readonly string[]): Promise<Set<string>> {
    const out = new Set<string>();
    for (const c of new Set(commits)) if ((await this.run(["merge-base", "--is-ancestor", c, "HEAD"])).code === 0) out.add(c);
    return out;
  }

  async init(): Promise<void> { await this.ok(["init", "-q"], { inspect: false }); }

  async createBranch(name: string): Promise<void> {
    if ((await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"])) === name) return;
    await this.ok(["checkout", "-q", "-b", name], { inspect: false });
  }
}

/** Parses `git diff -U0` into per-file hunks of added and removed lines. */
function parseDiff(diff: string, classify: (p: string) => FileChange["kind"]): FileChange[] {
  const files: FileChange[] = [];
  let cur: FileChange | null = null, hunk: Hunk | null = null, from = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      cur = null; hunk = null; from = "";
    } else if (!cur && line.startsWith("--- ")) {
      from = line.slice(4).replace(/^a\//, "");
    } else if (!cur && line.startsWith("+++ ")) {
      const to = line.slice(4);
      const path = to === "/dev/null" ? from : to.replace(/^b\//, "");
      cur = { path, kind: classify(path), hunks: [], added: 0, removed: 0 };
      files.push(cur);
    } else if (line.startsWith("@@") && cur) {
      const m = /\+(\d+)/.exec(line);
      hunk = { line: Number(m?.[1] ?? 1), added: [], removed: [] };
      cur.hunks.push(hunk);
    } else if (hunk && cur) {
      if (line.startsWith("+")) { hunk.added.push(line.slice(1)); cur.added++; }
      else if (line.startsWith("-")) { hunk.removed.push(line.slice(1)); cur.removed++; }
    }
  }
  return files;
}
