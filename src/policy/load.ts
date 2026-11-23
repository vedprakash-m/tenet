import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseDocument } from "yaml";
import { readYaml } from "../core/yaml.js";
import { git } from "../core/git.js";
import { message } from "../core/messages.js";
import { validate } from "../core/schema.js";
import type { Finding, TenetYaml } from "../types/generated.js";
import { finding, policyError } from "./errors.js";
import { match } from "./selectors.js";
import type { Policy, PolicyOptions, RuleMode } from "./types.js";

type Level = Policy["level"];

export type PolicyContext = {
  cwd: string;
  ref?: string;
  codeowners?: string;
  policy?: Policy;
  frontMatterOwners?: Map<string, string>;
};

type RuleDefaults = Record<Level, RuleMode>;

const contexts = new Map<string, PolicyContext>();
const policyContexts = new WeakMap<Policy, PolicyContext>();
let lastContext: PolicyContext | undefined;

const registry: Record<string, RuleDefaults> = {
  "tests-not-weakened": { observe: "advise", protect: "enforce", verify: "enforce", assure: "enforce" },
  "protected-surfaces": { observe: "advise", protect: "enforce", verify: "enforce", assure: "enforce" },
  "acceptance-passed": { observe: "advise", protect: "advise", verify: "enforce", assure: "enforce" },
  "citations-valid": { observe: "advise", protect: "advise", verify: "enforce", assure: "enforce" },
  budget: { observe: "advise", protect: "advise", verify: "advise", assure: "enforce" },
  "stop-threshold": { observe: "advise", protect: "enforce", verify: "enforce", assure: "enforce" },
  "review-converged": { observe: "observe", protect: "advise", verify: "enforce", assure: "enforce" },
  "spec-approval": { observe: "advise", protect: "enforce", verify: "enforce", assure: "enforce" },
  "distinguishing-evidence": { observe: "observe", protect: "advise", verify: "enforce", assure: "enforce" },
  "signed-evidence": { observe: "observe", protect: "observe", verify: "enforce", assure: "enforce" },
  "person-present-policy": { observe: "observe", protect: "observe", verify: "observe", assure: "enforce" },
};

const modeRank: Record<RuleMode, number> = { observe: 0, advise: 1, enforce: 2 };

const defaultDocuments: Policy["specs"]["documents"] = [
  { path: "vision.md", level: "L0" },
  { path: "specs/prd.md", level: "L1" },
  { path: "specs/tech-spec.md", level: "L2" },
  { path: "specs/ux-spec.md", level: "L2" },
  { path: "specs/plan.md", level: "L2" },
];

function packageVersion(): string {
  try {
    const filename = fileURLToPath(new URL("../../package.json", import.meta.url));
    const manifest = JSON.parse(readFileSync(filename, "utf8")) as { version?: unknown };
    return typeof manifest.version === "string" ? manifest.version : "0.0.0";
  } catch {
    return "0.0.0";
  }
}

function defaultStandard(): string {
  const match = /^(\d+)\.(\d+)/.exec(packageVersion());
  return `~${match?.[1] ?? "0"}.${match?.[2] ?? "0"}`;
}

function parseYamlText(text: string, filename: string): unknown {
  const document = parseDocument(text, {
    merge: false,
    prettyErrors: true,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) {
    const cause = document.errors[0] ?? new Error(`cannot parse YAML: ${filename}`);
    throw policyError("TN-POLICY-SCHEMA", message("TN-POLICY-SCHEMA", { detail: `${filename} is not valid YAML: ${cause.message}` }));
  }
  return document.toJS({ maxAliasCount: 100 });
}

function levelAvailable(level: Level, standard: string): boolean {
  if (level === "observe" || level === "protect") return true;
  const alpha = /alpha\.(\d+)/.exec(standard);
  if (alpha) {
    const release = Number.parseInt(alpha[1] ?? "0", 10);
    if (level === "verify") return release >= 1;
    return false;
  }
  if (standard.startsWith("~0.0") || packageVersion().startsWith("0.0.")) {
    return false;
  }
  return level === "verify";
}

function effectivePolicyLevel(level: Level, standard: string): Level {
  return levelAvailable(level, standard) ? level : "observe";
}
function rawDefaults(level: Level): Record<string, RuleMode> {
  return Object.fromEntries(Object.entries(registry).map(([rule, defaults]) => [rule, defaults[level]]));
}

function capMode(mode: RuleMode): RuleMode {
  return mode === "enforce" ? "advise" : mode;
}

function normalizePolicy(data: TenetYaml): Policy {
  const findings: Finding[] = [];
  const standard = data.standard ?? defaultStandard();
  const requestedLevel = data.level ?? "observe";
  const effectiveLevel = effectivePolicyLevel(requestedLevel, standard);

  if (requestedLevel !== effectiveLevel) {
    findings.push(
      finding(
        "TN-POLICY-LEVEL-UNAVAILABLE",
        "warning",
        message("TN-POLICY-LEVEL-UNAVAILABLE", { level: requestedLevel }),
        { file: "tenet.yaml" },
      ),
    );
  }

  const defaults = rawDefaults(effectiveLevel);
  const merged: Record<string, RuleMode> = { ...defaults };
  for (const [rule, override] of Object.entries(data.rules ?? {})) {
    if (rule.startsWith("x-")) continue;
    const base = defaults[rule];
    if (!base || !isKnownRuleMode(override)) {
      throw policyError(
        "TN-POLICY-RULE",
        message("TN-POLICY-RULE", { name: rule }),
        { rule, file: "tenet.yaml" },
      );
    }
    if (modeRank[override] < modeRank[base]) {
      throw policyError(
        "TN-POLICY-LOOSEN",
        message("TN-POLICY-LOOSEN", { layer: "tenet.yaml", name: rule }),
        { rule, file: "tenet.yaml" },
      );
    }
    merged[rule] = override;
  }

  for (const [rule, mode] of Object.entries(merged)) {
    const capped = capMode(mode);
    merged[rule] = capped;
    if (capped !== mode) {
      findings.push(
        finding(
          "TN-POLICY-ALPHA0-CAP",
          "advise",
          message("TN-POLICY-ALPHA0-CAP", { rule }),
          { rule, file: "tenet.yaml" },
        ),
      );
    }
  }

  return {
    ...data,
    standard,
    kit_path: data.kit_path ?? null,
    paths: {
      ...data.paths,
      records: data.paths?.records ?? "tenet",
    },
    level: effectiveLevel,
    rules: merged,
    specs: {
      ...data.specs,
      id_prefix: data.specs?.id_prefix ?? "R",
      documents: mergeDocuments(data.specs?.documents ?? []),
    },
    stop: data.stop ?? { failing_evaluations: 3 },
    agents: data.agents ?? { working_rules: "default" },
    findings,
  };
}

const specLevelRank: Record<Policy["specs"]["documents"][number]["level"], number> = {
  L0: 0,
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
};

function mergeDocuments(
  supplied: Policy["specs"]["documents"],
): Policy["specs"]["documents"] {
  const documents = new Map(defaultDocuments.map((document) => [document.path, { ...document }]));
  for (const document of supplied) {
    const existing = documents.get(document.path);
    if (existing && specLevelRank[document.level] > specLevelRank[existing.level]) {
      throw policyError(
        "TN-POLICY-LOOSEN",
        message("TN-POLICY-LOOSEN", { layer: "tenet.yaml", name: document.path }),
        { file: "tenet.yaml" },
      );
    }
    documents.set(document.path, { ...document });
  }
  return [...documents.values()];
}

function isKnownRuleMode(value: unknown): value is RuleMode {
  return value === "observe" || value === "advise" || value === "enforce";
}

async function readPolicy(ref: string | undefined, cwd: string): Promise<unknown> {
  if (ref) {
    if (ref.startsWith("-")) throw policyError("TN-USAGE-REF", message("TN-USAGE-REF"));
    try {
      return parseYamlText(await git(["show", `${ref}:tenet.yaml`], { cwd }), "tenet.yaml");
    } catch (error) {
      if (typeof (error as { code?: unknown }).code === "string") throw error;
      throw policyError(
        "TN-POLICY-MISSING",
        message("TN-POLICY-MISSING"),
        { file: "tenet.yaml" },
      );
    }
  }

  try {
    return await readYaml(path.join(cwd, "tenet.yaml"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw policyError(
        "TN-POLICY-MISSING",
        message("TN-POLICY-MISSING"),
        { file: "tenet.yaml" },
      );
    }
    throw policyError(
      "TN-POLICY-SCHEMA",
      message("TN-POLICY-SCHEMA", { detail: `could not read tenet.yaml: ${(error as Error).message}` }),
      { file: "tenet.yaml" },
    );
  }
}

async function readCodeowners(ref: string | undefined, cwd: string): Promise<string | undefined> {
  for (const filename of [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]) {
    if (ref) {
      try {
        return await git(["show", `${ref}:${filename}`], { cwd });
      } catch {}
    } else {
      try {
        return await readFile(path.join(cwd, ...filename.split("/")), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }
  return undefined;
}

function frontMatterOwner(text: string): string | undefined {
  const lines = text.replaceAll("\r\n", "\n").split("\n");
  if (lines[0] !== "---") return undefined;
  const end = lines.indexOf("---", 1);
  if (end < 0) return undefined;
  const front = parseYamlText(lines.slice(1, end).join("\n"), "spec front matter");
  if (!front || typeof front !== "object") return undefined;
  const tenet = (front as { tenet?: unknown }).tenet;
  if (!tenet || typeof tenet !== "object") return undefined;
  const owner = (tenet as { owner?: unknown }).owner;
  return typeof owner === "string" && owner.length > 0 ? owner : undefined;
}

async function readFrontMatterOwners(
  policy: Policy,
  ref: string | undefined,
  cwd: string,
): Promise<Map<string, string>> {
  const owners = new Map<string, string>();
  for (const document of policy.specs.documents) {
    const filename = `${policy.paths.records}/${document.path}`.replaceAll("\\", "/");
    let text: string | undefined;
    if (ref) {
      try {
        text = await git(["show", `${ref}:${filename}`], { cwd });
      } catch {}
    } else {
      try {
        text = await readFile(path.join(cwd, ...filename.split("/")), "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
    if (text) {
      const owner = frontMatterOwner(text);
      if (owner) owners.set(filename, owner);
    }
  }
  return owners;
}

function readPolicySync(cwd: string): TenetYaml | undefined {
  const filename = path.join(cwd, "tenet.yaml");
  try {
    const value = parseYamlText(readFileSync(filename, "utf8"), "tenet.yaml");
    return validate("tenet-yaml", value).ok ? (value as TenetYaml) : undefined;
  } catch {
    return undefined;
  }
}

function readCodeownersSync(cwd: string): string | undefined {
  for (const filename of [".github/CODEOWNERS", "CODEOWNERS", "docs/CODEOWNERS"]) {
    try {
      return readFileSync(path.join(cwd, ...filename.split("/")), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return undefined;
}

export async function loadPolicy(options: PolicyOptions = {}): Promise<Policy> {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const data = await readPolicy(options.ref, cwd);
  const checked = validate("tenet-yaml", data);
  if (!checked.ok) {
    const detail = checked.errors.map((error) => `${error.pointer || "/"} ${error.message}`).join("; ");
    throw policyError(
      "TN-POLICY-SCHEMA",
      message("TN-POLICY-SCHEMA", { detail }),
      { file: "tenet.yaml" },
    );
  }

  const policy = normalizePolicy(data as TenetYaml);
  if (options.ref) {
    const changed = await git(["diff", "--name-only", options.ref, "HEAD", "--", "tenet.yaml"], { cwd });
    if (changed.split(/\r?\n/).includes("tenet.yaml")) {
      policy.findings.push(
        finding(
          "TN-POLICY-BRANCH",
          "warning",
          message("TN-POLICY-BRANCH"),
          { file: "tenet.yaml" },
        ),
      );
    }
  }

  const codeowners = await readCodeowners(options.ref, cwd);
  const context: PolicyContext = { cwd };
  if (options.ref) context.ref = options.ref;
  if (codeowners) context.codeowners = codeowners;
  context.policy = policy;
  const frontMatterOwners = await readFrontMatterOwners(policy, options.ref, cwd);
  if (frontMatterOwners.size > 0) context.frontMatterOwners = frontMatterOwners;
  contexts.set(cwd, context);
  policyContexts.set(policy, context);
  lastContext = context;
  return policy;
}

export function ruleMode(policy: Pick<TenetYaml, "level" | "rules" | "standard">, rule: string): RuleMode {
  const defaults = registry[rule];
  if (!defaults) {
    throw policyError(
      "TN-POLICY-RULE",
      message("TN-POLICY-RULE", { name: rule }),
      { rule },
    );
  }
  const level = effectivePolicyLevel(policy.level ?? "observe", policy.standard ?? defaultStandard());
  const override = policy.rules?.[rule];
  if (override && isKnownRuleMode(override)) return capMode(override);
  return capMode(defaults[level]);
}

function activeContext(cwd = process.cwd()): PolicyContext {
  const root = path.resolve(cwd);
  const saved = contexts.get(root);
  if (saved) return saved;
  if (lastContext) return lastContext;
  const context: PolicyContext = { cwd: root };
  const codeowners = readCodeownersSync(root);
  if (codeowners) context.codeowners = codeowners;
  return context;
}

function codeownerEntries(text: string | undefined): Array<{ pattern: string; owners: string[]; line: number }> {
  if (!text) return [];
  const entries: Array<{ pattern: string; owners: string[]; line: number }> = [];
  let line = 0;
  for (const raw of text.split(/\r?\n/)) {
    line += 1;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    const pattern = parts.shift();
    if (!pattern) continue;
    entries.push({ pattern, owners: parts, line });
  }
  return entries;
}

function codeownerPattern(pattern: string): string {
  const normalized = pattern.replace(/^\//, "");
  if (normalized.includes("/")) return normalized.endsWith("/") ? `${normalized}**` : normalized;
  return `**/${normalized}`;
}

function matchingArea(
  filename: string,
  policy: TenetYaml | undefined,
): { name: string; owners: string[] } | undefined {
  const areas = policy?.areas;
  if (areas && Object.keys(areas).some((name) => !name.startsWith("x-"))) {
    let selected: { name: string; owners: string[] } | undefined;
    for (const [name, area] of Object.entries(areas)) {
      if (name.startsWith("x-") || !area?.paths) continue;
      if (match(area.paths, filename)) selected = { name, owners: area.owners ?? [] };
    }
    return selected;
  }
  return undefined;
}

function hasConfiguredAreas(policy: TenetYaml | undefined): boolean {
  return Object.keys(policy?.areas ?? {}).some((name) => !name.startsWith("x-"));
}

function fallbackCodeowners(
  filename: string,
  context: PolicyContext,
): { name: string; owners: string[] } | undefined {
  let selected: { name: string; owners: string[] } | undefined;
  for (const entry of codeownerEntries(context.codeowners)) {
    if (match(codeownerPattern(entry.pattern), filename)) {
      selected = { name: entry.pattern, owners: entry.owners };
    }
  }
  return selected;
}

export function areaFor(filename: string): string | undefined {
  const context = activeContext();
  const policy = context.policy ?? readPolicySync(context.cwd);
  const configured = matchingArea(filename, policy);
  if (configured) return configured.name;
  if (hasConfiguredAreas(policy)) {
    throw policyError(
      "TN-GATE-UNKNOWN",
      message("TN-GATE-UNKNOWN", { missing: `an area matching ${filename}` }),
    );
  }
  const area = fallbackCodeowners(filename, context);
  return area?.name;
}

export function ownersFor(filename: string): string[] {
  const context = activeContext();
  const policy = context.policy ?? readPolicySync(context.cwd);
  const portable = filename.replaceAll("\\", "/").replace(/^\.\/+/, "");
  const records = policy?.paths?.records ?? "tenet";
  const document = (policy?.specs?.documents ?? []).find((document) => {
    const relative = document.path.replaceAll("\\", "/").replace(/^\.\/+/, "");
    return portable === relative || portable === `${records}/${relative}`;
  });
  const codeowner = fallbackCodeowners(filename, context);
  if (document) {
    const frontMatterOwner = context.frontMatterOwners?.get(portable);
    if (frontMatterOwner) return [frontMatterOwner];
    if (codeowner?.owners.length) return [...codeowner.owners];
    return ["Owner"];
  }
  const area = matchingArea(filename, policy);
  if (area?.owners.length) return [...area.owners];
  if (hasConfiguredAreas(policy)) {
    throw policyError(
      "TN-GATE-UNKNOWN",
      message("TN-GATE-UNKNOWN", { missing: `an area matching ${portable}` }),
    );
  }
  if (codeowner?.owners.length) return [...codeowner.owners];
  return ["Owner"];
}

export function registryRules(): readonly string[] {
  return Object.keys(registry);
}

export function contextForPolicy(policy: Policy): PolicyContext {
  return policyContexts.get(policy) ?? activeContext();
}
