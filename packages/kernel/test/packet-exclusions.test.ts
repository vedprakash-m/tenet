import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumePacketExclusions, packetExclusions } from "../src/core/packet-exclusions.ts";
import { buildAnalystManifest, buildManifest, DEFAULT_CHARTER, isManifest, reviewOnlyManifest } from "../src/core/review.ts";
import { contractFixture, project } from "./support/fixture.ts";
import { KernelError } from "../src/core/errors.ts";
import { handoffText } from "../src/core/handoff.ts";
import { emptyState } from "../src/core/state.ts";
import { cleanup } from "./helpers.ts";
import { issueReview } from "../src/verbs/manifest.ts";
import { gather } from "../src/verbs/facts.ts";
import { readFileSync } from "node:fs";

const routine = { kind: "routine-search" as const };

describe("declarative packet exclusion consumers", () => {
  it("omits protected dispatch paths without weakening internal review coverage [SEC-08, REV-01]", async test => {
    const p = project();
    test.after(() => cleanup(p.root));
    p.write("tenet.policy.json", JSON.stringify({ exclusions: [{ pattern: "private/**", kinds: ["no-model-send"] }] }));
    p.write("PRIVATE/instructions.md", "<!-- tenet:charter:begin -->synthetic private charter<!-- tenet:charter:end -->");
    p.write("public/instructions.md", "<!-- tenet:charter:begin -->permitted charter<!-- tenet:charter:end -->");
    const ports = p.ports(), work = contractFixture({
      basis: { intentRevision: 0, elementIds: [], hash: "basis", traits: [] },
    });
    const state = { ...emptyState("workspace", "test"), work: { [work.id]: work } };
    const capabilities = ports.host.capabilities();
    ports.host.capabilities = () => ({ ...capabilities, instructionFiles: {
      value: "PRIVATE/instructions.md,public/instructions.md", source: "static",
    } });
    const paths = ["PRIVATE/file", "src/greet.ts"];
    const facts = { ...await gather(ports, work), reviewPaths: paths };
    const issued = issueReview(ports, state, work, facts, []);
    assert.deepEqual((issued.data?.review as { files: string[] }).files, ["src/greet.ts"]);
    assert.deepEqual(issued.work.budget.reservations[0]!.requiredPaths, paths);
    assert.deepEqual(Object.keys(issued.work.budget.reservations[0]!.files), paths);
    const manifest = (issued.data?.review as { manifest: string }).manifest;
    assert.equal(JSON.parse(readFileSync(manifest, "utf8")).charter, DEFAULT_CHARTER);
  });

  it("enforces source-scoped exceptions, NFC and default folding in the actual consumer [SEC-08, SEC-14]", () => {
    const packet = packetExclusions([
      { pattern: "Straße/**", kinds: ["no-model-send"] },
      { pattern: "café/**", kinds: ["no-read"] },
      { pattern: "archive/**", kinds: ["no-routine-scan"] },
      { pattern: ".env.example", kinds: ["no-export"] },
    ]);
    const consumer = consumePacketExclusions(JSON.parse(JSON.stringify(packet.matcher)));
    assert.equal(consumer("model-send", ".ENV.EXAMPLE", routine), true);
    assert.equal(consumer("export", ".ENV.EXAMPLE"), false);
    for (const path of [".ENV", ".TENET/state", "STRASSE/file", "CAFE\u0301/file", "ARCHIVE/file"])
      assert.equal(consumer("model-send", path, routine), false, path);
    const configured = packetExclusions([{ pattern: ".env.example", kinds: ["no-read"] }]);
    assert.equal(consumePacketExclusions(configured.matcher)("read", ".ENV.EXAMPLE", routine), false);
    assert.equal(consumer("read", "STRASSE/file", routine), true);
    assert.equal(consumer("read", "public/file", routine), true);
    assert.equal(consumer("read", "public/file"), false);
    assert.equal(consumer("read", ".env.example/.env", routine), false);
    assert.equal(consumer("read", ".aws/.env.example", routine), false);
  });

  it("rejects incomplete or inconsistent descriptors rather than interpreting regex authority [SEC-08]", () => {
    const mutate = (change: (m: any) => void) => {
      const matcher = structuredClone(packetExclusions().matcher);
      change(matcher);
      assert.throws(() => consumePacketExclusions(matcher),
        error => error instanceof KernelError && error.exit === 2 && error.reasons[0]?.code === "capability-missing");
    };
    for (const key of ["normalization", "unicodeVersion", "caseFold", "globGrammar", "exceptions", "scopes", "rules"])
      mutate(m => { delete m[key]; });
    mutate(m => { m.unicodeVersion = "17.0"; });
    mutate(m => { m.exceptions = []; });
    mutate(m => { m.exceptions.push(m.exceptions[0]); });
    mutate(m => { m.exceptions[0].target = "configured"; });
    mutate(m => { m.scopes[0].policyRevision = ""; });
    mutate(m => { m.scopes[0].mode = "exact-authenticated"; });
    mutate(m => { m.scopes[0].volumeMode.provenance = "authenticated-volume-resolver-v1"; });
    mutate(m => { m.scopes.push(m.scopes[0]); });
    mutate(m => { m.rules[0].source = "invented"; });
    mutate(m => { m.rules = []; });
    mutate(m => { m.rules.push({ pattern: "../private", kinds: ["no-read"], source: "configured" }); });
  });

  it("keeps authenticated exact names distinct while applying NFC [SEC-08]", () => {
    const matcher = packetExclusions([{ pattern: "private/**", kinds: ["no-read"] },
      { pattern: "café/**", kinds: ["no-read"] }]).matcher;
    matcher.scopes[0]!.mode = "exact-authenticated";
    matcher.scopes[0]!.volumeMode = {
      admission: "case-sensitive-proof", provenance: "authenticated-volume-resolver-v1",
    };
    const consumer = consumePacketExclusions(matcher);
    assert.equal(consumer("read", "PRIVATE/file", routine), true);
    assert.equal(consumer("read", "private/file", routine), false);
    assert.equal(consumer("read", "cafe\u0301/file", routine), false);
  });

  it("filters model-ineligible changes and attention in stateful and stateless packets [SEC-08]", () => {
    const changes = ["Private/file", ".ENV", "public/file"].map(path => ({
      path, kind: "source" as const, hunks: [{ line: 1, added: ["synthetic private text"], removed: [] }],
      added: 1, removed: 0,
    }));
    const exclusions = [{ pattern: "private/**", kinds: ["no-model-send" as const] }];
    const attention = [{ id: "AT-private", path: "Private/file", line: 1, pattern: "escape", marker: true }];
    const stateful = buildManifest({
      work: contractFixture({ attention }), elements: [], changes, candidate: "candidate", basisHash: "basis",
      attempt: 1, mode: "full", recheckFindings: [], rubric: "", id: "work", files: {}, charter: "", exclusions,
    });

    assert.ok(isManifest(stateful));
    for (const text of [stateful.text, reviewOnlyManifest(changes, attention, "", "head", exclusions).text]) {
      const packet = JSON.parse(text);
      assert.deepEqual(packet.changes.map((c: { path: string }) => c.path), ["public/file"]);
      assert.deepEqual(packet.attention, []);
      assert.equal(text.includes("synthetic private text"), false);
      const consumer = consumePacketExclusions(packet.exclusions.matcher);
      assert.equal(consumer("model-send", "PRIVATE/file", routine), false);
      assert.equal(packet.exclusions.matcher.scopes[0].volumeMode.admission, "mode-unavailable-folded");
    }
  });

  it("omits protected basis test paths and historical finding content from analyst and handoff context [SEC-08]", () => {
    const exclusions = [{ pattern: "private/**", kinds: ["no-model-send" as const] }];
    const finding = { id: "FND-1", n: 1, severity: "major" as const, axis: "behavior" as const,
      location: { path: "PRIVATE/test.ts", line: 1 }, claim: "synthetic restricted finding", evidence: "private evidence",
      state: "valid" as const, history: [] };
    const work = contractFixture({ findings: [finding] });
    const elements = [{ id: "EX-1", kind: "example" as const, origin: "request" as const,
      text: "an accepted example", testFile: "PRIVATE/test.ts", verifiedBy: [],
      support: ["PRIVATE/fixture.json", "public/fixture.json"], outputs: ["PRIVATE/output.json", "public/output.json"] }];
    const analyst = buildAnalystManifest({ work, elements, candidate: "candidate", attempt: 1,
      role: "researcher", question: "Find the interface", rubric: "", exclusions });
    assert.ok(isManifest(analyst));
    assert.equal(analyst.text.includes("PRIVATE/test.ts"), false);
    assert.equal(analyst.text.includes("PRIVATE/fixture.json"), false);
    assert.equal(analyst.text.includes("PRIVATE/output.json"), false);
    assert.equal(JSON.parse(analyst.text).basis.elements[0].text, "an accepted example");
    assert.deepEqual(JSON.parse(analyst.text).basis.elements[0].support, ["public/fixture.json"]);
    assert.deepEqual(JSON.parse(analyst.text).basis.elements[0].outputs, ["public/output.json"]);
    const text = handoffText(emptyState("workspace", "tag"), work, exclusions);
    assert.equal(text.includes("PRIVATE/test.ts"), false);
    assert.equal(text.includes("synthetic restricted finding"), false);
    assert.equal(handoffText(emptyState("workspace", "tag"), work).includes("synthetic restricted finding"), true);
  });
});
