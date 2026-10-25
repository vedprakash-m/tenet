// Node/TypeScript adapter (TS §9.5): detection, the Vitest invocation, one pure normalization of its JSON report
// and the attention-pattern table. Mostly data. The adapter normalizes; it never decides acceptance.
import { closeSync, constants, existsSync, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { AttentionPattern, FileChange } from "../core/review.ts";
import type { Detection, Normalized, StaticNorm, StaticTool, Stack, ToolVersions } from "../ports/types.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { FsProject } from "./project-fs.ts";
import { nestsTooDeep } from "./report-bounds.ts";
import { normalizePlaywright, playwrightArgv } from "./playwright.ts";

const ADAPTER = "node-ts@10"; // 10: reruns of a failed required check can end flaky (EVD-08)
function installedMetadata(path: string, kind: "tool" | "dependency"): { record: Record<string, any>; digest: string } | null {
  let descriptor = -1;
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    const info = fstatSync(descriptor);
    if (!info.isFile() || info.size > 20 * 1024 * 1024) throw new Error("unsafe or oversized metadata");
    const bytes = Buffer.alloc(info.size + 1);
    let count = 0;
    while (count < bytes.length) {
      const size = readSync(descriptor, bytes, count, bytes.length - count, count);
      if (!size) break;
      count += size;
    }
    const after = fstatSync(descriptor);
    if (count !== info.size || after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs)
      throw new Error("metadata changed during read");
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, count));
    const record: unknown = JSON.parse(text);
    if (!record || typeof record !== "object" || Array.isArray(record) || nestsTooDeep(record)) throw new Error("invalid metadata");
    return { record, digest: sha256(bytes.subarray(0, count)) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new KernelError("capability-missing", `installed ${kind} metadata cannot be verified safely`, { exit: 2 });
  } finally { if (descriptor >= 0) closeSync(descriptor); }
}

function installedDependencies(path: string): string {
  const metadata = installedMetadata(path, "dependency");
  if (!metadata) return "absent";
  const lock = metadata.record;
  if (!Number.isSafeInteger(lock.lockfileVersion) || Number(lock.lockfileVersion) < 1 ||
    !lock.packages || typeof lock.packages !== "object" || Array.isArray(lock.packages))
    throw new KernelError("capability-missing", "installed dependency metadata cannot be verified safely", { exit: 2 });
  return metadata.digest;
}

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
  if (
    /(?:^|\/)(?:vitest|vite|jest|eslint)\.config\.|(?:^|\/)tsconfig[^/]*\.json$|(?:^|\/)package(?:-lock)?\.json$|^\.github\//.test(path)
  )
    return "config";
  return "source";
};

function metadata(root: string, exclusions: readonly Exclusion[]) {
  const project = new FsProject(root);
  project.setExclusions(exclusions);
  const permit = (path: string) => {
    if (!allowed("read", path, exclusions))
      throw new KernelError("capability-missing", `project policy excludes stack metadata ${path}; dependent checks cannot run`, {
        exit: 2,
      });
  };
  return {
    installed(): string {
      const path = "node_modules/.package-lock.json";
      permit(path);
      return installedDependencies(join(root, path));
    },
    present(path: string): boolean {
      permit(path);
      return existsSync(join(root, path));
    },
    json(path: string): Record<string, any> | null {
      permit(path);
      // Installed tool metadata can live behind the package manager's node_modules link. Project inputs cannot.
      if (path.startsWith("node_modules/")) return installedMetadata(join(root, path), "tool")?.record ?? null;
      const text = project.read(path);
      try {
        return JSON.parse(text ?? "null");
      } catch {
        return null;
      }
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
  const pm = meta.present("pnpm-lock.yaml")
    ? "pnpm"
    : meta.present("yarn.lock")
      ? "yarn"
      : meta.present("package-lock.json")
        ? "npm"
        : "unknown";
  const d: Detection = {
    language,
    typescript,
    depsInstalled: existsSync(join(root, "node_modules")),
    runnerSupported: !!vitest && SUPPORTED.includes(major),
    packageManager: pm,
    moduleRoot: ".",
    experimental: false,
  };
  if (vitest) {
    d.runner = "vitest";
    d.runnerVersion = String(vitest.version);
  }
  return d;
}

const message = (a: { failureMessages?: string[] }) => (a.failureMessages?.[0] ?? "").split("\n")[0]!.slice(0, 500);
const failureKind = (msg: string): string =>
  /Unexpected \.only/.test(msg)
    ? "focused"
    : /AssertionError|expected .* to |toBe|toEqual|to (?:be|equal|have|match|contain)/.test(msg)
      ? "assertion"
      : /timed? ?out/i.test(msg)
        ? "timeout"
        : "runtime-error";

const invalid = (message: string): Normalized => ({ files: new Map(), discovered: 0, invalid: message });
const FILE_STATUS = ["passed", "failed", "pending", "skipped"];
const ASSERTION_STATUS = ["passed", "failed", "pending", "skipped", "todo", "disabled"];
type Counts = NonNullable<ReturnType<Normalized["files"]["get"]>>;

/** The report as an object with a `testResults` array, or the reason it cannot be used. */
function parseReport(raw: string): { d: any } | { problem: string } {
  if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return { problem: "the report exceeds 10 MB" };
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    return { problem: "the report is not valid JSON" };
  }
  if (!d || !Array.isArray(d.testResults)) return { problem: "the report has no testResults" };
  if (d.testResults.length > 2000) return { problem: "too many test files; the report was not fully normalized" };
  return nestsTooDeep(d) ? { problem: "the report exceeds depth 64" } : { d };
}

/** One test file's record and its path inside the workspace, or the reason it is invalid. */
function admitFile(t: any, root: string, seen: ReadonlyMap<string, unknown>): { path: string } | { problem: string } {
  if (!t || typeof t.name !== "string" || !FILE_STATUS.includes(t.status) || !Array.isArray(t.assertionResults))
    return { problem: "invalid test file record" };
  const path = root ? relative(resolve(root), resolve(root, t.name)) : t.name;
  if (path === ".." || path.startsWith("../") || (!root && isAbsolute(path)))
    return { problem: "a report path leaves the workspace" };
  if (seen.has(path)) return { problem: "duplicate test file identity" };
  if (t.assertionResults.length > 20000) return { problem: "too many assertions in one test file" };
  return { path };
}

/** The assertion's identity and shape, or the reason it is invalid; a valid identity is added to `seen`. */
function admitAssertion(a: any, seen: Set<string>): string | undefined {
  if (!a || typeof a.fullName !== "string" || !ASSERTION_STATUS.includes(a.status)) return "invalid assertion identity or status";
  if (
    a.failureMessages !== undefined &&
    (!Array.isArray(a.failureMessages) || a.failureMessages.some((m: unknown) => typeof m !== "string"))
  )
    return "invalid assertion failure messages";
  if (seen.has(a.fullName)) return "duplicate test identity";
  seen.add(a.fullName);
  return undefined;
}

/** Add one admitted assertion to its file's counts; a failure keeps its kind and up to five examples. */
function count(f: Counts, a: any): void {
  f.tests.push(a.fullName);
  const status = a.status === "passed" || a.status === "failed" ? a.status : "skipped";
  const kind = status === "failed" ? failureKind(message(a)) : undefined;
  f.outcomes!.push({ test: a.fullName, status, ...(kind ? { kind } : {}) });
  if (a.status === "passed") {
    f.executed++;
    f.passed++;
    return;
  }
  if (a.status !== "failed") {
    f.skipped++;
    return;
  }
  f.executed++;
  f.failed++;
  const m = message(a);
  if (!f.failureKinds.includes(kind!)) f.failureKinds.push(kind!);
  if (kind === "focused") f.focused++;
  if (f.failures.length < 5) f.failures.push({ test: a.fullName, kind: kind!, message: m });
}

/** Counts for one admitted file, or the reason an assertion in it is invalid. */
function countFile(t: any, path: string): Counts | string {
  const identities = new Set<string>();
  const f: Counts = {
    executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0, tests: [], outcomes: [], failureKinds: [], failures: [],
  };
  for (const a of t.assertionResults) {
    const problem = admitAssertion(a, identities);
    if (problem) return problem;
    count(f, a);
  }
  // A file that failed before any test ran (import or compile error) is a failure, never a pass or a skip.
  if (t.status === "failed" && f.failed === 0) {
    f.failed++;
    f.failureKinds.push("compile-or-import");
    f.failures.push({
      test: path,
      kind: "compile-or-import",
      message: String(t.message ?? "the file failed to load")
        .split("\n")[0]!
        .slice(0, 500),
    });
  }
  return f;
}

/** Pure: Vitest's JSON report to per-file counts and bounded failures. A report that does not parse is `invalid`. */
export function normalize(raw: string, root = ""): Normalized {
  const parsed = parseReport(raw);
  if ("problem" in parsed) return invalid(parsed.problem);
  const files: Normalized["files"] = new Map();
  let discovered = 0;
  for (const t of parsed.d.testResults) {
    const file = admitFile(t, root, files);
    if ("problem" in file) return invalid(file.problem);
    const counts = countFile(t, file.path);
    if (typeof counts === "string") return invalid(counts);
    discovered += t.assertionResults.length;
    files.set(file.path, counts);
  }
  return { files, discovered };
}

// ---------------------------------------------------------------- static tools (TS §9.5): TypeScript and ESLint
const TSC_ERROR = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/;
const TSC_CONFIG_ERROR = /^error (TS\d+): (.*)$/;
const MAX_EXAMPLES = 5;
const staticInvalid = (problem: string): StaticNorm => ({ status: "invalid", failures: [], problem });
/** The first error of each kind is kept, up to five, in report order. */
const verdictOf = (failures: StaticNorm["failures"], files: string[]): StaticNorm => ({
  status: failures.length ? "fail" : "pass",
  failures: failures.slice(0, MAX_EXAMPLES),
  files,
});

/** A normalized workspace identity, null for compiler dependencies, undefined for an unsupported path. */
function staticPath(path: string, root: string, dependencies = false): string | null | undefined {
  if (!path || path.includes("\0")) return undefined;
  if (/(^|[\\/])node_modules[\\/]/.test(path)) return dependencies ? null : undefined;
  const p = root ? relative(resolve(root), resolve(root, path)) : path;
  return !p || p === ".." || p.startsWith("../") || (!root && isAbsolute(p)) ? undefined : p;
}

function tscDiagnostic(
  line: string, root: string,
): { failure: StaticNorm["failures"][number]; length: number } | { problem: string } | null {
  const at = TSC_ERROR.exec(line), config = at ? null : TSC_CONFIG_ERROR.exec(line);
  if (!at && !config) return null;
  const path = at ? staticPath(at[1]!, root) : "tsconfig";
  if (!path) return { problem: "a diagnostic path leaves the workspace" };
  const text = at ? at[4]! : config![2]!;
  if (text.length > 2000) return { problem: "tsc diagnostic exceeds its message bound" };
  return { length: text.length, failure: at
    ? { test: `${path}:${at[2]}`, kind: "type-error", message: `${at[3]} ${text}`.slice(0, 500) }
    : { test: "tsconfig", kind: "configuration", message: `${config![1]} ${text}`.slice(0, 500) } };
}

function normalizeTsc(exit: number | undefined, raw: string | null, root: string): StaticNorm {
  if (raw === null || ![0, 1, 2].includes(exit ?? -1) || Buffer.byteLength(raw) > 10 * 1024 * 1024)
    return staticInvalid("tsc did not finish normally or exceeded its output bound");
  const failures: StaticNorm["failures"] = [];
  const files = new Set<string>();
  let continuation = false, messageLength = 0;
  for (const line of raw.split("\n").filter((l) => l.trim())) {
    const diagnostic = tscDiagnostic(line, root);
    if (diagnostic) {
      if ("problem" in diagnostic) return staticInvalid(diagnostic.problem);
      if (failures.length >= 2000) return staticInvalid("too many tsc diagnostics");
      failures.push(diagnostic.failure);
      continuation = true; messageLength = diagnostic.length;
    } else if (/^\s/.test(line) && continuation) {
      messageLength += line.length + 1;
      if (messageLength > 2000) return staticInvalid("tsc diagnostic continuations exceed the message bound");
    }
    else {
      if (!/\.(?:[cm]?[jt]sx?|json)$/.test(line)) return staticInvalid("tsc printed unrecognized or truncated output");
      const path = staticPath(line, root, true);
      if (path === undefined || (path && files.has(path))) return staticInvalid("tsc reported an outside or duplicate file");
      if (path) files.add(path);
      if (files.size > 2000) return staticInvalid("too many analyzed workspace files");
      continuation = false;
    }
  }
  if ((exit === 0) !== (failures.length === 0)) return staticInvalid("tsc's exit status and its diagnostics disagree");
  if (!failures.length && !files.size) return staticInvalid("tsc reported no analyzed workspace files");
  return verdictOf(failures, [...files]);
}

const nonnegative = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0;

function lintMessageValid(m: any): boolean {
  return !!m && [1, 2].includes(m.severity) && typeof m.message === "string" && m.message.length <= 2000
    && [m.line, m.column].every(n => n === undefined || (Number.isSafeInteger(n) && n >= 1))
    && (m.ruleId == null || typeof m.ruleId === "string")
    && (m.fatal === undefined || typeof m.fatal === "boolean") && (!m.fatal || m.severity === 2);
}

/** Validate a whole file before bounding its displayed diagnostics. */
function lintFile(f: any, root: string): { path: string; errors: number; failures: StaticNorm["failures"] } | { problem: string } {
  if (!f || typeof f.filePath !== "string" || !Array.isArray(f.messages) || f.messages.length > 20000
    || !nonnegative(f.errorCount) || !nonnegative(f.warningCount)) return { problem: "invalid lint file record" };
  const path = staticPath(f.filePath, root);
  if (!path) return { problem: "a lint path is outside or excluded" };
  const failures: StaticNorm["failures"] = [];
  let errors = 0, warnings = 0, fatal = 0;
  for (const m of f.messages) {
    if (!lintMessageValid(m)) return { problem: "invalid lint diagnostic" };
    if (m.severity !== 2) { warnings++; continue; }
    errors++;
    if (m.fatal) fatal++;
    if (failures.length < MAX_EXAMPLES)
      failures.push({ test: `${path}:${m.line ?? 0}`, kind: "lint-error", message: `${m.ruleId ?? "error"} ${m.message}`.slice(0, 500) });
  }
  if (errors !== f.errorCount || warnings !== f.warningCount || (f.fatalErrorCount !== undefined && f.fatalErrorCount !== fatal))
    return { problem: "lint counts and diagnostic population disagree" };
  return { path, errors, failures };
}

function normalizeEslint(exit: number | undefined, raw: string | null, root: string): StaticNorm {
  if (raw === null || (exit !== 0 && exit !== 1)) return staticInvalid("eslint did not finish normally or left no report");
  if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return staticInvalid("the lint report exceeds 10 MB");
  let files: any;
  try { files = JSON.parse(raw); } catch { return staticInvalid("the lint report is not valid JSON"); }
  if (!Array.isArray(files) || !files.length || files.length > 2000 || nestsTooDeep(files))
    return staticInvalid("invalid lint population bounds");
  const failures: StaticNorm["failures"] = [], population = new Set<string>();
  let errors = 0;
  for (const file of files) {
    const f = lintFile(file, root);
    if ("problem" in f) return staticInvalid(f.problem);
    if (population.has(f.path)) return staticInvalid("duplicate lint file identity");
    population.add(f.path); errors += f.errors;
    failures.push(...f.failures.slice(0, MAX_EXAMPLES - failures.length));
  }
  if ((exit === 0) !== (errors === 0)) return staticInvalid("eslint's exit status and its report disagree");
  return verdictOf(failures, [...population]);
}

/** Pure: a static tool's exit status and output to a pass, a bounded list of errors, or `invalid` when they prove nothing. */
export function normalizeStatic(tool: StaticTool, out: { exit: number | undefined; raw: string | null }, root = ""): StaticNorm {
  return tool === "tsc" ? normalizeTsc(out.exit, out.raw, root) : normalizeEslint(out.exit, out.raw, root);
}

const STATIC_SCRIPT: Record<StaticTool, string> = { tsc: "typescript/bin/tsc", eslint: "eslint/bin/eslint.js" };
const STATIC_VERSION: Record<StaticTool, string> = { tsc: "5.9.3", eslint: "9.39.1" };

export function createStack(): Stack {
  let exclusions: readonly Exclusion[] = [];
  return {
    setExclusions: (value) => {
      exclusions = value;
    },
    detect: (root) => detect(root, exclusions),
    argv: (files, report) => {
      const vitest = "node_modules/vitest/vitest.mjs"; // a direct binary, never npx (TS §9.3)
      return [
        process.execPath,
        vitest,
        "run",
        "--reporter=json",
        `--outputFile=${report}`,
        "--no-color",
        ...(files === "all" ? [] : files),
      ];
    },
    normalize,
    staticArgv: (root, tool, report) => {
      const meta = metadata(root, exclusions);
      if (meta.json(`node_modules/${tool === "tsc" ? "typescript" : "eslint"}/package.json`)?.version !== STATIC_VERSION[tool]) return null;
      if (!existsSync(join(root, "node_modules", STATIC_SCRIPT[tool]))) return null;
      if (tool === "tsc") {
        const config = meta.json("tsconfig.json");
        if (!config || config.extends !== undefined || config.references?.length || config.compilerOptions?.composite
          || config.compilerOptions?.tsBuildInfoFile !== undefined) return null;
      }
      const script = join("node_modules", STATIC_SCRIPT[tool]); // a direct binary, never npx (TS §9.3)
      return tool === "tsc"
        ? [process.execPath, script, "--noEmit", "--pretty", "false", "--project", "tsconfig.json", "--incremental", "false", "--listFiles"]
        : [process.execPath, script, "--format", "json", "--output-file", report, "--no-color", "."];
    },
    staticOutput: (tool, r) => (tool === "tsc" ? r.stdout : r.report),
    normalizeStatic,
    e2eArgv: (root, report) => playwrightArgv(root, report),
    normalizeE2e: (out, root) => normalizePlaywright(out.raw, root),
    adapterVersion: () => ADAPTER,
    fingerprint: (root): ToolVersions => ({
      node: process.version,
      tool: String(metadata(root, exclusions).json("node_modules/vitest/package.json")?.version ?? "none"),
      reporter: "vitest-json",
      adapter: ADAPTER,
      dependencies: metadata(root, exclusions).installed(),
      static: Object.fromEntries(
        (["tsc", "eslint"] as const).map((t) => {
          const pkg = metadata(root, exclusions).json(`node_modules/${t === "tsc" ? "typescript" : "eslint"}/package.json`);
          return [t, String(pkg?.version ?? "none")];
        }),
      ),
    }),
    patterns: PATTERNS,
    classify,
    isTestPath: (p) => classify(p) === "test",
  };
}
