// The six ports (TS §6.1): Store, Git, Runner, Host, Clock, Random. Everything with a side effect sits behind one.
// A port exists only where there is a second implementation or a real test boundary; pure logic has no interface.
import type { AttentionPattern, FileChange } from "../core/review.ts";
import type { Random } from "../core/ids.ts";
import type { IndexSyncRecord, State } from "../core/schemas.ts";
import type { Exclusion } from "../core/exclusions.ts";

export type { Random };
export interface Clock { now(): string; ms(): number }

// ---------------------------------------------------------------- store
export interface LogEntry { t: string; kind: "intent" | "result" | "call" | "accounting"; effect?: string; id?: string; [k: string]: unknown }
export interface Quarantined { path: string; nonce: string; entries: number }

export interface Tx {
  /** The current state, or null before the first mutating call created `.tenet/`. */
  readonly state: State | null;
  /** True when the document came from state.prev (grants are suspended until reconfirmed). */
  readonly recovered: boolean;
  readonly quarantined?: Quarantined;
  /** Creates `.tenet/` and the marker on first need and returns the identity every handle carries. */
  ensure(): { workspaceId: string; tag: string };
  publish(next: State): void;
  /** Appends a call record to the log inside the transaction, so the log never races a repair. */
  call(entry: Omit<LogEntry, "t" | "kind">): void;
  intent(effect: string, id: string, op: unknown): void;
  result(effect: string, id: string, outcome: unknown): void;
  /** Unresolved effect intents, for reconciliation before anything else touches the resource. */
  unresolved(): Array<{ effect: string; id: string; op: unknown }>;
  /** The most recent log entries, for applying a result that was logged but never published. */
  recent(n: number): LogEntry[];
}

export interface Store {
  exists(): boolean;
  read(): { state: State; recovered: boolean } | null;
  transaction<T>(verb: string, fn: (tx: Tx) => Promise<T>): Promise<T>;
  /** The one pre-lock maintenance step: remove a dead lock and its dead guard. */
  repairLock(): Promise<{ removed: string[] }>;
  readLog(): LogEntry[];
  putBlob(content: string): string;
  readBlob(hash: string): string | null;
  /** A directory for this call's artifacts (run dirs, manifests), outside the project. */
  tempDir(name: string): string;
  /** True while a process with this identity is alive; paused processes are alive (TS §7.3). */
  alive(pid: number, procStart: string): Promise<boolean>;
  /** This process's identity, recorded so a later call can tell whether it is still running. */
  self(): { pid: number; procStart: string };
  /** Writes a file under a directory returned by `tempDir` and returns its path. */
  writeArtifact(dir: string, name: string, content: string): string;
  /** Removes this workspace's run directories and manifests older than `maxAgeMs`, except those under `keep` (TS §7.6). */
  sweepTemp(maxAgeMs: number, keep: readonly string[]): number;
  /** Whether the project folder accepts writes (doctor). */
  canWrite(): boolean;
}

// ---------------------------------------------------------------- git
export interface Entry { path: string; mode: string; blob: string; link?: string }
export interface StatusEntry { path: string; xy: string; staged: boolean; untracked: boolean; mode: string; blob: string; indexBlob: string }
export interface Inventory {
  head: string | null; branch: string | null; entries: Map<string, Entry>; status: StatusEntry[]; digest: string;
}
export interface RepoProbe {
  isRepo: boolean; /** the repository is the shadow repository in .tenet/git (a non-Git prototype) */ shadow: boolean; version: string; top: string | null; head: string | null; branch: string | null;
  state: "ok" | "none" | "readonly"; why?: string; identity: boolean; remotes: string[]; hooks: string | null;
}
export interface IndexJournal {
  owner: { pid: number; procStart: string };
  intent(record: IndexSyncRecord): Promise<void>;
  result(status: CommitOutcome["indexSync"]): Promise<void>;
}
export interface CommitPlan { paths: string[]; deleted: string[]; message: string; parent: string | null; timeoutMs: number; runDir?: string; indexJournal?: IndexJournal }
export interface CommitOutcome {
  ok: boolean; commit?: string; tree?: string; expectedTree?: string; foreign: string[]; reason?: string; detail?: string;
  indexSync: "synced" | "untouched" | "not-needed"; syncPaths: string[];
}
export interface Git {
  setExclusions(exclusions: readonly Exclusion[]): void;
  probe(): Promise<RepoProbe>;
  inventory(exclude: readonly string[], declaredInputs?: readonly string[]): Promise<Inventory>;
  /** Working-tree changes of `paths` against `base` as hunks of added and removed lines. */
  changes(base: string | null, paths: readonly string[], classify: (p: string) => FileChange["kind"]): Promise<FileChange[]>;
  /** The tree a commit of exactly these paths would have; logged with the intent so recovery can verify the postcondition. */
  expectedTree(plan: Pick<CommitPlan, "paths" | "deleted" | "parent">): Promise<string>;
  commit(plan: CommitPlan): Promise<CommitOutcome>;
  /** Postcondition for crash recovery: did a commit with this parent and tree land? */
  reconcileCommit(parent: string | null, expectedTree: string, tenetPaths: readonly string[]): Promise<{ completed: boolean; commit?: string }>;
  syncIndex(paths: readonly string[], oldHead: string | null, journal?: IndexJournal, head?: string): Promise<CommitOutcome["indexSync"]>;
  /** Reconcile a journalled lock of a dead process, then rerun only the exact recorded sync. */
  recoverIndexSync(record: unknown, journal: IndexJournal): Promise<CommitOutcome["indexSync"] | "uncertain">;
  /** Commits on the current history carrying `Tenet-Work: <label>`, newest first; `shallow` when history is cut short. */
  workCommits(label: string): Promise<{ commits: string[]; shallow: boolean; merges: boolean }>;
  /** The inverse of these commits (newest first) applied to a temporary index from HEAD; never touches the real index or tree. */
  planUndo(commits: readonly string[]): Promise<{ ok: true; tree: string; patch: string; paths: string[]; stat: string } | { ok: false; conflict: string[]; detail: string }>;
  /** Applies a patch to the working tree only (never the index); `include` limits it to these paths. */
  applyPatch(patch: string, include?: readonly string[], options?: { runDir: string; timeoutMs: number }): Promise<{ ok: boolean; detail?: string; uncertain?: boolean }>;
  /** Blob ids of paths in a tree-ish (null when absent). */
  blobsAt(treeish: string, paths: readonly string[]): Promise<Record<string, string | null>>;
  /** Commits after `since` on the current history that touch these paths. */
  laterCommits(since: string, paths: readonly string[]): Promise<string[]>;
  /** The commit a ref names, or null. */
  refCommit(ref: string): Promise<string | null>;
  /** Files an integration would conflict on, from `git merge-tree` (writes objects only); supported is false before Git 2.38. */
  predictConflicts(base: string, work: string): Promise<{ supported: boolean; paths: string[] }>;
  /** Switches to `base` and fast-forwards, or merges when the base moved. */
  integrate(base: string, work: string, options?: { runDir: string; timeoutMs: number }): Promise<{ ok: boolean; commit?: string; mode?: "fast-forward" | "merge"; detail?: string; uncertain?: boolean }>;
  /** Postcondition for recovery: did this integration land (TS §7.4)? */
  reconcileIntegration(base: string, baseBefore: string, work: string): Promise<{ completed: boolean; commit?: string; mode?: "fast-forward" | "merge" }>;
  /** The parent of a commit, or null for a root commit. */
  parentOf(commit: string): Promise<string | null>;
  /** Which of these commits are ancestors of HEAD (`git merge-base --is-ancestor`). */
  ancestors(commits: readonly string[]): Promise<Set<string>>;
  init(): Promise<void>;
  /** Creates the shadow repository for a folder with no Git (TS §10.9) and takes the first snapshot. */
  initShadow(): Promise<void>;
  /** Commits a snapshot of the folder into the shadow repository; a no-op in a real repository. */
  snapshot(message: string): Promise<string | null>;
  /** Creates and switches to a branch from HEAD, carrying the working tree; idempotent when already on it. */
  createBranch(name: string): Promise<void>;
}

// ---------------------------------------------------------------- runner
export interface RunSpec {
  argv: string[]; cwd: string; runDir: string; timeoutMs: number;
  /** Kernel-selected variables, never a user-supplied execution surface. */
  env?: Record<string, string>;
  /** A file the command writes its report to; the runner returns its content. */
  report?: string;
}
export interface RunResult {
  exit?: number; signal?: string; timedOut: boolean; durationMs: number; pid?: number; stdout: string; stderr: string; startedAt: string;
  report: string | null;
}
export interface Runner {
  /** Bind a prepared run directory (including its child commands) to an atomic kernel spawn check. */
  guardRun(runDir: string, admit: (spawn: () => Promise<RunResult>) => Promise<RunResult>): void;
  run(spec: RunSpec): Promise<RunResult>;
  /** Stops the recorded process group if its identity still matches (TS §7.4 Check run). */
  stopRun(runDir: string): Promise<"stopped" | "gone" | "unknown">;
}

// ---------------------------------------------------------------- stack (Node/TypeScript adapter)
export interface ToolVersions { node: string; tool: string; reporter: string; adapter: string }
export interface Detection {
  language: "ts-js" | "other"; typescript: boolean; depsInstalled: boolean; runnerSupported: boolean; runner?: "vitest";
  runnerVersion?: string; packageManager: "npm" | "pnpm" | "yarn" | "unknown"; moduleRoot: string; experimental: boolean;
}
export interface Normalized {
  files: Map<string, { executed: number; passed: number; failed: number; skipped: number; focused: number; tests: string[]; failureKinds: string[]; failures: Array<{ test: string; kind: string; message: string }> }>;
  invalid?: string; discovered: number;
}
export interface Stack {
  setExclusions(exclusions: readonly Exclusion[]): void;
  detect(root: string): Detection;
  argv(files: readonly string[] | "all", reportPath: string): string[];
  normalize(raw: string, root: string): Normalized;
  fingerprint(root: string): ToolVersions;
  patterns: readonly AttentionPattern[];
  classify(path: string): FileChange["kind"];
  isTestPath(path: string): boolean;
}

// ---------------------------------------------------------------- recipes and the project folder (starter scaffold)
export interface RecipeFile { path: string; content: string; mode: number }
export interface Recipe {
  id: string; version: string; sentinel: string; lockfileSha256: string; protectedPaths: string[]; install: string[][]; files: RecipeFile[];
}
export interface Recipes {
  load(id: string): Recipe | null;
  /** A text file shipped in the plugin, for example a skill; null when absent. */
  text(rel: string): string | null;
}
export interface Project {
  setExclusions(exclusions: readonly Exclusion[]): void;
  /** Creates each file exclusively (never overwrites), making directories as needed. */
  writeNew(files: readonly RecipeFile[]): void;
  /** sha256 of each regular file's content; null only when absent. Linked/excluded/unreadable inputs throw. */
  hashes(paths: readonly string[]): Record<string, string | null>;
  /** A regular file's text; null only when absent. Linked/excluded/unreadable inputs throw. */
  read(path: string): string | null;
  /** Replaces one file atomically (a temporary file renamed over it), making directories as needed. */
  write(path: string, content: string): void;
  remove(paths: readonly string[]): void;
}

export interface Ports {
  root: string; version: string; store: Store; git: Git; runner: Runner; stack: Stack; clock: Clock; rand: Random;
  recipes: Recipes; project: Project;
}

