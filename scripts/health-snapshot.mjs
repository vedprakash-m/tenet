import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const healthDirectory = path.join(root, ".tenet", "health");
const coveragePath = path.join(healthDirectory, "coverage.lcov");
const suitePath = path.join(root, ".tenet", "health-suite-time.json");
const complexityPath = path.join(healthDirectory, "complexity.json");
const snapshotPath = path.join(healthDirectory, "snapshot.json");

mkdirSync(healthDirectory, { recursive: true });
const complexity = readComplexity();
writeJson(complexityPath, complexity);

const sourceCoverage = parseCoverage(readFileSync(coveragePath, "utf8"));
const suite = JSON.parse(readFileSync(suitePath, "utf8"));
if (!Number.isFinite(suite.suite_time_ms) || suite.suite_time_ms < 0) {
  throw new Error("suite-time.json does not contain a finite suite_time_ms");
}

const assertions = countAssertions(path.join(root, "src"));
const versions = toolVersions();
const configDigest = digestConfig();
writeJson(snapshotPath, {
  schema_version: 1,
  config_digest: configDigest,
  complexity: {
    by_file: groupComplexity(complexity.findings),
    count: complexity.findings.length,
  },
  coverage: sourceCoverage,
  source_assertions: assertions,
  suite_time_ms: suite.suite_time_ms,
  tools: versions,
});

function readComplexity() {
  const rawPath = path.join(healthDirectory, ".complexity.raw.json");
  const biome = path.join(root, "node_modules", "@biomejs", "biome", "bin", "biome");
  try {
    const result = spawnSync(
      process.execPath,
      [
        biome,
        "lint",
        "--only=complexity/noExcessiveCognitiveComplexity",
        "--diagnostic-level=info",
        "--max-diagnostics=none",
        "--reporter=json",
        `--reporter-file=${rawPath}`,
        "src",
      ],
      { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(result.stderr || result.stdout || "Biome complexity collection failed");
    }
    const report = JSON.parse(readFileSync(rawPath, "utf8"));
    const findings = report.diagnostics
      .filter((diagnostic) =>
        diagnostic.category === "lint/complexity/noExcessiveCognitiveComplexity"
      )
      .map((diagnostic) => {
        const score = /complexity of (\d+) detected \(max: (\d+)\)/.exec(
          diagnostic.message,
        );
        if (!score) throw new Error(`unexpected complexity diagnostic: ${diagnostic.message}`);
        return {
          column: diagnostic.location.start.column,
          file: portablePath(diagnostic.location.path),
          line: diagnostic.location.start.line,
          max: Number(score[2]),
          score: Number(score[1]),
        };
      })
      .sort(compareFields(["file", "line", "column", "score"]));
    return { findings, schema_version: 1 };
  } finally {
    rmSync(rawPath, { force: true });
  }
}

function parseCoverage(contents) {
  const bySource = new Map();
  for (const chunk of contents.replaceAll("\r\n", "\n").split("end_of_record")) {
    const lines = chunk.trim().split("\n");
    const sourceLine = lines.find((line) => line.startsWith("SF:"));
    if (!sourceLine) continue;
    const source = portablePath(sourceLine.slice(3));
    if (!source.startsWith("src/")) continue;
    const record = {
      branches: { covered: 0, total: 0 },
      lines: { covered: 0, total: 0 },
    };
    for (const line of lines) {
      if (line.startsWith("DA:")) {
        const count = Number(line.split(",")[1]);
        record.lines.total += 1;
        if (count > 0) record.lines.covered += 1;
      } else if (line.startsWith("BRDA:")) {
        const taken = line.split(",")[3];
        record.branches.total += 1;
        if (taken !== "-" && Number(taken) > 0) record.branches.covered += 1;
      }
    }
    bySource.set(source, record);
  }
  if (bySource.size === 0) {
    throw new Error("coverage.lcov contains no source-mapped src/ records");
  }

  const byFolder = new Map();
  for (const [source, record] of bySource) {
    const folder = sourceFolder(source);
    const aggregate = byFolder.get(folder) ?? {
      branches: { covered: 0, total: 0 },
      lines: { covered: 0, total: 0 },
    };
    addCoverage(aggregate, record);
    byFolder.set(folder, aggregate);
  }
  const overall = {
    branches: { covered: 0, total: 0 },
    lines: { covered: 0, total: 0 },
  };
  for (const record of bySource.values()) addCoverage(overall, record);

  return {
    by_folder: Object.fromEntries(
      [...byFolder]
        .sort(([left], [right]) => left.localeCompare(right, "en"))
        .map(([folder, record]) => [folder, finishCoverage(record)]),
    ),
    overall: finishCoverage(overall),
  };
}

function sourceFolder(filename) {
  const parts = filename.split("/");
  return parts.length > 2 ? `src/${parts[1]}` : "src";
}

function addCoverage(target, source) {
  target.lines.covered += source.lines.covered;
  target.lines.total += source.lines.total;
  target.branches.covered += source.branches.covered;
  target.branches.total += source.branches.total;
}

function finishCoverage(record) {
  return {
    branches: {
      covered: record.branches.covered,
      percentage: percentage(record.branches.covered, record.branches.total),
      total: record.branches.total,
    },
    lines: {
      covered: record.lines.covered,
      percentage: percentage(record.lines.covered, record.lines.total),
      total: record.lines.total,
    },
  };
}

function percentage(covered, total) {
  return total === 0 ? null : Number(((covered / total) * 100).toFixed(2));
}

function groupComplexity(findings) {
  const grouped = new Map();
  for (const finding of findings) {
    const entries = grouped.get(finding.file) ?? [];
    entries.push({
      column: finding.column,
      line: finding.line,
      max: finding.max,
      score: finding.score,
    });
    grouped.set(finding.file, entries);
  }
  return Object.fromEntries(
    [...grouped].sort(([left], [right]) => left.localeCompare(right, "en")),
  );
}

function countAssertions(directory) {
  const totals = { any: 0, non_null_assertions: 0 };
  for (const filename of sourceFiles(directory)) {
    const source = ts.createSourceFile(
      portablePath(path.relative(root, filename)),
      readFileSync(filename, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    );
    visit(source);
  }
  return totals;

  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) totals.any += 1;
    if (node.kind === ts.SyntaxKind.NonNullExpression) totals.non_null_assertions += 1;
    ts.forEachChild(node, visit);
  }
}

function sourceFiles(directory) {
  const files = [];
  for (const name of readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    if (statSync(filename).isDirectory()) files.push(...sourceFiles(filename));
    else if (name.endsWith(".ts")) files.push(filename);
  }
  return files;
}

function toolVersions() {
  return [
    { name: "biome", version: packageVersion("@biomejs/biome") },
    { name: "node", version: process.versions.node },
    { name: "node:test", version: process.versions.node },
    { name: "typescript", version: packageVersion("typescript") },
  ];
}

function packageVersion(name) {
  const manifest = JSON.parse(
    readFileSync(path.join(root, "node_modules", ...name.split("/"), "package.json"), "utf8"),
  );
  if (typeof manifest.version !== "string") throw new Error(`missing version for ${name}`);
  return manifest.version;
}

function digestConfig() {
  const inputs = [
    "biome.json",
    "package-lock.json",
    "package.json",
    "scripts/health-snapshot.mjs",
    "scripts/run-tests.mjs",
    "tsconfig.json",
  ];
  const content = Object.fromEntries(inputs.map((filename) => [
    filename,
    readFileSync(path.join(root, ...filename.split("/")), "utf8").replaceAll("\r\n", "\n"),
  ]));
  return createHash("sha256").update(canonicalString(content)).digest("hex");
}

function canonicalString(value) {
  return JSON.stringify(sortJson(value));
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortJson(value[key])]),
  );
}

function writeJson(filename, value) {
  writeFileSync(filename, `${JSON.stringify(sortJson(value), null, 2)}\n`);
}

function portablePath(filename) {
  return filename.replaceAll("\\", "/");
}

function compareFields(fields) {
  return (left, right) => {
    for (const field of fields) {
      if (left[field] === right[field]) continue;
      return left[field] < right[field] ? -1 : 1;
    }
    return 0;
  };
}
