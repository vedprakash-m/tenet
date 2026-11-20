import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256, stableStringify } from "../src/core/ids.ts";
import { emptyState } from "../src/core/state.ts";
import { MarkerV3 } from "../src/core/marker-identity.ts";
import { RollbackTerminalAcceptedV2 } from "../src/core/marker-transition.ts";
import { captureCandidateSnapshot } from "../src/adapters/marker-snapshot.ts";
import {
  admitCandidateRollbackEvidence,
  createMigrationGuard,
  publishCandidateTarget,
  restoreCandidateSnapshot,
} from "../src/adapters/marker-rollback.ts";
import {
  rollbackProbeRequest,
  runCandidatePostcondition,
} from "../src/adapters/marker-postcondition.ts";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";
import { FsStore } from "../src/adapters/store-fs.ts";
import { systemClock, systemRandom } from "../src/adapters/system.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const operationId = "c".repeat(32);
const bundle = join(import.meta.dirname, "../../../plugin/kernel/tenet.mjs");
const workspace = join(import.meta.dirname, "../../..");
const qualification = {
  platform: process.platform as "darwin" | "linux" | "win32",
  architecture: process.arch as "arm64" | "x64",
  filesystem: "qualified-test-fs",
  birthTimeSource: "native-birthtime-ns",
} as const;
const binding = {
  status: () => ({ kind: "absent", capabilityHash: "c".repeat(64) } as const),
  create: () => assert.fail("verified absence must not create a key"),
  verify: () => "unavailable" as const,
};

function marker(root: string) {
  const stat = lstatSync(join(root, ".tenet"), { bigint: true });
  return MarkerV3.parse({
    schema: 3, workspaceId: "ws_bbbbbbbbbb", tag: "bcdf", nonce: "bbbbbbbbbbbb",
    dev: Number(stat.dev), ino: Number(stat.ino),
    identity: {
      kind: "directory-v1", platform: qualification.platform, architecture: qualification.architecture,
      filesystem: qualification.filesystem, dev: String(stat.dev), ino: String(stat.ino),
      birthNs: String(stat.birthtimeNs),
    },
    binding: { kind: "none", reason: "host-storage-verified-absent", capability: "c".repeat(64) },
  });
}

async function runBridge(root: string, request: string, digest?: string, expectedRequest = request) {
  const child = spawn(process.execPath, [
    join(import.meta.dirname, "fixtures/bridge-open-plan.ts"), bundle, request,
  ], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      GITHUB_WORKSPACE: workspace,
      TENET_ROLLBACK_BRIDGE_REQUEST: expectedRequest,
      TENET_HOST_VERSION: "schema2-bridge-fixture",
      ...(digest ? { TENET_ROLLBACK_BRIDGE_DIGEST: digest } : {}),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "", stderr = "";
  child.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
  child.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
  const code = await new Promise<number | null>((resolve) => child.on("exit", resolve));
  return { code, stderr, stdout, value: JSON.parse(stdout.trim()) as { exit: number; handle?: string; reasons?: Array<{ code: string }> } };
}

async function openWithPinnedBundle(root: string, request: string, digest: string) {
  const result = await runBridge(root, request, digest);
  if (result.code !== 0) throw new Error(`bridge open failed: ${result.code}: ${result.stderr}: ${result.stdout}`);
  return result.value;
}

async function killAfterAccounting(root: string, request: string, digest: string) {
  const child = spawn(process.execPath, [
    join(import.meta.dirname, "fixtures/bridge-open-plan.ts"), bundle, request,
  ], {
    cwd: root,
    env: {
      ...process.env,
      GITHUB_ACTIONS: "true",
      GITHUB_WORKSPACE: workspace,
      TENET_ROLLBACK_BRIDGE_DIGEST: digest,
      TENET_ROLLBACK_BRIDGE_REQUEST: request,
      TENET_HOST_VERSION: "schema2-bridge-fixture",
      TENET_BRIDGE_KILL: "after-accounting-before-state",
    },
    stdio: "ignore",
  });
  return new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
  });
}

describe("pinned schema-2 bridge ordinary-work postcondition", () => {
  it("runs the exact built schema-2 frontend twice and promotes only after the same-handle restart", async () => {
    assert.equal(existsSync(bundle), true, "run npm run build before this postbuild control");
    const digest = sha256(readFileSync(bundle));
    const projectFixture = project();
    roots.push(projectFixture.root);
    const dir = join(projectFixture.root, ".tenet");
    mkdirSync(dir);
    const stat = lstatSync(dir);
    const workspaceId = "ws_aaaaaaaaaa", tag = "aaaa";
    writeFileSync(join(dir, "marker"), JSON.stringify({
      schema: 2, workspaceId, tag, nonce: "aaaaaaaaaaaa", dev: stat.dev, ino: stat.ino,
    }));
    writeFileSync(join(dir, "state"), JSON.stringify({ ...emptyState(workspaceId, tag), schema: 2, revision: 7 }));
    writeFileSync(join(dir, "state.prev"), JSON.stringify({ ...emptyState(workspaceId, tag), schema: 2, revision: 6 }));
    writeFileSync(join(dir, "log"), "");
    writeFileSync(join(dir, ".gitignore"), "*\n");
    const seed = await runBridge(projectFixture.root, "prime capability cache");
    assert.equal(seed.value.exit, 0);
    const capabilityCache = JSON.parse(readFileSync(join(dir, "state"), "utf8")).capabilityCache;
    writeFileSync(join(dir, "marker"), JSON.stringify({
      schema: 2, workspaceId, tag, nonce: "aaaaaaaaaaaa", dev: stat.dev, ino: stat.ino,
    }));
    writeFileSync(join(dir, "state"), JSON.stringify({
      ...emptyState(workspaceId, tag), schema: 2, revision: 7, capabilityCache,
    }));
    writeFileSync(join(dir, "state.prev"), JSON.stringify({
      ...emptyState(workspaceId, tag), schema: 2, revision: 6, capabilityCache,
    }));
    writeFileSync(join(dir, "log"), "");
    captureCandidateSnapshot(projectFixture.root, {
      operationId, ownership: { kind: "attested-v1", digest: "a".repeat(64) },
      marker: marker(projectFixture.root), previousBridgeDigest: digest, qualification, binding,
    });
    publishCandidateTarget(projectFixture.root, {
      operationId, state: '{"schema":3,"revision":8,"newer":true}',
      previousBridgeDigest: digest,
      previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
      writes: [], removes: [], qualification, binding,
    });
    restoreCandidateSnapshot(projectFixture.root, {
      operationId, previousBridgeDigest: digest, qualification, binding,
    });
    const admitted = admitCandidateRollbackEvidence(projectFixture.root, operationId, digest);
    const accepted = RollbackTerminalAcceptedV2.parse({
      format: 2,
      operationId,
      terminal: admitted.terminal,
      evidence: admitted.evidence,
      bridgeDigest: digest,
      bindingDigest: admitted.bindingDigest,
    });
    const facts = {
      acceptance: sha256(stableStringify(accepted)),
      terminal: admitted.terminal,
      evidence: admitted.evidence,
      snapshot: admitted.snapshot,
      bridgeDigest: digest,
    };
    const markerBefore = readFileSync(join(dir, "marker"));
    const stateBefore = readFileSync(join(dir, "state"));
    const direct = new FsStore(projectFixture.root, systemClock, systemRandom, {
      migrationGuard: createMigrationGuard(
        projectFixture.root, digest, rollbackProbeRequest(operationId), false,
      ),
    });
    assert.throws(() => direct.putBlob("forbidden before postcondition"), /ordinary plan probe|before.*postcondition/i);
    await assert.rejects(
      () => direct.transaction("open", async (tx) => tx.publish(tx.state!)),
      /ordinary plan probe|before.*postcondition/i,
    );
    const unpinned = await runBridge(projectFixture.root, rollbackProbeRequest(operationId));
    assert.equal(unpinned.value.exit, 4);
    assert.equal(unpinned.value.reasons?.[0]?.code, "unsupported-record");
    assert.equal(existsSync(join(dir, `migration-evidence-v2/${operationId}/accepted.json`)), false);
    const wrongDigest = await runBridge(
      projectFixture.root, rollbackProbeRequest(operationId), "f".repeat(64),
      rollbackProbeRequest(operationId),
    );
    assert.equal(wrongDigest.value.exit, 4);
    assert.equal(wrongDigest.value.reasons?.[0]?.code, "unsupported-record");
    const acceptedPath = join(dir, `migration-evidence-v2/${operationId}/accepted.json`);
    writeFileSync(acceptedPath, "{}");
    const corruptAcceptance = await runBridge(
      projectFixture.root, rollbackProbeRequest(operationId), digest, rollbackProbeRequest(operationId),
    );
    assert.equal(corruptAcceptance.value.exit, 4);
    assert.equal(corruptAcceptance.value.reasons?.[0]?.code, "unsupported-record");
    assert.deepEqual(readFileSync(join(dir, "state")), stateBefore);
    unlinkSync(acceptedPath);
    assert.deepEqual(readFileSync(join(dir, "marker")), markerBefore);
    assert.deepEqual(readFileSync(join(dir, "state")), stateBefore);
    const unrelated = await runBridge(
      projectFixture.root, "unrelated open", digest, rollbackProbeRequest(operationId),
    );
    assert.equal(unrelated.value.exit, 4);
    assert.equal(unrelated.value.reasons?.[0]?.code, "unsupported-record");
    assert.deepEqual(readFileSync(join(dir, "state")), stateBefore);
    const killed = await killAfterAccounting(
      projectFixture.root, rollbackProbeRequest(operationId), digest,
    );
    if (process.platform === "win32") assert.equal(killed.code, 1);
    else assert.equal(killed.signal, "SIGKILL");
    assert.equal(existsSync(join(dir, `migration-evidence-v2/${operationId}/accepted.json`)), true);
    assert.deepEqual(readFileSync(join(dir, "state")), stateBefore);
    let calls = 0;
    const final = await runCandidatePostcondition(projectFixture.root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        return openWithPinnedBundle(projectFixture.root, request, digest);
      },
    });
    assert.equal(calls, 2);
    assert.equal(final.probe.requestDigest, sha256(rollbackProbeRequest(operationId)));
    assert.equal(final.schema, 2);
    assert.equal(final.probe.exit, 0);
    assert.equal(existsSync(join(dir, `migration-evidence-v2/${operationId}/accepted.json`)), true);
    const state = JSON.parse(readFileSync(join(dir, "state"), "utf8"));
    const work = Object.values(state.work) as Array<Record<string, unknown>>;
    assert.equal(work.length, 1);
    assert.equal(work[0]!.profile, "plan");
    assert.equal(work[0]!.request, rollbackProbeRequest(operationId));
    assert.equal(state.sourceOwner, undefined);
    assert.equal(projectFixture.git("status", "--porcelain"), "");
  });
});
