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
