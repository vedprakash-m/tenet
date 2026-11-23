import type { Finding, TenetYaml } from "../types/generated.js";

export type RuleMode = "observe" | "advise" | "enforce";

export type Policy = TenetYaml & {
  standard: string;
  kit_path: string | null;
  paths: {
    records: string;
  };
  level: "observe" | "protect" | "verify" | "assure";
  rules: Record<string, RuleMode>;
  specs: {
    id_prefix: string;
    documents: Array<{
      path: string;
      level: "L0" | "L1" | "L2" | "L3" | "L4";
      owner?: string;
      budget?: number;
    }>;
  };
  findings: Finding[];
};

export type PolicyOptions = {
  ref?: string;
  cwd?: string;
};

export type PolicyError = Error & {
  code: string;
  finding: Finding;
};

export type Selector =
  | string
  | string[]
  | {
      paths?: string[];
      include?: string[];
      exclude?: string[];
    };

export type Change =
  | string
  | string[]
  | {
      path?: string;
      paths?: string[];
      before?: string;
      after?: string;
    };
