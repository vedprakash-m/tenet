import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const source = "Q:\\Ved\\Pers\\tenet";
const track4 = fileURLToPath(new URL("../../../", import.meta.url));
const evalRoot = fileURLToPath(new URL(".", import.meta.url));
const scratchRoot = await mkdtemp(path.join(await realTmp(), "tenet-pack-smoke-"));
const packDir = path.join(scratchRoot, "pack");
const projectDir = path.join(scratchRoot, "consumer");
const homeDir = path.join(scratchRoot, "home");
const repoDir = path.join(scratchRoot, "repo");
const date = new Date().toISOString().slice(0, 10);
const resultsDir = path.join(evalRoot, "results", date);

async function realTmp() {
  const tmp = await import("node:fs/promises").then(({ realpath }) => realpath(os.tmpdir()));
  return tmp;
}

function npmCli() {
  if (process.platform === "win32") {
    return path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js");
  }
  return path.join(path.dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npm-cli.js");
}

function npxCli() {
  if (process.platform === "win32") {
    return path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npx-cli.js");
  }
  return path.join(path.dirname(process.execPath), "..", "lib", "node_modules", "npm", "bin", "npx-cli.js");
}

function execute(command, args, cwd, env = process.env, timeout = 600_000) {
  return new Promise((resolve) => {
    const started = performance.now();
    execFile(command, args, {
      cwd,
      env,
      timeout,
      encoding: "utf8",
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      shell: process.platform === "win32" && /\.(cmd|bat)$/i.test(command),
    }, (error, stdout, stderr) => {
      resolve({
        exit: typeof error?.code === "number" ? error.code : error ? 1 : 0,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        seconds: (performance.now() - started) / 1000,
      });
    });
  });
}

function requireSuccess(result, label) {
  if (result.exit !== 0) {
    throw new Error(`${label} exited ${result.exit}\n${(result.stderr || result.stdout).trim().slice(0, 4000)}`);
  }
  return result;
}

function firstThirtyLines(stdout, stderr) {
  const text = [stdout.trimEnd(), stderr.trimEnd()].filter(Boolean).join("\n");
  return text.split(/\r?\n/).slice(0, 30).join("\n");
}

function parseJsonObject(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", "<br>");
}

async function walkFiles(root, prefix = "") {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...await walkFiles(path.join(root, ...relative.split("/")), relative));
    else files.push(relative);
  }
  return files;
}

await mkdir(packDir, { recursive: true });
await mkdir(projectDir, { recursive: true });
await mkdir(homeDir, { recursive: true });

const buildSteps = [
  ["git pull --ff-only", ["pull", "--ff-only"], source],
  ["npm ci", ["ci"], source],
  ["npm run build", ["run", "build"], source],
];
const buildResults = [];
for (const [label, args, cwd] of buildSteps) {
  const command = args[0] === "pull" ? "git" : process.execPath;
  const actualArgs = args[0] === "pull" ? args : [npmCli(), ...args];
  const result = await execute(command, actualArgs, cwd);
  buildResults.push({ label, ...result });
  requireSuccess(result, label);
}

const packResult = await execute(process.execPath, [npmCli(), "pack", "--json", "--pack-destination", packDir], source);
requireSuccess(packResult, "npm pack --json");
const packJson = parseJsonObject(packResult.stdout);
if (!Array.isArray(packJson) || packJson.length !== 1) {
  throw new Error(`npm pack returned no unique JSON result:\n${packResult.stdout}\n${packResult.stderr}`);
}
const pack = packJson[0];
const tarball = path.join(packDir, pack.filename);
const tarballStat = await stat(tarball);
const tarballFiles = Array.isArray(pack.files)
  ? pack.files.map((entry) => String(entry.path).replace(/^package\//, ""))
  : [];
const fileCount = typeof pack.entryCount === "number" ? pack.entryCount : tarballFiles.length;

const conformance = new Map();
for (const file of tarballFiles) {
  if (!file.startsWith("pkg/conformance/")) continue;
  const remainder = file.slice("pkg/conformance/".length);
  const suite = remainder.split("/")[0] || "(root)";
  if (!conformance.has(suite)) conformance.set(suite, []);
  conformance.get(suite).push(file);
}
const conformanceSuites = [...conformance.entries()].sort(([left], [right]) => left.localeCompare(right));

await writeFile(path.join(projectDir, "package.json"), `${JSON.stringify({
  name: "tenet-pack-smoke-consumer",
  private: true,
  version: "1.0.0",
}, null, 2)}\n`);
const installEnv = {
  ...process.env,
  npm_config_registry: "https://registry.npmjs.org/",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_fetch_retries: "1",
  npm_config_fetch_timeout: "30000",
  npm_config_strict_ssl: "false",
};
const install = await execute(process.platform === "win32" ? "npm.cmd" : process.execPath,
  process.platform === "win32"
    ? ["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball]
    : [npmCli(), "install", "--ignore-scripts", "--no-audit", "--no-fund", tarball],
  projectDir,
  installEnv);
let installFallback = null;
const consumerModules = path.join(projectDir, "node_modules");
if (install.exit !== 0) {
  installFallback = "npm install <tarball> failed; used local build dependencies and extracted tarball for smoke execution";
  await mkdir(consumerModules, { recursive: true });
  await cp(path.join(source, "node_modules"), consumerModules, { recursive: true });
  const extractDir = path.join(scratchRoot, "tarball");
  await mkdir(extractDir, { recursive: true });
  const extract = await execute("tar", ["-xzf", tarball, "-C", extractDir], scratchRoot);
  requireSuccess(extract, "extract <tarball>");
  const packageTarget = path.join(consumerModules, "@vedprakash-m", "tenet");
  await mkdir(path.dirname(packageTarget), { recursive: true });
  await rm(packageTarget, { recursive: true, force: true });
  await cp(path.join(extractDir, "package"), packageTarget, { recursive: true });
  if (process.platform === "win32") {
    const binDir = path.join(consumerModules, ".bin");
    await mkdir(binDir, { recursive: true });
    await writeFile(path.join(binDir, "tenet.cmd"), '@ECHO off\r\nnode "%~dp0\\..\\@vedprakash-m\\tenet\\dist\\cli.js" %*\r\n');
  }
  await writeFile(path.join(projectDir, "package.json"), `${JSON.stringify({
    name: "tenet-pack-smoke-consumer",
    private: true,
    version: "1.0.0",
    dependencies: {
      "@vedprakash-m/tenet": "file:../pack/" + path.basename(tarball),
    },
  }, null, 2)}\n`);
}

await cp(path.join(track4, "pkg", "evals", "onboarding", "node-service", "repo"), repoDir, { recursive: true });
const gitInitEnv = {
  ...process.env,
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_TERMINAL_PROMPT: "0",
};
const gitInit = await execute("git", ["init", "-b", "main"], repoDir, gitInitEnv);
requireSuccess(gitInit, "git init");
const gitAdd = await execute("git", ["add", "-A"], repoDir, gitInitEnv);
requireSuccess(gitAdd, "git add");
const gitCommit = await execute("git", ["commit", "-m", "Initial pack smoke fixture"], repoDir, gitInitEnv);
if (gitCommit.exit !== 0) requireSuccess(gitCommit, "git commit");
await cp(consumerModules, path.join(repoDir, "node_modules"), { recursive: true });

const isolatedEnv = {
  ...process.env,
  HOME: homeDir,
  USERPROFILE: homeDir,
  APPDATA: path.join(homeDir, "AppData", "Roaming"),
  XDG_CONFIG_HOME: path.join(homeDir, ".config"),
  npm_config_registry: "https://registry.npmjs.org/",
  npm_config_audit: "false",
  npm_config_fund: "false",
  npm_config_offline: "true",
  NPM_CONFIG_OFFLINE: "true",
};
await mkdir(isolatedEnv.APPDATA, { recursive: true });
await mkdir(isolatedEnv.XDG_CONFIG_HOME, { recursive: true });

const helpResult = await execute(process.execPath, [npxCli(), "tenet", "--help"], repoDir, isolatedEnv);
const doctorExists = /\bdoctor\b/.test(`${helpResult.stdout}\n${helpResult.stderr}`);
const commands = [
  { label: "npx tenet --version", args: ["tenet", "--version"] },
  { label: "npx tenet --help", args: ["tenet", "--help"] },
  { label: "npx tenet onboard --inventory-only --json", args: ["tenet", "onboard", "--inventory-only", "--json"] },
  { label: "npx tenet check --json", args: ["tenet", "check", "--json"] },
  { label: "npx tenet board --json", args: ["tenet", "board", "--json"] },
  { label: "npx tenet context --query test --budget-tokens 2000 --json", args: ["tenet", "context", "--query", "test", "--budget-tokens", "2000", "--json"] },
];
if (doctorExists) commands.push({ label: "npx tenet doctor --json", args: ["tenet", "doctor", "--json"] });

const commandResults = [];
for (const command of commands) {
  const result = await execute(process.execPath, [npxCli(), ...command.args], repoDir, isolatedEnv);
  let ok = null;
  const envelope = parseJsonObject(result.stdout);
  if (envelope && typeof envelope.ok === "boolean") ok = envelope.ok;
  commandResults.push({
    label: command.label,
    exit: result.exit,
    ok,
    seconds: result.seconds,
    lines: firstThirtyLines(result.stdout, result.stderr),
  });
}

const forbidden = [
  "pkg/evals/",
  "tenet/",
  "test/",
  "src/",
  ".github/",
  "package-lock.json",
  "LICENSE-docs",
  "runner/",
];
const forbiddenMatches = [];
for (const file of tarballFiles) {
  for (const prefix of forbidden) {
    if (file === prefix.replace(/\/$/, "") || file.startsWith(prefix)) forbiddenMatches.push({ file, forbidden: prefix });
  }
}

const problems = [];
if (installFallback) problems.push(installFallback);
for (const result of commandResults) {
  const combined = `${result.lines}\n`;
  if (result.exit === 1 && /EPIPE|Cannot find|cannot find|SyntaxError|TypeError|ReferenceError|Stack trace/i.test(combined)) {
    problems.push(`${result.label}: command appears to crash`);
  }
  if (/\bTN-INTERNAL\b/i.test(combined)) problems.push(`${result.label}: prints TN-INTERNAL`);
  if (typeof result.ok === "boolean" && (result.ok ? result.exit !== 0 : result.exit === 0)) {
    problems.push(`${result.label}: ok=${result.ok} disagrees with exit code ${result.exit}`);
  }
}
for (const match of forbiddenMatches) problems.push(`Tarball contains forbidden checklist path: ${match.file}`);

const ownImports = new Set();
const distDir = path.join(source, "dist");
async function scanDist(relativeDir = "") {
  const dir = path.join(distDir, relativeDir);
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const relative = path.posix.join(relativeDir.replaceAll("\\", "/"), entry.name);
    if (entry.isDirectory()) await scanDist(relative);
    else if (entry.isFile() && entry.name.endsWith(".js")) {
      const text = await readFile(path.join(dir, entry.name), "utf8");
      for (const match of text.matchAll(/(?:from\s+|import\s*\(|import\s+)["'](\.[^"']+)["']/g)) {
        const specifier = match[1];
        if (!specifier) continue;
        const target = path.posix.normalize(path.posix.join(relativeDir.replaceAll("\\", "/"), specifier));
        ownImports.add(target.endsWith(".js") ? target : `${target}.js`);
      }
    }
  }
}
await scanDist();
for (const importFile of [...ownImports].sort()) {
  if (!tarballFiles.includes(`dist/${importFile}`)) {
    problems.push(`Tarball is missing runtime JavaScript import: dist/${importFile}`);
  }
}
for (const required of [
  "package.json",
  "LICENSE",
  "README.md",
  "dist/cli.js",
  "dist/sdk.js",
  "kit/TENET.md",
  "kit/CHANGELOG.md",
  "kit/README.md",
]) {
  if (!tarballFiles.includes(required)) problems.push(`Tarball is missing required runtime file: ${required}`);
}

const harness = requireSuccess(await execute("git", ["rev-parse", "HEAD"], source), "git rev-parse").stdout.trim();
await mkdir(resultsDir, { recursive: true });

const lines = [
  `# Pack Smoke Test - ${date}`,
  "",
  "## Environment",
  "",
  `- Harness commit: \`${harness}\``,
  `- Branch: \`r8/pack-smoke\``,
  `- Source: \`Q:\\Ved\\Pers\\tenet\``,
  `- Scratch: \`${scratchRoot}\``,
  `- Tarball: \`${tarball}\``,
  `- Tarball size: ${tarballStat.size} bytes`,
  `- Tarball file count: ${fileCount}`,
  "",
  "## Build and pack",
  "",
];
for (const result of buildResults) {
  lines.push(`- ${result.label}: exit ${result.exit}, ${result.seconds.toFixed(3)}s`);
}
lines.push(`- npm pack --json: exit ${packResult.exit}, ${packResult.seconds.toFixed(3)}s`);
lines.push(`- npm install <tarball>: exit ${install.exit}, ${install.seconds.toFixed(3)}s`);
lines.push("", "## pkg/conformance files grouped by suite", "");
if (conformanceSuites.length === 0) lines.push("None.");
for (const [suite, files] of conformanceSuites) {
  lines.push(`### ${suite}`, "", `Count: ${files.length}`, "");
  for (const file of files.sort()) lines.push(`- \`${file}\``);
  lines.push("");
}

lines.push("## Command results", "");
lines.push("| Command | Exit | ok | Seconds |");
lines.push("|---|---:|---:|---:|");
for (const result of commandResults) {
  lines.push(`| ${escapeTable(result.label)} | ${result.exit} | ${result.ok === null ? "n/a" : result.ok} | ${result.seconds.toFixed(3)} |`);
}
lines.push("");
for (const result of commandResults) {
  lines.push(`### ${result.label}`, "", "```text", result.lines || "(no output)", "```", "");
}

lines.push("## Problems", "");
if (problems.length === 0) lines.push("None.");
else for (const problem of [...new Set(problems)].sort()) lines.push(`- ${problem}`);
lines.push("");

await writeFile(path.join(resultsDir, "RESULTS.md"), `${lines.join("\n")}\n`);
console.log(JSON.stringify({
  report: path.join(resultsDir, "RESULTS.md"),
  tarball,
  size: tarballStat.size,
  fileCount,
  problems: [...new Set(problems)],
  scratch: scratchRoot,
}, null, 2));
