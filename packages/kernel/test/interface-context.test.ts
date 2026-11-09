import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { buildManifest, estimateTokens, reviewOnlyManifest, TOKEN_BUDGET, type FileChange, type ManifestInput } from "../src/core/review.ts";
import { contractFixture } from "./support/fixture.ts";

const change = (path: string, kind: FileChange["kind"]): FileChange =>
  ({ path, kind, hunks: [{ line: 1, added: ["const privateValue = 1;"], removed: [] }], added: 1, removed: 0 });
const input = (): ManifestInput => ({
  work: contractFixture({ obligations: [
    { id: "OB-linked", kind: "test", category: "acceptance", testFile: "test/linked.ts" },
    { id: "OB-boundary", kind: "test", category: "boundary", testFile: "test/boundary.ts" },
    { id: "OB-other", kind: "test", category: "affected", testFile: "test/unrelated.ts" },
  ] }),
  elements: [{ id: "EX-1", kind: "example", origin: "request", text: "accepted example", testFile: "test/linked.ts", verifiedBy: [] }],
  changes: [change("test/unrelated.ts", "test"), change("src/api.ts", "source"), change("src/second.ts", "source"), change("src/api.ts", "source")],
  candidate: "candidate", basisHash: "basis", attempt: 1, mode: "full", recheckFindings: [],
  rubric: "", charter: "", id: "work", files: { "src/api.ts": "blob", "test/unrelated.ts": "blob" },
});
const packet = (i = input()) => {
  const result = buildManifest(i);
  assert.ok("text" in result);
  return { result, body: JSON.parse(result.text) };
};

describe("interface-change context priority", () => {
  it("prioritizes unchanged linked acceptance tests before unrelated context in stable deduplicated order [AGT-12]", () => {
    const i = input(), before = structuredClone(i);
    const { body } = packet(i);
    assert.deepEqual(body.investigation, ["src/api.ts", "src/second.ts", "test/linked.ts", "test/boundary.ts", "test/unrelated.ts"]);
    assert.deepEqual(body.changes.map((c: { path: string }) => c.path), i.changes.map(c => c.path));
    assert.deepEqual(i, before);
  });

  it("binds native direct dependency priority to full and recheck candidates without pretending to resolve private symbols [AGT-12]", () => {
    for (const mode of ["full", "recheck"] as const) {
      const { result, body } = packet({ ...input(), mode });
      assert.deepEqual(body.interfaceContext.changedSources, ["src/api.ts", "src/second.ts"]);
      assert.equal(body.interfaceContext.resolution, "unknown");
      const guidance = body.interfaceContext.guidance.join(" ");
      assert.match(guidance, /non-private/);
      assert.match(guidance, /direct importers and callers/);
      assert.match(guidance, /before unrelated/);
      assert.match(guidance, /usages/);
      assert.match(guidance, /text search/);
      assert.match(guidance, /unresolved|unknown/);
      assert.match(guidance, /private-only/);
      assert.equal(body.identity.candidate, "candidate");
      assert.equal(result.tokens, estimateTokens(result.text));
      assert.equal(body.interfaceContext.callers, undefined);
      assert.equal(body.interfaceContext.symbols, undefined);
      assert.deepEqual(result.reservation.requiredPaths, Object.keys(input().files));
    }
  });

  it("filters every selected path for model exclusions, defaults and no-routine-scan before selection [AGT-12]", () => {
    const i = input();
    i.exclusions = [
      { pattern: "src/api.ts", kinds: ["no-model-send"] },
      { pattern: "test/linked.ts", kinds: ["no-read"] },
      { pattern: "test/boundary.ts", kinds: ["no-routine-scan"] },
      { pattern: "test/unrelated.ts", kinds: ["no-edit"] },
    ];
    i.changes = [...i.changes, change(".env", "source"), change(".tenet/state", "source")];
    const { body } = packet(i);
    assert.deepEqual(body.investigation, ["src/second.ts", "test/unrelated.ts"]);
    assert.deepEqual(body.interfaceContext.changedSources, ["src/second.ts"]);
  });

  it("keeps changed-source resolution in stateless packets and the same priority in focused and native rubrics [AGT-12]", () => {
    const i = input();
    const body = JSON.parse(reviewOnlyManifest(i.changes, [], "", "head").text);
    assert.deepEqual(body.investigation, ["src/api.ts", "src/second.ts", "test/unrelated.ts"]);
    assert.deepEqual(body.interfaceContext.changedSources, ["src/api.ts", "src/second.ts"]);
    assert.equal(body.interfaceContext.resolution, "unknown");
    const excluded = JSON.parse(reviewOnlyManifest(i.changes, [], "", "head", [{ pattern: "src/**", kinds: ["no-read"] }]).text);
    assert.deepEqual(excluded.interfaceContext.changedSources, []);
    for (const name of ["tenet-review/SKILL.md", "tenet/resources/focused-review.md"]) {
      const text = readFileSync(new URL(`../../../plugin/skills/${name}`, import.meta.url), "utf8");
      assert.match(text, /interfaceContext/);
      assert.match(text, /direct importers and callers/);
      assert.match(text, /before unrelated/);
    }
  });

  it("counts priority metadata at the exact existing packet limit and refuses oversized links without truncation [AGT-12]", () => {
    const i = input(), { result } = packet(i);
    const maxLength = Math.floor(TOKEN_BUDGET * 4 / 1.1);
    const charter = "x".repeat(maxLength - result.text.length);
    const exact = packet({ ...i, charter });
    assert.equal(exact.result.tokens, TOKEN_BUDGET);
    const over = buildManifest({ ...i, charter: charter + "x" });
    assert.ok("code" in over);
    assert.equal(over.code, "narrow-increment");
    const large = { ...i, elements: [{ ...i.elements[0]!, testFile: "x".repeat(80_000) }] };
    assert.ok("code" in buildManifest(large));
  });
});
