// Structure of the candidate release workflow (PRD §5.9.2). These tests read the YAML; they cannot show that branch protection,
// tag signing, attestation or the release environment work, because none of that has run. They carry no requirement tag for that reason.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parse } from "yaml";

const text = readFileSync(new URL("../../../.github/workflows/release.yml", import.meta.url), "utf8");
type Step = { uses?: string; run?: string; name?: string; with?: Record<string, unknown>; env?: Record<string, string> };
type Job = { needs?: string; environment?: string; permissions?: Record<string, string>; steps: Step[] };
const doc: { on: Record<string, any>; permissions: unknown; jobs: Record<string, Job> } = parse(text);
const jobs = doc.jobs;
const commands = (job: string) => jobs[job]!.steps.map((s) => s.run ?? "");
const index = (job: string, pattern: RegExp) => jobs[job]!.steps.findIndex((s) => pattern.test(s.run ?? s.uses ?? ""));

describe("release workflow candidate", () => {
  it("runs on a version tag only, never on a pull request or a branch push", () => {
    assert.deepEqual(Object.keys(doc.on), ["push"]);
    assert.deepEqual(Object.keys(doc.on.push), ["tags"]);
    assert.doesNotMatch(text, /pull_request|workflow_run|issue_comment/);
  });

  it("pins every remote action to a commit, including the attestation action", () => {
    const remote = Object.values(jobs).flatMap((j) => j.steps).flatMap((s) => (s.uses ? [s.uses] : []));
    assert.ok(remote.some((u) => u.startsWith("actions/attest-build-provenance@")));
    for (const use of remote) assert.match(use, /^[^@\s]+@[0-9a-f]{40}$/);
  });

  it("starts with no token and gives each job only what it needs", () => {
    assert.deepEqual(doc.permissions, {});
    assert.deepEqual(Object.keys(jobs), ["gate", "build", "publish"]);
    for (const [name, job] of Object.entries(jobs)) assert.ok(job.permissions, `${name} declares its permissions`);
    assert.deepEqual(jobs.gate!.permissions, { contents: "read", actions: "read" });
    assert.deepEqual(jobs.build!.permissions, { contents: "read", "id-token": "write", attestations: "write" });
    assert.deepEqual(jobs.publish!.permissions, { contents: "write", attestations: "read" });
    assert.doesNotMatch(text, /\$\{\{\s*secrets\./);
  });

  it("keeps no checkout credentials and installs only locked dependencies without scripts", () => {
    for (const job of Object.values(jobs)) {
      for (const step of job.steps.filter((s) => s.uses?.startsWith("actions/checkout@"))) assert.equal(step.with?.["persist-credentials"], false);
    }
    assert.doesNotMatch(text, /npm (install|i)\b/);
    assert.ok(commands("gate").includes("npm ci --ignore-scripts --no-audit"));
    assert.ok(commands("build").includes("npm ci --ignore-scripts --no-audit"));
  });

  it("gates on the protected branch, the signed tag, passing CI, the version, the notes and the qualification audit", () => {
    const gate = commands("gate").join("\n");
    assert.match(gate, /merge-base --is-ancestor "\$GITHUB_SHA" origin\/main/);
    assert.match(gate, /\.object\.type\)" = tag/);
    assert.match(gate, /verification\.verified\)" = true/);
    assert.match(gate, /untrusted\.yml\/runs\?head_sha=\$GITHUB_SHA&status=success/);
    assert.match(gate, /plugin\/plugin\.json/);
    assert.match(gate, /tools\/release-notes\.ts --check "docs\/release\/notes\/\$TAG\.md"/);
    assert.match(gate, /tools\/release-audit\.ts --milestone R1/);
    assert.equal(jobs.build!.needs, "gate");
    assert.equal(jobs.publish!.needs, "build");
  });

  it("builds, verifies the payload and the double build, packs, then attests before uploading", () => {
    const order = [/npm run build$/, /npm run verify:payload$/, /npm run verify:reproducible$/, /gzip -n/, /attest-build-provenance@/, /upload-artifact@/];
    const at = order.map((p) => index("build", p));
    assert.ok(at.every((i) => i >= 0), `each build step exists: ${at}`);
    assert.deepEqual(at, [...at].sort((a, b) => a - b));
    assert.equal(jobs.build!.steps[at[4]!]!.with?.["subject-path"], "dist/*.tgz");
  });

  it("verifies the attestation before it creates a draft release in a protected environment", () => {
    assert.equal(jobs.publish!.environment, "release");
    const verify = index("publish", /gh attestation verify/), create = index("publish", /gh release create/);
    assert.ok(verify >= 0 && create > verify);
    assert.match(commands("publish")[create]!, /--verify-tag --draft/);
    assert.equal(text.match(/gh release create/g)?.length, 1);
  });
});
