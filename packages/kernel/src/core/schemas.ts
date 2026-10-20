// zod schemas for every verb input, record and output (TS §6.2 core/schemas). Wire schemas use only
// JSON-compatible constructs so z.toJSONSchema() converts them without loss (TS §3.3).
import { z } from "zod";
import { settingsSchema } from "./config.ts";
import { Policy } from "./policy.ts";

export const SCHEMA_VERSION = 1 as const;

/** An index lock is journalled before its inode becomes visible at Git's shared lock path. */
export const IndexSyncRecord = z.strictObject({
  parent: z.string().regex(/^[a-f0-9]{40}$/).nullable(), head: z.string().regex(/^[a-f0-9]{40}$/),
  paths: z.array(z.string().min(1).refine(p => !p.startsWith("/") && !p.split("/").includes("..") && !p.includes("\0"))).min(1),
  dev: z.number().int().nonnegative(), ino: z.number().int().nonnegative(),
  temp: z.string().regex(/^tenet-index-[a-f0-9-]{36}\.lock$/),
  pid: z.number().int().positive(), procStart: z.string().trim().min(1),
});
export type IndexSyncRecord = z.infer<typeof IndexSyncRecord>;

export const Lane = z.enum(["quick", "standard", "deep"]);
export const Endpoint = z.enum(["blocked", "findings-only", "implemented-unverified", "checked-local", "prototype"]);
export const Scope = z.enum(["committed", "working-tree-uncommitted", "working-tree-with-your-edits"]);
export const Level = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export const Profile = z.enum([
  "feature", "bug", "refactor", "investigate", "prototype", "plan", "continue", "fix", "promote", "recipe-upgrade",
]);
export const Severity = z.enum(["blocker", "major", "minor", "note"]);
export const StopReason = z.enum(["repeated-failure", "budget-exhausted", "host-limit", "user-stop", "declined"]);
export const WorkState = z.enum([
  "proposed", "authorized", "executing", "checking", "finished", "blocked", "parked", "cancelled", "superseded",
]);
export const ActionClass = z.enum([
  "local-routine", "scope-widen", "protected-path", "dependency", "integrate", "remote", "destructive", "risk-accept",
]);

/** The closed `next` vocabulary (TS §5.2). lint-skills checks every action is handled. */
export const ACTIONS = [
  "ask", "basis", "plan", "decision", "research", "test", "implement", "check", "review", "recheck",
  "focused-review", "commit", "finish", "reconcile", "revalidate", "integrate", "publish", "stop",
] as const;
export const Action = z.enum(ACTIONS);

export type Lane = z.infer<typeof Lane>;
export type Endpoint = z.infer<typeof Endpoint>;
export type Scope = z.infer<typeof Scope>;
export type Level = z.infer<typeof Level>;
export type Profile = z.infer<typeof Profile>;
export type Severity = z.infer<typeof Severity>;
export type StopReason = z.infer<typeof StopReason>;
export type WorkState = z.infer<typeof WorkState>;
export type ActionClass = z.infer<typeof ActionClass>;
export type Action = z.infer<typeof Action>;

// ---------------------------------------------------------------- records (state document, TS §7.2)

export const BasisElement = z.object({
  id: z.string(),
  origin: z.enum(["request", "tenet"]),
  kind: z.enum(["requirement", "example", "invariant", "constraint", "assumption", "decision", "deferred"]),
  text: z.string(),
  of: z.string().optional(), // requirement id an example or invariant belongs to
  test: z.enum(["distinguishing", "preservation", "boundary"]).optional(),
  expect: z.enum(["fail", "pass"]).optional(), // declared baseline expectation (boundary cases)
  testFile: z.string().optional(),
  support: z.array(z.string()).optional(), // helpers, fixtures and setup files the test depends on: locked with it
  expiresAt: z.string().optional(),
  verifiedBy: z.union([
    z.array(z.object({ method: z.enum(["obligation", "review", "manual"]), ref: z.string() })),
    z.object({ notApplicable: z.string() }),
  ]),
});
export type BasisElement = z.infer<typeof BasisElement>;

export const DecisionRecord = z.object({
  id: z.string(), title: z.string(), status: z.enum(["accepted", "superseded"]), date: z.string(),
  context: z.string(), decision: z.string(), consequences: z.string(),
  alternatives: z.array(z.object({ option: z.string(), why: z.string() })),
  supersedes: z.string().optional(), links: z.array(z.string()), quote: z.string(), // the user's own words (capture: reported)
});
export type DecisionRecord = z.infer<typeof DecisionRecord>;

export const PlanItem = z.object({
  id: z.string(), outcome: z.string(), elementIds: z.array(z.string()), dependsOn: z.array(z.string()),
  check: z.string(), state: z.enum(["proposed", "accepted", "in-progress", "done", "dropped"]), work: z.string().optional(),
});
export type PlanItem = z.infer<typeof PlanItem>;

export const Grant = z.strictObject({
  id: z.string(), actions: z.array(ActionClass), paths: z.array(z.string()).optional(),
  source: z.enum(["request", "decide"]), capture: z.enum(["reported", "elicited"]),
  quote: z.string().optional(), bind: z.strictObject({ factsHash: z.string() }), expiresAt: z.string().optional(),
});
export type Grant = z.infer<typeof Grant>;

export const Obligation = z.object({
  id: z.string(),
  kind: z.enum(["test", "static", "build", "audit", "workload", "manual"]),
  category: z.enum(["acceptance", "boundary", "affected", "release", "manual-affected"]),
  targeted: z.boolean().optional(),
  tool: z.string().optional(), // adapter tool id, e.g. "vitest"
  example: z.string().optional(),
  testFile: z.string().optional(),
  support: z.array(z.string()).optional(),
  test: z.enum(["distinguishing", "preservation", "boundary"]).optional(),
  expectation: z.enum(["fail", "pass"]).optional(), // declared baseline expectation
  state: z.enum(["registered", "verified", "locked", "revised"]).optional(),
  baselineTestHash: z.string().optional(), // hash of the test file at its red run (red-invalidated, TS §8.1)
  baselineMatched: z.boolean().optional(),
  baselineInputs: z.record(z.string(), z.string()).optional(),
});
export type Obligation = z.infer<typeof Obligation>;

export const Receipt = z.object({
  id: z.string(), obligation: z.string(), kind: z.string(),
  stage: z.enum(["baseline", "candidate", "integrated", "sealed", "committed"]),
  source: z.enum(["kernel-run", "manual", "ci-external"]),
  checkInputId: z.string(), scope: z.enum(["targeted", "full"]),
  argv: z.array(z.string()), cwd: z.string(), exit: z.number().optional(), signal: z.string().optional(),
  durationMs: z.number(),
  counts: z.object({
    discovered: z.number(), executed: z.number(), passed: z.number(), failed: z.number(),
    skipped: z.number(), focused: z.number(),
  }).optional(),
  failures: z.array(z.object({ test: z.string(), kind: z.string(), message: z.string() })).optional(),
  failureKinds: z.array(z.string()).optional(), // complete population classification, independent of bounded diagnostics
  versions: z.object({ tool: z.string(), reporter: z.string(), adapter: z.string() }),
  provenance: z.object({ runId: z.string(), runDir: z.string(), startedAt: z.string(), pid: z.number().optional() }),
  status: z.enum(["pass", "fail", "inconclusive", "skipped"]),
  qualifiers: z.array(z.enum(["flaky", "simulated", "partial", "history-unavailable"])),
  reasons: z.array(z.string()), limitations: z.array(z.string()),
  candidate: z.string(),
});
export type Receipt = z.infer<typeof Receipt>;

export const AttentionItem = z.object({
  id: z.string(), path: z.string(), line: z.number(), pattern: z.string(), marker: z.boolean(),
  disposition: z.object({
    by: z.enum(["reviewer", "same-session", "user"]), outcome: z.enum(["accepted", "finding"]), reason: z.string(),
  }).optional(),
});
export type AttentionItem = z.infer<typeof AttentionItem>;

export const Finding = z.object({
  id: z.string(), n: z.number(), severity: Severity, axis: z.enum(["behavior", "structure"]),
  location: z.object({ path: z.string(), line: z.number().optional() }),
  claim: z.string(), evidence: z.string(), fix: z.string().optional(),
  state: z.enum(["open", "valid", "disputed", "withdrawn", "fixed", "verified", "deferred", "risk-accepted", "wont-fix"]),
  history: z.array(z.object({ to: z.string(), by: z.enum(["coordinator", "reviewer", "user"]), reason: z.string(), at: z.string() })),
});
export type Finding = z.infer<typeof Finding>;

export const ReviewCoverage = z.strictObject({
  inspected: z.array(z.string()), uncovered: z.array(z.string()), crossCutting: z.string(),
  sampled: z.array(z.strictObject({ symbol: z.string(), callers: z.number().int().min(0), opened: z.number().int().min(0), semantic: z.boolean(), why: z.string().min(1) })),
});

export const ReviewLink = z.object({
  reservation: z.string(), mode: z.enum(["full", "recheck"]), candidate: z.string(), basisHash: z.string(),
  basedOn: z.string().optional(), uncovered: z.array(z.string()), verified: z.array(z.string()),
  independence: z.enum(["subagent-fresh", "same-session"]), status: z.string(),
  files: z.record(z.string(), z.string()).default({}), // blob of each Tenet file when this review was issued
  axes: z.object({ behavior: z.enum(["pass", "fail"]), structure: z.enum(["pass", "fail"]) }).optional(), // the reviewer's judgment, never edited
  coverage: ReviewCoverage.optional(), openDependencies: z.array(z.string()).optional(),
});
export type ReviewLink = z.infer<typeof ReviewLink>;

export const Reservation = z.object({
  id: z.string(), role: z.enum(["reviewer", "analyst"]), manifest: z.string(), manifestHash: z.string(),
  candidate: z.string(), basisHash: z.string(), attempt: z.number(), mode: z.enum(["full", "recheck"]),
  files: z.record(z.string(), z.string()).default({}),
  retries: z.number().int().min(0).optional(),
  basedOn: z.string().optional(), requiredPaths: z.array(z.string()).optional(),
});
export type Reservation = z.infer<typeof Reservation>;

export const BudgetState = z.object({
  attempts: z.number().int().nonnegative(), reviewRounds: z.number().int().nonnegative(), rechecks: z.number().int().nonnegative(),
  reservations: z.array(Reservation), delegations: z.number().int().nonnegative(), checksLaunched: z.number().int().nonnegative(), tenetTokens: z.number().int().nonnegative(),
  signatures: z.array(z.string()), // recent failure signatures, newest last
});
export type BudgetState = z.infer<typeof BudgetState>;

export const AccountingCheckpoint = z.strictObject({
  kind: z.literal("accounting"), t: z.string(), workspaceId: z.string(), revision: z.number().int().positive(),
  workSeq: z.number().int().nonnegative(), generationSeq: z.number().int().nonnegative(), complete: z.boolean(), inFlight: z.array(z.string()),
  entries: z.array(z.strictObject({ work: z.string(), generation: z.number().int().nonnegative(), budget: BudgetState })),
});

export const StartSnapshot = z.object({
  head: z.string().nullable(), branch: z.string().nullable(),
  staged: z.array(z.object({ path: z.string(), mode: z.string(), blob: z.string() })),
  dirty: z.array(z.object({ path: z.string(), status: z.string(), mode: z.string(), blob: z.string().optional() })),
});
export type StartSnapshot = z.infer<typeof StartSnapshot>;

export const Question = z.strictObject({
  id: z.string(), header: z.string(), question: z.string(),
  options: z.array(z.object({ label: z.string(), description: z.string(), recommended: z.boolean().optional() })).optional(),
  multiSelect: z.boolean().optional(), allowFreeform: z.boolean().optional(),
  channel: z.enum(["native", "chat"]),
  bind: z.strictObject({ factsHash: z.string() }),
});
export type Question = z.infer<typeof Question>;

export const Reason = z.object({ code: z.string(), message: z.string(), refs: z.array(z.string()).optional(), note: z.boolean().optional() });
export type Reason = z.infer<typeof Reason>;

export const WorkContract = z.object({
  id: z.string(), label: z.string(), profile: Profile, request: z.string(),
  lane: Lane, floor: Lane, level: Level, state: WorkState,
  lastValidPhase: WorkState.optional(), stopReason: StopReason.optional(),
  session: z.object({
    generation: z.number(),
    last: z.object({ inputHash: z.string(), response: z.unknown() }).optional(),
    inCall: z.object({ runId: z.string(), pid: z.number().int().positive().optional(), procStart: z.string().optional(), verb: z.string(), since: z.string(), runDir: z.string().optional(), cancelled: z.boolean().optional() }).optional(),
  }),
  outcome: z.string(), planItem: z.string().optional(),
  scope: z.strictObject({ paths: z.array(z.string()), protected: z.array(z.string()) }),
  basis: z.object({
    intentRevision: z.number(), elementIds: z.array(z.string()), design: z.string().optional(),
    hash: z.string(), traits: z.array(z.string()),
    confirmedAssumptions: z.array(z.string()).optional(),
  }).optional(),
  grants: z.array(Grant), obligations: z.array(Obligation), receipts: z.array(Receipt),
  focusedReview: Reservation.optional(), // same-session binding, not a native delegation reservation
  attention: z.array(AttentionItem), findings: z.array(Finding), reviews: z.array(ReviewLink),
  declined: z.array(z.string()),
  git: z.object({
    mode: z.enum(["git", "shadow", "none"]),
    base: z.string().nullable(), branch: z.string().nullable(), start: StartSnapshot, commits: z.array(z.string()),
    integrated: z.object({ into: z.string(), commit: z.string(), moved: z.boolean(), validated: z.boolean() }).optional(), // local integration into the base branch
    undoneBy: z.string().optional(), // the label of the contract that reverted this work
    switchConsent: z.string().optional(), // facts hash the user agreed to carry uncommitted edits across a branch switch under
    committed: z.array(z.string()), // every path Tenet has committed in this contract, so a review sees the whole change
    noCommit: z.boolean().optional(),
  }),
  scaffolding: z.array(z.string()).optional(), // existing files declared as baseline scaffolding; each is an attention item
  settings: settingsSchema("task").optional(), // task-scope overrides (PRD §7.1): they end with the contract
  // A dependency change resolved and waiting for the user's answer: what the files were, and what the resolution wrote (TS §9.11).
  dependency: z.object({
    specs: z.array(z.string()), urgent: z.boolean(), quote: z.string(), scripts: z.array(z.string()),
    before: z.object({ manifest: z.string().nullable(), lock: z.string().nullable() }), // blob hashes of the files as they were
    after: z.object({ manifest: z.string(), lock: z.string() }), // sha256 of the files as the resolution wrote them
  }).optional(),
  reverting: z.array(z.string()).optional(), // paths an undo was asked to revert: removing their assertions is the request, not a weakening
  vetted: z.record(z.string(), z.string()), // recipe files written by a scaffold: path to sha256, exempt from attention while unchanged
  touched: z.array(z.object({ path: z.string(), hashAtLastCheck: z.string().optional() })),
  includeDirty: z.array(z.string()), // human-dirty files the user chose to include in Tenet's commit
  keepOut: z.array(z.string()), // human-dirty files Tenet edits in place and never commits
  budget: BudgetState,
  acceptance: z.enum(["pending", "accepted", "rejected", "accepted-with-residual-risk"]),
  assessment: z.record(z.string(), z.enum(["low", "high"])),
  lastCheck: z.object({ candidate: z.string(), at: z.string(), stage: z.string() }).optional(),
  handoff: z.string().optional(),
  pinned: z.object({ tenet: z.string(), schema: z.number() }),
  createdAt: z.string(), updatedAt: z.string(),
});
export type WorkContract = z.infer<typeof WorkContract>;

export const Lock = z.object({
  path: z.string(), hash: z.string(), obligation: z.string(),
  anchor: z.union([z.object({ commit: z.string() }), z.object({ provisional: z.string() })]),
  supportInputs: z.record(z.string(), z.string()), // support file to blob, locked with the test
  revisions: z.array(z.object({ path: z.string(), from: z.string(), to: z.string(), reason: z.string(), at: z.string() })).optional(),
});
export type Lock = z.infer<typeof Lock>;

export const State = z.strictObject({
  schema: z.literal(SCHEMA_VERSION), revision: z.number(), workspaceId: z.string(), tag: z.string(),
  generationSeq: z.number(), workSeq: z.number(),
  sourceOwner: z.strictObject({ work: z.string(), generation: z.number() }).optional(),
  project: z.object({
    intent: z.object({
      revision: z.number(),
      overview: z.object({ purpose: z.string(), users: z.string(), preferences: z.array(z.string()), nonGoals: z.array(z.string()) }),
      elements: z.array(BasisElement), plan: z.array(PlanItem),
      records: z.array(DecisionRecord).default([]), // decisions with their context and consequences (INT-10)
    }),
    moduleRoot: z.string(), traits: z.array(z.string()),
    recipe: z.object({ id: z.string(), version: z.string(), installed: z.boolean() }).optional(), // the starter this project was scaffolded from
    adoption: z.object({
      intent: z.enum(["undecided", "adopted", "declined"]),
      policy: z.enum(["undecided", "adopted", "declined"]),
      charter: z.enum(["undecided", "adopted", "declined"]),
      offered: z.boolean().optional(), // the one-time offer to adopt shared files has been made (CON-01)
    }),
  }),
  config: z.strictObject({ local: settingsSchema("project"), revision: z.number() }),
  consents: z.array(z.strictObject({ kind: z.enum(["hooks", "filters", "envelope", "remote-read"]), configHash: z.string(), at: z.string() })),
  // Shared files adopted by hash, with what was accepted from each (TS §7.2): block hashes for INTENT.md, the policy itself for tenet.policy.json.
  trust: z.array(z.discriminatedUnion("file", [
    z.strictObject({ file: z.literal("tenet.policy.json"), hash: z.string(), adoptedAt: z.string(), restrictions: Policy }),
    z.strictObject({ file: z.literal("INTENT.md"), hash: z.string(), adoptedAt: z.string(), restrictions: z.strictObject({ blocks: z.record(z.string(), z.string()) }) }),
  ])).default([]),
  locks: z.array(Lock), pending: z.array(Question),
  work: z.record(z.string(), WorkContract),
  archive: z.array(z.object({ id: z.string(), label: z.string(), endpoint: Endpoint, blob: z.string(), finishedAt: z.string() })),
  recovered: z.object({ from: z.literal("state.prev"), at: z.string(), accounting: z.enum(["verified", "unknown"]).optional() }).optional(),
  quarantine: z.strictObject({ path: z.string().regex(/^quarantine-\d{4}-\d{2}-\d{2}-[a-z2-7]{12}$/), nonce: z.string().regex(/^[a-z2-7]{12}$/), entries: z.number().int().nonnegative(), choice: z.enum(["pending", "fresh", "review-requested"]) }).optional(),
  _ext: z.record(z.string(), z.unknown()).optional(),
});
export type State = z.infer<typeof State>;

// ---------------------------------------------------------------- review result (TS §5.4)

export const ReviewResult = z.strictObject({
  manifest: z.string(), reservation: z.string(), attempt: z.number().int(), mode: z.enum(["full", "recheck"]),
  status: z.enum(["completed", "partial", "blocked", "failed", "cancelled"]),
  dispatchMode: z.enum(["subagent-fresh", "same-session"]),
  axes: z.object({ behavior: z.enum(["pass", "fail"]), structure: z.enum(["pass", "fail"]) }),
  coverage: ReviewCoverage,
  attention: z.array(z.object({ id: z.string(), disposition: z.enum(["accepted", "finding"]), reason: z.string() })),
  rechecked: z.array(z.object({ finding: z.string(), outcome: z.enum(["verified", "still-open"]), evidence: z.string() })).optional(),
  findings: z.array(z.object({
    severity: Severity, axis: z.enum(["behavior", "structure"]),
    location: z.object({ path: z.string(), line: z.number().optional() }),
    claim: z.string(), evidence: z.string(), fix: z.string().optional(),
  })),
  basisGaps: z.array(z.object({
    kind: z.enum(["missing-requirement", "missing-invariant", "weak-test", "out-of-scope-change"]), detail: z.string(),
  })),
  openDependencies: z.array(z.string()).optional(),
});
export type ReviewResult = z.infer<typeof ReviewResult>;

// ---------------------------------------------------------------- response envelope (TS §6.6)

export const KernelResponse = z.object({
  verb: z.string(), exit: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  revision: z.number(), handle: z.string().optional(),
  reasons: z.array(Reason),
  next: z.array(z.object({ action: Action, why: z.string(), required: z.boolean().optional() })),
  questions: z.array(Question).optional(),
  progress: z.object({ phase: z.string(), boundary: z.enum(["phase", "milestone"]).optional() }).optional(),
  budget: z.object({ attempts: z.string(), rounds: z.string(), delegations: z.string() }),
  effects: z.object({ completed: z.array(z.string()), uncertain: z.array(z.string()), recovery: z.string().optional() }).optional(),
  data: z.unknown().optional(),
  historical: z.literal(true).optional(),
  kernel: z.object({ version: z.string(), schemaVersion: z.literal(1) }).optional(),
});
export type KernelResponse = z.infer<typeof KernelResponse>;

// ---------------------------------------------------------------- verb inputs

const bodyLimit = z.string().max(256 * 1024);
const Handle = z.string().regex(/^W\d+\.\d+\.[a-z0-9]{4}$/, "handle looks like W7.3.k7q");

export const OpenInput = z.object({
  profile: Profile,
  request: bodyLimit.default(""),
  resume: z.boolean().optional(),
  planItem: z.string().optional(),
  assessment: z.record(z.string(), z.enum(["low", "high"])).optional(), // six risk dimensions (TS §8.2)
  scopePaths: z.array(z.string()).optional(),
  signals: z.array(z.string()).optional(), // deterministic signals about the change (paths, traits)
  protectedPaths: z.array(z.string()).optional(),
  model: z.string().optional(),
  lane: Lane.optional(), // user-requested lane (raise freely, lower only to the floor)
  noGit: z.boolean().optional(), // "no Git": prototype instead of initializing (shadow repository, post-M0)
  initGit: z.boolean().optional(), // the user agreed to initialize Git here
});
export type OpenInput = z.infer<typeof OpenInput>;

export const BasisElementInput = z.object({
  ref: z.string().optional(),
  kind: z.enum(["requirement", "example", "invariant", "constraint", "assumption", "decision", "deferred"]),
  text: z.string().min(1).max(2000),
  origin: z.enum(["request", "tenet"]),
  of: z.string().optional(), // ref of the requirement an example or invariant belongs to
  test: z.enum(["distinguishing", "preservation", "boundary"]).optional(),
  expect: z.enum(["fail", "pass"]).optional(),
  testFile: z.string().optional(),
  support: z.array(z.string()).max(20).optional(),
});

export const BasisProposal = z.object({
  outcome: z.string().min(1).max(2000),
  elements: z.array(BasisElementInput).min(1).max(60),
  design: z.string().max(4000).optional(),
  designCommitment: z.boolean().default(false),
  scopePaths: z.array(z.string()).optional(),
});
export type BasisProposal = z.infer<typeof BasisProposal>;

export const DecideInput = z.object({
  h: Handle.optional(),
  kind: z.string(), // decision kind (registry key)
  propose: z.unknown().optional(), // content for propose-form kinds
  answers: z.record(z.string(), z.string()).optional(),
  target: z.string().optional(),
  quote: z.string().optional(),
  again: z.boolean().optional(),
});
export type DecideInput = z.infer<typeof DecideInput>;

export const CheckInput = z.object({
  h: Handle,
  stage: z.enum(["baseline", "candidate", "integrated", "committed"]).default("candidate"),
  targeted: z.boolean().optional(),
  touched: z.array(z.string()).optional(),
  scaffold: z.array(z.string()).optional(), // existing files holding the minimal stubs a new interface needs; allowed to differ at baseline
  again: z.boolean().optional(),
});
export type CheckInput = z.infer<typeof CheckInput>;

export const FindingsInput = z.object({ h: Handle, result: ReviewResult, again: z.boolean().optional() });
export type FindingsInput = z.infer<typeof FindingsInput>;

export const FinishInput = z.object({
  h: Handle, noCommit: z.boolean().optional(), subject: z.string().max(200).optional(), again: z.boolean().optional(),
});
export type FinishInput = z.infer<typeof FinishInput>;

export const CommitInput = z.object({ h: Handle, subject: z.string().min(1).max(200), again: z.boolean().optional() });
export type CommitInput = z.infer<typeof CommitInput>;

export const StopInput = z.object({ h: Handle, mode: z.enum(["pause", "cancel", "abandon"]), reason: z.string().optional(), answers: z.record(z.string(), z.string()).optional(), again: z.boolean().optional() });
export type StopInput = z.infer<typeof StopInput>;

export const PacketInput = z.object({
  h: Handle.optional(), role: z.enum(["reviewer", "analyst", "handoff", "resume"]),
  retry: z.boolean().optional(), question: z.string().optional(), again: z.boolean().optional(),
});
export type PacketInput = z.infer<typeof PacketInput>;

export const ReviewInput = z.object({ scope: z.string().default("working-tree"), base: z.string().optional() });
export type ReviewInput = z.infer<typeof ReviewInput>;

export const IntegrateInput = z.object({ h: Handle, again: z.boolean().optional() });
export type IntegrateInput = z.infer<typeof IntegrateInput>;

export const UndoInput = z.object({ h: Handle, again: z.boolean().optional() });
export type UndoInput = z.infer<typeof UndoInput>;

export const InspectInput = z.object({
  view: z.enum(["status", "why", "doctor", "help", "result", "impact", "residue", "settings"]).default("status"),
  h: Handle.optional(), topic: z.string().optional(),
});
export type InspectInput = z.infer<typeof InspectInput>;
