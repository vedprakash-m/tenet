import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { cleanupTestRoot, tmpRepo } from "../helpers/tmpRepo.ts";

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
  assert.equal((upgrade.envelope.result as { from: string }).from, "0.0.0");

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
