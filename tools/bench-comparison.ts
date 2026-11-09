import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cpus, loadavg, release, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUDGETS, measureFixture, measuredRows } from "./bench.ts";
import type { Row } from "./bench.ts";
import { FIXTURES } from "./bench-fixtures.ts";
import type { FixtureName } from "./bench-fixtures.ts";

type Arm = "baseline" | "candidate";
type Attempt = { fixture: FixtureName; arm: Arm; repeat: number };
const COMMITS = {
  baseline: "fe475fbb26cd5690a35f33acbb2371c902f3dc58",
  candidate: "d036eefb889539b14f3cc367982016f89dd63270",
};
const IDS = ["bookkeeping-cold", "bookkeeping-warm", "resume", "tenet-storage"];
export const PLAN: Attempt[] = Array.from({ length: 5 }, (_, index) =>
  (["large", "long-history"] as const).flatMap(fixture =>
    (index % 2 ? ["candidate", "baseline"] as const : ["baseline", "candidate"] as const)
      .map(arm => ({ fixture, arm, repeat: index + 1 })))).flat();

export function summarize(results: Array<{ attempt: Attempt; rows: Row[] }>): { complete: boolean; failures: number; exit: 0 | 1 } {
  const same = (a: Attempt, b: Attempt) => a.fixture === b.fixture && a.arm === b.arm && a.repeat === b.repeat;
  const complete = results.length === PLAN.length && PLAN.every(p => results.filter(r => same(p, r.attempt)).length === 1)
    && results.every(r => r.rows.map(row => row.id).sort().join() === IDS.join()
      && r.rows.every(row => row.fixture === r.attempt.fixture && ["pass", "fail", "inconclusive"].includes(row.status)));
  const failures = results.flatMap(r => r.rows).filter(row => row.status === "fail" || row.status === "inconclusive").length;
  return { complete, failures, exit: complete && failures === 0 ? 0 : 1 };
}

const hash = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");
const write = (path: string, value: unknown) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
const snapshot = () => ({
  at: new Date().toISOString(), loadAverage: loadavg(),
  cpuTicks: readFileSync("/proc/stat", "utf8").split("\n")[0],
});

export function runComparison(output: string, roots: Record<Arm, string>): 0 | 1 {
  if (process.platform !== "linux") throw new Error("Paired budget diagnostics require actual Linux; no trials ran.");
  mkdirSync(output);
  const arms = (["baseline", "candidate"] as const).map(arm => {
    if (git(roots[arm], ["rev-parse", "HEAD"]) !== COMMITS[arm]) throw new Error(`${arm} source commit is not the frozen identity`);
    git(roots[arm], ["diff", "--exit-code", "HEAD", "--"]);
    const bundle = join(output, `${arm}.mjs`);
    copyFileSync(join(roots[arm], "plugin", "kernel", "tenet.mjs"), bundle);
    const sha256 = hash(bundle);
    if (arm === "candidate" && sha256 !== "5376599c1e59b6e5095a769e51b92e3a5670dcf414a4e5d37e6e3b8e6526ace9")
      throw new Error("Candidate bundle differs from the retained failing/passing measurements");
    return { arm, commit: COMMITS[arm], bundle, sha256, bytes: readFileSync(bundle).length };
  });
  const sources = ["bench-comparison.ts", "bench.ts", "bench-fixtures.ts"].map(name => {
    const path = join(output, name);
    copyFileSync(join(import.meta.dirname, name), path);
    return { name, sha256: hash(path) };
  });
  const manifest = {
    sourceCommit: git(join(import.meta.dirname, ".."), ["rev-parse", "HEAD"]), arms, sources, plan: PLAN,
    fixtures: FIXTURES, budgets: BUDGETS.filter(b => IDS.includes(b.id)),
    method: "Unchanged measureFixture defaults and measuredRows; all outcomes retained, no retries or qualification.",
    environment: { platform: process.platform, release: release(), node: process.version, git: git(roots.baseline, ["--version"]),
      cpu: cpus()[0]?.model ?? "unknown", cores: cpus().length, memoryBytes: totalmem() },
    model: "not used", modelCredits: 0, computeCost: "unknown; actual elapsed time is recorded per attempt",
  };
  const manifestPath = join(output, "manifest.json");
  write(manifestPath, manifest);
  const manifestHash = hash(manifestPath), results: Array<{ attempt: Attempt; rows: Row[]; file: string; sha256: string }> = [];
  write(join(output, "summary.json"), { ...summarize(results), results });
  for (const [index, attempt] of PLAN.entries()) {
    const arm = arms.find(a => a.arm === attempt.arm)!;
    if (hash(arm.bundle) !== arm.sha256) throw new Error("Registered bundle bytes changed before a trial");
    const file = `${String(index + 1).padStart(2, "0")}-${attempt.arm}-${attempt.fixture}.json`;
    const before = snapshot(), started = performance.now();
    write(join(output, `${file}.started.json`), { attempt, manifestHash, before });
    const scratch = mkdtempSync(join(tmpdir(), "tenet-budget-pair-"));
    try {
      const measured = measureFixture(arm.bundle, attempt.fixture, FIXTURES[attempt.fixture], scratch);
      const rows = measuredRows(attempt.fixture, measured), after = snapshot(), elapsedMs = performance.now() - started;
      if (hash(arm.bundle) !== arm.sha256) throw new Error("Registered bundle bytes changed during a trial");
      write(join(output, file), { attempt, manifestHash, before, after, elapsedMs,
        fixtureHead: git(join(scratch, `${attempt.fixture}-source`), ["rev-parse", "HEAD"]), measured, rows });
      results.push({ attempt, rows, file, sha256: hash(join(output, file)) });
      write(join(output, "summary.json"), { ...summarize(results), results });
      console.log(JSON.stringify({ attempt, elapsedMs, rows }));
    } finally { rmSync(scratch, { recursive: true, force: true }); }
  }
  return summarize(results).exit;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [output, baseline, candidate] = process.argv.slice(2);
  if (!output || !baseline || !candidate || process.argv.length !== 5) {
    console.error("usage: node tools/bench-comparison.ts <new-output-dir> <baseline-repo> <candidate-repo>");
    process.exit(2);
  }
  process.exit(runComparison(output, { baseline, candidate }));
}
