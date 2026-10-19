// Node/TypeScript adapter (TS §9.5): detection, the Vitest invocation, one pure normalization of its JSON report
// and the attention-pattern table. Mostly data. The adapter normalizes; it never decides acceptance.
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { AttentionPattern, FileChange } from "../core/review.ts";
import type { Detection, Normalized, Stack, ToolVersions } from "../ports/types.ts";

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

function detect(root: string): Detection {
  const pkg = readJson(join(root, "package.json"));
  const deps = { ...(pkg?.dependencies ?? {}), ...(pkg?.devDependencies ?? {}) };
  const typescript = existsSync(join(root, "tsconfig.json")) || "typescript" in deps;
  const language = pkg || typescript ? "ts-js" : "other";
  const vitest = readJson(join(root, "node_modules/vitest/package.json"));
  const major = Number(String(vitest?.version ?? "").split(".")[0]);
  const pm = existsSync(join(root, "pnpm-lock.yaml")) ? "pnpm" : existsSync(join(root, "yarn.lock")) ? "yarn" : existsSync(join(root, "package-lock.json")) ? "npm" : "unknown";
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
  let d: any;
  try { d = JSON.parse(raw); } catch { return { files, discovered: 0, invalid: "the report is not valid JSON" }; }
  if (!d || !Array.isArray(d.testResults)) return { files, discovered: 0, invalid: "the report has no testResults" };
  let discovered = 0;
  for (const t of d.testResults.slice(0, 2000)) {
    const path = root && String(t.name).startsWith(root) ? relative(root, t.name) : String(t.name);
    const f = { executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0, tests: [] as string[], failures: [] as Array<{ test: string; kind: string; message: string }> };
    for (const a of (t.assertionResults ?? []).slice(0, 20000)) {
      discovered++;
      f.tests.push(a.fullName);
      if (a.status === "passed") { f.executed++; f.passed++; }
      else if (a.status === "failed") {
        f.executed++; f.failed++;
        const m = message(a), kind = failureKind(m);
        if (kind === "focused") f.focused++;
        if (f.failures.length < 5) f.failures.push({ test: a.fullName, kind, message: m });
      } else f.skipped++;
    }
    // A file that failed before any test ran (import or compile error) is a failure, never a pass or a skip.
    if (t.status === "failed" && !(t.assertionResults ?? []).length) {
      f.failed++;
      f.failures.push({ test: path, kind: "compile-or-import", message: String(t.message ?? "the file failed to load").split("\n")[0]!.slice(0, 500) });
    }
    files.set(path, f);
  }
  return { files, discovered };
}

export function createStack(): Stack {
  return {
    detect,
    argv: (files, report) => {
      const vitest = "node_modules/vitest/vitest.mjs"; // a direct binary, never npx (TS §9.3)
      return [process.execPath, vitest, "run", "--reporter=json", `--outputFile=${report}`, "--no-color", ...(files === "all" ? [] : files)];
    },
    normalize,
    fingerprint: (root): ToolVersions => ({
      node: process.version, tool: String(readJson(join(root, "node_modules/vitest/package.json"))?.version ?? "none"),
      reporter: "vitest-json", adapter: ADAPTER,
    }),
    patterns: PATTERNS, classify, isTestPath: (p) => classify(p) === "test",
  };
}
