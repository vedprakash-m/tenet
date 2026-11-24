import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : fallback;
}

const cli = path.resolve(option("--cli", ""));
const outArg = option("--out", "");
if (!cli) throw new Error("missing --cli");
if (!outArg) throw new Error("missing --out");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const generator = path.join(__dirname, "generate.mjs");
const benchRoot = "Q:\\Ved\\Pers\\backtest-clones\\bench";
const date = new Date().toISOString().slice(0, 10);
const resultsDir = path.resolve(outArg, date);
const counts = [1000, 5000, 10000, 30000];
const size = 1024;
const specs = 5;

function exec(command, commandArgs, cwd, timeoutMs = 600000) {
  const start = process.hrtime.bigint();
  return new Promise((resolve) => {
    execFile(command, commandArgs, {
      cwd,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 64 * 1024 * 1024,
      timeout: timeoutMs,
    }, (error, stdout, stderr) => {
      const elapsed = Number(process.hrtime.bigint() - start) / 1e9;
      resolve({
        exit: typeof error?.code === "number" ? error.code : (error ? 1 : 0),
        elapsed,
        timedOut: error?.killed === true,
        stdout: stdout || "",
        stderr: stderr || "",
      });
    });
  });
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

await rm(resultsDir, { recursive: true, force: true });
await mkdir(resultsDir, { recursive: true });
await mkdir(benchRoot, { recursive: true });

const commands = [
  ["check", "--json"],
  ["board", "--json"],
  ["context", "--query", "x", "--budget-tokens", "2000", "--json"],
  ["onboard", "--inventory-only", "--json"],
];

const table = [];
for (const docs of counts) {
  const fixture = path.join(benchRoot, `docs-${docs}-size-${size}-specs-${specs}`);
  await exec(process.execPath, [generator, "--out", fixture, "--docs", String(docs), "--size", String(size), "--specs", String(specs)], __dirname);
  const row = { docs };

  for (const commandArgs of commands) {
    const samples = [];
    for (let run = 0; run < 3; run += 1) {
      const result = await exec(process.execPath, [cli, ...commandArgs], fixture);
      samples.push(result.elapsed);
    }
    row[commandArgs[0]] = median(samples);
  }
  table.push(row);
}

const first = table[0];
const last = table.at(-1);
const lines = [
  "# Performance benchmark",
  "",
  `Generated fixtures: ${counts.join(", ")} markdown files, ${size} bytes target each, ${specs} specification documents.`,
  "",
  "| Markdown files | check | board | context | onboard inventory |",
  "|---:|---:|---:|---:|---:|",
];

for (const row of table) {
  lines.push(`| ${row.docs} | ${row.check.toFixed(3)} s | ${row.board.toFixed(3)} s | ${row.context.toFixed(3)} s | ${row.onboard.toFixed(3)} s |`);
}

lines.push("", "## Growth: 1k to 30k markdown files", "");
for (const command of ["check", "board", "context", "onboard"]) {
  const from = first[command];
  const to = last[command];
  const multiple = from > 0 ? to / from : 0;
  lines.push(`- ${command}: ${from.toFixed(3)} s to ${to.toFixed(3)} s (${multiple.toFixed(2)}x)`);
}

await writeFile(path.join(resultsDir, "RESULTS.md"), `${lines.join("\n")}\n`, "utf8");
