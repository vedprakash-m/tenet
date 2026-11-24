import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, unlink, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prsDir = path.join(__dirname, "prs");
const seed = "tenet-backtest-2026-11-23";
const cohortLimit = 100;
const reserveLimit = 20;
const webchatWindowStart = "2025-01-01";
const webchatWindowEnd = "2026-11-22";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function gh(args) {
  const delays = [1000, 2000, 4000, 8000, 16000];
  let lastError;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await new Promise((resolve, reject) => {
        execFile("gh", args, { encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
          if (error) {
            error.stderr = stderr;
            error.stdout = stdout;
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
    } catch (error) {
      lastError = error;
      const text = `${error.stderr || ""}\n${error.stdout || ""}\n${error.message || ""}`.toLowerCase();
      const transient =
        /\bhttp\s*5\d\d\b/.test(text) ||
        /\b5\d\d\b/.test(text) ||
        text.includes("server error") ||
        text.includes("rate limit") ||
        text.includes("secondary rate") ||
        text.includes("429");
      if (!transient || attempt === delays.length) break;
      await sleep(delays[attempt]);
    }
  }

  if (lastError) {
    const text = `${lastError.stderr || ""}\n${lastError.stdout || ""}\n${lastError.message || ""}`.toLowerCase();
    const transient =
      /\bhttp\s*5\d\d\b/.test(text) ||
      /\b5\d\d\b/.test(text) ||
      text.includes("server error") ||
      text.includes("rate limit") ||
      text.includes("secondary rate") ||
      text.includes("429");
    if (transient) lastError.transientAfterRetries = true;
  }

  throw lastError;
}

async function ghJson(args) {
  const stdout = await gh(args);
  return JSON.parse(stdout);
}

async function ghApiPages(endpoint) {
  const value = await ghJson([
    "api",
    endpoint,
    "--paginate",
    "--slurp",
    "-H",
    "Accept: application/vnd.github+json",
  ]);
  if (!Array.isArray(value)) return [value];
  return value.flatMap((page) => (Array.isArray(page) ? page : [page]));
}

function rankNumber(number) {
  return createHash("sha256").update(`${seed}:${number}`, "utf8").digest("hex");
}

function inWebChatWindow(mergedAt) {
  if (!mergedAt) return false;
  const date = mergedAt.slice(0, 10);
  return date >= webchatWindowStart && date <= webchatWindowEnd;
}

function firstLine(message) {
  if (typeof message !== "string") return "";
  return message.split(/\r?\n/, 1)[0];
}

function isCopilotCodingAgent(pr) {
  return pr.user?.login === "Copilot" && pr.user?.type === "Bot";
}

async function listPulls(owner, repo) {
  return ghApiPages(`repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=created&direction=asc`);
}

async function listCopilotAgentPulls() {
  return ghJson([
    "search",
    "prs",
    "--repo",
    "microsoft/BotFramework-WebChat",
    "--author",
    "app/copilot-swe-agent",
    "--merged",
    "--limit",
    "100",
    "--json",
    "number,author",
  ]);
}

async function collectOne(owner, repo, summary) {
  const number = summary.number;
  try {
    const pr = await ghJson([
      "api",
      `repos/${owner}/${repo}/pulls/${number}`,
      "-H",
      "Accept: application/vnd.github+json",
    ]);
    if (!pr.merged || !pr.merge_commit_sha) {
      return { kind: "excluded", reason: "not_merged" };
    }

    const [commits, files, reviews, timeline] = await Promise.all([
      ghApiPages(`repos/${owner}/${repo}/pulls/${number}/commits?per_page=100`),
      ghApiPages(`repos/${owner}/${repo}/pulls/${number}/files?per_page=100`),
      ghApiPages(`repos/${owner}/${repo}/pulls/${number}/reviews?per_page=100`).catch(() => []),
      ghApiPages(`repos/${owner}/${repo}/issues/${number}/timeline?per_page=100`).catch(() => []),
    ]);

    if (!Array.isArray(files) || files.length === 0) {
      return { kind: "excluded", reason: "no_changed_files" };
    }

    const headSha = pr.head?.sha || "";
    let checkRuns = [];
    if (headSha) {
      try {
        const value = await ghApiPages(`repos/${owner}/${repo}/commits/${headSha}/check-runs?per_page=100`);
        checkRuns = value.flatMap((entry) => (Array.isArray(entry.check_runs) ? entry.check_runs : []));
      } catch {
        checkRuns = [];
      }
    }

    const draftHistory = timeline
      .filter((event) => ["converted_to_draft", "ready_for_review"].includes(event.event))
      .map((event) => ({
        event: event.event,
        at: event.created_at || event.submitted_at || null,
      }))
      .sort((a, b) => String(a.at || "").localeCompare(String(b.at || "")));

    const record = {
      repo: `${owner}/${repo}`,
      number,
      title: pr.title,
      body: pr.body,
      author: {
        login: pr.user?.login || null,
        type: pr.user?.type === "Bot" ? "Bot" : "User",
        copilot_coding_agent: isCopilotCodingAgent(pr),
      },
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      base_ref: pr.base?.ref || null,
      base: pr.base?.ref || null,
      head_ref: pr.head?.ref || null,
      head: pr.head?.ref || null,
      base_sha: pr.base?.sha || null,
      head_sha: headSha,
      merge_sha: pr.merge_commit_sha,
      diff_sha256: null,
      shas_resolved: null,
      applies_at_base: null,
      binary_paths: [],
      labels: (pr.labels || []).map((label) => typeof label === "string" ? label : label.name).filter(Boolean),
      draft_history: draftHistory,
      commits: commits.map((commit) => ({
        sha: commit.sha,
        message: firstLine(commit.commit?.message),
        author: commit.author?.login || commit.commit?.author?.name || null,
      })),
      files: files.map((file) => ({
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        previous_path: file.previous_filename || null,
      })),
      reviews: reviews
        .filter((review) => review.state && review.submitted_at)
        .map((review) => ({
          state: review.state,
          author: review.user?.login || null,
          submitted_at: review.submitted_at,
        })),
      check_runs: checkRuns.map((run) => ({
        name: run.name,
        conclusion: run.conclusion,
        completed_at: run.completed_at,
      })),
    };

    await writeFile(
      path.join(prsDir, `${owner}__${repo}__${number}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
      "utf8",
    );
    return { kind: "eligible", record };
  } catch (error) {
    return {
      kind: "excluded",
      reason: error.transientAfterRetries ? "transient_error_after_retries" : "data_unretrievable",
      detail: error.message || String(error),
    };
  }
}

function yamlString(value) {
  return JSON.stringify(value);
}

async function writeCohort(cohort) {
  const lines = [
    "cohort_id: tenet-backtest-2026-11-23",
    "frozen: 2026-11-23",
    "sources:",
    "  - repo: vedprakash-m/tenet-copilot",
    "    window: all_history",
    "    mode: every_merged_pull_request",
    "  - repo: microsoft/BotFramework-WebChat",
    `    window: ${webchatWindowStart}_through_${webchatWindowEnd}`,
    "    mode: merged_into_default_branch",
    "  - repo: Torus",
    "    cases: 0",
    '    reason: "no git history yet; first adopter after alpha.0 (L-0035)"',
    'agent_group_rule: "Bot author login Copilot merged through refs/pulls/*/head into any base branch in the 2025-01-01 through 2026-11-22 window"',
    "windows:",
    `  tenet-copilot: all history through ${cohort.generated_at}`,
    `  BotFramework-WebChat: ${webchatWindowStart} through ${webchatWindowEnd}, inclusive`,
    "eligibility:",
    "  - merged",
    "  - at least one changed file",
    "  - data still retrievable",
    `seed: ${yamlString(seed)}`,
    "ranking:",
    '  algorithm: sha256("tenet-backtest-2026-11-23:" + number)',
    "  direction: ascending",
    "  ci_and_contents_not_used: true",
    "groups:",
    "  tenet-copilot:",
    `    eligible: ${cohort.groups["tenet-copilot"].eligible}`,
    `    cohort: ${cohort.groups["tenet-copilot"].cohort}`,
    "    numbers:",
  ];

  for (const number of cohort.groups["tenet-copilot"].numbers) lines.push(`      - ${number}`);
  lines.push("  webchat-agent:");
  lines.push(`    eligible: ${cohort.groups["webchat-agent"].eligible}`);
  lines.push(`    cohort: ${cohort.groups["webchat-agent"].cohort}`);
  lines.push("    numbers:");
  for (const number of cohort.groups["webchat-agent"].numbers) lines.push(`      - ${number}`);
  lines.push("  webchat-human:");
  lines.push(`    eligible: ${cohort.groups["webchat-human"].eligible}`);
  lines.push(`    cohort: ${cohort.groups["webchat-human"].cohort}`);
  lines.push(`    reserve: ${cohort.groups["webchat-human"].reserve}`);
  lines.push("    cohort_numbers:");
  for (const number of cohort.groups["webchat-human"].cohort_numbers) lines.push(`      - ${number}`);
  lines.push("  reserves:");
  lines.push("    numbers:");
  for (const number of cohort.reserveNumbers) lines.push(`      - ${number}`);
  lines.push("per_source_counts:");
  for (const [source, counts] of Object.entries(cohort.perSource)) {
    lines.push(`  ${source}:`);
    lines.push(`    eligible: ${counts.eligible}`);
    lines.push(`    excluded: ${counts.excluded}`);
  }

  lines.push("exclusions:");
  for (const exclusion of cohort.exclusions) {
    lines.push(`  - repo: ${exclusion.repo}`);
    lines.push(`    number: ${exclusion.number}`);
    lines.push(`    reason: ${exclusion.reason}`);
    if (exclusion.detail) lines.push(`    detail: ${yamlString(exclusion.detail)}`);
  }
  lines.push(`generated_at: ${cohort.generated_at}`);
  lines.push(`gh_version: ${yamlString(cohort.ghVersion)}`);
  lines.push("cohort_cases:");
  for (const candidate of cohort.cohortCases) {
    lines.push(`  - repo: ${candidate.repo}`);
    lines.push(`    number: ${candidate.number}`);
    lines.push(`    group: ${candidate.group}`);
  }
  lines.push("reserve_cases:");
  for (const candidate of cohort.reserveCases) {
    lines.push(`  - repo: ${candidate.repo}`);
    lines.push(`    number: ${candidate.number}`);
    lines.push(`    group: webchat-human`);
    lines.push(`    hash: ${candidate.hash}`);
  }

  await writeFile(path.join(__dirname, "cohort.yaml"), `${lines.join("\n")}\n`, "utf8");
}

async function writeSchema() {
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Tenet backtest pull request record",
    type: "object",
    required: [
      "repo", "number", "title", "body", "author", "created_at", "merged_at",
      "base", "head", "base_ref", "head_ref", "base_sha", "head_sha", "merge_sha", "labels",
      "draft_history", "commits", "files", "reviews", "check_runs",
      "diff_sha256", "shas_resolved", "applies_at_base", "binary_paths",
    ],
    properties: {
      repo: { type: "string" },
      number: { type: "integer" },
      title: { type: ["string", "null"] },
      body: { type: ["string", "null"] },
      author: {
        type: "object",
        required: ["login", "type", "copilot_coding_agent"],
        properties: {
          login: { type: ["string", "null"] },
          type: { enum: ["User", "Bot"] },
          copilot_coding_agent: { type: "boolean" },
        },
      },
      created_at: { type: ["string", "null"] },
      merged_at: { type: ["string", "null"] },
      base: { type: ["string", "null"] },
      head: { type: ["string", "null"] },
      base_ref: { type: ["string", "null"] },
      head_ref: { type: ["string", "null"] },
      base_sha: { type: ["string", "null"] },
      head_sha: { type: "string" },
      merge_sha: { type: "string" },
      diff_sha256: { type: ["string", "null"] },
      shas_resolved: { type: ["boolean", "null"] },
      applies_at_base: { type: ["boolean", "null"] },
      labels: { type: "array", items: { type: "string" } },
      draft_history: {
        type: "array",
        items: {
          type: "object",
          required: ["event", "at"],
          properties: {
            event: { enum: ["converted_to_draft", "ready_for_review"] },
            at: { type: ["string", "null"] },
          },
        },
      },
      commits: {
        type: "array",
        items: {
          type: "object",
          required: ["sha", "message", "author"],
          properties: {
            sha: { type: "string" },
            message: { type: "string" },
            author: { type: ["string", "null"] },
          },
        },
      },
      files: {
        type: "array",
        items: {
          type: "object",
          required: ["path", "status", "additions", "deletions", "previous_path"],
          properties: {
            path: { type: "string" },
            status: { type: "string" },
            additions: { type: "integer" },
            deletions: { type: "integer" },
            previous_path: { type: ["string", "null"] },
          },
        },
      },
      reviews: {
        type: "array",
        items: {
          type: "object",
          required: ["state", "author", "submitted_at"],
          properties: {
            state: { type: "string" },
            author: { type: ["string", "null"] },
            submitted_at: { type: "string" },
          },
        },
      },
      check_runs: {
        type: "array",
        items: {
          type: "object",
          required: ["name", "conclusion", "completed_at"],
          properties: {
            name: { type: "string" },
            conclusion: { type: ["string", "null"] },
            completed_at: { type: ["string", "null"] },
          },
        },
      },
      binary_paths: { type: "array", items: { type: "string" } },
    },
  };
  await writeFile(path.join(__dirname, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

async function verify() {
  const schema = JSON.parse(await readFile(path.join(__dirname, "schema.json"), "utf8"));
  const names = (await readdir(prsDir)).filter((name) => name.endsWith(".json")).sort();
  const manifest = await readFile(path.join(__dirname, "cohort.yaml"), "utf8");
  const scratch = "Q:\\Ved\\Pers\\backtest-clones";

  function gitIn(dir, args) {
    return new Promise((resolve, reject) => {
      execFile("git", args, { cwd: dir, encoding: "buffer", windowsHide: true, maxBuffer: 128 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error) reject(Object.assign(error, { stderr: stderr.toString("utf8") }));
        else resolve(stdout);
      });
    });
  }

  function requireShape(record, properties, prefix) {
    for (const key of properties.required || []) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) {
        throw new Error(`${prefix}: missing required property ${key}`);
      }
    }
  }

  function checkType(value, spec, prefix) {
    if (!spec) return;
    if (Array.isArray(spec)) {
      if (value === null) {
        if (!spec.includes("null")) throw new Error(`${prefix}: null is not allowed`);
        return;
      }
      const acceptable = spec.filter((type) => type !== "null");
      if (!acceptable.some((type) => checkType(value, type, prefix))) throw new Error(`${prefix}: wrong type`);
      return true;
    }
    if (spec === "string") return typeof value === "string";
    if (spec === "integer") return Number.isInteger(value);
    if (spec === "boolean") return typeof value === "boolean";
    if (spec === "array") return Array.isArray(value);
    if (spec === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
    if (spec.enum) return spec.enum.includes(value);
    return true;
  }

  function parseCaseBlock(label) {
    const lines = manifest.split(/\r?\n/);
    const start = lines.findIndex((line) => line === `${label}:`);
    if (start < 0) throw new Error(`cohort.yaml missing ${label}`);
    const block = [];
    for (let index = start + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (line && !line.startsWith(" ")) break;
      block.push(line);
    }
    const text = block.join("\n");
    const cases = [];
    for (const match of text.matchAll(/  - repo: ([^\n]+)\n    number: (\d+)/g)) {
      cases.push({ repo: match[1], number: Number(match[2]) });
    }
    return cases;
  }

  for (const name of names) {
    const record = JSON.parse(await readFile(path.join(prsDir, name), "utf8"));
    requireShape(record, schema, name);
    for (const [key, spec] of Object.entries(schema.properties)) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
      if (spec.type) checkType(record[key], spec.type, `${name}.${key}`);
      if (spec.enum) checkType(record[key], spec, `${name}.${key}`);
      if (spec.type === "object" && spec.properties) requireShape(record[key], spec, `${name}.${key}`);
      if (spec.type === "array" && spec.items?.type === "object") {
        for (let index = 0; index < record[key].length; index += 1) {
          requireShape(record[key][index], spec.items, `${name}.${key}[${index}]`);
          for (const [childKey, childSpec] of Object.entries(spec.items.properties || {})) {
            if (!Object.prototype.hasOwnProperty.call(record[key][index], childKey)) continue;
            if (childSpec.type) checkType(record[key][index][childKey], childSpec.type, `${name}.${key}[${index}].${childKey}`);
            if (childSpec.enum) checkType(record[key][index][childKey], childSpec, `${name}.${key}[${index}].${childKey}`);
          }
        }
      }
    }
  }

  const cohortCases = parseCaseBlock("cohort_cases");
  const reserveCases = parseCaseBlock("reserve_cases");
  if (cohortCases.length !== 100) throw new Error(`cohort_cases=${cohortCases.length}; expected 100`);
  if (reserveCases.length !== 20) throw new Error(`reserve_cases=${reserveCases.length}; expected 20`);

  const diffsDir = path.join(__dirname, "diffs");
  await mkdir(diffsDir, { recursive: true });
  let diffTotalSize = 0;

  function fileName(repo, number) {
    const [owner, name] = repo.split("/", 2);
    return `${owner}__${name}__${number}.json`;
  }

  const expectedNames = new Set([
    ...cohortCases.map((item) => fileName(item.repo, item.number)),
    ...reserveCases.map((item) => fileName(item.repo, item.number)),
  ]);
  if (names.length !== expectedNames.size) throw new Error(`prs file count=${names.length}; expected ${expectedNames.size}`);
  for (const name of names) {
    if (!expectedNames.has(name)) throw new Error(`unexpected prs file: ${name}`);
  }
  for (const name of expectedNames) {
    if (!names.includes(name)) throw new Error(`missing prs file: ${name}`);
  }

  for (const item of [...cohortCases, ...reserveCases]) {
    const [owner, name] = item.repo.split("/", 2);
    const prName = `${owner}__${name}__${item.number}.json`;
    const record = JSON.parse(await readFile(path.join(prsDir, prName), "utf8"));
    if (typeof record.diff_sha256 !== "string") throw new Error(`${prName}: missing diff_sha256`);
    if (typeof record.shas_resolved !== "boolean") throw new Error(`${prName}: missing shas_resolved`);
    for (const shaName of ["base_sha", "head_sha", "merge_sha"]) {
      if (!/^[0-9a-f]{40}$/i.test(record[shaName] || "")) {
        throw new Error(`${prName}: ${shaName} is not 40 hexadecimal characters`);
      }
    }
    if (!record.shas_resolved) throw new Error(`${prName}: shas_resolved=false`);
    if (typeof record.applies_at_base !== "boolean") throw new Error(`${prName}: missing applies_at_base`);
    const diffName = `${owner}__${name}__${item.number}.diff.gz`;
    let gz;
    try {
      gz = await readFile(path.join(diffsDir, diffName));
    } catch {
      throw new Error(`missing diff: ${diffName}`);
    }
    let diff;
    try {
      diff = gunzipSync(gz);
    } catch {
      throw new Error(`invalid gzip diff: ${diffName}`);
    }
    const hash = createHash("sha256").update(diff).digest("hex");
    if (hash !== record.diff_sha256) throw new Error(`diff sha mismatch: ${diffName}`);

    const cloneDir = record.repo === "vedprakash-m/tenet-copilot"
      ? path.join(scratch, "tenet-copilot")
      : path.join(scratch, "BotFramework-WebChat");
    for (const shaName of ["base_sha", "head_sha", "merge_sha"]) {
      try {
        await gitIn(cloneDir, ["cat-file", "-e", `${record[shaName]}^{commit}`]);
      } catch {
        throw new Error(`${prName}: ${shaName} is not resolvable locally`);
      }
    }
    let binaryPaths = [];
    try {
      const numstat = await gitIn(cloneDir, ["diff", "--numstat", `${record.base_sha}...${record.head_sha}`]);
      binaryPaths = numstat.toString("utf8").split(/\r?\n/).filter((line) => line.startsWith("-\t-\t")).map((line) => line.split("\t").slice(2).join("\t"));
    } catch {
      throw new Error(`${prName}: unable to read numstat`);
    }
    if (JSON.stringify(binaryPaths) !== JSON.stringify(record.binary_paths || [])) {
      throw new Error(`${prName}: binary_paths mismatch`);
    }

    const tempDir = await mkdtemp(path.join(scratch, "verify-apply-"));
    const tempDiff = path.join(tempDir, "case.diff");
    let appliesAtBase = false;
    let applyError = "";
    try {
      await gitIn(cloneDir, ["worktree", "add", "--detach", "--force", tempDir, record.base_sha]);
      await gitIn(tempDir, ["config", "core.autocrlf", "false"]);
      await writeFile(tempDiff, diff);
      try {
        const applyArgs = ["apply", "--check", "--unidiff-zero", ...((record.binary_paths || []).map((file) => `--exclude=${file}`)), tempDiff];
        await gitIn(tempDir, applyArgs);
        appliesAtBase = true;
      } catch (error) {
        appliesAtBase = false;
        applyError = String(error?.stderr || "").split(/\r?\n/).find((line) => line.trim()) || "";
      }
    } finally {
      await gitIn(cloneDir, ["worktree", "remove", "--force", tempDir]).catch(() => {});
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
    record.applies_at_base = appliesAtBase;
    await writeFile(path.join(prsDir, prName), `${JSON.stringify(record, null, 2)}\n`, "utf8");
    if (!appliesAtBase) console.log(`diff_apply=false repo=${record.repo} number=${record.number} first_error=${applyError}`);
    diffTotalSize += gz.length;
  }
  if (diffTotalSize >= 25 * 1024 * 1024) {
    throw new Error(`diff directory size=${diffTotalSize} bytes; expected less than 25 MB`);
  }

  const dataSheet = await readFile(path.join(__dirname, "data-sheet.csv"), "utf8");
  const dataSheetRows = dataSheet.split(/\r?\n/).filter((line) => line.length > 0);
  if (dataSheetRows.length !== 101) {
    throw new Error(`data-sheet rows=${Math.max(0, dataSheetRows.length - 1)}; expected 100`);
  }

  const sourceCounts = {};
  const groupCounts = {};
  let agentCohortCount = 0;
  for (const name of names) {
    const record = JSON.parse(await readFile(path.join(prsDir, name), "utf8"));
    sourceCounts[record.repo] = (sourceCounts[record.repo] || 0) + 1;
  }

  const cohortText = manifest;
  const lines = cohortText.split(/\r?\n/);
  const tenetStart = lines.findIndex((line) => line === "  tenet-copilot:");
  const agentStart = lines.findIndex((line) => line === "  webchat-agent:");
  const humanStart = lines.findIndex((line) => line === "  webchat-human:");
  if (tenetStart < 0 || agentStart < 0 || humanStart < 0) throw new Error("cohort.yaml missing group counts");

  for (const name of cohortCases.map((item) => fileName(item.repo, item.number))) {
    if (name.includes("__tenet-copilot__")) groupCounts["tenet-copilot"] = (groupCounts["tenet-copilot"] || 0) + 1;
    if (!name.startsWith("microsoft__")) continue;
    const record = JSON.parse(await readFile(path.join(prsDir, name), "utf8"));
    if (record.author.copilot_coding_agent) agentCohortCount += 1;
  }
  for (const name of names) {
    if (!name.startsWith("microsoft__BotFramework-WebChat__")) continue;
    if (cohortCases.some((item) => fileName(item.repo, item.number) === name)) {
      const record = JSON.parse(await readFile(path.join(prsDir, name), "utf8"));
      const group = record.author.copilot_coding_agent ? "webchat-agent" : "webchat-human";
      groupCounts[group] = (groupCounts[group] || 0) + 1;
    }
  }
  groupCounts["reserves"] = reserveCases.length;
  if (agentCohortCount !== 16) throw new Error(`webchat-agent cohort=${agentCohortCount}; expected 16`);
  console.log(`diff_total_bytes=${diffTotalSize}`);

  console.log(`verified_files=${names.length}`);
  console.log("cohort_cases=100");
  console.log(`reserve_cases=${reserveCases.length}`);
  for (const [repo, count] of Object.entries(sourceCounts).sort()) console.log(`source=${repo} count=${count}`);
  for (const group of ["tenet-copilot", "webchat-agent", "webchat-human", "reserves"]) {
    console.log(`group=${group} count=${groupCounts[group] || 0}`);
  }
  return names.length;
}

async function main() {
  await mkdir(prsDir, { recursive: true });

  if (process.argv.includes("--verify")) {
    await writeSchema();
    await verify();
    return;
  }

  for (const name of await readdir(prsDir)) {
    if (name.endsWith(".json")) await unlink(path.join(prsDir, name)).catch(() => {});
  }

  await writeSchema();
  const ghVersionOutput = await gh(["--version"]);
  const ghVersion = ghVersionOutput.split(/\r?\n/, 1)[0].replace(/^gh\s+/, "");
  const generatedAt = new Date().toISOString();
  const exclusions = [];
  const perSource = {
    "vedprakash-m/tenet-copilot": { eligible: 0, excluded: 0 },
    "microsoft/BotFramework-WebChat": { eligible: 0, excluded: 0 },
  };

  const copilotCases = [];
  const copilotPulls = await listPulls("vedprakash-m", "tenet-copilot");
  for (const summary of copilotPulls) {
    if (!summary.merged_at) {
      exclusions.push({ repo: "vedprakash-m/tenet-copilot", number: summary.number, reason: "not_merged" });
      perSource["vedprakash-m/tenet-copilot"].excluded += 1;
      continue;
    }
    const result = await collectOne("vedprakash-m", "tenet-copilot", summary);
    if (result.kind === "eligible") {
      perSource["vedprakash-m/tenet-copilot"].eligible += 1;
      copilotCases.push({ repo: "vedprakash-m/tenet-copilot", number: summary.number, group: "tenet-copilot" });
    } else {
      exclusions.push({ repo: "vedprakash-m/tenet-copilot", number: summary.number, reason: result.reason, detail: result.detail });
      perSource["vedprakash-m/tenet-copilot"].excluded += 1;
    }
  }

  const agentCases = [];
  const humanCases = [];
  const agentSearch = await listCopilotAgentPulls();
  for (const summary of agentSearch) {
    if (summary.author?.login !== "Copilot" || summary.author?.type !== "Bot") continue;
    const result = await collectOne("microsoft", "BotFramework-WebChat", summary);
    if (result.kind === "eligible" && inWebChatWindow(result.record.merged_at)) {
      perSource["microsoft/BotFramework-WebChat"].eligible += 1;
      agentCases.push({ repo: "microsoft/BotFramework-WebChat", number: summary.number, group: "webchat-agent" });
    } else if (result.kind === "excluded") {
      exclusions.push({ repo: "microsoft/BotFramework-WebChat", number: summary.number, reason: result.reason, detail: result.detail });
      perSource["microsoft/BotFramework-WebChat"].excluded += 1;
    }
  }

  const agentNumbers = new Set(agentCases.map((item) => item.number));
  const webchatPulls = await listPulls("microsoft", "BotFramework-WebChat");
  for (const summary of webchatPulls) {
    if (!summary.merged_at || summary.base?.ref !== "main" || !inWebChatWindow(summary.merged_at)) continue;
    if (agentNumbers.has(summary.number)) continue;
    const result = await collectOne("microsoft", "BotFramework-WebChat", summary);
    if (result.kind === "eligible") {
      perSource["microsoft/BotFramework-WebChat"].eligible += 1;
      humanCases.push({ record: result.record, repo: "microsoft/BotFramework-WebChat", number: summary.number, group: "webchat-human" });
    } else {
      exclusions.push({ repo: "microsoft/BotFramework-WebChat", number: summary.number, reason: result.reason, detail: result.detail });
      perSource["microsoft/BotFramework-WebChat"].excluded += 1;
    }
  }

  humanCases.sort((a, b) => {
    const hashA = rankNumber(a.number);
    const hashB = rankNumber(b.number);
    const hashOrder = hashA.localeCompare(hashB);
    return hashOrder || a.number - b.number;
  });

  const fixedCases = [...copilotCases, ...agentCases];
  if (agentCases.length !== 16) throw new Error(`webchat-agent eligible=${agentCases.length}; expected 16`);
  const humanCohortCount = cohortLimit - fixedCases.length;
  if (humanCohortCount < 0) throw new Error(`fixed cohort cases=${fixedCases.length}; exceeds 100`);
  const humanCohort = humanCases.slice(0, humanCohortCount);
  const reserveCases = humanCases.slice(humanCohortCount, humanCohortCount + reserveLimit);
  if (fixedCases.length + humanCohort.length !== 100) {
    throw new Error(`eligible cases produce cohort size ${fixedCases.length + humanCohort.length}; expected 100`);
  }

  const cohortCases = [...fixedCases, ...humanCohort];
  const cohortNumbers = new Set(cohortCases.map((item) => `${item.repo}:${item.number}`));
  for (const candidate of humanCases) {
    const key = `${candidate.repo}:${candidate.number}`;
    if (!cohortNumbers.has(key) && !reserveCases.includes(candidate)) {
      await unlink(path.join(prsDir, `microsoft__BotFramework-WebChat__${candidate.number}.json`)).catch(() => {});
    }
  }

  const reserveManifestCases = reserveCases.map((candidate) => ({
    repo: candidate.repo,
    number: candidate.number,
    hash: rankNumber(candidate.number),
  }));

  await writeCohort({
    generated_at: generatedAt,
    ghVersion,
    perSource,
    exclusions,
    groups: {
      "tenet-copilot": { eligible: copilotCases.length, cohort: copilotCases.length, numbers: copilotCases.map((item) => item.number) },
      "webchat-agent": { eligible: agentCases.length, cohort: agentCases.length, numbers: agentCases.map((item) => item.number) },
      "webchat-human": {
        eligible: humanCases.length,
        cohort: humanCohort.length,
        reserve: reserveCases.length,
        cohort_numbers: humanCohort.map((item) => item.number),
      },
    },
    reserveNumbers: reserveCases.map((item) => item.number),
    cohortCases,
    reserveCases: reserveManifestCases,
  });

  console.log(`generated_at=${generatedAt}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
