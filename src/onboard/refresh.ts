import { parse } from "yaml";
import { git } from "../core/git.js";
import type { Finding } from "../core/output.js";
import type { Assignment, Inventory } from "../types/generated.js";
import { object, within, type Facts } from "./inventory.js";

export type CheckOptions = {
  cwd?: string;
  paths?: string[];
  pack?: boolean | string;
  ci?: boolean;
  base?: string;
  installedVersion?: string;
};

export type CheckResult = {
  findings: Finding[];
  summary: { errors: number; warnings: number; advises: number };
};

export type OnboardDeps = { check?: (options?: CheckOptions) => Promise<CheckResult> };

type RefreshResult = { units: Inventory["units"]; diagnostics: Finding[] };

function draftRevision(text: string): string | undefined {
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1];
  if (!header) return undefined;
  try {
    const revision = object(object(parse(header, { maxAliasCount: 50 })).tenet).drafted_at_rev;
    return typeof revision === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(revision) ? revision : undefined;
  } catch {
    return undefined;
  }
}

async function changedPaths(facts: Facts, revision: string, output: Set<string>): Promise<Set<string>> {
  const { cwd } = facts.snapshot;
  const options = { cwd };
  // A draft anchor is an immutable commit. An unavailable anchor must be surfaced
  // rather than silently substituting HEAD and issuing an empty assignment.
  const head = facts.snapshot.revision;
  await git(["cat-file", "-e", `${revision}^{commit}`], options);
  const [changed, deleted] = await Promise.all([
    git(["diff", "--name-only", "--no-renames", "-z", revision, head, "--"], options),
    git(["diff", "--name-only", "--no-renames", "--diff-filter=D", "-z", revision, head, "--"], options),
  ]);
  const sources = new Set(facts.files.map((file) => file.path));
  const skipped = new Set(facts.inventory.sources.skipped.map((file) => file.path));
  const removed = new Set(deleted.split("\0").filter(Boolean));
  return new Set(changed.split("\0").filter((file) => file && !output.has(file) &&
    !file.startsWith(".tenet/") && !skipped.has(file) && (sources.has(file) || removed.has(file))));
}

export async function refreshAssignment(facts: Facts, assignment: Assignment, deps: OnboardDeps): Promise<RefreshResult> {
  if (!deps.check) throw new Error("Onboarding refresh requires a specification checker.");
  const { findings: diagnostics } = await deps.check({ cwd: facts.snapshot.cwd });
  const records = facts.policy.paths?.records ?? "tenet";
  const documents = new Set([
    ...assignment.output.paths,
    ...(facts.policy.specs?.documents ?? []).map(({ path }) => `${records}/${path}`.replaceAll("\\", "/")),
  ]);
  const revisions = new Set(facts.files.flatMap((file) => {
    if (!documents.has(file.path)) return [];
    const revision = draftRevision(file.text);
    return revision ? [revision] : [];
  }));
  if (!revisions.size) return { units: assignment.units, diagnostics };
  const changes = new Set<string>();
  for (const revision of revisions) {
    for (const file of await changedPaths(facts, revision, documents)) changes.add(file);
  }
  const units = assignment.units.filter((unit) => {
    const matches = unit.paths.some((root) => [...changes].some((file) => within(root, file)));
    if (matches) return true;
    // Shared configuration, docs and files outside any explicit area are
    // inputs to every drafting unit.
    return [...changes].some((file) => !assignment.units.some((other) => other.paths.some((root) => within(root, file))));
  });
  return { units, diagnostics };
}
