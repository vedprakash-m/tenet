import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, newStore, tmp } from "./helpers.ts";
import { SCHEMA_VERSION } from "../src/core/schemas.ts";
import { emptyState } from "../src/core/state.ts";
import { KernelError } from "../src/core/errors.ts";
import { readTerminal } from "../src/adapters/private-record-fs.ts";
import { RollbackTerminalV2 } from "../src/core/marker-transition.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const validTerminal = {
  operationId: "a".repeat(32),
  protocolVersion: 2,
  versions: { from: 3, to: 2 },
  outcome: "rolled-back",
  sourceSetDigest: "b".repeat(64),
  bindingDigest: "c".repeat(64),
  bridgeDigest: "d".repeat(64),
  evidence: {
    locator: `migration-evidence-v2/${"a".repeat(32)}/evidence.json`,
    sha256: "e".repeat(64),
  },
  previous: { tenet: "2.0.0", adapter: "28.0.0", schema: 2, recipe: null },
};

describe("schema-3 activation hold [LFC-04]", () => {
  it("keeps the active schema at 2 and refuses a schema-3 marker without any store change", () => {
    assert.equal(SCHEMA_VERSION, 2);
    const root = tmp();
    roots.push(root);
    const dir = join(root, ".tenet");
    mkdirSync(dir);
    const { dev, ino } = lstatSync(dir);
    const marker = {
      schema: 3,
      workspaceId: "ws_bbbbbbbbbb",
      tag: "bcdf",
      nonce: "bbbbbbbbbbbb",
      dev,
      ino,
      identity: {
        kind: "directory-v1", platform: "win32", architecture: "x64", filesystem: "ntfs",
        dev: String(dev), ino: String(ino), birthNs: "1700000000000000000",
      },
      binding: { kind: "none", reason: "host-storage-verified-absent", capability: "a".repeat(64) },
    };
    writeFileSync(join(dir, "marker"), JSON.stringify(marker));
    writeFileSync(join(dir, "state"), JSON.stringify(emptyState(marker.workspaceId, marker.tag)));
    const before = readdirSync(dir).sort().map((name) => [name, readFileSync(join(dir, name))]);
    const store = newStore(root);
    assert.throws(() => store.read(), (error: unknown) =>
      error instanceof KernelError && error.reasons[0]?.code === "unsupported-record");
    assert.deepEqual(readdirSync(dir).sort().map((name) => [name, readFileSync(join(dir, name))]), before);
    assert.equal(existsSync(join(dir, "lock")), false);
    assert.equal(readdirSync(dir).some((name) => name.startsWith("quarantine-")), false);
  });

  it("admits only the strict protocol-2 terminal in the candidate schema", () => {
    assert.equal(RollbackTerminalV2.safeParse(validTerminal).success, true);
    for (const change of [
      { ...validTerminal, extra: true },
      { ...validTerminal, protocolVersion: 1 },
      { ...validTerminal, versions: { from: 2, to: 1 } },
      { ...validTerminal, sourceSetDigest: "B".repeat(64) },
      { ...validTerminal, previous: { ...validTerminal.previous, schema: 1 } },
      { ...validTerminal, evidence: { ...validTerminal.evidence, extra: true } },
    ]) assert.equal(RollbackTerminalV2.safeParse(change).success, false);
  });

  it("keeps the pre-bridge schema-2 terminal reader from accepting protocol 2", () => {
    const root = tmp();
    roots.push(root);
    const path = join(root, "migration-terminal.json");
    writeFileSync(path, JSON.stringify(validTerminal));
    assert.throws(() => readTerminal(path), (error: unknown) =>
      error instanceof KernelError && error.reasons[0]?.code === "unsupported-record");
    assert.equal(readFileSync(path, "utf8"), JSON.stringify(validTerminal));
  });
});
