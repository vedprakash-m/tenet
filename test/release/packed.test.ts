import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const project = fileURLToPath(new URL("../../", import.meta.url));
const suites = ["alg-02","alg-03","alg-04","alg-08","alg-09","alg-10","alg-11","alg-14","board","card","check","install","scenarios"];
const dependencies = ["ajv", "ajv-formats", "commander", "fast-xml-parser", "picomatch", "yaml"];
const npm = [
  process.env.npm_execpath,
  path.join(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
].find((candidate) => candidate && existsSync(candidate));
assert.ok(npm, "Could not locate npm-cli.js");

function runNpm(args: string[], cwd: string, env = process.env): string {
  return execFileSync(process.execPath, [npm, ...args], { cwd, env, encoding: "utf8", windowsHide: true, timeout: 120_000 });
}

test("the packed npm release contains the alpha.0 layout", async (t) => {
  const scratch = await mkdtemp(path.join(os.tmpdir(), "tenet-packed-"));
  t.after(() => rm(scratch, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));
  const destination = process.env.TENET_RELEASE_TARBALL_DIR ?? scratch;
  await mkdir(destination, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(project, "package.json"), "utf8"));
  assert.deepEqual(manifest.bin, { tenet: "dist/cli.js" });
  assert.deepEqual(manifest.exports, { ".": "./dist/sdk.js" });
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), dependencies);
  assert.deepEqual(manifest.files, ["dist", "kit", ...suites.map((suite) => `pkg/conformance/${suite}`)]);

  // npm test builds dist before starting Node's test runner.
  const items = JSON.parse(runNpm(["pack", "--json", "--ignore-scripts", "--pack-destination", destination], project));
  assert.equal(items.length, 1);
  const [packed] = items;
  assert.equal(packed.name, manifest.name);
  assert.equal(packed.version, manifest.version);
  assert.equal(packed.id, `${manifest.name}@${manifest.version}`);
  const files: string[] = packed.files.map(({ path: filename }: { path: string }) => filename);
  assert.deepEqual([...new Set(files.map((file) => file.split("/")[0]))].sort(),
    ["LICENSE", "README.md", "dist", "kit", "package.json", "pkg"]);
  const shippedPkg = files.filter((file) => file.startsWith("pkg/"));
  assert.ok(shippedPkg.every((file) => file.startsWith("pkg/conformance/")));
  assert.deepEqual([...new Set(shippedPkg.map((file) => file.split("/")[2]))].sort(), suites);
  for (const forbidden of ["tenet/", "test/", "pkg/evals/", "src/", ".github/", "package-lock.json", "LICENSE-docs", "runner/"]) {
    assert.ok(files.every((file) => file !== forbidden && !file.startsWith(forbidden)), `Leaked ${forbidden}`);
  }
  for (const required of ["dist/cli.js", "dist/sdk.js", "dist/commands/index.js", "kit/TENET.md",
    ...["fs", "yaml", "git", "hash", "output", "clock"].map((name) => `dist/core/${name}.js`)]) {
    assert.ok(files.includes(required), `Missing ${required}`);
  }
});
