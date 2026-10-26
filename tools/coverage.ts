// Traceability (plan §12.1, TS §19.4): Requirement → fixture → tier → milestone. Structure only: it fails when a Must in
// the milestone has neither a T1 fixture nor an honest reason to need the real host. A green report is necessary, not
// sufficient; a person still confirms the fixture proves the requirement.
//
//   node tools/coverage.ts [--milestone M0|A|B|R1]
//
// A fixture is a test whose title carries the requirement ID in brackets: it("...", ...) → "... [TDD-01]".
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { QualificationTuple } from "../packages/eval/src/tuple.ts";
import { REASONS } from "../packages/kernel/src/core/reasons.ts";
import { KERNEL_VERSION } from "../packages/kernel/src/version.ts";

const ORDER = ["M0", "A", "B", "R1"];
const ROW = /^\| ([A-Z]{2,4}-\d+[a-z]?) \| (.*?) \| (Must|Should|Could|May) \| (M0|A|B|R1|R1\.1|Later) \|\s*([^|]*?)\s*\|$/;

export interface Requirement { id: string; text: string; level: string; milestone: string; acs: string[] }
export interface EvidenceStatus {
  id: string; mapping: "mapped" | "host-only" | "unmapped"; disposition: "unreviewed" | "partial" | "complete";
  uncoveredAcIds: string[]; evidenceTiers: string[];
  evidenceRefs: Array<{ kind: string; tier: string; path: string; sha256: string; acIds: string[]; outcome: string }>;
  campaignRef: { campaignId: string; path: string; sha256: string } | null;
  qualificationBinding: { tuple: Record<string, unknown>; artifactSha256: string } | null;
  qualification: "not-qualified" | "qualified";
}
export interface Report {
  covered: Array<{ id: string; tests: number }>; hostOnly: Requirement[]; unreachable: Requirement[]; unmapped: Requirement[];
  reasonCodes: { referenced: number; total: number }; tooLong: Array<{ file: string; lines: number }>;
  evidence: EvidenceStatus[]; integrityErrors: string[];
}

const Hash = z.string().regex(/^[a-f0-9]{64}$/);
const Tier = z.enum(["T1", "T2", "T3", "T4"]);
const Disposition = z.enum(["partial", "complete"]);
const QualificationStatus = z.enum(["not-qualified", "qualified"]);
const EvidenceRef = z.object({
  kind: z.enum(["test", "review", "observation", "campaign"]), tier: Tier, path: z.string().min(1), sha256: Hash,
  acIds: z.array(z.string()).min(1), outcome: z.enum(["pass", "partial", "fail", "inconclusive"]),
}).strict();
const CampaignRef = z.object({ campaignId: z.string().min(1), path: z.string().min(1), sha256: Hash }).strict();
const CampaignManifest = z.object({
  schemaVersion: z.literal(1), campaignId: z.string().regex(/^[A-Za-z0-9._-]+$/), protocolVersion: z.string().min(1),
  protocolPath: z.string().min(1), protocolCommit: z.string().regex(/^[a-f0-9]{40,64}$/),
  campaignDate: z.string().datetime({ offset: true }), campaignResult: z.enum(["passed", "failed", "inconclusive"]),
  qualificationTuple: QualificationTuple, tenetVersion: z.string().min(1), artifactSha256: Hash, observedModel: z.string().min(1),
  scope: z.object({ milestone: z.enum(["M0", "A", "B", "R1"]), requirementIds: z.array(z.string()), acIds: z.array(z.string()) }).strict(),
  outcomes: z.array(z.object({ requirementId: z.string(), result: z.enum(["passed", "failed", "inconclusive"]), evidenceRefs: z.array(EvidenceRef) }).strict()),
}).strict();
const Change = z.object({
  requirementId: z.string().min(1), fromDisposition: Disposition.nullable(), toDisposition: Disposition,
  fromQualificationStatus: QualificationStatus.nullable(), toQualificationStatus: QualificationStatus,
  fromUncoveredAcIds: z.array(z.string()), toUncoveredAcIds: z.array(z.string()), reason: z.string().min(1),
  reviewer: z.string().min(1), reviewedAt: z.string().datetime({ offset: true }), ownerApprovalRef: z.string().min(1),
  evidenceRefs: z.array(EvidenceRef),
}).strict();
const LedgerRecord = z.object({
  requirementId: z.string().min(1), disposition: Disposition, uncoveredAcIds: z.array(z.string()),
  evidenceRefs: z.array(EvidenceRef), reviewer: z.string().min(1), reviewedAt: z.string().datetime({ offset: true }),
  reason: z.string().min(1), ownerApprovalRef: z.string().min(1),
  qualificationStatus: QualificationStatus, campaignRef: CampaignRef.nullable(), changeHistory: z.array(Change).min(1),
}).strict();
const Ledger = z.object({ schemaVersion: z.literal(1), records: z.array(LedgerRecord) }).strict();
type ValidatedCampaign = { evidenceRefs: z.infer<typeof EvidenceRef>[]; binding: { tuple: Record<string, unknown>; artifactSha256: string } | null };
type ParsedLedgerRecord = z.infer<typeof LedgerRecord> & { campaign: ValidatedCampaign };

/** Requirements that are agent behavior or host mechanics: there is nothing for the kernel to assert, so only T3 can show them. */
const HOST_BY_NATURE: Record<string, string> = {
  "INT-01": "the agent inspects the repository before asking (golden tasks)",
  "SEC-01": "native permission requests and their explanations (host)",
};

export const parsePrd = (text: string): Requirement[] =>
  text.split(/\r?\n/).flatMap((l) => {
    const m = ROW.exec(l);
    return m ? [{ id: m[1]!, text: m[2]!, level: m[3]!, milestone: m[4]!, acs: m[5]!.split(",").map((s) => s.trim()).filter(Boolean) }] : [];
  });

/** AC tiers from the tech spec's acceptance-suite mapping: `| AC-01 | T3 | ... |` and grouped rows. */
export function acTiers(techSpec: string): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const l of techSpec.split(/\r?\n/)) {
    const m = /^\| (AC-[^|]+) \| (T[0-9][^|]*?) \|/.exec(l);
    if (!m) continue;
    const tiers = m[2]!.match(/T\d/g) ?? [];
    for (const raw of m[1]!.split(",").map((s) => s.trim())) {
      const range = /^AC-(\d+)([a-z]?)[–-]([a-z])$/.exec(raw); // AC-15a–c
      if (range) { for (let c = range[2]!.charCodeAt(0); c <= range[3]!.charCodeAt(0); c++) out.set(`AC-${range[1]}${String.fromCharCode(c)}`, tiers); continue; }
      out.set(raw, tiers);
    }
  }
  return out;
}

const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? (f === "node_modules" ? [] : walk(p)) : p.endsWith(".test.ts") ? [p] : [];
});

/** Requirement IDs tagged on test titles, with how many tests carry each. */
export function taggedTests(files: Record<string, string>): Map<string, number> {
  const out = new Map<string, number>();
  for (const text of Object.values(files)) {
    for (const t of text.matchAll(/\b(?:it|describe)\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g)) {
      for (const tag of (t[1] ?? t[2] ?? t[3] ?? "").matchAll(/\[([A-Z]{2,4}-\d+[a-z]?(?:,\s*[A-Z]{2,4}-\d+[a-z]?)*)\]/g)) {
        for (const id of tag[1]!.split(",").map((s) => s.trim())) out.set(id, (out.get(id) ?? 0) + 1);
      }
    }
  }
  return out;
}

export function report(root: string, milestone: string): Report {
  const integrityErrors: string[] = [];
  const prdText = readFileSync(join(root, "specs/PRD.md"), "utf8");
  for (const line of prdText.split(/\r?\n/)) {
    if (line.startsWith("|") && /\|\s*(Must|Should|Could|May)\s*\|/.test(line) && !ROW.test(line)) {
      integrityErrors.push(`malformed PRD requirement row: ${line.trim()}`);
    }
  }
  const parsedRequirements = parsePrd(prdText);
  const seen = new Set<string>();
  const allRequirements = parsedRequirements.filter((requirement) => {
    if (seen.has(requirement.id)) { integrityErrors.push(`duplicate PRD requirement ID ${requirement.id}`); return false; }
    seen.add(requirement.id);
    return true;
  });
  const requestedOrder = ORDER.indexOf(milestone);
  if (requestedOrder < 0) integrityErrors.push(`unknown milestone ${milestone}`);
  const reqs = allRequirements.filter((r) => r.level === "Must" && ORDER.indexOf(r.milestone) >= 0 && ORDER.indexOf(r.milestone) <= requestedOrder);
  const tiers = acTiers(readFileSync(join(root, "specs/tech-spec.md"), "utf8"));
  const files = Object.fromEntries(walk(join(root, "packages")).map((f) => [f, readFileSync(f, "utf8")]));
  const tagged = taggedTests(files);
  const covered: Report["covered"] = [], hostOnly: Requirement[] = [], unreachable: Requirement[] = [], unmapped: Requirement[] = [];
  const ledger = readLedger(root, allRequirements, integrityErrors);
  const evidence: EvidenceStatus[] = [];
  for (const r of reqs) {
    let mapping: EvidenceStatus["mapping"];
    if (tagged.has(r.id)) { covered.push({ id: r.id, tests: tagged.get(r.id)! }); mapping = "mapped"; }
    else if (HOST_BY_NATURE[r.id]) { hostOnly.push(r); mapping = "host-only"; }
    else {
      const t1Capable = r.acs.length === 0 || r.acs.some((ac) => !tiers.has(ac) || tiers.get(ac)!.includes("T1"));
      (t1Capable ? unmapped : hostOnly).push(r);
      mapping = t1Capable ? "unmapped" : "host-only";
    }
    const record = ledger.get(r.id);
    evidence.push({ id: r.id, mapping, disposition: record?.disposition ?? "unreviewed",
      uncoveredAcIds: record?.uncoveredAcIds ?? [],
      evidenceTiers: [...new Set([...(record?.evidenceRefs.map((ref) => ref.tier) ?? []), ...(record?.campaign.evidenceRefs.map((ref) => ref.tier) ?? [])])].sort(),
      evidenceRefs: [...(record?.evidenceRefs ?? []), ...(record?.campaign.evidenceRefs ?? [])], campaignRef: record?.campaignRef ?? null,
      qualificationBinding: record?.campaign.binding ?? null,
      qualification: record?.qualificationStatus === "qualified" ? "qualified" : "not-qualified" });
  }
  const all = Object.values(files).join("\n");
  const referenced = Object.keys(REASONS).filter((c) => new RegExp(`["'\`]${c}["'\`]`).test(all)).length;
  return { covered, hostOnly, unreachable, unmapped, reasonCodes: { referenced, total: Object.keys(REASONS).length }, tooLong: tooLong(root), evidence, integrityErrors };
}

function readLedger(root: string, requirements: Requirement[], errors: string[]): Map<string, ParsedLedgerRecord> {
  const path = "docs/audits/evidence-ledger.json";
  if (!existsSync(join(root, path))) return new Map();
  const bytes = readRepositoryFile(root, path, "evidence-ledger.json", errors);
  if (!bytes) return new Map();
  let raw: unknown;
  try { raw = JSON.parse(bytes.toString("utf8")); }
  catch { errors.push("evidence-ledger.json is not valid JSON"); return new Map(); }
  const parsed = Ledger.safeParse(raw);
  if (!parsed.success) {
    errors.push(`evidence-ledger.json schema: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`);
    return new Map();
  }
  const byId = new Map(requirements.map((requirement) => [requirement.id, requirement]));
  const records = new Map<string, ParsedLedgerRecord>();
  for (const record of parsed.data.records) {
    const requirement = byId.get(record.requirementId);
    if (!requirement) { errors.push(`evidence-ledger.json: unknown requirement ${record.requirementId}`); continue; }
    if (requirement.level !== "Must") { errors.push(`evidence-ledger.json: ${record.requirementId} is not a Must requirement`); continue; }
    if (records.has(record.requirementId)) { errors.push(`evidence-ledger.json: duplicate requirement ${record.requirementId}`); continue; }
    const campaign = validateRecord(root, record, requirement, errors);
    if (campaign) records.set(record.requirementId, { ...record, campaign });
  }
  return records;
}

function validateRecord(root: string, record: z.infer<typeof LedgerRecord>, requirement: Requirement, errors: string[]): ValidatedCampaign | undefined {
  const start = errors.length;
  const acs = new Set(requirement.acs);
  const uncovered = new Set(record.uncoveredAcIds);
  const checkAcIds = (ids: string[], label: string) => {
    if (new Set(ids).size !== ids.length) errors.push(`${requirement.id}: duplicate AC ID in ${label}`);
    for (const id of ids) if (!acs.has(id)) errors.push(`${requirement.id}: stale AC reference ${id} in ${label}`);
  };
  const checkRefs = (refs: Array<z.infer<typeof EvidenceRef>>, label: string) => {
    for (const [index, ref] of refs.entries()) {
      checkAcIds(ref.acIds, `${label}[${index}]`);
      readHashedFile(root, ref.path, ref.sha256, `${requirement.id}: ${label}[${index}]`, errors);
    }
  };
  checkAcIds(record.uncoveredAcIds, "uncoveredAcIds");
  checkRefs(record.evidenceRefs, "evidenceRefs");
  for (const [index, event] of record.changeHistory.entries()) {
    if (event.requirementId !== record.requirementId) errors.push(`${requirement.id}: changeHistory[${index}] requirement ID mismatch`);
    checkAcIds(event.fromUncoveredAcIds, `changeHistory[${index}].fromUncoveredAcIds`);
    checkAcIds(event.toUncoveredAcIds, `changeHistory[${index}].toUncoveredAcIds`);
    checkRefs(event.evidenceRefs, `changeHistory[${index}].evidenceRefs`);
    if (index === 0 && (event.fromDisposition !== null || event.fromQualificationStatus !== null)) {
      errors.push(`${requirement.id}: first change must start from null`);
    }
    if (index > 0) {
      const previous = record.changeHistory[index - 1]!;
      if (event.fromDisposition !== previous.toDisposition || event.fromQualificationStatus !== previous.toQualificationStatus
        || JSON.stringify(event.fromUncoveredAcIds) !== JSON.stringify(previous.toUncoveredAcIds)) {
        errors.push(`${requirement.id}: broken changeHistory transition at ${index}`);
      }
    }
  }
  const last = record.changeHistory.at(-1);
  if (!last || last.toDisposition !== record.disposition || last.toQualificationStatus !== record.qualificationStatus
    || JSON.stringify(last.toUncoveredAcIds) !== JSON.stringify(record.uncoveredAcIds)
    || last.reviewer !== record.reviewer || last.reviewedAt !== record.reviewedAt || last.reason !== record.reason
    || last.ownerApprovalRef !== record.ownerApprovalRef || JSON.stringify(last.evidenceRefs) !== JSON.stringify(record.evidenceRefs)) {
    errors.push(`${requirement.id}: final changeHistory event does not match the current record, including qualification history`);
  }
  if (record.disposition === "partial" && (!record.uncoveredAcIds.length || record.uncoveredAcIds.length === requirement.acs.length)) {
    errors.push(`${requirement.id}: partial disposition requires covered and uncovered ACs`);
  }
  if (record.disposition === "complete" && record.uncoveredAcIds.length) errors.push(`${requirement.id}: complete disposition must have no uncovered ACs`);
  if (record.disposition === "complete" && requirement.acs.some((id) => !record.evidenceRefs.some((ref) => ref.acIds.includes(id)))) {
    errors.push(`${requirement.id}: complete disposition lacks evidence for one or more ACs`);
  }
  if (record.disposition === "partial" && requirement.acs.some((id) => !uncovered.has(id) && !record.evidenceRefs.some((ref) => ref.acIds.includes(id)))) {
    errors.push(`${requirement.id}: partial disposition lacks evidence for a covered AC`);
  }
  let campaign: ValidatedCampaign = { evidenceRefs: [], binding: null };
  if (record.qualificationStatus === "qualified") {
    if (record.disposition !== "complete" || record.uncoveredAcIds.length) errors.push(`${requirement.id}: qualification requires a complete disposition`);
  }
  if (record.campaignRef || record.qualificationStatus === "qualified") {
    campaign = validateCampaign(root, record.campaignRef, requirement, errors, record.qualificationStatus === "qualified");
  }
  return errors.length === start ? campaign : undefined;
}

function readHashedFile(root: string, path: string, expectedHash: string, label: string, errors: string[]): Buffer | undefined {
  const bytes = readRepositoryFile(root, path, label, errors);
  if (!bytes) return undefined;
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) {
    errors.push(`${label}: hash mismatch for ${path}`);
    return undefined;
  }
  return bytes;
}

function readRepositoryFile(root: string, path: string, label: string, errors: string[]): Buffer | undefined {
  const resolved = resolve(root, path);
  if (!path || isAbsolute(path) || relative(root, resolved).startsWith("..")) {
    errors.push(`${label}: path escapes repository`);
    return undefined;
  }
  if (!existsSync(resolved)) { errors.push(`${label}: missing file ${path}`); return undefined; }
  let bytes: Buffer;
  try {
    const actualPath = realpathSync(resolved);
    const actualRelative = relative(realpathSync(root), actualPath);
    if (actualRelative === ".." || actualRelative.startsWith(`..${sep}`) || isAbsolute(actualRelative)) {
      errors.push(`${label}: path escapes repository`);
      return undefined;
    }
    if (!statSync(actualPath).isFile()) { errors.push(`${label}: evidence path is not a file`); return undefined; }
    bytes = readFileSync(actualPath);
  } catch {
    errors.push(`${label}: evidence file is unreadable`);
    return undefined;
  }
  return bytes;
}

function validateCampaign(
  root: string, ref: z.infer<typeof CampaignRef> | null, requirement: Requirement, errors: string[], requirePass: boolean,
): ValidatedCampaign {
  if (!ref) {
    if (requirePass) errors.push(`${requirement.id}: qualified status requires a campaign reference`);
    return { evidenceRefs: [], binding: null };
  }
  const bytes = readHashedFile(root, ref.path, ref.sha256, `${requirement.id}: campaign`, errors);
  if (!bytes) return { evidenceRefs: [], binding: null };
  let raw: unknown;
  try { raw = JSON.parse(bytes.toString("utf8")); }
  catch { errors.push(`${requirement.id}: campaign manifest is not valid JSON`); return { evidenceRefs: [], binding: null }; }
  const parsed = CampaignManifest.safeParse(raw);
  if (!parsed.success) {
    errors.push(`${requirement.id}: campaign manifest schema is invalid`);
    return { evidenceRefs: [], binding: null };
  }
  const campaign = parsed.data;
  if (campaign.campaignId !== ref.campaignId) errors.push(`${requirement.id}: campaign ID does not match its reference`);
  if (ref.path !== `docs/audits/${campaign.campaignDate.slice(0, 10)}/${campaign.campaignId}.json`) {
    errors.push(`${requirement.id}: campaign path does not match its date and ID`);
  }
  if (requirePass && campaign.campaignResult !== "passed") errors.push(`${requirement.id}: campaign did not pass`);
  if (requirePass && campaign.tenetVersion !== KERNEL_VERSION) errors.push(`${requirement.id}: campaign Tenet version does not match the current kernel`);
  const artifactPath = "plugin/kernel/tenet.mjs";
  if (requirePass) readHashedFile(root, artifactPath, campaign.artifactSha256, `${requirement.id}: campaign artifact`, errors);
  if (isAbsolute(campaign.protocolPath) || relative(root, resolve(root, campaign.protocolPath)).startsWith("..")) {
    errors.push(`${requirement.id}: protocol path escapes repository`);
  } else {
    try { execFileSync("git", ["cat-file", "-e", `${campaign.protocolCommit}:${campaign.protocolPath}`], { cwd: root, stdio: "ignore" }); }
    catch { errors.push(`${requirement.id}: protocol file is absent from the frozen Git commit`); }
  }
  if (!campaign.scope.requirementIds.includes(requirement.id)) errors.push(`${requirement.id}: campaign scope omits the requirement`);
  if (new Set(campaign.scope.requirementIds).size !== campaign.scope.requirementIds.length) errors.push(`${requirement.id}: campaign scope has duplicate requirements`);
  if (new Set(campaign.scope.acIds).size !== campaign.scope.acIds.length) errors.push(`${requirement.id}: campaign scope has duplicate AC IDs`);
  const requirementOrder = ORDER.indexOf(requirement.milestone);
  if (requirementOrder < 0 || ORDER.indexOf(campaign.scope.milestone) < requirementOrder) {
    errors.push(`${requirement.id}: campaign scope milestone is unsupported or too early`);
  }
  for (const scopedId of campaign.scope.requirementIds) {
    const outcomes = campaign.outcomes.filter((item) => item.requirementId === scopedId);
    if (outcomes.length !== 1 || (requirePass && outcomes[0]?.result !== "passed")) {
      errors.push(`${requirement.id}: campaign lacks one passing outcome for scoped requirement ${scopedId}`);
    }
  }
  for (const ac of requirement.acs) if (!campaign.scope.acIds.includes(ac)) errors.push(`${requirement.id}: campaign scope omits AC ${ac}`);
  const outcome = campaign.outcomes.find((item) => item.requirementId === requirement.id);
  if (!outcome || (requirePass && outcome.result !== "passed")) errors.push(`${requirement.id}: campaign has no passing requirement outcome`);
  if (outcome) {
    for (const ref of outcome.evidenceRefs) {
      if (ref.acIds.some((id) => !requirement.acs.includes(id))) errors.push(`${requirement.id}: campaign evidence contains a stale AC ID`);
      readHashedFile(root, ref.path, ref.sha256, `${requirement.id}: campaign outcome evidence`, errors);
    }
    for (const ac of requirement.acs) if (!outcome.evidenceRefs.some((item) => item.acIds.includes(ac) && (!requirePass || item.outcome === "pass"))) {
      errors.push(`${requirement.id}: campaign outcome lacks ${requirePass ? "passing " : ""}evidence for AC ${ac}`);
    }
  }
  return {
    evidenceRefs: outcome?.evidenceRefs ?? [],
    binding: { tuple: campaign.qualificationTuple as Record<string, unknown>, artifactSha256: campaign.artifactSha256 },
  };
}

/** No verb or decision file is longer than this, and no source line packs >340 chars to evade the cap (owner decision, 2026-10-19). */
const FILE_CAP = 250;
const LINE_WIDTH_CAP = 340;
function tooLong(root: string): Report["tooLong"] {
  const src = join(root, "packages/kernel/src");
  const byLines = ["verbs", "decisions"]
    .flatMap((d) => readdirSync(join(src, d)).filter((f) => f.endsWith(".ts")).map((f) => ({ file: `${d}/${f}`, lines: readFileSync(join(src, d, f), "utf8").split("\n").length })))
    .filter((x) => x.lines > FILE_CAP);
  const walkTs = (d: string): string[] =>
    readdirSync(join(src, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkTs(`${d}/${e.name}`) : e.name.endsWith(".ts") ? [`${d}/${e.name}`] : []));
  const byWidth = walkTs(".").flatMap((file) => {
    const max = Math.max(0, ...readFileSync(join(src, file), "utf8").split(/\r?\n/).map((l) => l.length));
    return max > LINE_WIDTH_CAP ? [{ file: `${file} (max line ${max} > ${LINE_WIDTH_CAP} chars)`, lines: max }] : [];
  });
  return [...byLines, ...byWidth];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--milestone");
  const milestone = i > 0 ? process.argv[i + 1] ?? "" : "M0";
  if (!ORDER.includes(milestone)) { console.error(`unknown milestone: ${milestone}`); process.exit(2); }
  const r = report(join(import.meta.dirname, ".."), milestone);
  const total = r.covered.length + r.hostOnly.length + r.unreachable.length + r.unmapped.length;
  console.log(`coverage ${milestone}: ${total} Musts · ${r.covered.length} with a T1 fixture · ${r.hostOnly.length} need the real host (T3/T4) · ${r.unreachable.length} not reachable yet · ${r.unmapped.length} unmapped`);
  if (r.hostOnly.length) console.log(`  host only: ${r.hostOnly.map((x) => x.id).join(", ")}`);
  console.log(`  reason codes referenced by a fixture: ${r.reasonCodes.referenced} of ${r.reasonCodes.total}`);
  for (const item of r.evidence) {
    console.log(`  ${item.id}: mapping=${item.mapping} disposition=${item.disposition} uncoveredAcIds=[${item.uncoveredAcIds.join(",")}] evidenceTiers=[${item.evidenceTiers.join(",")}] qualification=${item.qualification}`);
  }
  for (const error of r.integrityErrors) console.error(`  report integrity: ${error}`);
  for (const t of r.tooLong) console.error(`${t.file} is ${t.lines} lines; the cap is ${FILE_CAP}`);
  if (r.integrityErrors.length) process.exit(1);
  if (r.tooLong.length) process.exit(1);
  if (r.unmapped.length) { console.error(`unmapped Musts: ${r.unmapped.map((x) => `${x.id} (${x.acs.join(" ")})`).join(", ")}`); process.exit(1); }
  console.log(`  checked ${relative(process.cwd(), join(import.meta.dirname, "../packages"))}`);
}
