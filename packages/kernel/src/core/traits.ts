// QLT-11 trait state, pure slice (specs/trait-detection.md; schema-migration.md 16.2.1; decision-packet 4a-A and 4b-A).
// Candidate only: the stored State does not reference these schemas yet, and nothing here reads or writes a file, a
// repository or a clock. Detection, evidence capture, decisions and the registry's contributions are separate work.
import { z } from "zod";
import { hashOf } from "./ids.ts";
import { DIMENSIONS } from "./risk.ts";
import type { Dimension } from "./risk.ts";

/** The closed R1 set, in registry order. Anything else, including an R2 trait, is not a canonical id. */
export const R1_TRAITS = [
  "ui", "persistence", "auth", "personal-data", "public-api", "external-effects", "background-jobs", "i18n", "cli", "library",
] as const;
export type R1Trait = (typeof R1_TRAITS)[number];
/** Named in the notice below; never assessed, never stored (decision 4b-A). */
export const R2_DEFERRED_TRAITS = ["data-pipeline", "infra", "ml", "mobile"] as const;
const R1_SET: ReadonlySet<string> = new Set(R1_TRAITS);

export const canonicalTraitId = (v: unknown): R1Trait | null => (typeof v === "string" && R1_SET.has(v) ? (v as R1Trait) : null);

/** Registry-owned text shown wherever trait results are reported. It is always true, so it is always shown. */
export const NOT_ASSESSED_IN_R1 = `Not assessed in R1: ${R2_DEFERRED_TRAITS.join(", ")}. Tenet has not checked whether these apply.`;

export const registryVersionOf = (registry: unknown): string => `sha256:${hashOf(registry)}`;

// Bounds are proposals; the reviewed design sets the final ceilings (schema-migration 16.2.1, last paragraph).
const MAX_PATH = 1024, MAX_EVIDENCE = 256, MAX_UNAVAILABLE = 32, MAX_LEGACY = 256, MAX_LEGACY_CHARS = 1024;

const encoder = new TextEncoder();
function byteCompare(a: string, b: string): number {
  const x = encoder.encode(a), y = encoder.encode(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i]! - y[i]!;
  return x.length - y.length;
}

/** Sorts by UTF-8 bytes and refuses a repeated key. */
function sortedUnique<T>(what: string, items: readonly T[], key: (t: T) => string): T[] {
  const out = [...items].sort((a, b) => byteCompare(key(a), key(b)));
  for (let i = 1; i < out.length; i++) {
    if (key(out[i]!) === key(out[i - 1]!)) throw new Error(`duplicate ${what}: ${key(out[i]!)}`);
  }
  return out;
}

/** Git-relative UTF-8 names with `/` separators. No OS path, Unicode or case normalization is applied. */
export function gitPathProblem(p: string): string | null {
  if (p.length === 0 || p.length > MAX_PATH) return "empty or too long";
  if (/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(p)) return "not valid UTF-8";
  if (p.includes("\0")) return "contains NUL";
  if (p.startsWith("/") || p.startsWith("\\\\") || /^[A-Za-z]:/.test(p)) return "absolute, drive or UNC path";
  if (p.split("/").some((c) => c === "" || c === "." || c === "..")) return "empty, . or .. component";
  return null;
}

const Sha = z.string().regex(/^[0-9a-f]{64}$/);
const RegistryVersion = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const Mode = z.string().regex(/^[0-7]{6}$/);
const GitPath = z.string().superRefine((p, ctx) => {
  const m = gitPathProblem(p);
  if (m) ctx.addIssue({ code: "custom", message: m });
});
const Id = z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
const Trait = z.enum(R1_TRAITS);
const Outcome = z.enum(["present", "not-indicated", "unknown"]);
const Coverage = z.enum(["complete", "partial"]);
const SupportedProfile = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
const DecisionId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
const Count = z.number().int().nonnegative();

export const ProjectEvidence = z.strictObject({ path: GitPath, mode: Mode, hash: Sha });
export const ChangeEvidence = z.strictObject({
  path: GitPath, beforeMode: Mode.nullable(), beforeHash: Sha.nullable(), afterMode: Mode.nullable(), afterHash: Sha.nullable(),
}).refine(
  (e) => (e.beforeMode === null) === (e.beforeHash === null) && (e.afterMode === null) === (e.afterHash === null),
  "a mode and its hash are both present or both null",
);
export type ProjectEvidence = z.infer<typeof ProjectEvidence>;
export type ChangeEvidence = z.infer<typeof ChangeEvidence>;
export type Outcome = z.infer<typeof Outcome>;

const unique = (xs: readonly string[]) => new Set(xs).size === xs.length;
const assessmentShape = {
  trait: Trait, outcome: Outcome, supportedProfile: SupportedProfile, coverage: Coverage, evidenceHash: Sha,
  unavailable: z.array(Id).max(MAX_UNAVAILABLE), reasonId: Id,
};
type Shape = { outcome: Outcome; coverage: "complete" | "partial"; unavailable: string[]; evidence: Array<{ path: string }> };
/** `not-indicated` needs complete coverage and every input inspected (E9, E10, E18). Repeated paths or inputs are refused. */
const assessmentOk = (a: Shape) =>
  (a.outcome !== "not-indicated" || (a.coverage === "complete" && a.unavailable.length === 0))
  && unique(a.unavailable) && unique(a.evidence.map((e) => e.path));
const ASSESSMENT_MSG = "not-indicated needs complete coverage and no unavailable input; paths and inputs are unique";

export const ProjectTraitAssessment = z.strictObject({ ...assessmentShape, evidence: z.array(ProjectEvidence).max(MAX_EVIDENCE) })
  .refine(assessmentOk, ASSESSMENT_MSG);
export const ChangeTraitAssessment = z.strictObject({ ...assessmentShape, evidence: z.array(ChangeEvidence).max(MAX_EVIDENCE) })
  .refine(assessmentOk, ASSESSMENT_MSG);
const correctionShape = {
  trait: Trait, outcome: Outcome, registryVersion: RegistryVersion, evidenceHash: Sha, decisionId: DecisionId,
  at: z.string().min(1).max(40),
};
export const ProjectTraitCorrection = z.strictObject(correctionShape);
export const ChangeTraitCorrection = z.strictObject({
  ...correctionShape, generation: Count, intentRevision: Count, candidateDiffHash: Sha,
});
export type ProjectTraitAssessment = z.infer<typeof ProjectTraitAssessment>;
export type ChangeTraitAssessment = z.infer<typeof ChangeTraitAssessment>;
export type ProjectTraitCorrection = z.infer<typeof ProjectTraitCorrection>;
export type ChangeTraitCorrection = z.infer<typeof ChangeTraitCorrection>;

// ---- identities (16.2.1) ----

export interface EvidenceInput {
  registryVersion: string; trait: R1Trait; scope: "project" | "change"; supportedProfile: string; coverage: "complete" | "partial";
  evidence: readonly (ProjectEvidence | ChangeEvidence)[]; unavailable: readonly string[];
}
/** `hashOf` over explicit versioned fields. Outcome, reason and corrections are not inputs, so a correction never changes it. */
export function traitEvidenceHash(i: EvidenceInput): string {
  const Entry = i.scope === "project" ? ProjectEvidence : ChangeEvidence;
  return hashOf({
    version: 1, registryVersion: RegistryVersion.parse(i.registryVersion), trait: Trait.parse(i.trait), scope: i.scope,
    supportedProfile: SupportedProfile.parse(i.supportedProfile), coverage: Coverage.parse(i.coverage),
    evidence: sortedUnique("evidence path", i.evidence.map((e) => Entry.parse(e)), (e) => e.path),
    unavailable: sortedUnique("unavailable input", i.unavailable.map((u) => Id.parse(u)), (u) => u),
  });
}

export interface CandidateDiffInput {
  workspaceId: string; work: string; generation: number; startSnapshotHash: string; entries: readonly ChangeEvidence[];
}
/** Identity of the contract-start-to-current diff. Scope paths and model claims are not inputs. */
export const candidateDiffHash = (i: CandidateDiffInput): string => hashOf({
  version: 1, workspaceId: i.workspaceId, work: i.work, generation: Count.parse(i.generation),
  startSnapshotHash: Sha.parse(i.startSnapshotHash),
  entries: sortedUnique("diff path", i.entries.map((e) => ChangeEvidence.parse(e)), (e) => e.path),
});

/** The bounded project evidence set: the registry version and each trait's evidence hash, sorted by trait id. */
export const projectEvidenceSetHash = (
  registryVersion: string, assessments: readonly { trait: R1Trait; evidenceHash: string }[],
): string => hashOf({
  version: 1, registryVersion: RegistryVersion.parse(registryVersion),
  traits: sortedUnique(
    "trait", assessments.map((a) => ({ trait: Trait.parse(a.trait), evidenceHash: Sha.parse(a.evidenceHash) })), (a) => a.trait,
  ),
});

export interface ProjectResolutionInput {
  registryVersion: string; evidenceHash: string;
  assessments: readonly { trait: R1Trait; outcome: Outcome; evidenceHash: string; reasonId: string }[];
  corrections: readonly ProjectTraitCorrection[];
}
/** Evidence plus outcomes plus current corrections, so a user correction changes it although the repository did not. */
export const projectResolutionHash = (i: ProjectResolutionInput): string => hashOf({
  version: 1, registryVersion: RegistryVersion.parse(i.registryVersion), evidenceHash: Sha.parse(i.evidenceHash),
  assessments: sortedUnique(
    "assessment trait",
    i.assessments.map((a) => ({ trait: a.trait, outcome: a.outcome, evidenceHash: a.evidenceHash, reasonId: a.reasonId })),
    (a) => a.trait,
  ),
  corrections: sortedUnique(
    "correction trait",
    i.corrections.map((c) => ({ trait: c.trait, outcome: c.outcome, evidenceHash: c.evidenceHash, decisionId: c.decisionId, at: c.at })),
    (c) => c.trait,
  ),
});

// ---- correction applicability (TD-4, E4, E5, E11) ----

function partition<C extends { trait: R1Trait }>(
  corrections: readonly C[], applies: (c: C) => boolean,
): { applicable: C[]; stale: C[] } {
  const sorted = sortedUnique("correction trait", corrections, (c) => c.trait);
  return { applicable: sorted.filter(applies), stale: sorted.filter((c) => !applies(c)) };
}
type Bound = readonly { trait: R1Trait; evidenceHash: string }[];
const evidenceMatches = (assessments: Bound, c: { trait: R1Trait; evidenceHash: string }) =>
  assessments.some((a) => a.trait === c.trait && a.evidenceHash === c.evidenceHash);

/** A project correction lives across work generations while the registry and that trait's own evidence still match. */
export function applicableProjectCorrections(
  corrections: readonly ProjectTraitCorrection[], ctx: { registryVersion: string; assessments: Bound },
) {
  return partition(
    corrections.map((c) => ProjectTraitCorrection.parse(c)),
    (c) => c.registryVersion === ctx.registryVersion && evidenceMatches(ctx.assessments, c),
  );
}

export interface ChangeBinding {
  registryVersion: string; assessments: Bound; generation: number; intentRevision: number; candidateDiffHash: string;
}
/** A change correction also needs the same work generation, plan revision and candidate diff. */
export function applicableChangeCorrections(corrections: readonly ChangeTraitCorrection[], ctx: ChangeBinding) {
  return partition(
    corrections.map((c) => ChangeTraitCorrection.parse(c)),
    (c) => c.registryVersion === ctx.registryVersion && evidenceMatches(ctx.assessments, c)
      && c.generation === ctx.generation && c.intentRevision === ctx.intentRevision && c.candidateDiffHash === ctx.candidateDiffHash,
  );
}

// ---- state (16.2.1) ----

type Corrected = readonly { trait: R1Trait; evidenceHash: string; decisionId: string }[];
const exactlyTen = (assessments: readonly { trait: string }[]) =>
  assessments.length === R1_TRAITS.length && new Set(assessments.map((a) => a.trait)).size === R1_TRAITS.length;

/** Each stored correction names one trait once, a decision once, and the evidence that trait's assessment carries. */
function correctionIssues(corrections: Corrected, assessments: Bound): string[] {
  const out: string[] = [];
  if (!unique(corrections.map((c) => c.trait))) out.push("more than one correction for a trait");
  if (!unique(corrections.map((c) => c.decisionId))) out.push("a decision id is used twice");
  if (corrections.some((c) => !evidenceMatches(assessments, c))) out.push("a correction is bound to other evidence");
  return out;
}

type Emptiable = {
  evidenceHash?: string | null; resolutionHash?: string | null; projectTraitHash?: string | null; candidateDiffHash?: string | null;
  assessments: unknown[]; corrections: unknown[];
};
const emptyIssue = (s: Emptiable) =>
  s.evidenceHash != null || s.resolutionHash != null || s.projectTraitHash != null || s.candidateDiffHash != null
  || s.assessments.length > 0 || s.corrections.length > 0
    ? ["unassessed state carries hashes or entries"] : [];

type ProjectShape = {
  status: "unassessed" | "assessed"; registryVersion: string; evidenceHash: string | null; resolutionHash: string | null;
  assessments: ProjectTraitAssessment[]; corrections: ProjectTraitCorrection[];
};
function projectIssues(s: ProjectShape): string[] {
  if (s.status === "unassessed") return emptyIssue(s);
  if (!s.evidenceHash || !s.resolutionHash) return ["assessed state needs evidence and resolution hashes"];
  if (!exactlyTen(s.assessments)) return ["assessed state needs exactly one assessment per R1 trait"];
  const out = correctionIssues(s.corrections, s.assessments);
  if (s.corrections.some((c) => c.registryVersion !== s.registryVersion)) out.push("a correction is bound to another registry version");
  if (out.length) return out;
  try {
    const scope = "project" as const;
    if (s.assessments.some((a) => traitEvidenceHash({ ...a, registryVersion: s.registryVersion, scope }) !== a.evidenceHash)) {
      out.push("an assessment's evidence hash does not match its evidence");
    } else if (projectEvidenceSetHash(s.registryVersion, s.assessments) !== s.evidenceHash) {
      out.push("evidence-set hash does not match the assessments");
    } else if (projectResolutionHash({ ...s, evidenceHash: s.evidenceHash }) !== s.resolutionHash) {
      out.push("resolution hash does not match the assessments and corrections");
    }
  } catch {
    out.push("digests cannot be recomputed from the stored entries"); // a field the schema refuses; its own issue is reported too
  }
  return out;
}

/** `legacyUnverified` is inert history: kept exactly and in order, never a signal, a path or an instruction. */
export const TraitProjectState = z.strictObject({
  status: z.enum(["unassessed", "assessed"]), registryVersion: RegistryVersion,
  evidenceHash: Sha.nullable(), resolutionHash: Sha.nullable(),
  assessments: z.array(ProjectTraitAssessment).max(R1_TRAITS.length), corrections: z.array(ProjectTraitCorrection).max(R1_TRAITS.length),
  legacyUnverified: z.array(z.string().max(MAX_LEGACY_CHARS)).max(MAX_LEGACY),
}).superRefine((s, ctx) => {
  for (const message of projectIssues(s)) ctx.addIssue({ code: "custom", message });
});
export type TraitProjectState = z.infer<typeof TraitProjectState>;

type WorkShape = {
  status: "unassessed" | "assessed"; projectTraitHash: string | null; candidateDiffHash: string | null;
  assessments: ChangeTraitAssessment[]; corrections: ChangeTraitCorrection[];
};
function workIssues(s: WorkShape): string[] {
  if (s.status === "unassessed") return emptyIssue(s);
  if (!s.projectTraitHash || !s.candidateDiffHash) return ["assessed work needs the project trait hash and the candidate diff hash"];
  if (!exactlyTen(s.assessments)) return ["assessed work needs exactly one assessment per R1 trait"];
  const out = correctionIssues(s.corrections, s.assessments);
  if (s.corrections.some((c) => c.candidateDiffHash !== s.candidateDiffHash)) out.push("a correction is bound to another candidate diff");
  return out;
}

/** Null hashes mean "not yet assessed", never "no changes". */
export const TraitWorkState = z.strictObject({
  status: z.enum(["unassessed", "assessed"]), projectTraitHash: Sha.nullable(), candidateDiffHash: Sha.nullable(),
  assessments: z.array(ChangeTraitAssessment).max(R1_TRAITS.length), corrections: z.array(ChangeTraitCorrection).max(R1_TRAITS.length),
}).superRefine((s, ctx) => {
  for (const message of workIssues(s)) ctx.addIssue({ code: "custom", message });
});
export type TraitWorkState = z.infer<typeof TraitWorkState>;

/** The work state does not store its registry version, so its evidence digests are checked against the one the caller holds. */
export function workHashProblems(w: TraitWorkState, registryVersion: string): string[] {
  const scope = "change" as const;
  return w.assessments
    .filter((a) => traitEvidenceHash({ ...a, registryVersion, scope }) !== a.evidenceHash)
    .map((a) => `${a.trait}: evidence hash does not match`);
}

// ---- facts projection and change-only risk (decision 4a-A; Tech Spec 8.2) ----

export interface WorkContext { registryVersion: string; generation: number; intentRevision: number }

function currentCorrections(w: TraitWorkState, ctx: WorkContext): ChangeTraitCorrection[] {
  const binding = { ...ctx, assessments: w.assessments, candidateDiffHash: w.candidateDiffHash! };
  return applicableChangeCorrections(w.corrections, binding).applicable;
}

/**
 * What the facts hash reads from work trait state: the pinned project trait state, the diff, each assessment, and the corrections that
 * currently apply. A correction on the same diff changes this value, so proof made under the old value cannot be reused.
 * No new stored hash.
 */
export function workTraitFacts(w: TraitWorkState, ctx: WorkContext) {
  if (w.status === "unassessed") return { status: "unassessed" } as const;
  return {
    status: "assessed" as const, projectTraitHash: w.projectTraitHash, candidateDiffHash: w.candidateDiffHash,
    assessments: sortedUnique(
      "assessment trait",
      w.assessments.map((a) => ({ trait: a.trait, outcome: a.outcome, evidenceHash: a.evidenceHash, reasonId: a.reasonId })),
      (a) => a.trait,
    ),
    corrections: currentCorrections(w, ctx).map(
      (c) => ({ trait: c.trait, outcome: c.outcome, evidenceHash: c.evidenceHash, decisionId: c.decisionId, at: c.at }),
    ),
  };
}

/** Dimensions a present change trait raises. Mirrors risk.ts TRAIT_RAISES plus auth; the registry owns this once the registry is wired. */
const RAISES: Partial<Record<R1Trait, Dimension[]>> = {
  auth: ["access"], "personal-data": ["sensitive-data"], "external-effects": ["external-effects"],
};

/** Only change traits raise. Project traits keep regression obligations and are not an input here. A correction counts once it applies. */
export function changeTraitRaises(w: TraitWorkState, ctx: WorkContext): Dimension[] {
  if (w.status === "unassessed") return [];
  const outcome = new Map<R1Trait, Outcome>(w.assessments.map((a) => [a.trait, a.outcome]));
  for (const c of currentCorrections(w, ctx)) outcome.set(c.trait, c.outcome);
  const raised = new Set([...outcome].filter(([, o]) => o === "present").flatMap(([t]) => RAISES[t] ?? []));
  return DIMENSIONS.filter((d) => raised.has(d));
}
