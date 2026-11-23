import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scratch = "Q:\\Ved\\Pers\\backtest-clones";
const prsDir = path.join(__dirname, "prs");
const diffsDir = path.join(__dirname, "diffs");

function exec(command, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: "buffer", windowsHide: true, maxBuffer: 128 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        reject(Object.assign(error, { stderr: stderr.toString("utf8") }));
      } else {
        resolve(stdout);
      }
    });
  });
}

async function git(cwd, args) {
  return exec("git", args, cwd);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function fileName(repo, number) {
  const [owner, name] = repo.split("/", 2);
  return `${owner}__${name}__${number}.json`;
}

function diffName(repo, number) {
  const [owner, name] = repo.split("/", 2);
  return `${owner}__${name}__${number}.diff.gz`;
}

async function ensureClone(owner, repo) {
  await mkdir(scratch, { recursive: true });
  const dir = path.join(scratch, repo);
  let exists = false;
  try {
    await stat(path.join(dir, ".git"));
    exists = true;
  } catch {}
  if (!exists) {
    await exec("git", ["clone", `https://github.com/${owner}/${repo}.git`, dir], scratch);
  } else {
    await git(dir, ["fetch", "--all", "--tags", "--prune"]);
  }
  return dir;
}

async function fetchPull(dir, owner, repo, number) {
  await git(dir, ["fetch", "--force", "origin", `refs/pull/${number}/head:refs/remotes/origin/pr/${number}`]);
}

async function resolveCommit(dir, sha) {
  if (!sha) return false;
  try {
    await git(dir, ["cat-file", "-e", `${sha}^{commit}`]);
    return true;
  } catch {
    try {
      await git(dir, ["fetch", "--force", "origin", sha]);
      await git(dir, ["cat-file", "-e", `${sha}^{commit}`]);
      return true;
    } catch {
      return false;
    }
  }
}

async function replayOne(dir, record) {
  await fetchPull(dir, "", "", record.number);
  const baseResolved = await resolveCommit(dir, record.base_sha);
  const headResolved = await resolveCommit(dir, record.head_sha);
  const mergeResolved = await resolveCommit(dir, record.merge_sha);
  const resolved = baseResolved && headResolved && mergeResolved;

  let diff = Buffer.alloc(0);
  let appliesAtBase = false;
  if (resolved) {
    diff = await git(dir, ["diff", "-U0", `${record.base_sha}...${record.head_sha}`]);
    const tempDir = await mkdtemp(path.join(scratch, "apply-check-"));
    const diffPath = path.join(tempDir, "case.diff");
    try {
      await git(dir, ["worktree", "add", "--detach", "--force", tempDir, record.base_sha]);
      await writeFile(diffPath, diff);
      try {
        await git(tempDir, ["apply", "--check", "--unidiff-zero", diffPath]);
        appliesAtBase = true;
      } catch {
        appliesAtBase = false;
      }
    } finally {
      await git(dir, ["worktree", "remove", "--force", tempDir]).catch(() => {});
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  record.diff_sha256 = sha256(diff);
  record.shas_resolved = resolved;
  record.applies_at_base = appliesAtBase;
  await writeFile(path.join(prsDir, fileName(record.repo, record.number)), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  await writeFile(path.join(diffsDir, diffName(record.repo, record.number)), gzipSync(diff));
  return resolved;
}

function parseCaseBlock(manifest, label) {
  const lines = manifest.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${label}:`);
  if (start < 0) throw new Error(`cohort.yaml missing ${label}`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] && !lines[index].startsWith(" ")) {
      end = index;
      break;
    }
  }
  const block = lines.slice(start + 1, end).join("\n");
  const cases = [];
  for (const match of block.matchAll(/  - repo: ([^\n]+)\n    number: (\d+)/g)) {
    cases.push({
      repo: match[1],
      number: Number(match[2]),
      group: block.slice(match.index).match(/\n    group: ([^\n]+)/)?.[1] || "reserve",
    });
  }
  return cases;
}

function replaceCaseBlock(manifest, label, cases) {
  const lines = manifest.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `${label}:`);
  if (start < 0) throw new Error(`cohort.yaml missing ${label}`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index] && !lines[index].startsWith(" ")) {
      end = index;
      break;
    }
  }
  const replacement = [`${label}:`];
  for (const item of cases) {
    replacement.push(`  - repo: ${item.repo}`);
    replacement.push(`    number: ${item.number}`);
    replacement.push(`    group: ${item.group}`);
  }
  return [...lines.slice(0, start), ...replacement, ...lines.slice(end)].join("\n");
}

function replaceGroupCount(manifest, group, count) {
  const lines = manifest.split(/\r?\n/);
  const start = lines.findIndex((line) => line === `  ${group}:`);
  if (start < 0) throw new Error(`cohort.yaml missing group ${group}`);
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("  ") && !lines[index].startsWith("    ")) {
      end = index;
      break;
    }
  }
  for (let index = start + 1; index < end; index += 1) {
    if (/^    cohort:/.test(lines[index])) {
      lines[index] = `    cohort: ${count}`;
      return lines.join("\n");
    }
  }
  throw new Error(`cohort.yaml missing cohort count for ${group}`);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

async function main() {
  await mkdir(diffsDir, { recursive: true });
  for (const name of await readdir(diffsDir)) {
    if (name.endsWith(".diff.gz")) await unlink(path.join(diffsDir, name)).catch(() => {});
  }

  const cohortYamlPath = path.join(__dirname, "cohort.yaml");
  let manifest = await readFile(cohortYamlPath, "utf8");
  let cohort = parseCaseBlock(manifest, "cohort_cases");
  let reserves = parseCaseBlock(manifest, "reserve_cases");

  const tenetDir = await ensureClone("vedprakash-m", "tenet-copilot");
  const webchatDir = await ensureClone("microsoft", "BotFramework-WebChat");

  const unresolvedCohort = [];
  for (let index = 0; index < cohort.length; index += 1) {
    const item = cohort[index];
    const record = JSON.parse(await readFile(path.join(prsDir, fileName(item.repo, item.number)), "utf8"));
    const dir = item.repo === "vedprakash-m/tenet-copilot" ? tenetDir : webchatDir;
    const resolved = await replayOne(dir, record);
    if (!resolved) unresolvedCohort.push({ ...item, resolved: false });
  }

  for (const unresolved of unresolvedCohort) {
    const position = cohort.findIndex((item) => item.repo === unresolved.repo && item.number === unresolved.number);
    if (position >= 0) cohort.splice(position, 1);
    await unlink(path.join(prsDir, fileName(unresolved.repo, unresolved.number))).catch(() => {});
    await unlink(path.join(diffsDir, diffName(unresolved.repo, unresolved.number))).catch(() => {});
  }

  for (const unresolved of unresolvedCohort) {
    let replacement = null;
    while (replacement === null && reserves.length > 0) {
      const candidate = reserves.shift();
      const record = JSON.parse(await readFile(path.join(prsDir, fileName(candidate.repo, candidate.number)), "utf8"));
      const dir = candidate.repo === "vedprakash-m/tenet-copilot" ? tenetDir : webchatDir;
      const resolved = await replayOne(dir, record);
      if (resolved) replacement = { ...candidate, group: "webchat-human" };
    }
    if (!replacement) throw new Error(`no resolved reserve available for unresolved ${unresolved.repo}#${unresolved.number}`);
    cohort.push(replacement);
  }

  for (const reserve of reserves) {
    const record = JSON.parse(await readFile(path.join(prsDir, fileName(reserve.repo, reserve.number)), "utf8"));
    const dir = reserve.repo === "vedprakash-m/tenet-copilot" ? tenetDir : webchatDir;
    await replayOne(dir, record);
  }

  if (cohort.length !== 100) throw new Error(`cohort after SHA replay=${cohort.length}; expected 100`);

  const reserveRecordNames = new Set(reserves.map((item) => fileName(item.repo, item.number)));
  reserves = reserves.map((item) => ({ ...item, group: "webchat-human" }));
  manifest = replaceCaseBlock(manifest, "cohort_cases", cohort);
  manifest = replaceCaseBlock(manifest, "reserve_cases", reserves);

  const tenetCount = cohort.filter((item) => item.repo === "vedprakash-m/tenet-copilot").length;
  const agentCount = cohort.filter((item) => item.group === "webchat-agent").length;
  const humanCount = cohort.filter((item) => item.repo === "microsoft/BotFramework-WebChat" && item.group === "webchat-human").length;
  manifest = replaceGroupCount(manifest, "tenet-copilot", tenetCount);
  manifest = replaceGroupCount(manifest, "webchat-agent", agentCount);
  manifest = replaceGroupCount(manifest, "webchat-human", humanCount);

  await writeFile(cohortYamlPath, `${manifest.trimEnd()}\n`, "utf8");

  const cohortRecords = [];
  for (const item of cohort) {
    const record = JSON.parse(await readFile(path.join(prsDir, fileName(item.repo, item.number)), "utf8"));
    cohortRecords.push(record);
  }

  const dataSheetHeader = [
    "Cohort ID",
    "Repository, PR and revision",
    "Decision instant, policy and frozen inputs",
    "Rule and disposition",
    "Adjudicator, warranted/false/unassessable, reason",
    "Active timing segments and timer",
    "Active minutes (0 or unknown explicit)",
    "Missing evidence",
  ];
  const rows = cohortRecords.map((record) => [
    "tenet-backtest-2026-11-23",
    `${record.repo}#${record.number}@${record.merge_sha}`,
    "", "", "", "", "", "",
  ]);
  const csv = [dataSheetHeader, ...rows].map((row) => row.map(csvEscape).join(",")).join("\r\n") + "\r\n";
  await writeFile(path.join(__dirname, "data-sheet.csv"), csv, "utf8");

  let totalSize = 0;
  for (const name of await readdir(diffsDir)) {
    if (name.endsWith(".diff.gz")) totalSize += (await stat(path.join(diffsDir, name))).size;
  }
  if (totalSize >= 25 * 1024 * 1024) {
    throw new Error(`diff directory size=${totalSize} bytes; expected less than 25 MB`);
  }

  console.log(`cohort_cases=${cohort.length}`);
  console.log(`reserve_cases=${reserves.length}`);
  console.log(`tenet-copilot=${tenetCount}`);
  console.log(`webchat-agent=${agentCount}`);
  console.log(`webchat-human=${humanCount}`);
  console.log(`diff_total_bytes=${totalSize}`);
  console.log(`unresolved_cohort_cases=${unresolvedCohort.length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
