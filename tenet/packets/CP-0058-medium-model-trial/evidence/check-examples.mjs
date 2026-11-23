#!/usr/bin/env node
/**
 * Validate all YAML blocks, cards, acceptance blocks, test tags, spec lines,
 * CLI commands, and shipped kit templates/defaults across README.md, ux-spec.md,
 * tech-spec parts, and kit/. Intended to become `npm run check:examples` in CP-0003.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const repoRoot = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "../../../..");

const require = createRequire(import.meta.url);
let YAML;
for (const base of [path.join(repoRoot, "package.json"), import.meta.url, path.resolve(repoRoot, "../tenet-trial/package.json")]) {
  try {
    if (base.endsWith(".json") && !fs.existsSync(base)) continue;
    YAML = createRequire(base)("yaml");
    break;
  } catch {
    // try next resolver location
  }
}
if (!YAML) {
  console.error("Cannot resolve 'yaml' package. Install dependencies or run with yaml available.");
  process.exit(1);
}

const TARGET_FILES = [
  "README.md",
  "tenet/specs/ux-spec.md",
  "tenet/specs/tech-spec/contracts.md",
  "tenet/specs/tech-spec/algorithms.md",
  "tenet/specs/tech-spec/evidence.md",
  "tenet/specs/tech-spec/onboarding.md",
  "tenet/specs/tech-spec/ci.md",
  "tenet/specs/tech-spec/agents.md",
];

const KNOWN_COMMANDS = new Set([
  "init", "onboard", "bless", "context", "check", "fix", "split", "board",
  "upgrade", "remove", "doctor", "mcp", "level", "rules", "verify", "new",
  "move", "status", "task", "close", "resume", "decide", "resolve", "escalate",
  "lease", "release", "assign", "result", "inspect", "record", "agent", "skill",
  "build", "import", "conform",
]);

const KNOWN_REPLIES = new Set(["approve", "pick", "bless", "not-useful"]);

const errors = [];
const stats = { yaml: 0, cards: 0, acceptance: 0, tags: 0, commands: 0, specLines: 0, kitFiles: 0 };

function extractFences(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let fence = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/^\s{0,3}(`{3,}|~{3,})(.*)$/);
    if (m) {
      const marker = m[1];
      const rest = m[2].trim();
      if (!fence) {
        fence = { ch: marker[0], len: marker.length, lang: rest.split(/\s+/)[0] || "", startLine: i + 1, lines: [] };
        continue;
      } else if (marker[0] === fence.ch && marker.length >= fence.len && rest === "") {
        blocks.push({ ...fence, text: fence.lines.join("\n") });
        fence = null;
        continue;
      }
    }
    if (fence) fence.lines.push(line);
  }
  return blocks;
}

function slugifyHeading(title) {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

for (const rel of TARGET_FILES) {
  const full = path.join(repoRoot, rel);
  if (!fs.existsSync(full)) {
    errors.push(`${rel}:1 file missing`);
    continue;
  }
  const content = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
  const fences = extractFences(content);

  for (const b of fences) {
    if (b.lang === "yaml" || b.lang === "yml") {
      stats.yaml += 1;
      try {
        const parsed = YAML.parse(b.text);
        if (rel.endsWith("ci.md") && b.text.includes("runs-on:")) {
          if (!parsed?.on || !parsed?.jobs) {
            errors.push(`${rel}:${b.startLine} workflow YAML missing 'on' or 'jobs'`);
          }
        }
      } catch (err) {
        errors.push(`${rel}:${b.startLine} YAML parse failed: ${err.message}`);
      }
    }

    if (b.lang === "markdown" && /^### Tenet (onboarding|proof)\b/m.test(b.text)) {
      stats.cards += 1;
      const head = b.text.split("\n")[0];
      if (head.startsWith("### Tenet onboarding")) {
        if (!/drafted from [0-9a-f]+/i.test(head) || !/^Read:/m.test(b.text) || !/^Sections/m.test(b.text)) {
          errors.push(`${rel}:${b.startLine} onboarding card missing header/Read/Sections`);
        }
      } else {
        if (!/^### Tenet proof · [0-9a-f]+/m.test(head) || !/^Tests /m.test(b.text)) {
          errors.push(`${rel}:${b.startLine} proof card missing required structure`);
        }
      }
    }

    if ((b.lang === "markdown" || b.lang === "text") && /^#{2,3}\s+Acceptance\b/m.test(b.text)) {
      stats.acceptance += 1;
      const lines = b.text.split("\n");
      const accIdx = lines.findIndex((l) => /^#{2,3}\s+Acceptance(?:\s{2,}.*)?$/.test(l.trim()));
      const seenIds = new Set();
      for (let k = accIdx + 1; k < lines.length; k++) {
        const l = lines[k];
        if (/^#{2,3}\s/.test(l)) break;
        if (!l.trim()) continue;
        if (l.startsWith("Implements:")) {
          const rhs = l.slice("Implements:".length).replace(/\s{2,}.*$/, "").trim();
          for (const id of rhs.split(",").map((s) => s.trim()).filter(Boolean)) {
            if (!/^(?:\{prefix\}|(?!(?:AB|CF|Q|V)-)[A-Z][A-Z0-9]*)-\d+$/.test(id)) {
              errors.push(`${rel}:${b.startLine + k} invalid Implements ID "${id}"`);
            }
          }
          continue;
        }
        const m = l.match(/^\s*[-*]\s*(\[[ xX]\]\s*)?\[(AB-\d+)\]\s+(.+)$/);
        if (m) {
          const id = m[2];
          if (seenIds.has(id)) errors.push(`${rel}:${b.startLine + k} duplicate acceptance item ${id}`);
          seenIds.add(id);
        } else if (/^\s*[-*]\s+/.test(l)) {
          errors.push(`${rel}:${b.startLine + k} acceptance item missing [AB-n] prefix: ${l}`);
        }
      }
    }

    if (rel.endsWith("contracts.md") && b.lang === "text" && /^- R-\d+\s/.test(b.text)) {
      stats.specLines += 1;
      if (!/\{origin:\s*(observed|documented|asked|inferred)/.test(b.text)) {
        errors.push(`${rel}:${b.startLine} requirement example missing valid origin metadata`);
      }
    }
    if (rel.endsWith("contracts.md") && b.lang === "text" && /^- \[[ xX]\] CF-/.test(b.text)) {
      stats.specLines += 1;
      for (const l of b.text.split("\n")) {
        if (!/^- \[[ xX]\] (CF|Q)-\d+ \(section:\s*[a-z0-9-]+\)\s+.+$/.test(l)) {
          errors.push(`${rel}:${b.startLine} conflict/question example mismatch: ${l}`);
        }
      }
    }
  }

  // Test tag examples (inline code and fenced code lines)
  const tagMatches = content.matchAll(/`([^`\n]*(?:tenet_(?:AB|R|C|\{prefix\})_\d+|\[(?:AB|R|C)-\d+\])[^`\n]*)`|^([^\n`]*(?:tenet_(?:AB|R|C|\{prefix\})_\d+|\[(?:AB|R|C)-\d+\])[^\n`]*)$/gm);
  for (const m of tagMatches) {
    const snippet = (m[1] ?? m[2]).trim();
    if (snippet.includes("\\d") || snippet.includes("tenet_<") || snippet.includes("{prefix}")) continue;
    stats.tags += 1;
    const prefix = snippet.includes("C-") || snippet.includes("_C_") ? "C" : "R";
    const bracketRe = new RegExp(`\\[(AB-\\d+|${prefix}-\\d+)\\]`);
    const underRe = new RegExp(`(?:^|_)tenet_(AB|${prefix})_(\\d+)(?=$|[^A-Za-z0-9])`);
    if (!bracketRe.test(snippet) && !underRe.test(snippet)) {
      errors.push(`${rel} tag example did not match contracts §1 tag grammar: ${snippet}`);
    }
  }

  // CLI commands (backticked, prompt-prefixed, and YAML run: lines)
  const cmdMatches = content.matchAll(/(?:^\$ |`|\brun:\s*)(?:npx (?:-y )?@vedprakash-m\/tenet(?:@(?:<[^>]+>|[^\s`]+))? |npx tenet |tenet )([a-z][a-z-]*)/gm);
  for (const m of cmdMatches) {
    const sub = m[1];
    if (["command", "commands", "runner", "on", "profile", "yaml", "lock", "records", "specs"].includes(sub)) continue;
    stats.commands += 1;
    if (!KNOWN_COMMANDS.has(sub)) {
      errors.push(`${rel} unknown tenet command "${sub}" in "${m[0]}"`);
    }
  }

  const replyMatches = content.matchAll(/`\/tenet ([a-z-]+)/g);
  for (const m of replyMatches) {
    stats.commands += 1;
    if (!KNOWN_REPLIES.has(m[1])) {
      errors.push(`${rel} unknown PR reply "/tenet ${m[1]}"`);
    }
  }
}

// Validate kit YAML files, templates, and verbatim agents.md §1 sync when kit/ exists
const packFile = path.join(repoRoot, "kit/packs/minimal/pack.yaml");
const defaultFile = path.join(repoRoot, "kit/defaults/tenet.yaml");
for (const kf of [packFile, defaultFile]) {
  if (fs.existsSync(kf)) {
    stats.kitFiles += 1;
    try {
      YAML.parse(fs.readFileSync(kf, "utf8"));
    } catch (err) {
      errors.push(`${path.relative(repoRoot, kf)} YAML parse failed: ${err.message}`);
    }
  }
}

const tplDir = path.join(repoRoot, "kit/templates");
if (fs.existsSync(tplDir)) {
  for (const file of fs.readdirSync(tplDir)) {
    if (!file.endsWith(".md")) continue;
    const full = path.join(tplDir, file);
    const raw = fs.readFileSync(full, "utf8").replace(/\r\n/g, "\n");
    stats.kitFiles += 1;
    if (raw.startsWith("---\n")) {
      const end = raw.indexOf("\n---\n", 4);
      if (end === -1) {
        errors.push(`kit/templates/${file}: unclosed YAML front matter`);
      } else {
        try {
          const fm = YAML.parse(raw.slice(4, end));
          if (!fm?.tenet?.doc || !fm?.sections) {
            errors.push(`kit/templates/${file}: front matter missing tenet.doc or sections`);
          } else {
            const headings = new Set(
              raw
                .slice(end + 5)
                .split("\n")
                .filter((l) => l.startsWith("## "))
                .map((l) => slugifyHeading(l.slice(3))),
            );
            for (const slug of Object.keys(fm.sections)) {
              if (!headings.has(slug)) {
                errors.push(`kit/templates/${file}: front matter section "${slug}" missing matching ## heading`);
              }
            }
          }
          const body = raw.slice(end + 5);
          if (/^## Acceptance\b/m.test(body)) {
            stats.acceptance += 1;
            const accBlock = body.split(/^## Acceptance\b/m)[1].split(/\n##\s/)[0];
            for (const al of accBlock.split("\n")) {
              if (/^\s*[-*]\s+/.test(al) && !/^\s*[-*]\s*(\[[ xX]\]\s*)?\[(?:AB-\d+|AB-<n>)\]\s+/.test(al) && !al.includes("[AB-1]")) {
                errors.push(`kit/templates/${file}: invalid acceptance line "${al.trim()}"`);
              }
            }
          }
          for (const bl of body.split("\n")) {
            if (/^- R-\d+\s/.test(bl)) {
              stats.specLines += 1;
              if (!/\{origin:\s*(observed|documented|asked|inferred)/.test(bl)) {
                errors.push(`kit/templates/${file}: requirement example missing valid origin: ${bl}`);
              }
            } else if (/^- \[[ xX]\] (?:CF|Q)-\d+/.test(bl)) {
              stats.specLines += 1;
              if (!/^- \[[ xX]\] (CF|Q)-\d+ \(section:\s*[a-z0-9-]+\)\s+.+$/.test(bl)) {
                errors.push(`kit/templates/${file}: invalid conflict/question line: ${bl}`);
              }
            }
          }
        } catch (err) {
          errors.push(`kit/templates/${file}: front matter YAML error: ${err.message}`);
        }
      }
    }
  }
}

for (const kitGlob of ["kit/agents", "kit/skills"]) {
  const dir = path.join(repoRoot, kitGlob);
  if (!fs.existsSync(dir)) continue;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const f = ent.isDirectory() ? path.join(dir, ent.name, "SKILL.md") : path.join(dir, ent.name);
    if (!f.endsWith(".md") || !fs.existsSync(f)) continue;
    const raw = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
    if (raw.startsWith("---\n")) {
      const end = raw.indexOf("\n---\n", 4);
      if (end === -1) {
        errors.push(`${path.relative(repoRoot, f)}: unclosed YAML front matter`);
      } else {
        try {
          stats.kitFiles += 1;
          YAML.parse(raw.slice(4, end));
        } catch (err) {
          errors.push(`${path.relative(repoRoot, f)}: front matter YAML error: ${err.message}`);
        }
      }
    }
  }
}

// Check verbatim sync of agents.md §1 vs kit/templates/agents-block.md & kit/practices/default.md
const agentsSpec = path.join(repoRoot, "tenet/specs/tech-spec/agents.md");
const blockTpl = path.join(repoRoot, "kit/templates/agents-block.md");
const practicesDefault = path.join(repoRoot, "kit/practices/default.md");
if (fs.existsSync(agentsSpec) && fs.existsSync(blockTpl) && fs.existsSync(practicesDefault)) {
  const agentsText = fs.readFileSync(agentsSpec, "utf8").replace(/\r\n/g, "\n");
  const blockMatch = agentsText.match(/(<!-- tenet:begin v\{version\} -->[\s\S]*?<!-- tenet:end -->)/);
  const tplText = fs.readFileSync(blockTpl, "utf8").replace(/\r\n/g, "\n");
  if (!blockMatch || !tplText.includes(blockMatch[1])) {
    errors.push("kit/templates/agents-block.md does not match agents.md §1 verbatim");
  }
  const pracSection = agentsText.split("**Working rules**")[1]?.match(/```markdown\n([\s\S]*?)\n```/);
  const pracText = fs.readFileSync(practicesDefault, "utf8").replace(/\r\n/g, "\n").trim();
  if (!pracSection || pracSection[1].trim() !== pracText) {
    errors.push("kit/practices/default.md does not match agents.md §1 working rules verbatim");
  }
}

console.log(`Checked examples: ${JSON.stringify(stats)}`);
if (errors.length > 0) {
  console.error(`Found ${errors.length} example check failures:`);
  for (const e of errors) console.error("  FAIL:", e);
  process.exit(1);
}
console.log("All checked examples pass.");
