// Node/TypeScript adapter (TS §9.5): detection, the Vitest invocation, one pure normalization of its JSON report
// and the attention-pattern table. Mostly data. The adapter normalizes; it never decides acceptance.
import { closeSync, constants, existsSync, fstatSync, openSync, readSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { AttentionPattern, FileChange } from "../core/review.ts";
import type { Detection, Normalized, StaticNorm, StaticTool, Stack, ToolVersions } from "../ports/types.ts";
import { allowed } from "../core/exclusions.ts";
import type { Exclusion } from "../core/exclusions.ts";
import { KernelError } from "../core/errors.ts";
import { sha256 } from "../core/ids.ts";
import { FsProject } from "./project-fs.ts";
import { nestsTooDeep } from "./report-bounds.ts";
import { shareDeps } from "./node-deps.ts";
import { normalizePlaywright, playwrightArgv } from "./playwright.ts";
import { unsupportedTsConfig } from "./static-config.ts";

const ADAPTER = "node-ts@28"; // 28: report unsupported tsconfig.
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
    text(path: string): string | null {
      permit(path);
      return project.read(path);
    },
  };
}

function reporterConfigProblem(reporters: unknown, path: string): string | undefined {
  if (reporters === undefined) return undefined;
  const entries = Array.isArray(reporters) ? reporters : [reporters];
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry[0] !== "json") continue;
    const options = entry[1];
    if (options && typeof options === "object" && "outputFile" in options)
      return `${path} sets a JSON reporter outputFile that overrides the adapter's private report destination`;
    if (!options || typeof options !== "object" || Object.keys(options).length)
      return `${path} has JSON reporter options the adapter cannot verify`;
  }
  return undefined;
}

function configProblem(meta: ReturnType<typeof metadata>): string | undefined {
  const pkg = meta.json("package.json");
  const packageProblem = reporterConfigProblem(pkg?.vitest?.test?.reporters ?? pkg?.vitest?.reporters, "package.json");
  if (packageProblem) return packageProblem;
  for (const base of ["vitest.config", "vite.config"]) for (const extension of ["js", "mjs", "cjs", "ts", "mts", "cts"]) {
    const path = `${base}.${extension}`;
    const source = meta.text(path);
    if (!source) continue;
    if (/\bonUnhandledError\b/.test(source)) return `${path} has an unsupported unhandled-error filter`;
    const matches = [...source.matchAll(/(?:\breporters\b|["']reporters["'])\s*:\s*/g)];
    if ([...source.matchAll(/\breporters\b/g)].length > matches.length)
      return `${path} has reporter settings the adapter cannot verify`;
    for (const match of matches) {
      const setting = source.slice(match.index! + match[0].length);
      if (/^\[\s*\[\s*["']json["']\s*,\s*\{[^}]*\boutputFile\s*:/s.test(setting))
        return `${path} sets a JSON reporter outputFile that overrides the adapter's private report destination`;
      if (!/^(?:["'][^"'\\]*["']|\[\s*["'][^"'\\]*["'](?:\s*,\s*["'][^"'\\]*["'])*\s*\])/s.test(setting))
        return `${path} has reporter options the adapter cannot verify`;
    }
  }
  return undefined;
}

function detect(root: string, exclusions: readonly Exclusion[]): Detection {
  const meta = metadata(root, exclusions);
  const pkg = meta.json("package.json");
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const typescript = meta.present("tsconfig.json") || "typescript" in deps;
  const vitest = meta.json("node_modules/vitest/package.json");
  const pm = meta.present("pnpm-lock.yaml")
    ? "pnpm"
    : meta.present("yarn.lock")
      ? "yarn"
      : meta.present("package-lock.json")
        ? "npm"
        : "unknown";
  const d: Detection = {
    language: pkg || typescript ? "ts-js" : "other",
    typescript,
    depsInstalled: existsSync(join(root, "node_modules")),
    runnerSupported: !!vitest && SUPPORTED.includes(Number(String(vitest.version).split(".")[0])),
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

const message = (messages: string[] = []) => (messages[0] ?? "").split("\n")[0]!.slice(0, 500);
const failureKind = (msg: string): string =>
  /Unexpected \.only/.test(msg)
    ? "focused"
    : /^(?:AssertionError\b|(?:Error: )?expect\(|expected .* to )/.test(msg)
      ? "assertion"
      : /timed? ?out/i.test(msg)
        ? "timeout"
        : "runtime-error";

/** A failure's kind and a short hash of its first message line with paths and numbers blanked, so two runs in different folders compare. */
const PATHS = /(?:[A-Za-z]:)?[\\/][^\s'"()]+/g;
const failureId = (test: string, kind: string, line: string): string =>
  `${test}\u001f${kind}:${sha256(line.replace(PATHS, "<path>").replace(/\d+/g, "N")).slice(0, 8)}`;

const invalid = (message: string): Normalized => ({ files: new Map(), discovered: 0, invalid: message });
const FILE_STATUS = ["passed", "failed", "pending", "skipped"];
const ASSERTION_STATUS = ["passed", "failed", "pending", "skipped", "todo", "disabled"];
type Counts = NonNullable<ReturnType<Normalized["files"]["get"]>>;

/** One test file's record and its path inside the workspace, or the reason it is invalid. */
function admitFile(t: any, root: string, seen: ReadonlyMap<string, unknown>): { path: string } | { problem: string } {
  if (!t || typeof t.name !== "string" || !FILE_STATUS.includes(t.status) || !Array.isArray(t.assertionResults))
    return { problem: "invalid test file record" };
  const path = relative(resolve(root), resolve(root, t.name)).split(sep).join("/");
  if ((!root && isAbsolute(t.name)) || t.name.includes("\0") || !path || path === "." || path === ".." ||
    path.startsWith("../") || isAbsolute(path))
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
    (!Array.isArray(a.failureMessages) || a.failureMessages.some((m: unknown) => typeof m !== "string" || m.length > 2000))
  )
    return "invalid assertion failure messages";
  if (a.status !== "failed" && a.failureMessages?.length) return "the assertion status and its failure messages disagree";
  if (seen.has(a.fullName)) return "duplicate test identity";
  seen.add(a.fullName);
  return undefined;
}

/** Add one admitted assertion to its file's counts; a failure keeps its kind and up to five examples. */
function count(f: Counts, a: any): void {
  f.tests.push(a.fullName);
  const status = a.status === "passed" || a.status === "failed" ? a.status : "skipped";
  const kinds: string[] = status === "failed"
    ? [...new Set<string>((a.failureMessages?.length ? a.failureMessages : [""]).map((m: string) =>
      failureKind(stripVTControlCharacters(message([m])))))] : [];
  const kind = kinds[0];
  f.outcomes!.push({ test: a.fullName, status, ...(kind ? { kind, kinds } : {}) });
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
  const m = message(a.failureMessages);
  f.failureKinds = [...new Set([...f.failureKinds, ...kinds])];
  if (kinds.includes("focused")) f.focused++;
  if (f.failures.length < 5) f.failures.push({ test: a.fullName, kind: kind!, message: m });
  f.ids!.push(failureId(a.fullName, kind!, stripVTControlCharacters(m)));
}

/** Counts for one admitted file, or the reason an assertion in it is invalid. */
function countFile(t: any, path: string): Counts | string {
  const identities = new Set<string>();
  const f: Counts = {
    executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0, tests: [], outcomes: [], failureKinds: [], failures: [], ids: [],
  };
  for (const a of t.assertionResults) {
    const problem = admitAssertion(a, identities);
    if (problem) return problem;
    count(f, a);
  }
  if (f.executed && ["pending", "skipped"].includes(t.status)) return "a skipped file contains executed tests";
  // File-level errors remain failures beside assertion failures.
  if (t.status === "failed" && (!f.failed || t.message)) {
    f.failed++;
    f.failureKinds.push("compile-or-import");
    const m = message([String(t.message ?? "the file failed to load")]);
    if (f.failures.length < 5) f.failures.push({ test: path, kind: "compile-or-import", message: m });
    f.ids!.push(failureId(path, "compile-or-import", stripVTControlCharacters(m)));
  }
  return f;
}

/** Pure: Vitest's JSON report to per-file counts and bounded failures. A report that does not parse is `invalid`. */
export function normalize(raw: string, root = ""): Normalized {
  if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return invalid("the report exceeds 10 MB");
  let d: any;
  try {
    d = JSON.parse(raw);
  } catch {
    return invalid("the report is not valid JSON");
  }
  if (!d || !Array.isArray(d.testResults)) return invalid("the report has no testResults");
  if (d.testResults.length > 2000) return invalid("too many test files; the report was not fully normalized");
  if (nestsTooDeep(d)) return invalid("the report exceeds depth 64");
  const files: Normalized["files"] = new Map();
  let discovered = 0;
  for (const t of d.testResults) {
    const file = admitFile(t, root, files);
    if ("problem" in file) return invalid(file.problem);
    const counts = countFile(t, file.path);
    if (typeof counts === "string") return invalid(counts);
    discovered += t.assertionResults.length;
    files.set(file.path, counts);
  }
  if (d.numTotalTests !== undefined && d.numTotalTests !== discovered)
    return invalid("the report's total and its assertions disagree");
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
  if (!path || path.includes("\0") || (!root && isAbsolute(path))) return undefined;
  if (/(^|[\\/])node_modules[\\/]/.test(path)) return dependencies ? null : undefined;
  const p = relative(resolve(root), resolve(root, path)).split(sep).join("/");
  return !p || p === "." || p === ".." || p.startsWith("../") || isAbsolute(p) ? undefined : p;
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
  for (const line of raw.split(/\r?\n/).filter((l) => l.trim())) {
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
    assertSupportedConfiguration: (root) => {
      const problem = configProblem(metadata(root, exclusions));
      if (problem) throw new KernelError("adapter-unsupported-config", `${problem}; no check was launched`, { exit: 2 });
    },
    argv: (files, report) => [
      process.execPath,
      "node_modules/vitest/vitest.mjs",
      "run",
      "--reporter=json",
      `--outputFile=${report}`,
      "--no-color",
      "--allowOnly=false",
      "--dangerouslyIgnoreUnhandledErrors=false",
      ...(files === "all" ? [] : files),
    ],
    normalize,
    staticArgv: (root, tool, report) => {
      const meta = metadata(root, exclusions);
      if (meta.json(`node_modules/${tool === "tsc" ? "typescript" : "eslint"}/package.json`)?.version !== STATIC_VERSION[tool]) return null;
      const script = join("node_modules", STATIC_SCRIPT[tool]);
      if (!existsSync(join(root, script))) return null;
      if (tool === "tsc") {
        const text = meta.text("tsconfig.json");
        if (text === null) return null;
        const unsupportedConfig = unsupportedTsConfig(text);
        if (unsupportedConfig) return { unsupportedConfig };
      }
      return tool === "tsc"
        ? [process.execPath, script, "--noEmit", "--pretty", "false", "--project", "tsconfig.json", "--incremental", "false", "--listFiles"]
        : [process.execPath, script, "--format", "json", "--output-file", report, "--no-color", "."];
    },
    staticOutput: (tool, r) => (tool === "tsc" ? r.stdout : r.report),
    normalizeStatic,
    e2eArgv: (root, report) => playwrightArgv(root, report,
      String(metadata(root, exclusions).json("node_modules/@playwright/test/package.json")?.version ?? "none")),
    normalizeE2e: (out, root) => normalizePlaywright(out.raw, root),
    adapterVersion: () => ADAPTER,
    shareDeps,
    fingerprint: (root): ToolVersions => {
      const meta = metadata(root, exclusions);
      return {
        node: process.version,
        tool: String(meta.json("node_modules/vitest/package.json")?.version ?? "none"),
        reporter: "vitest-json",
        adapter: ADAPTER,
        dependencies: meta.installed(),
        static: Object.fromEntries(
          ([["tsc", "typescript"], ["eslint", "eslint"], ["playwright", "@playwright/test"]] as const).map(([t, name]) =>
            [t, String(meta.json(`node_modules/${name}/package.json`)?.version ?? "none")]),
        ),
      };
    },
    patterns: PATTERNS,
    classify,
    isTestPath: (p) => classify(p) === "test",
  };
}
