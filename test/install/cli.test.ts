import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, readFile, readdir, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cleanupTestRoot, tmpRepo } from "../helpers/tmpRepo.ts";
import { fakeTty } from "../helpers/fakeTty.ts";
import { run as runCli } from "../../dist/cli.js";
import { init } from "../../dist/install/init.js";
import { remove } from "../../dist/install/remove.js";

import { packageVersion } from "../helpers/packageVersion.ts";

const cli = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));

test.after(async () => {
  await cleanupTestRoot();
});

function run(repo: string, ...args: string[]) {
  let child = spawnSync(process.execPath, [cli, "--json", "--cwd", repo, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env: {
      ...process.env,
      TENET_INSTALL_INTEGRITY: `sha512-${"A".repeat(86)}==`,
    },
  });
  for (let attempt = 0; attempt < 3 && /SyntaxError:.*export named/.test(child.stderr); attempt += 1) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    child = spawnSync(process.execPath, [cli, "--json", "--cwd", repo, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      shell: false,
      windowsHide: true,
      env: {
        ...process.env,
        TENET_INSTALL_INTEGRITY: `sha512-${"A".repeat(86)}==`,
      },
    });
  }
  const envelope = JSON.parse(child.stdout) as {
    ok: boolean;
    command: string;
    result: unknown;
    errors: Array<{ code: string }>;
  };
  return { child, envelope };
}

function runWithoutIntegrity(repo: string, ...args: string[]) {
  const env = { ...process.env, TENET_TEST_REGISTRY_INTEGRITY: "not-found" };
  delete env.TENET_INSTALL_INTEGRITY;
  const child = spawnSync(process.execPath, [cli, "--json", "--cwd", repo, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env,
  });
  return { child, envelope: JSON.parse(child.stdout) as {
    ok: boolean;
    command: string;
    result: unknown;
    errors: Array<{ code: string; message: string }>;
  } };
}

function runWithIntegrity(repo: string, integrity: string, ...args: string[]) {
  const child = spawnSync(process.execPath, [cli, "--json", "--cwd", repo, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env: { ...process.env, TENET_INSTALL_INTEGRITY: integrity },
  });
  return { child, envelope: JSON.parse(child.stdout) as {
    ok: boolean;
    errors: Array<{ code: string; message: string }>;
  } };
}

function runWithRegistryError(repo: string, error: string, ...args: string[]) {
  const env = {
    ...process.env,
    TENET_TEST_REGISTRY_ERROR: error,
  };
  delete env.TENET_INSTALL_INTEGRITY;
  const child = spawnSync(process.execPath, [cli, "--json", "--cwd", repo, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env,
  });
  return {
    child,
    envelope: JSON.parse(child.stdout) as {
      ok: boolean;
      errors: Array<{ code: string; message: string }>;
    },
  };
}

async function packageIntegrity(): Promise<string> {
  const files = new Set(["package.json", "LICENSE", "README.md"]);
  async function visit(relative: string): Promise<void> {
    const entries = await readdir(path.resolve(relative), { withFileTypes: true }).catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    });
    for (const entry of entries ?? []) {
      const item = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await visit(item);
      else if (entry.isFile()) files.add(item);
    }
  }
  for (const directory of ["dist", "kit", "pkg/migrations", "pkg/conformance", "pkg/hosts"]) {
    await visit(directory);
  }
  const hash = createHash("sha512");
  for (const relative of [...files].sort()) {
    hash.update(relative);
    hash.update("\0");
    hash.update(await readFile(path.resolve(relative)));
  }
  return `sha512-${hash.digest("base64")}`;
}

async function tree(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  async function visit(relative = ""): Promise<void> {
    const directory = path.join(root, ...relative.split("/").filter(Boolean));
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.name === ".git") continue;
      const item = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(item);
      else result[item] = (await readFile(path.join(root, ...item.split("/")))).toString("base64");
    }
  }
  await visit();
  return result;
}

test("dist CLI runs init, repeat init, doctor, upgrade and remove", async (t) => {
  const repo = await tmpRepo("install-cli");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  repo.git(["remote", "add", "origin", "https://github.com/fixture/checkout.git"]);
  await repo.write("README.md", "# CLI fixture\n");
  repo.git(["add", "README.md"]);
  repo.git(["commit", "-qm", "fixture"]);

  const first = run(repo.path, "init", "--yes");
  assert.equal(first.child.status, 0, first.child.stdout);
  assert.match(first.child.stderr, /Will create:/);
  assert.match(first.child.stderr, /tenet\.yaml/);
  assert.equal(first.envelope.command, "init");
  assert.equal(first.envelope.ok, true);
  assert.deepEqual(Object.keys(first.envelope.result as object), [
    "plan", "wrote", "findings",
  ]);

  const second = run(repo.path, "init", "--yes");
  assert.equal(second.child.status, 0, second.child.stdout);
  assert.deepEqual((second.envelope.result as {
    wrote: { created: string[]; blocks: unknown[]; keys: unknown[]; local_keys: unknown[] };
  }).wrote, { created: [], blocks: [], keys: [], local_keys: [] });

  const doctor = run(repo.path, "doctor");
  assert.equal(doctor.child.status, 0, doctor.child.stdout);
  assert.equal(doctor.child.stderr, "");
  assert.deepEqual(Object.keys(doctor.envelope.result as object), ["checks"]);

  const upgrade = run(repo.path, "upgrade");
  assert.equal(upgrade.child.status, 0, upgrade.child.stdout);
  const manifest = JSON.parse(await readFile(new URL("../../package.json", import.meta.url), "utf8")) as { version: string };
  assert.equal((upgrade.envelope.result as { from: string }).from, manifest.version);

  const remove = run(repo.path, "remove");
  assert.equal(remove.child.status, 0, remove.child.stdout);
  assert.equal((remove.envelope.result as { reminder: string | null }).reminder !== null, true);
  await assert.rejects(readFile(path.join(repo.path, "tenet.lock")));
  assert.equal(await readFile(path.join(repo.path, "README.md"), "utf8"), "# CLI fixture\n");
});

test("dist CLI reports canonical command usage failures", async (t) => {
  const repo = await tmpRepo("install-cli-usage");
  t.after(repo.cleanup);
  for (const command of ["init", "upgrade", "remove", "doctor"]) {
    const output = run(repo.path, command, "unexpected");
    assert.equal(output.child.status, 2, output.child.stdout);
    assert.equal(output.envelope.errors[0]?.code, `TN-USAGE-${command.toUpperCase()}`);
  }
});

test("unpublished local versions use exact local integrity and warn", async (t) => {
  const repo = await tmpRepo("install-no-registry-integrity");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  repo.git(["remote", "add", "origin", "https://github.com/fixture/local-integrity.git"]);
  await repo.write("README.md", "# Local build\n");
  repo.git(["add", "README.md"]);
  repo.git(["commit", "-qm", "fixture"]);
  const output = runWithoutIntegrity(repo.path, "init", "--yes");
  assert.equal(output.child.status, 0, output.child.stderr);
  assert.equal(output.envelope.ok, true);
  assert.match(output.child.stderr, /not on the registry.*local package integrity/i);
  const lock = JSON.parse(await readFile(path.join(repo.path, "tenet.lock"), "utf8")) as {
    integrity: string;
    "x-integrity-source": string;
  };
  assert.equal(lock["x-integrity-source"], "local");
  assert.equal(lock.integrity, await packageIntegrity());
  assert.ok((output.envelope.result as { findings: Array<{ kind: string }> }).findings
    .some(({ kind }) => kind === "local-integrity"));
  const doctor = runWithoutIntegrity(repo.path, "doctor");
  assert.equal(doctor.child.status, 0, doctor.child.stderr);
  assert.match(doctor.child.stderr, /local package integrity.*CI workflows cannot verify/i);
  const upgraded = runWithoutIntegrity(repo.path, "upgrade");
  assert.equal(upgraded.child.status, 0, upgraded.child.stderr);
  assert.match(upgraded.child.stderr, /not on the registry.*local package integrity/i);
});

test("offline empty-repo init seeds intent without template examples", async (t) => {
  const repo = await tmpRepo("install-empty-intent");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);

  const installed = runWithoutIntegrity(repo.path, "init", "--yes", "--offline");
  assert.equal(installed.child.status, 0, installed.child.stderr);
  assert.match(installed.child.stderr, /local package integrity/i);
  const intent = await readFile(path.join(repo.path, "tenet", "intent.md"), "utf8");
  assert.match(intent, /^## Vision$/m);
  assert.match(intent, /^\| ID \| Purpose or boundary \| Serves \/ Target \| Origin \|$/m);
  assert.doesNotMatch(intent, /^\| V-\d+ /m);
  assert.match(
    intent,
    /<!-- Add your vision here, or run tenet onboard\. -->\n\n\| ID \|/,
  );
  const starter = await readFile(path.resolve("examples/starter/tenet/intent.md"), "utf8");
  const templateExamples = [
    "Checkout recovers cleanly from transient gateway timeouts for returning shoppers.",
    "≤1% checkout timeout failure",
    "A payment request that times out is retried at most once, never twice.",
    "Card numbers and verification codes are never written to logs or error messages.",
    "src/checkout/gateway.ts",
    "src/checkout/retry.ts",
    "Checkout shows a single waiting indicator during a retry",
    "First slice: implement single-retry timeout handling",
  ];
  for (const [name, seed] of [["generated seed", intent], ["starter", starter]] as const) {
    for (const example of templateExamples) {
      assert.equal(seed.includes(example), false, `${name} retained template example: ${example}`);
    }
    assert.match(seed, /^## Vision$/m);
    assert.match(seed, /^\| ID \| Purpose or boundary \| Serves \/ Target \| Origin \|$/m);
    assert.match(seed, /<!-- Add your vision here, or run tenet onboard\. -->\n\n\| ID \|/);
    assert.doesNotMatch(
      seed,
      /\|---\|---\|---\|---\|\n<!-- Add your vision here, or run tenet onboard\. -->/,
    );
    assert.doesNotMatch(seed, /^\| V-\d+ /m);
    assert.doesNotMatch(seed, /^\| V-\d+ .*\| asked \|$/m);
    assert.doesNotMatch(seed, /\{origin:\s*asked(?:;|\})/);
  }
  assert.doesNotMatch(intent, /^- R-\d+\b/m);

  const checked = runWithoutIntegrity(repo.path, "check");
  assert.equal(checked.child.status, 0, checked.child.stderr);
  assert.equal(checked.envelope.ok, true);
  assert.deepEqual(checked.envelope.errors, []);

  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "install"]);
  const onboard = run(repo.path, "onboard", "--inventory-only");
  assert.equal(onboard.child.status, 0, onboard.child.stderr);
  const result = onboard.envelope.result as {
    findings: Array<{ kind: string }>;
  };
  assert.deepEqual(result.findings.filter((finding) => finding.kind === "dead-path"), []);
});

test("interactive purpose seed keeps the Vision row in the table", async (t) => {
  const repo = await tmpRepo("install-interactive-intent");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  const io = fakeTty("Recover checked-out work safely.\n\n\n");
  const priorRegistry = process.env.TENET_TEST_REGISTRY_INTEGRITY;
  process.env.TENET_TEST_REGISTRY_INTEGRITY = "not-found";
  try {
    const exit = await runCli(
      ["--offline", "init"],
      { cwd: repo.path, ...io, checkEnvironment: false },
    );
    assert.equal(exit, 0, io.stderr.text);
  } finally {
    if (priorRegistry === undefined) delete process.env.TENET_TEST_REGISTRY_INTEGRITY;
    else process.env.TENET_TEST_REGISTRY_INTEGRITY = priorRegistry;
  }

  const intent = await readFile(path.join(repo.path, "tenet", "intent.md"), "utf8");
  assert.match(
    intent,
    /\|---\|---\|---\|---\|\n\| V-1 \| Recover checked-out work safely\. \| Undecided \| asked \|/,
  );
  assert.doesNotMatch(
    intent,
    /\|---\|---\|---\|---\|\n<!-- Add your vision here, or run tenet onboard\. -->\n\| V-1 /,
  );

  const checked = run(repo.path, "check");
  assert.equal(checked.child.status, 0, checked.child.stderr);
  assert.equal(checked.envelope.ok, true);
  assert.deepEqual(checked.envelope.errors, []);

  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "install"]);
  const inventory = run(repo.path, "onboard", "--inventory-only");
  assert.equal(inventory.child.status, 0, inventory.child.stderr || inventory.child.stdout);
  const onboard = run(repo.path, "onboard", "--card");
  assert.equal(onboard.child.status, 0, onboard.child.stderr || onboard.child.stdout);
  assert.match(
    (onboard.envelope.result as { card: string }).card,
    /Vision · 1 statement · 1 asked · 1 min/,
  );
});

test("malformed integrity overrides return TN-LOCK-INVALID", async (t) => {
  const repo = await tmpRepo("install-invalid-integrity");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  const output = runWithIntegrity(repo.path, "not-an-sri", "init", "--yes");
  assert.equal(output.child.status, 1, output.child.stdout);
  assert.equal(output.envelope.ok, false);
  assert.equal(output.envelope.errors[0]?.code, "TN-LOCK-INVALID");
  assert.doesNotMatch(output.envelope.errors[0]?.message ?? "", /TN-INTERNAL/);
});

test("registry transport failure writes nothing during init", async (t) => {
  const repo = await tmpRepo("install-registry-transport-failure");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  const before = await tree(repo.path);

  const output = runWithRegistryError(
    repo.path,
    "ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE",
    "init",
    "--yes",
  );

  assert.equal(output.child.status, 3, output.child.stdout);
  assert.equal(output.envelope.ok, false);
  assert.equal(output.envelope.errors[0]?.code, "TN-ENV-REGISTRY");
  assert.equal(
    output.envelope.errors[0]?.message,
    `Could not reach the npm registry to verify @vedprakash-m/tenet@${packageVersion} ` +
      "(ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE).",
  );
  assert.deepEqual(await tree(repo.path), before);
});

test("offline init records local integrity despite registry failure", async (t) => {
  const repo = await tmpRepo("install-offline-registry-transport-failure");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);

  const output = runWithRegistryError(
    repo.path,
    "ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE",
    "init",
    "--yes",
    "--offline",
  );

  assert.equal(output.child.status, 0, output.child.stderr);
  assert.equal(output.envelope.ok, true);
  assert.match(output.child.stderr, /local package integrity/i);
  const lock = JSON.parse(await readFile(path.join(repo.path, "tenet.lock"), "utf8")) as {
    integrity: string;
    "x-integrity-source": string;
  };
  assert.equal(lock["x-integrity-source"], "local");
  assert.equal(lock.integrity, await packageIntegrity());
});

test("[AB-E1] [F-56] same-version upgrade ignores registry failure and writes nothing", async (t) => {
  const repo = await tmpRepo("upgrade-registry-transport-failure");
  t.after(repo.cleanup);
  repo.git(["commit", "--allow-empty", "-qm", "fixture"]);
  const installed = runWithoutIntegrity(repo.path, "init", "--yes");
  assert.equal(installed.child.status, 0, installed.child.stderr);
  const before = await tree(repo.path);

  const output = runWithRegistryError(
    repo.path,
    "ETIMEDOUT",
    "upgrade",
  );

  assert.equal(output.child.status, 0, output.child.stderr);
  assert.equal(output.envelope.ok, true);
  assert.deepEqual(output.envelope.errors, []);
  assert.deepEqual(output.envelope.result, {
    from: packageVersion,
    to: packageVersion,
    changed: [],
  });
  assert.deepEqual(await tree(repo.path), before);
});

test("init onboard remove restores the repository including generated directories", async (t) => {
  const repo = await tmpRepo("install-onboard-remove-tree");
  t.after(repo.cleanup);
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  repo.git(["remote", "add", "origin", "https://github.com/fixture/checkout.git"]);
  await repo.write("README.md", "# Lifecycle fixture\n");
  repo.git(["add", "README.md"]);
  repo.git(["commit", "-qm", "fixture"]);
  const before = await tree(repo.path);

  const installed = run(repo.path, "init", "--yes");
  assert.equal(installed.child.status, 0, installed.child.stderr);
  const onboarded = run(repo.path, "onboard", "--inventory-only");
  assert.equal(onboarded.child.status, 0, onboarded.child.stderr);
  const removed = run(repo.path, "remove");
  assert.equal(removed.child.status, 0, removed.child.stderr);

  assert.deepEqual(await tree(repo.path), before);
  await assert.rejects(lstat(path.join(repo.path, ".tenet")), { code: "ENOENT" });
});

test("real node-service fixture initializes, is idempotent and removes exactly", async (t) => {
  const repo = await tmpRepo("install-real-node-service");
  t.after(repo.cleanup);
  const home = path.join(path.dirname(repo.path), `home-${path.basename(repo.path)}`);
  await mkdir(home, { recursive: true });
  const homeBefore = await tree(home);
  t.after(() => rm(home, { recursive: true, force: true }));
  const fixture = path.resolve("pkg/evals/onboarding/node-service/repo");
  for (const entry of await readdir(fixture, { withFileTypes: true })) {
    await cp(path.join(fixture, entry.name), path.join(repo.path, entry.name), {
      recursive: true,
      force: true,
    });
  }
  repo.git(["config", "user.name", "Fixture Owner"]);
  repo.git(["config", "user.email", "fixture@example.invalid"]);
  repo.git(["add", "-A"]);
  repo.git(["commit", "-qm", "fixture"]);
  const original = await tree(repo.path);
  const env = {
    ...process.env,
    TENET_TEST_REGISTRY_INTEGRITY: "not-found",
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
  };
  delete env.TENET_INSTALL_INTEGRITY;
  const invoke = (...args: string[]) => {
    const child = spawnSync(process.execPath, [cli, "--json", "--cwd", repo.path, ...args], {
      cwd: process.cwd(),
      encoding: "utf8",
      env,
      shell: false,
      windowsHide: true,
    });
    return { child, envelope: JSON.parse(child.stdout) as {
      ok: boolean;
      command: string;
      result: Record<string, unknown>;
      errors: unknown[];
    } };
  };

  const first = invoke("init", "--yes");
  assert.equal(first.child.status, 0, first.child.stderr);
  assert.equal(first.envelope.ok, true);
  assert.match(first.child.stderr, /local package integrity/i);
  assert.ok(Array.isArray((first.envelope.result.plan as { created: unknown[] }).created));
  assert.ok(((first.envelope.result.wrote as { created: unknown[] }).created).length > 0);
  assert.doesNotMatch(
    await readFile(path.join(repo.path, "tenet.yaml"), "utf8"),
    /\bdocuments:/,
  );

  const second = invoke("init", "--yes");
  assert.equal(second.child.status, 0, second.child.stderr);
  assert.deepEqual((second.envelope.result.wrote as {
    created: unknown[];
    blocks: unknown[];
    keys: unknown[];
    local_keys: unknown[];
  }), { created: [], blocks: [], keys: [], local_keys: [] });

  const removed = invoke("remove");
  assert.equal(removed.child.status, 0, removed.child.stderr);
  assert.deepEqual(await tree(repo.path), original);
  assert.deepEqual(await tree(home), homeBefore);
});

test("local-host consent writes only Windows cmd shims and removes them", async () => {
  for (const platform of ["win32", "linux", "darwin"] as const) {
    const repo = await tmpRepo(`install-local-host-${platform}`);
    const home = path.join(path.dirname(repo.path), `home-${path.basename(repo.path)}`);
    try {
      await mkdir(home, { recursive: true });
      await repo.write("CLAUDE.md", "# Fixture\n");
      repo.git(["add", "CLAUDE.md"]);
      repo.git(["commit", "-qm", "fixture"]);
      const options = {
        cwd: repo.path,
        yes: true,
        localHosts: true,
        environment: {
          platform,
          localProfileRoot: home,
          registry: {
            package: "@vedprakash-m/tenet",
            releases: {
              [packageVersion]: { integrity: `sha512-${"A".repeat(86)}==` },
              "0.0.0": { integrity: `sha512-${"A".repeat(86)}==` },
            },
          },
          ...(platform === "win32" ? { windowsCommandShimRequired: ["claude"] } : {}),
        },
      };
      const first = await init(options);
      if (platform === "win32") {
        assert.equal(first.wrote.local_keys.length, 1);
        await readFile(path.join(home, ".claude.json"), "utf8");
      } else {
        assert.deepEqual(first.wrote.local_keys, []);
        await assert.rejects(readFile(path.join(home, ".claude.json")), { code: "ENOENT" });
      }
      await remove(options);
      assert.deepEqual(await tree(home), {});
    } finally {
      await repo.cleanup();
      await rm(home, { recursive: true, force: true });
    }
  }
});
