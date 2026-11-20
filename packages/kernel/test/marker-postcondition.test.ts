import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { cleanup, tmp } from "./helpers.ts";
import { sha256 } from "../src/core/ids.ts";
import { emptyState, newContract } from "../src/core/state.ts";
import { accountingCheckpoint } from "../src/core/budget.ts";
import { State } from "../src/core/schemas.ts";
import { MarkerV3 } from "../src/core/marker-identity.ts";
import { captureCandidateSnapshot } from "../src/adapters/marker-snapshot.ts";
import {
  acceptCandidateRollback,
  admitCandidateRollbackEvidence,
  publishCandidateTarget,
  restoreCandidateSnapshot,
} from "../src/adapters/marker-rollback.ts";
import {
  cleanupCandidateEvidence,
  rollbackProbeRequest,
  runCandidatePostcondition,
} from "../src/adapters/marker-postcondition.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const operationId = "b".repeat(32);
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

function marker(root: string): MarkerV3 {
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

function fixture() {
  const root = tmp();
  roots.push(root);
  const dir = join(root, ".tenet");
  mkdirSync(dir);
  const workspaceId = "ws_aaaaaaaaaa", tag = "aaaa";
  const stat = lstatSync(dir);
  writeFileSync(join(dir, "marker"), JSON.stringify({
    schema: 2, workspaceId, tag, nonce: "aaaaaaaaaaaa", dev: stat.dev, ino: stat.ino,
  }));
  writeFileSync(join(dir, "state"), JSON.stringify({ ...emptyState(workspaceId, tag), schema: 2, revision: 7 }));
  writeFileSync(join(dir, "log"), "");
  writeFileSync(join(dir, ".gitignore"), "*\n");
  captureCandidateSnapshot(root, {
    operationId,
    ownership: { kind: "attested-v1", digest: "a".repeat(64) },
    marker: marker(root),
    previousBridgeDigest: "d".repeat(64),
    qualification,
    binding,
  });
  publishCandidateTarget(root, {
    operationId,
    state: '{"schema":3,"revision":8,"newer":true}',
    previousBridgeDigest: "d".repeat(64),
    previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
    writes: [],
    removes: [],
    qualification,
    binding,
  });
  restoreCandidateSnapshot(root, {
    operationId, previousBridgeDigest: "d".repeat(64), qualification, binding,
  });
  const accepted = acceptCandidateRollback(root, operationId, "d".repeat(64));
  return {
    root,
    facts: accepted,
  };
}

function probe(root: string, request: string, handle = "W1.1.aaaa", appendCall = true) {
  const statePath = join(root, ".tenet/state");
  const state = JSON.parse(readFileSync(statePath, "utf8")) as {
    schema: number; revision: number; workspaceId: string; work: Record<string, unknown>;
    workSeq: number; generationSeq: number;
  };
  if (state.schema !== 2) throw new Error("candidate bridge only admits schema 2");
  const matching = Object.values(state.work).some((work) =>
    (work as { request?: string }).request === request);
  if (!matching) {
    const previous = State.parse(JSON.parse(JSON.stringify(state)));
    const id = "wk_aaaaaaaaaa";
    writeFileSync(join(root, ".tenet/state.prev"), readFileSync(statePath));
    state.revision++;
    state.workSeq++;
    state.generationSeq++;
    state.work[id] = newContract({
      id, label: "W-0001", profile: "plan", request, lane: "quick", floor: "quick", level: "L2",
      generation: state.generationSeq, now: "2026-11-19T00:00:00.000Z", version: "0.1.0-m0",
      adapter: "node-ts@28", assessment: {}, scopePaths: [], protectedPaths: [], gitMode: "none",
      base: null, branch: null, start: { head: null, branch: null, staged: [], dirty: [] },
    });
    const checkpoint = accountingCheckpoint(State.parse(state), previous);
    appendFileSync(join(root, ".tenet/log"), `${JSON.stringify({
      t: "probe", ...checkpoint,
    })}\n`);
    writeFileSync(statePath, JSON.stringify(state));
  }
  if (appendCall) appendFileSync(join(root, ".tenet/log"), `${JSON.stringify({
      t: "probe", kind: "call", verb: "open", exit: 0, revision: state.revision,
    })}\n`);
  return Promise.resolve({ exit: 0, handle });
}

describe("ordinary repeated open plan postcondition [CON-03, LFC-04]", () => {
  it("recomputes the binding digest instead of trusting matching terminal/evidence fields", () => {
    const { root } = fixture();
    const terminalPath = join(root, ".tenet/migration-terminal.json");
    const evidencePath = join(root, `.tenet/migration-evidence-v2/${operationId}/evidence.json`);
    const terminal = JSON.parse(readFileSync(terminalPath, "utf8"));
    const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
    terminal.bindingDigest = "f".repeat(64);
    evidence.bindingDigest = "f".repeat(64);
    writeFileSync(terminalPath, JSON.stringify(terminal));
    writeFileSync(evidencePath, JSON.stringify(evidence));
    assert.throws(
      () => admitCandidateRollbackEvidence(root, operationId, "d".repeat(64)),
      /binding|evidence|recompute/i,
    );
  });

  it("publishes only provisional after the first schema-2 bridge call, then promotes the exact repeat", async () => {
    const { root, facts } = fixture();
    const request = rollbackProbeRequest(operationId);
    let calls = 0;
    const secondAt: string[] = [];
    const done = await runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (exact) => {
        calls++;
        if (calls === 2) {
          secondAt.push(existsSync(join(root, `.tenet/migration-evidence-v2/${operationId}/postcondition.json`))
            ? "final" : "provisional");
        }
        return probe(root, exact);
      },
    });
    assert.equal(calls, 2);
    assert.deepEqual(secondAt, ["provisional"]);
    assert.equal(done.probe.requestDigest, sha256(request));
    assert.match(done.probe.handle, /^wk_[a-z2-7]{10}$/);
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    assert.equal(existsSync(join(base, "postcondition-provisional.json")), false);
    assert.equal(existsSync(join(base, "postcondition.json")), true);
    const work = Object.values(JSON.parse(readFileSync(join(root, ".tenet/state"), "utf8")).work);
    assert.equal(work.length, 1);
  });

  it("restarts from provisional by rerunning only the repeated schema-2 bridge call", async () => {
    const { root, facts } = fixture();
    let calls = 0;
    await assert.rejects(runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        if (calls === 2) throw new Error("simulated process loss before repeated open");
        return probe(root, request);
      },
    }), /simulated process loss/);
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    assert.equal(existsSync(join(base, "postcondition.json")), false);
    assert.equal(existsSync(join(base, "postcondition-provisional.json")), true);
    const resumed = await runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        return probe(root, request);
      },
    });
    assert.equal(calls, 3);
    assert.equal(resumed.probe.exit, 0);
    assert.equal(existsSync(join(base, "postcondition.json")), true);
  });

  it("recovers an accepted-only crash after the first probe changed state", async () => {
    const { root, facts } = fixture();
    let calls = 0;
    await assert.rejects(runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        const result = await probe(root, request, "W1.1.aaaa", false);
        throw new Error(`lost after first probe: ${result.handle}`);
      },
    }), /lost after first probe/);
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    assert.equal(existsSync(join(base, "accepted.json")), true);
    assert.equal(existsSync(join(base, "postcondition-provisional.json")), false);
    const resumed = await runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        return probe(root, request);
      },
    });
    assert.equal(calls, 3);
    assert.equal(resumed.probe.exit, 0);
    assert.equal(existsSync(join(base, "postcondition.json")), true);
  });

  it("re-admits an exact provisional temp and completes only its repeated call", async () => {
    const { root, facts } = fixture();
    let calls = 0;
    await assert.rejects(runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        if (calls === 2) throw new Error("process loss before repeat");
        return probe(root, request);
      },
    }), /process loss/);
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    const provisional = join(base, "postcondition-provisional.json");
    renameSync(provisional, `${provisional}.tmp`);
    const resumed = await runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        return probe(root, request);
      },
    });
    assert.equal(calls, 3);
    assert.equal(resumed.probe.exit, 0);
    assert.equal(existsSync(`${provisional}.tmp`), false);
    assert.equal(existsSync(join(base, "postcondition.json")), true);
  });

  it("keeps provisional evidence when the repeated result changes", async () => {
    const { root, facts } = fixture();
    let calls = 0;
    await assert.rejects(() => runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        return probe(root, request, calls === 2 ? "W999.0.badx" : "W1.1.aaaa");
      },
    }), /same handle|postcondition|repeated/i);
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    assert.equal(existsSync(join(base, "postcondition-provisional.json")), true);
    assert.equal(existsSync(join(base, "postcondition.json")), false);
  });

  it("refuses an external-effect intent added during the repeated probe", async () => {
    const { root, facts } = fixture();
    let calls = 0;
    await assert.rejects(() => runCandidatePostcondition(root, {
      operationId, ...facts,
      probe: async (request) => {
        calls++;
        const result = await probe(root, request);
        if (calls === 2) appendFileSync(join(root, ".tenet/log"),
          `${JSON.stringify({ t: "probe", kind: "intent", effect: "external", id: "x", op: {} })}\n`);
        return result;
      },
    }), /external|effect|postcondition/i);
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    assert.equal(existsSync(join(base, "postcondition-provisional.json")), true);
    assert.equal(existsSync(join(base, "postcondition.json")), false);
  });

  it("deletes retained evidence only through the exact post-success prefix", async () => {
    const { root, facts } = fixture();
    await runCandidatePostcondition(root, {
      operationId, ...facts, probe: (request) => probe(root, request),
    });
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    const present = () => ["source.json", "target.json", "evidence.json"].filter((name) =>
      existsSync(join(base, name)));
    for (const expected of [["target.json", "evidence.json"], ["evidence.json"], []]) {
      cleanupCandidateEvidence(root, operationId);
      assert.deepEqual(present(), expected);
    }
    assert.equal(existsSync(join(base, "accepted.json")), true);
    assert.equal(existsSync(join(base, "postcondition.json")), true);
  });

  it("refuses a non-prefix evidence subset and leaves remaining bytes unchanged", async () => {
    const { root, facts } = fixture();
    await runCandidatePostcondition(root, {
      operationId, ...facts, probe: (request) => probe(root, request),
    });
    const base = join(root, `.tenet/migration-evidence-v2/${operationId}`);
    unlinkSync(join(base, "target.json"));
    const evidence = readFileSync(join(base, "evidence.json"));
    assert.throws(() => cleanupCandidateEvidence(root, operationId), /cleanup|prefix|evidence/i);
    assert.equal(existsSync(join(base, "source.json")), true);
    assert.deepEqual(readFileSync(join(base, "evidence.json")), evidence);
  });

  it("does not certify the legacy schema-1 CLI as usable prior schema", async () => {
    const root = tmp();
    roots.push(root);
    mkdirSync(join(root, ".tenet"));
    writeFileSync(join(root, ".tenet/marker"), JSON.stringify({
      schema: 1, workspaceId: "ws_aaaaaaaaaa", tag: "aaaa", nonce: "aaaaaaaaaaaa", dev: 1, ino: 2,
    }));
    writeFileSync(join(root, ".tenet/state"), JSON.stringify({ schema: 1, work: {} }));
    let probed = false;
    await assert.rejects(() => runCandidatePostcondition(root, {
      operationId, acceptance: "1".repeat(64), terminal: "2".repeat(64),
      evidence: "3".repeat(64), snapshot: "4".repeat(64), bridgeDigest: "5".repeat(64),
      probe: async () => { probed = true; return { exit: 0, handle: "W1.1.aaaa" }; },
    }), /acceptance|retained|missing|rollback|schema/i);
    assert.equal(probed, false);
    assert.equal(existsSync(join(root, ".tenet/migration-evidence-v2")), false);
  });
});
