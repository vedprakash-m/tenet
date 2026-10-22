// Tenet's own CI follows the security tiers of PRD 5.9.3. Only the untrusted tier exists so far; these checks keep it that way (ENG-10).
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse } from "yaml";

const dir = join(import.meta.dirname, "../../../.github/workflows");
const workflows = readdirSync(dir).filter((f) => /\.ya?ml$/.test(f)).map((f) => ({ f, text: readFileSync(join(dir, f), "utf8"), doc: parse(readFileSync(join(dir, f), "utf8")) }));
const starterWorkflow = readFileSync(join(import.meta.dirname, "../../../plugin/skills/tenet-starter-ts-web-api/template/.github/workflows/ci.yml"), "utf8");

describe("workflows keep the untrusted tier untrusted [ENG-10]", () => {
  it("there is a workflow to check", () => assert.ok(workflows.length > 0));
  it("the starter CI install disables npm's implicit audit", () => assert.match(starterWorkflow, /npm ci --ignore-scripts --no-audit/));
  for (const { f, text, doc } of workflows) {
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
