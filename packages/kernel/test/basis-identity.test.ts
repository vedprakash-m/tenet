import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BasisProposal } from "../src/core/schemas.ts";
import { build } from "../src/core/basis-build.ts";
import { emptyState } from "../src/core/state.ts";
import { contractFixture } from "./support/fixture.ts";

const element = (ref?: string) => ({
  ...(ref === undefined ? {} : { ref }), kind: "requirement" as const, origin: "request" as const, text: "A distinct requirement",
});
const proposal = (refs: Array<string | undefined>) => ({ outcome: "Record the requirements", elements: refs.map(element) });

describe("basis reference identity [INT-10]", () => {
  for (const [name, refs] of [
    ["duplicate local refs", ["r", "r"]],
    ["repeated retained IDs", ["REQ-001-aaa", "REQ-001-aaa"]],
    ["duplicate empty refs", ["", ""]],
    ["prototype property refs", ["__proto__", "__proto__"]],
  ] as const) {
    it(`rejects ${name} before the decision can ask for confirmation or allocate IDs`, () => {
      const result = BasisProposal.safeParse(proposal([...refs]));
      assert.equal(result.success, false);
      if (!result.success) assert.match(result.error.issues[0]!.message, /unique/);
    });
  }

  it("preserves distinct local refs, retained IDs and unreferenced elements", () => {
    for (const refs of [["r", "s"], ["REQ-001-aaa", "REQ-002-bbb"], [undefined, undefined], ["r", undefined, "s"]]) {
      const input = proposal(refs);
      const parsed = BasisProposal.parse(input);
      assert.deepEqual(parsed.elements, input.elements);
    }
  });

  for (const ref of ["__proto__", "constructor", "toString", "hasOwnProperty"]) {
    it(`resolves ${ref} as a local ref, never an inherited object property`, () => {
      const input = BasisProposal.parse({
        outcome: "Link the example to its requirement",
        elements: [
          element(ref),
          { ref: "example", kind: "example", origin: "request", of: ref, text: "A distinguishing case", testFile: "src/a.test.ts" },
        ],
      });
      const result = build(input, emptyState("workspace", "test"), contractFixture(), () => "aaa");
      const requirement = result.elements.find((e) => e.kind === "requirement")!;
      const example = result.elements.find((e) => e.kind === "example")!;
      assert.equal(example.of, requirement.id);
      assert.equal(result.ids[ref], requirement.id);
      assert.match(example.id, /^EX-001-aaa\.1$/);
      assert.deepEqual(result.elements.map((e) => e.kind), ["requirement", "example"]);
    });
  }
});
