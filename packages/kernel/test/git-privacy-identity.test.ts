import { mock, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { admitGitInventory, GitIndexIdentity } from "../src/core/git-privacy.ts";
import { sha256, stableStringify } from "../src/core/ids.ts";

const index = {
  status: "known", domain: "git-index-entry-v1", version: 1, provider: "git-stage-zero-index",
  providerExecutable: { kind: "registered-git-provider-v1", registration: "11111111-1111-4111-8111-111111111111" },
  providerVersion: "git:2.47.1", providerProfile: "git-index-entry-v1", mode: "120000",
  oid: `git-oid:${"a".repeat(40)}`, tracked: true,
  providerBinding: { kind: "git-index-entry-v1", operation: "ls-files-stage-zero", helpers: "not-invoked" },
  pathProjection: { kind: "git-path-oid-v1", oid: `git-oid:${"b".repeat(40)}` },
  claim: "index-entry-continuity", observed: "fresh-single-inventory",
};
test("[SEC-11] [SEC-14] Git privacy candidate admission hashes only closed provider metadata, including symlink index continuity", () => {
  const expected = {
    pathProjection: index.pathProjection, mode: index.mode, oid: index.oid, tracked: true,
    providerExecutable: { registration: index.providerExecutable.registration },
    providerVersion: index.providerVersion, providerProfile: index.providerProfile,
    providerBinding: index.providerBinding, claim: index.claim,
  };
  assert.deepEqual(admitGitInventory({ complete: true, observations: [index] }), {
    status: "admitted", digest: {
      version: 1, complete: true, value: sha256(stableStringify([expected])),
      claims: { indexContinuity: 1, providerObjectContinuity: 0 }, unknown: 0,
    },
  });
  assert.equal(GitIndexIdentity.safeParse(index).success, true);
});

test("[SEC-11] Git privacy refuses raw paths, stat fallbacks, malformed metadata and unknown rows without hashing", () => {
  const hash = mock.method(crypto, "createHash", () => assert.fail("incomplete inventory reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const observations of [
      [{ ...index, path: "synthetic path" }], [{ ...index, stat: { ino: 1 } }], [{ ...index, tracked: false }],
      [{ ...index, oid: "synthetic raw bytes" }], [{ ...index, observed: "old-inventory" }],
      [{ ...index, providerExecutable: { ...index.providerExecutable, registration: "synthetic command" } }],
      [index, { status: "unknown", producer: "git-worktree", cause: "provider-incomplete" }],
      [index, index],
      [index, {
        ...index, pathProjection: { kind: "git-path-oid-v1", oid: `git-oid:${"c".repeat(40)}` },
        providerExecutable: { ...index.providerExecutable, registration: "22222222-2222-4222-8222-222222222222" },
      }],
    ]) assert.equal(admitGitInventory({ complete: true, observations }).status, "unknown");
    assert.equal(admitGitInventory({ complete: false, observations: [index] }).status, "unknown");
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

const worktree = {
  ...index, domain: "git-provider-worktree-v1", provider: "git-owned-worktree",
  providerProfile: "git-worktree-no-filters-v1", mode: "100644", tracked: false,
  claim: "provider-object-continuity",
  providerBinding: {
    kind: "git-hash-object-no-filters-v1", operation: "hash-object-stdin-pinned-handle",
    filters: "no-filters", helpers: "not-invoked", input: "no-follow-provider-file-handle", pathIdentity: "pinned-same-generation",
  },
};
test("[SEC-11] [EVD-01] Git privacy sorts admitted paths and preserves distinct worktree versus index claims", () => {
  const second = { ...worktree, pathProjection: { kind: "git-path-oid-v1", oid: `git-oid:${"c".repeat(40)}` } };
  const forward = admitGitInventory({ complete: true, observations: [index, second] });
  assert.deepEqual(admitGitInventory({ complete: true, observations: [second, index] }), forward);
  assert.equal(forward.status, "admitted");
  if (forward.status === "admitted")
    assert.deepEqual(forward.digest.claims, { indexContinuity: 1, providerObjectContinuity: 1 });
  for (const invalid of [
    { ...worktree, mode: "120000" }, { ...worktree, providerBinding: { ...worktree.providerBinding, filters: "configured" } },
    { ...worktree, providerBinding: { ...worktree.providerBinding, pathIdentity: "stat-only" } },
  ]) assert.equal(GitIndexIdentity.safeParse(invalid).success, false);
});

test("[SEC-11] Git privacy enforces exact inventory and worktree-row ceilings without partial digests", () => {
  const rows = Array.from({ length: 50_001 }, (_, index) => ({
    ...worktree, pathProjection: { kind: "git-path-oid-v1", oid: `git-oid:${index.toString(16).padStart(40, "0")}` },
  }));
  assert.equal(admitGitInventory({ complete: true, observations: rows.slice(0, 20_000) }).status, "admitted");
  assert.deepEqual(admitGitInventory({ complete: true, observations: rows.slice(0, 20_001) }), {
    status: "unknown", producer: "git", cause: "limit-exceeded",
  });
  const indexRows = rows.map(row => ({ ...index, pathProjection: row.pathProjection }));
  assert.equal(admitGitInventory({ complete: true, observations: indexRows.slice(0, 50_000) }).status, "admitted");
  assert.deepEqual(admitGitInventory({ complete: true, observations: indexRows }), {
    status: "unknown", producer: "git", cause: "limit-exceeded",
  });
});
