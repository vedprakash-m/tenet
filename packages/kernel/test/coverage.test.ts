import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { symlinkSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { cleanup, git, initRepo, tmp, write } from "./helpers.ts";
import { report } from "../../../tools/coverage.ts";
import { releaseAudit, releaseAuditReport } from "../../../tools/release-audit.ts";

function fixture(root: string) {
  write(root, "specs/PRD.md", "| TST-01 | Example requirement | Must | M0 | AC-01, AC-02 |\n");
  write(root, "specs/tech-spec.md", "| AC-01 | T1 | Example suite |\n| AC-02 | T1 | Second suite |\n");
  const requirementId = "TST-01";
  write(root, "packages/kernel/test/example.test.ts", `it("maps the requirement [${requirementId}]", () => {});\n`);
  write(root, "packages/kernel/src/verbs/example.ts", "");
  write(root, "packages/kernel/src/decisions/example.ts", "");
}

test("a missing ledger entry remains unreviewed without erasing structural mapping", () => {
  const root = tmp("tenet-coverage-");
  try {
    fixture(root);

    const result = report(root, "M0");
    const gate = releaseAudit(root, "R1");

    assert.deepEqual(result.evidence, [{
      id: "TST-01",
      mapping: "mapped",
      disposition: "unreviewed",
      uncoveredAcIds: [],
      evidenceTiers: [],
      evidenceRefs: [],
      campaignRef: null,
      qualificationBinding: null,
      qualification: "not-qualified",
    }]);
    assert.deepEqual(gate.blockedRequirements, ["TST-01"]);
  } finally {
    cleanup(root);
  }
});

test("a malformed PRD requirement row is a report-integrity error", () => {
  const root = tmp("tenet-coverage-");
  try {
    fixture(root);
    write(root, "specs/PRD.md", "| TST-01 | Example requirement | Must | M0 | AC-01, AC-02 |\n| TST-02 | Missing milestone | Must | Unknown | AC-01 |\n");

    const result = report(root, "M0");

    assert.ok(result.integrityErrors.some((error) => error.includes("TST-02")));
    assert.equal(result.evidence.length, 1);
  } finally {
    cleanup(root);
  }
});

test("a valid partial entry reports its uncovered AC and referenced evidence tier", () => {
  const root = tmp("tenet-coverage-");
  try {
    fixture(root);
    const evidencePath = "docs/audits/evidence/ac-01.json";
    const evidence = "{\"result\":\"pass\"}\n";
    write(root, evidencePath, evidence);
    const evidenceRef = {
      kind: "test", tier: "T1", path: evidencePath,
      sha256: createHash("sha256").update(evidence).digest("hex"), acIds: ["AC-01"], outcome: "pass",
    };
    const reviewedAt = "2026-10-22T05:00:00Z";
    write(root, "docs/audits/evidence-ledger.json", JSON.stringify({ schemaVersion: 1, records: [{
      requirementId: "TST-01", disposition: "partial", uncoveredAcIds: ["AC-02"], evidenceRefs: [evidenceRef],
      reviewer: "owner", reviewedAt, reason: "AC-02 is not covered", ownerApprovalRef: "change-123",
      qualificationStatus: "not-qualified", campaignRef: null,
      changeHistory: [{ requirementId: "TST-01", fromDisposition: null, toDisposition: "partial", fromUncoveredAcIds: [],
        fromQualificationStatus: null, toQualificationStatus: "not-qualified", toUncoveredAcIds: ["AC-02"],
        reason: "AC-02 is not covered", reviewer: "owner", reviewedAt,
        ownerApprovalRef: "change-123", evidenceRefs: [evidenceRef] }],
    }] }));

    const result = report(root, "M0");

    assert.deepEqual(result.integrityErrors, []);
    assert.deepEqual(result.evidence, [{
      id: "TST-01", mapping: "mapped", disposition: "partial", uncoveredAcIds: ["AC-02"],
      evidenceTiers: ["T1"], evidenceRefs: [evidenceRef], campaignRef: null, qualificationBinding: null, qualification: "not-qualified",
    }]);
  } finally {
    cleanup(root);
  }
});

test("a top-level qualified status cannot bypass qualification change history", () => {
  const root = tmp("tenet-coverage-");
  try {
    fixture(root);
    const evidencePath = "docs/audits/evidence/ac-01.json";
    const evidence = "{\"result\":\"pass\"}\n";
    write(root, evidencePath, evidence);
    const evidenceRef = {
      kind: "test", tier: "T1", path: evidencePath,
      sha256: createHash("sha256").update(evidence).digest("hex"), acIds: ["AC-01"], outcome: "pass",
    };
    const reviewedAt = "2026-10-22T05:00:00Z";
    write(root, "docs/audits/evidence-ledger.json", JSON.stringify({ schemaVersion: 1, records: [{
      requirementId: "TST-01", disposition: "partial", uncoveredAcIds: ["AC-02"], evidenceRefs: [evidenceRef],
      reviewer: "owner", reviewedAt, reason: "AC-02 is not covered", ownerApprovalRef: "change-123",
      qualificationStatus: "qualified", campaignRef: null,
      changeHistory: [{ requirementId: "TST-01", fromDisposition: null, toDisposition: "partial", fromUncoveredAcIds: [],
        toQualificationStatus: "not-qualified", fromQualificationStatus: null, toUncoveredAcIds: ["AC-02"],
        reason: "AC-02 is not covered", reviewer: "owner", reviewedAt, ownerApprovalRef: "change-123", evidenceRefs: [evidenceRef] }],
    }] }));

    const result = report(root, "M0");

    assert.ok(result.integrityErrors.some((error) => error.includes("qualification history")));
    assert.equal(result.evidence[0]?.qualification, "not-qualified");
  } finally {
    cleanup(root);
  }
});

test("a stale AC reference is a report-integrity error and cannot qualify the requirement", () => {
  const root = tmp("tenet-coverage-");
  try {
    fixture(root);
    const reviewedAt = "2026-10-22T05:00:00Z";
    write(root, "docs/audits/evidence-ledger.json", JSON.stringify({ schemaVersion: 1, records: [{
      requirementId: "TST-01", disposition: "partial", uncoveredAcIds: ["AC-99"], evidenceRefs: [],
      reviewer: "owner", reviewedAt, reason: "stale reference", ownerApprovalRef: "change-123",
      qualificationStatus: "not-qualified", campaignRef: {
        campaignId: "campaign-01", path: "docs/audits/2026-10-22/campaign-01.json", sha256: "0".repeat(64),
      },
      changeHistory: [{ requirementId: "TST-01", fromDisposition: null, toDisposition: "partial", fromUncoveredAcIds: [],
        fromQualificationStatus: null, toQualificationStatus: "not-qualified", toUncoveredAcIds: ["AC-99"],
        reason: "stale reference", reviewer: "owner", reviewedAt,
        ownerApprovalRef: "change-123", evidenceRefs: [] }],
    }] }));

    const result = report(root, "M0");

    assert.ok(result.integrityErrors.some((error) => error.includes("AC-99")));
    assert.ok(result.integrityErrors.some((error) => error.includes("campaign")));
    assert.equal(result.evidence[0]?.qualification, "not-qualified");
  } finally {
    cleanup(root);
  }
});

test("evidence paths cannot escape through a repository symlink", () => {
  const root = tmp("tenet-coverage-");
  const outside = tmp("tenet-evidence-");
  try {
    fixture(root);
    const evidence = "external evidence\n";
    write(outside, "evidence.json", evidence);
    write(root, "docs/audits/evidence/.keep", "");
    const evidencePath = "docs/audits/evidence/external.json";
    symlinkSync(join(outside, "evidence.json"), join(root, evidencePath));
    const evidenceRef = {
      kind: "test", tier: "T1", path: evidencePath,
      sha256: createHash("sha256").update(evidence).digest("hex"), acIds: ["AC-01"], outcome: "pass",
    };
    const reviewedAt = "2026-10-22T05:00:00Z";
    write(root, "docs/audits/evidence-ledger.json", JSON.stringify({ schemaVersion: 1, records: [{
      requirementId: "TST-01", disposition: "partial", uncoveredAcIds: ["AC-02"], evidenceRefs: [evidenceRef],
      reviewer: "owner", reviewedAt, reason: "AC-02 is not covered", ownerApprovalRef: "change-123",
      qualificationStatus: "not-qualified", campaignRef: null,
      changeHistory: [{ requirementId: "TST-01", fromDisposition: null, toDisposition: "partial",
        fromQualificationStatus: null, toQualificationStatus: "not-qualified", fromUncoveredAcIds: [],
        toUncoveredAcIds: ["AC-02"], reason: "AC-02 is not covered", reviewer: "owner", reviewedAt,
        ownerApprovalRef: "change-123", evidenceRefs: [evidenceRef] }],
    }] }));

    const result = report(root, "M0");

    assert.ok(result.integrityErrors.some((error) => error.includes("escapes repository")));
    assert.equal(result.evidence[0]?.disposition, "unreviewed");
  } finally {
    cleanup(root);
    cleanup(outside);
  }
});

test("the ledger file itself cannot be loaded through an external symlink", () => {
  const root = tmp("tenet-coverage-");
  const outside = tmp("tenet-ledger-");
  try {
    fixture(root);
    write(root, "docs/audits/.keep", "");
    write(outside, "evidence-ledger.json", JSON.stringify({ schemaVersion: 1, records: [] }));
    symlinkSync(join(outside, "evidence-ledger.json"), join(root, "docs/audits/evidence-ledger.json"));

    const result = report(root, "M0");

    assert.ok(result.integrityErrors.some((error) => error.includes("escapes repository")));
  } finally {
    cleanup(root);
    cleanup(outside);
  }
});

test("a qualified disposition requires a passing manifest bound to the frozen protocol and built artifact", () => {
  const root = tmp("tenet-coverage-");
  try {
    fixture(root);
    initRepo(root);
    const protocolPath = "docs/audits/protocols/r1.md";
    write(root, protocolPath, "Frozen campaign protocol\n");
    git(root, "add", protocolPath);
    git(root, "commit", "-m", "freeze campaign protocol");
    const protocolCommit = git(root, "rev-parse", "HEAD");

    const evidencePath = "docs/audits/evidence/campaign-result.json";
    const evidence = "{\"result\":\"passed\"}\n";
    write(root, evidencePath, evidence);
    const resultRef = {
      kind: "campaign", tier: "T3", path: evidencePath,
      sha256: createHash("sha256").update(evidence).digest("hex"), acIds: ["AC-01", "AC-02"], outcome: "pass",
    };
    const artifactPath = "plugin/kernel/tenet.mjs";
    const artifact = "tenet bundle\n";
    write(root, artifactPath, artifact);
    const campaignId = "campaign-01";
    const campaignPath = "docs/audits/2026-10-22/campaign-01.json";
    const manifest = {
      schemaVersion: 1, campaignId, protocolVersion: "1", protocolPath, protocolCommit,
      campaignDate: "2026-10-22T05:00:00Z", campaignResult: "passed",
      qualificationTuple: {
        vscodeVersion: "1.100.0", copilotChatExtensionVersion: "0.30.0", agentHarness: "local",
        pluginFormatVersion: "1", installPath: "source", featureSettings: {}, copilotPlan: "pro",
        organizationPolicyProfile: "standard", osVersion: "macOS", architecture: "arm64",
        executionTarget: "local", workspaceMode: "single-folder", recipeVersion: "1", toolchainVersions: { node: "22.12.0" },
      },
      tenetVersion: "0.1.0-m0", artifactSha256: createHash("sha256").update(artifact).digest("hex"), observedModel: "unknown",
      scope: { milestone: "R1", requirementIds: ["TST-01"], acIds: ["AC-01", "AC-02"] },
      outcomes: [{ requirementId: "TST-01", result: "passed", evidenceRefs: [resultRef] }],
    };
    const manifestText = `${JSON.stringify(manifest)}\n`;
    write(root, campaignPath, manifestText);
    const campaignRef = { campaignId, path: campaignPath, sha256: createHash("sha256").update(manifestText).digest("hex") };
    const reviewedAt = "2026-10-22T05:00:00Z";
    const recordRef = { ...resultRef, kind: "test", tier: "T1", path: evidencePath, acIds: ["AC-01", "AC-02"] };
    write(root, "docs/audits/evidence-ledger.json", JSON.stringify({ schemaVersion: 1, records: [{
      requirementId: "TST-01", disposition: "complete", uncoveredAcIds: [], evidenceRefs: [recordRef],
      reviewer: "owner", reviewedAt, reason: "All acceptance suites reviewed", ownerApprovalRef: "change-456",
      qualificationStatus: "qualified", campaignRef,
      changeHistory: [{ requirementId: "TST-01", fromDisposition: null, toDisposition: "complete", fromUncoveredAcIds: [],
        fromQualificationStatus: null, toQualificationStatus: "qualified", toUncoveredAcIds: [],
        reason: "All acceptance suites reviewed", reviewer: "owner", reviewedAt,
        ownerApprovalRef: "change-456", evidenceRefs: [recordRef] }],
    }] }));

    const result = report(root, "M0");

    assert.deepEqual(result.integrityErrors, []);
    assert.equal(result.evidence[0]?.qualification, "qualified");
    assert.equal(result.evidence[0]?.campaignRef?.campaignId, campaignId);
    assert.deepEqual(result.evidence[0]?.evidenceTiers, ["T1", "T3"]);
    assert.equal(result.evidence[0]?.evidenceRefs.length, 2);
    assert.deepEqual(releaseAudit(root, "R1").blockedRequirements, []);
    const status = result.evidence[0]!;
    const mixed = releaseAuditReport({ ...result, evidence: [status, {
      ...status, id: "TST-02", qualificationBinding: { ...status.qualificationBinding!, artifactSha256: "f".repeat(64) },
    }] });
    assert.equal(mixed.bindingMismatch, true);
    assert.deepEqual(mixed.blockedRequirements, ["TST-01", "TST-02"]);

    write(root, campaignPath, `${manifestText} `);
    const tampered = report(root, "M0");
    assert.ok(tampered.integrityErrors.some((error) => error.includes("hash mismatch")));
    assert.equal(tampered.evidence[0]?.qualification, "not-qualified");
  } finally {
    cleanup(root);
  }
});