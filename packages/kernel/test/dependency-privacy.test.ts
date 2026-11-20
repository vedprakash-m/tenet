import { mock, test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import { admitDependencyPair, DependencySnapshotV1 } from "../src/adapters/dependency-privacy.ts";
import { dependencyRestoreStep, type DependencyRestoreStep } from "../src/core/dependency-admission.ts";
import { sha256, stableStringify } from "../src/core/ids.ts";

const bytes = (text: string): Uint8Array => Buffer.from(text);

test("[SEC-05] dependency restoration distinguishes complete pairs from interrupted partial restoration", () => {
  const complete: Record<string, DependencyRestoreStep> = {
    "before/before": { kind: "complete" }, "before/unchanged": { kind: "complete" },
    "unchanged/before": { kind: "complete" }, "unchanged/unchanged": { kind: "complete" },
  };
  const rows: Record<"admit" | "prepared", Record<string, DependencyRestoreStep>> = {
    admit: {
      ...complete, "after/after": { kind: "prepare" },
      "after/unchanged": { kind: "prepare" }, "unchanged/after": { kind: "prepare" },
    },
    prepared: {
      ...complete, "after/after": { kind: "replace", target: "manifest" },
      "after/before": { kind: "replace", target: "manifest" },
      "after/unchanged": { kind: "replace", target: "manifest" },
      "before/after": { kind: "replace", target: "lock" },
      "unchanged/after": { kind: "replace", target: "lock" },
    },
  };
  for (const phase of ["admit", "prepared"] as const) {
    for (const manifest of ["before", "after", "unchanged", "unavailable"] as const) {
      for (const lock of ["before", "after", "unchanged", "unavailable"] as const) {
        const observed = { phase, manifest, lock }, original = { ...observed };
        const refused = { kind: "refuse", code: phase === "admit" ? "revision-conflict" : "effect-uncertain" };
        const expected = rows[phase][`${manifest}/${lock}`] ?? refused;
        assert.deepEqual(dependencyRestoreStep(observed), expected, JSON.stringify(observed));
        assert.deepEqual(observed, original);
      }
    }
  }
});

test("[SEC-11] dependency restoration refuses undeclared positions and never hashes legacy values", () => {
  const hash = mock.method(crypto, "createHash", () => assert.fail("restoration classification reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const value of [
      null, {}, { phase: "unknown", manifest: "after", lock: "after" },
      { phase: "prepared", manifest: "after", lock: "after", legacy: "synthetic unproven body" },
      { phase: "prepared", manifest: "synthetic legacy digest", lock: "after" },
      { manifest: "before", lock: "before" },
    ]) assert.deepEqual(dependencyRestoreStep(value), { kind: "refuse", code: "effect-uncertain" });
    assert.deepEqual(dependencyRestoreStep({ phase: "prepared", manifest: "before", lock: "after" }),
      { kind: "replace", target: "lock" });
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});

test("[SEC-05] [SEC-11] dependency privacy admits one closed npm pair and preserves exact CRLF bytes", () => {
  const manifest = '{\r\n  "name": "safe-package", "version": "1.2.3", "dependencies": {"other": "^2.0.0"}\r\n}\r\n';
  const lock = '{"lockfileVersion":3,"packages":{"":{"name":"safe-package","version":"1.2.3"},"node_modules/other":{"version":"2.0.0"}}}\n';
  const snapshot = {
    format: "tenet.dependency-pair", version: 1, manager: "npm",
    manifest: { present: true, bytes: manifest }, lock: { present: true, bytes: lock },
  };
  assert.deepEqual(admitDependencyPair("npm", bytes(manifest), bytes(lock)), {
    status: "admitted", snapshot, blob: sha256(stableStringify(snapshot)),
  });
  assert.equal(DependencySnapshotV1.safeParse(snapshot).success, true);
  const absent = admitDependencyPair("npm", bytes("{}"), null);
  assert.equal(absent.status, "admitted");
  if (absent.status === "admitted") assert.deepEqual(absent.snapshot.lock, { present: false });
  const empty = admitDependencyPair("npm", bytes("{}"), bytes('{"lockfileVersion":3,"packages":{"":{}}}'));
  assert.equal(empty.status, "admitted");
  if (absent.status === "admitted" && empty.status === "admitted") assert.notEqual(absent.blob, empty.blob);
});

  test("[SEC-11] dependency privacy refuses unsupported metadata, duplicate keys and invalid bytes before hashing", () => {
    const hash = mock.method(crypto, "createHash", () => assert.fail("unadmitted dependency content reached hashing"));
    syncBuiltinESMExports();
    try {
      assert.deepEqual(admitDependencyPair("yarn", bytes("{}"), null), { status: "refused", reason: "capability-missing" });
      const manifests = [
        '{"syntheticUnknown":"synthetic private text"}', '{"scripts":{"install":"synthetic command"}}',
        '{"name":"safe"}', '{"version":"1.0.0"}', '{"name":"UPPER","version":"1.0.0"}',
        '{"name":"_unsafe","version":"1.0.0"}', '{"name":"safe","version":"01.0.0"}',
        '{"name":"safe","version":"1.0.0-01"}', '{"dependencies":{"safe":"latest"}}',
        '{"dependencies":{"safe":"file:synthetic"}}', '{"dependencies":{"safe":"https://example.invalid/synthetic"}}',
        '{"dependencies":{"__proto__":"1.0.0"}}', '{"private":true,"private":false}',
        '{"private":true,"\\u0070rivate":false}', '{"private":"true"}', '{"private":true,}',
        '{"peerDependenciesMeta":{"safe":{"syntheticUnknown":true}}}', '\uFEFF{}', "{}\0", '{"private":true} // comment',
        JSON.stringify({ dependencies: Object.fromEntries(Array.from({ length: 201 }, (_, index) => [`safe-${index}`, "1.0.0"])) }),
      ];
      for (const manifest of manifests)
        assert.deepEqual(admitDependencyPair("npm", bytes(manifest), null), { status: "refused", reason: "capability-missing" }, manifest);
      for (const input of [null, new Uint8Array([0xc3, 0x28]), bytes(" ".repeat(1024 * 1024 + 1))])
        assert.deepEqual(admitDependencyPair("npm", input, null), { status: "refused", reason: "capability-missing" });
      const locks = [
        "{}", '{"lockfileVersion":2,"packages":{}}', '{"lockfileVersion":3,"packages":{}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","bin":"synthetic"}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","link":true}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","resolved":"https://example.invalid/safe"}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","resolved":"https://registry.npmjs.org/other/-/other-1.0.0.tgz"}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","resolved":"https://registry.npmjs.org/safe/-/safe-2.0.0.tgz"}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/../safe":{"version":"1.0.0"}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","license":"synthetic expression"}}}',
        '{"lockfileVersion":3,"packages":{"":{},"node_modules/safe":{"version":"1.0.0","integrity":"sha512-synthetic"}}}',
      ];
      for (const lock of locks)
        assert.deepEqual(admitDependencyPair("npm", bytes("{}"), bytes(lock)), { status: "refused", reason: "capability-missing" }, lock);
      assert.equal(hash.mock.callCount(), 0);
    } finally {
      hash.mock.restore();
      syncBuiltinESMExports();
    }
  });

  const pnpm = [
    "lockfileVersion: '9.0'", "settings:", "  autoInstallPeers: true", "importers:", "  .:", "    dependencies:",
    "      safe:", "        specifier: ^1.0.0", "        version: 1.0.0", "packages:", "  safe@1.0.0:",
    "    resolution:", `      integrity: sha512-${"A".repeat(86)}==`, "",
  ].join("\n");
  test("[SEC-05] dependency privacy admits ordinary pnpm v9 AST scalars and exact lock bytes", () => {
    const admitted = admitDependencyPair("pnpm", bytes('{"dependencies":{"safe":"^1.0.0"}}'), bytes(pnpm));
    assert.equal(admitted.status, "admitted");
    if (admitted.status === "admitted") assert.deepEqual(admitted.snapshot.lock, { present: true, bytes: pnpm });
  });

  test("[SEC-11] dependency privacy rejects pnpm comments, aliases, tags, flow and nonclosed scalar fields", () => {
    for (const lock of [
      `# synthetic comment\n${pnpm}`, pnpm.replace("autoInstallPeers: true", "autoInstallPeers: true # synthetic comment"),
      pnpm.replace("autoInstallPeers: true", "autoInstallPeers: yes"),
      pnpm.replace("autoInstallPeers: true", "autoInstallPeers: true\n  autoInstallPeers: false"),
      pnpm.replace("settings:\n  autoInstallPeers: true", "settings: {autoInstallPeers: true}"),
      pnpm.replace("settings:", "settings: &synthetic"), `${pnpm}snapshots: *synthetic\n`,
      pnpm.replace("autoInstallPeers: true", "autoInstallPeers: !!bool true"),
      pnpm.replace("specifier: ^1.0.0", "specifier: |\n          ^1.0.0"),
      pnpm.replace("version: 1.0.0", "version: 01.0.0"),
      pnpm.replace("safe@1.0.0:", "safe@1.0.0(peer@1.0.0):"), `${pnpm}snapshots:\n  synthetic: value\n`,
    ]) assert.deepEqual(admitDependencyPair("pnpm", bytes("{}"), bytes(lock)), { status: "refused", reason: "capability-missing" }, lock);
  });

test("[SEC-11] dependency privacy refuses every explicit YAML directive before hashing", () => {
  const directives = [
    "%TAG !private! tag:example.invalid,2026:synthetic-private-one/",
    "%TAG !! tag:yaml.org,2002:", "%YAML 1.2", "%SYNTHETIC synthetic-private-two",
  ];
  const hash = mock.method(crypto, "createHash", () => assert.fail("unadmitted YAML directive reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const newline of ["\n", "\r\n", "\r"]) for (const directive of directives)
      for (const prefix of ["", `${newline}\uFEFF`, `${newline}\uFEFF\uFEFF`]) {
        const lock = `${prefix}${directive}${newline}---${newline}${pnpm.replaceAll("\n", newline)}`;
        assert.deepEqual(admitDependencyPair("pnpm", bytes("{}"), bytes(lock)), {
          status: "refused", reason: "capability-missing",
        });
      }
    assert.equal(hash.mock.callCount(), 0);
  } finally { hash.mock.restore(); syncBuiltinESMExports(); }
});

  test("[SEC-11] dependency privacy admits exact byte and dependency count bounds and refuses one over", () => {
    const maximum = 1024 * 1024, manifest = `{}`.padEnd(maximum, " ");
    assert.equal(admitDependencyPair("npm", bytes(manifest), null).status, "admitted");
    assert.equal(admitDependencyPair("npm", bytes(`${manifest} `), null).status, "refused");
    const dependencies = Object.fromEntries(Array.from({ length: 200 }, (_, index) => [`safe-${index}`, "~1.2.3-beta.1+build"]));
    assert.equal(admitDependencyPair("npm", bytes(JSON.stringify({ dependencies })), null).status, "admitted");
    dependencies["safe-over"] = "1.2.3";
    assert.equal(admitDependencyPair("npm", bytes(JSON.stringify({ dependencies })), null).status, "refused");
  });

test("[SEC-05] [SEC-11] dependency privacy admits literal empty pnpm maps only within the closed map domain", () => {
  const minimal = "lockfileVersion: '9.0'\r\nimporters:\r\n  .: {}\r\npackages: {}\r\n";
  const locks = [
    minimal, `settings: {}\r\noverrides: {}\r\n${minimal}`,
    "lockfileVersion: '9.0'\nimporters:\n  .:\n    dependencies: {}\n    devDependencies: {}\n    optionalDependencies: {}\npackages: {}\n",
    `${pnpm}    engines: {}\n    peerDependencies: {}\n    peerDependenciesMeta: {}\n`,
    `${pnpm}    peerDependenciesMeta:\n      safe: {}\n`,
  ];
  for (const lock of locks) {
    const snapshot = {
      format: "tenet.dependency-pair", version: 1, manager: "pnpm",
      manifest: { present: true, bytes: "{}" }, lock: { present: true, bytes: lock },
    };
    assert.deepEqual(admitDependencyPair("pnpm", bytes("{}"), bytes(lock)), {
      status: "admitted", snapshot, blob: sha256(stableStringify(snapshot)),
    }, lock);
  }
  const atLimit = minimal.padEnd(1024 * 1024, " ");
  const admitted = admitDependencyPair("pnpm", bytes("{}"), bytes(atLimit));
  assert.equal(admitted.status, "admitted");
  if (admitted.status === "admitted") assert.deepEqual(admitted.snapshot.lock, { present: true, bytes: atLimit });
  assert.deepEqual(admitDependencyPair("pnpm", bytes("{}"), bytes(`${atLimit} `)), {
    status: "refused", reason: "capability-missing",
  });
});

test("[SEC-11] dependency privacy refuses other flow syntax and misplaced empty maps without hashing", () => {
  const minimal = "lockfileVersion: '9.0'\nimporters:\n  .: {}\npackages: {}\n";
  const locks = [
    ...["{ }", "{\n}", "[]", "{synthetic: {}}"].map(value => minimal.replace("packages: {}", `packages: ${value}`)),
    minimal.replace("  .: {}", "  .: {dependencies: {}}"),
    minimal.replace("importers:\n  .: {}", "importers: {}"),
    minimal.replace("lockfileVersion: '9.0'", "lockfileVersion: {}"),
    `${minimal}syntheticUnknown: {}\n`,
    minimal.replace("  .: {}", "  .:\n    dependencies:\n      safe: {}"),
    minimal.replace("packages: {}", "packages:\n  safe@1.0.0: {}"),
    pnpm.replace(`integrity: sha512-${"A".repeat(86)}==`, "integrity: {}"),
    pnpm.replace(`resolution:\n      integrity: sha512-${"A".repeat(86)}==`, "resolution: {}"),
    `${pnpm}    os: {}\n`, `${pnpm}    syntheticUnknown: {}\n`,
    `${pnpm}    engines:\n      node: {}\n`,
    `${pnpm}    peerDependenciesMeta:\n      safe:\n        optional: {}\n`,
    minimal.replace("packages: {}", "packages: &synthetic {}"),
    minimal.replace("packages: {}", "packages: !!map {}"),
    minimal.replace("packages: {}", "packages: {} # synthetic"),
    `${minimal}settings: {}\nsettings: {}\n`,
    minimal.replace("packages: {}", "packages: '{}'\n"),
  ];
  const hash = mock.method(crypto, "createHash", () => assert.fail("unadmitted YAML flow syntax reached hashing"));
  syncBuiltinESMExports();
  try {
    for (const lock of locks)
      assert.deepEqual(admitDependencyPair("pnpm", bytes("{}"), bytes(lock)), {
        status: "refused", reason: "capability-missing",
      }, lock);
    assert.equal(hash.mock.callCount(), 0);
  } finally {
    hash.mock.restore();
    syncBuiltinESMExports();
  }
});
