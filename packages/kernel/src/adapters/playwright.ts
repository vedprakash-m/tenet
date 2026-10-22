// Playwright adapter (EVD-13, TS §9.3 Servers, §12.7): the end-to-end obligation's invocation and the pure
// normalization of its JSON report into the same shape Vitest's does, so every receipt rule already built for
// test obligations (contradiction, population, focused, zero-tests) applies unchanged. The adapter normalizes;
// it never decides acceptance.
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { z } from "zod";
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

const resultSchema = z.object({
  status: z.enum(["passed", "failed", "skipped", "timedOut", "interrupted"]),
  errors: z.array(z.object({ message: z.string().max(2000).optional() })).max(2000).optional(),
});
const testSchema = z.object({
  status: z.enum(["expected", "unexpected", "flaky", "skipped"]),
  expectedStatus: z.enum(["passed", "failed", "skipped"]).optional(),
  projectName: z.string().max(2000).optional(),
  results: z.array(resultSchema).min(1).max(3),
});
const specSchema = z.object({ title: z.string().max(2000), ok: z.boolean(), tests: z.array(testSchema).min(1).max(2000) });
type PwSpec = z.infer<typeof specSchema>;
interface PwSuite { file?: string; title: string; specs: PwSpec[]; suites?: PwSuite[] }
const suiteSchema: z.ZodType<PwSuite> = z.lazy(() => z.object({
  file: z.string().min(1).max(4000).optional(), title: z.string().max(2000),
  specs: z.array(specSchema).max(20000), suites: z.array(suiteSchema).max(2000).optional(),
}));
const totalSchema = z.number().int().nonnegative().max(20000);
const reportSchema = z.object({
  suites: z.array(suiteSchema).max(2000),
  stats: z.object({ expected: totalSchema, skipped: totalSchema, unexpected: totalSchema, flaky: totalSchema }),
  errors: z.array(z.unknown()).max(2000).optional(),
});

/** Every spec in a suite tree, each tagged with the file it belongs to (nested `describe` blocks share their file). */
function flatten(
  suites: readonly PwSuite[], file: string | undefined, out: Array<{ file: string; title: string; spec: PwSpec }>, prefix = "",
): void {
  for (const s of suites) {
    const f = s.file ?? file;
    const title = `${prefix}${s.title} > `;
    for (const spec of s.specs) out.push({ file: f ?? "", title: title + spec.title, spec });
    if (s.suites?.length) flatten(s.suites, f, out, title);
  }
}

const firstError = (spec: PwSpec): string => {
  for (const t of spec.tests) for (const r of t.results) {
    if (r.errors?.length) return String(r.errors[0]!.message ?? "").split("\n")[0]!.slice(0, 500);
  }
  return "the test did not pass";
};
function countSpec(counts: Counts, spec: PwSpec, title: string): string | undefined {
  for (const test of spec.tests) {
    if (test.results.length !== 1 || test.status === "flaky" || test.expectedStatus === "failed")
      return "retries and expected failures cannot establish passing behavior";
    const observed = test.results[0]!;
    if (observed.status === "interrupted") return "the test was interrupted";
    const status = observed.status === "timedOut" ? "failed" : observed.status;
    const expected = status === "skipped" ? "skipped" : status === "passed" ? "expected" : "unexpected";
    if (test.status !== expected) return "the test summary and its execution disagree";
    const identity = `${title} [project:${test.projectName ?? ""}]`;
    if (counts.tests.includes(identity)) return "duplicate test identity";
    const message = firstError({ ...spec, tests: [test] });
    const kind = observed.status === "timedOut" ? "timeout" : /expect\(|AssertionError/.test(message) ? "assertion" : "runtime-error";
    counts.tests.push(identity);
    counts.outcomes!.push({ test: identity, status, ...(status === "failed" ? { kind } : {}) });
    if (status === "skipped") { counts.skipped++; continue; }
    counts.executed++;
    if (status === "passed") { counts.passed++; continue; }
    counts.failed++;
    if (!counts.failureKinds.includes(kind)) counts.failureKinds.push(kind);
    if (counts.failures.length < 5) counts.failures.push({ test: identity, kind, message });
  }
  const ok = spec.tests.every(test => ["expected", "skipped"].includes(test.status));
  return spec.ok === ok ? undefined : "the spec summary and its tests disagree";
}

function reportPath(file: string, root: string): string | null {
  const path = root ? relative(resolve(root), resolve(root, file)) : file;
  return !file || !path || file.includes("\0") || path === ".." || path.startsWith("../") || (!root && isAbsolute(path))
    ? null : path;
}

/** Pure: Playwright's JSON report to the same per-file counts Vitest's normalizer produces. */
export function normalizePlaywright(raw: string | null, root = ""): Normalized {
  if (raw === null) return invalid("no report was produced");
  if (Buffer.byteLength(raw) > 10 * 1024 * 1024) return invalid("the report exceeds 10 MB");
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return invalid("the report is not valid JSON"); }
  if (!data || typeof data !== "object" || !("suites" in data) || !("stats" in data))
    return invalid("the report has no suites or stats");
  if (nestsTooDeep(data)) return invalid("the report exceeds depth 64");
  const parsed = reportSchema.safeParse(data);
  if (!parsed.success) return invalid("invalid Playwright report structure");
  const d = parsed.data;
  if (d.errors?.length) return invalid("the report contains global errors");
  const flat: Array<{ file: string; title: string; spec: PwSpec }> = [];
  flatten(d.suites, undefined, flat);
  if (flat.length > 20000) return invalid("too many specs; the report was not fully normalized");

  const files = new Map<string, Counts>();
  for (const { file, title, spec } of flat) {
    const path = reportPath(file, root);
    if (!path) return invalid("a report path leaves the workspace");
    const f: Counts = files.get(path) ?? {
      executed: 0, passed: 0, failed: 0, skipped: 0, focused: 0, tests: [], outcomes: [], failureKinds: [], failures: [],
    };
    const problem = countSpec(f, spec, title);
    if (problem) return invalid(problem);
    files.set(path, f);
  }
  const counts = [...files.values()];
  const sum = (key: "passed" | "failed" | "skipped") => counts.reduce((total, file) => total + file[key], 0);
  const discovered = sum("passed") + sum("failed") + sum("skipped");
  if (discovered > 20000 || files.size > 2000) return invalid("the report population exceeds its bound");
  if (d.stats.expected !== sum("passed") || d.stats.unexpected !== sum("failed") || d.stats.skipped !== sum("skipped") || d.stats.flaky)
    return invalid("the report's stats and its specs disagree");
  return { files, discovered };
}
