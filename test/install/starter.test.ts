import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("starter locks the full package sha512 accepted by its workflow installer", async () => {
  const lock = JSON.parse(await readFile("examples/starter/tenet.lock", "utf8")) as {
    package?: unknown;
    version?: unknown;
    integrity?: unknown;
  };
  assert.equal(lock.package, "@vedprakash-m/tenet");
  assert.equal(typeof lock.version, "string");
  assert.equal(typeof lock.integrity, "string");
  const integrity = lock.integrity as string;
  assert.match(integrity, /^sha512-[A-Za-z0-9+/]{86}==$/);
  assert.equal(Buffer.from(integrity.slice("sha512-".length), "base64").length, 64);

  const workflow = await readFile(
    "examples/starter/.github/workflows/tenet-tests.yml",
    "utf8",
  );
  assert.match(workflow, /!\/\^sha512-\[A-Za-z0-9\+\/\]\{86\}==\$\/\.test\(lock\.integrity\)/);
  assert.match(workflow, /createHash\("sha512"\)/);
  assert.match(workflow, new RegExp(`# Tenet package pin: ${String(lock.version).replaceAll(".", "\\.")}`));
  assert.doesNotMatch(workflow, /<locked>/);
});

test("starter one-file output checks with zero findings", () => {
  const child = spawnSync(process.execPath, [
    "dist/cli.js",
    "--json",
    "--cwd",
    "examples/starter",
    "check",
  ], { cwd: process.cwd(), encoding: "utf8", shell: false, windowsHide: true });
  assert.equal(child.status, 0, child.stderr);
  const envelope = JSON.parse(child.stdout) as {
    ok: boolean;
    errors: unknown[];
  };
  assert.equal(envelope.ok, true);
  assert.deepEqual(envelope.errors, []);
});
