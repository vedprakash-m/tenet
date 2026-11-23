import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("package metadata keeps the CP-0005 public surface exact", async () => {
  const manifest = JSON.parse(await readFile("package.json", "utf8")) as {
    bin: unknown;
    dependencies: Record<string, string>;
    exports: unknown;
    files: string[];
    license: string;
  };
  assert.equal(manifest.license, "Apache-2.0");
  assert.deepEqual(manifest.bin, { tenet: "dist/cli.js" });
  assert.deepEqual(manifest.exports, { ".": "./dist/sdk.js" });
  assert.deepEqual(manifest.files, ["dist", "kit", "pkg/migrations", "pkg/conformance", "pkg/hosts"]);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    "ajv",
    "ajv-formats",
    "commander",
    "fast-xml-parser",
    "picomatch",
    "yaml",
  ]);
});

test("release workflow verifies version, entries and SDK exports", async () => {
  const workflow = await readFile(".github/workflows/release.yml", "utf8");
  assert.match(workflow, /assert\.equal\(item\.version,source\.version\)/);
  assert.match(workflow, /missing tarball entry/);
  assert.match(workflow, /forbidden tarball entry/);
  assert.match(workflow, /SDK exports differ/);
});
