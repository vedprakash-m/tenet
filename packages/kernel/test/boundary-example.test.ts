// Each new requirement gets at least one boundary or negative example proposed (INT-15). The kernel cannot invent one; it says
// which requirement has none, so the coordinator proposes it (as Tenet's addition, with the one confirmation that needs).
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup } from "./helpers.ts";
import { BASIS, project } from "./support/fixture.ts";
import type { Project } from "./support/fixture.ts";

const roots: string[] = [];
after(() => roots.forEach(cleanup));
const fresh = (): Project => { const p = project(); roots.push(p.root); return p; };
const boundary = { ref: "e2", kind: "example", origin: "request", of: "r1", text: "greet('') is 'Hello, !'", testFile: "src/greet.test.ts", test: "boundary", expect: "pass" };

describe("boundary examples [INT-15]", () => {
  it("names a requirement that has only a distinguishing example, in Standard", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    const r = await p.call("decide", { h, kind: "basis", propose: BASIS });
    assert.equal(r.exit, 0, JSON.stringify(r));
    const note = r.reasons.find((x) => x.code === "boundary-example-missing");
    assert.ok(note?.note, JSON.stringify(r.reasons));
    assert.match(note.message, /REQ-/);
  });

  it("says nothing once the requirement has a boundary example, or in Quick", async () => {
    const p = fresh();
    const h = (await p.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "standard" })).handle!;
    const r = await p.call("decide", { h, kind: "basis", propose: { ...BASIS, elements: [...BASIS.elements, boundary] } });
    assert.equal(r.exit, 0, JSON.stringify(r));
    assert.ok(!r.reasons.some((x) => x.code === "boundary-example-missing"));
    const q = fresh();
    const hq = (await q.call("open", { profile: "feature", request: "add a greeting", scopePaths: ["src/greet.ts"], lane: "quick" })).handle!;
    assert.ok(!(await q.call("decide", { h: hq, kind: "basis", propose: BASIS })).reasons.some((x) => x.code === "boundary-example-missing"));
  });
});
