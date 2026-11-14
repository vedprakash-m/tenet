// The reason-code registry and TS Appendix C list the same codes with the same exits, so a code added in one place
// cannot stay missing from the other (TS §6.7: codes are part of the compatibility contract).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { it } from "node:test";
import { REASONS } from "../src/core/reasons.ts";

const spec = readFileSync(resolve(import.meta.dirname, "../../../specs/tech-spec.md"), "utf8");
const appendix = spec.slice(spec.indexOf("## Appendix C"));
const rows = new Map([...appendix.matchAll(/^\|[^|]*\| `([a-z0-9-]+)` \| (\d) \|/gm)].map((m) => [m[1]!, Number(m[2])]));

it("every registry reason code is in TS Appendix C with the same exit, and the appendix names no other code", () => {
  const registry = new Map(Object.entries(REASONS).map(([code, [exit]]) => [code, exit as number]));
  assert.deepEqual([...registry.keys()].filter((c) => !rows.has(c)), [], "in the registry, missing from Appendix C");
  assert.deepEqual([...rows.keys()].filter((c) => !registry.has(c)), [], "in Appendix C, missing from the registry");
  assert.deepEqual([...registry].filter(([c, e]) => rows.get(c) !== e), [], "exit differs between registry and Appendix C");
});
