import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { validateProtocolFile } from "../src/protocol.ts";
import { QualificationTuple } from "../src/tuple.ts";

const roots: string[] = [];
after(() => roots.forEach((root) => rmSync(root, { recursive: true, force: true })));

const tupleKeys = [
  "vscodeVersion", "copilotChatExtensionVersion", "agentHarness", "pluginFormatVersion", "installPath",
  "featureSettings", "copilotPlan", "organizationPolicyProfile", "osVersion", "architecture", "executionTarget",
  "workspaceMode", "recipeVersion", "toolchainVersions",
] as const;

function protocol() {
  const qualificationTuple = Object.fromEntries(tupleKeys.map((key) => [key,
    key === "featureSettings" || key === "toolchainVersions" ? {} : "fixture-value",
  ]));
  const tupleSources = Object.fromEntries(tupleKeys.map((key) => [key,
    { status: "documented", reference: "synthetic fixture" },
  ]));
  return {
    schemaVersion: 1,
    protocolId: "example-case",
    revision: 1,
    purpose: "formative",
    subject: { artifactSha256: "a".repeat(64) },
    qualificationTuple,
    tupleSources,
    cases: [{
      caseId: "example-case",
      request: "Synthetic request text",
      fixtureRefs: [{ path: "fixtures/input.json", sha256: "" }],
      graderRefs: [{ path: "graders/acceptance.mjs", sha256: "" }],
      expected: { endpoint: "findings-only", scope: "working-tree-uncommitted" },
      protectedPaths: ["src/locked.ts"],
      requiredObservations: [{ id: "clean-result", source: "grader", required: true }],
    }],
  };
}

function scratch() {
  const root = mkdtempSync(join(tmpdir(), "tenet-static-protocol-"));
  roots.push(root);
  mkdirSync(join(root, "fixtures"));
  mkdirSync(join(root, "graders"));
  const fixture = Buffer.from("synthetic fixture\n");
  const grader = Buffer.from('throw new Error("grader must never execute during static validation");\n');
  writeFileSync(join(root, "fixtures", "input.json"), fixture);
  writeFileSync(join(root, "graders", "acceptance.mjs"), grader);
  const value = protocol();
  value.cases[0]!.fixtureRefs[0]!.sha256 = createHash("sha256").update(fixture).digest("hex");
  value.cases[0]!.graderRefs[0]!.sha256 = createHash("sha256").update(grader).digest("hex");
  const protocolPath = join(root, "protocol.json");
  const bytes = Buffer.from(JSON.stringify(value, null, 2));
  writeFileSync(protocolPath, bytes);
  return { root, protocolPath, bytes, value };
}

describe("static protocol validation (offline)", () => {
  it("uses the canonical strict PRD qualification-tuple field set", () => {
    assert.deepEqual(Object.keys(QualificationTuple.shape), [
      "vscodeVersion", "copilotChatExtensionVersion", "agentHarness", "pluginFormatVersion", "installPath",
      "featureSettings", "copilotPlan", "organizationPolicyProfile", "osVersion", "architecture", "executionTarget",
      "workspaceMode", "recipeVersion", "toolchainVersions",
    ]);
  });

  it("binds the exact protocol bytes and verifies local artifact hashes without executing them", () => {
    const input = scratch();
    const result = validateProtocolFile(input.protocolPath);
    assert.deepEqual(result, {
      protocolId: "example-case",
      protocolSha256: createHash("sha256").update(input.bytes).digest("hex"),
      caseCount: 1,
      result: "valid-static-protocol",
    });

    const reformattedPath = join(input.root, "reformatted.json");
    writeFileSync(reformattedPath, Buffer.concat([input.bytes, Buffer.from("\n")]));
    assert.notEqual(validateProtocolFile(reformattedPath).protocolSha256, result.protocolSha256);
  });

  it("rejects duplicate keys, including nested and escaped-equivalent keys", () => {
    const input = scratch();
    const source = input.bytes.toString("utf8");
    for (const [index, duplicate] of [
      source.replace('"schemaVersion": 1,', '"schemaVersion": 1,\n  "schemaVersion": 1,'),
      source.replace('"caseId": "example-case",', '"caseId": "example-case", "caseId": "example-case",'),
      source.replace('"protocolId": "example-case",', '"protocolId": "example-case", "\\u0070rotocolId": "example-case",'),
    ].entries()) {
      const path = join(input.root, `duplicate-${index}.json`);
      writeFileSync(path, duplicate);
      assert.throws(() => validateProtocolFile(path));
    }
  });

  it("rejects non-JSON syntax and malformed UTF-8", () => {
    const input = scratch();
    const malformedJson = join(input.root, "yaml-only.json");
    writeFileSync(malformedJson, "schemaVersion: 1\n");
    assert.throws(() => validateProtocolFile(malformedJson));
    const malformedUtf8 = join(input.root, "invalid-utf8.json");
    writeFileSync(malformedUtf8, Buffer.from([0x7b, 0xff, 0x7d]));
    assert.throws(() => validateProtocolFile(malformedUtf8));
  });

  it("rejects invalid tuple provenance, unknown fields, and oversized text", () => {
    const input = scratch();
    const invalid = [
      { ...input.value, unexpected: true },
      { ...input.value, schemaVersion: 2 },
      { ...input.value, tupleSources: { ...input.value.tupleSources, vscodeVersion: { status: "unknown", reference: "not-unknown" } } },
      { ...input.value, cases: [{ ...input.value.cases[0], request: "x".repeat(65_537) }] },
    ];
    for (const [index, value] of invalid.entries()) {
      const path = join(input.root, `invalid-${index}.json`);
      writeFileSync(path, JSON.stringify(value));
      assert.throws(() => validateProtocolFile(path));
    }
  });

  it("rejects traversal, symlinks, directories, and mismatched artifact bytes", () => {
    const input = scratch();
    const protocolLink = join(input.root, "protocol-link.json");
    symlinkSync(input.protocolPath, protocolLink);
    assert.throws(() => validateProtocolFile(protocolLink));

    const traversal = structuredClone(input.value);
    traversal.cases[0]!.fixtureRefs[0]!.path = "../outside.json";
    const traversalPath = join(input.root, "traversal.json");
    writeFileSync(traversalPath, JSON.stringify(traversal));
    assert.throws(() => validateProtocolFile(traversalPath));

    symlinkSync(join(input.root, "fixtures", "input.json"), join(input.root, "fixtures", "linked.json"));
    const linked = structuredClone(input.value);
    linked.cases[0]!.fixtureRefs[0]!.path = "fixtures/linked.json";
    const linkedPath = join(input.root, "linked.json");
    writeFileSync(linkedPath, JSON.stringify(linked));
    assert.throws(() => validateProtocolFile(linkedPath));

    const directory = structuredClone(input.value);
    directory.cases[0]!.fixtureRefs[0]!.path = "fixtures";
    const directoryPath = join(input.root, "directory.json");
    writeFileSync(directoryPath, JSON.stringify(directory));
    assert.throws(() => validateProtocolFile(directoryPath));

    const mismatch = structuredClone(input.value);
    mismatch.cases[0]!.fixtureRefs[0]!.sha256 = "b".repeat(64);
    const mismatchPath = join(input.root, "mismatch.json");
    writeFileSync(mismatchPath, JSON.stringify(mismatch));
    assert.throws(() => validateProtocolFile(mismatchPath));
  });

  it("rejects protocol and artifact files over their byte limits", () => {
    const input = scratch();
    const oversizedProtocol = join(input.root, "oversized-protocol.json");
    writeFileSync(oversizedProtocol, Buffer.alloc(1024 * 1024 + 1, 0x20));
    assert.throws(() => validateProtocolFile(oversizedProtocol));

    const oversizedArtifact = Buffer.alloc(10 * 1024 * 1024 + 1, 0x78);
    writeFileSync(join(input.root, "fixtures", "oversized.bin"), oversizedArtifact);
    const value = structuredClone(input.value);
    value.cases[0]!.fixtureRefs[0] = {
      path: "fixtures/oversized.bin",
      sha256: createHash("sha256").update(oversizedArtifact).digest("hex"),
    };
    const protocolPath = join(input.root, "oversized-artifact.json");
    writeFileSync(protocolPath, JSON.stringify(value));
    assert.throws(() => validateProtocolFile(protocolPath));
  });

  it("CLI distinguishes usage, invalid input, and valid static validation without echoing contents", () => {
    const input = scratch();
    const cli = resolve("tools/eval.ts");
    const major = Number(process.versions.node.split(".")[0]);
    const stripTypes = major < 24 ? ["--experimental-strip-types"] : [];
    const run = (...args: string[]) => spawnSync(process.execPath, [...stripTypes, cli, ...args], { encoding: "utf8" });

    const valid = run("--protocol", input.protocolPath);
    assert.equal(valid.status, 0);
    assert.deepEqual(JSON.parse(valid.stdout), validateProtocolFile(input.protocolPath));

    const secretText = "synthetic request text must not be echoed";
    const invalidPath = join(input.root, "invalid.json");
    writeFileSync(invalidPath, `{ "request": ${JSON.stringify(secretText)}, }`);
    const invalid = run("--protocol", invalidPath);
    assert.equal(invalid.status, 2);
    assert.doesNotMatch(invalid.stderr, /synthetic request text must not be echoed/);

    const usage = run("--unknown");
    assert.equal(usage.status, 1);
  });
});
