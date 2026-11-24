import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readlink, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const evalRoot = fileURLToPath(new URL(".", import.meta.url));
const source = "Q:\\Ved\\Pers\\tenet";
const cli = path.join(source, "dist", "cli.js");
const repos = JSON.parse(await readFile(path.join(evalRoot, "repos.json"), "utf8"));
const scratchRoot = await mkdtemp(path.join(await realpath(os.tmpdir()), "tenet-smoke-init-"));
const date = new Date().toISOString().slice(0, 10);
const resultsDir = path.join(evalRoot, "results", date);
const localBaseline = "Q:\\Ved\\Pers\\backtest-clones";

async function realpath(value) {
  const { realpath } = await import("node:fs/promises");
  return realpath(value);
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
    }, (error, stdout, stderr) => {
      resolve({
        exit: typeof error?.code === "number" ? error.code : error ? 1 : 0,
        seconds: (performance.now() - started) / 1000,
        stdout: stdout ?? "",
        stderr: stderr ?? "",
        timedOut: error?.killed === true,
      });
    });
  });
}

function requireSuccess(result, label) {
  if (result.exit !== 0) throw new Error(`${label} exited ${result.exit}: ${(result.stderr || result.stdout).trim().slice(0, 4000)}`);
  return result;
}

function combined(result) {
  return [result.stdout.trimEnd(), result.stderr.trimEnd()].filter(Boolean).join("\n");
}

function first30Lines(result) {
  return combined(result).split(/\r?\n/).slice(0, 30).join("\n");
}

function envelopes(text) {
  const parsed = [];
  for (const line of text.split(/\r?\n/)) {
    try {
      const value = JSON.parse(line);
      if (value && typeof value === "object") parsed.push(value);
    } catch {}
  }
  const line = text.trim();
  try {
    const value = JSON.parse(line);
    if (value && typeof value === "object") parsed.push(value);
  } catch {}
  return parsed;
}

function envelope(result) {
  const found = envelopes(combined(result));
  return found.reverse().find((value) => typeof value.ok === "boolean") ?? null;
}

function classify(result) {
  if (result.timedOut) return "timeout";
  const text = combined(result);
  if (/\bTN-INTERNAL\b/i.test(text) || /\b(UnhandledPromiseRejection|TypeError|ReferenceError|SyntaxError|Traceback)\b/.test(text)) return "crash";
  const found = envelope(result);
  if (found && found.ok === true && result.exit !== 0) return "contradictory";
  if (found && found.ok === false && result.exit === 0) return "contradictory";
  if (found?.ok === false) return "finding";
  if (result.exit !== 0) return "exit-error";
  if (found?.ok === true) return "ok";
  return "ok";
}

async function treeSnapshot(root) {
  const entries = [];
  async function visit(directory, relative = "") {
    const names = await readdir(directory);
    names.sort((a, b) => a.localeCompare(b));
    for (const name of names) {
      if (!relative && name === ".git") continue;
      const full = path.join(directory, name);
      const rel = relative ? `${relative}/${name}` : name;
      const info = await lstat(full);
      if (info.isDirectory()) {
        entries.push({ path: rel, type: "dir", mode: info.mode & 0xffff });
        await visit(full, rel);
      } else if (info.isSymbolicLink()) {
        entries.push({ path: rel, type: "symlink", mode: info.mode & 0xffff, target: await readlink(full) });
      } else if (info.isFile()) {
        const data = await readFile(full);
        entries.push({
          path: rel,
          type: "file",
          mode: info.mode & 0xffff,
          sha256: createHash("sha256").update(data).digest("hex"),
          size: data.length,
        });
      } else {
        entries.push({ path: rel, type: "other", mode: info.mode & 0xffff });
      }
    }
  }
  await visit(root);
  return entries;
}

function compareSnapshots(before, after) {
  const left = JSON.stringify(before);
  const right = JSON.stringify(after);
  if (left === right) return { equal: true, differences: [] };
  const beforeMap = new Map(before.map((entry) => [entry.path, entry]));
  const afterMap = new Map(after.map((entry) => [entry.path, entry]));
  const differences = [];
  for (const entry of before) {
    if (!afterMap.has(entry.path) || JSON.stringify(afterMap.get(entry.path)) !== JSON.stringify(entry)) {
      differences.push(`changed or removed: ${entry.path}`);
    }
  }
  for (const entry of after) if (!beforeMap.has(entry.path)) differences.push(`added: ${entry.path}`);
  return { equal: false, differences: differences.slice(0, 30) };
}

async function prepareRepo(repo, index) {
  const dest = path.join(scratchRoot, `repo-${index}-${repo.name}`);
  await mkdir(dest, { recursive: true });
  await rm(dest, { recursive: true, force: true });

  if (repo.category === "baseline" && repo.repo.includes(":")) {
    await cp(repo.repo, dest, { recursive: true });
  } else if (repo.category === "baseline" && repo.name === "torus") {
    await cp(repo.repo, dest, { recursive: true });
  } else if (repo.category === "baseline") {
    const sourceDir = path.join(localBaseline, repo.name);
    if ((await stat(sourceDir).catch(() => null))?.isDirectory()) {
      await cp(sourceDir, dest, { recursive: true });
    } else {
      const cloneEnv = {
        ...process.env,
        GIT_TERMINAL_PROMPT: "0",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_COUNT: "1",
        GIT_CONFIG_KEY_0: "core.longpaths",
        GIT_CONFIG_VALUE_0: "true",
      };
      const clone = await execute("git", ["clone", "--no-hardlinks", `https://github.com/${repo.repo}.git`, dest], scratchRoot, cloneEnv, 180_000);
      if (clone.exit !== 0) throw new Error(`clone ${repo.name} failed: ${(clone.stderr || clone.stdout).trim().slice(0, 4000)}`);
    }
  } else {
    const cloneEnv = {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "core.longpaths",
      GIT_CONFIG_VALUE_0: "true",
    };
    const clone = await execute("git", ["clone", "--no-hardlinks", `https://github.com/${repo.repo}.git`, dest], scratchRoot, cloneEnv, 180_000);
    if (clone.exit !== 0) throw new Error(`clone ${repo.name} failed: ${(clone.stderr || clone.stdout).trim().slice(0, 4000)}`);
  }

  const gitCheck = await execute("git", ["rev-parse", "--git-dir"], dest);
  if (gitCheck.exit !== 0) {
    requireSuccess(await execute("git", ["init", "-b", "main"], dest), `git init ${repo.name}`);
  }
  return dest;
}

function escapeTable(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", "<br>");
}

await mkdir(resultsDir, { recursive: true });
const harness = requireSuccess(await execute("git", ["rev-parse", "HEAD"], source), "git rev-parse").stdout.trim();
const matrix = [];
const problemRows = [];

for (const [index, repo] of repos.entries()) {
  console.log(`Starting ${repo.name}`);
  const homeDir = path.join(scratchRoot, `home-${index}-${repo.name}`);
  await mkdir(homeDir, { recursive: true });
  const env = {
    ...process.env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    APPDATA: path.join(homeDir, "AppData", "Roaming"),
    XDG_CONFIG_HOME: path.join(homeDir, ".config"),
  };
  await mkdir(env.APPDATA, { recursive: true });
  await mkdir(env.XDG_CONFIG_HOME, { recursive: true });

  const dest = await prepareRepo(repo, index);
  const fresh = await treeSnapshot(dest);

  const init1 = await execute(process.execPath, [cli, "init", "--yes", "--json"], dest, env);
  const init1Env = envelope(init1);
  const plan = init1Env?.result?.plan ?? init1Env?.result?.wrote ?? null;
  const warnings = [
    ...(Array.isArray(init1Env?.result?.findings) ? init1Env.result.findings : []),
  ].map((finding) => typeof finding === "string" ? finding : finding.message ?? JSON.stringify(finding));

  const afterInit1 = await treeSnapshot(dest);
  const init2 = await execute(process.execPath, [cli, "init", "--yes", "--json"], dest, env);
  const afterInit2 = await treeSnapshot(dest);
  const idempotence = compareSnapshots(afterInit1, afterInit2);

  const rows = [
    { label: "init --yes --json (first)", result: init1 },
    { label: "init --yes --json (second)", result: init2 },
  ];
  for (const [label, args] of [
    ["doctor --json", ["doctor", "--json"]],
    ["onboard --inventory-only --json", ["onboard", "--inventory-only", "--json"]],
    ["check --json", ["check", "--json"]],
    ["board --json", ["board", "--json"]],
  ]) rows.push({ label, result: await execute(process.execPath, [cli, ...args], dest, env) });

  const remove = await execute(process.execPath, [cli, "remove", "--json"], dest, env);
  rows.push({ label: "remove --json", result: remove });
  const afterRemove = await treeSnapshot(dest);
  const restore = compareSnapshots(fresh, afterRemove);

  const classifications = rows.map((row) => ({ label: row.label, class: classify(row.result) }));
  for (const row of classifications) {
    if (row.class !== "ok") problemRows.push(`${repo.name}: ${row.label}: ${row.class}`);
  }
  if (!idempotence.equal) problemRows.push(`${repo.name}: idempotence failed`);
  if (!restore.equal) problemRows.push(`${repo.name}: restore failed`);

  matrix.push({
    repo,
    freshCount: fresh.length,
    init1,
    init1Env,
    plan,
    warnings,
    init2,
    idempotence,
    restore,
    rows,
  });
}

const lines = [
  `# Init Smoke Matrix - ${date}`,
  "",
  "## Summary",
  "",
  `- Harness commit: \`${harness}\``,
  `- Repositories: ${repos.length}`,
  `- Scratch: \`${scratchRoot}\``,
  "",
  "| Repository | Category | Init 1 | Init 2 | Idempotence | Doctor | Onboard | Check | Board | Remove | Restore |",
  "|---|---|---:|---:|---|---|---|---|---|---|---|",
];

for (const entry of matrix) {
  const byLabel = new Map(entry.rows.map((row) => [row.label, row]));
  const c = (label) => {
    const row = byLabel.get(label);
    if (!row) return "missing";
    return `${classify(row.result)} (${row.result.exit}, ${row.result.seconds.toFixed(3)}s)`;
  };
  lines.push(`| ${escapeTable(entry.repo.name)} | ${escapeTable(entry.repo.category)} | ${c("init --yes --json (first)")} | ${c("init --yes --json (second)")} | ${entry.idempotence.equal ? "PASS" : "FAIL"} | ${c("doctor --json")} | ${c("onboard --inventory-only --json")} | ${c("check --json")} | ${c("board --json")} | ${c("remove --json")} | ${entry.restore.equal ? "PASS" : "FAIL"} |`);
}

lines.push("", "## Problems", "");
if (problemRows.length === 0) lines.push("None.");
else for (const problem of problemRows) lines.push(`- ${problem}`);

for (const entry of matrix) {
  lines.push(
    "",
    `## ${entry.repo.name}`,
    "",
    `- Repository: \`${entry.repo.repo}\``,
    `- Category: \`${entry.repo.category}\``,
    `- Why: ${entry.repo.why}`,
    `- Fresh tree entries: ${entry.freshCount}`,
    `- First init ok: ${entry.init1Env?.ok ?? "n/a"}`,
    `- First init exit: ${entry.init1.exit}`,
    `- First init seconds: ${entry.init1.seconds.toFixed(3)}`,
    `- Planned to write: ${escapeTable(JSON.stringify(entry.plan ?? null))}`,
    `- Warning: ${entry.warnings.length ? escapeTable(entry.warnings.join("; ")) : "none"}`,
    `- Idempotence: ${entry.idempotence.equal ? "PASS" : "FAIL"}`,
  );
  if (!entry.idempotence.equal) lines.push(`- Idempotence differences: ${entry.idempotence.differences.map(escapeTable).join("; ")}`);
  lines.push(`- Restore: ${entry.restore.equal ? "PASS" : "FAIL"}`);
  if (!entry.restore.equal) lines.push(`- Restore differences: ${entry.restore.differences.map(escapeTable).join("; ")}`);

  for (const row of entry.rows) {
    lines.push(
      "",
      `### ${row.label}`,
      "",
      `- Exit code: ${row.result.exit}`,
      `- ok: ${envelope(row.result)?.ok ?? "n/a"}`,
      `- Seconds: ${row.result.seconds.toFixed(3)}`,
      `- Class: ${classify(row.result)}`,
      "",
      "```text",
      first30Lines(row.result) || "(no output)",
      "```",
    );
  }
}

await writeFile(path.join(resultsDir, "INIT.md"), `${lines.join("\n")}\n`);
console.log(JSON.stringify({
  report: path.join(resultsDir, "INIT.md"),
  scratch: scratchRoot,
  problems: problemRows,
  idempotenceFailures: matrix.filter((entry) => !entry.idempotence.equal).map((entry) => entry.repo.name),
  restoreFailures: matrix.filter((entry) => !entry.restore.equal).map((entry) => entry.repo.name),
}, null, 2));
