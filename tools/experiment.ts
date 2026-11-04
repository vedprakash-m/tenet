// Maintainer experiments (ENG-08; tech-spec 17.8, PRD 6.10.1). It runs no model and starts no host session. It checks a
// pre-registered manifest, refuses a candidate whose diff leaves the allowlist, records trials with their cost, and
// computes the disposition from the recorded trials under the holdout and tie rules.
//   node tools/experiment.ts validate <manifest>
//   node tools/experiment.ts diff <manifest> --candidate <commit>
//   node tools/experiment.ts record <manifest> --trial '<json>'
//   node tools/experiment.ts decide <manifest> [--candidate <commit>]
//   node tools/experiment.ts schema [--write]
// A manifest is eval/experiments/<id>.json; its trials are the lines of <id>.trials.jsonl beside it. Exit 0: done;
// 1: refused, with {"error": code} on stderr; 2: usage.
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { gitEnv } from "./bench-fixtures.ts";

/** TS 17.8: only files under plugin/skills/ may change. Kernel, graders and schemas are outside it (LRN-05). */
export const ALLOWED_PREFIX = "plugin/skills/";
export const DISPOSITIONS = ["pending", "keep-candidate", "keep-baseline", "rejected"] as const;
const ARMS = ["baseline", "candidate"] as const;

export class ExperimentError extends Error {
  readonly code: string;
  constructor(code: string, detail = "") { super(detail ? `${code}: ${detail}` : code); this.code = code; }
}

const Task = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const plainPath = (p: string) => !p.startsWith("/") && !p.includes("\\") && !/^[A-Za-z]:/.test(p) && p.split("/").every((s) => s && s !== "." && s !== "..");

export const Manifest = z.object({
  hypothesis: z.string().min(1),
  /** One skill (a directory) or one file under plugin/skills/. */
  surface: z.string().refine((p) => plainPath(p) && p.startsWith(ALLOWED_PREFIX) && p.split("/").length >= 3, { message: "outside-allowlist" }).describe("One skill directory or one file under plugin/skills/. tools/experiment.ts also checks this and that the splits do not overlap; the schema alone does not."),
  baseline: z.string().regex(/^[0-9a-f]{40,64}$/, "a full commit id"),
  training: z.array(Task).min(1),
  holdout: z.array(Task).min(1),
  repeats: z.number().int().min(5),
  budget: z.object({ maxTrials: z.number().int().positive(), maxCredits: z.number().positive() }).strict(),
  stopRule: z.string().min(1),
  tieRule: z.literal("simpler wins"),
  disposition: z.enum(DISPOSITIONS),
}).strict().superRefine((m, ctx) => {
  const all = [...m.training, ...m.holdout];
  if (new Set(all).size !== all.length) ctx.addIssue({ code: "custom", message: "holdout-overlap: a task appears twice or in both splits" });
  if (m.budget.maxTrials < all.length * ARMS.length * m.repeats) ctx.addIssue({ code: "custom", message: "budget-too-small: maxTrials is below tasks x arms x repeats" });
});
export type Manifest = z.infer<typeof Manifest>;

export const Trial = z.object({
  task: Task, arm: z.enum(ARMS), repeat: z.number().int().min(1),
  outcome: z.enum(["pass", "fail", "invalid"]),
  /** Credits attributable to this run, or null when the provider report cannot isolate them (tech-spec 17.5). */
  credits: z.number().min(0).nullable(), durationMs: z.number().int().min(0), host: z.string().min(1), model: z.string().min(1),
}).strict();
export type Trial = z.infer<typeof Trial>;

const parseOr = <T>(schema: z.ZodType<T>, value: unknown, code: string): T => {
  const r = schema.safeParse(value);
  if (!r.success) throw new ExperimentError(code, r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "));
  return r.data;
};
const readJson = (path: string, code: string): unknown => {
  try { return JSON.parse(readFileSync(path, "utf8")); } catch { throw new ExperimentError(code, path); }
};
export const loadManifest = (path: string): Manifest => parseOr(Manifest, readJson(path, "manifest-unreadable"), "invalid-manifest");
export const trialsPath = (manifestPath: string) => manifestPath.replace(/\.json$/, "") + ".trials.jsonl";
export function loadTrials(manifestPath: string): Trial[] {
  const path = trialsPath(manifestPath);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").split("\n").filter(Boolean).map((line) => {
    try { return parseOr(Trial, JSON.parse(line), "invalid-trial-log"); } catch (e) { throw e instanceof ExperimentError ? e : new ExperimentError("invalid-trial-log", path); }
  });
}

const git = (root: string, args: string[]) => execFileSync("git", args, { cwd: root, env: gitEnv(), encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "pipe"] });
function commitOf(root: string, ref: string): string {
  if (ref.startsWith("-")) throw new ExperimentError("bad-ref", ref);
  try { return git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]).trim(); } catch { throw new ExperimentError("unknown-commit", ref); }
}

export interface Change { path: string; status: string; newMode: string }

/** Everything the candidate changes against the baseline, with renames split into a delete and an add so both paths are checked. */
export function changedPaths(root: string, baseline: string, candidate: string): Change[] {
  const tokens = git(root, ["diff", "--raw", "-z", "--no-renames", "--no-abbrev", baseline, candidate]).split("\0");
  const out: Change[] = [];
  for (let i = 0; i + 1 < tokens.length; i += 2) {
    const [, newMode = "", , , status = ""] = tokens[i]!.slice(1).split(" "); // :oldmode newmode oldsha newsha status
    out.push({ path: tokens[i + 1]!, status, newMode });
  }
  return out;
}

/** Refuses the candidate unless it descends from the baseline and every change is a regular file inside the surface. */
export function checkDiff(root: string, m: Manifest, candidateRef: string): { candidate: string; changed: string[] } {
  const candidate = commitOf(root, candidateRef);
  commitOf(root, m.baseline);
  if (spawnSync("git", ["merge-base", "--is-ancestor", m.baseline, candidate], { cwd: root, env: gitEnv() }).status !== 0) {
    throw new ExperimentError("not-descended", "the candidate does not descend from the baseline");
  }
  const changes = changedPaths(root, m.baseline, candidate);
  for (const c of changes) {
    if (!plainPath(c.path) || !c.path.startsWith(ALLOWED_PREFIX)) throw new ExperimentError("outside-allowlist", c.path);
    if (c.path !== m.surface && !c.path.startsWith(`${m.surface}/`)) throw new ExperimentError("outside-surface", c.path);
    if (c.newMode === "120000" || c.newMode === "160000") throw new ExperimentError("non-regular-file", c.path);
  }
  return { candidate, changed: changes.map((c) => c.path) };
}

/** Bytes of the surface at a commit: the simpler-wins measure. */
export function surfaceBytes(root: string, ref: string, surface: string): number {
  return git(root, ["ls-tree", "-r", "-l", "-z", ref, "--", surface]).split("\0").filter(Boolean).reduce((sum, e) => sum + Number(/^\S+ blob \S+\s+(\d+)\t/.exec(e)?.[1] ?? 0), 0);
}

const counted = (ts: Trial[]) => ts.filter((t) => t.outcome !== "invalid");
const cellsDone = (m: Manifest, ts: Trial[], tasks: string[]) =>
  tasks.every((task) => ARMS.every((arm) => new Set(counted(ts).filter((t) => t.task === task && t.arm === arm).map((t) => t.repeat)).size === m.repeats));

/** Appends one trial. Holdout trials wait until every training cell is done, and nothing is recorded past the budget. */
export function recordTrial(manifestPath: string, input: unknown): Trial {
  const m = loadManifest(manifestPath), t = parseOr(Trial, input, "invalid-trial"), trials = loadTrials(manifestPath);
  if (m.disposition !== "pending") throw new ExperimentError("manifest-closed", m.disposition);
  if (![...m.training, ...m.holdout].includes(t.task)) throw new ExperimentError("unknown-task", t.task);
  if (t.repeat > m.repeats) throw new ExperimentError("repeat-out-of-range", `${t.repeat} > ${m.repeats}`);
  if (m.holdout.includes(t.task) && !cellsDone(m, trials, m.training)) throw new ExperimentError("holdout-before-training");
  if (t.outcome !== "invalid" && counted(trials).some((x) => x.task === t.task && x.arm === t.arm && x.repeat === t.repeat)) throw new ExperimentError("duplicate-trial", `${t.task} ${t.arm} ${t.repeat}`);
  const spent = trials.reduce((s, x) => s + (x.credits ?? 0), 0) + (t.credits ?? 0);
  if (trials.length + 1 > m.budget.maxTrials || spent > m.budget.maxCredits) throw new ExperimentError("budget-exhausted");
  appendFileSync(trialsPath(manifestPath), `${JSON.stringify(t)}\n`);
  return t;
}

export interface Split { passes: { baseline: number; candidate: number }; of: number }
export interface Decision {
  disposition: Manifest["disposition"]; reason: string; training: Split | null; holdout: Split | null;
  trials: number; invalid: number; credits: { known: number; unknownRuns: number };
}

const splitOf = (ts: Trial[], tasks: string[], repeats: number): Split => {
  const passes = (arm: string) => ts.filter((t) => t.arm === arm && t.outcome === "pass" && tasks.includes(t.task)).length;
  return { passes: { baseline: passes("baseline"), candidate: passes("candidate") }, of: tasks.length * repeats };
};

/**
 * PRD 6.10.1 disposition, from counts of passing runs. The holdout is read only after training is complete.
 * Training gain with a holdout loss is rejected; training gain with no holdout gain is not a demonstrated gain and keeps the
 * baseline; a tie on both splits goes to the smaller surface; anything incomplete is pending, or inconclusive once the budget is spent.
 */
export function decide(m: Manifest, trials: Trial[], sizes?: { baseline: number; candidate: number }): Decision {
  const base = { trials: trials.length, invalid: trials.length - counted(trials).length, credits: { known: trials.reduce((s, t) => s + (t.credits ?? 0), 0), unknownRuns: trials.filter((t) => t.credits === null).length } };
  const training = cellsDone(m, trials, m.training) ? splitOf(trials, m.training, m.repeats) : null;
  const holdout = training && cellsDone(m, trials, m.holdout) ? splitOf(trials, m.holdout, m.repeats) : null;
  const done = (disposition: Decision["disposition"], reason: string): Decision => ({ disposition, reason, training, holdout, ...base });
  if (!training || !holdout) {
    return trials.length >= m.budget.maxTrials ? done("keep-baseline", "inconclusive: the budget is spent before every cell finished")
      : done("pending", !training ? "training cells are incomplete" : "holdout cells are incomplete");
  }
  const t = Math.sign(training.passes.candidate - training.passes.baseline), h = Math.sign(holdout.passes.candidate - holdout.passes.baseline);
  if (t > 0 && h < 0) return done("rejected", "a training-only winner fails the holdout");
  if (t > 0 && h > 0) return done("keep-candidate", "gain on training and on the holdout");
  if (t > 0) return done("keep-baseline", "inconclusive: the training gain did not show on the holdout");
  if (t === 0 && h === 0) {
    if (!sizes) return done("keep-baseline", "tie, and no surface sizes were given for the simpler-wins rule");
    return sizes.candidate < sizes.baseline ? done("keep-candidate", "tie on both splits; the candidate surface is smaller") : done("keep-baseline", "tie on both splits; the candidate surface is not smaller");
  }
  return done("keep-baseline", "the candidate is worse than the baseline on a split");
}

export const manifestSchema = () => `${JSON.stringify(z.toJSONSchema(Manifest), null, 2)}\n`;
export const SCHEMA_PATH = "eval/experiments/manifest.schema.json";

const usage = (message: string): number => { console.error(message); return 2; };

function main(argv: string[]): number {
  const [command, path, ...rest] = argv;
  const flag = (name: string) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined; };
  const root = join(import.meta.dirname, "..");
  if (command === "schema") {
    if (path === "--write") writeFileSync(join(root, SCHEMA_PATH), manifestSchema()); else process.stdout.write(manifestSchema());
    return 0;
  }
  if (!["validate", "diff", "record", "decide"].includes(command ?? "") || !path) return usage("usage: node tools/experiment.ts validate|diff|record|decide <manifest> [--candidate <commit>] [--trial <json>] | schema [--write]");
  try {
    const m = loadManifest(path);
    commitOf(root, m.baseline);
    const candidate = flag("--candidate");
    let out: unknown;
    if (command === "validate") out = { valid: true, trials: loadTrials(path).length };
    else if (command === "diff") { if (!candidate) return usage("diff needs --candidate"); out = checkDiff(root, m, candidate); }
    else if (command === "record") { const raw = flag("--trial"); if (!raw) return usage("record needs --trial"); out = recordTrial(path, JSON.parse(raw)); }
    else {
      const sizes = candidate ? { baseline: surfaceBytes(root, m.baseline, m.surface), candidate: surfaceBytes(root, checkDiff(root, m, candidate).candidate, m.surface) } : undefined;
      out = decide(m, loadTrials(path), sizes);
    }
    console.log(JSON.stringify(out));
    return 0;
  } catch (e) {
    console.error(JSON.stringify({ error: e instanceof ExperimentError ? e.code : "failed", detail: e instanceof Error ? e.message : String(e) }));
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exitCode = main(process.argv.slice(2));
