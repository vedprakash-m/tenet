import { readFile } from "node:fs/promises";
import { confine, writeAtomic } from "../core/fs.js";
import { message } from "../core/messages.js";
import { fail, type Finding } from "../core/output.js";
import { validate } from "../core/schema.js";
import { readYaml } from "../core/yaml.js";
import type { Assignment, Inventory, TenetYaml } from "../types/generated.js";
import { firstFindings } from "./findings.js";
import { inventoryFacts, views, type Facts, type Layout } from "./inventory.js";
import { openRepository, preflight, type Preflight } from "./preflight.js";
import { refreshAssignment, type OnboardDeps } from "./refresh.js";

const inventoryPath = ".tenet/onboard/inventory.json";
const assignmentPath = ".tenet/onboard/assignment.json";
const configPath = "tenet.yaml";

export type OnboardOptions = { cwd?: string; inventoryOnly?: boolean; refresh?: boolean; layout?: Layout };

export type OnboardResult = {
  preflight: Preflight;
  inventory: Inventory;
  findings: Inventory["findings"];
  assignment: Assignment;
};

const genericQuestions = [
  "What is this project for?",
  "Who are its primary users and owners?",
  "Which outcomes matter most?",
  "Which boundaries and never-dos are non-negotiable?",
  "Which inputs, outputs and interfaces define it?",
  "Which data, privacy and retention rules apply?",
  "Which reliability and failure behavior matters?",
  "Which environments or compatibility promises are required?",
  "Which dependencies may it rely on?",
  "Which work or priority should come first?",
] as const;

const questionsByKind: Readonly<Record<string, readonly string[]>> = {
  cli: [
    "What is the command for, and who runs it?",
    "What inputs, files and configuration does it accept?",
    "What output and exit-code contract must stay stable?",
    "Which platforms, shells and runtime versions must work?",
    "How is it installed and upgraded?",
    "Which invalid inputs and failures need plain recovery steps?",
    "Which commands or file changes must it never make?",
    "Which integrations are required or optional?",
    "Which existing compatibility promises must stay?",
    "Which outcome matters most to first-time users?",
  ],
  service: [
    "What user or system need does the service meet?",
    "Who calls it, and through which interfaces?",
    "Which data does it own, read and publish?",
    "Which security and permission rules are non-negotiable?",
    "Which availability, latency and capacity targets matter?",
    "How must timeout, retry and partial failure behave?",
    "Which external systems may it depend on?",
    "How are deployments, migrations and rollbacks governed?",
    "What must the service never do or expose?",
    "Which operating outcome has highest priority?",
  ],
  library: [
    "What problem and audience is the library for?",
    "Which public API contract must remain stable?",
    "Which languages, runtimes and package versions are supported?",
    "How is the library installed and versioned?",
    "Which inputs, side effects and error types are allowed?",
    "Which compatibility and deprecation promises matter?",
    "Which performance or resource bounds matter?",
    "Which integrations belong in or outside the library?",
    "What must the library never depend on or mutate?",
    "Which adoption or maintenance goal matters most?",
  ],
  data: [
    "What decision or workflow does this data support?",
    "Who consumes it, and at which grain and freshness?",
    "Which sources are authoritative, and how is lineage kept?",
    "Which output schemas and quality checks must hold?",
    "How are completeness, duplicates and late data handled?",
    "Which privacy, retention and access rules apply?",
    "How are failed loads, corrections and replay handled?",
    "Which schedules and service levels matter?",
    "What use or transformation must never happen?",
    "Which data outcome has highest priority?",
  ],
  infrastructure: [
    "Which workload or product does this infrastructure serve?",
    "Which environments and providers are in scope?",
    "Which availability and disaster-recovery targets matter?",
    "Which identity, network and secret boundaries are required?",
    "Which resources, dependencies and external services are critical?",
    "How are changes reviewed, applied and rolled back?",
    "Which scaling, cost and quota limits matter?",
    "How are drift, failed apply and partial recovery handled?",
    "Which operational action must never be automatic?",
    "Which reliability or delivery goal has highest priority?",
  ],
  application: [
    "What need does the application meet, and for whom?",
    "Which user journeys and roles are essential?",
    "Which screens, inputs and notifications must stay usable?",
    "Which data is stored, shown, shared or retained?",
    "Which privacy, security and permission rules apply?",
    "Which browsers, devices and accessibility levels are supported?",
    "How must offline, loading and partial-failure states behave?",
    "Which integrations and release platforms are in scope?",
    "What user or product outcome must never happen?",
    "Which user experience or reliability goal matters most?",
  ],
};

export function interviewQuestions(
  projectKind: string,
): { project_kind: string[]; generic: string[] } {
  return {
    project_kind: [...(questionsByKind[projectKind] ?? [])],
    generic: [...genericQuestions],
  };
}

function makeAssignment(facts: Facts): Assignment {
  const { layout, units } = facts.inventory;
  return {
    schema_version: 1,
    inventory: inventoryPath,
    skill: "draft-specs",
    project_kind: facts.project,
    views: [...views],
    layout,
    units,
    question_limit: 10,
    questions: interviewQuestions(facts.project),
    output: { paths: layout === "one-file" ? ["tenet/intent.md"] :
      ["tenet/vision.md", "tenet/specs/prd.md", "tenet/specs/tech-spec.md", "tenet/specs/ux-spec.md", "tenet/specs/plan.md"] },
    rules: ["no intent from code alone", "every observed or documented statement cites", "never resolve a conflict", "never bless"],
  };
}

function schemaError(detail: string): Finding {
  const code = "TN-POLICY-SCHEMA";
  const words = message(code, { detail });
  return { ...fail(code, words.message, words.fix), file: configPath };
}

async function workingPolicy(cwd: string): Promise<TenetYaml> {
  const filename = await confine(configPath, cwd);
  let data: unknown;
  try { data = await readYaml(filename); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    throw schemaError(error instanceof Error ? error.message : String(error));
  }
  const validation = validate("tenet-yaml", data);
  if (!validation.ok) throw schemaError(validation.errors.map((error) => `${error.pointer || "/"} ${error.message}`).join("; "));
  return data as TenetYaml;
}

async function writeJson(filename: string, value: unknown): Promise<void> {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
  try {
    if ((await readFile(filename)).equals(bytes)) return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await writeAtomic(filename, bytes);
}

export async function prepareOnboard(
  options: OnboardOptions = {},
  deps: OnboardDeps = {},
): Promise<{ value: OnboardResult; diagnostics: Finding[] }> {
  const snapshot = await openRepository(options.cwd ?? process.cwd());
  const policy = await workingPolicy(snapshot.cwd);
  const facts = await inventoryFacts(snapshot, policy, options.layout);
  const evidence = await firstFindings(facts);
  const inventory: Inventory = {
    schema_version: facts.inventory.schema_version,
    revision: facts.inventory.revision,
    sources: facts.inventory.sources,
    modules: facts.inventory.modules,
    tests: evidence.tests,
    docs: facts.inventory.docs,
    owners: facts.inventory.owners,
    ci: facts.inventory.ci,
    size: facts.inventory.size,
    layout: facts.inventory.layout,
    units: facts.inventory.units,
    findings: evidence.findings,
    observations: evidence.observations,
  };
  const assignment = makeAssignment(facts);
  const diagnostics = [];
  if (options.refresh) {
    const refresh = await refreshAssignment(facts, assignment, deps);
    assignment.units = refresh.units;
    diagnostics.push(...refresh.diagnostics);
  }

  const [inventoryFile, assignmentFile] = await Promise.all([
    confine(inventoryPath, snapshot.cwd),
    confine(assignmentPath, snapshot.cwd),
  ]);
  await writeJson(inventoryFile, inventory);
  await writeJson(assignmentFile, assignment);
  const value = { preflight: preflight(snapshot, inventory.sources), inventory, findings: inventory.findings, assignment };
  return { value, diagnostics };
}

export async function onboard(options: OnboardOptions = {}, deps: OnboardDeps = {}): Promise<OnboardResult> {
  return (await prepareOnboard(options, deps)).value;
}
