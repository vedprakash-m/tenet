import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { canonicalCoverage } from "./coverage-lcov.mjs";

const root = process.cwd();
const healthDirectory = path.join(root, ".tenet", "health");
const suitePath = path.join(root, ".tenet", "health-suite-time.json");
const coverage = process.argv.includes("--coverage");
const roots = process.argv.slice(2).filter((argument) => argument !== "--coverage");
if (roots.length === 0) roots.push("test");

const files = [];
function visit(filename) {
  const stat = statSync(filename);
  if (stat.isDirectory()) {
    for (const name of readdirSync(filename).sort()) visit(path.join(filename, name));
  } else if (/\.test\.[jt]s$/.test(filename)) {
    files.push(filename);
  }
}
for (const rootEntry of roots.sort()) visit(rootEntry);
if (files.length === 0) {
  throw new Error(`no test files found under: ${roots.join(", ")}`);
}

mkdirSync(healthDirectory, { recursive: true });
const rawCoverage = path.join(healthDirectory, ".coverage.raw.lcov");
const nodeArgs = ["--test"];
if (coverage) {
  nodeArgs.push(
    "--enable-source-maps",
    "--experimental-test-coverage",
    "--test-reporter=spec",
    "--test-reporter-destination=stdout",
    "--test-reporter=lcov",
    `--test-reporter-destination=${rawCoverage}`,
  );
}
nodeArgs.push(...files);

const started = performance.now();
const child = spawnSync(process.execPath, nodeArgs, { cwd: root, stdio: "inherit" });
const suiteTimeMs = Math.round(performance.now() - started);
if (child.error) throw child.error;

if (!coverage && process.env.GITHUB_STEP_SUMMARY) {
  writeFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `\nSuite time (${process.platform}): ${suiteTimeMs} ms\n`,
    { flag: "a" },
  );
}

if (coverage) {
  const normalized = canonicalCoverage(readFileSync(rawCoverage, "utf8"));
  writeFileSync(path.join(healthDirectory, "coverage.lcov"), normalized);
  writeFileSync(
    suitePath,
    `${JSON.stringify({ schema_version: 1, suite_time_ms: suiteTimeMs }, null, 2)}\n`,
  );
  rmSync(rawCoverage, { force: true });
}

process.exit(child.status ?? 1);
