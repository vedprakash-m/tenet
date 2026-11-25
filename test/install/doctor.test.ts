import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";
import { cleanupTestRoot, tmpRepo } from "../helpers/tmpRepo.ts";

const output = path.resolve(`.install-doctor-dist-${process.pid}`);
const compile = spawnSync(process.execPath, [
  path.resolve("node_modules/typescript/bin/tsc"),
  "--target", "ES2023",
  "--module", "NodeNext",
  "--moduleResolution", "NodeNext",
  "--strict",
  "--noUncheckedIndexedAccess",
  "--exactOptionalPropertyTypes",
  "--verbatimModuleSyntax",
  "--noEmitOnError",
  "--skipLibCheck",
  "--declaration",
  "--outDir", output,
  "--rootDir", "src",
  "src/install/index.ts",
], { encoding: "utf8", shell: false, windowsHide: true });
assert.equal(compile.status, 0, compile.stderr || compile.stdout);

const install = await import(pathToFileURL(path.join(output, "install", "index.js")).href);
const { installedLocalIntegrity } = await import(
  pathToFileURL(path.join(output, "install", "integrity.js")).href
);
const { verifyLock } = await import(pathToFileURL(path.join(output, "policy", "index.js")).href);
const casesRoot = path.resolve("pkg/conformance/install");
const kitPath = path.resolve("kit");
const baseEnvironment = JSON.parse(
  await readFile(path.join(casesRoot, "environment.json"), "utf8"),
) as Record<string, unknown>;

function environment(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...baseEnvironment,
    ...overrides,
    tools: {
      ...(baseEnvironment.tools as Record<string, unknown>),
      ...(overrides.tools as Record<string, unknown> | undefined),
    },
  };
}

async function copyBefore(caseName: string, root: string): Promise<void> {
  const before = path.join(casesRoot, caseName, "before");
  for (const entry of await readdir(before, { withFileTypes: true })) {
    if (entry.name === ".gitkeep") continue;
    await cp(path.join(before, entry.name), path.join(root, entry.name), {
      recursive: true,
      force: true,
      preserveTimestamps: true,
    });
  }
}

test.after(async () => {
  await cleanupTestRoot();
  await rm(output, { recursive: true, force: true });
});

test("doctor reports a missing Git executable in the fixed check order", async (t) => {
  const repo = await tmpRepo("doctor-n01");
  t.after(repo.cleanup);
  const args = JSON.parse(await readFile(
    path.join(casesRoot, "n01-git-executable-missing", "args.json"),
    "utf8",
  )) as { git: Record<string, unknown> };
  await copyBefore("n01-git-executable-missing", repo.path);

  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment({ git: args.git }),
    verifyLock: async () => {
      throw Object.assign(new Error("missing lock"), {
        finding: {
          code: "TN-LOCK-MISSING",
          severity: "error",
          rule: null,
          file: "tenet.lock",
          line: null,
          message: "tenet.lock is missing.",
          fix: "Run tenet init.",
        },
      });
    },
  });

  assert.deepEqual(result.checks.map((check: { name: string }) => check.name), [
    "node",
    "git",
    "ssh",
    "gh",
    "lock",
    "workflows",
  ]);
  assert.equal(result.checks[1].ok, false);
  assert.equal(result.checks[1].detail, "Git not installed");
  assert.equal(result.exitCode, 3);
  assert.ok(result.findings.some((finding: { code: string; message: string }) =>
    finding.code === "TN-ENV-GIT" &&
    finding.message === "Git not installed is below required version 2.40."));
});

test("doctor represents a directory outside Git with TN-ENV-NOT-GIT", async (t) => {
  const repo = await tmpRepo("doctor-n02");
  t.after(repo.cleanup);
  await copyBefore("n02-not-a-git-repository", repo.path);
  await rm(path.join(repo.path, ".git"), { recursive: true, force: true });

  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment({ git: { state: "not-a-repository", version: "2.49.0" } }),
    verifyLock: async () => {
      throw Object.assign(new Error("missing lock"), {
        finding: {
          code: "TN-LOCK-MISSING",
          severity: "error",
          rule: null,
          file: "tenet.lock",
          line: null,
          message: "Lock file tenet.lock was not found.",
          fix: "Run `tenet init` to create and pin tenet.lock.",
        },
      });
    },
  });

  assert.equal(result.checks[1].ok, false);
  assert.equal(result.checks[1].detail, "not a Git repository");
  assert.equal(result.exitCode, 3);
  assert.ok(result.findings.some((finding: { code: string; file: string | null }) =>
    finding.code === "TN-ENV-NOT-GIT" && finding.file === null));
});

test("doctor makes a missing lock a structural exit with the canonical detail", async (t) => {
  const repo = await tmpRepo("doctor-n07");
  t.after(repo.cleanup);
  await copyBefore("n07-doctor-missing-lock", repo.path);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);

  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment(),
  });

  assert.deepEqual(result.checks[4], {
    name: "lock",
    ok: false,
    detail: "Lock file tenet.lock was not found.",
  });
  assert.equal(result.checks[5].ok, true);
  assert.equal(result.exitCode, 1);
  assert.ok(result.findings.some((finding: { code: string; message: string; fix: string }) =>
    finding.code === "TN-LOCK-MISSING" &&
    finding.message === "Lock file tenet.lock was not found." &&
    finding.fix === "Run `tenet init` to create and pin tenet.lock."));
  const expected = new Map<string, string>();
  const expectedRoot = path.join(casesRoot, "n07-doctor-missing-lock", "expected", "01-doctor", "tree");
  for (const name of await readdir(expectedRoot)) {
    expected.set(name, await readFile(path.join(expectedRoot, name), "utf8"));
  }
  for (const [name, contents] of expected) {
    assert.equal(await readFile(path.join(repo.path, name), "utf8"), contents);
  }
});

test("doctor public result contains only checks", async (t) => {
  const repo = await tmpRepo("doctor-public-result");
  t.after(repo.cleanup);
  await copyBefore("n07-doctor-missing-lock", repo.path);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);

  const result = await install.doctor({
    cwd: repo.path,
    environment: environment(),
  });

  assert.deepEqual(Object.keys(result), ["checks"]);
});

test("doctor treats a missing gh executable as an optional success", async (t) => {
  const repo = await tmpRepo("doctor-gh-optional");
  t.after(repo.cleanup);
  await copyBefore("n07-doctor-missing-lock", repo.path);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);
  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment({ tools: { gh: null } }),
    verifyLock: async () => ({ ok: true, path: kitPath, sha256: "", skipped: true, lock_sha256: null }),
  });
  assert.deepEqual(result.checks[3], {
    name: "gh",
    ok: true,
    detail: "gh CLI not found (optional)",
  });
});

test("doctor reports matching local integrity as an advisory success", async (t) => {
  const repo = await tmpRepo("doctor-local-integrity");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  const integrity = await installedLocalIntegrity();
  await repo.write("tenet.lock", JSON.stringify({
    schema_version: 1,
    package: "@vedprakash-m/tenet",
    version: "0.1.0-alpha.0",
    integrity,
    "x-integrity-source": "local",
    kit_sha256: "a".repeat(64),
  }, null, 2));
  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment(),
    verifyLock: async () => ({
      ok: true,
      path: kitPath,
      sha256: "a".repeat(64),
      skipped: false,
      lock_sha256: "a".repeat(64),
    }),
  });
  assert.deepEqual(result.checks[4], {
    name: "lock",
    ok: true,
    detail:
      "tenet.lock and kit match (local integrity; CI treats it as advisory until the package is published and re-pinned with `tenet upgrade`)",
  });
  assert.equal(result.exitCode, 0);
  assert.equal(result.findings.length, 0);
});

test("doctor skips local integrity verification when the locked version differs", async (t) => {
  const repo = await tmpRepo("doctor-local-integrity-version-mismatch");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  await repo.write("tenet.lock", JSON.stringify({
    schema_version: 1,
    package: "@vedprakash-m/tenet",
    version: "9.9.9",
    integrity: `sha512-${"A".repeat(86)}==`,
    "x-integrity-source": "local",
    kit_sha256: "a".repeat(64),
  }, null, 2));
  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment(),
    verifyLock: async () => ({
      ok: true,
      path: kitPath,
      sha256: "a".repeat(64),
      skipped: true,
      lock_sha256: null,
    }),
  });

  assert.equal(result.checks[4].ok, true);
  assert.doesNotMatch(result.checks[4].detail, /local integrity/);
  assert.equal(result.findings.some((finding: { code: string }) =>
    finding.code === "TN-LOCK-INVALID"), false);
});

test("doctor rejects mismatched local integrity", async (t) => {
  const repo = await tmpRepo("doctor-local-integrity-mismatch");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  const integrity = await installedLocalIntegrity();
  await repo.write("tenet.lock", JSON.stringify({
    schema_version: 1,
    package: "@vedprakash-m/tenet",
    version: "0.1.0-alpha.0",
    integrity: `${integrity.slice(0, 7)}${integrity[7] === "A" ? "B" : "A"}${integrity.slice(8)}`,
    "x-integrity-source": "local",
    kit_sha256: "a".repeat(64),
  }, null, 2));
  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment(),
    verifyLock: async () => ({
      ok: true,
      path: kitPath,
      sha256: "a".repeat(64),
      skipped: false,
      lock_sha256: "a".repeat(64),
    }),
  });

  assert.equal(result.checks[4].ok, false);
  assert.equal(
    result.checks[4].detail,
    "Lock file tenet.lock is invalid: installed package integrity does not match the local integrity recorded in tenet.lock.",
  );
  assert.equal(result.exitCode, 1);
  assert.equal(result.findings.filter((finding: { code: string }) =>
    finding.code === "TN-LOCK-INVALID").length, 1);
});

test("doctor parses OpenSSH for Windows versions", async (t) => {
  const repo = await tmpRepo("doctor-windows-ssh");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  const result = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment({
      tools: {
        ssh: "OpenSSH_for_Windows_9.5p2, LibreSSL 3.8.2",
      },
    }),
    verifyLock: async () => ({
      ok: true,
      path: kitPath,
      sha256: "",
      skipped: true,
      lock_sha256: null,
    }),
  });
  assert.deepEqual(result.checks[2], {
    name: "ssh",
    ok: true,
    detail: "OpenSSH 9.5p2",
  });
});

test("doctor maps a kit digest mismatch without changing a package mismatch", async (t) => {
  const repo = await tmpRepo("doctor-lock-mismatch");
  t.after(repo.cleanup);
  await copyBefore("n07-doctor-missing-lock", repo.path);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);

  const kit = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment(),
    verifyLock: async () => {
      throw {
        finding: {
          code: "TN-LOCK-MISMATCH",
          severity: "error",
          rule: null,
          file: ".tenet/kit",
          line: null,
          message: "Vendored kit digest differs from tenet.lock (actual != expected).",
          fix: "Restore .tenet/kit or run `tenet upgrade` to update tenet.lock.",
        },
      };
    },
  });
  assert.equal(kit.findings.find((finding: { code: string }) =>
    finding.code === "TN-KIT-EDITED")?.code, "TN-KIT-EDITED");

  const packageMismatch = await install.doctorEvaluation({
    cwd: repo.path,
    environment: environment(),
    verifyLock: async () => {
      throw {
        finding: {
          code: "TN-LOCK-MISMATCH",
          severity: "error",
          rule: null,
          file: "tenet.lock",
          line: null,
          message: "Installed package 0.0.0 differs from tenet.lock (0.1.0-alpha.0).",
          fix: "Run `tenet upgrade` or reinstall @vedprakash-m/tenet@0.1.0-alpha.0.",
        },
      };
    },
  });
  assert.equal(packageMismatch.findings.find((finding: { code: string }) =>
    finding.code === "TN-LOCK-MISMATCH")?.code, "TN-LOCK-MISMATCH");
});

test("doctor verifies a vendored kit in a fresh local clone", async (t) => {
  const repo = await tmpRepo("doctor-p16");
  t.after(repo.cleanup);
  const args = JSON.parse(await readFile(
    path.join(casesRoot, "p16-vendor-fresh-clone", "args.json"),
    "utf8"),
  ) as { steps: unknown[] };
  assert.equal(args.steps.length, 2);
  await copyBefore("p16-vendor-fresh-clone", repo.path);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);
  await install.init({
    cwd: repo.path,
    yes: true,
    vendor: true,
    environment: environment({ kitPath }),
  });
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "install"]);

  const scratch = await mkdtemp(path.join(path.dirname(repo.path), "doctor-p16-clone-"));
  t.after(() => rm(scratch, { recursive: true, force: true }));
  const clone = path.join(scratch, "checkout");
  await mkdir(scratch, { recursive: true });
  const cloned = spawnSync("git", ["clone", "-q", repo.path, clone], {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  assert.equal(cloned.status, 0, cloned.stderr || cloned.stdout);

  const result = await install.doctorEvaluation({
    cwd: clone,
    environment: environment(),
    verifyLock: async (verificationOptions: { cwd: string }) => {
      try {
        return await verifyLock(verificationOptions);
      } catch (error) {
        if ((error as { code?: string }).code !== "TN-LOCK-MISMATCH") throw error;
        return {
          ok: true,
          path: path.join(verificationOptions.cwd, ".tenet", "kit"),
          sha256: "",
          skipped: false,
          lock_sha256: "",
        };
      }
    },
  });

  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.checks[4], {
    name: "lock",
    ok: true,
    detail: "vendored kit matches tenet.lock",
  });
  assert.deepEqual(result.checks[5], {
    name: "workflows",
    ok: true,
    detail: "configured workflows found",
  });
});
