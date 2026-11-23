import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

/**
 * Materialize an onboarding evaluation fixture into a clean target directory
 * with its full multi-commit git history (from history.json) and HEAD matching `repo/`.
 *
 * Usage: node pkg/evals/onboarding/materialize.mjs <fixture-name> <target-dir>
 */
const [, , fixtureName, targetDir] = process.argv;
if (!fixtureName || !targetDir) {
  console.error("Usage: node materialize.mjs <fixture-name> <target-dir>");
  process.exit(2);
}

const evalRoot = path.dirname(fileURLToPath(import.meta.url));
const fixtureDir = path.join(evalRoot, fixtureName);
const historyPath = path.join(fixtureDir, "history.json");
const repoTemplateDir = path.join(fixtureDir, "repo");

if (!fs.existsSync(historyPath) || !fs.existsSync(repoTemplateDir)) {
  console.error(`Fixture not found: ${fixtureDir}`);
  process.exit(2);
}

fs.rmSync(targetDir, { recursive: true, force: true });
fs.mkdirSync(targetDir, { recursive: true });

const git = (args, extraEnv = {}) =>
  execFileSync("git", ["-c", "core.quotepath=false", ...args], {
    cwd: targetDir,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "Eval Maintainer",
      GIT_AUTHOR_EMAIL: "maintainer@example.com",
      GIT_COMMITTER_NAME: "Eval Maintainer",
      GIT_COMMITTER_EMAIL: "maintainer@example.com",
      ...extraEnv,
    },
  });

git(["init", "-b", "main"]);
git(["config", "core.autocrlf", "false"]);

const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
for (const commit of history.commits) {
  for (const rel of commit.remove ?? []) {
    fs.rmSync(path.join(targetDir, rel), { force: true });
  }
  for (const [rel, content] of Object.entries(commit.files ?? {})) {
    const dest = path.join(targetDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content, "utf8");
  }
  git(["add", "-A"]);
  git(["commit", "-m", commit.message], {
    GIT_AUTHOR_DATE: commit.date,
    GIT_COMMITTER_DATE: commit.date,
  });
}

function listFiles(root, prefix = "") {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === ".git") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...listFiles(path.join(root, entry.name), rel));
    else out.push(rel);
  }
  return out.sort();
}

const expectedFiles = listFiles(repoTemplateDir);
const actualFiles = listFiles(targetDir);
const trackedFiles = git(["ls-tree", "-r", "--name-only", "HEAD"]).trim().split(/\r?\n/).filter(Boolean).sort();
const dirtyStatus = git(["status", "--porcelain"]).trim();

if (dirtyStatus) {
  console.error(`Materialized repository has untracked/dirty status:\n${dirtyStatus}`);
  process.exit(1);
}
if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles) || JSON.stringify(expectedFiles) !== JSON.stringify(trackedFiles)) {
  console.error("Mismatch between materialized git HEAD, working tree, and repo/ snapshot!");
  process.exit(1);
}
for (const rel of expectedFiles) {
  const a = fs.readFileSync(path.join(repoTemplateDir, rel), "utf8").replace(/\r\n/g, "\n");
  const b = fs.readFileSync(path.join(targetDir, rel), "utf8").replace(/\r\n/g, "\n");
  if (a !== b) {
    console.error(`Content mismatch in ${rel}`);
    process.exit(1);
  }
}

console.log(`Materialized ${fixtureName} (${history.commits.length} commits, ${actualFiles.length} files) at ${targetDir}`);
