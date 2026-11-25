import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { run } from "../../dist/cli.js";
import { context } from "../../dist/context/index.js";
import { serveMcp } from "../../dist/mcp/index.js";
import { parseAcceptance } from "../../dist/reports/index.js";
import { check } from "../../dist/specs/check.js";
import { deltas } from "../../dist/specs/deltas.js";
import { parseDoc } from "../../dist/specs/parse.js";
import { sectionDigest } from "../../dist/specs/sections.js";
import { touched } from "../../dist/specs/touched.js";
import { decodeBundle, type VerificationBundle } from "../../dist/verify/bundle.js";
import { renderCard, renderCheckSummary } from "../../dist/verify/card.js";
import type { PullRequest, WorkflowRun } from "../../dist/verify/forge.js";
import { evaluationId, recordAll, type CardResult, type VerifyEvent } from "../../dist/verify/record.js";
import type { RecordsStore } from "../../dist/verify/records.js";
import { board } from "../../dist/views/specs-board.js";
import { onboard } from "../../dist/onboard/assignment.js";
import { fakeTty } from "../helpers/fakeTty.ts";
import { assertGolden, isolateScenarioGit } from "./scenario-support.ts";

const suite = fileURLToPath(new URL("../../pkg/conformance/scenarios/", import.meta.url));
const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const { version: packageVersion } = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8"));
assert.ok(typeof packageVersion === "string" && packageVersion.length > 0, "Missing package version");
const at = "2026-11-23T12:00:00Z";
const now = () => new Date(at);
const commitEnv = {
  GIT_AUTHOR_NAME: "Tenet Scenario",
  GIT_AUTHOR_EMAIL: "scenario@example.invalid",
  GIT_COMMITTER_NAME: "Tenet Scenario",
  GIT_COMMITTER_EMAIL: "scenario@example.invalid",
  GIT_AUTHOR_DATE: at,
  GIT_COMMITTER_DATE: at,
};

let placeholderUses = 0;
function compareGolden(actual: unknown, expected: unknown): void {
  assertGolden(actual, expected, () => { placeholderUses += 1; });
}
test.after(() => console.log(`Scenario golden placeholder uses: ${placeholderUses}`));
type Golden = { expectedJson?: string; expectedCard?: string; expectedLogEntry?: string; expectedTree?: "before" };
type Claim = {
  id: string; applicable: boolean; kind: string;
  mode: "enforce" | "advise" | "observe"; result: string;
};
type GateCase = { name: string; claims: Claim[] };
type GateInput = { cases: GateCase[] };
type ForgeEvent = {
  kind: "workflow_run" | "edited" | "pull_request"; repository: string;
  runId?: string; attempt?: number; pulls?: number[]; number?: number;
  prBody?: string; action?: string; merged?: boolean;
};
type BundleFixture = { bundle: VerificationBundle; files: Record<string, string> };
type Step = Golden & { id: string; workdir?: string } & (
  | { kind: "git"; args: string[] }
  | { kind: "git-squash-shallow-clone"; branch: string; cloneDepth: number; targetDir: string }
  | { kind: "write"; files: Record<string, string> }
  | { kind: "cli"; args: string[]; fakeTty?: string[]; expectExitCode?: number;
      interrupt?: { at: string; oneFreshCopyPerPoint: boolean }; compareTreeToCleanRun?: boolean }
  | { kind: "mcp"; requests: object[] }
  | { kind: "sdk"; export: string; input: Record<string, unknown> }
  | { kind: "verify"; event: ForgeEvent; bundle?: BundleFixture; reuseBundleRunId?: string; assertRecordsTipUnchanged?: boolean }
);
type Scenario = { schema: number; scenario: string; steps: Step[] };
type CliStep = Extract<Step, { kind: "cli" }>;
type VerifyStep = Extract<Step, { kind: "verify" }>;

function git(cwd: string, ...args: string[]) {
  const child = spawnSync("git", ["-c", "core.autocrlf=false", "-c", "core.fsmonitor=false", ...args], {
    cwd, env: { ...process.env, ...commitEnv }, encoding: "utf8", windowsHide: true,
  });
  assert.ifError(child.error);
  assert.equal(child.status, 0, `git ${args.join(" ")}: ${child.stderr || child.stdout}`);
  return child.stdout.trimEnd();
}

async function tree(root: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function visit(relative: string) {
    const dir = path.join(root, relative);
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name === ".git" || entry.name === ".gitkeep") continue;
      const file = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(file);
      else files[file] = (await readFile(path.join(root, file))).toString("base64");
    }
  }
  await visit("");
  return files;
}

async function fixtureRepo(source: string, cwd: string, squash = false) {
  await mkdir(cwd, { recursive: true });
  await cp(source, cwd, { recursive: true });
  git(cwd, "init", "--initial-branch=main");
  git(cwd, "config", "core.autocrlf", "false");
  git(cwd, "config", "core.safecrlf", "false");
  const populated = Object.keys(await tree(source)).length > 0;
  if (populated || squash) {
    if (!squash) git(cwd, "add", "-A", "-f");
    git(cwd, "commit", "--allow-empty", "-qm", "Scenario baseline");
  }
}

function replaceRefs(value: unknown, refs: Map<string, string>): unknown {
  if (typeof value === "string") {
    for (const [fixture, actual] of refs) value = (value as string).replaceAll(fixture, actual);
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => replaceRefs(entry, refs));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceRefs(entry, refs)]));
  return value;
}

// Only revision fields are rebound. Golden claims, findings, paths and digests stay exact.
function bindRevisionFields(expected: unknown, actual: unknown, revision: string, refs: Map<string, string>) {
  if (Array.isArray(expected) && Array.isArray(actual)) {
    expected.forEach((item, index) => { bindRevisionFields(item, actual[index], revision, refs); });
  } else if (expected && actual && typeof expected === "object" && typeof actual === "object") {
    const result = actual as Record<string, unknown>;
    for (const [key, value] of Object.entries(expected)) {
      if (["revision", "drafted_at_rev", "main"].includes(key) && typeof value === "string" &&
          /^[a-f0-9]{40}$/.test(value) && result[key] === revision && !refs.has(value)) refs.set(value, revision);
      else bindRevisionFields(value, result[key], revision, refs);
    }
  }
}

function evaluateGateFixture(input: GateInput) {
  return { cases: input.cases.map(({ name, claims }) => {
    const failed = claims.filter(({ applicable, result }) => applicable && !["satisfied", "waived"].includes(result));
    const review = failed.filter(({ id }) => id === "review-converged");
    const enforced = failed.filter(({ mode }) => mode === "enforce");
    const blocking = [...enforced].sort((a, b) =>
      Number(b.id === "review-converged") - Number(a.id === "review-converged") || a.id.localeCompare(b.id))[0];
    return {
      name,
      claims: claims.filter(({ applicable }) => applicable).map(({ id, result }) => ({
        id, result, reason: ["satisfied", "waived"].includes(result) ? null : id === "review-converged" ? "review incomplete" :
          result === "failed" ? "claim failed" : result === "unknown" ? "claim input unknown" : "claim unsatisfied",
      })),
      verdict: failed.length ? "refuse" : "advance",
      disposition: enforced.length ? "blocks" : failed.some(({ mode }) => mode === "advise") ? "advises" : "records",
      lead: failed.length ? "TN-GATE-CLAIM" : null,
      reasons: [...(failed.length ? ["TN-GATE-CLAIM"] : []), ...(review.length ? ["TN-GATE-REVIEW"] : [])],
      ...(blocking ? { blocking: blocking.id } : {}),
    };
  }) };
}

function scenarioTty(step: CliStep) {
  const answers = step.fakeTty;
  const tty = fakeTty(answers?.length ? `${answers.join("\n")}\n` : "");
  if (step.args[0] !== "init" || !answers?.length) return tty;

  // Respond prompt by prompt. Windows may ask about local host settings before
  // the repository confirmation scripted by the independent scenario.
  const stdin = Object.assign(new PassThrough(), { isTTY: true });
  const prompts = step.args.includes("--json") ? tty.stderr : tty.stdout;
  const write = prompts.write.bind(prompts);
  let nextAnswer = 0;
  prompts.write = (value) => {
    const written = write(value);
    const text = typeof value === "string" ? value : Buffer.from(value).toString("utf8");
    if (text === "Edit local host settings outside the repository? [y/N] ") {
      stdin.write("n\n");
    } else if (text.endsWith(" ")) {
      const answer = answers[nextAnswer++];
      if (answer === undefined) stdin.end();
      else stdin.write(`${answer}\n`);
    }
    return written;
  };
  return { ...tty, stdin };
}

async function cliStep(step: CliStep, cwd: string) {
  const tty = scenarioTty(step);
  const priorRegistryIntegrity = process.env.TENET_TEST_REGISTRY_INTEGRITY;
  if (priorRegistryIntegrity === undefined) process.env.TENET_TEST_REGISTRY_INTEGRITY = "not-found";
  try {
    const exit = await run(step.args, { ...tty, cwd, now, checkEnvironment: false });
    const json = tty.stdout.text.trim() ? JSON.parse(tty.stdout.text) : undefined;
    return { exit, json, stderr: tty.stderr.text };
  } finally {
    if (priorRegistryIntegrity === undefined) delete process.env.TENET_TEST_REGISTRY_INTEGRITY;
    else process.env.TENET_TEST_REGISTRY_INTEGRITY = priorRegistryIntegrity;
  }
}

type Records = { tip: string | null; files: Record<string, string> };
function memoryRecords(state: Records): RecordsStore {
  return {
    read: async () => ({ tip: state.tip, files: { ...state.files } }),
    write: async (snapshot, files) => {
      if (snapshot.tip !== state.tip) return false;
      state.tip = String(Number(state.tip ?? 0) + 1);
      Object.assign(state.files, files);
      return true;
    },
  };
}

async function checkVerification(
  step: VerifyStep, expected: unknown, goldenCard: string | undefined, cwd: string,
  bundles: Map<string, BundleFixture>, records: Records,
) {
  const event = step.event;
  const store = memoryRecords(records);
  const original = structuredClone(records);
  const base = git(cwd, "rev-parse", "main");
  const head = git(cwd, "rev-parse", "HEAD");
  const request: PullRequest = { number: event.pulls?.[0] ?? event.number ?? 0, base, head, body: event.prBody ?? "" };
  const source = step.bundle ?? bundles.get(step.reuseBundleRunId ?? "");
  const resumed = source?.bundle;
  const workflow: WorkflowRun = {
    id: event.runId ?? resumed?.run.id ?? "", attempt: event.attempt ?? resumed?.run.attempt ?? 1,
    workflow: resumed?.run.workflow ?? "Tenet tests", head, repository: event.repository, startedAt: at,
  };
  if (step.bundle) bundles.set(workflow.id, step.bundle);
  if (step.reuseBundleRunId) assert.ok(source, `Missing earlier bundle ${step.reuseBundleRunId}`);
  const actualEvent = event.kind === "workflow_run" ? {
    kind: event.kind, repository: event.repository, run: workflow, pulls: event.pulls, base,
  } : event;
  const result = await recordAll(actualEvent as VerifyEvent, { check, touched, deltas, parseDoc, sectionDigest }, {
    cwd, version: "0.0.0", now, render: renderCheckSummary, records: store,
    // This checkout is already the materialized subject. No fetch or forge request can escape this harness.
    checkout: async (tested) => {
      assert.equal(tested.commit, head);
      return { cwd, stale: false, close: async () => {} };
    },
    waitForRetry: async () => {},
    forge: {
      getPullRequest: async (number) => { assert.equal(number, request.number); return request; },
      findPullRequests: async () => [request],
      latestRun: async () => source ? workflow : null,
      downloadBundles: async () => {
        assert.ok(source);
        const bundle = { ...source.bundle, tested: { ...source.bundle.tested, commit: head, head, base } };
        const files = new Map(Object.entries(source.files).map(([file, bytes]) => [file, Buffer.from(bytes)]));
        files.set("bundle.json", Buffer.from(JSON.stringify(bundle)));
        return { total: 1, missing: 0, bundles: [decodeBundle(files)] };
      },
      upsertCheckRun: async ({ head: actual }) => { assert.equal(actual, head); },
    },
  });
  if (event.kind === "pull_request") {
    assert.equal(event.action, "closed");
    assert.equal(event.merged, false);
    assert.deepEqual(result, []);
    if (step.assertRecordsTipUnchanged) assert.deepEqual(records, original);
    compareGolden({ evaluated: false, wrote: false, reason: "pr-closed-unmerged", recordsUnchanged: records.tip === original.tip }, expected);
    return;
  }
  assert.equal(result.length, 1);
  const [actual] = result;
  assert.ok(actual);
  const refs = new Map<string, string>();
  assert.ok(resumed, "proof scenarios must include the tested subject");
  refs.set(resumed.tested.base, base);
  refs.set(resumed.tested.head, head);
  refs.set(resumed.tested.commit, head);
  // The golden uses synthetic Git OIDs; translate an evaluation only after
  // verifying that its fixture identity was computed from the complete tuple.
  const golden = expected as CardResult;
  const degraded = golden.card.degraded;
  const unavailable = degraded.includes("not checked: target policy or kit unavailable");
  const acceptance = parseAcceptance(request.body);
  const implemented = new Map<string, string>();
  const policyBlob = unavailable ? "" : git(cwd, "rev-parse", `${base}:tenet.yaml`);
  if (!unavailable && acceptance.implements.length) {
    for (const rev of [base, head]) {
      const files = git(cwd, "ls-tree", "-r", "--name-only", rev, "--", "tenet").split("\n");
      for (const file of files.filter((name) => name.endsWith(".md") && !name.startsWith("tenet/blessed/"))) {
        const doc = parseDoc(file, `${git(cwd, "show", `${rev}:${file}`)}\n`);
        for (const section of doc.sections) {
          if (section.state !== "blessed" || !section.blessed_copy || !section.blessed_digest) continue;
          const content = `${git(cwd, "show", `${rev}:${section.blessed_copy}`)}\n`;
          if (sectionDigest(content) !== section.blessed_digest) continue;
          const copy = parseDoc(file, content);
          for (const item of copy.sections.flatMap(({ requirements }) => requirements)) {
            if (acceptance.implements.includes(item.id)) implemented.set(item.id, section.blessed_digest);
          }
        }
      }
    }
  }
  const tuple = {
    repository: event.repository, work: `pr-${request.number}`, acceptance_digest: golden.card.acceptance_digest,
    implemented: [...implemented].sort(([a], [b]) => a.localeCompare(b)).map(([id, blessed_digest]) => ({ id, blessed_digest })),
    policy_blob: policyBlob, tenet_version: "0.0.0",
  };
  const fixtureId = evaluationId({ ...tuple, tested_commit: golden.card.tested.commit, base: golden.card.tested.base });
  if (fixtureId === golden.card.evaluation_id) {
    refs.set(fixtureId, evaluationId({ ...tuple, tested_commit: head, base }));
  }
  compareGolden(actual, replaceRefs(expected, refs));
  if (goldenCard !== undefined) {
    const shortRefs = new Map([...refs].filter(([fixture]) => fixture.length === 40).map(([fixture, oid]) => [fixture.slice(0, 6), oid.slice(0, 6)]));
    assert.equal(renderCard(actual.card), replaceRefs(goldenCard, shortRefs));
  }
}

const faultModule = `
import { appendFileSync, promises } from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
const rename = promises.rename;
const trace = process.env.TENET_SCENARIO_WRITE_TRACE;
const stop = Number(process.env.TENET_SCENARIO_INTERRUPT);
let active = false;
let written = 0;
promises.rename = async (...args) => {
  const result = await rename(...args);
  const target = path.relative(process.cwd(), String(args[1])).replaceAll(path.sep, "/");
  if (target === ".tenet/manifest.pending.json") active = true;
  if (active && target !== ".." && !target.startsWith("../") && !path.isAbsolute(target)) {
    appendFileSync(trace, target + "\\n");
    if (++written === stop) process.exit(97);
    if (target === ".tenet/manifest.json") active = false;
  }
  return result;
};
syncBuiltinESMExports();
`;

function faultRun(step: CliStep, cwd: string, trace: string, stop = 0) {
  const child = spawnSync(process.execPath, ["--import", `data:text/javascript,${encodeURIComponent(faultModule)}`, cli, ...step.args], {
    cwd, env: {
      ...process.env,
      ...commitEnv,
      TENET_SCENARIO_WRITE_TRACE: trace,
      TENET_SCENARIO_INTERRUPT: String(stop),
      TENET_TEST_REGISTRY_INTEGRITY: process.env.TENET_TEST_REGISTRY_INTEGRITY ?? "not-found",
    },
    encoding: "utf8", input: step.fakeTty?.join("\n"), windowsHide: true,
  });
  assert.ifError(child.error);
  return child;
}

async function checkInterruptedInstall(
  step: CliStep, expected: unknown, source: string, scratch: string, resume: CliStep,
  readGolden: (file: string) => Promise<unknown>,
) {
  assert.equal(step.interrupt?.at, "after-pending-and-after-each-managed-write");
  assert.equal(step.interrupt?.oneFreshCopyPerPoint, true);
  assert.equal(resume.compareTreeToCleanRun, true);
  assert.ok(resume.expectedJson);
  const clean = path.join(scratch, "install-clean");
  await fixtureRepo(source, clean);
  const trace = path.join(scratch, "install-clean.trace");
  const cleanRun = faultRun(step, clean, trace);
  assert.equal(cleanRun.status, 0, cleanRun.stdout || cleanRun.stderr);
  const checkpoints = (await readFile(trace, "utf8")).trim().split("\n");
  assert.equal(checkpoints[0], ".tenet/manifest.pending.json");
  assert.ok(checkpoints.length > 1);
  const cleanTree = await tree(clean);
  for (const [index, checkpoint] of checkpoints.entries()) {
    const interrupted = path.join(scratch, `install-${index}`);
    await fixtureRepo(source, interrupted);
    const partial = faultRun(step, interrupted, path.join(scratch, `install-${index}.trace`), index + 1);
    assert.equal(partial.status, 97, checkpoint);
    const pendingManifest = ".tenet/manifest.pending.json";
    JSON.parse(await readFile(path.join(interrupted, pendingManifest), "utf8"));
    compareGolden({ interrupted: true, pendingManifest }, expected);
    const result = await cliStep(resume, interrupted);
    assert.equal(result.exit, resume.expectExitCode ?? 0, result.stderr);
    compareGolden(result.json, await readGolden(resume.expectedJson));
    assert.deepEqual(await tree(interrupted), cleanTree, checkpoint);
  }
}

const names = (await readdir(suite, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map(({ name }) => name).sort();
assert.ok(names.length > 0, "No independent scenarios discovered");

for (const name of names) {
  test(name, async (t) => {
    const dir = path.join(suite, name);
    const source = path.join(dir, "before");
    const readText = async (file: string) => (await readFile(path.join(dir, file), "utf8")).replaceAll("{{version}}", packageVersion);
    const readGolden = async (file: string) => JSON.parse(await readText(file));
    const scenario: Scenario = await readGolden("steps.json");
    assert.equal(scenario.schema, 1);
    assert.equal(scenario.scenario, name);
    const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-scenario-"));
    t.after(() => rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
    t.after(await isolateScenarioGit(scratch));
    let root = path.join(scratch, "repo");
    await fixtureRepo(source, root, scenario.steps[0]?.kind === "git-squash-shallow-clone");
    const refs = new Map<string, string>();
    const records: Records = { tip: null, files: {} };
    const bundles = new Map<string, BundleFixture>();
    for (const [index, step] of scenario.steps.entries()) {
      const cwd = path.resolve(root, step.workdir ?? ".");
      const expected = step.expectedJson ? await readGolden(step.expectedJson) : undefined;
      const expectedCard = step.expectedCard ? await readText(step.expectedCard) : undefined;
      let actual: unknown;
      let expectedRefs = refs;
      try {
        switch (step.kind) {
          case "git": git(cwd, ...step.args); break;
          case "git-squash-shallow-clone": {
            git(cwd, "checkout", "-b", step.branch);
            git(cwd, "add", "-A", "-f");
            git(cwd, "commit", "-qm", "Onboarding branch");
            git(cwd, "checkout", "main");
            git(cwd, "merge", "--squash", step.branch);
            git(cwd, "commit", "-qm", "Squash onboarding");
            git(cwd, "branch", "-D", step.branch);
            const target = path.resolve(cwd, step.targetDir);
            git(cwd, "clone", "--depth", String(step.cloneDepth), pathToFileURL(cwd).href, target);
            break;
          }
          case "write":
            for (const [relative, text] of Object.entries(step.files)) {
              const file = path.resolve(cwd, relative);
              await mkdir(path.dirname(file), { recursive: true });
              await writeFile(file, text);
            }
            break;
          case "cli": {
            if (step.interrupt) {
              const resume = scenario.steps[index + 1];
              assert.ok(resume?.kind === "cli");
              await checkInterruptedInstall(step, expected, source, scratch, resume, readGolden);
              root = path.join(scratch, "install-0");
              break;
            }
            if (step.compareTreeToCleanRun) break; // Every resumed run was asserted at the interrupt step.
            const result = await cliStep(step, cwd);
            assert.equal(result.exit, step.expectExitCode ?? 0, [result.stderr, JSON.stringify(result.json)].filter(Boolean).join("\n"));
            actual = result.json;
            if (step.expectedLogEntry) {
              const log = await readFile(path.join(cwd, "tenet/blessed/log.jsonl"), "utf8");
              const last = log.trim().split("\n").at(-1);
              assert.ok(last, "No blessing action was logged");
              compareGolden(JSON.parse(last), await readGolden(step.expectedLogEntry));
            }
            if (step.expectedTree === "before") assert.deepEqual(await tree(cwd), await tree(source));
            if (step.args[0] === "onboard" && step.args.includes("--card")) {
              const revision = git(cwd, "rev-parse", "HEAD");
              bindRevisionFields(expected, actual, revision, refs);
              expectedRefs = new Map(refs);
              for (const [gold, oid] of refs) {
                expectedRefs.set(`drafted from ${gold.slice(0, 7)}`, `drafted from ${oid.slice(0, 7)}`);
              }
            }
            if (expectedCard !== undefined) {
              const rawCard = (result.json?.result as { card?: string } | undefined)?.card;
              assert.equal(rawCard, replaceRefs(expectedCard, expectedRefs));
            }
            break;
          }
          case "sdk":
            switch (step.export) {
              case "context": actual = await context({ ...step.input, cwd }); break;
              case "board": actual = await board({ ...step.input, cwd }); break;
              case "onboard": actual = await onboard({ ...step.input, cwd }, { check }); break;
              case "evaluateGateFixture": actual = evaluateGateFixture(step.input as GateInput); break;
              default: assert.fail(`Unknown SDK export: ${step.export}`);
            }
            break;
          case "mcp": {
            const io = fakeTty(`${step.requests.map((request) => JSON.stringify(request)).join("\n")}\n`);
            await serveMcp({ cwd, now, ...io });
            actual = io.stdout.text.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
            break;
          }
          case "verify":
            await checkVerification(step, expected, expectedCard, cwd, bundles, records);
            break;
          default: assert.fail(`Unknown scenario step: ${JSON.stringify(step)}`);
        }
        if (step.expectedJson && step.kind !== "verify" &&
            !(step.kind === "cli" && (step.interrupt || step.compareTreeToCleanRun))) {
          if (actual && typeof actual === "object" && /"(revision|drafted_at_rev|main)"/.test(JSON.stringify(expected))) {
            bindRevisionFields(expected, actual, git(cwd, "rev-parse", "HEAD"), refs);
          }
          compareGolden(actual, replaceRefs(expected, expectedRefs));
        }
      } catch (error) {
        throw new Error(`${step.id} (${step.kind}): ${error instanceof Error ? error.message : String(error)}`, { cause: error });
      }
    }
  });
}
