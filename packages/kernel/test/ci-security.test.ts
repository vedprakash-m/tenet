// Tenet's own CI follows the security tiers of PRD 5.9.3 and proves its required execution population.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";

const root = join(import.meta.dirname, "../../..");
const dir = join(root, ".github/workflows");
const workflows = readdirSync(dir).filter((file) => /\.ya?ml$/.test(file)).map((file) => ({
  file, text: readFileSync(join(dir, file), "utf8"), doc: parse(readFileSync(join(dir, file), "utf8")),
}));
const starterWorkflow = readFileSync(join(root, "plugin/skills/tenet-starter-ts-web-api/template/.github/workflows/ci.yml"), "utf8");
const untrusted = workflows.find(({ file }) => file === "untrusted.yml")!;
const commands = (job: string): string[] => untrusted.doc.jobs[job].steps.map((step: { run?: string }) => step.run ?? "");

function assertPinnedActions(text: string): void {
  const doc: { jobs: Record<string, { steps: Array<{ uses?: string }> }> } = parse(text);
  for (const job of Object.values(doc.jobs)) {
    for (const step of job.steps) {
      if (step.uses && !step.uses.startsWith("./")) assert.match(step.uses, /^[^@\s]+@[0-9a-f]{40}$/);
    }
  }
}

describe("untrusted validation keeps its trust boundary [ENG-10]", () => {
  it("uses a fork-safe PR event and exact-main pushes only", () => {
    assert.equal("pull_request" in untrusted.doc.on, true);
    assert.deepEqual(untrusted.doc.on.push.branches, ["main"]);
    for (const banned of ["pull_request_target", "workflow_run", "issue_comment"]) assert.equal(banned in untrusted.doc.on, false);
  });

  it("keeps a read-only token, no secrets, no checkout credentials and only pinned actions", () => {
    assert.deepEqual(untrusted.doc.permissions, { contents: "read" });
    assert.doesNotMatch(untrusted.text, /\$\{\{\s*secrets\./);
    for (const job of Object.values<any>(untrusted.doc.jobs)) {
      assert.equal(job.permissions, undefined);
      for (const step of job.steps.filter((item: any) => /^actions\/checkout@/.test(item.uses ?? ""))) {
        assert.equal(step.with?.["persist-credentials"], false);
      }
    }
    assertPinnedActions(untrusted.text);
  });

  it("has preflight, source, built-UAT, Windows and exact aggregate jobs", () => {
    const names = Object.keys(untrusted.doc.jobs);
    for (const job of ["preflight", "source", "bundle-uat", "windows-portability", "tenet-validation"]) assert.ok(names.includes(job), job);
    const aggregate = untrusted.doc.jobs["tenet-validation"];
    assert.equal(aggregate.if, "always()");
    assert.deepEqual(aggregate.needs, ["preflight", "source", "bundle-uat", "windows-portability"]);
    assert.match(commands("tenet-validation").join("\n"), /test "\$SOURCE" = success/);
    assert.match(commands("tenet-validation").join("\n"), /verify-execution\.ts --lane source/);
    assert.ok(aggregate.steps.some((step: { with?: { pattern?: string } }) => step.with?.pattern === "source-*"));
  });

  it("does exact structural, type, privacy and population preflight work once", () => {
    const runs = commands("preflight");
    for (const command of ["npm run typecheck", "npm run lint", "npm run coverage"]) assert.ok(runs.includes(command), command);
    assert.ok(runs.some((command) => command.includes("tools/privacy-check.ts --range")));
    assert.ok(runs.some((command) => command.includes("tools/semver.ts")));
    assert.equal(untrusted.doc.jobs.preflight["timeout-minutes"], 10);
  });

  it("runs source once per POSIX OS with locked Chromium and complete structured evidence", () => {
    assert.deepEqual(untrusted.doc.jobs.source.strategy.matrix.os, ["ubuntu-latest", "macos-latest"]);
    assert.deepEqual(untrusted.doc.jobs.source.strategy.matrix.shard.map((item: { value: string }) => item.value), ["1/2", "2/2"]);
    const runs = commands("source").join("\n");
    assert.match(runs, /tools\/test-runner\.ts --lane source --concurrency=2 --shard/);
    assert.match(runs, /tools\/verify-execution\.ts --partial --lane source/);
    assert.match(runs, /@playwright\/test\/cli\.js" install --with-deps chromium/);
    assert.doesNotMatch(runs, /\bnpx\b|npm exec\b/);
    assert.equal(commands("source").filter((command) => command.includes("test-runner.ts")).length, 1);
  });

  it("builds before bundle-only tests and replaces duplicate Node 24 UAT with one smoke", () => {
    const runs = commands("bundle-uat");
    const build = runs.indexOf("npm run build");
    const post = runs.findIndex((command) => command.includes("--lane postbuild"));
    const smoke = runs.findIndex((command) => command.includes("uat:smoke"));
    const minimum = runs.findIndex((command) => command.includes("tools/uat/verify.mjs"));
    assert.ok(build >= 0 && post > build && smoke > post && minimum > smoke);
    assert.equal(runs.filter((command) => command.includes("tools/uat/uat.mjs") || command.includes("npm run --silent uat >")).length, 1);
    const nodes = untrusted.doc.jobs["bundle-uat"].steps
      .filter((step: { uses?: string }) => step.uses?.startsWith("actions/setup-node@"))
      .map((step: { with: { "node-version": string | number } }) => String(step.with["node-version"]));
    assert.deepEqual(nodes, ["24", "22.12.0"]);
    assert.equal(runs.filter((command) => command.includes("verify-smoke.mjs")).length, 2);
    assert.ok(runs.some((command) => command.includes("TENET_LEGACY_CAPTURE_DIR") &&
      command.includes("tools/protocol-legacy-capture.mjs")));
  });

  it("continues Windows portability and gates the Windows-only inverse-patch leaf", () => {
    const runs = commands("windows-portability").join("\n");
    assert.match(runs, /--lane windows-inverse/);
    assert.match(runs, /--lane windows-static/);
    assert.match(runs, /--lane windows-cleanup/);
    assert.match(runs, /--lane windows-recovery/);
    assert.match(runs, /--lane windows-review/);
    assert.match(runs, /verify-execution\.ts --lane windows-inverse/);
    assert.match(runs, /packages\\kernel\\test\\verify-execution\.test\.ts/);
    assert.match(runs, /npm rebuild better-sqlite3/);
    const nodes = untrusted.doc.jobs["windows-portability"].steps
      .filter((step: { uses?: string }) => step.uses?.startsWith("actions/setup-node@"))
      .map((step: { with: { "node-version": string | number } }) => String(step.with["node-version"]));
    assert.deepEqual(nodes, ["24", "22.12.0"]);
  });

  it("pins workflow actions and the generated starter workflow", () => {
    for (const { text } of workflows) assertPinnedActions(text);
    assertPinnedActions(starterWorkflow);
    assert.match(starterWorkflow, /npm ci --ignore-scripts --no-audit/);
  });
});
