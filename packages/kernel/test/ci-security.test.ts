// Tenet's own CI follows the security tiers of PRD 5.9.3. Only the untrusted tier exists so far; these checks keep it that way (ENG-10).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";

const dir = join(import.meta.dirname, "../../../.github/workflows");
const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ f, text: readFileSync(join(dir, f), "utf8"), doc: parse(readFileSync(join(dir, f), "utf8")) }));
const starterWorkflow = readFileSync(join(import.meta.dirname, "../../../plugin/skills/tenet-starter-ts-web-api/template/.github/workflows/ci.yml"), "utf8");

function assertPinnedActions(text: string): void {
  const doc: { jobs: Record<string, { steps: Array<{ uses?: string }> }> } = parse(text);
  for (const job of Object.values(doc.jobs)) {
    for (const step of job.steps) {
      if (step.uses && !step.uses.startsWith("./")) {
        assert.match(step.uses, /^[^@\s]+@[0-9a-f]{40}$/, "remote actions must use an immutable commit SHA");
      }
    }
  }
}

describe("workflows keep the untrusted tier untrusted [ENG-10]", () => {
  it("there is a workflow to check", () => assert.ok(workflows.length > 0));
  it("the starter CI install disables npm's implicit audit", () => assert.match(starterWorkflow, /npm ci --ignore-scripts --no-audit/));
  it("the starter pins every remote action to a commit [AC-28]", () => assertPinnedActions(starterWorkflow));
  it("provisions the starter's locked browser outside the shipped payload before supported-POSIX CI", () => {
    const steps = workflows.find(({ f }) => f === "untrusted.yml")!.doc.jobs.t1.steps;
    const commands: string[] = steps.map((step: { run?: string }) => step.run ?? "");
    const browser = commands.findIndex(command => command.includes("/@playwright/test/cli.js"));
    assert.ok(browser > commands.indexOf("npm ci --ignore-scripts --no-audit"), "browser tooling follows the locked workspace install");
    assert.ok(browser < commands.indexOf("npm run ci"), "a cold browser cache must work before real browser tests");
    const command = commands[browser]!;
    assert.match(command, /browser_tools="\$RUNNER_TEMP\/tenet-browser-tools"/);
    assert.ok(command.includes("plugin/skills/tenet-starter-ts-web-api/template/package.json"));
    assert.ok(command.includes("plugin/skills/tenet-starter-ts-web-api/template/package-lock.json"));
    assert.ok(command.includes('npm ci --prefix "$browser_tools" --ignore-scripts --no-audit'));
    assert.ok(command.includes('node "$browser_tools/node_modules/@playwright/test/cli.js" install --with-deps chromium'));
    assert.doesNotMatch(command, /\bnpx\b|npm exec\b/, "do not resolve a separate unpinned Playwright");
  });
  it("continuously checks Windows portability and minimum-runtime evaluation without claiming POSIX mutation support", () => {
    const workflow = workflows.find(({ f }) => f === "untrusted.yml")!.doc;
    const job = workflow.jobs["windows-portability"];
    assert.ok(job, "Windows portability needs an explicit CI job");
    assert.equal(job["runs-on"], "windows-latest");
    const versions = job.steps.filter((step: { uses?: string }) => step.uses?.startsWith("actions/setup-node@"))
      .map((step: { with: { "node-version": string | number } }) => String(step.with["node-version"]));
    assert.deepEqual(versions, ["24", "22.12.0"]);
    const commands: string[] = job.steps.map((step: { run?: string }) => step.run ?? "");
    assert.ok(commands.includes("npm run build"));
    assert.ok(commands.includes("npm run verify:payload"));
    assert.ok(commands.includes("npm run verify:reproducible"));
    assert.ok(commands.some(command => command.includes("packages\\kernel\\test\\reproducible-build.test.ts")));
    assert.ok(commands.some(command => command.includes('--test-name-pattern="automatic temp cleanup boundaries"')
      && command.includes("packages\\kernel\\test\\store-boundary.test.ts")));
    assert.ok(commands.some(command => command.includes("--experimental-strip-types --test")
      && command.includes("packages\\eval\\test\\protocol.test.ts") && command.includes("packages\\kernel\\test\\payload.test.ts")));
    assert.ok(!commands.includes("npm run ci"), "Windows focused checks do not replace full supported-POSIX CI");
    assert.deepEqual(workflow.jobs.t1.strategy.matrix.os, ["ubuntu-latest", "macos-latest"]);
  });
  it("rejects mutable action branches, tags and abbreviated commits", () => {
    for (const ref of ["main", "v4", "0123456", "${{ inputs.action_ref }}"]) {
      assert.throws(() => assertPinnedActions(`jobs:\n  test:\n    steps:\n      - uses: actions/checkout@${ref}\n`));
    }
    assertPinnedActions(`jobs:\n  test:\n    steps:\n      - uses: ./.github/actions/local\n`);
  });
  for (const { f, text, doc } of workflows) {
    it(`${f}: pins every remote action to a commit [AC-28]`, () => assertPinnedActions(text));
    it(`${f}: standard pull_request trigger, never a privileged one`, () => {
      const triggers = Object.keys(doc.on ?? {});
      assert.ok(triggers.includes("pull_request"));
      for (const banned of ["pull_request_target", "workflow_run", "issue_comment"]) assert.ok(!triggers.includes(banned), banned);
    });
    it(`${f}: a read-only token and no secrets`, () => {
      assert.deepEqual(doc.permissions, { contents: "read" });
      assert.doesNotMatch(text, /\$\{\{\s*secrets\./);
      for (const job of Object.values<any>(doc.jobs)) assert.equal(job.permissions, undefined, "a job does not widen the token");
    });
    it(`${f}: checkout keeps no credentials`, () => {
      for (const job of Object.values<any>(doc.jobs)) {
        for (const step of job.steps.filter((s: any) => /^actions\/checkout@/.test(s.uses ?? ""))) assert.equal(step.with?.["persist-credentials"], false);
      }
    });
    it(`${f}: installs only the locked dependencies, without install scripts`, () => {
      assert.doesNotMatch(text, /npm (install|i)\b/);
      assert.match(text, /npm ci --ignore-scripts --no-audit/);
    });
  }
});
