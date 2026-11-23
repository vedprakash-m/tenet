import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prsDir = path.join(__dirname, "prs");
const seed = "tenet-backtest-2026-11-23";
const webchatLimit = 120;
const webchatWindowStart = "2025-01-01";
const webchatWindowEnd = "2026-10-31";

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
      const rateLimited = text.includes("rate limit") || text.includes("secondary rate") || text.includes("403") || text.includes("429");
      if (!rateLimited || attempt === delays.length) break;
      await sleep(delays[attempt]);
    }
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

function isCopilotAuthor(pr) {
  const login = (pr.user?.login || "").toLowerCase();
  const headRef = (pr.head?.ref || "").toLowerCase();
  return login.includes("copilot") || headRef.includes("copilot");
}

async function listPulls(owner, repo) {
  return ghApiPages(`repos/${owner}/${repo}/pulls?state=all&per_page=100&sort=created&direction=asc`);
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
        copilot_coding_agent: isCopilotAuthor(pr),
      },
      created_at: pr.created_at,
      merged_at: pr.merged_at,
      base: pr.base?.ref || null,
      head: pr.head?.ref || null,
      base_sha: pr.base?.sha || null,
      head_sha: headSha,
      merge_sha: pr.merge_commit_sha,
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
      reason: "data_unretrievable",
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
    "sources:",
    "  - repo: vedprakash-m/tenet-copilot",
    "    window: all_history",
    "    mode: every_merged_pull_request",
    "  - repo: microsoft/BotFramework-WebChat",
    `    window: ${webchatWindowStart}_through_${webchatWindowEnd}`,
    "    mode: merged_into_default_branch",
    "  - repo: Torus",
    '    status: "pending: location to be confirmed by the Owner"',
    "windows:",
    `  tenet-copilot: all history through ${cohort.generated_at}`,
    `  BotFramework-WebChat: ${webchatWindowStart} to ${webchatWindowEnd}, inclusive`,
    "eligibility:",
    "  - merged",
    "  - at least one changed file",
    "  - data still retrievable",
    `seed: ${yamlString(seed)}`,
    "ranking:",
    '  algorithm: sha256("tenet-backtest-2026-11-23:" + number)',
    "  direction: ascending",
    "  webchat_limit: 120",
    "  ci_and_contents_not_used: true",
    "per_source_counts:",
  ];

  for (const [source, counts] of Object.entries(cohort.perSource)) {
    lines.push(`  ${source}:`);
    lines.push(`    eligible: ${counts.eligible}`);
    lines.push(`    excluded: ${counts.excluded}`);
    lines.push(`    ranked_candidates: ${counts.ranked_candidates}`);
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
  lines.push("ranked_candidate_list:");
  for (const candidate of cohort.rankedCandidates) {
    lines.push(`  - repo: ${candidate.repo}`);
    lines.push(`    number: ${candidate.number}`);
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
      "base", "head", "base_sha", "head_sha", "merge_sha", "labels",
      "draft_history", "commits", "files", "reviews", "check_runs",
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
      base_sha: { type: ["string", "null"] },
      head_sha: { type: "string" },
      merge_sha: { type: "string" },
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
    },
  };
  await writeFile(path.join(__dirname, "schema.json"), `${JSON.stringify(schema, null, 2)}\n`, "utf8");
}

async function verify() {
  const schema = JSON.parse(await readFile(path.join(__dirname, "schema.json"), "utf8"));
  const required = schema.required;
  const names = (await readdir(prsDir)).filter((name) => name.endsWith(".json")).sort();
  const counts = {};

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

  for (const name of names) {
    const record = JSON.parse(await readFile(path.join(prsDir, name), "utf8"));
    requireShape(record, schema, name);
    for (const [key, spec] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        if (spec.type) checkType(record[key], spec.type, `${name}.${key}`);
        if (spec.enum) checkType(record[key], spec, `${name}.${key}`);
      }
    }
    counts[record.repo] = (counts[record.repo] || 0) + 1;
  }

  console.log(`verified_files=${names.length}`);
  for (const [repo, count] of Object.entries(counts).sort()) {
    console.log(`source=${repo} count=${count}`);
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

  await writeSchema();
  const ghVersionOutput = await gh(["--version"]);
  const ghVersion = ghVersionOutput.split(/\r?\n/, 1)[0].replace(/^gh\s+/, "");
  const generatedAt = new Date().toISOString();
  const exclusions = [];
  const perSource = {
    "vedprakash-m/tenet-copilot": { eligible: 0, excluded: 0, ranked_candidates: 0 },
    "microsoft/BotFramework-WebChat": { eligible: 0, excluded: 0, ranked_candidates: 0 },
  };

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
      perSource["vedprakash-m/tenet-copilot"].ranked_candidates += 1;
    } else {
      exclusions.push({ repo: "vedprakash-m/tenet-copilot", number: summary.number, reason: result.reason, detail: result.detail });
      perSource["vedprakash-m/tenet-copilot"].excluded += 1;
    }
  }

  const webchatPulls = await listPulls("microsoft", "BotFramework-WebChat");
  const webchatCandidates = [];
  for (const summary of webchatPulls) {
    if (!summary.merged_at || summary.base?.ref !== "main" || !inWebChatWindow(summary.merged_at)) continue;
    const result = await collectOne("microsoft", "BotFramework-WebChat", summary);
    if (result.kind === "eligible") {
      webchatCandidates.push({ record: result.record, number: summary.number, repo: "microsoft/BotFramework-WebChat" });
      perSource["microsoft/BotFramework-WebChat"].eligible += 1;
    } else {
      exclusions.push({ repo: "microsoft/BotFramework-WebChat", number: summary.number, reason: result.reason, detail: result.detail });
      perSource["microsoft/BotFramework-WebChat"].excluded += 1;
    }
  }

  webchatCandidates.sort((a, b) => {
    const hashA = rankNumber(a.number);
    const hashB = rankNumber(b.number);
    const hashOrder = hashA.localeCompare(hashB);
    return hashOrder || a.number - b.number;
  });
  const rankedCandidates = webchatCandidates.slice(0, webchatLimit).map((candidate) => ({
    repo: candidate.repo,
    number: candidate.number,
    hash: rankNumber(candidate.number),
  }));
  perSource["microsoft/BotFramework-WebChat"].ranked_candidates = rankedCandidates.length;

  for (const candidate of webchatCandidates.slice(webchatLimit)) {
    await unlink(
      path.join(prsDir, `microsoft__BotFramework-WebChat__${candidate.number}.json`),
    ).catch(() => {});
  }

  await writeCohort({
    generated_at: generatedAt,
    ghVersion,
    perSource,
    exclusions,
    rankedCandidates,
  });

  await verify();
  console.log(`generated_at=${generatedAt}`);
  console.log(`ranked_webchat_candidates=${rankedCandidates.length}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
