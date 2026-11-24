import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalCoverage } from "../../scripts/coverage-lcov.mjs";

test("coverage canonicalization ignores execution counts and V8 IDs", () => {
  const first = [
    "TN:",
    "SF:src/sample.ts",
    "FN:12,anonymous_8",
    "FNDA:7,anonymous_8",
    "FN:4,named",
    "FNDA:0,named",
    "BRDA:4,8,0,5",
    "BRDA:12,2,0,0",
    "DA:12,9",
    "DA:4,0",
    "end_of_record",
  ].join("\n");
  const second = [
    "TN:",
    "SF:src/sample.ts",
    "FN:4,named",
    "FNDA:0,named",
    "BRDA:12,1,0,0",
    "DA:4,0",
    "FN:12,anonymous_2",
    "FNDA:2,anonymous_2",
    "DA:12,1",
    "BRDA:4,4,0,1",
    "end_of_record",
  ].join("\n");
  assert.equal(canonicalCoverage(first), canonicalCoverage(second));
});

test("source maps expose a known TypeScript line in the LCOV report", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tenet-source-map-"));
  const report = path.join(directory, "coverage.lcov");
  try {
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const child = spawnSync(
      process.execPath,
      [
        "--test",
        "--enable-source-maps",
        "--experimental-test-coverage",
        "--test-reporter=lcov",
        `--test-reporter-destination=${report}`,
        "test/fixtures/coverage-entry.mjs",
      ],
      { cwd: process.cwd(), encoding: "utf8", env: environment },
    );
    assert.equal(child.status, 0, child.stderr);

    const source = await readFile("src/core/hash.ts", "utf8");
    const line = source
      .replaceAll("\r\n", "\n")
      .split("\n")
      .findIndex((text) => text.startsWith("export function sha256")) + 1;
    assert.ok(line > 0);

    const coverage = (await readFile(report, "utf8"))
      .replaceAll("\r\n", "\n")
      .replaceAll("\\", "/");
    const record = coverage
      .split("end_of_record")
      .find((entry) => entry.includes("SF:src/core/hash.ts"));
    assert.ok(record, "LCOV must name the TypeScript source file");
    assert.match(record, new RegExp(`^DA:${line},[1-9]\\d*$`, "m"));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
