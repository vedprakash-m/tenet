// Trait detection, correction and the threat and data note (QLT-11, QLT-13; specs trait-detection.md, trait-threat-data.md).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectChange, detectProject, effectiveTraits, parseCorrections, traitBind } from "../src/core/trait-detect.ts";
import type { TraitCorrection } from "../src/core/trait-detect.ts";
import { threatGap, threatNoteStatus } from "../src/core/threat.ts";
import type { BasisElement } from "../src/core/schemas.ts";
import { cleanup } from "./helpers.ts";
import { project } from "./support/fixture.ts";

const outcome = (rs: ReturnType<typeof detectProject>, t: string) => rs.find((r) => r.trait === t)!;
const el = (id: string, kind: BasisElement["kind"], extra: Partial<BasisElement> = {}): BasisElement =>
  ({ id, origin: "request", kind, text: id, verifiedBy: [], ...extra });

describe("trait detection [QLT-11]", () => {
  it("[QLT-11] proposes project traits from paths and dependencies, with the evidence", () => {
    const pkg = JSON.stringify({ private: true, dependencies: { express: "5", pg: "8", bcrypt: "5" } });
    const rs = detectProject(["server/src/platform/auth/routes.ts", "web/App.tsx", "README.md"], pkg);
    assert.equal(outcome(rs, "auth").outcome, "present");
    assert.ok(outcome(rs, "auth").evidence.includes("package.json: bcrypt"));
    assert.ok(outcome(rs, "auth").evidence.includes("server/src/platform/auth/routes.ts"));
    assert.equal(outcome(rs, "persistence").outcome, "present");
    assert.equal(outcome(rs, "ui").outcome, "present");
    assert.equal(outcome(rs, "public-api").outcome, "present");
    assert.equal(outcome(rs, "library").outcome, "unknown", "a private package is not a library signal");
  });

  it("[QLT-11] a trait without a signal is unknown, never absent, because coverage is partial", () => {
    const rs = detectProject(["README.md"], null);
    assert.ok(rs.every((r) => r.outcome === "unknown" && r.evidence.length === 0));
  });

  it("[QLT-11] change traits come from the changed paths only", () => {
    const rs = detectChange(["server/migrations/0003_holds.sql", "src/util.ts"]);
    assert.equal(outcome(rs, "persistence").outcome, "present");
    assert.equal(outcome(rs, "auth").outcome, "unknown");
    assert.equal(outcome(detectChange(["src/auth/login.ts"]), "auth").outcome, "present");
    assert.equal(outcome(detectChange(["src/author.ts"]), "auth").outcome, "unknown", "a word inside another word is not a signal");
  });

  it("[QLT-11] a correction applies only to the results it was bound to", () => {
    const before = detectChange(["src/auth/login.ts"]);
    const bind = traitBind(before, "change", "W1");
    const fix: TraitCorrection[] = [{ trait: "auth", outcome: "absent", scope: "change", work: "W1", bind }, { trait: "ui", outcome: "present", scope: "change", work: "W1", bind }];
    assert.deepEqual(effectiveTraits(before, fix, bind), ["ui"]);
    const after = detectChange(["src/auth/login.ts", "src/auth/session.ts"]);
    assert.deepEqual(effectiveTraits(after, fix, traitBind(after, "change", "W1")), ["auth"], "changed evidence makes the correction stale");
  });

  it("[QLT-11] parses corrections from the canonical R1 set only", () => {
    assert.deepEqual(parseCorrections("+auth,-ui"), [{ trait: "auth", outcome: "present" }, { trait: "ui", outcome: "absent" }]);
    assert.equal(parseCorrections("+mobile"), null, "R2 traits are not assessed");
    assert.equal(parseCorrections("auth"), null);
  });
});

describe("threat and data note [QLT-13]", () => {
  const complete = [
    el("A-1", "assumption", { threat: "actor" }),
    el("C-1", "constraint", { threat: "asset" }),
    el("EX-1", "example", { threat: "data", testFile: "t.test.ts" }),
    el("IN-1", "invariant", { threat: "abuse" }),
    el("EX-2", "example", { of: "IN-1", testFile: "t.test.ts" }),
  ];

  for (const trait of ["auth", "persistence", "personal-data", "external-effects"]) {
    it(`[QLT-13] a change with ${trait} needs every section, each security item a test or constraint`, () => {
      const missing = threatNoteStatus([trait], []);
      assert.ok(missing.required);
      assert.match(threatGap(missing)!, /missing actor, asset, data, abuse/);
      assert.equal(threatGap(threatNoteStatus([trait], complete)), null);
    });
  }

  it("[QLT-13] an untested example or an invariant without a tested child stays open", () => {
    const s = threatNoteStatus(["auth"], [...complete.slice(0, 4), el("EX-3", "example", { threat: "abuse" })]);
    assert.deepEqual(s.open, ["IN-1", "EX-3"]);
    assert.match(threatGap(s)!, /not a test or constraint: IN-1, EX-3/);
  });

  it("[QLT-13] composed traits need one note; other traits need none", () => {
    assert.deepEqual(threatNoteStatus(["auth", "persistence", "ui"], complete).traits, ["auth", "persistence"]);
    assert.equal(threatNoteStatus(["ui", "cli"], []).required, false);
  });

  it("[QLT-13] an actor is an assumption or a constraint, nothing else", () => {
    const s = threatNoteStatus(["auth"], [el("EX-9", "example", { threat: "actor", testFile: "t.test.ts" }), ...complete.slice(1)]);
    assert.deepEqual(s.invalid, ["EX-9"]);
    assert.ok(s.missingSections.includes("actor"));
  });
});

const roots: string[] = [];
after(() => roots.forEach(cleanup));

describe("traits decision [QLT-11]", { skip: process.platform === "win32" && "mutating work is refused on Windows" }, () => {
  it("[QLT-11] records project traits, accepts a correction and refuses removing a security trait without the user's words", async () => {
    const p = project({ "src/auth/login.ts": "export const login = 1;\n" });
    roots.push(p.root);
    const h = (await p.call("open", { profile: "feature", request: "add a greeting" })).handle!;
    const r = await p.call("decide", { h, kind: "traits" });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const data = r.data as { project: { traits: string[] }; notAssessed: string };
    assert.ok(data.project.traits.includes("auth"));
    assert.match(data.notAssessed, /data-pipeline/);
    const refused = await p.call("decide", { h, kind: "traits", answers: { traits: "-auth" } });
    assert.equal(refused.exit, 1);
    const ok = await p.call("decide", { h, kind: "traits", answers: { traits: "-auth,+cli" }, quote: "this project has no sign-in" });
    assert.equal(ok.exit, 0, JSON.stringify(ok));
    const st = p.ports().store.read()!.state;
    assert.ok(!st.project.traits.includes("auth"));
    assert.ok(st.project.traits.includes("cli"));
  });
});
