import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { emptyState } from "../src/core/state.ts";
import {
  COVERAGE_EXT,
  CoverageState,
  bindRecipeCoverage,
  installRecipeCoverage,
  coverageEvidenceForReceipts,
  coveredCoverageEvidence,
  readCoverageState,
  recordCoverageReceipts,
  stickyCoverageReceipts,
} from "../src/core/alternative-check.ts";
import type { Receipt, WorkContract } from "../src/core/schemas.ts";
import { execute, runE2eAttempts } from "../src/verbs/check-execute.ts";
import { coverageStatus, e2eStatus } from "../src/verbs/check-execute.ts";
import type { Run } from "../src/verbs/check-evidence.ts";
import { receiptsOf } from "../src/verbs/check-evidence.ts";
import { checkInputId } from "../src/verbs/facts.ts";
import { gather } from "../src/verbs/facts.ts";
import { createStack } from "./support/metadata-stack.ts";
import { hashOf, sha256 } from "../src/core/ids.ts";
import { coverageDefinitionHash } from "../src/core/alternative-check.ts";
import { admitCoverageDefinitions } from "../src/verbs/check.ts";
import type { Ports } from "../src/ports/types.ts";
import { account } from "../src/verbs/check-account.ts";
import { contractFixture, project } from "./support/fixture.ts";
import type { RecipeCoverageRecord } from "../src/ports/types.ts";
import { handoffText } from "../src/core/handoff.ts";
import { cleanup } from "./helpers.ts";
import { toolchainOf } from "../src/verbs/check-rerun.ts";
import { FsRecipes } from "../src/adapters/recipes-fs.ts";

const hash = (char: string) => char.repeat(64);
const checkInput = (char: string) => char.repeat(24);
const STARTER_MODULES = process.env.TENET_STARTER_NODE_MODULES ?? join(
  import.meta.dirname,
  "../../../plugin/skills/tenet-starter-ts-web-api/template/node_modules",
);
const record = (id: string, n: string): RecipeCoverageRecord => ({
  id,
  obligation: `OB-${id}`,
  primary: { tool: "vitest", config: `coverage/${id}.vitest.ts`, file: `coverage/${id}.test.ts`, tag: `COV-${id}`, support: [] },
  alternative: { tool: "playwright", config: `coverage/${id}.playwright.ts`, file: `coverage/${id}.spec.ts`, tag: `COV-${id}`, support: [] },
  mappingHash: hash(n), reviewHash: hash(n === "a" ? "b" : "a"),
  primaryDefinitionHash: hash("c"), alternativeDefinitionHash: hash("d"),
  reviewReservation: `review-${id}`, reviewManifestHash: hash("e"),
});
const roots: string[] = [];
after(() => roots.forEach(cleanup));
const receipt = (obligation: string, over: Partial<Receipt> = {}): Receipt => ({
  id: `RC-${obligation}`, obligation, kind: "test", stage: "candidate", source: "kernel-run",
  checkInputId: checkInput("f"), scope: "full", argv: [], cwd: ".", durationMs: 1,
  versions: { tool: "tool", reporter: "json", adapter: "a" },
  provenance: { runId: "run", runDir: "dir", startedAt: "2026-11-18T00:00:00Z" },
  status: "pass", qualifiers: [], reasons: [], limitations: [], candidate: "candidate",
  ...over,
});

describe("recipe coverage state [AC-27]", () => {
  it("normalizes the shipped recipe's reviewed mapping before persisting it", () => {
    const recipe = new FsRecipes(join(import.meta.dirname, "../../../plugin")).load("ts-web-api")!;
    const state = installRecipeCoverage(emptyState("workspace", "tag"), recipe.coverage ?? []);
    const stored = CoverageState.parse(JSON.parse(JSON.stringify(state._ext![COVERAGE_EXT])));
    assert.equal(stored.recipe.mappings["signed-out-session"]?.reviewReservation, recipe.coverage![0]!.review.reservation);
  });

  it("records an empty first-pass history as attempt one", () => {
    const mapping = record("signed-out-session", "a");
    const state = bindRecipeCoverage(
      installRecipeCoverage(emptyState("workspace", "tag"), [mapping]),
      "W-0001", hash("f"), "2026-11-18T00:00:00Z",
    );
    const recorded = recordCoverageReceipts(
      state, "W-0001", hash("f"), [receipt(mapping.obligation, { history: [] })], 1, "2026-11-18T00:00:01Z",
    );
    assert.equal(Object.values(readCoverageState(recorded.state).results)[0]!.attempt, 1);
  });

  it("accepts generated production work IDs in coverage bindings", () => {
    const mapping = record("signed-out-session", "a");
    const state = bindRecipeCoverage(
      installRecipeCoverage(emptyState("workspace", "tag"), [mapping]),
      "wk_2kzhz7aovw", hash("f"), "2026-11-18T00:00:00Z",
    );
    assert.ok(readCoverageState(state).bindings["wk_2kzhz7aovw\u001fsigned-out-session"]);
  });

  it("preserves unrelated extensions and binds exact mapping evidence to the accepted basis", () => {
    const state = { ...emptyState("workspace", "tag"), _ext: { unrelated: { keep: true } } };
    const installed = installRecipeCoverage(state, [record("signed-out-session", "a")]);
    const bound = bindRecipeCoverage(
      installed, "W-0001", hash("f"), "2026-11-18T00:00:00Z",
    );
    assert.equal((bound._ext!.unrelated as { keep: boolean }).keep, true);
    const coverage = readCoverageState(bound);
    assert.equal(Object.keys(coverage.recipe.mappings).length, 1);
    assert.equal(coverage.bindings[`W-0001\u001fsigned-out-session`]!.basisHash, hash("f"));
  });

  it("refuses a ninth mapping and a 33rd binding without evicting records", () => {
    let state = emptyState("workspace", "tag");
    const mappings = "abcdefgh".split("").map((id) => record(id, id));
    assert.throws(() => installRecipeCoverage(state, [...mappings, record("ninth", "i")]), /at most 8 coverage mappings/);
    state = installRecipeCoverage(state, [mappings[0]!]);
    let bound = state;
    for (let index = 0; index < 32; index++) {
      bound = bindRecipeCoverage(bound, `W-${index}`, hash("f"), "2026-11-18T00:00:00Z");
    }
    assert.throws(
      () => bindRecipeCoverage(bound, "W-32", hash("f"), "2026-11-18T00:00:00Z"),
      /32 basis bindings/,
    );
    assert.equal(Object.keys(readCoverageState(bound).bindings).length, 32);
  });

  it("refuses malformed coverage extensions before they authorize a result", () => {
    const state = { ...emptyState("workspace", "tag"), _ext: { [COVERAGE_EXT]: { version: 1, recipe: {} } } };
    assert.throws(() => readCoverageState(state), /coverage state/);
  });

  it("refuses a path traversal injected into schema-1 coverage data", () => {
    const valid = installRecipeCoverage(emptyState("workspace", "tag"), [record("signed-out-session", "a")]);
    const value = structuredClone(readCoverageState(valid));
    value.recipe.mappings["signed-out-session"]!.primary.config = "../outside.ts";
    const tampered = { ...valid, _ext: { ...valid._ext, [COVERAGE_EXT]: value } };
    assert.throws(() => readCoverageState(tampered), /coverage state/);
  });

  it("requires matching published role records before deriving coverage evidence", () => {
    const mapping = record("signed-out-session", "a");
    let state = installRecipeCoverage(emptyState("workspace", "tag"), [mapping]);
    state = bindRecipeCoverage(state, "W-0001", hash("f"), "2026-11-18T00:00:00Z");
    const primary = receipt(mapping.obligation, {
      qualifiers: ["flaky"],
      history: [
        { status: "fail", failed: ["[COV-signed-out-session]"], at: "t1" },
        { status: "pass", failed: [], at: "t2" },
      ],
    });
    const alternative = receipt(`${mapping.obligation}-alternative`);
    assert.deepEqual(
      coverageEvidenceForReceipts(state, "W-0001", hash("f"), [primary, alternative]),
      { approval: [], evidence: [] },
    );
    state = recordCoverageReceipts(
      state, "W-0001", hash("f"), [primary, alternative], 1, "2026-11-18T00:00:01Z",
    ).state;
    const baseline = receipt(mapping.obligation, { id: "RC-baseline", stage: "baseline" });
    const admitted = coverageEvidenceForReceipts(
      state, "W-0001", hash("f"), [baseline, primary, alternative],
    );
    assert.equal(admitted.approval.length, 1);
    assert.equal(admitted.evidence[0]!.primaryReceipt, primary.id);
    const work = contractFixture({
      id: "W-0001",
      basis: { intentRevision: 1, elementIds: [], hash: hash("f"), traits: [] },
      receipts: [primary, alternative],
    });
    assert.match(
      handoffText({ ...state, work: { [work.id]: work } }, work),
      /Recorded coverage: OB-signed-out-session RC-OB-signed-out-session by RC-OB-signed-out-session-alternative/,
    );
    const evicted = coverageEvidenceForReceipts(state, "W-0001", hash("f"), [], primary.checkInputId);
    assert.equal(evicted.evidence.length, 1);
    assert.deepEqual(
      [evicted.evidence[0]!.primaryStatus, evicted.evidence[0]!.alternativeStatus],
      ["pass", "pass"],
    );
    assert.equal(
      coveredCoverageEvidence(
        [primary, { ...alternative, status: "fail" }],
        admitted.approval,
        admitted.evidence,
      ).length,
      0,
    );
    const stored = structuredClone(readCoverageState(state));
    const key = `W-0001\u001f${mapping.obligation}\u001f${checkInput("f")}\u001falternative`;
    stored.results[key]!.receipt = "other";
    const tampered = {
      ...state,
      _ext: { ...state._ext, [COVERAGE_EXT]: stored },
    };
    assert.deepEqual(
      coverageEvidenceForReceipts(tampered, "W-0001", hash("f"), [primary, alternative]),
      { approval: [], evidence: [] },
    );
    const rebound = bindRecipeCoverage(
      state, "W-0001", hash("1"), "2026-11-18T00:00:10Z",
    );
    const parsed = CoverageState.safeParse(rebound._ext![COVERAGE_EXT]);
    assert.equal(parsed.success, true, parsed.success ? "" : JSON.stringify(parsed.error.issues));
    assert.deepEqual(
      coverageEvidenceForReceipts(
        rebound, "W-0001", hash("1"), [primary, alternative], primary.checkInputId,
      ),
      { approval: [], evidence: [] },
    );

    const laterClean = receipt(mapping.obligation);
    const projected = stickyCoverageReceipts(state, "W-0001", hash("f"), [laterClean]);
    assert.deepEqual(projected[0]!.qualifiers, ["flaky"]);
    assert.match(projected[0]!.limitations.at(-1)!, /previously produced a flaky/);

    const conflict = recordCoverageReceipts(
      state, "W-0001", hash("f"),
      [{ ...primary, status: "fail", qualifiers: [] }, alternative],
      1, "2026-11-18T00:00:02Z",
    );
    assert.equal(conflict.receipts[0]!.status, "inconclusive");
    assert.deepEqual(readCoverageState(conflict.state).results, readCoverageState(state).results);
  });

  it("turns a 33rd role result inconclusive without evicting an older record", () => {
    const mapping = record("signed-out-session", "a");
    let state = bindRecipeCoverage(
      installRecipeCoverage(emptyState("workspace", "tag"), [mapping]),
      "W-0001",
      hash("f"),
      "2026-11-18T00:00:00Z",
    );
    const originalKeys: string[] = [];
    for (let index = 0; index < 32; index++) {
      const input = index.toString(16).padStart(24, "0");
      const primary = receipt(mapping.obligation, { id: `RC-${index}`, checkInputId: input });
      state = recordCoverageReceipts(
        state, "W-0001", hash("f"), [primary], index + 1, `2026-11-18T00:00:${String(index).padStart(2, "0")}Z`,
      ).state;
      originalKeys.push(`W-0001\u001f${mapping.obligation}\u001f${input}\u001fprimary`);
    }
    const overflow = receipt(mapping.obligation, { id: "RC-overflow", checkInputId: checkInput("9") });
    const recorded = recordCoverageReceipts(
      state, "W-0001", hash("f"), [overflow], 33, "2026-11-18T00:00:33Z",
    );
    assert.equal(recorded.receipts[0]!.status, "inconclusive");
    assert.ok(recorded.receipts[0]!.reasons.includes("evidence-inconclusive"));
    const results = readCoverageState(recorded.state).results;
    assert.equal(Object.keys(results).length, 32);
    for (const key of originalKeys) assert.ok(Object.hasOwn(results, key), key);
  });

  it("refuses live coverage config or test bytes that differ from the reviewed definition", () => {
    const mapping = record("signed-out-session", "a");
    const content = {
      [mapping.primary.config]: "a",
      [mapping.primary.file]: "b",
      [mapping.alternative.config]: "c",
      [mapping.alternative.file]: "d",
    };
    const primaryDefinitionHash = coverageDefinitionHash(
      mapping.primary, sha256(content[mapping.primary.config]!), sha256(content[mapping.primary.file]!),
    );
    const alternativeDefinitionHash = coverageDefinitionHash(
      mapping.alternative, sha256(content[mapping.alternative.config]!), sha256(content[mapping.alternative.file]!),
    );
    const reviewed = [{ ...mapping, primaryDefinitionHash, alternativeDefinitionHash }];
    const ports = {
      project: { hashes: (paths: string[]) => Object.fromEntries(paths.map((path) => [path, sha256(content[path]!) ])) },
    } as unknown as Ports;
    admitCoverageDefinitions(ports, reviewed);
    content[mapping.alternative.file] = "weakened";
    assert.throws(
      () => admitCoverageDefinitions(ports, reviewed),
      (error: any) => error.reasons?.[0]?.code === "evidence-inconclusive",
    );
  });

  it("includes the reviewed coverage binding in the check-input identity", () => {
    const stack = createStack();
    stack.fingerprint = () => ({
      node: "v24", tool: "vitest@5", reporter: "json", adapter: "a",
      static: {}, dependencies: "deps",
    });
    const ports = { root: "/project", stack } as unknown as Ports;
    const work = contractFixture({
      obligations: [{
        id: "OB-signed-out-session", kind: "test", category: "boundary",
        tool: "vitest", testFile: "coverage/test.ts", coverageTag: "COV-signed-out-session",
        coverageHash: hash("a"),
      }],
    });
    const changed = {
      ...work,
      obligations: work.obligations.map((obligation) => ({ ...obligation, coverageHash: hash("b") })),
    };
    assert.notEqual(
      checkInputId(ports, work, "candidate"),
      checkInputId(ports, changed, "candidate"),
    );
  });

  it("runs one alternative only after the dedicated primary fails then passes", async () => {
    const mapping = record("signed-out-session", "a");
    const stack = createStack();
    stack.fingerprint = () => ({
      node: "v24", tool: "vitest@5", reporter: "json", adapter: "node-ts@test",
      static: {}, dependencies: "deps",
    });
    stack.argv = () => ["main"];
    stack.coverageArgv = (_root, check) => [check.tool, check.config, check.file];
    const primaryFailure = JSON.stringify({
      testResults: [{
        name: mapping.primary.file,
        status: "failed",
        assertionResults: [{
          fullName: "[COV-signed-out-session] rejects stale session",
          status: "failed", failureMessages: ["AssertionError: first attempt"],
        }],
      }],
    });
    const primaryPass = JSON.stringify({
      testResults: [{
        name: mapping.primary.file,
        status: "passed",
        assertionResults: [{
          fullName: "[COV-signed-out-session] rejects stale session",
          status: "passed", failureMessages: [],
        }],
      }],
    });
    const alternativePass = JSON.stringify({
      suites: [{
        title: mapping.alternative.file, file: mapping.alternative.file, specs: [{
          title: "[COV-signed-out-session] rejects stale session", ok: true, tests: [{
            status: "expected", expectedStatus: "passed", results: [{ status: "passed", errors: [] }],
          }],
        }],
      }],
      stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
    });
    const calls: string[][] = [];
    let primary = 0;
    const runner = {
      allocatePort: async () => 32000,
      run: async (spec: { argv: string[] }) => {
        calls.push(spec.argv);
        if (spec.argv[0] === "main") {
          return {
            exit: 0, timedOut: false, durationMs: 1, stdout: "", stderr: "", startedAt: "t",
            report: JSON.stringify({ testResults: [] }),
          };
        }
        const raw = spec.argv[0] === "playwright"
          ? alternativePass
          : primary++ === 0 ? primaryFailure : primaryPass;
        return {
          exit: raw.includes("failed") || raw.includes('"unexpected":1') ? 1 : 0,
          timedOut: false, durationMs: 1, stdout: "", stderr: "", startedAt: "t", report: raw,
        };
      },
    };
    const inventory = {
      digest: "candidate", head: "head", branch: "main", state: "ok", entries: new Map(), status: [],
    };
    const obligation = {
      id: mapping.obligation, kind: "test" as const, category: "boundary" as const,
      tool: "vitest", testFile: mapping.primary.file, coverageTag: mapping.primary.tag,
    };
    const run = {
      ports: {
        root: "/project", stack, runner,
        git: { inventory: async () => inventory },
        rand: { base32: () => "token" },
      },
      w: { id: "W-1", obligations: [obligation] },
      executionEnvelope: {},
      runId: "run", runDir: "/run", stage: "candidate", baseline: false, scope: "full",
      toRun: [obligation], toExecute: "all", missing: [], id: hash("f"),
      toolchain: hashOf(stack.fingerprint("/project")),
      coverage: [mapping],
      facts: { candidate: "candidate", inv: inventory, att: { tenet: [], human: [], concurrent: [], mixed: [], unexplained: [], changed: [] } },
    } as unknown as Run;
    const result = await execute(run, []);
    assert.equal(result.coverage?.[mapping.id]!.primary.length, 2);
    assert.equal(result.coverage?.[mapping.id]!.alternative?.length, 1);
    assert.deepEqual(
      calls.filter((argv) => argv[0] !== "main").map((argv) => argv[0]),
      ["vitest", "vitest", "playwright"],
    );
    const accounted = account(
      run,
      contractFixture({ obligations: [obligation], lane: "standard" }),
      result,
      [
        receipt(obligation.id, { qualifiers: ["flaky"] }),
        receipt(`${obligation.id}-alternative`),
      ],
      false,
    );
    assert.equal(accounted.budget.checksLaunched, 3);
  });

  it("reruns a failed whole Playwright obligation once, then retains both attempts [AC-27]", async () => {
    const stack = createStack();
    stack.fingerprint = () => ({
      node: "v24", tool: "vitest@5", reporter: "json", adapter: "node-ts@test",
      static: { playwright: "1.64.1" }, dependencies: "deps",
    });
    stack.argv = () => ["main"];
    stack.e2eArgv = () => ["playwright", "global"];
    const failed = JSON.stringify({
      suites: [{ title: "global", file: "server/test/e2e/global.spec.ts", specs: [{
        title: "fails once", ok: false, tests: [{
          status: "unexpected", expectedStatus: "passed",
          results: [{ status: "failed", errors: [{ message: "AssertionError: first" }] }],
        }],
      }] }],
      stats: { expected: 0, skipped: 0, unexpected: 1, flaky: 0 },
    });
    const passed = JSON.stringify({
      suites: [{ title: "global", file: "server/test/e2e/global.spec.ts", specs: [{
        title: "fails once", ok: true, tests: [{
          status: "expected", expectedStatus: "passed", results: [{ status: "passed", errors: [] }],
        }],
      }] }],
      stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
    });
    let browser = 0;
    const runner = {
      allocatePort: async () => 32001 + browser,
      run: async (spec: { argv: string[] }) => {
        if (spec.argv[0] === "playwright") {
          browser++;
          if (browser === 1) {
            return {
              exit: 1, timedOut: false, durationMs: 1, stdout: "", stderr: "EADDRINUSE",
              startedAt: "t", report: null,
            };
          }
          const raw = browser === 2 ? failed : passed;
          return {
            exit: browser === 2 ? 1 : 0,
            timedOut: false, durationMs: 1, stdout: "", stderr: "", startedAt: "t", report: raw,
          };
        }
        const raw = JSON.stringify({ testResults: [] });
        return {
          exit: 0,
          timedOut: false, durationMs: 1, stdout: "", stderr: "", startedAt: "t", report: raw,
        };
      },
    };
    const inventory = {
      digest: "candidate", head: "head", branch: "main", state: "ok", entries: new Map(), status: [],
    };
    const obligation = {
      id: "OB-e2e", kind: "static" as const, category: "affected" as const, tool: "playwright",
    };
    const run = {
      ports: {
        root: "/project", stack, runner,
        git: { inventory: async () => inventory },
        rand: { base32: () => "token" },
      },
      w: { id: "W-1", obligations: [obligation] },
      executionEnvelope: {},
      runId: "e2e-run", runDir: "/run", stage: "candidate", baseline: false, scope: "full",
      toRun: [obligation], toExecute: "all", missing: [], id: hash("f"),
      toolchain: hashOf(stack.fingerprint("/project")), coverage: [],
      facts: { candidate: "candidate", inv: inventory, att: { tenet: [], human: [], concurrent: [], mixed: [], unexplained: [], changed: [] } },
    } as unknown as Run;
    const result = await execute(run, []);
    assert.equal((result as any).e2e?.[obligation.id].length, 2);
    assert.deepEqual((result as any).e2e?.[obligation.id].map((attempt: any) => attempt.launches), [2, 1]);
    const accounted = account(
      run, contractFixture({ obligations: [obligation], lane: "standard" }), result, [], false,
    );
    assert.equal(accounted.budget.checksLaunched, 3);
    const receipt = receiptsOf(run, { obligations: [obligation] } as WorkContract, result)
      .find((item) => item.obligation === obligation.id)!;
    assert.deepEqual(receipt.qualifiers, ["flaky"]);
    assert.deepEqual(receipt.history?.map((item) => item.status), ["fail", "pass"]);
  });

  it("does not rerun an exit/report contradiction or launch its alternative", () => {
    const mapping = record("signed-out-session", "a");
    const stack = createStack();
    const run = {
      ports: { root: "/project", stack },
      facts: { candidate: "candidate" },
    } as unknown as Run;
    const failure = JSON.stringify({
      testResults: [{
        name: mapping.primary.file, status: "failed",
        assertionResults: [{
          fullName: "[COV-signed-out-session] stale session", status: "failed",
          failureMessages: ["AssertionError: expected 401"],
        }],
      }],
    });
    const primary = {
      check: mapping.primary,
      report: "/run/primary.json",
      facts: {
        raw: failure, exit: 0, ran: true, timedOut: false, durationMs: 1,
        after: "candidate", startedAt: "t",
      },
    };
    assert.equal(coverageStatus(run, primary), "other");
    const browser = JSON.stringify({
      suites: [{ title: "global", file: "server/test/e2e/global.spec.ts", specs: [{
        title: "contradictory", ok: true, tests: [{
          status: "expected", expectedStatus: "passed", results: [{ status: "passed", errors: [] }],
        }],
      }] }],
      stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
    });
    assert.equal(e2eStatus(run, {
      report: "/run/playwright.json",
      facts: {
        raw: browser, exit: 1, ran: true, timedOut: false, durationMs: 1,
        after: "candidate", startedAt: "t",
      },
    }), "other");
  });

  it("reruns a real Playwright failure on the same owned database and report boundary",
    { skip: !existsSync(join(STARTER_MODULES, "@playwright", "test")) &&
      "the isolated starter dependency tree is not installed" }, async () => {
    const p = project();
    roots.push(p.root);
    rmSync(join(p.root, "node_modules"), { recursive: true, force: true });
    symlinkSync(STARTER_MODULES, join(p.root, "node_modules"), "junction");
    p.write("playwright.config.ts", `
      import { defineConfig } from "@playwright/test";
      export default defineConfig({
        testDir: "e2e", timeout: 10_000,
        outputDir: process.env.TMPDIR ? process.env.TMPDIR + "/playwright-output" : "test-results",
      });
    `);
    p.write("e2e/fail-once.spec.ts", `
      import { test, expect } from "@playwright/test";
      import { existsSync, writeFileSync } from "node:fs";
      import { join } from "node:path";
      test("fails once", () => {
        const marker = join(process.env.TMPDIR!, "p114-once");
        if (!existsSync(marker)) {
          writeFileSync(marker, "seen");
          expect(true).toBe(false);
        }
        expect(existsSync(marker)).toBe(true);
      });
    `);
    const ports = p.ports();
    const obligation = {
      id: "OB-e2e", kind: "static" as const, category: "affected" as const, tool: "playwright",
    };
    const work = contractFixture({ id: "W-0001", obligations: [obligation], git: {
      ...contractFixture().git, mode: "git",
    } });
    const facts = await gather(ports, work);
    const runDir = ports.store.tempDir(`p114-${process.pid}-${Date.now()}`);
    roots.push(runDir);
    const run = {
      ports, w: work, executionEnvelope: {},
      runId: "p114-real", runDir,
      stage: "candidate", baseline: false, scope: "full",
      toRun: [obligation], toExecute: "all", missing: [], id: checkInputId(ports, work, facts.candidate),
      toolchain: toolchainOf(ports), coverage: [], facts,
    } as unknown as Run;
    const attempts = await runE2eAttempts(run, []);
    assert.equal(attempts.length, 2, JSON.stringify(attempts));
    assert.equal(attempts[0]!.facts.exit, 1);
    assert.equal(attempts[1]!.facts.exit, 0);
    assert.equal(attempts[0]!.report.endsWith("playwright.json"), true);
    assert.match(attempts[1]!.report, /playwright-rerun-1\.json$/);
  });
});
