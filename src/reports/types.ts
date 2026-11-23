import type { Finding } from "../core/output.js";

export type TestStatus = "pass" | "fail" | "skip" | "error";

export type TestCase = {
  full_name: string;
  file?: string;
  status: TestStatus;
  attempts: TestStatus[];
  tags: string[];
  duration_ms?: number;
};

export type TestReport = {
  runner: "junit" | "ctrf" | "go-test-json" | "jest-json" | "none";
  cases: TestCase[];
  teardown_failed: boolean;
  inconclusive: boolean;
};

export type Acceptance = {
  implements: string[];
  items: Array<{ id: string; text: string }>;
  digest: string;
  problems: Finding[];
};

export type TestDeclaration = {
  file: string;
  line: number;
  end_line: number;
  name: string;
  raw_name: string;
  kind: "it" | "test" | "it.each" | "test.each" | "def" | "func" | "t.Run" | "@Test" | "#[test]";
  tags: string[];
  via_describe: boolean;
};

export type TestSkip = {
  file: string;
  line: number;
  pattern: string;
  text: string;
};

export type ScanResult = {
  declarations: TestDeclaration[];
  skips: TestSkip[];
};

export type DeclaredTag = {
  tag: string;
  file: string;
  line: number;
  name: string;
  raw_name: string;
  authorship: "written-here" | "tag-added-here" | "unknown";
  via_describe: boolean;
};

export type DeclaredTags = {
  acceptance: Record<string, DeclaredTag[]>;
  requirement: Record<string, DeclaredTag[]>;
};

export type ItemResult = {
  id: string;
  result: "passed" | "failed" | "not-run" | "no-test" | "skipped";
  coverage: "confirmed" | "not-confirmed";
  tests: {
    expected: number;
    passed: number;
    failed: number;
    skipped: number;
    not_run: number;
  };
  names: string[];
  authorship: "written-here" | "tag-added-here" | "unknown";
  first_failure: { full_name: string; status: "fail" | "error" } | null;
};

export type Weakening = {
  found: boolean;
  by: Array<{ finding: "removed-tests" | "skip-added" | "file-deleted"; file: string; names: string[] }>;
  notes: Array<{ note: "tests-consolidated"; file: string; names: string[] }>;
  not_checked: string[];
};
