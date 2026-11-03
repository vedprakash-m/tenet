// QLT-11 trait state, pure slice (specs/trait-detection.md, schema-migration.md section 16.2.1, decision-packet 4a-A and 4b-A).
// Candidate only: nothing here is wired into the stored state, the pipeline or risk.ts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hashOf } from "../src/core/ids.ts";
import { laneFloor } from "../src/core/risk.ts";
import type { Assessment } from "../src/core/risk.ts";
import {
  R1_TRAITS, R2_DEFERRED_TRAITS, NOT_ASSESSED_IN_R1, canonicalTraitId, registryVersionOf, traitEvidenceHash, candidateDiffHash,
  projectEvidenceSetHash, projectResolutionHash, applicableProjectCorrections, applicableChangeCorrections, workTraitFacts,
  changeTraitRaises, workHashProblems, TraitProjectState, TraitWorkState,
} from "../src/core/traits.ts";
import type { R1Trait } from "../src/core/traits.ts";

const H = (c: string) => c.repeat(64);
const REG = registryVersionOf({ traits: ["fixture"] });
const REG2 = registryVersionOf({ traits: ["fixture", "changed"] });
const PROFILE = "ts-js";

const projEv = (path: string, h = H("a")) => ({ path, mode: "100644", hash: h });
const chgEv = (path: string, after = H("b")) => ({ path, beforeMode: null, beforeHash: null, afterMode: "100644", afterHash: after });

function projectAssessment(trait: R1Trait, outcome: "present" | "not-indicated" | "unknown" = "not-indicated", evidence = [projEv("package.json")]) {
  const coverage = outcome === "unknown" ? "partial" : "complete";
  const unavailable = outcome === "unknown" ? ["lockfile"] : [];
  const evidenceHash = traitEvidenceHash({ registryVersion: REG, trait, scope: "project", supportedProfile: PROFILE, coverage, evidence, unavailable });
  return { trait, outcome, supportedProfile: PROFILE, coverage, evidenceHash, evidence, unavailable, reasonId: `${outcome}-fixture` } as const;
}
function changeAssessment(trait: R1Trait, outcome: "present" | "not-indicated" | "unknown" = "not-indicated", evidence = [chgEv("src/a.ts")]) {
  const coverage = outcome === "unknown" ? "partial" : "complete";
  const unavailable = outcome === "unknown" ? ["lockfile"] : [];
  const evidenceHash = traitEvidenceHash({ registryVersion: REG, trait, scope: "change", supportedProfile: PROFILE, coverage, evidence, unavailable });
  return { trait, outcome, supportedProfile: PROFILE, coverage, evidenceHash, evidence, unavailable, reasonId: `${outcome}-fixture` } as const;
}

function projectState(over: Partial<Record<R1Trait, "present" | "not-indicated" | "unknown">> = {}, corrections: unknown[] = []) {
  return rebuild(R1_TRAITS.map((t) => projectAssessment(t, over[t] ?? "not-indicated")), corrections);
}
/** A project state whose digests are recomputed for the given assessments, so a test changes one thing at a time. */
function rebuild(assessments: Array<ReturnType<typeof projectAssessment>>, corrections: unknown[] = []) {
  const evidenceHash = projectEvidenceSetHash(REG, assessments);
  const resolutionHash = projectResolutionHash({ registryVersion: REG, evidenceHash, assessments, corrections: corrections as never });
  return { status: "assessed", registryVersion: REG, evidenceHash, resolutionHash, assessments, corrections, legacyUnverified: [] };
}
const DIFF = H("d");
function workState(over: Partial<Record<R1Trait, "present" | "not-indicated" | "unknown">> = {}, corrections: unknown[] = [], projectTraitHash = H("f")) {
  return { status: "assessed", projectTraitHash, candidateDiffHash: DIFF, assessments: R1_TRAITS.map((t) => changeAssessment(t, over[t] ?? "not-indicated")), corrections };
}
const CTX = { registryVersion: REG, generation: 3, intentRevision: 7 };
const changeCorrection = (trait: R1Trait, outcome: "present" | "not-indicated" | "unknown", extra: Record<string, unknown> = {}) => {
  const a = changeAssessment(trait, "not-indicated");
  return { trait, outcome, registryVersion: REG, evidenceHash: a.evidenceHash, decisionId: `dec_${trait}_${outcome}`, at: "2026-11-03T10:00:00Z", generation: 3, intentRevision: 7, candidateDiffHash: DIFF, ...extra };
};
const projectCorrection = (trait: R1Trait, outcome: "present" | "not-indicated" | "unknown", extra: Record<string, unknown> = {}) => ({
  trait, outcome, registryVersion: REG, evidenceHash: projectAssessment(trait).evidenceHash, decisionId: `dec_${trait}_${outcome}`, at: "2026-11-03T10:00:00Z", ...extra,
});

describe("closed registry of R1 trait ids", () => {
  it("lists exactly the ten R1 traits and four deferred R2 traits", () => {
    assert.deepEqual([...R1_TRAITS], ["ui", "persistence", "auth", "personal-data", "public-api", "external-effects", "background-jobs", "i18n", "cli", "library"]);
    assert.deepEqual([...R2_DEFERRED_TRAITS], ["data-pipeline", "infra", "ml", "mobile"]);
  });
  it("canonicalTraitId accepts only the exact id; unknown, R2, differently cased or padded names fail closed", () => {
    assert.equal(canonicalTraitId("auth"), "auth");
    for (const bad of ["Auth", " auth", "auth ", "mobile", "data-pipeline", "", "authn", 7, null, undefined]) assert.equal(canonicalTraitId(bad), null, String(bad));
  });
  it("registryVersionOf is sha256 over the sorted-key encoding and keeps array order", () => {
    assert.match(REG, /^sha256:[0-9a-f]{64}$/);
    assert.equal(registryVersionOf({ b: 1, a: [1, 2] }), registryVersionOf({ a: [1, 2], b: 1 }));
    assert.notEqual(registryVersionOf({ a: [1, 2] }), registryVersionOf({ a: [2, 1] }));
  });
});

describe("not assessed in R1 notice (decision 4b-A)", () => {
  it("is static, names the four R2 traits as not assessed and stores nothing", () => {
    for (const t of R2_DEFERRED_TRAITS) assert.ok(NOT_ASSESSED_IN_R1.includes(t), t);
    assert.match(NOT_ASSESSED_IN_R1, /not assessed in R1/i);
    for (const t of R1_TRAITS) assert.ok(!NOT_ASSESSED_IN_R1.split(/[ ,.]+/).includes(t), `${t} is assessed`);
    assert.equal(TraitProjectState.safeParse({ ...projectState(), deferred: ["ml"] }).success, false, "no deferred list in state");
  });
});

describe("trait evidence identity", () => {
  const base = { registryVersion: REG, trait: "auth", scope: "project", supportedProfile: PROFILE, coverage: "complete", evidence: [projEv("a.ts"), projEv("b.ts", H("c"))], unavailable: ["x", "y"] } as const;
  it("does not depend on input order and changes with any evidence field", () => {
    const h = traitEvidenceHash(base);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(traitEvidenceHash({ ...base, evidence: [...base.evidence].reverse(), unavailable: ["y", "x"] }), h);
    assert.notEqual(traitEvidenceHash({ ...base, evidence: [projEv("a.ts"), projEv("b.ts", H("d"))] }), h);
    assert.notEqual(traitEvidenceHash({ ...base, evidence: [{ ...projEv("a.ts"), mode: "100755" }, projEv("b.ts", H("c"))] }), h);
    assert.notEqual(traitEvidenceHash({ ...base, registryVersion: REG2 }), h);
    assert.notEqual(traitEvidenceHash({ ...base, coverage: "partial" }), h);
    assert.notEqual(traitEvidenceHash({ ...base, unavailable: ["x"] }), h);
  });
  it("sorts by UTF-8 bytes, not by locale or UTF-16 code units", () => {
    // U+FF5E sorts after U+1F600 in UTF-16 code units but before it in UTF-8 bytes; the helper must not care about input order either way.
    const e = [projEv("\uff5e.ts"), projEv("\u{1f600}.ts", H("c"))];
    assert.equal(traitEvidenceHash({ ...base, evidence: e }), traitEvidenceHash({ ...base, evidence: [...e].reverse() }));
    const expected = hashOf({ version: 1, registryVersion: REG, trait: "auth", scope: "project", supportedProfile: PROFILE, coverage: "complete", evidence: [e[0], e[1]], unavailable: [] });
    assert.equal(traitEvidenceHash({ ...base, evidence: e, unavailable: [] }), expected);
  });
  it("refuses duplicate paths, duplicate unavailable ids and malformed Git paths", () => {
    assert.throws(() => traitEvidenceHash({ ...base, evidence: [projEv("a.ts"), projEv("a.ts", H("c"))] }), /duplicate/i);
    assert.throws(() => traitEvidenceHash({ ...base, unavailable: ["x", "x"] }), /duplicate/i);
    for (const p of ["", "/abs.ts", "C:/x.ts", "C:x.ts", "\\\\server\\share", "a//b", "a/./b", "a/../b", "./a", "a/", "a\0b", "a/..", "\ud800.ts"]) {
      assert.throws(() => traitEvidenceHash({ ...base, evidence: [projEv(p)] }), Error, JSON.stringify(p));
    }
  });
  it("keeps case and Unicode forms apart: no folding or normalization", () => {
    const a = traitEvidenceHash({ ...base, evidence: [projEv("Readme.md")] });
    assert.notEqual(a, traitEvidenceHash({ ...base, evidence: [projEv("README.md")] }));
    assert.notEqual(traitEvidenceHash({ ...base, evidence: [projEv("\u00e9.ts")] }), traitEvidenceHash({ ...base, evidence: [projEv("e\u0301.ts")] }));
  });
  it("change entries keep before and after identities and null for absence", () => {
    const created = { path: "n.ts", beforeMode: null, beforeHash: null, afterMode: "100644", afterHash: H("e") };
    const deleted = { path: "n.ts", beforeMode: "100644", beforeHash: H("e"), afterMode: null, afterHash: null };
    const c = { ...base, scope: "change" } as const;
    assert.notEqual(traitEvidenceHash({ ...c, evidence: [created] }), traitEvidenceHash({ ...c, evidence: [deleted] }));
    assert.throws(() => traitEvidenceHash({ ...c, evidence: [{ ...created, afterHash: null }] }), Error, "mode without hash");
    assert.throws(() => traitEvidenceHash({ ...c, evidence: [projEv("n.ts") as never] }), Error, "project-shaped entry in a change set");
  });
});

describe("candidate-diff hash", () => {
  const base = { workspaceId: "ws_x", work: "wk_1", generation: 3, startSnapshotHash: H("5"), entries: [chgEv("a.ts"), chgEv("b.ts", H("c"))] };
  it("is stable under entry order and changes with binding, path, mode or content", () => {
    const h = candidateDiffHash(base);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(candidateDiffHash({ ...base, entries: [...base.entries].reverse() }), h);
    assert.equal(h, hashOf({ version: 1, workspaceId: "ws_x", work: "wk_1", generation: 3, startSnapshotHash: H("5"), entries: base.entries }));
    for (const changed of [
      { ...base, generation: 4 }, { ...base, work: "wk_2" }, { ...base, workspaceId: "ws_y" }, { ...base, startSnapshotHash: H("6") },
      { ...base, entries: [chgEv("a.ts"), chgEv("b.ts", H("d"))] }, { ...base, entries: [chgEv("a.ts")] },
    ]) assert.notEqual(candidateDiffHash(changed), h);
  });
  it("an empty diff is a real value, distinct from the unassessed null", () => {
    assert.match(candidateDiffHash({ ...base, entries: [] }), /^[0-9a-f]{64}$/);
  });
  it("refuses duplicate paths and a malformed start snapshot hash", () => {
    assert.throws(() => candidateDiffHash({ ...base, entries: [chgEv("a.ts"), chgEv("a.ts", H("c"))] }), /duplicate/i);
    assert.throws(() => candidateDiffHash({ ...base, startSnapshotHash: "nope" }));
  });
});

describe("project evidence-set and resolution hashes", () => {
  it("evidence-set hash ignores assessment order and ignores outcome and reason", () => {
    const a = R1_TRAITS.map((t) => projectAssessment(t));
    const h = projectEvidenceSetHash(REG, a);
    assert.equal(projectEvidenceSetHash(REG, [...a].reverse()), h);
    assert.equal(projectEvidenceSetHash(REG, a.map((x) => ({ ...x, outcome: "present" as const, reasonId: "other" }))), h);
    assert.notEqual(projectEvidenceSetHash(REG2, a), h);
    assert.notEqual(projectEvidenceSetHash(REG, a.map((x, i) => (i ? x : projectAssessment("ui", "not-indicated", [projEv("other.json")])))), h);
  });
  it("evidence-set hash refuses a duplicate trait", () => {
    assert.throws(() => projectEvidenceSetHash(REG, [projectAssessment("ui"), projectAssessment("ui")]), /duplicate/i);
  });
  it("a correction changes the resolution hash although the repository bytes did not", () => {
    const s = projectState();
    const withCorrection = projectState({}, [projectCorrection("auth", "present")]);
    assert.equal(withCorrection.evidenceHash, s.evidenceHash);
    assert.notEqual(withCorrection.resolutionHash, s.resolutionHash);
    const other = projectState({}, [projectCorrection("auth", "unknown")]);
    assert.notEqual(other.resolutionHash, withCorrection.resolutionHash);
  });
  it("resolution hash changes with outcome and reason id, and not with assessment order", () => {
    const s = projectState();
    const swapped = projectResolutionHash({ registryVersion: REG, evidenceHash: s.evidenceHash, assessments: [...s.assessments].reverse(), corrections: [] });
    assert.equal(swapped, s.resolutionHash);
    const reason = s.assessments.map((a, i) => (i ? a : { ...a, reasonId: "changed-reason" }));
    assert.notEqual(projectResolutionHash({ registryVersion: REG, evidenceHash: s.evidenceHash, assessments: reason, corrections: [] }), s.resolutionHash);
    const outcome = s.assessments.map((a, i) => (i ? a : { ...a, outcome: "present" as const }));
    assert.notEqual(projectResolutionHash({ registryVersion: REG, evidenceHash: s.evidenceHash, assessments: outcome, corrections: [] }), s.resolutionHash);
  });
});

describe("correction applicability: project corrections", () => {
  const ctx = (state = projectState()) => ({ registryVersion: REG, assessments: state.assessments });
  it("applies while registry and the trait's evidence match, regardless of work generation or diff", () => {
    const c = projectCorrection("auth", "present");
    const r = applicableProjectCorrections([c], ctx());
    assert.deepEqual(r.applicable, [c]);
    assert.deepEqual(r.stale, []);
  });
  it("is stale when the registry version differs", () => {
    const r = applicableProjectCorrections([projectCorrection("auth", "present", { registryVersion: REG2 })], ctx());
    assert.deepEqual(r.applicable, []);
    assert.equal(r.stale.length, 1);
  });
  it("is stale when that trait's evidence changed, but unrelated trait evidence does not matter", () => {
    const changed = projectState();
    changed.assessments = changed.assessments.map((a) => (a.trait === "ui" ? projectAssessment("ui", "not-indicated", [projEv("other.json")]) : a));
    const authC = projectCorrection("auth", "present");
    const uiC = projectCorrection("ui", "present");
    const r = applicableProjectCorrections([authC, uiC], ctx(changed));
    assert.deepEqual(r.applicable.map((c) => c.trait), ["auth"], "E11: a correction survives while its own evidence matches");
    assert.deepEqual(r.stale.map((c) => c.trait), ["ui"]);
  });
  it("is stale for a trait with no assessment; rejects two corrections for one trait; returns trait order", () => {
    assert.deepEqual(applicableProjectCorrections([projectCorrection("auth", "present")], { registryVersion: REG, assessments: [] }).applicable, []);
    assert.throws(() => applicableProjectCorrections([projectCorrection("auth", "present"), projectCorrection("auth", "unknown", { decisionId: "dec_2" })], ctx()), /duplicate|more than one/i);
    const r = applicableProjectCorrections([projectCorrection("cli", "present"), projectCorrection("ui", "unknown")], ctx());
    assert.deepEqual(r.applicable.map((c) => c.trait), ["cli", "ui"], "sorted by trait id");
  });
});

describe("correction applicability: change corrections", () => {
  const w = workState();
  const ctx = (over: Record<string, unknown> = {}) => ({ registryVersion: REG, assessments: w.assessments, generation: 3, intentRevision: 7, candidateDiffHash: DIFF, ...over });
  it("applies only to the same registry, evidence, generation, intent revision and candidate diff", () => {
    const c = changeCorrection("auth", "present");
    assert.deepEqual(applicableChangeCorrections([c], ctx()).applicable, [c]);
    for (const [name, c2] of Object.entries({
      registry: changeCorrection("auth", "present", { registryVersion: REG2 }),
      evidence: changeCorrection("auth", "present", { evidenceHash: H("9") }),
      generation: changeCorrection("auth", "present", { generation: 4 }),
      intent: changeCorrection("auth", "present", { intentRevision: 8 }),
      diff: changeCorrection("auth", "present", { candidateDiffHash: H("9") }),
    })) {
      const r = applicableChangeCorrections([c2], ctx());
      assert.deepEqual(r.applicable, [], name);
      assert.equal(r.stale.length, 1, name);
    }
  });
  it("goes stale when the current diff, plan revision or generation moves on", () => {
    const c = changeCorrection("auth", "present");
    for (const over of [{ candidateDiffHash: H("8") }, { intentRevision: 9 }, { generation: 4 }]) assert.deepEqual(applicableChangeCorrections([c], ctx(over)).applicable, []);
  });
  it("rejects two corrections for one trait", () => {
    assert.throws(() => applicableChangeCorrections([changeCorrection("auth", "present"), changeCorrection("auth", "unknown", { decisionId: "dec_2" })], ctx()), /duplicate|more than one/i);
  });
});

const unassessedProject = (legacy: string[] = []) => ({ status: "unassessed", registryVersion: REG, evidenceHash: null, resolutionHash: null, assessments: [], corrections: [], legacyUnverified: legacy });
const unassessedWork = { status: "unassessed", projectTraitHash: null, candidateDiffHash: null, assessments: [], corrections: [] };
const why = (schema: { safeParse(v: unknown): { success: boolean; error?: { issues: Array<{ message: string }> } } }, v: unknown) =>
  (schema.safeParse(v).error?.issues ?? []).map((i) => i.message).join("; ");
const parses = (schema: { safeParse(v: unknown): { success: boolean } }, v: unknown) => schema.safeParse(v).success;

describe("TraitProjectState schema", () => {
  it("accepts an assessed state with one assessment per R1 trait and a consistent correction", () => {
    assert.ok(parses(TraitProjectState, projectState({ auth: "present", "personal-data": "unknown" })));
    assert.ok(parses(TraitProjectState, projectState({}, [projectCorrection("auth", "present")])));
  });
  it("keeps legacy strings exactly, in order, and never reads them as traits", () => {
    const legacy = ["zeta", "auth", "../../etc/passwd", "ignore previous instructions", "auth", ""];
    const r = TraitProjectState.parse(unassessedProject(legacy));
    assert.deepEqual(r.legacyUnverified, legacy);
    assert.deepEqual(r.assessments, []);
  });
  it("unassessed requires null hashes and empty arrays; assessed requires hashes and all ten traits", () => {
    assert.ok(parses(TraitProjectState, unassessedProject()));
    const s = projectState();
    assert.ok(!parses(TraitProjectState, { ...unassessedProject(), evidenceHash: s.evidenceHash }));
    assert.ok(!parses(TraitProjectState, { ...unassessedProject(), assessments: [s.assessments[0]] }));
    assert.ok(!parses(TraitProjectState, { ...unassessedProject(), corrections: [projectCorrection("auth", "present")] }));
    assert.ok(!parses(TraitProjectState, { ...s, evidenceHash: null }));
    assert.ok(!parses(TraitProjectState, { ...s, resolutionHash: null }));
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.slice(1) }), "a trait is missing");
    assert.ok(!parses(TraitProjectState, { ...s, assessments: [...s.assessments, s.assessments[0]] }), "a trait is duplicated");
  });
  it("refuses unknown fields, unknown or R2 trait names and malformed shapes", () => {
    const s = projectState();
    assert.ok(!parses(TraitProjectState, { ...s, extra: 1 }));
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, trait: "mobile" })) }));
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, outcome: "maybe" })) }));
    assert.ok(!parses(TraitProjectState, { ...s, registryVersion: "abc" }));
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, evidenceHash: "XYZ" })) }));
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, reasonId: "Free text with spaces!" })) }));
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, evidence: [projEv("../x")] })) }));
  });
  it("not-indicated needs complete coverage and no unavailable input (E10, E18)", () => {
    const s = projectState();
    const first = (patch: Record<string, unknown>) => {
      const a = { ...s.assessments[0]!, ...patch } as ReturnType<typeof projectAssessment>;
      const evidenceHash = traitEvidenceHash({ registryVersion: REG, trait: a.trait, scope: "project", supportedProfile: PROFILE, coverage: a.coverage, evidence: [...a.evidence], unavailable: [...a.unavailable] });
      return rebuild([{ ...a, evidenceHash }, ...s.assessments.slice(1)] as never);
    };
    assert.ok(parses(TraitProjectState, first({ outcome: "present", coverage: "partial" })), "a partial detector can still find a positive");
    assert.ok(!parses(TraitProjectState, first({ coverage: "partial" })));
    assert.ok(!parses(TraitProjectState, first({ unavailable: ["lockfile"] })));
  });
  it("recomputes every digest: a tampered assessment, evidence-set or resolution hash is refused", () => {
    const s = projectState({ auth: "present" });
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, evidence: [projEv("changed.json")] })) }), "evidence no longer matches its hash");
    assert.ok(!parses(TraitProjectState, { ...s, assessments: s.assessments.map((a, i) => (i ? a : { ...a, outcome: "present" })) }), "outcome change without a new resolution hash");
    assert.ok(!parses(TraitProjectState, { ...s, evidenceHash: H("1") }));
    assert.ok(!parses(TraitProjectState, { ...s, resolutionHash: H("1") }));
  });
  it("refuses a stale, mismatched or duplicate correction in stored state, saying why", () => {
    const stale = (extra: Record<string, unknown>) => projectState({}, [projectCorrection("auth", "present", extra)]);
    assert.match(why(TraitProjectState, stale({ registryVersion: REG2 })), /another registry version/);
    assert.match(why(TraitProjectState, stale({ evidenceHash: H("9") })), /other evidence/);
    const withCorrections = (cs: unknown[]) => ({ ...projectState(), corrections: cs });
    assert.match(why(TraitProjectState, withCorrections([projectCorrection("auth", "present"), projectCorrection("auth", "unknown", { decisionId: "dec_2" })])), /more than one correction/);
    assert.match(why(TraitProjectState, withCorrections([projectCorrection("auth", "present"), projectCorrection("cli", "present", { decisionId: "dec_auth_present" })])), /decision id/);
    assert.ok(!parses(TraitProjectState, projectState({}, [{ ...projectCorrection("auth", "present"), quote: "free text" }])), "no user quote is stored");
  });
});

describe("TraitWorkState schema", () => {
  it("accepts an unassessed state (null means not assessed) and an assessed state with a bound correction", () => {
    assert.ok(parses(TraitWorkState, unassessedWork));
    assert.ok(parses(TraitWorkState, workState({ auth: "present" }, [changeCorrection("cli", "present")])));
  });
  it("requires project and diff hashes together with all ten traits when assessed, and none when unassessed", () => {
    const w = workState();
    assert.ok(!parses(TraitWorkState, { ...w, projectTraitHash: null }));
    assert.ok(!parses(TraitWorkState, { ...w, candidateDiffHash: null }));
    assert.ok(!parses(TraitWorkState, { ...w, assessments: w.assessments.slice(1) }));
    assert.ok(!parses(TraitWorkState, { ...unassessedWork, candidateDiffHash: DIFF }));
    assert.ok(!parses(TraitWorkState, { ...unassessedWork, corrections: [changeCorrection("cli", "present")] }));
    assert.ok(!parses(TraitWorkState, { ...w, extra: true }));
  });
  it("refuses a correction bound to another diff or to other evidence, and duplicates", () => {
    assert.match(why(TraitWorkState, workState({}, [changeCorrection("cli", "present", { candidateDiffHash: H("9") })])), /another candidate diff/);
    assert.match(why(TraitWorkState, workState({}, [changeCorrection("cli", "present", { evidenceHash: H("9") })])), /other evidence/);
    assert.match(why(TraitWorkState, workState({}, [changeCorrection("cli", "present"), changeCorrection("cli", "unknown", { decisionId: "dec_2" })])), /more than one correction/);
    assert.ok(!parses(TraitWorkState, workState({}, [{ ...changeCorrection("cli", "present"), generation: 1.5 }])));
  });
  it("change assessments recompute against a registry version, and a changed one is reported", () => {
    const w = TraitWorkState.parse(workState({ auth: "present" }));
    assert.deepEqual(workHashProblems(w, REG), []);
    assert.ok(workHashProblems(w, REG2).length > 0, "assessments hashed under another registry no longer match it");
    const tampered = { ...w, assessments: w.assessments.map((a, i) => (i ? a : { ...a, evidence: [chgEv("elsewhere.ts")] })) };
    assert.ok(workHashProblems(tampered, REG).length > 0);
  });
});

describe("facts projection of work trait state (decision 4a-A)", () => {
  const work = (corrections: unknown[] = [], over: Partial<Record<R1Trait, "present" | "not-indicated" | "unknown">> = {}) => TraitWorkState.parse(workState(over, corrections));
  const facts = (w: ReturnType<typeof work>) => hashOf(workTraitFacts(w, CTX));

  it("an unassessed work projects as such, not as an empty set of no-trait results", () => {
    assert.deepEqual(workTraitFacts(TraitWorkState.parse(unassessedWork), CTX), { status: "unassessed" });
  });
  it("a same-diff correction changes the facts, so proof bound to the old facts cannot survive [QLT-11]", () => {
    const before = facts(work());
    const proofBoundTo = before; // dependent receipts and cached verdicts carry the facts they were made under
    const after = facts(work([changeCorrection("auth", "present")]));
    assert.notEqual(after, proofBoundTo);
    assert.equal(work().candidateDiffHash, work([changeCorrection("auth", "present")]).candidateDiffHash, "same diff");
    assert.notEqual(facts(work([changeCorrection("auth", "unknown")])), after, "a different outcome is a different fact");
  });
  it("changes with the assessed result, the evidence and the pinned project trait state", () => {
    const base = facts(work());
    assert.notEqual(facts(work([], { ui: "present" })), base);
    assert.notEqual(facts(TraitWorkState.parse(workState({}, [], H("1")))), base);
    const moved = TraitWorkState.parse({ ...workState(), assessments: workState().assessments.map((a, i) => (i ? a : changeAssessment(a.trait, "not-indicated", [chgEv("src/other.ts")]))) });
    assert.notEqual(facts(moved), base);
  });
  it("is the same for the same state however the corrections are ordered, and ignores corrections that do not apply", () => {
    const a = changeCorrection("auth", "present");
    const b = changeCorrection("cli", "present");
    assert.equal(facts(work([a, b])), facts(work([b, a])));
    const staleCtx = { ...CTX, intentRevision: 8 };
    assert.equal(hashOf(workTraitFacts(work([a]), staleCtx)), hashOf(workTraitFacts(work(), staleCtx)), "a stale correction is not a fact");
    assert.notEqual(hashOf(workTraitFacts(work([a]), staleCtx)), facts(work([a])), "the same state is a different fact once the plan moved on and the correction went stale");
  });
  it("carries no persisted hash of its own and no free text", () => {
    const f = workTraitFacts(work([changeCorrection("auth", "present")]), CTX) as Record<string, unknown>;
    assert.deepEqual(Object.keys(f).sort(), ["assessments", "candidateDiffHash", "corrections", "projectTraitHash", "status"]);
    assert.equal(JSON.stringify(TraitWorkState.parse(workState())).includes("resolutionHash"), false);
  });
});

describe("change traits raise the lane; project traits do not (plan 12.3, Tech Spec 8.2) [QLT-11]", () => {
  // The pure inputs for risk.ts: a lane floor from change traits only. risk.ts itself is not changed.
  const floor = (dims: string[]): "quick" | "standard" | "deep" => laneFloor(Object.fromEntries(dims.map((d) => [d, "high"])) as Assessment);
  it("project auth alone raises nothing; the same trait in the candidate diff raises the floor", () => {
    const project = TraitProjectState.parse(projectState({ auth: "present" }));
    assert.equal(project.assessments.find((a) => a.trait === "auth")!.outcome, "present");
    const noChange = TraitWorkState.parse(workState());
    assert.equal(floor(changeTraitRaises(noChange, CTX)), "quick");
    const withChange = TraitWorkState.parse(workState({ auth: "present" }));
    assert.deepEqual(changeTraitRaises(withChange, CTX), ["access"]);
    assert.equal(floor(changeTraitRaises(withChange, CTX)), "standard");
  });
  it("external-effects and personal-data keep the dimensions risk.ts already gives them; two High dimensions make a deep floor", () => {
    const w = TraitWorkState.parse(workState({ "external-effects": "present", "personal-data": "present" }));
    assert.deepEqual(changeTraitRaises(w, CTX), ["sensitive-data", "external-effects"]);
    assert.equal(floor(changeTraitRaises(w, CTX)), "deep");
  });
  it("a correction to present raises, and a correction to not-indicated removes the raise, once it applies", () => {
    const toPresent = TraitWorkState.parse(workState({}, [changeCorrection("auth", "present")]));
    assert.deepEqual(changeTraitRaises(toPresent, CTX), ["access"]);
    const removed = TraitWorkState.parse(workState({ auth: "present" }, [changeCorrection("auth", "not-indicated", { evidenceHash: changeAssessment("auth", "present").evidenceHash })]));
    assert.deepEqual(changeTraitRaises(removed, CTX), []);
    assert.deepEqual(changeTraitRaises(toPresent, { ...CTX, generation: 4 }), [], "a stale correction raises nothing");
  });
  it("an unassessed work raises nothing", () => {
    assert.deepEqual(changeTraitRaises(TraitWorkState.parse(unassessedWork), CTX), []);
  });
});
