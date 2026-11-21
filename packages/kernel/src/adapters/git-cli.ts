import { withoutGitLocalVars } from "./git-env.ts";
import { outputMatcher } from "../core/outputs.ts";
import { hookInventory, locate, repoLayout } from "./git-layout.ts";
import { execFile } from "node:child_process";
import {
  closeSync,
  constants,
  copyFileSync,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { allowed, isKernelFile } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { filterConfig, filterOverrides, usedFilters } from "../core/git-filters.ts";
import type { FileChange, Hunk } from "../core/review.ts";
import type {
  CommitOutcome,
  CommitPlan,
  Entry,
  FilterGate,
  Git,
  IndexJournal,
  Inventory,
  RepoProbe,
  Runner,
  RunResult,
  StatusEntry,
} from "../ports/types.ts";
import { IndexSyncRecord } from "../core/schemas.ts";
import { ProcessRunner } from "./runner.ts";
import { isAlive, procStart } from "./proc.ts";
import { systemClock } from "./system.ts";
import { exactWorkTrailer } from "../core/commit-proof.ts";
import type { CommitIntentV1, CommitProofV1, ReflogCursorV1 } from "../core/commit-proof.ts";
import { stableStringify } from "../core/ids.ts";
import { reflogCursor } from "./git-attribution.ts";
import {
  commitResolved, finishIntegration, pinIntegration, readIntegrationProof,
} from "./git-integrate.ts";
import { decodeGitOutput, parseIndexRecords } from "./git-index-records.ts";
import {
  guardedApplyUndo, laterTouching as later, pinHead as pin, planInverse,
  undoNames as names, undoObstructions as obstructions, undoState as undoStateOf,
} from "./git-undo.ts";
import type { UndoApply } from "./git-undo.ts";

const MAX_UNTRACKED = 20_000;
const MAX_SNAPSHOT_BYTES = 20 * 1024 * 1024;
/** What a shadow repository never copies: secrets, dependencies and build output (TS §10.9). */
const SHADOW_EXCLUDE = [
  ".tenet/",
  ".env",
  ".env.*",
  "!.env.example",
  "*.pem",
  "*.key",
  "*.p12",
  "id_rsa*",
  "id_ed25519*",
  "node_modules",
  "dist/",
  "build/",
  "coverage/",
  ".next/",
  "*.log",
];
const INSPECT = [
  "--no-pager",
  "--no-replace-objects",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "diff.external=",
  "-c",
  "core.quotePath=false",
  "-c",
  "color.ui=never",
];
const ZERO = "0".repeat(40);

interface Out {
  code: number;
  stdout: string;
  stderr: string;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const gitConfigEnv = () => Object.fromEntries(
  ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM"].flatMap(k => process.env[k] === undefined ? [] : [[k, process.env[k]!]]),
);
const sameFile = (path: string, id: { dev: number; ino: number }) => {
  try {
    const st = lstatSync(path);
    return st.isFile() && !st.isSymbolicLink() && st.dev === id.dev && st.ino === id.ino;
  } catch {
    return false;
  }
};
const syncDir = (path: string) => {
  const fd = openSync(path, "r");
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
};
const commitFail = (reason: string, detail?: string): CommitOutcome => ({
  ok: false,
  reason,
  ...(detail ? { detail } : {}),
  foreign: [],
  indexSync: "untouched",
  syncPaths: [],
});
/** What Git printed on a failed commit, and the reason code it maps to; anything else is a failing hook. */
const FAILURE_REASONS: readonly [RegExp, string][] = [
  [/gpg|sign/i, "signing-unavailable"],
  [/Author identity unknown|empty ident|tell me who you are/i, "git-identity-missing"],
  [/index\.lock/, "git-locked"],
];

/** Take Git's index lock by linking our staged lock file to it, retrying briefly; false when someone else holds it. */
async function linkLock(stagedLock: string, lock: string, gitDir: string): Promise<boolean> {
  for (let i = 0; i < 3; i++) {
    try {
      linkSync(stagedLock, lock);
      syncDir(gitDir);
      return true;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      await sleep(40);
    }
  }
  return false;
}
/** `ls-files -s` prints "mode blob stage\tpath" and `ls-tree` prints "mode type blob\tpath": both reduce to "mode blob" per path. */
const indexLines = (out: string, blobAt: number) =>
  new Map(
    out
      .split("\0")
      .filter(Boolean)
      .map((r) => {
        const t = r.indexOf("\t"),
          f = r.slice(0, t).split(" ");
        return [r.slice(t + 1), `${f[0]} ${f[blobAt]}`] as const;
      }),
  );

/** The index entries with the working tree laid over them: a deleted file leaves, a changed one carries its new blob. */
function overlay(index: Map<string, Entry>, status: readonly StatusEntry[]): Map<string, Entry> {
  const entries = new Map(index);
  for (const s of status) {
    if (s.blob === "") entries.delete(s.path);
    else entries.set(s.path, { path: s.path, mode: s.mode, blob: s.blob });
  }
  return entries;
}

export const gitBlob = (content: Buffer): string =>
  createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");

export class GitCli {
  private root: string;
  private exclusions: readonly Exclusion[] = [];
  private runner: Runner;
  private inspected?: Promise<Map<string, string[]>>;
  private neutral?: Promise<string[]>;
  private gate?: Promise<FilterGate | null>;
  private format?: Promise<string | null>;
  private consented: ReadonlySet<string> = new Set();
  private signingConsented: ReadonlySet<string> = new Set();
  constructor(root: string, runner: Runner = new ProcessRunner(systemClock, process.env)) {
    this.root = root;
    this.runner = runner;
  }
  setExclusions(exclusions: readonly Exclusion[]): void {
    this.exclusions = exclusions;
  }

  private get shadowDir(): string {
    return join(this.root, ".tenet/git");
  }
  /** A folder with no Git of its own but a shadow repository uses `--git-dir=.tenet/git --work-tree=<folder>`. */
  private get shadow(): boolean {
    return !existsSync(join(this.root, ".git")) && existsSync(join(this.shadowDir, "HEAD"));
  }

  private async run(
    args: string[],
    o: { env?: Record<string, string>; input?: string; inspect?: boolean; cwd?: string; filters?: boolean; strict?: boolean } = {},
  ): Promise<Out> {
    // Inspection disables configured filter programs.
    const neutral = o.filters ? [] : await this.neutralArgs();
    const env = {
      ...withoutGitLocalVars(process.env),
      GIT_TERMINAL_PROMPT: "0",
      ...(o.inspect === false ? {} : { GIT_OPTIONAL_LOCKS: "0" }),
      ...o.env,
    };
    return new Promise((resolve, reject) => {
      const where = this.shadow ? ["--git-dir", this.shadowDir, "--work-tree", this.root] : [];
      const c = execFile(
        "git",
        [...where, ...neutral, ...INSPECT, ...args],
        { cwd: o.cwd ?? this.root, env, maxBuffer: 256 * 1024 * 1024, encoding: "buffer" },
        (err, stdout, stderr) => {
          try {
            resolve({ code: err ? ((err as { code?: number }).code ?? 1) : 0,
              stdout: o.strict ? decodeGitOutput(stdout) : stdout.toString("utf8"), stderr: stderr.toString("utf8") });
          } catch (error) { reject(error); }
        },
      );
      if (o.input !== undefined) c.stdin?.end(o.input);
      else c.stdin?.end();
    });
  }
  private undoAdapter = () =>
    ({
      root: this.root, runner: this.runner,
      run: (args: string[], options?: Parameters<GitCli["run"]>[1]) => this.run(args, options), env: gitConfigEnv,
    });
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
    const t = (...a: string[]) => this.tryOut(a); // run together (NFR-01)
    const [ver, located] = await Promise.all([t("--version"), locate((args) => this.tryOut(args))]);
    const version = (ver ?? "git not found").replace(/^git version /, "");
    if (!located)
      return {
        isRepo: false,
        shadow: false,
        version,
        top: null,
        head: null,
        branch: null,
        state: "none",
        identity: false,
        remotes: [],
        hooks: null,
        signing: null,
        layout: { shallow: false, submodules: [], lfs: false, linkedWorktree: false },
      };
    const { top, gitDir } = located;
    const layoutP = repoLayout((args) => this.tryOut(args), located);
    const [head, branch, cf, idO, rmO, hooksPath, signing] = await Promise.all([
      t("rev-parse", "--verify", "-q", "HEAD"), t("symbolic-ref", "-q", "--short", "HEAD"),
      t("diff", "--cached", "--name-only", "--diff-filter=U"), t("var", "GIT_COMMITTER_IDENT"), t("remote"), t("config", "core.hooksPath"),
      this.signingGate(),
    ]);
    const busy = ["rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD"].find((f) =>
      existsSync(join(gitDir, f)),
    );
    const conflicts = cf ?? "";
    let state: RepoProbe["state"] = "ok",
      why: string | undefined;
    if (busy) [state, why] = ["readonly", `a ${busy.replace(/_HEAD$/, "").toLowerCase()} is in progress`];
    else if (conflicts) [state, why] = ["readonly", "there are unresolved conflicts"];
    else if (head && !branch) [state, why] = ["readonly", "HEAD is detached"];
    const identity = idO !== null;
    const remotes = (rmO ?? "").split("\n").filter(Boolean);
    const hooksDir = hooksPath ?? join(gitDir, "hooks");
    const hooks = hookInventory([hooksDir.startsWith("/") ? hooksDir : join(top, hooksDir), join(top, ".husky")]);
    const layout = await layoutP;
    const probe: RepoProbe = {
      isRepo: true, shadow: this.shadow, version, top, head, branch, state, identity, remotes, hooks, signing, layout,
    };
    if (why) probe.why = why;
    return probe;
  }

  /** SHA-256 repositories hash differently from the blob ids computed here; they are refused rather than misread. */
  private async objectFormatSafe(): Promise<void> {
    // Fixed per repository; a null (no repository yet) is not kept.
    this.format ??= this.tryOut(["rev-parse", "--show-object-format"]);
    const format = await this.format;
    if (format === null) this.format = undefined;
    if (format === "sha256")
      throw new KernelError("capability-missing", "SHA-256 Git repositories are not supported by this adapter", { exit: 2 });
  }

  // ------------------------------------------------------------ filters (GIT-12)
  /** Read commands without invoking them. */
  private async filterConfig(): Promise<Map<string, string[]>> {
    const r = await this.run(["config", "--null", "--get-regexp", "^filter\\."], { inspect: false, filters: true });
    return filterConfig(r.stdout);
  }

  /** The configuration inspection is based on, read once; a commit reads it again (commitFilters). */
  private inspectedConfig(): Promise<Map<string, string[]>> {
    this.inspected ??= this.filterConfig();
    return this.inspected;
  }

  /** Disable programs during inspection. */
  private neutralArgs(): Promise<string[]> {
    this.neutral ??= this.inspectedConfig().then(config => filterOverrides(config));
    return this.neutral;
  }

  /** Unused filters need no consent. */
  filterGate(): Promise<FilterGate | null> {
    this.gate ??= this.findGate(this.inspectedConfig());
    return this.gate;
  }

  private async findGate(config = this.filterConfig()): Promise<FilterGate | null> {
    const filters = await config;
    if (![...filters.values()].some((f) => f.some((x) => /^(clean|process)=./.test(x)))) return null;
    const listed = await this.ok(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]);
    const paths = listed.split("\0").filter((p) => p && !isKernelFile(p));
    const attrs = await this.run(["check-attr", "-z", "--stdin", "filter"], { input: paths.join("\0"), filters: true });
    return usedFilters(filters, attrs.stdout);
  }

  allowFilters(hashes: readonly string[]): void {
    this.consented = new Set(hashes);
  }

  /** Current commit signing configuration, read without invoking a signing program. */
  private async signingGate(): Promise<string | null> {
    if ((await this.tryOut(["config", "--bool", "commit.gpgsign"])) !== "true") return null;
    const configured = await this.tryOut([
      "config", "--null", "--get-regexp",
      "^(commit\\.gpgsign|user\\.signingkey|gpg\\.|gpgformat$)",
    ]);
    return sha256(configured ?? "commit.gpgsign=true");
  }

  allowSigning(hashes: readonly string[]): void {
    this.signingConsented = new Set(hashes);
  }

  private async refuseFilters(doing: string): Promise<void> {
    const gate = await this.filterGate();
    if (gate)
      throw new KernelError(
        "filter-consent-needed",
        `Git filters (${gate.names.join(", ")}) apply here; ${doing} under them is not supported yet, so nothing was changed`,
        { exit: 2 },
      );
  }

  // ------------------------------------------------------------ inventory
  async openInventory(): Promise<Inventory> {
    const skip = (path: string) => isKernelFile(path);
    const [, head, branch, tagged, status] = await Promise.all([
      this.objectFormatSafe(),
      this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]),
      this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]),
      this.ok(["ls-files", "-v", "-z", "--"], { strict: true }),
      this.parseStatus(skip, []),
    ]);
    if (tagged.split("\0").some((record) => record && record[0] !== "H")) {
      return this.inventory([]);
    }
    const entries = new Map(status.map((entry) => [entry.path, {
      path: entry.path,
      mode: entry.mode,
      blob: entry.blob,
    }]));
    return { head, branch, entries, status, digest: this.digestOf(entries) };
  }

  async readOnlyInventory(head: string | null, branch: string | null): Promise<Inventory> {
    const status = await this.parseStatus(isKernelFile, []);
    const entries = new Map(status.map((entry) => [entry.path, {
      path: entry.path, mode: entry.mode, blob: entry.blob,
    }]));
    return { head, branch, entries, status, digest: this.digestOf(entries) };
  }

  async inventory(
    exclude: readonly string[] = [],
    declaredInputs: readonly string[] = [],
    volatile: readonly string[] = [],
  ): Promise<Inventory> {
    // All but status at once (NFR-01); status needs the listings.
    const [, head, branch, staged, others, tagged] = await Promise.all([
      this.objectFormatSafe(), this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]), this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]),
      this.ok(["ls-files", "-s", "-z", "--"], { strict: true }),
      this.ok(["ls-files", "--others", "--exclude-standard", "-z", "--"], { strict: true }),
      this.ok(["ls-files", "-v", "-z", "--"], { strict: true }),
    ]);
    const skip = (p: string) => isKernelFile(p) || exclude.some((x) => p === x || p.startsWith(`${x}/`));
    const index = this.indexEntries(staged, skip);
    const isOutput = outputMatcher(volatile);
    const hide = (p: string) => skip(p) || (!index.has(p) && isOutput(p)); // a declared output is only ever untracked (EVD-09)
    const status = await this.statusRows(others, hide, index);
    const entries = overlay(index, status);
    this.hiddenChanges(tagged, skip, index, entries, status);
    this.declaredChanges(hide, declaredInputs, index, entries, status);
    return { head, branch, entries, status, digest: this.digestOf(entries) };
  }

  /** Stage-0 index entries, minus Tenet's own files and the caller's exclusions. */
  private indexEntries(listed: string, skip: (p: string) => boolean): Map<string, Entry> {
    return new Map([...parseIndexRecords(listed).entries].filter(([path]) => !skip(path)));
  }

  /** Git status, plus the untracked files whose content Tenet reads itself. Too many untracked files is a refusal. */
  private async statusRows(listed: string, skip: (p: string) => boolean, index: Map<string, Entry>): Promise<StatusEntry[]> {
    const others = listed.split("\0").filter((p) => p && !skip(p));
    if (others.length > MAX_UNTRACKED)
      throw new KernelError("inventory-too-large", `${others.length} untracked files; add them to .gitignore`);
    const statOnly = [...index.keys(), ...others].filter((p) => !allowed("scan", p, this.exclusions));
    const status = await this.parseStatus(skip, statOnly);
    for (const path of others.filter((p) => statOnly.includes(p))) {
      const content = this.workBlob(path);
      if (content) status.push({
        path, xy: "??", staged: false, untracked: true, ...content, indexBlob: "", indexMode: "",
      });
    }
    const untracked = status.filter((s) => s.untracked).length;
    if (untracked > MAX_UNTRACKED)
      throw new KernelError("inventory-too-large", `${untracked} untracked files; add them to .gitignore`);
    return status;
  }

  /** Git status hides these paths ("assume unchanged" and similar). Their actual content must still enter the candidate identity. */
  private hiddenChanges(
    tagged: string,
    skip: (p: string) => boolean,
    index: Map<string, Entry>,
    entries: Map<string, Entry>,
    status: StatusEntry[],
  ): void {
    for (const rec of tagged.split("\0").filter(Boolean)) {
      if (rec[0] === "H") continue;
      const path = rec.slice(2);
      if (skip(path) || !index.has(path)) continue;
      const content = this.workBlob(path);
      if (!content) throw new KernelError("stale", path, { exit: 2 });
      entries.set(path, { path, ...content });
      if (content.blob !== index.get(path)!.blob && !status.some((s) => s.path === path))
        status.push({
          path, xy: ".M", staged: false, untracked: false, ...content,
          indexBlob: index.get(path)!.blob, indexMode: index.get(path)!.mode,
        });
    }
  }

  /** Explicit tests/support/configuration are inputs even when ignored. Never ask Git to interpret them as patterns. */
  private declaredChanges(
    skip: (p: string) => boolean,
    declaredInputs: readonly string[],
    index: Map<string, Entry>,
    entries: Map<string, Entry>,
    status: StatusEntry[],
  ): void {
    for (const path of new Set(declaredInputs)) {
      if (skip(path)) continue;
      if (path.startsWith("/") || path.split("/").includes(".."))
        throw new KernelError("capability-missing", "a declared input leaves the workspace", { exit: 2 });
      this.contentPath(path, true);
      const content = this.workBlob(path);
      if (!content) {
        entries.delete(path);
        continue;
      }
      entries.set(path, { path, ...content });
      if (!index.has(path) && !status.some((s) => s.path === path))
        status.push({
          path, xy: "??", staged: false, untracked: true, ...content, indexBlob: "", indexMode: "",
        });
    }
  }

  /** One line per entry, sorted by path: its blob, or for an excluded file only its stat (a stat change is a change). */
  private digestOf(entries: Map<string, Entry>): string {
    const lines: string[] = [];
    for (const e of [...entries.values()].sort((a, b) => (a.path < b.path ? -1 : 1))) {
      if (allowed("scan", e.path, this.exclusions)) lines.push(`${e.path}\t${e.mode}\t${e.blob}`);
      else lines.push(`${e.path}\t${this.stat(e.path)}`);
    }
    return sha256(lines.join("\n"));
  }

  private stat(rel: string): string {
    try {
      const path = this.contentPath(rel);
      if (!path) return "stat:unavailable";
      const s = lstatSync(path);
      return `stat:${s.size}:${Math.floor(s.mtimeMs)}:${s.mode}`;
    } catch {
      return "stat:absent";
    }
  }

  /** A file may itself be a link, but content lookup never traverses a linked parent directory. */
  private contentPath(rel: string, required = false): string | null {
    const root = resolve(this.root),
      path = resolve(root, rel);
    if (!path.startsWith(root + sep)) return null;
    try {
      for (let dir = dirname(path); dir !== root; dir = dirname(dir))
        if (lstatSync(dir).isSymbolicLink()) {
          if (required)
            throw new KernelError("capability-missing", `a declared input traverses a linked directory: ${rel}`, { exit: 2 });
          return null;
        }
    } catch (e) {
      if (e instanceof KernelError) throw e;
      return null;
    }
    return path;
  }

  /** Content identity of a working-tree path: Git's blob id, computed here, never following symlinks. */
  private workBlob(rel: string): { mode: string; blob: string } | null {
    const abs = this.contentPath(rel);
    if (!abs) return null;
    try {
      const st = lstatSync(abs);
      if (st.isSymbolicLink()) {
        if (!allowed("scan", rel, this.exclusions))
          throw new KernelError("capability-missing", "a restricted link has no admitted working identity", { exit: 2 });
        return { mode: "120000", blob: gitBlob(Buffer.from(readlinkSync(abs))) };
      }
      if (!st.isFile()) return null;
      const mode = st.mode & 0o111 ? "100755" : "100644";
      return {
        mode,
        blob: allowed("scan", rel, this.exclusions) ? gitBlob(readFileSync(abs)) : sha256(this.stat(rel)).slice(0, 40),
      };
    } catch (error) {
      if (error instanceof KernelError) throw error;
      return null;
    }
  }

  private async parseStatus(skip: (p: string) => boolean, statOnly: readonly string[]): Promise<StatusEntry[]> {
    const recs = (
      await this.ok([
        "status",
        "--porcelain=v2",
        "-z",
        "--untracked-files=all",
        "--",
        ".",
        ...statOnly.map((p) => `:(exclude,literal)${p}`),
      ], { strict: true })
    ).split("\0");
    const out: StatusEntry[] = [];
    for (let i = 0; i < recs.length; i++) {
      const r = recs[i]!;
      if (!r) continue;
      const kind = r[0];
      if (kind === "?") {
        const path = r.slice(2);
        const w = skip(path) ? null : this.workBlob(path);
        if (w) out.push({
          path, xy: "??", staged: false, untracked: true, mode: w.mode, blob: w.blob,
          indexBlob: "", indexMode: "",
        });
      } else if (kind === "1" || kind === "2" || kind === "u") {
        const f = r.split(" ");
        const n = kind === "1" ? 8 : kind === "2" ? 9 : 10;
        const path = f.slice(n).join(" ");
        if (kind === "2") i++; // the original path follows as its own NUL-separated record
        if (skip(path)) continue;
        const xy = f[1]!;
        const w = this.workBlob(path);
        const indexBlob = kind === "u" ? "" : f[kind === "2" ? 7 : 7]!;
        out.push({
          path,
          xy,
          staged: xy[0] !== "." && xy[0] !== "?",
          untracked: false,
          mode: w?.mode ?? f[3]!,
          blob: w?.blob ?? "",
          indexBlob,
          indexMode: kind === "u" ? "" : f[3]!,
        });
      }
    }
    return out;
  }

  // ------------------------------------------------------------ changes (hunks for attention and manifests)
  async changes(
    base: string | null,
    paths: readonly string[],
    classify: (p: string) => FileChange["kind"],
  ): Promise<FileChange[]> {
    await this.objectFormatSafe();
    const out: FileChange[] = [];
    const wanted = paths.filter((p) => allowed("model-send", p, this.exclusions, { kind: "routine-inventory" }));
    // One call tells which of the paths exist in the base; the rest are new files.
    const inBase = new Set(
      base && wanted.length
        ? (await this.ok(["ls-tree", "-r", "-z", "--name-only", base, "--", ...wanted.map((p) => `:(literal)${p}`)]))
            .split("\0")
            .filter(Boolean)
        : [],
    );
    const tracked = wanted.filter((p) => inBase.has(p));
    for (const p of wanted) if (!inBase.has(p)) out.push(this.wholeFile(p, classify(p)));
    if (tracked.length) {
      const diff = await this.ok([
        "diff",
        "--no-ext-diff",
        "--no-textconv",
        "--no-color",
        "-U0",
        "--no-renames",
        base!,
        "--",
        ...tracked.map((p) => `:(literal)${p}`),
      ]);
      out.push(...parseDiff(diff, classify));
      for (const p of tracked)
        if (!out.some((c) => c.path === p)) out.push({ path: p, kind: classify(p), hunks: [], added: 0, removed: 0 });
    }
    return out.sort((a, b) => (a.path < b.path ? -1 : 1));
  }

  private wholeFile(path: string, kind: FileChange["kind"]): FileChange {
    let lines: string[] = [];
    try {
      const p = this.contentPath(path);
      if (p) {
        lines = (lstatSync(p).isSymbolicLink() ? readlinkSync(p) : readFileSync(p, "utf8")).split("\n");
        if (lines.at(-1) === "") lines.pop();
      }
    } catch {
      /* deleted or unreadable */
    }
    return { path, kind, hunks: lines.length ? [{ line: 1, added: lines, removed: [] }] : [], added: lines.length, removed: 0 };
  }

  // ------------------------------------------------------------ commit (temporary index, TS §10.3)
  /** Revalidate and pin consented commands. */
  private async commitFilters(): Promise<string[]> {
    const config = await this.filterConfig(), gate = await this.findGate(Promise.resolve(config));
    if (gate && !this.consented.has(gate.hash))
      throw new KernelError("filter-consent-needed", "Git filter configuration changed or lacks consent; retry the commit", { exit: 3 });
    return filterOverrides(config, gate?.names);
  }

  /** Guard configured program execution. */
  private program(args: string[], plan: CommitPlan, env: Record<string, string>): Promise<RunResult> {
    const where = this.shadow ? ["--git-dir", this.shadowDir, "--work-tree", this.root] : [];
    return this.runner.run({
      argv: ["git", ...where, ...INSPECT, ...args], cwd: this.root,
      runDir: plan.runDir!, timeoutMs: plan.timeoutMs, env: { ...env, ...gitConfigEnv(), GIT_TERMINAL_PROMPT: "0" },
    });
  }

  /** Build a private index; only job staging may run filters. */
  private async buildTree(
    plan: Pick<CommitPlan, "paths" | "deleted" | "parent">,
    env: Record<string, string>,
    execution?: { plan: CommitPlan; filters: string[] },
  ): Promise<string> {
    await this.objectFormatSafe();
    if (plan.parent) await this.ok(["read-tree", plan.parent], { env, inspect: false });
    else await this.ok(["read-tree", "--empty"], { env, inspect: false });
    const live = plan.paths.filter((p) => this.workBlob(p));
    if (live.length) {
      const args = ["add", "--", ...live.map(p => `:(literal)${p}`)];
      if (execution) {
        const r = await this.program([...execution.filters, ...args], execution.plan, env);
        if (r.exit !== 0 || r.signal || r.timedOut)
          throw new KernelError("hook-failed", r.timedOut
            ? "Git filter preparation timed out; its process group was stopped"
            : `Git filter preparation failed: ${r.stderr.trim().slice(-400)}`);
      } else await this.ok(args, { env, inspect: false });
    }
    const gone = [...plan.deleted, ...plan.paths.filter((p) => !this.workBlob(p))];
    if (gone.length) await this.ok(["update-index", "--force-remove", "--", ...gone], { env, inspect: false });
    return (await this.ok(["write-tree"], { env, inspect: false })).trim();
  }

  async expectedTree(plan: Pick<CommitPlan, "paths" | "deleted" | "parent">): Promise<string> {
    const dir = mkdtempSync(join(tmpdir(), "tenet-idx-"));
    try {
      return await this.buildTree(plan, { GIT_INDEX_FILE: join(dir, "index") });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  /** A failed program is uncertain if HEAD moved. */
  private async failedCommit(
    plan: CommitPlan,
    r: { stdout: string; stderr: string; timedOut: boolean },
    expectedTree: string,
  ): Promise<CommitOutcome> {
    const head = await this.refCommit("HEAD");
    if (head !== plan.parent)
      return {
        ...commitFail("effect-uncertain", "HEAD moved during a failed or interrupted commit; its outcome needs reconciliation"),
        expectedTree,
        ...(head ? { commit: head } : {}),
      };
    if (r.timedOut) return { ...commitFail("hook-failed", "the commit timed out; its process group was stopped"), expectedTree };
    const text = `${r.stdout}\n${r.stderr}`;
    return {
      ...commitFail(FAILURE_REASONS.find(([re]) => re.test(text))?.[1] ?? "hook-failed", text.trim().slice(-400)),
      expectedTree,
    };
  }

  /** Blob/mode changes, or excluded paths with changed stat. */
  private changedPaths(before: Inventory, after: Inventory, excludedBefore: Map<string, string>): string[] {
    return [...new Set([...before.entries.keys(), ...after.entries.keys()])].filter((p) => {
      const a = before.entries.get(p),
        b = after.entries.get(p);
      return a?.blob !== b?.blob || a?.mode !== b?.mode || (excludedBefore.has(p) && excludedBefore.get(p) !== this.stat(p));
    });
  }

  async commit(plan: CommitPlan): Promise<CommitOutcome> {
    const fail = commitFail;
    const dir = mkdtempSync(join(tmpdir(), "tenet-idx-"));
    plan = { ...plan, runDir: plan.runDir ?? join(dir, "run") };
    const env = { GIT_INDEX_FILE: join(dir, "index") };
    let expectedTree: string | undefined,
      launched = false;
    try {
      const signing = await this.signingGate();
      if (signing && !this.signingConsented.has(signing))
        return fail(
          "signing-unavailable",
          "configured signing changed or lacks consent; the commit was not attempted",
        );
      const before = await this.inventory([]);
      const excludedBefore = new Map(
        [...before.entries.keys()].filter((p) => !allowed("scan", p, this.exclusions)).map((p) => [p, this.stat(p)]),
      );
      expectedTree = plan.expectedTree ?? await this.expectedTree(plan);
      const filters = await this.commitFilters();
      const preparedTree = await this.buildTree(plan, env, { plan, filters });
      if ((await this.refCommit("HEAD")) !== plan.parent) return fail("effect-uncertain", "HEAD moved during Git filter preparation");
      if (this.changedPaths(before, await this.inventory([]), excludedBefore).length)
        return fail("hook-failed", "Git filter preparation changed working files; preserve the edits and check again");
      if (preparedTree !== expectedTree)
        return fail("capability-missing", "Git filters changed checked content; committed-tree checks are unavailable");
      const baseTree = plan.parent ? (await this.ok(["rev-parse", `${plan.parent}^{tree}`])).trim() : null;
      if (expectedTree === baseTree) return { ...fail("nothing-to-commit"), expectedTree };
      launched = true;
      const r = await this.program([...filters, "commit", "-m", plan.message, "--allow-empty-message"], plan, env);
      if (r.exit !== 0 || r.signal || r.timedOut) return this.failedCommit(plan, r, expectedTree);
      const commit = (await this.ok(["rev-parse", "HEAD"])).trim();
      const parents = (await this.ok(["show", "-s", "--format=%P", commit])).trim();
      if (parents !== (plan.parent ?? ""))
        return {
          ...fail("effect-uncertain", "unexpected commit parents"),
          expectedTree,
          commit,
        };
      const tree = (await this.ok(["rev-parse", `${commit}^{tree}`])).trim();
      const changed = (await this.ok(["diff-tree", "--no-commit-id", "--name-only", "-r", "-z", "--root", commit]))
        .split("\0")
        .filter(Boolean);
      const mine = new Set([...plan.paths, ...plan.deleted]);
      const after = await this.inventory([]);
      const touched = this.changedPaths(before, after, excludedBefore);
      const foreign = [...new Set([...changed, ...touched].filter((p) => !mine.has(p)))].sort();
      const sync = await this.syncIndex(
        changed.filter((p) => mine.has(p)),
        plan.parent,
        plan.indexJournal,
        commit,
      );
      return { ok: true, commit, tree, expectedTree, foreign, indexSync: sync, syncPaths: sync === "untouched" ? [...mine] : [] };
    } catch (e) {
      if (!launched && e instanceof KernelError && await this.refCommit("HEAD") === plan.parent)
        return fail(e.reasons[0]!.code, e.message);
      if (!launched && !(e instanceof KernelError)) throw e;
      const head = await this.refCommit("HEAD");
      return {
        ...fail("effect-uncertain", `commit outcome unverified: ${String(e)}`),
        expectedTree,
        ...(head ? { commit: head } : {}),
      };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  async reconcileCommit(
    parent: string | null,
    expectedTree: string,
    tenetPaths: readonly string[],
    label?: string,
  ): Promise<{ completed: boolean; commit?: string }> {
    const head = await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]);
    if (!head || head === parent) return { completed: false };
    if ((await this.tryOut(["show", "-s", "--format=%P", head])) !== (parent ?? "")) {
      return { completed: false };
    }
    if (label && !exactWorkTrailer(await this.ok(["show", "-s", "--format=%B", head]), label))
      return { completed: false };
    const tree = await this.tryOut(["rev-parse", `${head}^{tree}`]);
    if (tree === expectedTree) return { completed: true, commit: head };
    // A hook may have reformatted Tenet files: the trees may differ only on Tenet paths.
    const diff = await this.tryOut(["diff-tree", "-r", "--name-only", "-z", expectedTree, head]);
    if (diff === null) return { completed: false };
    const only = diff
      .split("\0")
      .filter(Boolean)
      .every((p) => tenetPaths.includes(p));
    return only ? { completed: true, commit: head } : { completed: false };
  }

  private async cursor(ref: string): Promise<ReflogCursorV1> {
    const path = await this.tryOut(["rev-parse", "--path-format=absolute", "--git-path", `logs/${ref}`]);
    return path ? reflogCursor(path, ref) : { available: false, reason: "reflog path unavailable" };
  }
  async commitContext(): ReturnType<Git["commitContext"]> {
    const ref = await this.tryOut(["symbolic-ref", "-q", "HEAD"]);
    if (!ref?.startsWith("refs/heads/")) throw new KernelError("repo-state-readonly", "detached commit is not admitted");
    const refs = await this.refCommit(ref) ? [ref] : [ref, "HEAD"];
    return { ref, cursors: await Promise.all(refs.map(r => this.cursor(r))) };
  }
  async observeCommit(intent: Pick<CommitIntentV1, "ref" | "parent">): ReturnType<Git["observeCommit"]> {
    const commit = await this.refCommit(intent.ref);
    const refs = intent.parent ? [intent.ref] : [intent.ref, "HEAD"];
    const cursors = await Promise.all(refs.map(ref => this.cursor(ref)));
    return { commit, cursors, stable: commit === await this.refCommit(intent.ref) };
  }
  async commitUnmoved(intent: Pick<CommitIntentV1, "ref" | "parent" | "cursors">): Promise<boolean> {
    const refs = intent.parent ? [intent.ref] : [intent.ref, "HEAD"];
    if (intent.cursors.length !== refs.length ||
      intent.cursors.some((c, i) => !c.available || c.ref !== refs[i])) return false;
    for (let read = 0; read < 2; read++) {
      const now = await this.observeCommit(intent);
      if (!now.stable || now.commit !== intent.parent || stableStringify(now.cursors) !== stableStringify(intent.cursors))
        return false;
    }
    return await this.refCommit(intent.ref) === intent.parent;
  }
  async verifyCommit(proof: CommitProofV1): Promise<boolean> {
    const object = await this.run(["cat-file", "commit", proof.commit]);
    if (object.code !== 0) return false;
    const raw = object.stdout;
    const boundary = raw.indexOf("\n\n"), headers = raw.slice(0, boundary).split("\n");
    const parents = headers.filter(line => line.startsWith("parent ")).map(line => line.slice(7));
    if (boundary < 0 || stableStringify(parents) !== stableStringify(proof.parents) ||
      !exactWorkTrailer(raw.slice(boundary + 2), proof.label) || headers[0] !== `tree ${proof.observedTree}`) return false;
    const diff = await this.tryOut(["diff-tree", "-r", "--name-only", "-z", proof.expectedTree, proof.observedTree]);
    if (diff === null || diff.split("\0").filter(Boolean).some(p => !proof.paths.includes(p) && !proof.foreign.includes(p)))
      return false;
    const changed = await this.tryOut(["diff-tree", "--root", "--no-commit-id", "-r", "--name-only", "-z", proof.commit]);
    return changed !== null && changed.split("\0").filter(Boolean).every(p => proof.paths.includes(p) || proof.foreign.includes(p));
  }

  /** Exact index sync under Git's own lock (GIT-03): only entries still equal to the old HEAD's are advanced. */
  async syncIndex(
    paths: readonly string[],
    oldHead: string | null,
    journal?: IndexJournal,
    head?: string,
  ): Promise<CommitOutcome["indexSync"]> {
    if (!paths.length) return "not-needed";
    const gitDir = (await this.ok(["rev-parse", "--absolute-git-dir"])).trim();
    if (readdirSync(gitDir).some((f) => f.startsWith("sharedindex."))) return "untouched";
    const target = head ?? (await this.refCommit("HEAD"));
    if (!target || (await this.refCommit("HEAD")) !== target) return "untouched";
    const lock = join(gitDir, "index.lock"),
      temp = `tenet-index-${randomUUID()}.lock`,
      stagedLock = join(gitDir, temp);
    let fd = openSync(stagedLock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600);
    const acquired = fstatSync(fd),
      ownsLock = () => sameFile(lock, acquired);
    const scratchDir = mkdtempSync(join(tmpdir(), "tenet-sync-"));
    let logged = false,
      published = false,
      status: CommitOutcome["indexSync"] = "untouched";
    try {
      fsyncSync(fd);
      syncDir(gitDir);
      const record = IndexSyncRecord.parse({
        parent: oldHead,
        head: target,
        paths,
        dev: acquired.dev,
        ino: acquired.ino,
        temp,
        ...(journal?.owner ?? { pid: process.pid, procStart: procStart(process.pid) ?? "" }),
      });
      if (journal) {
        await journal.intent(record);
        logged = true;
      }
      const linked = await linkLock(stagedLock, lock, gitDir);
      if (!linked) return status;
      const scratch = join(scratchDir, "index");
      if (existsSync(join(gitDir, "index")) && !lstatSync(join(gitDir, "index")).isFile()) return status;
      if (existsSync(join(gitDir, "index"))) copyFileSync(join(gitDir, "index"), scratch);
      await this.advanceScratch(scratch, paths, oldHead, target);
      if (!ownsLock() || (await this.refCommit("HEAD")) !== target) return status;
      writeFileSync(fd, readFileSync(scratch));
      fsyncSync(fd);
      closeSync(fd);
      fd = -1;
      if (!ownsLock() || (await this.refCommit("HEAD")) !== target) return status;
      renameSync(lock, join(gitDir, "index"));
      published = true;
      syncDir(gitDir);
      status = "synced";
      return status;
    } catch (e) {
      if (published)
        throw new KernelError(
          "effect-uncertain",
          `the index rename was observed but durability could not be established: ${String(e)}`,
          { exit: 2 },
        );
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

  /** On a scratch copy of the index, move each path that still equals the old HEAD's entry to the new HEAD's (or remove it). */
  private async advanceScratch(scratch: string, paths: readonly string[], oldHead: string | null, target: string): Promise<void> {
    const env = { GIT_INDEX_FILE: scratch };
    const lit = paths.map((p) => `:(literal)${p}`);
    const idx = indexLines(await this.ok(["ls-files", "-s", "-z", "--", ...lit], { env }), 1);
    const old = oldHead
      ? indexLines(await this.ok(["ls-tree", "-r", "-z", oldHead, "--", ...lit]), 2)
      : new Map<string, string>();
    const next = indexLines(await this.ok(["ls-tree", "-r", "-z", target, "--", ...lit]), 2);
    const info: string[] = [];
    for (const p of paths) {
      if ((idx.get(p) ?? "") !== (old.get(p) ?? "")) continue; // the user staged something else here: never touched
      const n = next.get(p);
      info.push(n ? `${n.split(" ")[0]} ${n.split(" ")[1]}\t${p}` : `0 ${ZERO}\t${p}`);
    }
    if (info.length) await this.ok(["update-index", "-z", "--index-info"], { env, input: `${info.join("\0")}\0` });
  }

  async recoverIndexSync(raw: unknown, journal: IndexJournal): Promise<CommitOutcome["indexSync"] | "uncertain"> {
    const parsed = IndexSyncRecord.safeParse(raw);
    if (!parsed.success || isAlive(parsed.data.pid, parsed.data.procStart)) return "uncertain";
    const record = parsed.data,
      gitDir = (await this.ok(["rev-parse", "--absolute-git-dir"])).trim();
    const lock = join(gitDir, "index.lock"),
      temp = join(gitDir, record.temp),
      index = join(gitDir, "index");
    const landed = sameFile(index, record);
    if (landed) {
      if (sameFile(lock, record)) rmSync(lock);
      if (sameFile(temp, record)) rmSync(temp);
      syncDir(gitDir);
      return "synced";
    }
    if (existsSync(lock) && !sameFile(lock, record)) {
      if (sameFile(temp, record)) {
        rmSync(temp);
        syncDir(gitDir);
      }
      return "untouched";
    }
    if (sameFile(lock, record)) rmSync(lock);
    if (sameFile(temp, record)) rmSync(temp);
    syncDir(gitDir);
    return this.syncIndex(record.paths, record.parent, journal, record.head);
  }

  private async shallow() {
    return (await this.tryOut(["rev-parse", "--is-shallow-repository"])) === "true";
  }

  async workCommits(label: string, ref = "HEAD"): Promise<{ commits: string[]; shallow: boolean; merges: boolean }> {
    const shallow = await this.shallow();
    const all = await this.run(["log", "--format=%H", "--fixed-strings", `--grep=Tenet-Work`, ref, "--"]);
    if (all.code !== 0) throw new KernelError("undo-conflict", "the discovery history cannot be read completely");
    const commits: string[] = [];
    for (const oid of all.stdout.trim().split("\n").filter(Boolean)) {
      if (exactWorkTrailer(await this.ok(["show", "-s", "--format=%B", oid]), label)) commits.push(oid);
    }
    const merges = (await Promise.all(commits.map((c) => this.tryOut(["rev-list", "--parents", "-n", "1", c])))).some(
      (l) => (l ?? "").split(" ").length > 2,
    );
    return { commits, shallow, merges };
  }

  async tenetHistory() {
    const w = async (...a: string[]) => (await this.tryOut(a))?.match(/\S+/g) ?? [];
    const labels: Record<string, number> = {};
    for (const l of await w("log", "--all", "--max-count=500", "--format=%(trailers:key=Tenet-Work,valueonly)"))
      if (/^W-[0-9]{4,5}$/.test(l)) labels[l] = (labels[l] ?? 0) + 1;
    return {
      labels, unmerged: await w("for-each-ref", "--no-merged=HEAD", "--format=%(refname:short)", "refs/heads/tenet/"),
      shallow: await this.shallow(),
    };
  }

  pinHead = () => pin(this.undoAdapter());
  undoNames = (commits: readonly string[]) => names(this.undoAdapter(), commits);
  planUndo = (commits: readonly string[], head: string) => planInverse(this.undoAdapter(), commits, head);
  undoObstructions = (head: string, paths: readonly string[]) => obstructions(this.undoAdapter(), head, paths);
  undoState = (head: string, branch: string | null, paths: readonly string[]) => undoStateOf(this.undoAdapter(), head, branch, paths);
  applyUndo = (input: UndoApply) => guardedApplyUndo(
    this.undoAdapter(), input, async () => {
      await this.objectFormatSafe();
      await this.refuseFilters("undoing work");
    },
  );

  async blobsAt(treeish: string, paths: readonly string[]): Promise<Record<string, string | null>> {
    const out: Record<string, string | null> = Object.fromEntries(paths.map((p) => [p, null]));
    if (!paths.length) return out;
    for (const rec of (await this.ok(["ls-tree", "-r", "-z", treeish, "--", ...paths.map((p) => `:(literal)${p}`)]))
      .split("\0")
      .filter(Boolean)) {
      const t = rec.indexOf("\t");
      out[rec.slice(t + 1)] = rec.slice(0, t).split(" ")[2]!;
    }
    return out;
  }

  async treeAt(treeish: string): Promise<Array<{ path: string; mode: string; blob: string }>> {
    return (await this.ok(["ls-tree", "-r", "-z", treeish])).split("\0").filter(Boolean).flatMap((record) => {
      const tab = record.indexOf("\t"), fields = record.slice(0, tab).split(" ");
      const path = record.slice(tab + 1), mode = fields[0], blob = fields[2];
      return tab < 0 || !path || !mode || !blob ? [] : [{ path, mode, blob }];
    });
  }

  async imagesAt(treeish: string, paths: readonly string[]) {
    const out: Record<string, { mode: string; blob: string } | null> =
      Object.fromEntries(paths.map(path => [path, null]));
    if (!paths.length) return out;
    for (const rec of (await this.ok(["ls-tree", "-r", "-z", treeish, "--", ...paths.map(p => `:(literal)${p}`)]))
      .split("\0")
      .filter(Boolean)) {
      const tab = rec.indexOf("\t"), fields = rec.slice(0, tab).split(" ");
      out[rec.slice(tab + 1)] = { mode: fields[0]!, blob: fields[2]! };
    }
    return out;
  }

  laterCommits = (owned: readonly string[], oldest: string, head: string, paths: readonly string[]) =>
    later(this.undoAdapter(), owned, oldest, head, paths);

  async refCommit(ref: string): Promise<string | null> {
    return this.tryOut(["rev-parse", "-q", "--verify", `${ref}^{commit}`]);
  }

  async predictConflicts(base: string, work: string): Promise<{ supported: boolean; paths: string[] }> {
    const r = await this.run(["merge-tree", "--write-tree", "--name-only", "-z", base, work]);
    if (r.code === 0) return { supported: true, paths: [] };
    if (r.code !== 1) return { supported: false, paths: [] };
    // "<tree>\0<conflicted names>\0...\0\0<messages>": the names end at the first empty field.
    const fields = r.stdout.split("\0").slice(1);
    const end = fields.indexOf("");
    return { supported: true, paths: fields.slice(0, end < 0 ? fields.length : end) };
  }

  async mergeBase(a: string, b: string): Promise<string | null> {
    return this.tryOut(["merge-base", a, b]);
  }

  async showAt(treeish: string, path: string): Promise<string | null> {
    const r = await this.run(["cat-file", "blob", `${treeish}:${path}`]);
    return r.code === 0 ? r.stdout : null;
  }

  async showAtBounded(treeish: string, path: string, maxBytes: number): Promise<string | null> {
    const size = await this.tryOut(["cat-file", "-s", `${treeish}:${path}`]);
    if (!size || !/^\d+$/.test(size) || Number(size) > maxBytes) return null;
    return this.showAt(treeish, path);
  }

  async changedSince(from: string, to: string): Promise<string[]> {
    return (await this.ok(["diff", "--name-only", "--no-renames", "-z", from, to])).split("\0").filter(Boolean);
  }

  async grepAt(treeish: string, needles: readonly string[], paths: readonly string[]): Promise<string[]> {
    if (!needles.length || !paths.length) return [];
    const patterns = needles.flatMap((n) => ["-e", n]);
    const pathspecs = paths.map((x) => `:(literal)${x}`);
    const r = await this.run(["grep", "-l", "-z", "-F", "--no-textconv", ...patterns, treeish, "--", ...pathspecs]);
    if (r.code === 1) return [];
    if (r.code !== 0) throw new KernelError("repo-state-readonly", `git grep failed: ${r.stderr.trim().slice(0, 200)}`);
    return r.stdout.split("\0").filter(Boolean).map((x) => x.slice(treeish.length + 1));
  }

  async integrate(base: string, work: string, options?: Parameters<Git["integrate"]>[2]): ReturnType<Git["integrate"]> {
    await this.objectFormatSafe();
    await this.refuseFilters("integrating work");
    if ((await this.probe()).hooks)
      throw new KernelError(
        "capability-missing",
        "integration hooks require an execution consent path that is not implemented; the editor was not switched",
        { exit: 2 },
      );
    if ((await this.tryOut(["config", "--bool", "commit.gpgsign"])) === "true")
      throw new KernelError(
        "signing-unavailable",
        "integration signing consent is not implemented; the editor was not switched",
        { exit: 2 },
      );
    const runDir = options?.runDir ?? mkdtempSync(join(tmpdir(), "tenet-integrate-"));
    const env = gitConfigEnv();
    let launched = false;
    const run = (args: string[]) => {
      launched = true;
      return this.runner.run({
        argv: ["git", ...INSPECT, ...args],
        cwd: this.root,
        runDir,
        timeoutMs: options?.timeoutMs ?? 60_000,
        env,
      });
    };
    const fail = (detail: string) => ({ ok: false, uncertain: launched, detail: detail.trim().slice(-400) });
    try {
      const pinned = await pinIntegration(
        base, work, options,
        (args) => this.tryOut(args),
        (args) => run(args),
      );
      if (!pinned.pinned && (await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"])) !== base) {
        const sw = await run(["switch", "-q", base]);
        if (sw.exit !== 0 || sw.timedOut || sw.signal) return fail(sw.stderr || "branch switch did not complete cleanly");
      }
      const ff = (await this.run(["merge-base", "--is-ancestor", pinned.base, pinned.work])).code === 0;
      const message = `Merge ${work} into ${base}`;
      const resolved = ff ? undefined : options?.resolved;
      const m = await run(
        ff ? ["merge", "-q", "--ff-only", pinned.work]
          : ["merge", "-q", "--no-ff", ...(resolved ? ["--no-commit"] : ["-m", message]), pinned.work],
      );
      if (resolved && !m.timedOut && !m.signal) {
        const why = await commitResolved(
          { root: this.root, ok: (args) => this.ok(args), run: (args) => this.run(args), tryOut: (args) => this.tryOut(args) },
          run, resolved, message,
        );
        if (why) return fail(why);
      } else if (m.exit !== 0 || m.timedOut || m.signal) return fail(`${m.stdout}${m.stderr}` || "integration did not complete cleanly");
      const finished = await finishIntegration(
        runDir, base, work, options ?? {}, (args) => this.tryOut(args), run,
        ff ? "fast-forward" : "merge",
      );
      return { ok: true, ...finished };
    } catch (e) {
      return fail(String(e));
    }
  }

  async reconcileIntegration(
    base: string,
    baseBefore: string,
    work: string,
    runDir?: string,
    proposal?: string,
    workBranch?: string,
    preBranch?: string | null,
    preHead?: string | null,
  ): ReturnType<Git["reconcileIntegration"]> {
    const now = await this.refCommit(base);
    const proof = readIntegrationProof(runDir);
    if (!proof) {
      const head = await this.tryOut(["rev-parse", "-q", "--verify", "HEAD"]);
      const branch = await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]);
      const merge = await this.tryOut(["rev-parse", "-q", "--verify", "MERGE_HEAD"]);
      const conflicted = !!(await this.tryOut(["diff", "--name-only", "--diff-filter=U"]));
      const exactPre = branch === preBranch && head === preHead && head === (preBranch === workBranch ? work : preHead) &&
        now === baseBefore && merge === null && !conflicted;
      return { completed: false, ...(!exactPre ? { merging: true } : {}) };
    }
    if (proof.base !== base || proof.baseTip !== baseBefore || proof.proposal !== proposal ||
      proof.workTip !== work) return { completed: false };
    const branch = await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"]);
    if (branch !== base) return { completed: false, merging: true };
    if (!now || now === baseBefore) {
      return { completed: false, merging: true };
    }
    if (now !== proof.commit ||
      (await this.tryOut(["rev-parse", `${now}^{tree}`])) !== proof.tree) return { completed: false };
    if (now === work) return { completed: true, commit: now, mode: "fast-forward" };
    const parents = ((await this.tryOut(["rev-list", "--parents", "-n", "1", now])) ?? "").split(" ").slice(1);
    return parents.length === 2 && parents[0] === baseBefore && parents[1] === work
      ? { completed: true, commit: now, mode: "merge" }
      : { completed: false };
  }

  async parentOf(commit: string): Promise<string | null> {
    return this.tryOut(["rev-parse", "-q", "--verify", `${commit}^`]);
  }

  async ancestors(commits: readonly string[], target = "HEAD"): Promise<Set<string>> {
    const out = new Set<string>();
    for (const c of new Set(commits)) if ((await this.run(["merge-base", "--is-ancestor", c, target])).code === 0) out.add(c);
    return out;
  }

  async init(): Promise<void> {
    await this.ok(["init", "-q"], { inspect: false });
  }

  async initShadow(): Promise<void> {
    mkdirSync(this.shadowDir, { recursive: true, mode: 0o700 });
    await this.ok(["--git-dir", this.shadowDir, "--work-tree", this.root, "init", "-q"], { inspect: false });
    mkdirSync(join(this.shadowDir, "info"), { recursive: true });
    writeFileSync(join(this.shadowDir, "info/exclude"), `${SHADOW_EXCLUDE.join("\n")}\n`);
    for (const [k, v] of [
      ["user.name", "Tenet"],
      ["user.email", "tenet@localhost"],
      ["commit.gpgsign", "false"],
    ] as const)
      await this.ok(["config", k, v], { inspect: false });
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
    const changed = (await this.ok(["ls-files", "-z", "--others", "--modified", "--exclude-standard"]))
      .split("\0")
      .filter(Boolean);
    const bytes = changed.reduce((n, p) => {
      try {
        return n + lstatSync(join(this.root, p)).size;
      } catch {
        return n;
      }
    }, 0);
    if (bytes > MAX_SNAPSHOT_BYTES)
      throw new KernelError(
        "snapshot-too-large",
        `${(bytes / 1048576).toFixed(0)} MB to snapshot; \`git init\` here to use a real repository`,
      );
    await this.ok(["add", "-A"], { inspect: false });
    if (
      (await this.run(["diff", "--cached", "--quiet"])).code === 0 &&
      (await this.tryOut(["rev-parse", "--verify", "-q", "HEAD"]))
    )
      return null;
    await this.ok(["commit", "-q", "--allow-empty", "-m", message], { inspect: false });
    return await this.tryOut(["rev-parse", "HEAD"]);
  }

  async createBranch(name: string): Promise<void> {
    if ((await this.tryOut(["symbolic-ref", "-q", "--short", "HEAD"])) === name) return;
    const hook = (await this.ok(["rev-parse", "--git-path", "hooks/post-checkout"])).trim();
    if (existsSync(resolve(this.root, hook)))
      throw new KernelError(
        "capability-missing",
        "creating a work branch could run a checkout hook; that guarded execution path is unavailable, so the editor was not switched",
        { exit: 2 },
      );
    await this.ok(["checkout", "-q", "-b", name], { inspect: false });
  }
}

/** Parses `git diff -U0` into per-file hunks of added and removed lines. */
function parseDiff(diff: string, classify: (p: string) => FileChange["kind"]): FileChange[] {
  const files: FileChange[] = [];
  let cur: FileChange | null = null,
    hunk: Hunk | null = null,
    from = "";
  for (const line of diff.split("\n")) {
    if (line.startsWith("diff --git ")) {
      cur = null;
      hunk = null;
      from = "";
      continue;
    }
    if (!cur && line.startsWith("--- ")) {
      from = line.slice(4).replace(/^a\//, "");
      continue;
    }
    if (!cur && line.startsWith("+++ ")) {
      const to = line.slice(4);
      const path = to === "/dev/null" ? from : to.replace(/^b\//, "");
      cur = { path, kind: classify(path), hunks: [], added: 0, removed: 0 };
      files.push(cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith("@@")) {
      const m = /\+(\d+)/.exec(line);
      hunk = { line: Number(m?.[1] ?? 1), added: [], removed: [] };
      cur.hunks.push(hunk);
    } else if (hunk && line.startsWith("+")) {
      hunk.added.push(line.slice(1));
      cur.added++;
    } else if (hunk && line.startsWith("-")) {
      hunk.removed.push(line.slice(1));
      cur.removed++;
    }
  }
  return files;
}
