// Git through argument arrays only (TS §10). Read-only calls use the inspection profile so user configuration cannot
// change what Tenet parses; blob identities for dirty files are computed in Node; the user's index is never rewritten
// except by the exact, locked sync after a commit.
import { execFile } from "node:child_process";
import { closeSync, constants, copyFileSync, existsSync, fstatSync, fsyncSync, linkSync, lstatSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readlinkSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { allowed, isKernelFile } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import type { FileChange, Hunk } from "../core/review.ts";
import type { CommitOutcome, CommitPlan, Entry, Git, IndexJournal, Inventory, RepoProbe, Runner, StatusEntry } from "../ports/types.ts";
import { IndexSyncRecord } from "../core/schemas.ts";
import { ProcessRunner } from "./runner.ts";
import { isAlive, procStart } from "./proc.ts";
import { systemClock } from "./system.ts";

const MAX_UNTRACKED = 20_000;
const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;
/** What a shadow repository never copies: secrets, dependencies and build output (TS §10.9). */
const SHADOW_EXCLUDE = [".tenet/", ".env", ".env.*", "!.env.example", "*.pem", "*.key", "*.p12", "id_rsa*", "id_ed25519*", "node_modules", "dist/", "build/", "coverage/", ".next/", "*.log"];
const INSPECT = ["--no-pager", "-c", "core.fsmonitor=false", "-c", "diff.external=", "-c", "core.quotePath=false", "-c", "color.ui=never"];
const ZERO = "0".repeat(40);

interface Out { code: number; stdout: string; stderr: string }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sameFile = (path: string, id: { dev: number; ino: number }) => { try { const st = lstatSync(path); return st.isFile() && !st.isSymbolicLink() && st.dev === id.dev && st.ino === id.ino; } catch { return false; } };
const syncDir = (path: string) => { const fd = openSync(path, "r"); try { fsyncSync(fd); } finally { closeSync(fd); } };
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
  private exclusions: readonly Exclusion[] = [];
  private runner: Runner;
  constructor(root: string, runner: Runner = new ProcessRunner(systemClock, process.env)) { this.root = root; this.runner = runner; }
  setExclusions(exclusions: readonly Exclusion[]): void { this.exclusions = exclusions; }

  private get shadowDir(): string { return join(this.root, ".tenet/git"); }
  /** A folder with no Git of its own but a shadow repository uses `--git-dir=.tenet/git --work-tree=<folder>`. */
  private get shadow(): boolean { return !existsSync(join(this.root, ".git")) && existsSync(join(this.shadowDir, "HEAD")); }

  private run(args: string[], o: { env?: Record<string, string>; input?: string; inspect?: boolean; cwd?: string } = {}): Promise<Out> {
    const env = { ...process.env, GIT_TERMINAL_PROMPT: "0", ...(o.inspect === false ? {} : { GIT_OPTIONAL_LOCKS: "0" }), ...o.env };
    return new Promise((resolve) => {
      const where = this.shadow ? ["--git-dir", this.shadowDir, "--work-tree", this.root] : [];
      const c = execFile("git", [...where, ...(o.inspect === false ? ["--no-pager"] : INSPECT), ...args], { cwd: o.cwd ?? this.root, env, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" },
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
    if (!top) return { isRepo: false, shadow: false, version, top: null, head: null, branch: null, state: "none", identity: false, remotes: [], hooks: null };
    const head = await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]);
    const branch = await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]);
    const gitDir = (await this.tryOut(["rev-parse", "--absolute-git-dir"])) ?? join(top, ".git");
    const busy = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"].find((f) => existsSync(join(gitDir, f)));
    const conflicts = (await this.tryOut(["diff", "--cached", "--name-only", "--diff-filter=U"])) ?? "";
    let state: RepoProbe["state"] = "ok", why: string | undefined;
    if (busy) [state, why] = ["readonly", `a ${busy.replace(/_HEAD$/, "").toLowerCase()} is in progress`];
    else if (conflicts) [state, why] = ["readonly", "there are unresolved conflicts"];
    else if (head && !branch) [state, why] = ["readonly", "HEAD is detached"];
    const identity = (await this.tryOut(["var", "GIT_COMMITTER_IDENT"])) !== null;
    const remotes = ((await this.tryOut(["remote"])) ?? "").split("\n").filter(Boolean);
    const hooksDir = (await this.tryOut(["config", "core.hooksPath"])) ?? join(gitDir, "hooks");
    const hooks = hookInventory([hooksDir.startsWith("/") ? hooksDir : join(top, hooksDir), join(top, ".husky")]);
    const probe: RepoProbe = { isRepo: true, shadow: this.shadow, version, top, head, branch, state, identity, remotes, hooks };
    if (why) probe.why = why;
    return probe;
  }

  private async inspectionSafe(): Promise<void> {
    if (await this.tryOut(["config", "--get-regexp", "^filter\\..*\\.(clean|process)$"])) throw new KernelError("filter-consent-needed", "configured Git filters may run project code; working-tree inspection is unavailable until filter consent is implemented", { exit: 3 });
    if (await this.tryOut(["rev-parse", "--show-object-format"]) === "sha256") throw new KernelError("capability-missing", "SHA-256 Git repositories are not supported by this adapter", { exit: 2 });
  }

  // ------------------------------------------------------------ inventory
  async inventory(exclude: readonly string[] = [], declaredInputs: readonly string[] = []): Promise<Inventory> {
    await this.inspectionSafe();
    const head = await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]);
    const branch = await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]);
    const skip = (p: string) => isKernelFile(p) || exclude.some((x) => p === x || p.startsWith(`${x}/`));
    const index = new Map<string, Entry>();
    for (const rec of (await this.ok(["ls-files", "-s", "-z"])).split("\0").filter(Boolean)) {
      const tab = rec.indexOf("\t");
      const [mode, blob, stage] = rec.slice(0, tab).split(" ");
      const path = rec.slice(tab + 1);
      if (stage === "0" && !skip(path)) index.set(path, { path, mode: mode!, blob: blob! });
    }
    const others = (await this.ok(["ls-files", "--others", "--exclude-standard", "-z"])).split("\0").filter(p => p && !skip(p));
    if (others.length > MAX_UNTRACKED) throw new KernelError("inventory-too-large", `${others.length} untracked files; add them to .gitignore`);
    const statOnly = [...index.keys(), ...others].filter(p => !allowed("scan", p, this.exclusions));
    const status = await this.parseStatus(skip, statOnly);
    for (const path of others.filter(p => statOnly.includes(p))) {
      const content = this.workBlob(path);
      if (content) status.push({ path, xy: "??", staged: false, untracked: true, ...content, indexBlob: "" });
    }
    const untracked = status.filter((s) => s.untracked).length;
    if (untracked > MAX_UNTRACKED) throw new KernelError("inventory-too-large", `${untracked} untracked files; add them to .gitignore`);

    const entries = new Map<string, Entry>();
    for (const [p, e] of index) entries.set(p, e);
    for (const s of status) {
      if (s.blob === "") entries.delete(s.path); // deleted in the working tree
      else entries.set(s.path, { path: s.path, mode: s.mode, blob: s.blob });
    }
    // Git status deliberately hides these paths. Their actual content must still enter the candidate identity.
    for (const rec of (await this.ok(["ls-files", "-v", "-z"])).split("\0").filter(Boolean)) {
      if (rec[0] === "H") continue;
      const path = rec.slice(2);
      if (skip(path) || !index.has(path)) continue;
      const content = this.workBlob(path);
      if (content) {
        entries.set(path, { path, ...content });
        if (content.blob !== index.get(path)!.blob && !status.some(s => s.path === path)) status.push({ path, xy: ".M", staged: false, untracked: false, ...content, indexBlob: index.get(path)!.blob });
      }
    }
    // Explicit tests/support/configuration are inputs even when ignored. Never ask Git to interpret them as patterns.
    for (const path of new Set(declaredInputs)) {
      if (skip(path)) continue;
      if (path.startsWith("/") || path.split("/").includes("..")) throw new KernelError("capability-missing", "a declared input leaves the workspace", { exit: 2 });
      this.contentPath(path, true);
      const content = this.workBlob(path);
      if (!content) { entries.delete(path); continue; }
      entries.set(path, { path, ...content });
      if (!index.has(path) && !status.some(s => s.path === path)) status.push({ path, xy: "??", staged: false, untracked: true, ...content, indexBlob: "" });
    }
    const lines: string[] = [];
    for (const e of [...entries.values()].sort((a, b) => (a.path < b.path ? -1 : 1))) {
      if (allowed("scan", e.path, this.exclusions)) lines.push(`${e.path}\t${e.mode}\t${e.blob}`);
      else lines.push(`${e.path}\t${this.stat(e.path)}`); // excluded: stat only, a stat change is a change
    }
    return { head, branch, entries, status, digest: sha256(lines.join("\n")) };
  }

  private stat(rel: string): string {
    try { const path = this.contentPath(rel); if (!path) return "stat:unavailable"; const s = lstatSync(path); return `stat:${s.size}:${Math.floor(s.mtimeMs)}:${s.mode}`; } catch { return "stat:absent"; }
  }

  /** A file may itself be a link, but content lookup never traverses a linked parent directory. */
  private contentPath(rel: string, required = false): string | null {
    const root = resolve(this.root), path = resolve(root, rel);
    if (!path.startsWith(root + sep)) return null;
    try { for (let dir = dirname(path); dir !== root; dir = dirname(dir)) if (lstatSync(dir).isSymbolicLink()) {
      if (required) throw new KernelError("capability-missing", `a declared input traverses a linked directory: ${rel}`, { exit: 2 });
      return null;
    } }
    catch (e) { if (e instanceof KernelError) throw e; return null; }
    return path;
  }

  /** Content identity of a working-tree path: Git's blob id, computed here, never following symlinks. */
  private workBlob(rel: string): { mode: string; blob: string } | null {
    const abs = this.contentPath(rel);
    if (!abs) return null;
    try {
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) return { mode: "120000", blob: gitBlob(Buffer.from(readlinkSync(abs))) };
      if (!st.isFile()) return null;
      const mode = st.mode & 0o111 ? "100755" : "100644";
      return { mode, blob: allowed("scan", rel, this.exclusions) ? gitBlob(readFileSync(abs)) : sha256(this.stat(rel)).slice(0, 40) };
    } catch { return null; }
  }

  private async parseStatus(skip: (p: string) => boolean, statOnly: readonly string[]): Promise<StatusEntry[]> {
    const recs = (await this.ok(["status", "--porcelain=v2", "-z", "--untracked-files=all", "--", ".", ...statOnly.map(p => `:(exclude,literal)${p}`)])).split("\0");
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
    await this.inspectionSafe();
    const out: FileChange[] = [];
    const wanted = paths.filter((p) => allowed("model-send", p, this.exclusions)); // excluded content never enters a manifest
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
    try { const p = this.contentPath(path); if (p) { lines = (lstatSync(p).isSymbolicLink() ? readlinkSync(p) : readFileSync(p, "utf8")).split("\n"); if (lines.at(-1) === "") lines.pop(); } } catch { /* deleted or unreadable */ }
    return { path, kind, hunks: lines.length ? [{ line: 1, added: lines, removed: [] }] : [], added: lines.length, removed: 0 };
  }

  // ------------------------------------------------------------ commit (temporary index, TS §10.3)
  /** Builds the tree a commit of exactly these paths would have, in a temporary index the user never sees. */
  private async buildTree(plan: Pick<CommitPlan, "paths" | "deleted" | "parent">, env: Record<string, string>): Promise<string> {
    await this.inspectionSafe();
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
    let expectedTree: string | undefined, launched = false;
    try {
      if (await this.tryOut(["config", "--bool", "commit.gpgsign"]) === "true") return fail("signing-unavailable", "configured signing programs require consent that is not implemented; the commit was not attempted");
      const before = await this.inventory([]);
      const excludedBefore = new Map([...before.entries.keys()].filter(p => !allowed("scan", p, this.exclusions)).map(p => [p, this.stat(p)]));
      expectedTree = await this.buildTree(plan, env);
      const baseTree = plan.parent ? (await this.ok(["rev-parse", `${plan.parent}^{tree}`])).trim() : null;
      if (expectedTree === baseTree) return { ...fail("nothing-to-commit"), expectedTree };
      const gitConfig = Object.fromEntries(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"].flatMap(k => process.env[k] === undefined ? [] : [[k, process.env[k]!]]));
      const where = this.shadow ? ["--git-dir", this.shadowDir, "--work-tree", this.root] : [];
      launched = true;
      const r = await this.runner.run({ argv: ["git", ...where, "--no-pager", "commit", "-m", plan.message, "--allow-empty-message"], cwd: this.root, runDir: plan.runDir ?? join(dir, "run"), timeoutMs: plan.timeoutMs, env: { ...env, ...gitConfig, GIT_TERMINAL_PROMPT: "0" } });
      if (r.exit !== 0 || r.signal || r.timedOut) {
        const head = await this.refCommit("HEAD");
        if (head !== plan.parent) return { ...fail("effect-uncertain", "HEAD moved during a failed or interrupted commit; its outcome needs reconciliation"), expectedTree, ...(head ? { commit: head } : {}) };
        if (r.timedOut) return { ...fail("hook-failed", "the commit timed out; its process group was stopped"), expectedTree };
        const text = `${r.stdout}\n${r.stderr}`;
        const reason = /gpg|sign/i.test(text) ? "signing-unavailable" : /Author identity unknown|empty ident|tell me who you are/i.test(text) ? "git-identity-missing"
          : /index\.lock/.test(text) ? "git-locked" : "hook-failed";
        return { ...fail(reason, text.trim().slice(-400)), expectedTree };
      }
      const commit = (await this.ok(["rev-parse", "HEAD"])).trim();
      const parent = (await this.tryOut(["rev-parse", `${commit}^`])) ?? null;
      if (parent !== plan.parent) return { ...fail("effect-uncertain", "HEAD moved during the commit; the observed commit has a different parent"), expectedTree, commit };
      const tree = (await this.ok(["rev-parse", `${commit}^{tree}`])).trim();
      const changed = (await this.ok(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--root", commit])).split("\0").filter(Boolean);
      const mine = new Set([...plan.paths, ...plan.deleted]);
      const after = await this.inventory([]);
      const touched = [...new Set([...before.entries.keys(), ...after.entries.keys()])].filter(p => {
        const a = before.entries.get(p), b = after.entries.get(p);
        return a?.blob !== b?.blob || a?.mode !== b?.mode || (excludedBefore.has(p) && excludedBefore.get(p) !== this.stat(p));
      });
      const foreign = [...new Set([...changed, ...touched].filter((p) => !mine.has(p)))].sort();
      const sync = await this.syncIndex(changed.filter((p) => mine.has(p)), plan.parent, plan.indexJournal, commit);
      return { ok: true, commit, tree, expectedTree, foreign, indexSync: sync, syncPaths: sync === "untouched" ? [...mine] : [] };
    } catch (e) {
      if (!launched) throw e;
      const head = await this.refCommit("HEAD");
      return { ...fail("effect-uncertain", `commit execution or postcondition inspection could not be verified: ${String(e)}`), expectedTree, ...(head ? { commit: head } : {}) };
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
  async syncIndex(paths: readonly string[], oldHead: string | null, journal?: IndexJournal, head?: string): Promise<CommitOutcome["indexSync"]> {
    if (!paths.length) return "not-needed";
    const gitDir = (await this.ok(["rev-parse", "--absolute-git-dir"])).trim();
    if (readdirSync(gitDir).some((f) => f.startsWith("sharedindex."))) return "untouched";
    const target = head ?? await this.refCommit("HEAD");
    if (!target || await this.refCommit("HEAD") !== target) return "untouched";
    const lock = join(gitDir, "index.lock"), temp = `tenet-index-${randomUUID()}.lock`, stagedLock = join(gitDir, temp);
    let fd = openSync(stagedLock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    const acquired = fstatSync(fd), ownsLock = () => sameFile(lock, acquired);
    const scratchDir = mkdtempSync(join(tmpdir(), "tenet-sync-"));
    let logged = false, published = false, status: CommitOutcome["indexSync"] = "untouched";
    try {
      fsyncSync(fd); syncDir(gitDir);
      const record = IndexSyncRecord.parse({ parent: oldHead, head: target, paths, dev: acquired.dev, ino: acquired.ino, temp, ...(journal?.owner ?? { pid: process.pid, procStart: procStart(process.pid) ?? "" }) });
      if (journal) { await journal.intent(record); logged = true; }
      let linked = false;
      for (let i = 0; i < 3 && !linked; i++) {
        try { linkSync(stagedLock, lock); linked = true; syncDir(gitDir); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e; await sleep(40); }
      }
      if (!linked) return status;
      const scratch = join(scratchDir, "index");
      if (existsSync(join(gitDir, "index")) && !lstatSync(join(gitDir, "index")).isFile()) return status;
      if (existsSync(join(gitDir, "index"))) copyFileSync(join(gitDir, "index"), scratch);
      const env = { GIT_INDEX_FILE: scratch };
      const lit = paths.map((p) => `:(literal)${p}`);
      // ls-files -s prints "mode blob stage\tpath" and ls-tree prints "mode type blob\tpath": both reduce to "mode blob".
      const parse = (out: string, blobAt: number) => new Map(out.split("\0").filter(Boolean).map((r) => {
        const t = r.indexOf("\t"), f = r.slice(0, t).split(" ");
        return [r.slice(t + 1), `${f[0]} ${f[blobAt]}`] as const;
      }));
      const idx = parse(await this.ok(["ls-files", "-s", "-z", "--", ...lit], { env }), 1);
      const old = oldHead ? parse(await this.ok(["ls-tree", "-r", "-z", oldHead, "--", ...lit]), 2) : new Map<string, string>();
      const next = parse(await this.ok(["ls-tree", "-r", "-z", target, "--", ...lit]), 2);
      const info: string[] = [];
      for (const p of paths) {
        if ((idx.get(p) ?? "") !== (old.get(p) ?? "")) continue; // the user staged something else here: never touched
        const n = next.get(p);
        info.push(n ? `${n.split(" ")[0]} ${n.split(" ")[1]}\t${p}` : `0 ${ZERO}\t${p}`);
      }
      if (info.length) await this.ok(["update-index", "-z", "--index-info"], { env, input: `${info.join("\0")}\0` });
      if (!ownsLock() || await this.refCommit("HEAD") !== target) return status;
      writeFileSync(fd, readFileSync(scratch));
      fsyncSync(fd); closeSync(fd); fd = -1;
      if (!ownsLock() || await this.refCommit("HEAD") !== target) return status;
      renameSync(lock, join(gitDir, "index"));
      published = true;
      syncDir(gitDir);
      status = "synced"; return status;
    } catch (e) {
      if (published) throw new KernelError("effect-uncertain", `the index rename was observed but durability could not be established: ${String(e)}`, { exit: 2 });
      return "untouched";
    } finally {
      if (fd >= 0) closeSync(fd);
      if (ownsLock()) rmSync(lock, { force: true });
      if (sameFile(stagedLock, acquired)) rmSync(stagedLock);
      syncDir(gitDir);
      rmSync(scratchDir, { recursive: true, force: true });
      if (logged && (!published || status === "synced")) await journal!.result(status);
    }
  }

  async recoverIndexSync(raw: unknown, journal: IndexJournal): Promise<CommitOutcome["indexSync"] | "uncertain"> {
    const parsed = IndexSyncRecord.safeParse(raw);
    if (!parsed.success || isAlive(parsed.data.pid, parsed.data.procStart)) return "uncertain";
    const record = parsed.data, gitDir = (await this.ok(["rev-parse", "--absolute-git-dir"])).trim();
    const lock = join(gitDir, "index.lock"), temp = join(gitDir, record.temp), index = join(gitDir, "index");
    const landed = sameFile(index, record);
    if (landed) {
      if (sameFile(lock, record)) rmSync(lock);
      if (sameFile(temp, record)) rmSync(temp);
      syncDir(gitDir); return "synced";
    }
    if (existsSync(lock) && !sameFile(lock, record)) {
      if (sameFile(temp, record)) { rmSync(temp); syncDir(gitDir); }
      return "untouched";
    }
    if (sameFile(lock, record)) rmSync(lock);
    if (sameFile(temp, record)) rmSync(temp);
    syncDir(gitDir);
    return this.syncIndex(record.paths, record.parent, journal, record.head);
  }

  async workCommits(label: string): Promise<{ commits: string[]; shallow: boolean; merges: boolean }> {
    const shallow = (await this.tryOut(["rev-parse", "--is-shallow-repository"])) === "true";
    const all = (await this.tryOut(["log", "--format=%H", "-E", `--grep=^Tenet-Work: ${label}$`, "HEAD"])) ?? "";
    const commits = all.split("\n").filter(Boolean);
    const merges = (await Promise.all(commits.map((c) => this.tryOut(["rev-list", "--parents", "-n", "1", c])))).some((l) => (l ?? "").split(" ").length > 2);
    return { commits, shallow, merges };
  }

  async planUndo(commits: readonly string[]): Promise<{ ok: true; tree: string; patch: string; paths: string[]; stat: string } | { ok: false; conflict: string[]; detail: string }> {
    const dir = mkdtempSync(join(tmpdir(), "tenet-undo-"));
    const env = { GIT_INDEX_FILE: join(dir, "index") };
    try {
      await this.ok(["read-tree", "HEAD"], { env, inspect: false });
      const empty = (await this.ok(["hash-object", "-t", "tree", "/dev/null"])).trim();
      for (const c of commits) {
        const parent = (await this.tryOut(["rev-parse", "-q", "--verify", `${c}^`])) ?? empty;
        const inverse = await this.ok(["diff", "--no-ext-diff", "--no-textconv", "--binary", "--full-index", "-M", c, parent]);
        const r = await this.run(["apply", "--cached", "--whitespace=nowarn"], { env, input: inverse, inspect: false });
        if (r.code !== 0) {
          const named = [...r.stderr.matchAll(/error: (?:patch failed: )?([^:\n]+?)(?::\d+)?(?::| does not)/g)].map((m) => m[1]!);
          return { ok: false, conflict: [...new Set(named)], detail: r.stderr.trim().slice(0, 400) };
        }
      }
      const tree = (await this.ok(["write-tree"], { env, inspect: false })).trim();
      const patch = await this.ok(["diff", "--no-ext-diff", "--no-textconv", "--binary", "--full-index", "HEAD", tree]);
      const paths = (await this.ok(["diff", "--no-ext-diff", "--name-only", "-z", "HEAD", tree])).split("\0").filter(Boolean);
      const stat = (await this.ok(["diff", "--no-ext-diff", "--stat", "--no-color", "HEAD", tree])).trim().split("\n").at(-1) ?? "";
      return { ok: true, tree, patch, paths, stat };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async applyPatch(patch: string, include: readonly string[] = [], options?: { runDir: string; timeoutMs: number }): ReturnType<Git["applyPatch"]> {
    await this.inspectionSafe();
    const runDir = options?.runDir ?? mkdtempSync(join(tmpdir(), "tenet-patch-"));
    const file = join(runDir, "inverse.patch");
    const fd = openSync(file, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
    try { writeFileSync(fd, patch); } finally { closeSync(fd); }
    const env = Object.fromEntries(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"].flatMap(k => process.env[k] === undefined ? [] : [[k, process.env[k]!]]));
    const r = await this.runner.run({ argv: ["git", ...INSPECT, "apply", "--whitespace=nowarn", ...include.map(p => `--include=${p}`), "--", file], cwd: this.root, runDir, timeoutMs: options?.timeoutMs ?? 60_000, env });
    return r.exit === 0 && !r.signal && !r.timedOut ? { ok: true } : { ok: false, uncertain: r.timedOut || !!r.signal || r.exit === undefined, detail: r.stderr.trim().slice(0, 400) };
  }

  async blobsAt(treeish: string, paths: readonly string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = Object.fromEntries(paths.map((p) => [p, null]));
    if (!paths.length) return out;
    for (const rec of (await this.ok(["ls-tree", "-r", "-z", treeish, "--", ...paths.map((p) => `:(literal)${p}`)])).split("\0").filter(Boolean)) {
      const t = rec.indexOf("\t");
      out[rec.slice(t + 1)] = rec.slice(0, t).split(" ")[2]!;
    }
    return out;
  }

  async laterCommits(since: string, paths: readonly string[]): Promise<string[]> {
    return ((await this.tryOut(["log", "--format=%h %s", `${since}..HEAD`, "--", ...paths.map((p) => `:(literal)${p}`)])) ?? "").split("\n").filter(Boolean);
  }

  async refCommit(ref: string): Promise<string | null> { return this.tryOut(["rev-parse", "-q", "--verify", `${ref}^{commit}`]); }

  async predictConflicts(base: string, work: string): Promise<{ supported: boolean; paths: string[] }> {
    const r = await this.run(["merge-tree", "--write-tree", "--name-only", "-z", base, work]);
    if (r.code === 0) return { supported: true, paths: [] };
    if (r.code !== 1) return { supported: false, paths: [] };
    // "<tree>\0<conflicted names>\0...\0\0<messages>": the names end at the first empty field.
    const fields = r.stdout.split("\0").slice(1);
    const end = fields.indexOf("");
    return { supported: true, paths: fields.slice(0, end < 0 ? fields.length : end) };
  }

  async integrate(base: string, work: string, options?: { runDir: string; timeoutMs: number }): ReturnType<Git["integrate"]> {
    await this.inspectionSafe();
    if ((await this.probe()).hooks) throw new KernelError("capability-missing", "integration hooks require an execution consent path that is not implemented; the editor was not switched", { exit: 2 });
    if (await this.tryOut(["config", "--bool", "commit.gpgsign"]) === "true") throw new KernelError("signing-unavailable", "integration signing consent is not implemented; the editor was not switched", { exit: 2 });
    const runDir = options?.runDir ?? mkdtempSync(join(tmpdir(), "tenet-integrate-"));
    const env = Object.fromEntries(["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"].flatMap(k => process.env[k] === undefined ? [] : [[k, process.env[k]!]]));
    let launched = false;
    const run = (args: string[]) => {
      launched = true;
      return this.runner.run({ argv: ["git", ...INSPECT, ...args], cwd: this.root, runDir, timeoutMs: options?.timeoutMs ?? 60_000, env });
    };
    const fail = (detail: string) => ({ ok: false, uncertain: launched, detail: detail.trim().slice(-400) });
    try {
      if ((await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"])) !== base) {
        const sw = await run(["switch", "-q", base]);
        if (sw.exit !== 0 || sw.timedOut || sw.signal) return fail(sw.stderr || "branch switch did not complete cleanly");
      }
      const ff = (await this.run(["merge-base", "--is-ancestor", base, work])).code === 0;
      const m = await run(ff ? ["merge", "-q", "--ff-only", work] : ["merge", "-q", "--no-ff", "-m", `Merge ${work} into ${base}`, work]);
      if (m.exit !== 0 || m.timedOut || m.signal) return fail(`${m.stdout}${m.stderr}` || "integration did not complete cleanly");
      const commit = await this.tryOut(["rev-parse", "HEAD"]);
      return commit ? { ok: true, commit, mode: ff ? "fast-forward" : "merge" } : fail("integration postcondition could not be inspected");
    } catch (e) { return fail(String(e)); }
  }

  async reconcileIntegration(base: string, baseBefore: string, work: string): Promise<{ completed: boolean; commit?: string; mode?: "fast-forward" | "merge" }> {
    const now = await this.refCommit(base);
    if (!now || now === baseBefore) return { completed: false };
    if (now === work) return { completed: true, commit: now, mode: "fast-forward" };
    const parents = ((await this.tryOut(["rev-list", "--parents", "-n", "1", now])) ?? "").split(" ").slice(1);
    return parents.length === 2 && parents[0] === baseBefore && parents[1] === work ? { completed: true, commit: now, mode: "merge" } : { completed: false };
  }

  async parentOf(commit: string): Promise<string | null> { return this.tryOut(["rev-parse", "-q", "--verify", `${commit}^`]); }

  async ancestors(commits: readonly string[]): Promise<Set<string>> {
    const out = new Set<string>();
    for (const c of new Set(commits)) if ((await this.run(["merge-base", "--is-ancestor", c, "HEAD"])).code === 0) out.add(c);
    return out;
  }

  async init(): Promise<void> { await this.ok(["init", "-q"], { inspect: false }); }

  async initShadow(): Promise<void> {
    mkdirSync(this.shadowDir, { recursive: true, mode: 0o700 });
    await this.ok(["--git-dir", this.shadowDir, "--work-tree", this.root, "init", "-q"], { inspect: false });
    mkdirSync(join(this.shadowDir, "info"), { recursive: true });
    writeFileSync(join(this.shadowDir, "info/exclude"), `${SHADOW_EXCLUDE.join("\n")}\n`);
    for (const [k, v] of [["user.name", "Tenet"], ["user.email", "tenet@localhost"], ["commit.gpgsign", "false"]] as const) await this.ok(["config", k, v], { inspect: false });
    try {
      await this.snapshot("Tenet: start");
    } catch (e) {
      rmSync(this.shadowDir, { recursive: true, force: true }); // a refused first snapshot leaves no half-made repository
      throw e;
    }
  }

  async snapshot(message: string): Promise<string | null> {
    if (!this.shadow) return null;
    // Snapshots count against the .tenet/ budget: refuse before copying more than 20 MB into the object store.
    const changed = (await this.ok(["ls-files", "-z", "--others", "--modified", "--exclude-standard"])).split("\0").filter(Boolean);
    const bytes = changed.reduce((n, p) => { try { return n + lstatSync(join(this.root, p)).size; } catch { return n; } }, 0);
    if (bytes > MAX_SNAPSHOT_BYTES) throw new KernelError("snapshot-too-large", `${(bytes / 1048576).toFixed(0)} MB to snapshot; \`git init\` here to use a real repository`);
    await this.ok(["add", "-A"], { inspect: false });
    if ((await this.run(["diff", "--cached", "--quiet"])).code === 0 && (await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]))) return null;
    await this.ok(["commit", "-q", "--allow-empty", "-m", message], { inspect: false });
    return (await this.tryOut(["rev-parse", "HEAD"]));
  }

  async createBranch(name: string): Promise<void> {
    if ((await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"])) === name) return;
    const hook = (await this.ok(["rev-parse", "--git-path", "hooks/post-checkout"])).trim();
    if (existsSync(resolve(this.root, hook))) throw new KernelError("capability-missing", "creating a work branch could run a checkout hook; that guarded execution path is unavailable, so the editor was not switched", { exit: 2 });
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
