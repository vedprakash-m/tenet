import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "yaml";

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
  assert.deepEqual(manifest.files, [
    "dist", "kit", "pkg/conformance/alg-02", "pkg/conformance/alg-03", "pkg/conformance/alg-04",
    "pkg/conformance/alg-08", "pkg/conformance/alg-09", "pkg/conformance/alg-10", "pkg/conformance/alg-11",
    "pkg/conformance/alg-14", "pkg/conformance/board", "pkg/conformance/card", "pkg/conformance/check",
    "pkg/conformance/install", "pkg/conformance/scenarios",
  ]);
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), [
    "ajv",
    "ajv-formats",
    "commander",
    "fast-xml-parser",
    "picomatch",
    "yaml",
  ]);
});

test("release workflow runs the packed package checks against the same artifact on all platforms", async () => {
  const workflow = parse(await readFile(".github/workflows/release.yml", "utf8"));
  const build = workflow.jobs.package;
  const journey = workflow.jobs["packed-journey"];
  assert.equal(journey.needs, "package");
  assert.deepEqual(journey.strategy.matrix.os, ["ubuntu-latest", "windows-latest", "macos-latest"]);
  assert.equal(journey["runs-on"], `\${{ matrix.os }}`);

  const buildTest = build.steps.find((step: { run?: string }) => step.run === "npm test");
  const upload = build.steps.find((step: { uses?: string }) => step.uses?.startsWith("actions/upload-artifact@"));
  const download = journey.steps.find((step: { uses?: string }) => step.uses?.startsWith("actions/download-artifact@"));
  const journeyTest = journey.steps.find((step: { run?: string }) =>
    step.run?.endsWith("--test test/release/packed.test.ts"));
  assert.ok(buildTest && upload && download && journeyTest);
  assert.equal(upload.with.name, "tenet-release-package");
  assert.equal(download.with.name, upload.with.name);
  assert.equal(upload.with.path, `${buildTest.env.TENET_RELEASE_TARBALL_DIR}/`);
  assert.equal(journeyTest.env.TENET_RELEASE_PACKED_DIR, download.with.path);
});
