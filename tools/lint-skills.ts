// Skill lint (TS §5.6): instruction text is executable product behavior, so it is checked like code.
// Token budgets, closure (every verb, flag, decision kind, action, agent and resource named exists and parses),
// secrets, unscoped overclaims, and repetition. Structure only; contradictions in prose are left to review.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { ACTIONS } from "../packages/kernel/src/core/schemas.ts";
import { DECISIONS } from "../packages/kernel/src/decisions/index.ts";
import { parseArgs } from "../packages/kernel/src/frontends/cli.ts";
import { VERBS } from "../packages/kernel/src/verbs/index.ts";

const BODY_BUDGET: Record<string, number> = { tenet: 4000, "tenet-intake": 4000, "tenet-build": 4000, "tenet-review": 4500 };
const AGENT_BUDGET = 1000, DESCRIPTION_BUDGET = 2000, LOADED_BUDGET = 12000;
const AGENT_ALLOWLIST = new Set(["tenet-reviewer", "tenet-analyst"]);
const AMBIGUOUS_WORDS = ["stop", "undo", "ok", "do it", "continue"];
const tokens = (s: string) => Math.ceil(s.length / 4);

const PLACEHOLDERS: Record<string, string> = {
  handle: "W1.1.abcd", profile: "feature", text: "text", paths: "src/a.ts,src/b.ts", path: "src/a.ts", subject: "subject",
  stage: "candidate", mode: "pause", kind: "basis", role: "reviewer", scope: "working-tree", view: "status",
};
/** A minimal valid body for verbs whose structured input arrives on stdin, so the line parses as it will run. */
const BODIES: Record<string, Record<string, unknown>> = {
  findings: { result: { manifest: "m", reservation: "r", attempt: 1, mode: "full", status: "completed", dispatchMode: "subagent-fresh", axes: { behavior: "pass", structure: "pass" }, coverage: { inspected: [], uncovered: [], crossCutting: "", sampled: [] }, attention: [], findings: [], basisGaps: [] } },
  decide: {},
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (["kernel", "schemas", "template"].includes(f)) return []; // a recipe's template is project content, not instructions
    return statSync(p).isDirectory() ? files(p) : /\.(md|json)$/.test(f) ? [p] : [];
  });
}

/** Front matter is parsed as YAML, the way the hosts parse it: a description with an unquoted ": " is an error here too. */
function frontMatter(text: string): { meta: Record<string, string>; body: string; error?: string } {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(text);
  if (!m) return { meta: {}, body: text };
  try {
    const doc = parseYaml(m[1]!) as Record<string, unknown> | null;
    const meta = Object.fromEntries(Object.entries(doc ?? {}).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)]));
    return { meta, body: m[2]! };
  } catch (e) {
    return { meta: {}, body: m[2]!, error: (e as Error).message.split("\n")[0]! };
  }
}

/** Kernel command lines in inline code: `tenet <verb> ...`. A bare `tenet <verb>` names the verb; it is not an example. */
function commandLines(text: string): string[] {
  return [...text.matchAll(/`(tenet [a-z]+ [^`\n]+)`/g)].map((m) => m[1]!);
}

export function parseCommand(line: string): { verb: string; input: Record<string, unknown> } {
  const cleaned = line.replace(/^tenet /, "").replace(/\[[^\]]*\]/g, " ")
    .replace(/<([a-z-]+)>/g, (_m, k: string) => PLACEHOLDERS[k] ?? "x").replace(/(\S+)\|\S+/g, "$1").replace(/\.\.\./g, "").trim();
  return parseArgs(cleaned.split(/\s+/).filter(Boolean));
}

export function lintPayload(root: string): string[] {
  const problems: string[] = [];
  const bad = (f: string, msg: string) => problems.push(`${relative(root, f)}: ${msg}`);
  const all = existsSync(root) ? files(root) : [];
  const docs = all.filter((f) => f.endsWith(".md"));
  const texts = new Map(docs.map((f) => [f, readFileSync(f, "utf8")]));
  const names = new Set<string>(["tenet-reviewer", "tenet-analyst"]);
  let descriptionTokens = 0, loadedTokens = 0;

  for (const [f, text] of texts) {
    const { meta, body, error } = frontMatter(text);
    const rel = relative(root, f);
    if (error) bad(f, `front matter is not valid YAML (${error}); quote the value`);
    const skill = /^skills\/([^/]+)\/SKILL\.md$/.exec(rel)?.[1];
    const isAgent = /agents\/.+\.agent\.md$/.test(rel);
    if (meta.name) names.add(meta.name);
    if (skill || isAgent) {
      if (!meta.name) bad(f, "missing name");
      if (!meta.description) bad(f, "missing description");
      descriptionTokens += tokens(meta.description ?? "");
    }
    if (skill) {
      const budget = BODY_BUDGET[skill];
      if (budget && tokens(body) > budget) bad(f, `body is ${tokens(body)} tokens, budget ${budget}`);
      if (skill !== "tenet-review") loadedTokens += tokens(body);
    }
    if (isAgent) {
      if (tokens(body) > AGENT_BUDGET) bad(f, `agent body is ${tokens(body)} tokens, budget ${AGENT_BUDGET}`);
      if (meta.name === "tenet") loadedTokens += tokens(body);
      const agents = /agents:\s*\[(.*)\]/.exec(text)?.[1]?.split(",").map((s) => s.trim().replace(/['"]/g, "")).filter(Boolean) ?? [];
      for (const a of agents) if (!AGENT_ALLOWLIST.has(a)) bad(f, `dispatches "${a}", which is not on the allowlist`);
    }
    // secrets
    if (/ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY/.test(text)) bad(f, "looks like it contains a secret");
    // unscoped overclaims and enforcement claims, unless the line is marked
    text.split("\n").forEach((l, i) => {
      if (l.includes("lint-ok")) return;
      if (/\b(production-ready|fully tested|100%)\b|\bsecure\b/i.test(l)) bad(f, `line ${i + 1}: unscoped claim`);
      if (/\b(guarantees?|prevents?|enforces?|cannot be bypassed|impossible to)\b/i.test(l)) bad(f, `line ${i + 1}: claims enforcement`);
    });
    // examples: every kernel command line parses against its verb's schema
    for (const line of commandLines(text)) {
      try {
        const { verb, input } = parseCommand(line);
        const v = VERBS[verb];
        if (!v) { bad(f, `"${line}": no verb "${verb}"`); continue; }
        const shape = Object.keys((v.schema as unknown as { shape: Record<string, unknown> }).shape);
        for (const k of Object.keys(input)) if (!shape.includes(k)) bad(f, `"${line}": unknown flag --${k}`);
        const r = v.schema.safeParse({ ...BODIES[verb], ...input });
        if (!r.success) bad(f, `"${line}": ${r.error.issues[0]?.path.join(".") || "input"}: ${r.error.issues[0]?.message}`);
        if (verb === "decide" && typeof input.kind === "string" && !DECISIONS[input.kind]) bad(f, `"${line}": no decision kind "${input.kind}"`);
      } catch (e) { bad(f, `"${line}": ${(e as Error).message}`); }
    }
    for (const m of text.matchAll(/resources\/([\w.-]+\.md)/g)) {
      const owner = /^skills\/([^/]+)\//.exec(rel)?.[1];
      const dir = owner ? `skills/${owner}` : "";
      if (!existsSync(join(root, dir, "resources", m[1]!))) bad(f, `resource ${m[0]} does not exist`);
    }
  }

  // closure: every `tenet-*` name used exists; every action is handled by the coordinator skill
  for (const [f, text] of texts) for (const m of text.matchAll(/`(tenet-[a-z-]+)`/g)) if (!names.has(m[1]!)) bad(f, `names "${m[1]}", which does not exist`);
  const coordinator = [...texts].find(([f]) => f.endsWith("skills/tenet/SKILL.md"))?.[1] ?? "";
  for (const a of ACTIONS) if (!new RegExp(`\`${a}\``).test(coordinator)) bad(join(root, "skills/tenet/SKILL.md"), `the next action "${a}" is not handled`);

  // action-semantics words live in exactly one skill file (UX §7.2)
  for (const w of AMBIGUOUS_WORDS) {
    const holders = [...texts].filter(([f, t]) => /skills\//.test(f) && new RegExp(`^\\| "${w}"`, "m").test(t));
    if (holders.length !== 1) problems.push(`the word "${w}" must have a steering row in exactly one skill, found ${holders.length}`);
  }

  // repetition: a paragraph of 60+ words appearing twice
  const seen = new Map<string, string>();
  for (const [f, text] of texts) for (const p of frontMatter(text).body.split(/\n{2,}/)) {
    const norm = p.replace(/\s+/g, " ").trim();
    if (norm.split(" ").length < 60) continue;
    const prev = seen.get(norm);
    if (prev && prev !== f) bad(f, `repeats a paragraph from ${relative(root, prev)}`);
    else if (prev === f) bad(f, "repeats one of its own paragraphs");
    seen.set(norm, f);
  }

  if (descriptionTokens > DESCRIPTION_BUDGET) problems.push(`descriptions are ${descriptionTokens} tokens, budget ${DESCRIPTION_BUDGET}`);
  if (loadedTokens > LOADED_BUDGET) problems.push(`a Standard task loads ${loadedTokens} Tenet tokens, budget ${LOADED_BUDGET}`);
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = join(import.meta.dirname, "../plugin");
  const problems = lintPayload(root);
  if (problems.length) { console.error(`lint-skills: ${problems.length} problem(s)\n${problems.join("\n")}`); process.exit(1); }
  console.log(`lint-skills: ${readdirSync(join(root, "skills")).length} skills, no problems`);
}
