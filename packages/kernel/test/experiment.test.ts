// tools/experiment.ts: the manifest, the allowlist, trial recording and the disposition rules (tech-spec 17.8, PRD 6.10.1).
// These show the tool's rules. They do not show that an experiment was completed, which is what ENG-08 requires, so no
// test here carries a requirement tag.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { ExperimentError, Manifest, SCHEMA_PATH, checkDiff, decide, loadManifest, loadTrials, manifestSchema, recordTrial, surfaceBytes } from "../../../tools/experiment.ts";
import type { Trial } from "../../../tools/experiment.ts";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";

const dirs: string[] = [];
const scratch = () => { const d = tmp("tenet-exp-"); dirs.push(d); return d; };
after(() => dirs.forEach(cleanup));

const base = (sha: string, over: object = {}) => ({
  hypothesis: "a shorter review rubric finds the same defects", surface: "plugin/skills/a", baseline: sha,
  training: ["t1", "t2"], holdout: ["h1"], repeats: 5, budget: { maxTrials: 100, maxCredits: 50 },
  stopRule: "stop at the trial budget", tieRule: "simpler wins", disposition: "pending", ...over,
});
const refused = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof ExperimentError && e.code === code, code);

/** A repository with one baseline commit holding a skill, a second skill, kernel source and a grader. */
function repo() {
  const root = scratch();
  initRepo(root);
  write(root, "plugin/skills/a/SKILL.md", "alpha rubric text that is long\n");
  write(root, "plugin/skills/b/SKILL.md", "beta\n");
  write(root, "packages/kernel/src/core/verdict.ts", "export const v = 1;\n");
  write(root, "eval/golden/t1/grade.mjs", "export default 1;\n");
  git(root, "add", "-A"); git(root, "commit", "-qm", "baseline");
  const baseline = git(root, "rev-parse", "HEAD");
  const candidate = (name: string, edit: (root: string) => void | false) => {
    git(root, "checkout", "-q", "-b", name, baseline);
    if (edit(root) !== false) git(root, "add", "-A");
    git(root, "commit", "-qm", name);
    const sha = git(root, "rev-parse", "HEAD");
    git(root, "checkout", "-q", "main");
    return sha;
  };
  return { root, baseline, candidate };
}

describe("experiment manifest", () => {
  const sha = "a".repeat(40);
  it("accepts a pre-registered manifest", () => assert.ok(Manifest.safeParse(base(sha)).success));
  it("refuses fewer than five repeats, another tie rule, an empty holdout and unknown fields", () => {
    for (const bad of [{ repeats: 4 }, { tieRule: "complex wins" }, { holdout: [] }, { extra: 1 }, { budget: { maxTrials: 100, maxCredits: 0 } }]) {
      assert.equal(Manifest.safeParse(base(sha, bad)).success, false, JSON.stringify(bad));
    }
  });
  it("refuses a task in both splits and a budget below tasks x arms x repeats", () => {
    assert.equal(Manifest.safeParse(base(sha, { holdout: ["t1"] })).success, false);
    assert.equal(Manifest.safeParse(base(sha, { budget: { maxTrials: 29, maxCredits: 50 } })).success, false);
    assert.ok(Manifest.safeParse(base(sha, { budget: { maxTrials: 30, maxCredits: 50 } })).success);
  });
  it("refuses a surface outside plugin/skills/, a path trick, and all skills at once", () => {
    for (const surface of ["packages/kernel/src", "plugin/kernel/tenet.mjs", "plugin/skills", "plugin/skills/", "plugin/skills/../kernel", "plugin\\skills\\a", "/plugin/skills/a", "plugin/skills//a"]) {
      assert.equal(Manifest.safeParse(base(sha, { surface })).success, false, surface);
    }
    assert.ok(Manifest.safeParse(base(sha, { surface: "plugin/skills/tenet-review/resources/security.md" })).success);
  });
  it("matches the committed JSON schema", () => {
    const committed = readFileSync(join(import.meta.dirname, "../../..", SCHEMA_PATH), "utf8").replace(/\r\n/g, "\n");
    assert.equal(committed, manifestSchema(), "run: node tools/experiment.ts schema --write");
  });
});

describe("experiment allowlist", () => {
  it("accepts a candidate that edits only its surface", () => {
    const r = repo();
    const c = r.candidate("ok", (root) => write(root, "plugin/skills/a/SKILL.md", "alpha\n"));
    const m = Manifest.parse(base(r.baseline));
    assert.deepEqual(checkDiff(r.root, m, c).changed, ["plugin/skills/a/SKILL.md"]);
    assert.ok(surfaceBytes(r.root, c, m.surface) < surfaceBytes(r.root, r.baseline, m.surface));
  });
  it("refuses kernel, grader and sibling-skill edits, each with its own code", () => {
    const r = repo(), m = Manifest.parse(base(r.baseline));
    refused(() => checkDiff(r.root, m, r.candidate("kernel", (root) => write(root, "packages/kernel/src/core/verdict.ts", "export const v = 2;\n"))), "outside-allowlist");
    refused(() => checkDiff(r.root, m, r.candidate("grader", (root) => write(root, "eval/golden/t1/grade.mjs", "export default 2;\n"))), "outside-allowlist");
    refused(() => checkDiff(r.root, m, r.candidate("sibling", (root) => write(root, "plugin/skills/b/SKILL.md", "beta2\n"))), "outside-surface");
    refused(() => checkDiff(r.root, m, r.candidate("mixed", (root) => { write(root, "plugin/skills/a/SKILL.md", "x\n"); write(root, "plugin/skills/b/SKILL.md", "y\n"); })), "outside-surface");
  });
  it("checks both paths of a rename, so a grader cannot be moved into the surface", () => {
    const r = repo(), m = Manifest.parse(base(r.baseline));
    const c = r.candidate("move", (root) => { git(root, "mv", "eval/golden/t1/grade.mjs", "plugin/skills/a/grade.mjs"); });
    refused(() => checkDiff(r.root, m, c), "outside-allowlist");
  });
  it("refuses a symlink inside the surface", () => {
    const r = repo(), m = Manifest.parse(base(r.baseline));
    const c = r.candidate("link", (root) => {
      const blob = spawnSync("git", ["hash-object", "-w", "--stdin"], { cwd: root, input: "../../../eval/golden", encoding: "utf8" }).stdout.trim();
      git(root, "update-index", "--add", "--cacheinfo", `120000,${blob},plugin/skills/a/link`);
      return false; // keep the index as is: the link is not in the working tree
    });
    refused(() => checkDiff(r.root, m, c), "non-regular-file");
  });
  it("refuses a candidate that does not descend from the baseline, an unknown commit and an option-like ref", () => {
    const r = repo(), m = Manifest.parse(base(r.baseline));
    git(r.root, "checkout", "-q", "--orphan", "other");
    git(r.root, "commit", "-q", "--allow-empty", "-m", "unrelated");
    const unrelated = git(r.root, "rev-parse", "HEAD");
    refused(() => checkDiff(r.root, m, unrelated), "not-descended");
    refused(() => checkDiff(r.root, m, "f".repeat(40)), "unknown-commit");
    refused(() => checkDiff(r.root, m, "--all"), "bad-ref");
  });
});

describe("experiment trials", () => {
  const setup = (over: object = {}) => {
    const root = scratch(), path = join(root, "exp.json");
    writeFileSync(path, JSON.stringify(base("a".repeat(40), over)));
    return path;
  };
  const trial = (task: string, arm: "baseline" | "candidate", repeat: number, outcome: Trial["outcome"] = "pass", credits: number | null = 1): Trial =>
    ({ task, arm, repeat, outcome, credits, durationMs: 10, host: "host 1", model: "model 1" });
  const cells = (path: string, tasks: string[]) => { for (const t of tasks) for (const arm of ["baseline", "candidate"] as const) for (let r = 1; r <= 5; r++) recordTrial(path, trial(t, arm, r)); };

  it("records each trial with its cost and reads them back", () => {
    const path = setup();
    recordTrial(path, trial("t1", "baseline", 1, "fail", null));
    assert.deepEqual(loadTrials(path).map((t) => [t.task, t.outcome, t.credits]), [["t1", "fail", null]]);
  });
  it("refuses unknown tasks, repeats beyond the count, duplicates, closed manifests and malformed trials", () => {
    const path = setup();
    refused(() => recordTrial(path, trial("zz", "baseline", 1)), "unknown-task");
    refused(() => recordTrial(path, trial("t1", "baseline", 6)), "repeat-out-of-range");
    refused(() => recordTrial(path, { ...trial("t1", "baseline", 1), extra: true }), "invalid-trial");
    recordTrial(path, trial("t1", "baseline", 1));
    refused(() => recordTrial(path, trial("t1", "baseline", 1)), "duplicate-trial");
    recordTrial(path, trial("t1", "baseline", 1, "invalid"));
    refused(() => recordTrial(setup({ disposition: "keep-baseline" }), trial("t1", "baseline", 1)), "manifest-closed");
  });
  it("holds the holdout back until every training cell is recorded", () => {
    const path = setup();
    refused(() => recordTrial(path, trial("h1", "baseline", 1)), "holdout-before-training");
    cells(path, ["t1"]);
    refused(() => recordTrial(path, trial("h1", "baseline", 1)), "holdout-before-training");
    cells(path, ["t2"]);
    recordTrial(path, trial("h1", "baseline", 1));
  });
  it("stops at the trial budget, invalid runs included, and at the credit budget", () => {
    const path = setup({ budget: { maxTrials: 30, maxCredits: 50 } });
    cells(path, ["t1", "t2", "h1"]);
    refused(() => recordTrial(path, trial("t1", "baseline", 1, "invalid")), "budget-exhausted");
    const credit = setup({ budget: { maxTrials: 100, maxCredits: 1.5 } });
    recordTrial(credit, trial("t1", "baseline", 1));
    refused(() => recordTrial(credit, trial("t1", "baseline", 2)), "budget-exhausted");
  });
  it("loads a manifest from disk and rejects a corrupt trial log", () => {
    const path = setup();
    assert.equal(loadManifest(path).repeats, 5);
    writeFileSync(path.replace(/\.json$/, ".trials.jsonl"), "{not json}\n");
    refused(() => loadTrials(path), "invalid-trial-log");
  });
});

describe("experiment disposition", () => {
  const m = Manifest.parse(base("a".repeat(40)));
  const fill = (tasks: string[], baselinePass: number, candidatePass: number): Trial[] =>
    tasks.flatMap((task) => (["baseline", "candidate"] as const).flatMap((arm) => Array.from({ length: 5 }, (_, i) => ({
      task, arm, repeat: i + 1, outcome: (i < (arm === "baseline" ? baselinePass : candidatePass) ? "pass" : "fail") as Trial["outcome"], credits: 1, durationMs: 1, host: "h", model: "m" }))));
  const run = (train: [number, number], hold: [number, number], sizes?: { baseline: number; candidate: number }) =>
    decide(m, [...fill(m.training, ...train), ...fill(m.holdout, ...hold)], sizes);

  it("keeps a gain that shows on training and on the holdout", () => assert.equal(run([2, 4], [1, 3]).disposition, "keep-candidate"));
  it("rejects a training-only winner that fails the holdout", () => assert.equal(run([2, 4], [3, 1]).disposition, "rejected"));
  it("keeps the baseline when the training gain does not show on the holdout", () => assert.equal(run([2, 4], [3, 3]).disposition, "keep-baseline"));
  it("keeps the baseline when the candidate is worse on either split", () => {
    assert.equal(run([4, 2], [3, 3]).disposition, "keep-baseline");
    assert.equal(run([3, 3], [4, 2]).disposition, "keep-baseline");
  });
  it("lets the simpler candidate win a tie on both splits, and only then", () => {
    assert.equal(run([3, 3], [3, 3], { baseline: 100, candidate: 60 }).disposition, "keep-candidate");
    assert.equal(run([3, 3], [3, 3], { baseline: 100, candidate: 100 }).disposition, "keep-baseline");
    assert.equal(run([3, 3], [3, 3]).disposition, "keep-baseline");
  });
  it("stays pending without a holdout result until training is complete, and never reads the holdout early", () => {
    const early = decide(m, [...fill(["t1"], 0, 5), ...fill(m.holdout, 0, 5)]);
    assert.equal(early.disposition, "pending");
    assert.equal(early.training, null);
    assert.equal(early.holdout, null);
    const trainingOnly = decide(m, fill(m.training, 1, 4));
    assert.equal(trainingOnly.disposition, "pending");
    assert.equal(trainingOnly.holdout, null);
  });
  it("calls it inconclusive and keeps the baseline when the budget is spent before every cell finished", () => {
    const tight = Manifest.parse(base("a".repeat(40), { budget: { maxTrials: 30, maxCredits: 50 } }));
    const d = decide(tight, fill(["t1", "t2"], 1, 4).concat(fill(["t1"], 1, 4).map((t) => ({ ...t, outcome: "invalid" as const }))));
    assert.equal(d.disposition, "keep-baseline");
    assert.match(d.reason, /inconclusive/);
  });
  it("leaves invalid runs out of the counts and reports cost, including runs with unknown cost", () => {
    const trials = [...fill(m.training, 2, 2), ...fill(m.holdout, 2, 2)].map((t, i) => (i === 0 ? { ...t, credits: null } : t));
    const d = decide(m, [...trials, { ...trials[1]!, outcome: "invalid" as const }]);
    assert.equal(d.invalid, 1);
    assert.equal(d.credits.unknownRuns, 1);
    assert.equal(d.training?.of, 10);
  });
});

describe("experiment command line", () => {
  const cli = (...args: string[]) => spawnSync(process.execPath, [join(import.meta.dirname, "../../../tools/experiment.ts"), ...args], { encoding: "utf8" });
  it("validates a manifest against this repository's baseline and refuses an unknown one", () => {
    const root = scratch(), path = join(root, "exp.json");
    const head = git(join(import.meta.dirname, "../../.."), "rev-parse", "HEAD");
    writeFileSync(path, JSON.stringify(base(head)));
    const ok = cli("validate", path);
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(JSON.parse(ok.stdout), { valid: true, trials: 0 });
    writeFileSync(path, JSON.stringify(base("b".repeat(40))));
    const bad = cli("validate", path);
    assert.equal(bad.status, 1);
    assert.equal(JSON.parse(bad.stderr).error, "unknown-commit");
    assert.equal(cli("nonsense").status, 2);
  });
});
