// Node/TypeScript adapter (TS §9.5): detection, the Vitest invocation, one pure normalization of its JSON report
// and the attention-pattern table. Mostly data. The adapter normalizes; it never decides acceptance.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { AttentionPattern, FileChange } from "../core/review.ts";
import type { Detection, Normalized, Stack, ToolVersions } from "../ports/types.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { FsProject } from "./project-fs.ts";

const ADAPTER = "node-ts@1";
const readJson = (p: string): Record<string, any> | null => { try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; } };

/** Vitest majors the normalization was observed against (SP-10, local observation only). */
const SUPPORTED = [2, 3, 4, 5];

// Patterns are matched on whitespace-free, lower-cased text (core/review fold), so they are written that way.
export const PATTERNS: AttentionPattern[] = [
  { name: "@ts-ignore", re: /@ts-ignore/, marker: true, on: "add" },
  { name: "@ts-nocheck", re: /@ts-nocheck/, marker: true, on: "add" },
  { name: "@ts-expect-error", re: /@ts-expect-error/, marker: true, on: "add" },
  { name: "eslint-disable", re: /eslint-disable/, marker: true, on: "add" },
  { name: "as any", re: /asany(?![a-z0-9_$])/, marker: true, on: "add" },
  { name: "as unknown as", re: /asunknownas/, marker: true, on: "add" },
  { name: ".only", re: /\b(?:it|test|describe)\.only\(|\.only\(/, marker: true, on: "add" },
  { name: ".skip", re: /\.skip\(|\b(?:xit|xdescribe|xtest)\(/, marker: true, on: "add" },
  { name: "empty catch", re: /catch(?:\([^)]*\))?\{\}|\.catch\(\(\)=>\{\}\)/, marker: true, on: "add" },
  { name: "mock", re: /\b(?:vi|jest)\.mock\(/, marker: false, on: "add" },
  { name: "snapshot", re: /tomatch(?:inline)?snapshot\(/, marker: false, on: "add" },
  { name: "assertion removed", re: /\bexpect\(|\bassert[.(]/, marker: false, on: "remove" },
];

export const classify = (path: string): FileChange["kind"] => {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path) || /(?:^|\/)__tests__\//.test(path)) return "test";
  if (/(?:^|\/)(?:vitest|vite|jest)\.config\.|(?:^|\/)tsconfig[^/]*\.json$|(?:^|\/)package(?:-lock)?\.json$|^\.github\//.test(path)) return "config";
  return "source";
};

function metadata(root: string, exclusions: readonly Exclusion[]) {
  const project = new FsProject(root); project.setExclusions(exclusions);
  const permit = (path: string) => {
    if (!allowed("read", path, exclusions)) throw new KernelError("capability-missing", `project policy excludes stack metadata ${path}; dependent checks cannot run`, { exit: 2 });
  };
  return {
    present(path: string): boolean { permit(path); return existsSync(join(root, path)); },
    json(path: string): Record<string, any> | null {
      permit(path);
      // Installed tool metadata can live behind the package manager's node_modules link. Project inputs cannot.
      if (path.startsWith("node_modules/")) return readJson(join(root, path));
      try { return JSON.parse(project.read(path) ?? "null"); } catch { return null; }
    },
  };
}

function detect(root: string, exclusions: readonly Exclusion[]): Detection {
  const meta = metadata(root, exclusions);
  const pkg = meta.json("package.json");
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const typescript = meta.present("tsconfig.json") || "typescript" in deps;
  const language = pkg || typescript ? "ts-js" : "other";
  const vitest = meta.json("node_modules/vitest/package.json");
  const major = Number(String(vitest?.version ?? "").split(".")[0]);
  const pm = meta.present("pnpm-lock.yaml") ? "pnpm" : meta.present("yarn.lock") ? "yarn" : meta.present("package-lock.json") ? "npm" : "unknown";
  const d: Detection = {
    language, typescript, depsInstalled: existsSync(join(root, "node_modules")),
    runnerSupported: !!vitest && SUPPORTED.includes(major), packageManager: pm, moduleRoot: ".", experimental: false,
  };
  if (vitest) { d.runner = "vitest"; d.runnerVersion = String(vitest.version); }
  return d;
}

const message = (a: { failureMessages?: string[] }) => (a.failureMessages?.[0] ?? "").split("\n")[0]!.slice(0, 500);
const failureKind = (msg: string): string =>
  /Unexpected \.only/.test(msg) ? "focused" : /AssertionError|expected .* to |toBe|toEqual|to (?:be|equal|have|match|contain)/.test(msg) ? "assertion"
  : /timed? ?out/i.test(msg) ? "timeout" : "runtime-error";

/** Pure: Vitest's JSON report to per-file counts and bounded failures. A report that does not parse is `invalid`. */
export function normalize(raw: string, root = ""): Normalized {
  const files: Normalized["files"] = new Map();
  const invalid = (message: string): Normalized => ({ files: new Map(), discovered: 0, invalid: message });
  if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return invalid("the report exceeds 10 MB");
  let d: any;
  try { d = JSON.parse(raw); } catch { return { files, discovered: 0, invalid: "the report is not valid JSON" }; }
  if (!d || !Array.isArray(d.testResults)) return { files, discovered: 0, invalid: "the report has no testResults" };
  if (d.testResults.length > 2000) return invalid("too many test files; the report was not fully normalized");
  const stack: Array<[unknown, number]> = [[d, 0]];
  while (stack.length) {
    const [value, depth] = stack.pop()!;
    if (depth > 64) return invalid("the report exceeds depth 64");
    if (value && typeof value === "object") for (const item of Object.values(value)) stack.push([item, depth + 1]);
  }
  let discovered = 0;
  for (const t of d.testResults) {
    if (!t || typeof t.name !== "string" || !["passed", "failed", "pending", "skipped"].includes(t.status) || !Array.isArray(t.assertionResults)) return invalid("invalid test file record");
    const path = root ? relative(resolve(root), resolve(root, t.name)) : t.name;
    if (path === ".." || path.startsWith("../") || (!root && isAbsolute(path))) return invalid("a report path leaves the workspace");
    if (files.has(path)) return invalid("duplicate test file identity");
    if (t.assertionResults.length > 20000) return invalid("too many assertions in one test file");
    const identities = new Set<string>();
    const f = { executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0, tests: [] as string[], failureKinds: [] as string[], failures: [] as Array<{ test: string; kind: string; message: string }> };
    for (const a of t.assertionResults) {
      if (!a || typeof a.fullName !== "string" || !["passed", "failed", "pending", "skipped", "todo", "disabled"].includes(a.status)) return invalid("invalid assertion identity or status");
      if (a.failureMessages !== undefined && (!Array.isArray(a.failureMessages) || a.failureMessages.some((m: unknown) => typeof m !== "string"))) return invalid("invalid assertion failure messages");
      if (identities.has(a.fullName)) return invalid("duplicate test identity");
      identities.add(a.fullName);
      discovered++;
      f.tests.push(a.fullName);
      if (a.status === "passed") { f.executed++; f.passed++; }
      else if (a.status === "failed") {
        f.executed++; f.failed++;
        const m = message(a), kind = failureKind(m);
        if (!f.failureKinds.includes(kind)) f.failureKinds.push(kind);
        if (kind === "focused") f.focused++;
        if (f.failures.length < 5) f.failures.push({ test: a.fullName, kind, message: m });
      } else f.skipped++;
    }
    // A file that failed before any test ran (import or compile error) is a failure, never a pass or a skip.
    if (t.status === "failed" && f.failed === 0) {
      f.failed++;
      f.failureKinds.push("compile-or-import");
      f.failures.push({ test: path, kind: "compile-or-import", message: String(t.message ?? "the file failed to load").split("\n")[0]!.slice(0, 500) });
    }
    files.set(path, f);
  }
  return { files, discovered };
}

export function createStack(): Stack {
  let exclusions: readonly Exclusion[] = [];
  return {
    setExclusions: value => { exclusions = value; },
    detect: root => detect(root, exclusions),
    argv: (files, report) => {
      const vitest = "node_modules/vitest/vitest.mjs"; // a direct binary, never npx (TS §9.3)
      return [process.execPath, vitest, "run", "--reporter=json", `--outputFile=${report}`, "--no-color", ...(files === "all" ? [] : files)];
    },
    normalize,
    fingerprint: (root): ToolVersions => ({
      node: process.version, tool: String(metadata(root, exclusions).json("node_modules/vitest/package.json")?.version ?? "none"),
      reporter: "vitest-json", adapter: ADAPTER,
    }),
    patterns: PATTERNS, classify, isTestPath: (p) => classify(p) === "test",
  };
}
