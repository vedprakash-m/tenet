import assert from "node:assert/strict";
import { test } from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";
import { buildVerify, emptyDeps } from "./build.ts";

buildVerify();
const { runChecks, bundleExisting } = await import("../../dist/verify/run-checks.js");
const { decodeBundle, mergeMatrix, readBundle } = await import("../../dist/verify/bundle.js");

const tested = { commit: "a".repeat(40), head: "a".repeat(40), base: "b".repeat(40), kind: "head" };
const run = { id: "41", attempt: 1, workflow: "Tenet tests", job: "test", index: 0 };
const policy = {
  level: "observe", specs: { id_prefix: "R" },
  checks: { unit: { setup: ["setup"], run: "tests", report: "go-test-json", report_from: "stdout" } },
};

test("test job runs setup first, captures report bytes after failure and bundles them", async () => {
  const repo = await tmpRepo("verify-bundle");
  try {
    const commands: string[] = [];
    const report = Buffer.from('{"Action":"pass","Test":"TestExample"}\n');
    const produced = await runChecks(policy, { cwd: repo.path, tested, run, repository: "test/project" }, {
      ...emptyDeps,
      execute: async (command: string) => {
        commands.push(command);
        return { exitCode: command === "setup" ? 0 : 7, stdout: command === "setup" ? Buffer.alloc(0) : report, timedOut: false };
      },
    });
    assert.deepEqual(commands, ["setup", "tests"]);
    assert.equal(produced.bundle.checks[0].exit_code, 7);
    assert.equal(produced.bundle.checks[0].outcome, "failure");
    assert.deepEqual(produced.files.get("reports/unit.json"), report);
    assert.deepEqual((await readBundle(repo.path + "/tenet-bundle")).bundle, produced.bundle);
    const forged = new Map(produced.files).set("reports/unit.json", Buffer.from("changed"));
    assert.throws(() => decodeBundle(forged), /digest/);
    assert.throws(() => decodeBundle(new Map(produced.files).set("../outside", report)), /unsafe/);
  } finally {
    await repo.cleanup();
  }
});

test("existing CI collects a missing report without running commands", async () => {
  const repo = await tmpRepo("verify-existing");
  try {
    const result = await bundleExisting(policy, { cwd: repo.path, tested, run, repository: "test/project", outcome: "success" }, {
      ...emptyDeps, execute: async () => assert.fail("no command"),
    });
    assert.equal(result.bundle.checks[0].outcome, "report-missing");
    assert.deepEqual([...result.files.keys()], ["bundle.json"]);
  } finally {
    await repo.cleanup();
  }
});

test("matrix merge keeps attempts and worst terminal status", () => {
  const report = (status: string, attempts: string[]) => ({
    runner: "junit", cases: [{ full_name: "case", status, attempts, tags: ["AB-1"] }], teardown_failed: false, inconclusive: false,
  });
  const result = mergeMatrix([report("pass", ["fail", "pass"]), report("skip", ["skip"])]);
  assert.deepEqual(result.cases, [{ full_name: "case", status: "skip", attempts: ["fail", "pass", "skip"], tags: ["AB-1"] }]);
});
