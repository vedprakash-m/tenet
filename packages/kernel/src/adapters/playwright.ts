// Playwright adapter (EVD-13, TS §9.3 Servers, §12.7): the end-to-end obligation's invocation and the pure
// normalization of its JSON report into the same shape Vitest's does, so every receipt rule already built for
// test obligations (contradiction, population, focused, zero-tests) applies unchanged. The adapter normalizes;
// it never decides acceptance.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { Normalized } from "../ports/types.ts";
import { nestsTooDeep } from "./report-bounds.ts";

const PLAYWRIGHT_SCRIPT = "@playwright/test/cli.js";
const SUPPORTED = [1];

/** A direct binary, never npx; null when Playwright is not installed in the project at a supported major version. */
export function playwrightArgv(root: string, report: string): string[] | null {
  if (!existsSync(join(root, "node_modules", PLAYWRIGHT_SCRIPT))) return null;
  const pkg = readPkg(join(root, "node_modules/@playwright/test/package.json"));
  const major = Number(String(pkg?.version ?? "").split(".")[0]);
  if (!SUPPORTED.includes(major)) return null;
  const script = join("node_modules", PLAYWRIGHT_SCRIPT); // a direct binary, never npx (TS §9.3)
  void report; // the JSON reporter writes to PLAYWRIGHT_JSON_OUTPUT_NAME in the run's env, not an argv flag
  return [process.execPath, script, "test", "--reporter=json"];
}

function readPkg(p: string): Record<string, any> | null {
  try { return JSON.parse(readFileSync(p, "utf8")); } catch { return null; }
}

const invalid = (message: string): Normalized => ({ files: new Map(), discovered: 0, invalid: message });
type Counts = NonNullable<ReturnType<Normalized["files"]["get"]>>;

interface PwResult { status: string; errors?: Array<{ message?: string }> }
interface PwTest { status: string; results: PwResult[] }
interface PwSpec { title: string; ok: boolean; tests: PwTest[] }
interface PwSuite { file?: string; title: string; specs: PwSpec[]; suites?: PwSuite[] }
interface PwReport { suites: PwSuite[]; stats: { expected: number; skipped: number; unexpected: number; flaky: number } }

/** Every spec in a suite tree, each tagged with the file it belongs to (nested `describe` blocks share their file). */
function flatten(suites: readonly PwSuite[], file: string | undefined, out: Array<{ file: string; spec: PwSpec }>): void {
  for (const s of suites) {
    const f = s.file ?? file;
    for (const spec of s.specs ?? []) if (f) out.push({ file: f, spec });
    if (s.suites?.length) flatten(s.suites, f, out);
  }
}

const firstError = (spec: PwSpec): string => {
  for (const t of spec.tests) for (const r of t.results) {
    if (r.errors?.length) return String(r.errors[0]!.message ?? "").split("\n")[0]!.slice(0, 500);
  }
  return "the test did not pass";
};
const specStatus = (spec: PwSpec): "passed" | "failed" | "skipped" => {
  if (spec.tests.every((t) => t.results.every((r) => r.status === "skipped"))) return "skipped";
  return spec.ok ? "passed" : "failed";
};

/** Pure: Playwright's JSON report to the same per-file counts Vitest's normalizer produces. */
export function normalizePlaywright(raw: string | null, root = ""): Normalized {
  if (raw === null) return invalid("no report was produced");
  if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return invalid("the report exceeds 10 MB");
  let d: PwReport;
  try { d = JSON.parse(raw); } catch { return invalid("the report is not valid JSON"); }
  if (!d || !Array.isArray(d.suites) || !d.stats) return invalid("the report has no suites or stats");
  if (nestsTooDeep(d)) return invalid("the report exceeds depth 64");
  const flat: Array<{ file: string; spec: PwSpec }> = [];
  flatten(d.suites, undefined, flat);
  if (flat.length > 20000) return invalid("too many specs; the report was not fully normalized");

  const files = new Map<string, Counts>();
  for (const { file, spec } of flat) {
    const path = root ? relative(resolve(root), resolve(root, file)) : file;
    if (path === ".." || path.startsWith("../") || (!root && isAbsolute(path))) return invalid("a report path leaves the workspace");
    const f: Counts = files.get(path) ?? {
      executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0, tests: [], failureKinds: [], failures: [],
    };
    f.tests.push(spec.title);
    const status = specStatus(spec);
    if (status === "skipped") { f.skipped++; files.set(path, f); continue; }
    f.executed++;
    if (status === "passed") { f.passed++; files.set(path, f); continue; }
    f.failed++;
    if (!f.failureKinds.includes("assertion")) f.failureKinds.push("assertion");
    if (f.failures.length < 5) f.failures.push({ test: spec.title, kind: "assertion", message: firstError(spec) });
    files.set(path, f);
  }
  const discovered = [...files.values()].reduce((n, f) => n + f.executed + f.skipped, 0);
  const hasFailure = [...files.values()].some((f) => f.failed > 0);
  if ((d.stats.unexpected > 0) !== hasFailure) return invalid("the report's stats and its specs disagree");
  return { files, discovered };
}
