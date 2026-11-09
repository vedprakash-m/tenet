import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { checkDiff, decide, loadTrials, Manifest, recordTrial, surfaceBytes } from "./experiment.ts";
import { configureRepo, FIXTURES, generateFixture, gitEnv, type FixtureSpec } from "./bench-fixtures.ts";

const root = join(import.meta.dirname, "..");
const protocolPath = join(root, "eval/experiments/coordinator-intro-proxy.json");
const protocol = JSON.parse(readFileSync(protocolPath, "utf8"));
const manifest = Manifest.parse(protocol.manifest);
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const git = (cwd: string, args: string[]) => execFileSync("git", args, { cwd, env: gitEnv(), encoding: "utf8", maxBuffer: 1 << 24 }).trim();
const skillAt = (cwd: string, commit: string) => execFileSync("git", ["show", `${commit}:${manifest.surface}`], { cwd, env: gitEnv(), encoding: "utf8" });

export function skillFloors(baseline: string, candidate: string): boolean {
  const heading = "## Calling the kernel";
  const boundary = baseline.indexOf(heading);
  return boundary > 0 && candidate.indexOf(heading) > 0
    && baseline.slice(boundary) === candidate.slice(candidate.indexOf(heading))
    && baseline.slice(0, baseline.indexOf(protocol.candidate.from)) === candidate.slice(0, candidate.indexOf(protocol.candidate.to))
    && candidate.includes("The kernel (`tenet`) decides what is true")
    && candidate === baseline.replace(protocol.candidate.from, protocol.candidate.to)
    && candidate !== baseline;
}

const Evidence = z.object({
  skillCommit: z.string(), skillSha256: z.string(), skillBytes: z.number().int().positive(),
  fixtureHead: z.string(), command: z.tuple([z.literal("git"), z.literal("fsck"), z.literal("--strict")]),
  status: z.number().int().nullable(), signal: z.string().nullable(), stdout: z.string(), stderr: z.string(),
}).strict();

export function verifyExecution(raw: { status: number | null; stdout: string }, expected: { commit: string; hash: string; bytes: number; fixture: string }): z.infer<typeof Evidence> {
  if (raw.status !== 0) throw new Error("evaluator process did not succeed");
  const evidence = Evidence.parse(JSON.parse(raw.stdout));
  assert.equal(evidence.skillCommit, expected.commit);
  assert.equal(evidence.skillSha256, expected.hash);
  assert.equal(evidence.skillBytes, expected.bytes);
  assert.equal(evidence.fixtureHead, expected.fixture);
  return evidence;
}

function evaluate(fixture: string, repo: string, commit: string, registrationPath: string): void {
  const registration = JSON.parse(readFileSync(registrationPath, "utf8"));
  const baseline = skillAt(repo, registration.baseline), candidate = skillAt(repo, registration.candidate);
  assert.ok(skillFloors(baseline, candidate), "frozen skill floors failed");
  assert.ok(commit === registration.baseline || commit === registration.candidate, "unknown arm commit");
  const skill = skillAt(repo, commit);
  assert.equal(hash(skill), commit === registration.baseline ? registration.baselineHash : registration.candidateHash);
  const result = spawnSync("git", ["fsck", "--strict"], { cwd: fixture, env: gitEnv(), encoding: "utf8", timeout: 10_000, maxBuffer: 1 << 20 });
  console.log(JSON.stringify({
    skillCommit: commit, skillSha256: hash(skill), skillBytes: Buffer.byteLength(skill),
    fixtureHead: git(fixture, ["rev-parse", "HEAD"]), command: ["git", "fsck", "--strict"],
    status: result.status, signal: result.signal, stdout: result.stdout ?? "", stderr: (result.stderr ?? "") + (result.error?.message ?? ""),
  }));
}

export function runSkillExperiment(output: string): void {
  mkdirSync(output, { recursive: false });
  const scratch = mkdtempSync(join(tmpdir(), "tenet-skill-proxy-"));
  const start = performance.now();
  try {
    const repo = join(scratch, "arms");
    git(root, ["clone", "--quiet", "--no-hardlinks", "--no-checkout", root, repo]);
    configureRepo(repo);
    git(repo, ["checkout", "--quiet", "--detach", manifest.baseline]);
    const baseline = skillAt(repo, manifest.baseline), candidate = baseline.replace(protocol.candidate.from, protocol.candidate.to);
    assert.ok(skillFloors(baseline, candidate));
    writeFileSync(join(repo, ...manifest.surface.split("/")), candidate);
    git(repo, ["add", "--", manifest.surface]);
    git(repo, ["-c", "core.hooksPath=" + join(scratch, "no-hooks"), "commit", "--quiet", "-m", "Candidate coordinator introduction (proxy only)\n\nCo-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>"]);
    const candidateCommit = git(repo, ["rev-parse", "HEAD"]);
    checkDiff(repo, manifest, candidateCommit);
    git(repo, ["bundle", "create", join(output, "candidate.bundle"), `${manifest.baseline}..HEAD`]);
    const registration = {
      protocol, protocolHash: hash(readFileSync(protocolPath, "utf8")),
      evaluatorHash: hash(readFileSync(fileURLToPath(import.meta.url), "utf8")),
      baseline: manifest.baseline, candidate: candidateCommit,
      baselineHash: hash(baseline), candidateHash: hash(candidate),
      registeredAt: new Date().toISOString(),
      environment: { platform: process.platform, arch: process.arch, node: process.version, git: git(root, ["--version"]), model: "not used", modelCredits: 0, ciComputeCost: "unknown" },
    };
    const registrationPath = join(output, "registration.json"), manifestPath = join(output, "experiment.json");
    writeFileSync(registrationPath, JSON.stringify(registration, null, 2));
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    const rows: { trial: ReturnType<typeof recordTrial>; executionHash: string }[] = [];
    for (const task of [...manifest.training, ...manifest.holdout]) {
      if (manifest.holdout.includes(task) && rows.some(row => row.trial.outcome === "invalid")) break;
      const spec: FixtureSpec = protocol.fixtures[task];
      if (task in FIXTURES) assert.deepEqual(spec, FIXTURES[task as keyof typeof FIXTURES]);
      const fixture = join(scratch, task), facts = generateFixture(spec, fixture);
      for (const arm of ["baseline", "candidate"] as const) for (let repeat = 1; repeat <= manifest.repeats; repeat++) {
        if (performance.now() - start >= 600_000) throw new Error("experiment wall-clock budget exhausted; baseline retained");
        const commit = arm === "baseline" ? manifest.baseline : candidateCommit;
        const text = arm === "baseline" ? baseline : candidate, before = performance.now();
        const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--trial", fixture, repo, commit, registrationPath], { encoding: "utf8", timeout: 15_000, maxBuffer: 1 << 21 });
        const execution = { task, arm, repeat, durationMs: Math.round(performance.now() - before), status: result.status, signal: result.signal, stdout: result.stdout ?? "", stderr: result.stderr ?? "", error: result.error?.message ?? null };
        let outcome: "pass" | "fail" | "invalid" = "invalid", validationError: string | null = null;
        try {
          const evidence = verifyExecution(execution, { commit, hash: hash(text), bytes: Buffer.byteLength(text), fixture: facts.head });
          outcome = evidence.status === 0 && evidence.signal === null ? "pass" : evidence.status === null ? "invalid" : "fail";
        } catch (e) { validationError = e instanceof Error ? e.message : String(e); }
        const raw = JSON.stringify({ ...execution, validationError });
        appendFileSync(join(output, "executions.jsonl"), raw + "\n");
        const trial = recordTrial(manifestPath, { task, arm, repeat, outcome, credits: 0, durationMs: execution.durationMs, host: `deterministic proxy on ${process.platform}/${process.arch}`, model: "not used" });
        rows.push({ trial, executionHash: hash(raw) });
      }
    }
    assert.deepEqual(loadTrials(manifestPath), rows.map(row => row.trial));
    const rawLines = readFileSync(join(output, "executions.jsonl"), "utf8").trimEnd().split("\n");
    rows.forEach((row, i) => assert.equal(row.executionHash, hash(rawLines[i]!)));
    const sizes = { baseline: surfaceBytes(repo, manifest.baseline, manifest.surface), candidate: surfaceBytes(repo, candidateCommit, manifest.surface) };
    const toolDecision = decide(manifest, loadTrials(manifestPath), sizes);
    const qualityFloorsPassed = rows.length === manifest.budget.maxTrials && rows.every(row => row.trial.outcome === "pass");
    const proxyDecision = qualityFloorsPassed ? toolDecision : { ...toolDecision, disposition: "keep-baseline", reason: "inconclusive or failed frozen quality floors; no retries, holdout withheld after invalid training" };
    writeFileSync(join(output, "report.json"), JSON.stringify({
      registration, sizes, rows, toolDecision, qualityFloorsPassed, proxyDecision, deployed: "baseline",
      nativeDisposition: "inconclusive: structural integrity and bytes do not establish native skill quality",
    }, null, 2));
    console.log(JSON.stringify({ output: "local experiment artifacts", trials: rows.length, sizes, proxyDecision, deployed: "baseline", nativeEvidence: "not claimed" }));
    if (!qualityFloorsPassed) process.exitCode = 1;
  } finally { rmSync(scratch, { recursive: true, force: true }); }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === "--trial") evaluate(process.argv[3]!, process.argv[4]!, process.argv[5]!, process.argv[6]!);
  else {
    if (!process.argv[2]) throw new Error("usage: node tools/skill-experiment.ts <new local output directory>");
    runSkillExperiment(resolve(process.argv[2]));
  }
}
