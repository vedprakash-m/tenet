// Offline validation of the public golden tasks (eval/golden/README.md, plan §7.5/RC6, PRD §6.4.1).
//
//   node tools/eval-validate.ts [--alpha]
//
// For every task folder it checks, with no network and no model: the manifest schema; that the seeded fixture fails its
// own check as declared and the clean control passes it; that the external grader reaches the declared verdict on every
// control (seed, clean and each trap), with exactly the declared checks failing; that grading twice gives identical
// bytes; and that no task file reaches for the network or a model. `--alpha` also requires the PRD §6.4.1 Alpha mix.
// This proves the fixtures and graders; it says nothing about how an agent behaves on them.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { Endpoint, Finding, PlanItem, WorkState } from "../packages/kernel/src/core/schemas.ts";

export const GOLDEN_DIR = resolve(import.meta.dirname, "../eval/golden");

export const CATEGORIES = ["starter-new-app", "brownfield-bug-fix", "brownfield-feature", "review", "misleading-success-trap", "interruption-resume"] as const;
/** PRD §6.4.1, Alpha column. */
export const ALPHA_MIX: Record<(typeof CATEGORIES)[number], number> = {
  "starter-new-app": 2, "brownfield-bug-fix": 2, "brownfield-feature": 2, review: 2, "misleading-success-trap": 1, "interruption-resume": 1,
};

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const Forbidden = z.discriminatedUnion("kind", [
  z.strictObject({ id, kind: z.literal("protected-modified"), paths: z.array(z.string()).min(1) }),
  z.strictObject({ id, kind: z.literal("scope-exceeded"), allow: z.array(z.string()) }),
  z.strictObject({ id, kind: z.literal("dirty-lost") }),
  z.strictObject({ id, kind: z.literal("history-rewritten") }),
  z.strictObject({ id, kind: z.literal("remote-effect") }),
  z.strictObject({ id, kind: z.literal("stash-used") }),
  z.strictObject({ id, kind: z.literal("dependency-added") }),
  z.strictObject({ id, kind: z.literal("false-success") }),
]);
const Control = z.strictObject({
  name: id, from: z.enum(["seed", "solution"]), overlay: z.string().optional(), state: z.string().nullable(),
  commit: z.union([z.literal("all"), z.array(z.string()).min(1)]).optional(),
  expect: z.strictObject({ fail: z.array(z.string()) }),
});
const Manifest = z.strictObject({
  schema: z.literal(1), id, reviewOnly: z.boolean().optional(), category: z.enum(CATEGORIES), title: z.string().min(10), request: z.string().min(40), seededFailure: z.string().min(40),
  check: z.strictObject({ command: z.array(z.string()).min(1), seedExpect: z.enum(["fail", "pass"]) }),
  expectedEndpoint: Endpoint,
  protected: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)),
  setup: z.strictObject({ dirty: z.array(z.strictObject({ path: z.string(), content: z.string(), marker: z.string().min(1).optional() })).optional() }),
  forbidden: z.array(Forbidden).min(1),
  controls: z.array(Control).min(2),
});
export type Manifest = z.infer<typeof Manifest>;

/** The part of `.tenet/state` a grader may read; each field is the kernel's own type. */
const EvidenceState = z.object({
  archive: z.array(z.object({ endpoint: Endpoint })),
  work: z.record(z.string(), z.object({ state: WorkState, findings: z.array(Finding).optional() })),
  project: z.object({ intent: z.object({ plan: z.array(PlanItem) }) }),
});

const NETWORK_OR_MODEL = [
  /\bfetch\s*\(/, /\bXMLHttpRequest\b/, /\bWebSocket\b/, /["']node:(http|https|http2|net|tls|dns|dgram)["']/, /\bhttps?:\/\//i,
  /\b(copilot|anthropic|openai|gpt-\d|claude)\b/i, /\bcurl\b|\bwget\b|\bnpm (install|ci)\b/,
];

export interface TaskReport { id: string; category: string; errors: string[] }
export interface Report { tasks: TaskReport[]; errors: string[] }

const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");
const ENV = { PATH: process.env.PATH ?? "", GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", LC_ALL: "C" };
// NODE_TEST_CONTEXT is deliberately absent: a nested `node --test` must report as a top-level run.
const run = (cmd: string, args: string[], cwd: string) => spawnSync(cmd, args, { cwd, encoding: "utf8", env: ENV, timeout: 120_000 });
const git = (cwd: string, ...args: string[]) => {
  const r = run("git", ["-c", "user.name=Eval", "-c", "user.email=eval@example.com", "-c", "commit.gpgsign=false", ...args], cwd);
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

function statePath(taskDir: string, ref: string): string {
  return ref.startsWith("lib:") ? join(GOLDEN_DIR, "lib", "states", `${ref.slice(4)}.json`) : join(taskDir, ref);
}

/** The workspace a control describes: the seed committed as the base, the human's uncommitted edits, then the control's own changes. */
function buildWorkdir(taskDir: string, task: Manifest, control: Manifest["controls"][number], root: string): { dir: string; base: string } {
  const dir = join(root, control.name);
  mkdirSync(dir, { recursive: true });
  cpSync(join(taskDir, "seed"), dir, { recursive: true });
  git(dir, "init", "-q", "-b", "main");
  git(dir, "add", "-A");
  git(dir, "commit", "-q", "-m", "base");
  const base = git(dir, "rev-parse", "HEAD");
  for (const { path, content } of task.setup.dirty ?? []) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  if (control.from === "solution") cpSync(join(taskDir, "solution"), dir, { recursive: true });
  if (control.overlay) cpSync(join(taskDir, control.overlay), dir, { recursive: true });
  if (control.commit === "all") { git(dir, "add", "-A"); git(dir, "commit", "-q", "-m", "work"); }
  else if (control.commit) { git(dir, "add", "--", ...control.commit); git(dir, "commit", "-q", "-m", "work"); }
  if (control.state) {
    mkdirSync(join(dir, ".tenet"), { recursive: true });
    cpSync(statePath(taskDir, control.state), join(dir, ".tenet", "state"));
  }
  return { dir, base };
}

function grade(taskDir: string, dir: string, base: string) {
  const r = run(process.execPath, [join(GOLDEN_DIR, "lib", "grade.mjs"), taskDir, dir, "--base", base], dir);
  let parsed: { pass: boolean; checks: Array<{ id: string; pass: boolean }> } | null = null;
  try { parsed = JSON.parse(r.stdout); } catch { /* reported by the caller */ }
  return { stdout: r.stdout, stderr: r.stderr, status: r.status, parsed };
}

export function validateTask(taskDir: string): TaskReport {
  const errors: string[] = [];
  const fail = (m: string) => errors.push(m);
  const folder = taskDir.split("/").at(-1)!;
  let manifest: Manifest;
  try { manifest = Manifest.parse(JSON.parse(readFileSync(join(taskDir, "task.json"), "utf8"))); }
  catch (e) { return { id: folder, category: "?", errors: [`task.json: ${e instanceof Error ? e.message.split("\n")[0] : String(e)}`] }; }
  if (manifest.id !== folder) fail(`id ${manifest.id} does not match folder ${folder}`);

  for (const p of ["seed", ...(manifest.reviewOnly ? [] : ["solution"]), "grader/acceptance.mjs"]) if (!existsSync(join(taskDir, p))) fail(`missing ${p}`);
  if (errors.length) return { id: manifest.id, category: manifest.category, errors };

  // Format rules.
  if (manifest.check.command[0] !== "node") fail("the project check must run with node");
  for (const [p, hash] of Object.entries(manifest.protected)) {
    const f = join(taskDir, "seed", p);
    if (!existsSync(f)) fail(`protected file ${p} is not in the seed`);
    else if (sha256(readFileSync(f, "utf8")) !== hash) fail(`protected hash for ${p} does not match the seed`);
  }
  const ids = manifest.forbidden.map((f) => f.id);
  if (new Set(ids).size !== ids.length) fail("forbidden ids are not unique");
  for (const f of manifest.forbidden) {
    if (f.kind === "protected-modified" && f.paths.some((p) => !(p in manifest.protected))) fail(`${f.id}: a path has no recorded hash`);
    if (f.kind === "dirty-lost" && !manifest.setup.dirty?.length) fail(`${f.id}: no setup.dirty to protect`);
  }
  const names = manifest.controls.map((c) => c.name);
  if (new Set(names).size !== names.length) fail("control names are not unique");
  const seed = manifest.controls.find((c) => c.name === "seed"), clean = manifest.controls.find((c) => c.name === "clean");
  if (!seed || seed.from !== "seed" || seed.expect.fail.length === 0) fail("a `seed` control from the seed that the grader fails is required");
  if (!clean || clean.from !== (manifest.reviewOnly ? "seed" : "solution") || clean.expect.fail.length !== 0 || !clean.state) fail("a passing `clean` control with a state is required (from the solution; from the unchanged seed for a review-only task)");
  for (const c of manifest.controls) {
    if (c.overlay && !existsSync(join(taskDir, c.overlay))) fail(`${c.name}: missing overlay ${c.overlay}`);
    if (c.state) {
      const f = statePath(taskDir, c.state);
      if (!existsSync(f)) fail(`${c.name}: missing state ${c.state}`);
      else { const r = EvidenceState.safeParse(JSON.parse(readFileSync(f, "utf8"))); if (!r.success) fail(`${c.name}: state ${c.state} is not valid kernel evidence: ${r.error.issues[0]?.message}`); }
    }
  }
  for (const { path } of manifest.setup.dirty ?? []) {
    const parts = path.split("/");
    if (/[\\:\0]/.test(path) || parts.some((part) => !part || part === "." || part === ".." || /[. ]$/.test(part))) {
      fail(`dirty path ${JSON.stringify(path)} must be a safe relative file path`);
      continue;
    }
    let target = join(taskDir, "seed");
    try {
      for (const [index, part] of ["", ...parts].entries()) {
        target = join(target, part);
        const entry = lstatSync(target, { throwIfNoEntry: false });
        if (!entry) break;
        if (entry.isSymbolicLink()) {
          fail(`dirty path ${JSON.stringify(path)} traverses a seed symlink`);
          break;
        }
        if (index < parts.length ? !entry.isDirectory() : !entry.isFile()) {
          fail(`dirty path ${JSON.stringify(path)} requires each seed parent to be a directory and an existing leaf to be a regular file`);
          break;
        }
      }
    } catch {
      fail(`dirty path ${JSON.stringify(path)} could not inspect the seed path`);
    }
  }
  if (errors.length) return { id: manifest.id, category: manifest.category, errors };

  // No network and no model in anything the task or the grader ships.
  for (const f of [...walk(taskDir), ...walk(join(GOLDEN_DIR, "lib")).filter((p) => !p.endsWith(".json"))]) {
    const text = readFileSync(f, "utf8");
    for (const re of NETWORK_OR_MODEL) {
      if (f.endsWith("task.json") && re.source.includes("claude")) continue; // the request may name the product it is about
      if (re.test(text)) fail(`${relative(GOLDEN_DIR, f)} matches ${re} (tasks run offline, with no model)`);
    }
  }
  if (readdirSync(join(taskDir, "seed"), { recursive: true }).some((f) => String(f).endsWith("acceptance.mjs"))) fail("the seed contains grader material");
  if (errors.length) return { id: manifest.id, category: manifest.category, errors };

  // Behavior: build every control, run the project check where it applies, and grade.
  const root = realpathSync(mkdtempSync(join(tmpdir(), "tenet-eval-")));
  try {
    for (const c of manifest.controls) {
      let built: { dir: string; base: string };
      try { built = buildWorkdir(taskDir, manifest, c, root); } catch (e) { fail(`${c.name}: could not build the workspace (${e instanceof Error ? e.message.split("\n")[0] : String(e)})`); continue; }
      const { dir, base } = built;
      if (c.name === "seed" || c.name === "clean") {
        const r = run(process.execPath, manifest.check.command.slice(1), dir);
        const want = c.name === "seed" ? manifest.check.seedExpect : "pass";
        if ((r.status === 0 ? "pass" : "fail") !== want) fail(`${c.name}: the project check ${r.status === 0 ? "passes" : "fails"}, declared ${want}`);
      }
      const a = grade(taskDir, dir, base), b = grade(taskDir, dir, base);
      if (!a.parsed) { fail(`${c.name}: the grader produced no verdict (${a.stderr.split("\n")[0]})`); continue; }
      if (a.stdout !== b.stdout) fail(`${c.name}: grading twice gave different results`);
      const failed = a.parsed.checks.filter((k) => !k.pass).map((k) => k.id).sort();
      const want = [...c.expect.fail].sort();
      if (JSON.stringify(failed) !== JSON.stringify(want)) fail(`${c.name}: failing checks [${failed}] differ from declared [${want}]`);
      if (a.parsed.pass !== (want.length === 0) || (a.status === 0) !== a.parsed.pass) fail(`${c.name}: verdict and exit code disagree with the declared outcome`);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
  return { id: manifest.id, category: manifest.category, errors };
}

export function validateAll(opts: { alpha?: boolean; dir?: string } = {}): Report {
  const dir = opts.dir ?? GOLDEN_DIR;
  const folders = readdirSync(dir).filter((f) => f !== "lib" && statSync(join(dir, f)).isDirectory()).sort();
  const tasks = folders.map((f) => validateTask(join(dir, f)));
  const errors: string[] = [];
  if (opts.alpha) {
    const counts = new Map<string, number>();
    for (const t of tasks) counts.set(t.category, (counts.get(t.category) ?? 0) + 1);
    for (const c of CATEGORIES) if ((counts.get(c) ?? 0) !== ALPHA_MIX[c]) errors.push(`category ${c}: ${counts.get(c) ?? 0} tasks, PRD §6.4.1 Alpha needs ${ALPHA_MIX[c]}`);
  }
  return { tasks, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  const report = validateAll({ alpha: process.argv.includes("--alpha") });
  let bad = report.errors.length;
  for (const t of report.tasks) {
    console.log(`${t.errors.length ? "FAIL" : "ok  "} ${t.id} (${t.category})`);
    for (const e of t.errors) console.log(`       ${e}`);
    bad += t.errors.length;
  }
  for (const e of report.errors) console.log(`FAIL ${e}`);
  console.log(bad ? `${bad} problem(s)` : `${report.tasks.length} golden task(s) valid`);
  process.exit(bad ? 1 : 0);
}
