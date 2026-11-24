import type { Finding } from "../core/output.js";

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
  };
};

export type PreflightOptions = {
  cwd?: string;
  yes?: boolean;
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
