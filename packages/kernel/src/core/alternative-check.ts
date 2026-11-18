import type { Receipt } from "./schemas.ts";
import type { State } from "./schemas.ts";
import type { RecipeCoverage, RecipeCoverageRecord } from "../ports/types.ts";
import type { RecipeCoverageCheck } from "../ports/types.ts";
import { z } from "zod";
import { KernelError } from "./errors.ts";
import { sha256, stableStringify } from "./ids.ts";

export interface CoverageApproval {
  mappingHash: string;
  reviewHash: string;
  obligation: string;
  checkInputId: string;
  alternativeCheckInputId: string;
}

export interface CoverageEvidence extends CoverageApproval {
  primaryReceipt: string;
  alternativeReceipt: string;
  primaryStatus?: ResultRecord["status"];
  primaryQualifier?: ResultRecord["qualifier"];
  alternativeStatus?: ResultRecord["status"];
  alternativeQualifier?: ResultRecord["qualifier"];
}

export const COVERAGE_EXT = "checkCoverage.v1";
export const coverageDefinitionHash = (
  check: RecipeCoverageCheck,
  configHash: string,
  fileHash: string,
  supportHashes: Readonly<Record<string, string>> = {},
): string => sha256(stableStringify({ ...check, configHash, fileHash, supportHashes }));
interface ResultRecord {
  role: "primary" | "alternative"; work: string; obligation: string; basisHash: string; checkInput: string;
  mappingHash: string; reviewHash: string; checkHash: string; receipt: string; run: string; attempt: number;
  publication: number; startedAt: string; finishedAt: string;
  status: "pass" | "fail" | "skipped" | "inconclusive"; qualifier: "none" | "flaky"; historyHash: string;
}

interface RelationalState {
  recipe: { mappings: Record<string, {
    id: string; obligation: string; mappingHash: string; reviewHash: string;
  }> };
  bindings: Record<string, {
    work: string; mappingId: string; mappingHash: string; reviewHash: string;
  }>;
  flaky: Record<string, {
    work: string; obligation: string; basisHash: string; checkInput: string;
  }>;
  results: Record<string, ResultRecord>;
}

function validateCoverageState(state: RelationalState, ctx: z.RefinementCtx) {
  const invalid = (message: string) => ctx.addIssue({ code: "custom", message });
  const obligations = Object.values(state.recipe.mappings).map((item) => item.obligation);
  const roles = [...obligations, ...obligations.map((obligation) => `${obligation}-alternative`)];
  if (new Set(roles).size !== roles.length) invalid("coverage primary and alternative roles collide");
  for (const [key, item] of Object.entries(state.recipe.mappings))
    if (key !== item.id) invalid(`coverage mapping key ${key} does not match its id`);
  for (const [key, item] of Object.entries(state.bindings)) {
    const mapped = state.recipe.mappings[item.mappingId];
    if (key !== `${item.work}\u001f${item.mappingId}` || !mapped ||
        mapped.mappingHash !== item.mappingHash || mapped.reviewHash !== item.reviewHash)
      invalid(`coverage binding ${key} does not match its mapping`);
  }
  for (const [key, fact] of Object.entries(state.flaky)) {
    const mapped = Object.values(state.recipe.mappings).find((item) => item.obligation === fact.obligation);
    const bound = mapped && state.bindings[`${fact.work}\u001f${mapped.id}`];
    if (key !== `${fact.work}\u001f${fact.obligation}\u001f${fact.basisHash}\u001f${fact.checkInput}` || !bound)
      invalid(`flaky coverage key ${key} does not match its record`);
  }
  for (const [key, item] of Object.entries(state.results)) {
    const mapped = state.recipe.mappings[Object.keys(state.recipe.mappings).find(
      (name) => state.recipe.mappings[name]!.obligation === item.obligation
    ) ?? ""];
    const expected = `${item.work}\u001f${item.obligation}\u001f${item.checkInput}\u001f${item.role}`;
    const bound = mapped && state.bindings[`${item.work}\u001f${mapped.id}`];
    if (key !== expected || !mapped || !bound || mapped.mappingHash !== item.mappingHash ||
        mapped.reviewHash !== item.reviewHash || bound.mappingHash !== item.mappingHash ||
        bound.reviewHash !== item.reviewHash)
      invalid(`coverage result ${key} does not match its role or mapping`);
  }
}

function buildCoverageState() {
  const hash = z.string().regex(/^[a-f0-9]{64}$/);
  const id = z.string().regex(/^[A-Za-z0-9._-]{1,64}$/);
  const relativePath = z.string().min(1).max(300).refine(
    (value) => !value.includes("\0") && !value.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(value) &&
      value.split(/[\\/]/).every((part) => part && part !== "." && part !== ".."),
    "coverage path must stay relative to the recipe",
  );
  const check = z.strictObject({
    tool: z.enum(["vitest", "playwright"]), config: relativePath, file: relativePath,
    tag: z.string().regex(/^COV-[a-z0-9-]{1,48}$/), support: z.array(relativePath).max(1000),
  });
  const mapping = z.strictObject({
    id, obligation: z.string().regex(/^OB-[A-Za-z0-9._-]{1,64}$/),
    mappingHash: hash, reviewHash: hash,
    reviewReservation: z.string().regex(/^[A-Za-z0-9._-]{1,120}$/),
    reviewManifestHash: hash, primaryDefinitionHash: hash, alternativeDefinitionHash: hash,
    primary: check, alternative: check,
  });
  const binding = z.strictObject({
    work: z.string().regex(/^W-\d+$/).max(32),
    basisHash: hash, mappingId: id, mappingHash: hash, reviewHash: hash, boundAt: z.string().max(64),
  });
  const flaky = z.strictObject({
    work: z.string().regex(/^W-\d+$/).max(32),
    obligation: z.string().regex(/^OB-[A-Za-z0-9._-]{1,64}$/),
    basisHash: hash, checkInput: z.string().regex(/^[a-f0-9]{24}$/),
    receipt: z.string().max(120), run: z.string().max(120),
    publication: z.number().int().positive(), firstFailedAt: z.string().max(64), historyHash: hash,
  });
  const result = z.strictObject({
    role: z.enum(["primary", "alternative"]), work: z.string().regex(/^W-\d+$/).max(32),
    obligation: z.string().regex(/^OB-[A-Za-z0-9._-]{1,64}$/), basisHash: hash,
    checkInput: z.string().regex(/^[a-f0-9]{24}$/), mappingHash: hash, reviewHash: hash, checkHash: hash,
    receipt: z.string().max(120), run: z.string().max(120),
    attempt: z.number().int().min(1).max(3), publication: z.number().int().positive(),
    startedAt: z.string().max(64), finishedAt: z.string().max(64),
    status: z.enum(["pass", "fail", "skipped", "inconclusive"]), qualifier: z.enum(["none", "flaky"]),
    historyHash: hash,
  });
  const records = <T extends z.ZodType>(schema: T) => z.record(z.string(), schema);
  return z.strictObject({
    version: z.literal(1),
    recipe: z.strictObject({ mappings: records(mapping).superRefine((rows, ctx) => {
      if (Object.keys(rows).length > 8) ctx.addIssue({ code: "custom", message: "at most 8 mappings" });
    }) }),
    bindings: records(binding).superRefine((rows, ctx) => {
      if (Object.keys(rows).length > 32) ctx.addIssue({ code: "custom", message: "at most 32 basis bindings" });
    }),
    flaky: records(flaky).superRefine((rows, ctx) => {
      if (Object.keys(rows).length > 32) ctx.addIssue({ code: "custom", message: "at most 32 flaky facts" });
    }),
    results: records(result).superRefine((rows, ctx) => {
      if (Object.keys(rows).length > 32) ctx.addIssue({ code: "custom", message: "at most 32 coverage results" });
    }),
  }).superRefine(validateCoverageState);
}
export const CoverageState = z.lazy(buildCoverageState);
export type CoverageState = z.infer<ReturnType<typeof buildCoverageState>>;

const emptyCoverage = (): CoverageState => ({
  version: 1, recipe: { mappings: {} }, bindings: {}, flaky: {}, results: {},
});

export function readCoverageState(state: State): CoverageState {
  const raw = state._ext?.[COVERAGE_EXT];
  if (raw === undefined) return emptyCoverage();
  const parsed = CoverageState.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.slice(0, 3).map((issue) =>
      `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new KernelError("unsupported-record", `coverage state is invalid or unsupported (${errors})`, { exit: 4 });
  }
  return parsed.data;
}

function withCoverageState(state: State, coverage: CoverageState): State {
  return {
    ...state,
    _ext: { ...(state._ext ?? {}), [COVERAGE_EXT]: coverage },
  };
}

/** Stores only reviewed hashes and closed runner definitions; recipe prose and review text stay in the plugin payload. */
export function installRecipeCoverage(state: State, coverage: readonly (RecipeCoverageRecord | RecipeCoverage)[]): State {
  if (!coverage.length) return state;
  const current = readCoverageState(state), mappings = { ...current.recipe.mappings };
  for (const mapping of coverage) {
    const review = "review" in mapping ? mapping.review : undefined;
    const reviewReservation = "reviewReservation" in mapping ? mapping.reviewReservation : review?.reservation;
    const reviewManifestHash = "reviewManifestHash" in mapping ? mapping.reviewManifestHash : review?.manifestHash;
    if (!reviewReservation || !reviewManifestHash)
      throw new KernelError("adapter-unsupported-config", "coverage mapping lacks its reviewed identity", { exit: 2 });
    const next = {
      id: mapping.id,
      obligation: mapping.obligation,
      mappingHash: mapping.mappingHash,
      reviewHash: mapping.reviewHash,
      reviewReservation,
      reviewManifestHash,
      primaryDefinitionHash: mapping.primaryDefinitionHash,
      alternativeDefinitionHash: mapping.alternativeDefinitionHash,
      primary: mapping.primary,
      alternative: mapping.alternative,
    };
    const prior = mappings[mapping.id];
    if (prior && stableStringify(prior) !== stableStringify(next)) {
      throw new KernelError("adapter-unsupported-config", `coverage mapping ${mapping.id} differs from the pinned recipe`, { exit: 2 });
    }
    mappings[mapping.id] = next;
  }
  if (Object.keys(mappings).length > 8) {
    throw new KernelError("adapter-unsupported-config", "at most 8 coverage mappings are admitted per recipe", { exit: 2 });
  }
  return withCoverageState(state, { ...current, recipe: { mappings } });
}

/** Binds every admitted mapping to the accepted basis without evicting earlier work. */
export function bindRecipeCoverage(state: State, work: string, basisHash: string, boundAt?: string): State {
  const current = readCoverageState(state), bindings = { ...current.bindings };
  if (!Object.keys(current.recipe.mappings).length) return state;
  const at = boundAt ?? state.work[work]?.updatedAt;
  if (!at) throw new KernelError("evidence-inconclusive", "coverage binding needs the current work timestamp", { exit: 2 });
  for (const mapping of Object.values(current.recipe.mappings)) {
    const key = `${work}\u001f${mapping.id}`;
    const next = {
      work, basisHash, mappingId: mapping.id, mappingHash: mapping.mappingHash,
      reviewHash: mapping.reviewHash, boundAt: at,
    };
    const prior = bindings[key];
    if (prior && stableStringify(prior) !== stableStringify(next)) bindings[key] = next;
    else if (!prior) bindings[key] = next;
  }
  if (Object.keys(bindings).length > 32) {
    throw new KernelError(
      "evidence-inconclusive",
      "coverage evidence capacity reached: at most 32 basis bindings",
      { exit: 2 },
    );
  }
  return withCoverageState(state, { ...current, bindings });
}

/** Only mappings approved for this work's current basis are executable. */
export function boundRecipeCoverage(state: State, work: string, basisHash: string): RecipeCoverageRecord[] {
  const coverage = readCoverageState(state);
  return Object.values(coverage.recipe.mappings).filter((mapping) => {
    const binding = coverage.bindings[`${work}\u001f${mapping.id}`];
    return binding?.basisHash === basisHash &&
      binding.mappingHash === mapping.mappingHash &&
      binding.reviewHash === mapping.reviewHash;
  }) as RecipeCoverageRecord[];
}


function roleReceiptMatches(
  result: ResultRecord,
  mapping: RecipeCoverageRecord,
  receipt: Receipt | undefined,
  receipts: readonly Receipt[],
): boolean {
  const obligation = result.role === "alternative" ? `${result.obligation}-alternative` : result.obligation;
  const hasCurrent = receipts.some((candidate) =>
    candidate.obligation === obligation &&
    candidate.stage !== "baseline" &&
    candidate.checkInputId === result.checkInput
  );
  return (!hasCurrent || !!receipt) &&
    (!receipt || result.receipt === receipt.id) &&
    result.mappingHash === mapping.mappingHash &&
    result.reviewHash === mapping.reviewHash &&
    (!receipt || result.status === receipt.status) &&
    (!receipt || result.qualifier === (receipt.qualifiers.includes("flaky") ? "flaky" : "none")) &&
    (!receipt || result.checkHash === sha256(stableStringify({
      argv: receipt.argv, candidate: receipt.candidate,
      checkInput: receipt.checkInputId, versions: receipt.versions,
    })));
}

function coveragePair(
  results: Readonly<Record<string, ResultRecord>>,
  mapping: RecipeCoverageRecord,
  work: string,
  basisHash: string,
  receipts: readonly Receipt[],
  checkInputId?: string,
): { approval: CoverageApproval; evidence: CoverageEvidence } | null {
  const primaryRecord = Object.values(results)
    .filter((record) => record.work === work && record.obligation === mapping.obligation &&
      record.role === "primary" && record.mappingHash === mapping.mappingHash &&
      record.basisHash === basisHash && (!checkInputId || record.checkInput === checkInputId))
    .sort((a, b) => b.publication - a.publication)[0];
  if (!primaryRecord) return null;
  const alternativeRecord =
    results[`${work}\u001f${mapping.obligation}\u001f${primaryRecord.checkInput}\u001falternative`];
  if (!alternativeRecord) return null;
  const primary = receipts.find((receipt) => receipt.id === primaryRecord.receipt);
  const alternative = receipts.find((receipt) => receipt.id === alternativeRecord.receipt);
  if (!roleReceiptMatches(primaryRecord, mapping, primary, receipts) ||
      !roleReceiptMatches(alternativeRecord, mapping, alternative, receipts)) return null;
  const approval = {
    mappingHash: mapping.mappingHash,
    reviewHash: mapping.reviewHash,
    obligation: mapping.obligation,
    checkInputId: primaryRecord.checkInput,
    alternativeCheckInputId: alternativeRecord.checkInput,
  };
  return {
    approval,
    evidence: {
      ...approval,
      primaryReceipt: primaryRecord.receipt,
      alternativeReceipt: alternativeRecord.receipt,
      primaryStatus: primaryRecord.status,
      primaryQualifier: primaryRecord.qualifier,
      alternativeStatus: alternativeRecord.status,
      alternativeQualifier: alternativeRecord.qualifier,
    },
  };
}

export function coverageEvidenceForReceipts(
  state: State,
  work: string,
  basisHash: string,
  receipts: readonly Receipt[],
  checkInputId?: string,
): { approval: CoverageApproval[]; evidence: CoverageEvidence[] } {
  const approval: CoverageApproval[] = [], evidence: CoverageEvidence[] = [];
  const results = readCoverageState(state).results;
  for (const mapping of boundRecipeCoverage(state, work, basisHash)) {
    const pair = coveragePair(results, mapping, work, basisHash, receipts, checkInputId);
    if (!pair) continue;
    approval.push(pair.approval);
    evidence.push(pair.evidence);
  }
  return { approval, evidence };
}

export function recordCoverageReceipts(
  state: State,
  work: string,
  basisHash: string,
  receipts: readonly Receipt[],
  publication: number,
  finishedAt: string,
): { state: State; receipts: Receipt[] } {
  let coverage = readCoverageState(state);
  if (!Object.keys(coverage.recipe.mappings).length) return { state, receipts: [...receipts] };
  const results = { ...coverage.results }, flaky = { ...coverage.flaky };
  let finalReceipts = [...receipts];
  for (const mapping of boundRecipeCoverage(state, work, basisHash)) {
    const primary = receipts.find((receipt) => receipt.obligation === mapping.obligation);
    if (!primary) continue;
    const roles = [
      { role: "primary" as const, receipt: primary },
      ...((receipt: Receipt | undefined) => receipt ? [{ role: "alternative" as const, receipt }] : [])(
        receipts.find((candidate) => candidate.obligation === `${mapping.obligation}-alternative`)
      ),
    ];
    const flakyKey = `${work}\u001f${mapping.obligation}\u001f${basisHash}\u001f${primary.checkInputId}`;
    const needsFlaky = primary.qualifiers.includes("flaky") && !flaky[flakyKey];
    if (needsFlaky && Object.keys(flaky).length >= 32) {
      finalReceipts = markCoverageInconclusive(finalReceipts, primary);
      continue;
    }
    const newResults = roles.filter((item) =>
      !results[`${work}\u001f${mapping.obligation}\u001f${primary.checkInputId}\u001f${item.role}`]
    ).length;
    if (Object.keys(results).length + newResults > 32) {
      finalReceipts = markCoverageInconclusive(finalReceipts, roles[1]?.receipt ?? primary);
      continue;
    }
    for (const item of roles) {
      const key = `${work}\u001f${mapping.obligation}\u001f${primary.checkInputId}\u001f${item.role}`;
      const previous = results[key];
      const next = { ...coverageResult(mapping, item, primary, basisHash, publication, finishedAt), work };
      if (previous && previous.publication > publication) continue;
      if (previous?.publication === publication && stableStringify(previous) !== stableStringify(next)) {
        finalReceipts = markCoverageInconclusive(finalReceipts, item.receipt);
        continue;
      }
      if (previous?.publication === publication) continue;
      results[key] = next;
    }
    if (needsFlaky) {
      if (!flaky[flakyKey]) {
        flaky[flakyKey] = {
          work, obligation: mapping.obligation, checkInput: primary.checkInputId,
          basisHash,
          receipt: primary.id, run: primary.provenance.runId, publication,
          firstFailedAt: primary.history?.[0]?.at ?? primary.provenance.startedAt,
          historyHash: sha256(stableStringify(primary.history ?? [])),
        };
      }
    }
  }
  coverage = { ...coverage, flaky, results };
  return { state: withCoverageState(state, coverage), receipts: finalReceipts };
}

function markCoverageInconclusive(receipts: readonly Receipt[], receipt: Receipt): Receipt[] {
  return receipts.map((candidate) => candidate.id === receipt.id ? {
    ...candidate,
    status: "inconclusive",
    reasons: [...candidate.reasons, "evidence-inconclusive"],
    limitations: [...candidate.limitations, "coverage evidence capacity was reached; no older record was evicted"],
  } : candidate);
}

function coverageResult(
  mapping: RecipeCoverageRecord,
  item: { role: "primary" | "alternative"; receipt: Receipt },
  primary: Receipt,
  basisHash: string,
  publication: number,
  finishedAt: string,
): ResultRecord {
  return {
    role: item.role, work: "", obligation: mapping.obligation, basisHash,
    checkInput: primary.checkInputId,
    mappingHash: mapping.mappingHash, reviewHash: mapping.reviewHash,
    checkHash: sha256(stableStringify({
      argv: item.receipt.argv, candidate: item.receipt.candidate,
      checkInput: item.receipt.checkInputId, versions: item.receipt.versions,
    })),
    receipt: item.receipt.id, run: item.receipt.provenance.runId,
    attempt: Math.max(1, item.receipt.history?.length ?? 1), publication,
    startedAt: item.receipt.provenance.startedAt, finishedAt,
    status: item.receipt.status,
    qualifier: item.receipt.qualifiers.includes("flaky") ? "flaky" : "none",
    historyHash: sha256(stableStringify(item.receipt.history ?? [])),
  };
}

/** A clean later same-input receipt cannot erase a sticky same-input flaky fact. */
export function stickyCoverageReceipts(
  state: State,
  work: string,
  basisHash: string,
  receipts: readonly Receipt[],
): Receipt[] {
  const sticky = readCoverageState(state).flaky;
  return receipts.map((receipt) => {
    const key = `${work}\u001f${receipt.obligation}\u001f${basisHash}\u001f${receipt.checkInputId}`;
    if (!sticky[key] || receipt.status !== "pass" || receipt.qualifiers.includes("flaky")) return receipt;
    return {
      ...receipt,
      qualifiers: [...receipt.qualifiers, "flaky"],
      limitations: [
        ...receipt.limitations,
        "the same inputs previously produced a flaky required check",
      ],
    };
  });
}

const cleanAlternative = (receipt: Receipt | undefined, primary: Receipt, approval: CoverageApproval): boolean =>
  !!receipt &&
  receipt.status === "pass" &&
  receipt.checkInputId === approval.alternativeCheckInputId &&
  !receipt.qualifiers.includes("flaky") &&
  receipt.scope === "full" &&
  receipt.stage !== "baseline" &&
  receipt.candidate === primary.candidate;

/** Which receipt IDs a validated coverage binding and its matching fresh receipts permit to satisfy an obligation. */
export function coveredReceiptIds(
  receipts: readonly Receipt[],
  approvals: readonly CoverageApproval[] = [],
  evidence: readonly CoverageEvidence[] = [],
): ReadonlySet<string> {
  const covered = new Set<string>();
  for (const item of evidence) {
    const approval = approvals.find((a) =>
      a.mappingHash === item.mappingHash &&
      a.reviewHash === item.reviewHash &&
      a.obligation === item.obligation &&
      a.checkInputId === item.checkInputId
    );
    if (!approval) continue;
    const primary = receipts.find((r) => r.id === item.primaryReceipt);
    if (
      !primary ||
      primary.obligation !== item.obligation ||
      primary.checkInputId !== item.checkInputId ||
      primary.stage === "baseline" ||
      primary.scope !== "full" ||
      primary.status !== "pass" ||
      !primary.qualifiers.includes("flaky")
    ) continue;
    const alternative = receipts.find((r) => r.id === item.alternativeReceipt);
    if (cleanAlternative(alternative, primary, approval)) covered.add(primary.id);
  }
  return covered;
}

export function coveredObligationIds(
  receipts: readonly Receipt[],
  approvals: readonly CoverageApproval[] = [],
  evidence: readonly CoverageEvidence[] = [],
): ReadonlySet<string> {
  return new Set(evidence.flatMap((item) => {
    const approved = approvals.some((approval) =>
      approval.mappingHash === item.mappingHash &&
      approval.reviewHash === item.reviewHash &&
      approval.obligation === item.obligation &&
      approval.checkInputId === item.checkInputId &&
      approval.alternativeCheckInputId === item.alternativeCheckInputId
    );
    const primary = receipts.find((receipt) => receipt.id === item.primaryReceipt);
    const alternative = receipts.find((receipt) => receipt.id === item.alternativeReceipt);
    const primaryPasses = primary
      ? primary.status === "pass" && primary.qualifiers.includes("flaky") &&
        primary.checkInputId === item.checkInputId
      : item.primaryStatus === "pass" && item.primaryQualifier === "flaky";
    const alternativePasses = alternative
      ? alternative.status === "pass" && !alternative.qualifiers.includes("flaky") &&
        alternative.checkInputId === item.alternativeCheckInputId &&
        (!primary || alternative.candidate === primary.candidate)
      : item.alternativeStatus === "pass" && item.alternativeQualifier === "none";
    return approved && primaryPasses && alternativePasses ? [item.obligation] : [];
  }));
}

export function coveredCoverageEvidence(
  receipts: readonly Receipt[],
  approvals: readonly CoverageApproval[],
  evidence: readonly CoverageEvidence[],
): CoverageEvidence[] {
  const obligations = coveredObligationIds(receipts, approvals, evidence);
  return evidence.filter((item) => obligations.has(item.obligation));
}
