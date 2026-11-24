import type { Finding } from "../core/output.js";
import type { CheckResult } from "../specs/check.js";
import type { LockVerification } from "../policy/index.js";

export type HostCapability = "skills+mcp" | "mcp" | "instructions";
export type ProjectKind = "service" | "library" | "data" | "infrastructure" | "ml" | "other";
export type RunnerKind = "vitest" | "jest" | "node:test" | "pytest" | "go" | "ctrf" | "other";
export type CiMode = "existing-ci" | "tenet-workflow" | "none";

export type PlannedBlock = {
  path: string;
  kind: "markdown" | "yaml";
};

export type PlannedKey = {
  path: string;
  pointer: string;
};

export type PlannedLocalKey = PlannedKey & {
  host: string;
};

export type PlannedHost = {
  id: string;
  capability: HostCapability;
};

export type InitPlan = {
  created: string[];
  blocks: PlannedBlock[];
  keys: PlannedKey[];
  local_keys: PlannedLocalKey[];
  hosts: PlannedHost[];
  ci_mode: CiMode;
  ci_reason: string;
};

export type InstallFinding = {
  kind: "no-test-report";
  path: string;
  message: string;
};

export type HostWritePlan = {
  created: string[];
  blocks: PlannedBlock[];
  keys: PlannedKey[];
  local_keys: PlannedLocalKey[];
};

export type HostContext = {
  cwd: string;
  platform: NodeJS.Platform | string;
  localProfileRoot?: string;
  windowsCommandShimRequired?: string[];
};

export type HostDescriptor = {
  id: string;
  capabilityLevel: HostCapability;
  detect(context: HostContext): boolean | Promise<boolean>;
  planWrites(context: HostContext): HostWritePlan | Promise<HostWritePlan>;
};

export type PreflightAnswers = {
  purpose?: string;
  kind?: ProjectKind;
  allowReporterEdit?: boolean;
  continue?: boolean;
};

export type InjectedGitEnvironment = {
  state?: "committed" | "unborn" | "not-a-repository" | "tool-unavailable";
  version?: string | null;
  branch?: string;
  userName?: string;
  email?: string;
  remote?: string | null;
  head?: string | null;
};

export type PreflightEnvironment = {
  platform?: NodeJS.Platform | string;
  localProfileRoot?: string;
  windowsCommandShimRequired?: string[];
  git?: InjectedGitEnvironment;
  tools?: {
    git?: string | null;
    node?: string | null;
    ssh?: string | null;
    gh?: string | null;
  };
  installedVersion?: string;
  registry?: {
    package?: string;
    releases?: Record<string, { integrity: string }>;
  };
  kitPath?: string;
};

export type PreflightOptions = {
  cwd?: string;
  yes?: boolean;
  vendor?: boolean;
  answers?: PreflightAnswers;
  environment?: PreflightEnvironment;
};

export type PreflightPrompt = {
  key: "purpose" | "kind" | "reporterEdit";
  question: string;
  options?: ProjectKind[];
  default?: string | boolean;
};

export type RunnerFact = {
  kind: RunnerKind;
  command: string;
  report: "junit" | "jest-json" | "go-test-json" | "ctrf" | "none";
  report_from: "file" | "stdout";
  report_path: string | null;
  package_manager_setup: string[];
};

export type CiJobFact = {
  workflow: string;
  name: string;
  id: string | null;
  test_step: number | null;
  command: string | null;
  report_path: string | null;
  reports: boolean;
  reusable: boolean;
  services: boolean;
  matrix: boolean;
  setup: string[];
};

export type PreflightFacts = {
  repository: {
    cwd: string;
    git: boolean;
    head: string | null;
    branch: string | null;
    remote: string | null;
    forge: "github" | "other" | "none";
    empty: boolean;
  };
  runner: RunnerFact | null;
  ci: {
    jobs: CiJobFact[];
    selected: CiJobFact | null;
  };
  owners: Array<{ id: string; name: string; roles: ["owner"] }>;
  purpose: string | null;
  kind: ProjectKind | null;
};

export type PreflightResult = {
  plan: InitPlan | null;
  findings: InstallFinding[];
  diagnostics: Finding[];
  prompts: PreflightPrompt[];
  facts: PreflightFacts;
};

export type InitOptions = PreflightOptions & {
  force?: boolean;
  fault?: {
    after?: "pending" | string | number;
  };
};

export type ManifestCreated = {
  path: string;
  sha256: string;
};

export type ManifestBlock = PlannedBlock & {
  marker: string;
  previous_block?: string | null;
  prefix_sep?: "" | "\n" | "\r\n";
};

export type ManifestKey = PlannedKey & {
  previous: unknown;
  installed: unknown;
  previous_raw?: string;
};

export type InstallManifest = {
  schema_version: 1;
  version: string;
  created: ManifestCreated[];
  blocks: ManifestBlock[];
  keys: ManifestKey[];
};

export type PendingWrite = {
  id: string;
  kind: "file" | "block" | "key" | "local_key";
  path: string;
  pointer?: string;
  before_sha256: string | null;
  after_sha256: string;
  content?: string;
};

export type PendingUpgrade = {
  from: string;
  to: string;
  changed: UpgradeChanged[];
};

export type PendingManifest = {
  schema_version: 1;
  version: string;
  writes: PendingWrite[];
  manifest: InstallManifest;
  upgrade?: PendingUpgrade;
};

export type WriteSet = {
  cwd: string;
  version: string;
  plan: InitPlan;
  writes: PendingWrite[];
  manifest: InstallManifest;
  localProfileRoot?: string;
  upgrade?: PendingUpgrade;
};

export type InitWrote = {
  created: string[];
  blocks: PlannedBlock[];
  keys: PlannedKey[];
  local_keys: PlannedLocalKey[];
};

export type InitResult = {
  plan: InitPlan;
  wrote: InitWrote;
  findings: InstallFinding[];
  cancelled?: boolean;
};

export type UpgradeChanged = {
  path: string;
  action: "created" | "replaced" | "kept";
};

export type UpgradeOptions = InitOptions & {
  check?: (options: { cwd: string; installedVersion: string }) =>
    CheckResult | Promise<CheckResult>;
};

export type UpgradeResult = {
  from: string;
  to: string;
  changed: UpgradeChanged[];
};

export type RemoveOptions = PreflightOptions;

export type RemoveKept = {
  path: string;
  reason: "edited-by-you" | "spec-or-records";
};

export type RemoveRemoved = {
  path: string;
  kind: "file" | "block" | "key";
};

export type RemoveResult = {
  removed: RemoveRemoved[];
  kept: RemoveKept[];
  reminder: string | null;
};

export type DoctorCheckName = "node" | "git" | "ssh" | "gh" | "lock" | "workflows";

export type DoctorCheck = {
  name: DoctorCheckName;
  ok: boolean;
  detail: string;
};

export type DoctorResult = {
  checks: DoctorCheck[];
};

export type DoctorEvaluation = DoctorResult & {
  findings: Finding[];
  exitCode: 0 | 1 | 3;
};

export type DoctorTool = "node" | "git" | "ssh" | "gh";

export type DoctorToolRun = (
  tool: DoctorTool,
  args: string[],
  options: { cwd: string },
) => Promise<string>;

export type DoctorLockVerifier = (options: { cwd: string }) => Promise<LockVerification>;

export type DoctorDependencies = {
  platform?: NodeJS.Platform | string;
  runTool?: DoctorToolRun;
  runners?: Partial<Record<DoctorTool, DoctorToolRun>>;
  verifyLock?: DoctorLockVerifier;
};

export type DoctorOptions = {
  cwd?: string;
  platform?: NodeJS.Platform | string;
  environment?: PreflightEnvironment;
  runTool?: DoctorToolRun;
  runners?: Partial<Record<DoctorTool, DoctorToolRun>>;
  verifyLock?: DoctorLockVerifier;
};
