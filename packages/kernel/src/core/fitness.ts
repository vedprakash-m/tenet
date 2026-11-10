// A project's reference workload and fitness functions (QLT-05): the declaration, the judgement of the report the
// declared harness prints, the per-function series kept across contracts, and the trend rule. Pure: the run itself
// happens in the check verb. Every number read here is produced by project code; the kernel measures nothing.
import { z } from "zod";
import { hashOf } from "./ids.ts";
import type { AttentionItem } from "./schemas.ts";

export const WORKLOAD_FILE = "workload.json";
export const SCOPE = "Workload evidence concerns only the project's declared workload, not whether the whole application meets " +
  "its workload. The harness that produces the numbers is project code; the kernel does not measure performance or qualify " +
  "the reference machine.";
export const UNAVAILABLE = "No validated workload report is available.";
export const TREND_PREFIX = "fitness-trend:";
const MAX_POINTS = 12;
/** Harness reasons that mean the run had too few samples or was a smoke run: inconclusive, never a failure. */
const POPULATION = ["diagnostic-smoke-only", "insufficient-successful-samples"];
const SHELLS = /^(?:sh|bash|zsh|dash|cmd|powershell|pwsh|npx|npm|pnpm|yarn)(?:\.exe)?$/i;

const DottedPath = z.string().max(200).regex(/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/);
const Argv = z.array(z.string().min(1).max(4096)).min(1).max(64)
  .refine((a) => !SHELLS.test(a[0]!.split(/[\\/]/).at(-1)!), "a shell or package-manager launcher is not allowed");
const Fitness = z.strictObject({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,39}$/), measure: DottedPath, unit: z.string().regex(/^[A-Za-z%/]{0,12}$/),
  better: z.enum(["lower", "higher"]), target: z.number().finite().nonnegative(), trend: z.boolean().optional(),
  degradation: z.strictObject({
    percent: z.number().positive().max(1000), consecutive: z.number().int().min(2).max(MAX_POINTS), floor: z.number().nonnegative(),
  }).optional(),
}).refine((f) => f.trend === false || f.degradation, "a trended function needs a degradation threshold");

export const WorkloadDeclaration = z.strictObject({
  version: z.literal(1), build: Argv.optional(), run: Argv, report: z.literal("stdout"),
  timeoutMs: z.number().int().min(1000).max(3_600_000), minimumSamples: z.number().int().nonnegative(),
  samples: z.array(DottedPath).max(32), fitness: z.array(Fitness).min(1).max(32),
}).refine((d) => new Set(d.fitness.map((f) => f.id)).size === d.fitness.length, "fitness ids must be unique");
export type WorkloadDeclaration = z.infer<typeof WorkloadDeclaration>;
export type FitnessFunction = WorkloadDeclaration["fitness"][number];
export type ParsedWorkload = { ok: true; decl: WorkloadDeclaration } | { ok: false; problem: string };

/** A strict reading of `workload.json`: missing, unparseable or invalid is a named problem, never a default. */
export function parseWorkload(text: string | null): ParsedWorkload {
  if (text === null) return { ok: false, problem: `${WORKLOAD_FILE} is missing` };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, problem: `${WORKLOAD_FILE} is not valid JSON` }; }
  const r = WorkloadDeclaration.safeParse(raw);
  if (r.success) return { ok: true, decl: r.data };
  const issue = r.error.issues[0]!;
  return { ok: false, problem: `${WORKLOAD_FILE} ${issue.path.join(".") || "(root)"}: ${issue.message}`.slice(0, 200) };
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
/** A dotted path into the report, own keys only. */
export const valueAt = (report: unknown, path: string): unknown =>
  path.split(".").reduce<unknown>((o, k) => (isObject(o) && Object.hasOwn(o, k) ? o[k] : undefined), report);
const reading = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
const short = (n: number) => Number(n.toPrecision(6));

export interface WorkloadMeasures { env: string; samples: number; measures: Record<string, number> }
export interface Judged {
  status: "pass" | "fail" | "inconclusive";
  reasons: string[];
  limitations: string[];
  failures: Array<{ test: string; kind: string; message: string }>;
  workload?: WorkloadMeasures;
}

/** The series a point belongs to: the project-reported platform, architecture and node major, and the trended definitions. */
function envTag(decl: WorkloadDeclaration, report: Record<string, unknown>): string {
  const env = isObject(report.environment) ? report.environment : {};
  const node = typeof env.node === "string" ? /^v?(\d+)/.exec(env.node)?.[1] ?? null : null;
  const defs = decl.fitness.filter((f) => f.trend !== false).map((f) => [f.id, f.measure, f.better]);
  return hashOf([env.platform ?? null, env.arch ?? null, env.totalMemoryBytes ?? null, node, defs]).slice(0, 16);
}

/** Exit, `referencePass` and `reasons` must tell one story. */
function contradiction(exit: number, pass: unknown, reasons: string[]): string | undefined {
  if (pass === false && exit === 0) return "the report says the reference run failed but the command exited 0";
  if (pass === true && exit !== 0) return `the report says the reference run passed but the command exited ${exit}`;
  if (pass === false && !reasons.length) return "the report says the reference run failed but lists no reason";
  if (pass === true && reasons.length) return "the report says the reference run passed but lists reasons";
  return undefined;
}

function missed(f: FitnessFunction, v: number): boolean {
  return f.better === "lower" ? v > f.target : v < f.target;
}

/** The kernel's own reading of a completed run's report against the declared targets (WR-4). */
export function judgeReport(decl: WorkloadDeclaration, exit: number, raw: string | null): Judged {
  const no = (code: string, why: string, extra: string[] = [UNAVAILABLE]): Judged =>
    ({ status: "inconclusive", reasons: [code], limitations: [why, ...extra, SCOPE], failures: [] });
  if (raw === null || !raw.trim()) return no("report-missing", "the workload printed no report");
  let report: unknown;
  try { report = JSON.parse(raw); } catch { return no("report-invalid", "the workload report is not JSON"); }
  if (!isObject(report) || typeof report.mode !== "string" || !/^[a-z-]{1,20}$/.test(report.mode))
    return no("report-invalid", "the workload report names no mode");
  const said = [`The project report declares ${report.mode} mode.`];
  const reasons = report.reasons ?? [];
  if (!Array.isArray(reasons) || reasons.some((r) => typeof r !== "string" || !/^[a-z0-9-]{1,60}$/.test(r)))
    return no("report-invalid", "the report's reasons are not a list of short codes");
  if (report.referencePass !== undefined && typeof report.referencePass !== "boolean")
    return no("report-invalid", "the report's referencePass is not true or false");
  if (report.mode !== "reference") return no("population-mismatch", "only a reference-mode report can pass", said);
  const counts = decl.samples.map((p) => reading(valueAt(report, p)));
  const values = decl.fitness.map((f) => reading(valueAt(report, f.measure)));
  const absent = [
    ...decl.samples.filter((_, i) => counts[i] === undefined), ...decl.fitness.filter((_, i) => values[i] === undefined).map((f) => f.id),
  ];
  if (absent.length) return no("report-invalid", `the report has no non-negative number for ${absent.slice(0, 3).join(", ")}`, said);
  const samples = counts.reduce<number>((a, b) => a + b!, 0);
  if (samples < decl.minimumSamples)
    return no("population-mismatch", `${samples} samples, below the declared ${decl.minimumSamples}`, said);
  const why = contradiction(exit, report.referencePass, reasons as string[]);
  if (why) return no("report-contradiction", why, said);
  const harness = (reasons as string[]).filter((r) => !POPULATION.includes(r));
  if (reasons.length && !harness.length) return no("population-mismatch", `the harness reported ${reasons.join(", ")}`, said);
  const workload: WorkloadMeasures = {
    env: envTag(decl, report), samples,
    measures: Object.fromEntries(decl.fitness.flatMap((f, i) => (f.trend === false ? [] : [[f.id, values[i]!]]))),
  };
  const failures = [
    ...decl.fitness.flatMap((f, i) => missed(f, values[i]!)
      ? [{ test: f.id, kind: "target", message: `${f.id} ${short(values[i]!)} ${f.unit} against the declared target ${f.target}` }] : []),
    ...harness.slice(0, 5).map((r) => ({ test: r, kind: "harness-reason", message: `the harness reported ${r}` })),
  ];
  if (failures.length) return { status: "fail", reasons: [], limitations: [...said, SCOPE], failures, workload };
  if (exit !== 0) return no("report-contradiction", `every declared target was met but the command exited ${exit}`, said);
  return { status: "pass", reasons: [], limitations: [...said, SCOPE], failures: [], workload };
}

// ---------------------------------------------------------------- series and trend

export interface Point { value: number; receipt: string; at: string; env: string }
export interface Series { points: Point[]; raised?: string }
export type FitnessSeries = Record<string, Series>;

/** Over the last n points each is worse than the one before, and the last is worse than the first by more than the
 * larger of `percent` of the first and `floor`. No division, so a zero base uses the floor. */
export function degraded(values: readonly number[], better: "lower" | "higher", d: NonNullable<FitnessFunction["degradation"]>): boolean {
  if (values.length < d.consecutive) return false;
  const w = values.slice(-d.consecutive);
  const worse = (a: number, b: number) => (better === "lower" ? b > a : b < a);
  if (!w.every((v, i) => i === 0 || worse(w[i - 1]!, v))) return false;
  return Math.abs(w.at(-1)! - w[0]!) > Math.max((d.percent / 100) * w[0]!, d.floor);
}

export interface TrendLine { id: string; unit: string; values: number[]; runs: string; restarted?: string }
export interface Current { receipt: string; at: string; workload: WorkloadMeasures }

function itemFor(f: FitnessFunction, window: Point[]): AttentionItem {
  const first = window[0]!.value, last = window.at(-1)!.value, sign = last > first ? "+" : "-";
  const change = first === 0 ? `${sign}${short(Math.abs(last - first))} ${f.unit}`.trim()
    : `${sign}${Math.round((Math.abs(last - first) / first) * 100)}%`;
  return {
    id: `AT-${hashOf(["fitness", f.id, window[0]!.receipt]).slice(0, 8)}`, path: WORKLOAD_FILE, line: 1, marker: false,
    pattern: `${TREND_PREFIX}${f.id} ${short(first)} to ${short(last)} ${f.unit} (${change}, ${window.length} runs)`.slice(0, 120),
  };
}

/** The trend of each function with the current receipt as its newest point; an item for each that crossed its threshold. */
export function trendOf(decl: WorkloadDeclaration, series: FitnessSeries, cur: Current): { items: AttentionItem[]; lines: TrendLine[] } {
  const items: AttentionItem[] = [], lines: TrendLine[] = [];
  for (const f of decl.fitness) {
    const value = cur.workload.measures[f.id];
    if (f.trend === false || value === undefined || !f.degradation) continue;
    const kept = (Object.hasOwn(series, f.id) ? series[f.id]!.points : []).filter((p) => p.receipt !== cur.receipt);
    const all = [...kept, { value, receipt: cur.receipt, at: cur.at, env: cur.workload.env }].slice(-MAX_POINTS);
    const same = all.filter((p) => p.env === cur.workload.env);
    const raised = Object.hasOwn(series, f.id) ? same.findIndex((p) => p.receipt === series[f.id]!.raised) : -1;
    const open = same.slice(Math.max(0, raised));
    const line: TrendLine = { id: f.id, unit: f.unit, values: same.map((p) => p.value), runs: `the last ${same.length} Deep contracts` };
    if (same.length < all.length) line.restarted = "series restarted: the environment or the trended definitions changed";
    lines.push(line);
    if (degraded(open.map((p) => p.value), f.better, f.degradation)) items.push(itemFor(f, open.slice(-f.degradation.consecutive)));
  }
  return { items, lines };
}

/** The ids of functions whose trend item a contract carries. */
export const raisedIds = (attention: readonly AttentionItem[]): string[] =>
  attention.flatMap((a) => (a.pattern.startsWith(TREND_PREFIX) ? [a.pattern.slice(TREND_PREFIX.length).split(" ")[0]!] : []));

/** One point per finished contract, from its receipt; a receipt already recorded adds nothing. A function whose window
 * raised an item in this contract starts its next window at this point. */
export function appendSeries(series: FitnessSeries, cur: Current, raised: readonly string[]): FitnessSeries {
  const out: FitnessSeries = { ...series };
  for (const [id, value] of Object.entries(cur.workload.measures)) {
    const prev: Series = Object.hasOwn(series, id) ? series[id]! : { points: [] };
    if (prev.points.some((p) => p.receipt === cur.receipt)) continue;
    const points = [...prev.points, { value, receipt: cur.receipt, at: cur.at, env: cur.workload.env }].slice(-MAX_POINTS);
    out[id] = { points, ...(raised.includes(id) ? { raised: cur.receipt } : prev.raised ? { raised: prev.raised } : {}) };
  }
  return out;
}
