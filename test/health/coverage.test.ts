import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

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
