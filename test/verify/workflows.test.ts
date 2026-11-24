import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { parse } from "yaml";

const get = (name: string) => readFileSync(`kit/workflows/${name}.yml`, "utf8");

test("workflow templates keep the producer read-only, record from the default branch, and install by the target digest", () => {
  const producer = parse(get("tenet-tests"));
  const recorder = parse(get("tenet"));
  const existing = parse(get("existing-ci-step"));
  assert.deepEqual(producer.permissions, { contents: "read" });
  assert.deepEqual(recorder.permissions, { contents: "write", checks: "write", "pull-requests": "read", actions: "read" });
  assert.equal(recorder.jobs.record.steps[0].with.ref, `\${{ github.event.repository.default_branch }}`);
  assert.deepEqual(recorder.on.pull_request_target.types, ["edited"]);
  assert.equal(existing[2].env.TENET_TEST_OUTCOME, `\${{ steps.<id>.outcome }}`);
  assert.match(existing.at(-1).with.name, /strategy\.job-index/);
  for (const steps of [producer.jobs.test.steps, recorder.jobs.record.steps, existing]) {
    for (const step of steps) {
      if (step.uses) assert.match(step.uses, /^actions\/[a-z-]+@[0-9a-f]{40}$/);
      if (step.run) assert.ok(!step.run.includes("${{ github.event."));
    }
    const installer = steps.find((step: { name?: string }) => step.name === "Install Tenet from the target lock").run;
    assert.match(installer, /createHash\("sha512"\)/);
    assert.match(installer, /actual !== lock.integrity/);
    assert.ok(installer.indexOf("actual !== lock.integrity") < installer.indexOf('npm("install"'));
    const code = installer.split("\n").slice(1, -2).join("\n");
    const checked = spawnSync(process.execPath, ["--input-type=module", "--check"], { input: code, encoding: "utf8" });
    assert.equal(checked.status, 0, checked.stderr);
  }
});

test("verify is registered with mutually exclusive flags and reads only the CI event for recorder input", async () => {
  const { run } = await import("../../dist/cli.js");
  const { recorderEvent } = await import("../../dist/commands/verify.js");
  const writes: string[] = [];
  const exit = await run(["--json", "verify", "--bundle", "--record"], {
    stdout: { write: (chunk: string) => writes.push(chunk) }, checkEnvironment: false,
  });
  assert.equal(exit, 2);
  assert.match(JSON.parse(writes.join("")).errors[0].message, /choose exactly one/);
  assert.deepEqual(recorderEvent({ action: "edited", repository: { full_name: "fixture/project" }, number: 3 },
    { GITHUB_REPOSITORY: "fixture/project", GITHUB_EVENT_NAME: "pull_request_target" }),
  { kind: "edited", repository: "fixture/project", number: 3 });
  assert.throws(() => recorderEvent({ repository: { full_name: "elsewhere/project" } },
    { GITHUB_REPOSITORY: "fixture/project" }), /repository differs/);
});
