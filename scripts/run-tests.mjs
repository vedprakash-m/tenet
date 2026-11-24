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

function canonicalCoverage(contents) {
  const records = [];
  for (const chunk of contents.replaceAll("\r\n", "\n").split("end_of_record")) {
    const lines = chunk
      .trim()
      .split("\n")
      .filter((line) => line && line !== "TN:");
    const sourceIndex = lines.findIndex((line) => line.startsWith("SF:"));
    if (sourceIndex < 0) continue;
    const source = portableSource(lines[sourceIndex].slice(3));
    if (!source.startsWith("src/")) continue;
    lines[sourceIndex] = `SF:${source}`;
    records.push({ source, lines });
  }
  records.sort((left, right) => Buffer.compare(
    Buffer.from(left.source),
    Buffer.from(right.source),
  ));
  if (records.length === 0) throw new Error("coverage report contains no src/ records");
  return `TN:\n${records
    .map(({ lines: record }) => `${record.join("\n")}\nend_of_record`)
    .join("\n")}\n`;
}

function portableSource(filename) {
  const absolute = path.isAbsolute(filename) ? filename : path.resolve(root, filename);
  const relative = path.relative(root, absolute);
  const shown = relative.startsWith("..") ? filename : relative;
  return shown.replaceAll("\\", "/");
}
