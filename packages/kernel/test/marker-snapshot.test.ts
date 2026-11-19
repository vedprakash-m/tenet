import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { cleanup, tmp } from "./helpers.ts";
import { sha256 } from "../src/core/ids.ts";
import { captureCandidateSnapshot } from "../src/adapters/marker-snapshot.ts";
import { publishCandidateTarget, restoreCandidateSnapshot } from "../src/adapters/marker-rollback.ts";
import { MarkerV3 } from "../src/core/marker-identity.ts";
import { withCandidateLocks } from "../src/adapters/marker-lock.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const operationId = "a".repeat(32);
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
const prospectiveMarker = (root: string) => {
  const stat = lstatSync(join(root, ".tenet"), { bigint: true });
  return MarkerV3.parse({
    schema: 3,
    workspaceId: "ws_bbbbbbbbbb",
    tag: "bcdf",
    nonce: "bbbbbbbbbbbb",
    dev: Number(stat.dev),
    ino: Number(stat.ino),
    identity: {
      kind: "directory-v1", platform: qualification.platform, architecture: qualification.architecture,
      filesystem: qualification.filesystem, dev: String(stat.dev), ino: String(stat.ino), birthNs: String(stat.birthtimeNs),
    },
    binding: { kind: "none", reason: "host-storage-verified-absent", capability: "c".repeat(64) },
  });
};
function fixture() {
  const root = tmp();
  roots.push(root);
  const dir = join(root, ".tenet");
  mkdirSync(join(dir, "blobs"), { recursive: true });
  writeFileSync(join(dir, "marker"), '{"schema":2,"workspaceId":"ws_aaaaaaaaaa","tag":"aaaa","dev":1,"ino":2,"nonce":"n"}');
  writeFileSync(join(dir, "state"), '{"schema":2,"revision":7,"unknown":"preserve"}\n');
  writeFileSync(join(dir, "log"), Buffer.from([0, 1, 2, 255]));
  writeFileSync(join(dir, ".gitignore"), "*\n");
  writeFileSync(join(dir, "blobs", "d".repeat(64)), "blob bytes");
  writeFileSync(join(dir, "mode.sh"), "#!/bin/sh\nexit 0\n");
  chmodSync(join(dir, "mode.sh"), 0o751);
  return { root, dir };
}
const options = (root: string) => ({
  operationId,
  ownership: { kind: "attested-v1", digest: "b".repeat(64) } as const,
  marker: prospectiveMarker(root),
  previousBridgeDigest: "d".repeat(64),
  qualification,
  binding,
});

describe("candidate migration source snapshot [CON-03, CON-04, SEC-12]", () => {
  it("serializes candidate writes through the historical bootstrap and normal lock", () => {
    const { root, dir } = fixture();
    const marker = readFileSync(join(dir, "marker"));
    assert.throws(() => withCandidateLocks(root, operationId, () =>
      captureCandidateSnapshot(root, options(root))), (error: unknown) =>
      error instanceof Error && "reasons" in error &&
      (error as { reasons: Array<{ code: string }> }).reasons[0]?.code === "kernel-busy");
    assert.deepEqual(readFileSync(join(dir, "marker")), marker);
    assert.equal(existsSync(join(dir, "migration-transition.json")), false);
  });

  it("publishes source manifest, prepared fence and the complete exact byte/object graph", () => {
    const { root, dir } = fixture();
    const sourceMarker = readFileSync(join(dir, "marker"));
    const sourceState = readFileSync(join(dir, "state"));
    const captured = captureCandidateSnapshot(root, options(root));
    assert.equal(captured.rollbackEligible, false);
    assert.equal(readFileSync(join(dir, "marker")).toString("hex"), sourceMarker.toString("hex"));
    assert.equal(readFileSync(join(dir, "state")).toString("hex"), sourceState.toString("hex"));
    assert.equal(existsSync(join(dir, "migration-recovery-v3.json")), false);
    const evidence = join(dir, `migration-evidence-v2/${operationId}`);
    assert.equal(readdirSync(evidence).includes("source.json.tmp"), false);
    const manifest = JSON.parse(readFileSync(join(evidence, "source.json"), "utf8"));
    assert.equal(manifest.format, 2);
    assert.equal(manifest.operationId, operationId);
    assert.equal(manifest.marker, sha256(sourceMarker));
    assert.deepEqual(manifest.entries.map((entry: { path: string }) => entry.path),
      [...manifest.entries.map((entry: { path: string }) => entry.path)].sort());
    const paths = new Set(manifest.entries.map((entry: { path: string }) => entry.path));
    for (const required of ["marker", "state", "state.prev", "log", "summaries.json"]) assert.equal(paths.has(required), true);
    const executable = manifest.entries.find((entry: { path: string }) => entry.path === "mode.sh");
    assert.equal(executable.mode, (lstatSync(join(dir, "mode.sh")).mode & 0o7777).toString(8));
    const log = manifest.entries.find((entry: { path: string }) => entry.path === "log");
    assert.equal(log.kind, "file");
    assert.equal(log.sha256, sha256(Buffer.from([0, 1, 2, 255])));
    const transition = JSON.parse(readFileSync(join(dir, "migration-transition.json"), "utf8"));
    assert.equal(transition.phase, "prepared");
    assert.equal(transition.recovery.rollbackEligible, false);
    assert.equal(transition.recovery.snapshotSha256, captured.snapshotSha256);
    const snapshot = JSON.parse(readFileSync(join(dir, `migration-snapshot-v3/${operationId}/snapshot.json`), "utf8"));
    assert.equal(sha256(readFileSync(join(dir, snapshot.sourceManifest))), transition.recovery.manifestSha256);
    assert.equal(sha256(readFileSync(join(dir, `migration-snapshot-v3/${operationId}/snapshot.json`))), captured.snapshotSha256);
    const byPath = new Map(snapshot.entries.map((entry: { path: string }) => [entry.path, entry]));
    const object = (byPath.get("log") as { object: string }).object;
    assert.deepEqual(readFileSync(join(dir, `migration-snapshot-v3/${operationId}`, object)), Buffer.from([0, 1, 2, 255]));
    assert.equal(existsSync(join(dir, "migration-recovery-v3.json")), false);
  });

  it("re-admits the source and graph idempotently without recreating the source manifest", () => {
    const { root, dir } = fixture();
    const first = captureCandidateSnapshot(root, options(root));
    const source = join(dir, `migration-evidence-v2/${operationId}/source.json`);
    const bytes = readFileSync(source);
    const second = captureCandidateSnapshot(root, options(root));
    assert.deepEqual(second, first);
    assert.deepEqual(readFileSync(source), bytes);
  });

  it("refuses partial direct-final manifests and changed source without overwriting bytes", () => {
    for (const corrupt of ["partial", "source-changed"]) {
      const { root, dir } = fixture();
      if (corrupt === "partial") {
        mkdirSync(join(dir, `migration-evidence-v2/${operationId}`), { recursive: true });
        writeFileSync(join(dir, `migration-evidence-v2/${operationId}/source.json`), "{");
      } else captureCandidateSnapshot(root, options(root));
      if (corrupt === "source-changed") writeFileSync(join(dir, "state"), '{"schema":2,"revision":8}\n');
      const before = readFileSync(join(dir, `migration-evidence-v2/${operationId}/source.json`));
      assert.throws(() => captureCandidateSnapshot(root, options(root)), /unsupported|changed|partial|manifest/i);
      assert.deepEqual(readFileSync(join(dir, `migration-evidence-v2/${operationId}/source.json`)), before);
      assert.equal(existsSync(join(dir, "migration-recovery-v3.json")), false);
    }
  });

  it("requires explicit attested ownership before creating metadata", () => {
    const { root, dir } = fixture();
    assert.throws(() => captureCandidateSnapshot(root, {
      ...options(root), ownership: { kind: "legacy-unproven", digest: "e".repeat(64) },
    } as never), /attested|ownership|manifest/i);
    assert.equal(existsSync(join(dir, "migration-transition.json")), false);
    assert.equal(existsSync(join(dir, "migration-evidence-v2")), false);
  });

  it("refuses a pre-existing migration terminal instead of dropping or replacing it", () => {
    const { root, dir } = fixture();
    const terminal = join(dir, "migration-terminal.json");
    writeFileSync(terminal, '{"protocolVersion":1,"historical":true}');
    assert.throws(() => captureCandidateSnapshot(root, options(root)), /terminal|source transition/i);
    assert.equal(readFileSync(terminal, "utf8"), '{"protocolVersion":1,"historical":true}');
    assert.equal(existsSync(join(dir, "migration-transition.json")), false);
  });

  it("refuses a prospective marker with a different exact directory identity before publishing", () => {
    const { root, dir } = fixture();
    const candidate = options(root);
    candidate.marker = {
      ...candidate.marker,
      identity: { ...candidate.marker.identity, birthNs: "1700000000000000001" },
    };
    assert.throws(() => captureCandidateSnapshot(root, candidate), /directory identity|identity differs/i);
    assert.equal(existsSync(join(dir, "migration-evidence-v2")), false);
  });

  it("does not strengthen or invalidate a fixed unbound marker when host status later changes", () => {
    const { root, dir } = fixture();
    const candidate = options(root);
    candidate.binding = {
      status: () => { throw new Error("host storage is now unavailable"); },
      create: () => assert.fail("an existing unbound marker cannot be strengthened"),
      verify: () => assert.fail("an unbound marker has no key to verify"),
    };
    captureCandidateSnapshot(root, candidate);
    const marker = JSON.parse(readFileSync(join(dir, "marker"), "utf8"));
    assert.equal(marker.schema, 2);
    const transition = JSON.parse(readFileSync(join(dir, "migration-transition.json"), "utf8"));
    assert.equal(transition.marker.binding.kind, "none");
  });
});

describe("candidate marker-last rollback [CON-03, LFC-04]", () => {
  it("restores every source byte, mode and absence from the object snapshot with marker last", () => {
    const { root, dir } = fixture();
    const captured = captureCandidateSnapshot(root, options(root));
    const source = new Map([
      ["marker", readFileSync(join(dir, "marker"))],
      ["state", readFileSync(join(dir, "state"))],
      ["log", readFileSync(join(dir, "log"))],
      [".gitignore", readFileSync(join(dir, ".gitignore"))],
      ["mode.sh", readFileSync(join(dir, "mode.sh"))],
      [`blobs/${"d".repeat(64)}`, readFileSync(join(dir, "blobs", "d".repeat(64)))],
    ]);
    publishCandidateTarget(root, {
      operationId,
      state: '{"schema":3,"revision":9,"newer":true}',
      previousBridgeDigest: options(root).previousBridgeDigest,
      previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
      writes: [
        { path: "state.prev", bytes: '{"schema":3,"revision":8}' },
        { path: "log", bytes: "target log" },
        { path: ".gitignore", bytes: "target" },
        { path: "target-only", bytes: "remove" },
        { path: "mode.sh", bytes: "target mode" },
      ],
      removes: [`blobs/${"d".repeat(64)}`],
      qualification,
      binding,
    });
    const restored = restoreCandidateSnapshot(root, {
      operationId,
      previousBridgeDigest: options(root).previousBridgeDigest,
      qualification,
      binding,
    });
    assert.equal(restored.restored.at(-1), "marker");
    assert.equal(restored.snapshotSha256, captured.snapshotSha256);
    for (const [path, bytes] of source) assert.deepEqual(readFileSync(join(dir, path)), bytes, path);
    assert.equal(existsSync(join(dir, "state.prev")), false);
    assert.equal(existsSync(join(dir, "target-only")), false);
    assert.equal(
      (lstatSync(join(dir, "mode.sh")).mode & 0o7777).toString(8),
      (JSON.parse(readFileSync(join(dir, `migration-evidence-v2/${operationId}/source.json`), "utf8"))
        .entries as Array<{ path: string; mode: string }>).find((entry) => entry.path === "mode.sh")!.mode,
    );
    const terminal = JSON.parse(readFileSync(join(dir, "migration-terminal.json"), "utf8"));
    assert.equal(terminal.versions.from, 3);
    assert.equal(terminal.versions.to, 2);
    assert.equal(terminal.outcome, "rolled-back");
    assert.equal(existsSync(join(dir, "migration-transition.json")), false);
  });

  it("refuses a changed or missing snapshot object before changing an ordinary path", () => {
    const { root, dir } = fixture();
    captureCandidateSnapshot(root, options(root));
    const snapshotPath = join(dir, `migration-snapshot-v3/${operationId}/snapshot.json`);
    const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8"));
    const first = snapshot.entries.find((entry: { kind: string }) => entry.kind === "file");
    const object = join(dir, `migration-snapshot-v3/${operationId}`, first.object);
    const changed = readFileSync(object);
    writeFileSync(object, Buffer.concat([changed, Buffer.from("x")]));
    writeFileSync(join(dir, "state"), "target state");
    const marker = readFileSync(join(dir, "marker"));
    assert.throws(() => restoreCandidateSnapshot(root, {
      operationId, previousBridgeDigest: options(root).previousBridgeDigest,
      qualification, binding,
    }), /snapshot|object|hash/i);
    assert.equal(readFileSync(join(dir, "state"), "utf8"), "target state");
    assert.deepEqual(readFileSync(join(dir, "marker")), marker);
    assert.equal(existsSync(join(dir, "migration-transition.json")), true, "prepared forward fence remains");
  });

  it("refuses a snapshot object link even when its target has the expected bytes", () => {
    const { root, dir } = fixture();
    captureCandidateSnapshot(root, options(root));
    publishCandidateTarget(root, {
      operationId,
      state: '{"schema":3,"revision":8}',
      previousBridgeDigest: "d".repeat(64),
      previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
      writes: [],
      removes: [],
      qualification,
      binding,
    });
    const snapshot = JSON.parse(readFileSync(
      join(dir, `migration-snapshot-v3/${operationId}/snapshot.json`), "utf8",
    ));
    const file = snapshot.entries.find((entry: { kind: string }) => entry.kind === "file");
    const object = join(dir, `migration-snapshot-v3/${operationId}`, file.object);
    const bytes = readFileSync(object);
    const outsideRoot = tmp();
    roots.push(outsideRoot);
    const outside = join(outsideRoot, "linked-object");
    writeFileSync(outside, bytes);
    unlinkSync(object);
    symlinkSync(outside, object);
    assert.throws(() => restoreCandidateSnapshot(root, {
      operationId, previousBridgeDigest: "d".repeat(64), qualification, binding,
    }), /snapshot object|no-follow|linked/i);
  });

  it("preserves an unexpected terminal instead of replacing it after marker-last restoration", () => {
    const { root, dir } = fixture();
    captureCandidateSnapshot(root, options(root));
    publishCandidateTarget(root, {
      operationId,
      state: '{"schema":3,"revision":8}',
      previousBridgeDigest: "d".repeat(64),
      previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
      writes: [],
      removes: [],
      qualification,
      binding,
    });
    writeFileSync(join(dir, "migration-terminal.json"), "foreign terminal");
    assert.throws(() => restoreCandidateSnapshot(root, {
      operationId, previousBridgeDigest: "d".repeat(64), qualification, binding,
    }), /terminal.*differs/i);
    assert.equal(readFileSync(join(dir, "migration-terminal.json"), "utf8"), "foreign terminal");
    assert.equal(JSON.parse(readFileSync(join(dir, "marker"), "utf8")).schema, 2);
  });

  it("refuses a recovery record that names a different source graph", () => {
    const { root, dir } = fixture();
    captureCandidateSnapshot(root, options(root));
    publishCandidateTarget(root, {
      operationId,
      state: '{"schema":3,"revision":8}',
      previousBridgeDigest: "d".repeat(64),
      previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
      writes: [],
      removes: [],
      qualification,
      binding,
    });
    const path = join(dir, "migration-recovery-v3.json");
    const record = JSON.parse(readFileSync(path, "utf8"));
    record.sourceManifest = `migration-evidence-v2/${"e".repeat(32)}/source.json`;
    writeFileSync(path, JSON.stringify(record));
    assert.throws(() => restoreCandidateSnapshot(root, {
      operationId, previousBridgeDigest: "d".repeat(64), qualification, binding,
    }), /recovery|operation|source/i);
    assert.equal(JSON.parse(readFileSync(join(dir, "marker"), "utf8")).schema, 3);
  });
});

describe("candidate forward publication crash prefixes [CON-03, LFC-04]", () => {
  const fixtureScript = join(import.meta.dirname, "fixtures/crash-marker-forward.ts");
  const run = (root: string, point: string) => {
    const child = spawn(process.execPath, [fixtureScript, root, point], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
    return new Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string;
      value?: { ok: boolean; message?: string } }>((resolve) => {
      child.on("exit", (code, signal) => {
        let value: { ok: boolean; message?: string } | undefined;
        try { value = JSON.parse(stdout.trim()); } catch { /* killed before a result */ }
        resolve({ code, signal, stderr, ...(value ? { value } : {}) });
      });
    });
  };
  for (const point of [
    "after-marker-file-sync",
    "after-marker-rename",
    "after-marker-installed",
    "after-state-file-sync",
    "after-state-rename",
    "after-state-published",
    "after-target-rename",
    "after-evidence-rename",
    "after-migration-evidence-installed",
    "after-recovery-temp-sync",
    "after-recovery-rename",
    "after-transition-removal",
  ]) {
    it(`resumes the exact ${point} forward prefix twice`, async () => {
      const { root, dir } = fixture();
      const sourceMarker = readFileSync(join(dir, "marker")), sourceState = readFileSync(join(dir, "state"));
      captureCandidateSnapshot(root, options(root));
      const killed = await run(root, point);
      if (process.platform === "win32") assert.equal(killed.code, 1, `${point}: ${JSON.stringify(killed)}`);
      else assert.equal(killed.signal, "SIGKILL", `${point}: ${JSON.stringify(killed)}`);
      for (let restart = 0; restart < 2; restart++) {
        const resumed = await run(root, "resume");
        assert.equal(resumed.value?.ok, true, `${point}: ${JSON.stringify(resumed)}`);
      }
      assert.notDeepEqual(readFileSync(join(dir, "marker")), sourceMarker);
      assert.notDeepEqual(readFileSync(join(dir, "state")), sourceState);
      assert.equal(existsSync(join(dir, "migration-transition.json")), false);
      const recovery = JSON.parse(readFileSync(join(dir, "migration-recovery-v3.json"), "utf8"));
      assert.equal(recovery.outcome, "applied");
      assert.equal(recovery.rollbackEligible, true);
    });
  }

  it("refuses a third target value after state-published instead of inventing a new baseline", async () => {
    const { root, dir } = fixture();
    captureCandidateSnapshot(root, options(root));
    const killed = await run(root, "after-state-published");
    if (process.platform === "win32") assert.equal(killed.code, 1);
    else assert.equal(killed.signal, "SIGKILL");
    const marker = readFileSync(join(dir, "marker"));
    writeFileSync(join(dir, "state"), '{"schema":3,"revision":999,"tampered":true}');
    const refused = await run(root, "resume");
    assert.equal(refused.value?.ok, false, JSON.stringify(refused));
    assert.equal(readFileSync(join(dir, "state"), "utf8"), '{"schema":3,"revision":999,"tampered":true}');
    assert.deepEqual(readFileSync(join(dir, "marker")), marker);
    assert.equal(existsSync(join(dir, `migration-evidence-v2/${operationId}/target.json`)), false);
  });
});

describe("candidate rollback crash prefixes [CON-03, LFC-04]", () => {
  const fixtureScript = join(import.meta.dirname, "fixtures/crash-marker-rollback.ts");
  const run = (root: string, point: string) => {
    const child = spawn(process.execPath, [fixtureScript, root, point], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
    return new Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string;
      value?: { ok: boolean; message?: string } }>((resolve) => {
      child.on("exit", (code, signal) => {
        let value: { ok: boolean; message?: string } | undefined;
        try { value = JSON.parse(stdout.trim()); } catch { /* killed before a result */ }
        resolve({ code, signal, stderr, ...(value ? { value } : {}) });
      });
    });
  };
  const prepare = (root: string) => publishCandidateTarget(root, {
    operationId,
    state: '{"schema":3,"revision":9,"newer":true}',
    previousBridgeDigest: "d".repeat(64),
    previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
    writes: [
      { path: "state.prev", bytes: '{"schema":3,"revision":8}' },
      { path: "log", bytes: "target log" },
      { path: "target-only", bytes: "remove" },
    ],
    removes: [`blobs/${"d".repeat(64)}`],
    qualification,
    binding,
  });
  for (const point of [
    "after-transition-rename", "after-stage-sync",
    "after-rollback-previous-staged", "after-rollback-primary-staged",
    "after-previous-entry", "after-rollback-previous-restored",
    "after-state-rename", "after-rollback-primary-restored",
    "after-recovery-removal", "after-rollback-recovery-removed",
    "after-marker-rename", "after-rollback-marker-restored",
    "after-terminal-rename", "after-rollback-terminal-published",
    "after-transition-removal",
  ]) {
    it(`resumes the exact ${point} rollback prefix twice`, async () => {
      const { root, dir } = fixture();
      const sourceMarker = readFileSync(join(dir, "marker")), sourceState = readFileSync(join(dir, "state"));
      captureCandidateSnapshot(root, options(root));
      prepare(root);
      const killed = await run(root, point);
      if (process.platform === "win32") assert.equal(killed.code, 1, `${point}: ${JSON.stringify(killed)}`);
      else assert.equal(killed.signal, "SIGKILL", `${point}: ${JSON.stringify(killed)}`);
      for (let restart = 0; restart < 2; restart++) {
        const resumed = await run(root, "resume");
        assert.equal(resumed.value?.ok, true, `${point}: ${JSON.stringify(resumed)}`);
      }
      assert.deepEqual(readFileSync(join(dir, "marker")), sourceMarker);
      assert.deepEqual(readFileSync(join(dir, "state")), sourceState);
      assert.equal(existsSync(join(dir, "migration-transition.json")), false);
      assert.equal(existsSync(join(dir, "migration-recovery-v3.json")), false);
      assert.equal(existsSync(join(dir, "target-only")), false);
      assert.equal(existsSync(join(dir, "migration-terminal.json")), true);
    });
  }
});

describe("candidate source snapshot crash prefixes [CON-03, CON-04]", () => {
  const fixtureScript = join(import.meta.dirname, "fixtures/crash-marker-snapshot.ts");
  const run = (root: string, point: string) => {
    const child = spawn(process.execPath, [fixtureScript, root, point], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk; });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk; });
    return new Promise<{ code: number | null; signal: NodeJS.Signals | null; stderr: string;
      value?: { ok: boolean; message?: string } }>((resolve) => {
      child.on("exit", (code, signal) => {
        let value: { ok: boolean; message?: string } | undefined;
        try { value = JSON.parse(stdout.trim()); } catch { /* killed before a result */ }
        resolve({ code, signal, stderr, ...(value ? { value } : {}) });
      });
    });

  };
  for (const point of [
    "before-source-create",
    "after-source-write",
    "after-source-sync",
    "after-evidence-sync",
    "after-transition-sync",
    "before-transition-rename",
    "after-transition-rename",
    "after-object-sync",
    "after-object-rename",
    "after-snapshot-sync",
    "after-snapshot-rename",
  ]) {
    it(`resumes the exact ${point} prefix twice without changing marker or state`, async () => {
      const { root, dir } = fixture();
      const marker = readFileSync(join(dir, "marker")), state = readFileSync(join(dir, "state"));
      const killed = await run(root, point);
      if (process.platform === "win32") assert.equal(killed.code, 1, `${point}: ${JSON.stringify(killed)}`);
      else assert.equal(killed.signal, "SIGKILL", `${point}: ${JSON.stringify(killed)}`);
      for (let restart = 0; restart < 2; restart++) {
        const resumed = await run(root, "resume");
        assert.equal(resumed.code, 0, point);
        assert.equal(resumed.value?.ok, true, `${point}: ${JSON.stringify(resumed)}`);
      }
      assert.deepEqual(readFileSync(join(dir, "marker")), marker);
      assert.deepEqual(readFileSync(join(dir, "state")), state);
      assert.equal(existsSync(join(dir, "migration-recovery-v3.json")), false);
    });
  }

  it("preserves and refuses a partial direct-final source manifest on two restarts", async () => {
    const { root, dir } = fixture();
    const killed = await run(root, "source-partial");
    if (process.platform === "win32") assert.equal(killed.code, 1);
    else assert.equal(killed.signal, "SIGKILL");
    const bytes = readFileSync(join(dir, `migration-evidence-v2/${operationId}/source.json`));
    for (let restart = 0; restart < 2; restart++) {
      const refused = await run(root, "resume");
      assert.equal(refused.value?.ok, false);
      assert.deepEqual(readFileSync(join(dir, `migration-evidence-v2/${operationId}/source.json`)), bytes);
      assert.equal(existsSync(join(dir, "migration-transition.json")), false);
    }
  });
});
