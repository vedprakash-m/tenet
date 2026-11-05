// Schema 1 -> 2 migration candidate, pure slice (schema-migration 16-20, config-completion 16 and 18). Candidate only: nothing here activates schema 2.
// These tests do not carry requirement tags: LFC-04, CON-05 and QLT-11 are mapped only when the whole behavior is proven on the real host.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { State, State2 } from "../src/core/schemas.ts";
import { hashOf } from "../src/core/ids.ts";
import { EFFECT_KINDS, decodeJournal1, decodeState1, decodeState2, stateReferences, unknownKey } from "../src/core/schemas-legacy.ts";
import { convertSet, upcastState1 } from "../src/core/schemas-upcast.ts";
import { registryVersionOf } from "../src/core/traits.ts";
import { Terminal, consent, matchTerminal, migrationBlockers, nextStep, pristineProblems, previewFacts } from "../src/core/schemas-migrate.ts";
import type { Plan } from "../src/core/schemas-migrate.ts";
import { H, WS, journal1, journal1Lines, state1 } from "./support/schema1-fixtures.ts";

const ctx = { registryVersion: registryVersionOf({ traits: ["fixture"] }), bindingHash: (w: { id: string }) => hashOf({ fixtureBinding: w.id }) };
const refused = (r: { ok: boolean }) => assert.equal(r.ok, false);

describe("schema 1 fixtures are valid under the frozen parser", () => {
  it("parses the state fixture and the journal fixture", () => {
    assert.equal(State.safeParse(state1()).success, true);
    const j = decodeJournal1(journal1());
    assert.equal(j.ok, true);
  });
});

describe("strict decoding of the state document", () => {
  it("accepts a valid document unchanged", () => {
    const raw = JSON.parse(JSON.stringify(state1()));
    const d = decodeState1(raw);
    assert.equal(d.ok, true);
  });
  it("refuses an unknown key at any depth instead of stripping it", () => {
    for (const mutate of [
      (s: any) => { s.work.wk_1.git.surprise = 1; },
      (s: any) => { s.project.intent.overview.surprise = 1; },
      (s: any) => { s.work.wk_1.budget.surprise = 1; },
      (s: any) => { s.surprise = 1; },
    ]) {
      const raw = JSON.parse(JSON.stringify(state1()));
      mutate(raw);
      const d = decodeState1(raw);
      assert.equal(d.ok, false);
    }
  });
  it("keeps the root _ext extension as inert data", () => {
    const raw = JSON.parse(JSON.stringify(state1()));
    raw._ext = { note: { anything: ["goes"] } };
    assert.equal(decodeState1(raw).ok, true);
  });
  it("refuses a nonempty archive and a cached response with a foreign envelope key", () => {
    const withArchive = JSON.parse(JSON.stringify(state1()));
    withArchive.archive = [{ id: "a", label: "W-0001", endpoint: "checked-local", blob: H("a"), finishedAt: "t" }];
    refused(decodeState1(withArchive));
    const cached = JSON.parse(JSON.stringify(state1()));
    const response = { verb: "open", exit: 0, revision: 1, reasons: [], next: [], budget: { attempts: "0/3", rounds: "0/1", delegations: "0/2" } };
    cached.work.wk_1.session.last = { inputHash: "x", response };
    assert.equal(decodeState1(cached).ok, true);
    cached.work.wk_1.session.last = { inputHash: "x", response: { ...response, surprise: true } };
    refused(decodeState1(cached));
  });
  it("finds the raw key a parsed copy dropped", () => {
    assert.equal(unknownKey({ a: [{ b: 1, c: 2 }] }, { a: [{ b: 1 }] }), "/a/0/c");
    assert.equal(unknownKey({ a: 1 }, { a: 1, extra: 2 }), null);
  });
  it("lists the owned references a document points to", () => {
    const s = state1();
    s.work.wk_1!.dependency = { specs: [], urgent: false, quote: "", scripts: [], manager: "npm", before: { manifest: H("1"), lock: null }, after: { manifest: H("2"), lock: H("3") } };
    assert.deepEqual(stateReferences(s).blobs, [H("1")]);
  });
});

describe("the journal and the ten effect kinds", () => {
  it("decodes every effect kind and collects the owned blobs and run directories", () => {
    const j = decodeJournal1(journal1());
    assert.ok(j.ok);
    assert.deepEqual(Object.keys(j.value.effects).sort(), [...EFFECT_KINDS].sort());
    assert.equal(EFFECT_KINDS.length, 10);
    assert.deepEqual(j.value.blobs.sort(), [H("7"), H("a")].sort());
    assert.deepEqual(j.value.runDirs, ["/t/run-u"]);
  });
  it("refuses a torn tail, an unknown effect, an orphan result, a duplicate and an unresolved intent", () => {
    const lines = journal1Lines();
    refused(decodeJournal1(journal1(lines).slice(0, -1)));
    refused(decodeJournal1(journal1([...lines, JSON.stringify({ t: "t", kind: "intent", effect: "teleport", id: "x", op: {} })])));
    refused(decodeJournal1(journal1([...lines, JSON.stringify({ t: "t", kind: "result", effect: "forget", id: "orphan", outcome: { completed: true } })])));
    refused(decodeJournal1(journal1([...lines, lines[0]!])));
    const noResult = lines.filter((l) => !(l.includes('"result"') && l.includes('"f-1"')));
    refused(decodeJournal1(journal1(noResult)));
  });
  it("refuses an extra key in an outer record, an op or an outcome, and a mixed success and failure outcome", () => {
    const lines = journal1Lines();
    const tweak = (find: string, edit: (o: any) => void) => lines.map((l) => { if (!l.includes(find)) return l; const o = JSON.parse(l); edit(o); return JSON.stringify(o); });
    refused(decodeJournal1(journal1(tweak('"c-1"', (o) => { o.extra = 1; }))));
    refused(decodeJournal1(journal1(tweak('"u-1"', (o) => { if (o.op) o.op.extra = 1; }))));
    refused(decodeJournal1(journal1(tweak('"f-1"', (o) => { if (o.outcome) o.outcome.extra = 1; }))));
    refused(decodeJournal1(journal1(tweak('"c-1"', (o) => { if (o.outcome) o.outcome.reason = "x"; }))));
    refused(decodeJournal1(journal1(tweak('"h-1"', (o) => { if (o.op) o.op.block = "HARDENING-other"; }))));
    refused(decodeJournal1(journal1(tweak('"h-1"', (o) => { if (o.op) o.op.file = "docs/other.md"; }))));
  });
  it("accepts the failure variants the producers write", () => {
    const lines = journal1Lines().map((l) => (l.includes('"result"') && l.includes('"c-1"') ? JSON.stringify({ t: "t", kind: "result", effect: "commit", id: "c-1", outcome: { completed: false, reason: "error" } }) : l));
    assert.equal(decodeJournal1(journal1(lines)).ok, true);
  });
});

describe("the pure upcast", () => {
  it("is valid schema 2 and changes the format only", () => {
    const s = state1();
    const t = upcastState1(s, ctx);
    assert.equal(State2.safeParse(t).success, true);
    assert.equal(t.schema, 2);
    assert.equal(t.revision, s.revision);
    assert.equal(t.workSeq, s.workSeq);
    assert.equal(t.generationSeq, s.generationSeq);
    for (const [id, w] of Object.entries(s.work)) {
      const u = t.work[id]!;
      assert.deepEqual(u.budget, w.budget);
      assert.deepEqual(u.pinned, w.pinned);
      assert.equal(u.state, w.state);
      assert.equal(u.createdAt, w.createdAt);
      assert.equal(u.updatedAt, w.updatedAt);
      assert.deepEqual(u.configEvidence, { hash: ctx.bindingHash(w), serial: 0 });
      assert.equal(u.traits.status, "unassessed");
    }
  });
  it("keeps legacy trait strings in order, with repeats, as inert history and infers nothing", () => {
    const t = upcastState1(state1(), ctx);
    assert.deepEqual(t.project.traits.legacyUnverified, ["ui", "weird-trait", "ui"]);
    assert.equal(t.project.traits.status, "unassessed");
    assert.equal(t.project.traits.evidenceHash, null);
    assert.equal(t.project.traits.resolutionHash, null);
    assert.deepEqual(t.project.traits.assessments, []);
    assert.deepEqual(t.project.traits.corrections, []);
    assert.equal(t.project.traits.registryVersion, ctx.registryVersion);
    const basis = t.work.wk_1!.basis!;
    assert.deepEqual(basis.legacyTraits, ["persistence", "weird-trait", "persistence"]);
    assert.equal(Object.hasOwn(basis, "traits"), false);
    assert.equal(t.work.wk_2!.basis, undefined);
  });
  it("starts the recovery table at the initial floor and stamps no historical evidence", () => {
    const s = state1();
    s.work.wk_1!.obligations = [{ id: "OB-1", kind: "test", category: "acceptance" }];
    const t = upcastState1(s, ctx);
    assert.equal(t.recovery.jobSeq, 0);
    assert.deepEqual(t.recovery.jobs, []);
    assert.deepEqual(t.recovery.validity.map((v) => [v.key.work, v.serial]).sort(), [["wk_1", 0], ["wk_2", 0]]);
    assert.equal(t.work.wk_1!.obligations[0]!.baselineConfigEvidence, undefined);
  });
  it("refuses when a governing source cannot be validated, and never hashes a default in its place", () => {
    const failing = { ...ctx, bindingHash: () => { throw new Error("shared policy is malformed"); } };
    assert.throws(() => upcastState1(state1(), failing), /malformed/);
    const r = convertSet({ primary: state1(), previous: state1(6) }, failing);
    assert.equal(r.ok, false);
  });
  it("converts primary and previous independently with their own revisions, and previous may be absent", () => {
    const r = convertSet({ primary: JSON.parse(JSON.stringify(state1(9))), previous: JSON.parse(JSON.stringify(state1(8))) }, ctx);
    assert.ok(r.ok);
    assert.equal(r.value.primary.revision, 9);
    assert.equal(r.value.previous!.revision, 8);
    const alone = convertSet({ primary: JSON.parse(JSON.stringify(state1(9))), previous: null }, ctx);
    assert.ok(alone.ok);
    assert.equal(alone.value.previous, null);
    const bad = JSON.parse(JSON.stringify(state1(8)));
    bad.surprise = 1;
    assert.equal(convertSet({ primary: JSON.parse(JSON.stringify(state1(9))), previous: bad }, ctx).ok, false);
  });
});

describe("strict schema 2", () => {
  const good = () => JSON.parse(JSON.stringify(upcastState1(state1(), ctx)));
  it("refuses a missing or inconsistent trait state, a missing binding and a stray legacy field", () => {
    for (const mutate of [
      (s: any) => { delete s.project.traits.legacyUnverified; },
      (s: any) => { s.project.traits = ["ui"]; },
      (s: any) => { delete s.work.wk_1.configEvidence; },
      (s: any) => { delete s.work.wk_1.traits; },
      (s: any) => { s.work.wk_1.traits.status = "assessed"; },
      (s: any) => { s.work.wk_1.basis.traits = ["ui"]; },
      (s: any) => { delete s.recovery; },
      (s: any) => { s.work.wk_1.configEvidence.serial = -1; },
    ]) {
      const s = good();
      mutate(s);
      assert.equal(decodeState2(s).ok, false);
    }
    assert.equal(decodeState2(good()).ok, true);
  });
  it("requires a schema-2 in-flight check to retain its issued binding and identity", () => {
    const candidate = good();
    const work = candidate.work.wk_1;
    work.session.inCall = {
      runId: "run-1", verb: "check", since: "now",
      issuedConfigEvidence: work.configEvidence, checkInputId: "check-input-id",
    };
    assert.equal(decodeState2(candidate).ok, true);

    delete work.session.inCall.issuedConfigEvidence;
    assert.equal(decodeState2(candidate).ok, false);
    work.session.inCall.issuedConfigEvidence = work.configEvidence;
    delete work.session.inCall.checkInputId;
    assert.equal(decodeState2(candidate).ok, false);
  });
  it("rejects unsafe counters, duplicate recovery keys, and high-water marks below retained jobs", () => {
    const unsafe = good();
    unsafe.recovery.jobSeq = Number.MAX_SAFE_INTEGER + 1;
    assert.equal(decodeState2(unsafe).ok, false);

    const job = { key: { workspaceId: WS, jobSeq: 1 }, owner: { work: { workspaceId: WS, work: "wk_1" },
      generation: 1, runId: "run-1" }, allocatedThrough: 0, settledThrough: 0, settledUnits: 0, closed: false };
    const belowHighWater = good();
    belowHighWater.recovery.jobs = [job];
    assert.equal(decodeState2(belowHighWater).ok, false);

    const duplicate = good();
    duplicate.recovery.jobSeq = 1;
    duplicate.recovery.jobs = [job, { ...job }];
    assert.equal(decodeState2(duplicate).ok, false);
  });
  it("refuses schema 2 where schema 1 is required and the reverse", () => {
    assert.equal(State.safeParse(good()).success, false);
    assert.equal(State2.safeParse(JSON.parse(JSON.stringify(state1()))).success, false);
  });
});

const facts = () => ({
  marker: '{"schema":1}', primary: JSON.stringify(state1(9)), previous: JSON.stringify(state1(8)) as string | null, log: journal1(), summaries: null as string | null,
  references: { blobs: [H("7")], runDirs: [] as string[], manifests: [] as string[] }, bridge: "bridge-1", target: "target-2", registryVersion: ctx.registryVersion, design: "d1",
});

describe("preview, consent and blockers", () => {
  it("binds every source byte, presence sentinel, inventory, build identity and design version", () => {
    const base = previewFacts(facts()).factsHash;
    assert.equal(previewFacts(facts()).factsHash, base);
    const changes: Array<(f: ReturnType<typeof facts>) => void> = [
      (f) => { f.marker += " "; }, (f) => { f.primary += " "; }, (f) => { f.previous = null; }, (f) => { f.log += "\n"; },
      (f) => { f.summaries = "{}"; }, (f) => { f.references.blobs.push(H("8")); }, (f) => { f.bridge = "bridge-2"; },
      (f) => { f.target = "target-3"; }, (f) => { f.registryVersion = registryVersionOf({ other: 1 }); }, (f) => { f.design = "d2"; },
    ];
    for (const change of changes) {
      const f = facts();
      change(f);
      assert.notEqual(previewFacts(f).factsHash, base);
    }
  });
  it("accepts only yes with the exact hash; decline, stale and missing answers change nothing", () => {
    const { factsHash } = previewFacts(facts());
    assert.equal(consent(factsHash, { answer: "yes", factsHash }), "accepted");
    assert.equal(consent(factsHash, { answer: "no", factsHash }), "declined");
    assert.equal(consent(factsHash, { answer: "yes", factsHash: "0".repeat(64) }), "stale");
    assert.equal(consent(factsHash, { answer: "yes" }), "missing");
    assert.equal(consent(factsHash, { factsHash }), "missing");
    assert.equal(consent(factsHash, { answer: "YES", factsHash }), "missing");
  });
  it("refuses while a call, envelope, reservation, quarantine or unknown accounting is outstanding", () => {
    assert.deepEqual(migrationBlockers(state1()), []);
    const mutate = (f: (s: any) => void) => { const s: any = JSON.parse(JSON.stringify(state1())); f(s); return migrationBlockers(s); };
    assert.equal(mutate((s) => { s.work.wk_1.session.inCall = { runId: "r", pid: 1, procStart: "p", verb: "check", since: "t", runDir: "/t/r" }; }).length, 1);
    assert.equal(mutate((s) => { s.work.wk_1.budget.reservations = [{ id: "r" }]; }).length, 1);
    assert.equal(mutate((s) => { s.work.wk_2.focusedReview = { id: "r" }; }).length, 1);
    assert.equal(mutate((s) => { s.work.wk_2.pendingEnvelope = {}; }).length, 1);
    assert.equal(mutate((s) => { s.quarantine = { path: "q", nonce: "n", entries: 1, choice: "pending" }; }).length, 1);
    assert.equal(mutate((s) => { s.recovered = { from: "state.prev", at: "t", accounting: "unknown" }; }).length, 1);
  });
});

describe("ordered installation and exact-prefix recovery", () => {
  const plan: Plan = {
    previous: { from: "P1", to: "P2" }, primary: { from: "S1", to: "S2" }, marker: { from: "M1", to: "M2" }, log: "L", summaries: null,
  };
  const at = (previous: string | null, primary: string | null, marker: string | null, log: string | null = "L", summaries: string | null = null) =>
    ({ previous, primary, marker, log, summaries });
  it("walks previous, primary, then marker last, and ends done", () => {
    assert.deepEqual(nextStep(plan, at("P1", "S1", "M1"), "upgrade"), { ok: true, step: "previous" });
    assert.deepEqual(nextStep(plan, at("P2", "S1", "M1"), "upgrade"), { ok: true, step: "primary" });
    assert.deepEqual(nextStep(plan, at("P2", "S2", "M1"), "upgrade"), { ok: true, step: "marker" });
    assert.deepEqual(nextStep(plan, at("P2", "S2", "M2"), "upgrade"), { ok: true, step: "done" });
  });
  it("accepts exactly the four recorded prefixes of the 64 tuples drawn from source, target and absent", () => {
    let accepted = 0, total = 0;
    for (const p of ["P1", "P2", "x", null]) for (const q of ["S1", "S2", "x", null]) for (const m of ["M1", "M2", "x", null]) {
      total++;
      if (nextStep(plan, at(p, q, m), "upgrade").ok) accepted++;
    }
    assert.equal(total, 64);
    assert.equal(accepted, 4);
    assert.equal(nextStep(plan, at("P1", "S1", "M2"), "upgrade").ok, false); // marker 2 with primary 1
    assert.equal(nextStep(plan, at("P1", "S2", "M1"), "upgrade").ok, false); // primary 2 with previous 1
  });
  it("refuses a changed log or summaries at every prefix", () => {
    assert.equal(nextStep(plan, at("P1", "S1", "M1", "L2"), "upgrade").ok, false);
    assert.equal(nextStep(plan, at("P1", "S1", "M1", "L", "{}"), "upgrade").ok, false);
    assert.equal(nextStep(plan, at("P1", "S1", "M1", null), "upgrade").ok, false);
  });
  it("collapses an absent previous: no synthetic previous is created and the order of the rest holds", () => {
    const none: Plan = { ...plan, previous: { from: null, to: null } };
    assert.deepEqual(nextStep(none, at(null, "S1", "M1"), "upgrade"), { ok: true, step: "primary" });
    assert.deepEqual(nextStep(none, at(null, "S2", "M1"), "upgrade"), { ok: true, step: "marker" });
    assert.equal(nextStep(none, at("P1", "S1", "M1"), "upgrade").ok, false);
  });
  it("rollback restores previous, primary and marker last, and unlinks a previous the source never had", () => {
    assert.deepEqual(nextStep(plan, at("P2", "S2", "M2"), "rollback"), { ok: true, step: "previous" });
    assert.deepEqual(nextStep(plan, at("P1", "S2", "M2"), "rollback"), { ok: true, step: "primary" });
    assert.deepEqual(nextStep(plan, at("P1", "S1", "M2"), "rollback"), { ok: true, step: "marker" });
    assert.deepEqual(nextStep(plan, at("P1", "S1", "M1"), "rollback"), { ok: true, step: "done" });
    const absent: Plan = { ...plan, previous: { from: null, to: "P2" } };
    assert.deepEqual(nextStep(absent, at("P2", "S2", "M2"), "rollback"), { ok: true, step: "previous" });
    assert.deepEqual(nextStep(absent, at(null, "S2", "M2"), "rollback"), { ok: true, step: "primary" });
  });
});

describe("pristine rollback and the minimal terminal", () => {
  const upgraded = () => JSON.parse(JSON.stringify(upcastState1(state1(), ctx)));
  it("is pristine only at the initial floor with nothing issued", () => {
    assert.deepEqual(pristineProblems(upgraded(), ""), []);
    const mutate = (f: (s: any) => void, tail = "") => { const s = upgraded(); f(s); return pristineProblems(s, tail); };
    assert.ok(mutate((s) => { s.recovery.jobSeq = 1; }).length);
    assert.ok(mutate((s) => { s.recovery.validity[0].serial = 1; }).length);
    assert.ok(mutate((s) => { s.work.wk_1.configEvidence.serial = 1; }).length);
    assert.ok(mutate((s) => { s.work.wk_1.reviews = [{ configEvidence: { hash: H("a"), serial: 1 } }]; }).length);
    assert.ok(mutate((s) => { s.work.wk_1.obligations = [{ baselineConfigEvidence: { hash: H("a"), serial: 1 } }]; }).length);
    assert.ok(mutate(() => {}, '{"t":"x","kind":"launch","version":2}\n').length);
    assert.ok(mutate(() => {}, '{"t":"x","kind":"intent","effect":"commit","id":"c","op":{"version":2}}\n').length);
  });
  it("keeps exactly five keys and recognizes only an exact match", () => {
    const t = { operationId: "a".repeat(32), protocolVersion: 1, versions: { from: 1, to: 2 }, outcome: "upgraded", bindingDigest: H("b") };
    assert.equal(Terminal.safeParse(t).success, true);
    assert.equal(Terminal.safeParse({ ...t, at: "now" }).success, false);
    assert.equal(Terminal.safeParse({ ...t, versions: { from: 1, to: 2, extra: 3 } }).success, false);
    assert.equal(Terminal.safeParse({ ...t, outcome: "applied" }).success, false);
    const same = Terminal.parse(t);
    assert.equal(matchTerminal(same, Terminal.parse({ ...t })), true);
    assert.equal(matchTerminal(same, Terminal.parse({ ...t, operationId: "b".repeat(32) })), false);
    assert.equal(matchTerminal(same, Terminal.parse({ ...t, bindingDigest: H("c") })), false);
    assert.equal(matchTerminal(same, Terminal.parse({ ...t, versions: { from: 2, to: 1 }, outcome: "rolled-back" })), false);
  });
});

describe("the captured schema-1 set (TENET_LEGACY_CAPTURE_ROOT)", () => {
  const root = process.env.TENET_LEGACY_CAPTURE_ROOT;
  it("decodes every captured state and journal, or is skipped when no capture is extracted", { skip: !root || !existsSync(root) }, () => {
    const seen = new Set<string>();
    const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const p = join(d, e.name);
      if (e.isDirectory()) return walk(p);
      if (e.name === "state" || e.name === "state.prev") assert.ok(decodeState1(JSON.parse(readFileSync(p, "utf8"))).ok, p);
      if (e.name === "log") {
        const j = decodeJournal1(readFileSync(p, "utf8"));
        if (j.ok) Object.keys(j.value.effects).forEach((k) => seen.add(k));
      }
    });
    walk(root!);
    assert.ok(seen.size > 0);
  });
});
void WS;
