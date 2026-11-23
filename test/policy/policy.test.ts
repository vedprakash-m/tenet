import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { tmpRepo } from "../helpers/tmpRepo.ts";
import { loadPolicyModule } from "./loadPolicyModule.ts";

const api = loadPolicyModule();

const lockIntegrity = `sha512-${"A".repeat(86)}==`;

async function fixture(name: string): Promise<string> {
  return readFile(path.join("test", "policy", "fixtures", ...name.split("/")), "utf8");
}

test("loads every alpha.0 level with defaults and caps", async () => {
  const { loadPolicy, ruleMode } = await api;
  for (const [level, effective] of [
    ["observe", "observe"],
    ["protect", "protect"],
    ["verify", "observe"],
    ["assure", "observe"],
  ] as const) {
    const repository = await tmpRepo(`policy-${level}`);
    try {
      await repository.write("tenet.yaml", await fixture(`levels/${level}.yaml`));
      const policy = await loadPolicy({ cwd: repository.path });
      assert.equal(policy.level, effective);
      assert.equal(policy.paths.records, "tenet");
      assert.equal(policy.specs.id_prefix, "R");
      assert.equal(ruleMode(policy, "tests-not-weakened"), level === "verify" || level === "assure" ? "observe" : "advise");
      if (level === "verify" || level === "assure") {
        assert.ok(policy.findings.some((item) => item.code === "TN-POLICY-LEVEL-UNAVAILABLE"));
        assert.equal(ruleMode(policy, "tests-not-weakened"), "observe");
      }
      if (level === "protect") {
        assert.ok(policy.findings.some((item) => item.code === "TN-POLICY-ALPHA0-CAP"));
      }
    } finally {
      await repository.cleanup();
    }
  }
});

test("rejects missing config, unknown rules, schema errors, and loosening", async () => {
  const { loadPolicy } = await api;
  const repository = await tmpRepo("policy-invalid");
  try {
    await assert.rejects(loadPolicy({ cwd: repository.path }), { code: "TN-POLICY-MISSING" });

    await repository.write("tenet.yaml", "standard: 0.1.0-alpha.0\nrules:\n  invented: advise\n");
    await assert.rejects(loadPolicy({ cwd: repository.path }), { code: "TN-POLICY-RULE" });

    await repository.write("tenet.yaml", "standard: 0.1.0-alpha.0\nnot_allowed: true\n");
    await assert.rejects(loadPolicy({ cwd: repository.path }), { code: "TN-POLICY-SCHEMA" });

    await repository.write("tenet.yaml", await fixture("loosening.yaml"));
    await assert.rejects(loadPolicy({ cwd: repository.path }), { code: "TN-POLICY-LOOSEN" });

    await repository.write(
      "tenet.yaml",
      [
        "standard: 0.1.0-alpha.0",
        "specs:",
        "  documents:",
        "    - path: vision.md",
        "      level: L4",
      ].join("\n"),
    );
    await assert.rejects(loadPolicy({ cwd: repository.path }), { code: "TN-POLICY-LOOSEN" });
  } finally {
    await repository.cleanup();
  }
});

test("matches path selectors and policy areas with CODEOWNERS fallback", async () => {
  const { areaFor, loadPolicy, match, ownersFor } = await api;
  assert.equal(match(["src/**", "!src/generated/**"], "src/main.ts"), true);
  assert.equal(match(["src/**", "!src/generated/**"], "src/generated/main.ts"), false);
  assert.equal(match({ include: ["docs/**"], exclude: ["docs/archive/**"] }, { path: "docs/api.md" }), true);

  const repository = await tmpRepo("policy-owners");
  try {
    await repository.write(
      "tenet.yaml",
      [
        "standard: 0.1.0-alpha.0",
        "areas:",
        "  runtime:",
        "    paths: [src/**]",
        '    owners: ["@runtime"]',
      ].join("\n"),
    );
    await repository.write("CODEOWNERS", "docs/** @docs\nsrc/** @last\nsrc/private/** @private\n");
    await loadPolicy({ cwd: repository.path });
    assert.equal(areaFor("src/main.ts"), "runtime");
    assert.deepEqual(ownersFor("src/main.ts"), ["@runtime"]);
    assert.throws(() => areaFor("unmatched/main.ts"), { code: "TN-GATE-UNKNOWN" });
    assert.throws(() => ownersFor("unmatched/main.ts"), { code: "TN-GATE-UNKNOWN" });

    await repository.write("tenet.yaml", "standard: 0.1.0-alpha.0\n");
    await loadPolicy({ cwd: repository.path });
    assert.equal(areaFor("docs/index.md"), "docs/**");
    assert.deepEqual(ownersFor("docs/index.md"), ["@docs"]);
    assert.deepEqual(ownersFor("other.txt"), ["Owner"]);

    await repository.write(
      "tenet.yaml",
      [
        "standard: 0.1.0-alpha.0",
        "specs:",
        "  documents:",
        "    - path: specs/plan.md",
        "      level: L2",
        "      owner: configured-owner",
      ].join("\n"),
    );
    await repository.write(
      "tenet/specs/plan.md",
      [
        "---",
        "tenet:",
        "  spec: 1",
        "  doc: plan",
        "  level: L2",
        "  version: \"0.1\"",
        "  owner: front-owner",
        "---",
        "# Plan",
      ].join("\n"),
    );
    await repository.write("CODEOWNERS", "tenet/specs/plan.md @codeowner\n");
    await loadPolicy({ cwd: repository.path });
    assert.deepEqual(ownersFor("tenet/specs/plan.md"), ["front-owner"]);

    await repository.write(
      "tenet.yaml",
      [
        "standard: 0.1.0-alpha.0",
        "specs:",
        "  documents:",
        "    - path: specs/plan.md",
        "      level: L2",
      ].join("\n"),
    );
    await repository.write(
      "tenet/specs/plan.md",
      [
        "---",
        "tenet:",
        "  spec: 1",
        "  doc: plan",
        "  level: L2",
        "  version: \"0.1\"",
        "---",
        "# Plan",
      ].join("\n"),
    );
    await loadPolicy({ cwd: repository.path });
    assert.deepEqual(ownersFor("tenet/specs/plan.md"), ["@codeowner"]);
  } finally {
    await repository.cleanup();
  }
});

test("reads policy from the ref and warns when the branch edits it", async () => {
  const { areaFor, loadPolicy, ownersFor } = await api;
  const repository = await tmpRepo("policy-ref");
  try {
    await repository.write(
      "tenet.yaml",
      [
        "standard: 0.1.0-alpha.0",
        "level: observe",
        "areas:",
        "  target:",
        '    paths: ["target/**"]',
        '    owners: ["@target"]',
      ].join("\n"),
    );
    repository.git(["add", "."]);
    repository.git(["commit", "--quiet", "-m", "target policy"]);
    repository.git(["branch", "target"]);
    repository.git(["switch", "--quiet", "-c", "feature"]);
    await repository.write(
      "tenet.yaml",
      [
        "standard: 0.1.0-alpha.0",
        "level: protect",
        "areas:",
        "  branch:",
        '    paths: ["target/**"]',
        '    owners: ["@branch"]',
      ].join("\n"),
    );
    repository.git(["add", "tenet.yaml"]);
    repository.git(["commit", "--quiet", "-m", "branch policy"]);

    const policy = await loadPolicy({ cwd: repository.path, ref: "target" });
    assert.equal(policy.level, "observe");
    assert.ok(policy.findings.some((item) => item.code === "TN-POLICY-BRANCH"));
    assert.equal(areaFor("target/file.ts"), "target");
    assert.deepEqual(ownersFor("target/file.ts"), ["@target"]);
  } finally {
    await repository.cleanup();
  }
});

test("loads vendored kits, verifies locks, and refuses edited kits", async () => {
  const { loadKit, loadPolicy, verifyLock } = await api;
  const repository = await tmpRepo("policy-kit");
  try {
    await repository.write(
      "tenet.yaml",
      "standard: 0.1.0-alpha.0\nkit_path: .tenet/kit\n",
    );
    await repository.write(".tenet/kit/pack.yaml", "name: minimal\n");
    await repository.write(".tenet/kit/templates/item.md", "hello\n");
    const policy = await loadPolicy({ cwd: repository.path });
    const kit = await loadKit(policy);
    await repository.write(
      "tenet.lock",
      [
        "schema_version: 1",
        "package: \"@vedprakash-m/tenet\"",
        "version: 0.0.0",
        `integrity: ${lockIntegrity}`,
        `kit_sha256: ${kit.sha256}`,
      ].join("\n"),
    );
    assert.equal((await verifyLock({ cwd: repository.path })).sha256, kit.sha256);

    await repository.write(".tenet/kit/templates/item.md", "edited\n");
    await assert.rejects(verifyLock({ cwd: repository.path }), { code: "TN-LOCK-MISMATCH" });
  } finally {
    await repository.cleanup();
  }
});

test("self-hosting skips the lock", async () => {
  const { verifyLock } = await api;
  const repository = await tmpRepo("policy-self-host");
  try {
    await repository.write("tenet.yaml", "standard: 0.1.0-alpha.0\nkit_path: kit\n");
    await repository.write("kit/TENET.md", "self-hosted\n");
    const verified = await verifyLock({ cwd: repository.path });
    assert.equal(verified.ok, true);
    assert.equal(verified.skipped, true);
  } finally {
    await repository.cleanup();
  }
});
