import { test } from "node:test";
import assert from "node:assert/strict";
import { admitCommitDomainUsage, CommitSigningObservation } from "../src/core/executable-privacy.ts";

const maximum = {
  complete: true, cycle: false, files: 50_000, largestFileBytes: 20 * 1024 * 1024, sourceBytes: 44 * 1024 * 1024,
  includeDirectives: 50_000, maxIncludeEdges: 64, configEntries: 100_000,
  controlBytes: 1024 * 1024, controlValues: 100_000, controlDepth: 64,
  stdoutBytes: 10 * 1024 * 1024, stderrBytes: 10 * 1024 * 1024, elapsedMs: 120_000,
};
test("[SEC-11] [GIT-12] executable privacy admits exact complete-domain limits and refuses each first overflow", () => {
  assert.deepEqual(admitCommitDomainUsage(maximum), { status: "within-limits" });
  for (const field of [
    "files", "largestFileBytes", "sourceBytes", "includeDirectives", "maxIncludeEdges", "configEntries",
    "controlBytes", "controlValues", "controlDepth", "stdoutBytes", "stderrBytes", "elapsedMs",
  ] as const) {
    assert.deepEqual(admitCommitDomainUsage({ ...maximum, [field]: maximum[field] + 1 }), {
      status: "unknown", cause: "limit-exceeded",
    }, field);
  }
  assert.deepEqual(admitCommitDomainUsage({ ...maximum, elapsedMs: 120_000.001 }), { status: "unknown", cause: "limit-exceeded" });
  for (const usage of [{ ...maximum, complete: false }, { ...maximum, cycle: true }])
    assert.deepEqual(admitCommitDomainUsage(usage), { status: "unknown", cause: "provider-incomplete" });
  for (const usage of [
    { ...maximum, controlBytes: undefined }, { ...maximum, files: -1 }, { ...maximum, maxIncludeEdges: 1.5 },
    { ...maximum, configEntries: Number.MAX_SAFE_INTEGER + 1 }, { ...maximum, syntheticUnknown: "synthetic config" },
  ]) assert.deepEqual(admitCommitDomainUsage(usage), { status: "unknown", cause: "malformed" });
});

test("[GIT-12] executable privacy cannot turn enabled or indeterminate signing into absence", () => {
  const common = { source: "git-executable", population: "commit-signing" };
  for (const basis of ["default-disabled", "explicitly-disabled"])
    assert.equal(CommitSigningObservation.safeParse({ ...common, state: "absent", basis, claim: "listed-execution-input-absent" }).success, true);
  assert.equal(CommitSigningObservation.safeParse({
    ...common, state: "present", basis: "enabled", claim: "signing-execution-selected",
  }).success, true);
  assert.equal(CommitSigningObservation.safeParse({
    ...common, state: "unknown", basis: "indeterminate", cause: "unsupported-selector",
  }).success, true);
  for (const invalid of [
    { state: "absent", basis: "enabled", claim: "listed-execution-input-absent" },
    { state: "absent", basis: "indeterminate", claim: "listed-execution-input-absent" },
    { state: "absent", basis: "explicitly-disabled", claim: "signing-execution-selected" },
    { state: "present", basis: "enabled", claim: "signing-execution-selected", command: "synthetic command" },
  ]) assert.equal(CommitSigningObservation.safeParse({ ...common, ...invalid }).success, false);
});
