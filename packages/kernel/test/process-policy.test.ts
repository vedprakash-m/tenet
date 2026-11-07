import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import { versionProblems } from "../../../tools/semver.ts";
import { parse } from "yaml";

const root = join(import.meta.dirname, "../../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("release process", () => {
  it("rejects invalid, mismatched and regressing versions [LFC-01]", () => {
    for (const version of ["1", "v1.0.0", "01.0.0", "1.0.0-01", "1.0.0+"]) {
      assert.ok(versionProblems(version, version).length, version);
    }
    assert.ok(versionProblems("1.0.0", "1.0.1").length);
    assert.ok(versionProblems("1.0.0", "1.0.0", "1.0.1").length);
    assert.ok(versionProblems("1.0.0-alpha.2", "1.0.0-alpha.2", "1.0.0-alpha.10").length);
    for (const version of ["0.1.0-m0", "1.0.0", "1.2.3-beta.2+build.5"]) {
      assert.deepEqual(versionProblems(version, version), []);
    }
    assert.deepEqual(versionProblems("1.0.0", "1.0.0", "1.0.0-rc.1"), []);
    assert.deepEqual(versionProblems("1.0.0+new", "1.0.0+new", "1.0.0+old"), []);
  });

  it("publishes the OSS documents and supported-version policy [OSS-01]", () => {
    for (const path of ["LICENSE", "NOTICE", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md"]) assert.ok(read(path).length);
    assert.match(read("CODE_OF_CONDUCT.md"), /version 2\.1/);
    const security = read("SECURITY.md");
    assert.match(security, /https:\/\/github\.com\/vedprakash-m\/tenet\/security\/advisories\/new/);
    assert.match(security, /previous minor.*security fixes for 3 months/);
    assert.doesNotMatch(security, /PLACEHOLDER/);
  });

  it("requires a public solo review window and release-note disclosure [ENG-11]", () => {
    const template = read(".github/pull_request_template.md");
    assert.match(template, /72-hour/);
    assert.match(template, /no second-maintainer review occurred/);
    assert.match(read("tools/release-notes.ts"), /72-hour public window/);
  });

  it("keeps current-model claims unevaluated without a dated native run and schedules reminders [ENG-05]", () => {
    assert.match(read("docs/user/qualified-tuple.md"), /not yet evaluated with the current model/);
    assert.match(read("README.md"), /not yet evaluated with the current model/);
    const workflow = parse(read(".github/workflows/model-drift.yml"));
    assert.equal(workflow.on.schedule[0].cron, "0 12 1 * *");
    assert.ok("workflow_dispatch" in workflow.on);
    assert.deepEqual(workflow.permissions, { contents: "read", issues: "write" });
    const command = workflow.jobs.remind.steps[0].run;
    assert.match(command, /titles="\$\(gh issue list/);
    assert.match(command, /gh issue create/);
    assert.match(command, /This reminder neither runs a model nor qualifies a tuple/);
  });

  it("dispatches Linux UAT only after building the shipped bundle", () => {
    const workflow = parse(read(".github/workflows/posix-uat.yml"));
    assert.deepEqual(Object.keys(workflow.on), ["workflow_dispatch"]);
    const job = Object.values<{ steps: { run?: string }[] }>(workflow.jobs)[0]!;
    const commands = job.steps.map(step => step.run);
    assert.ok(commands.indexOf("npm run build") < commands.indexOf("npm run uat"));
    assert.ok(commands.includes("npm run uat"));
  });

  it("gates actual frozen fixtures and starter peak RSS without ignoring failures", () => {
    const text = read(".github/workflows/system-budgets.yml");
    assert.match(text, /node tools\/bench\.ts --fixture all --json/);
    assert.match(text, /node tools\/starter-memory\.ts/);
    assert.doesNotMatch(text, /continue-on-error|\|\| true/);
    assert.match(read("specs/PRD.md"), /400 MB server peak RSS/);
  });
});
