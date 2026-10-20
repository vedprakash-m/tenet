// Which edits in protected paths a contract's grants cover (WRK-03, TS §8.1). Pure.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { uncoveredProtected } from "../src/core/authority.ts";
import type { Grant } from "../src/core/schemas.ts";

const grant = (over: Partial<Grant>): Grant => ({ id: "GR-2", actions: ["protected-path"], paths: ["db/001.sql"], source: "decide", capture: "reported", quote: "go ahead", bind: { factsHash: "h" }, ...over });
const routine = grant({ id: "GR-1", actions: ["local-routine"], paths: undefined, source: "request" });

describe("protected paths [WRK-03]", () => {
  it("an edit outside every protected path needs nothing", () => assert.deepEqual(uncoveredProtected(["db/**"], ["src/a.ts"], [routine]), []));
  it("an edit inside one needs a protected-path grant that lists it; the routine grant never covers it", () => {
    assert.deepEqual(uncoveredProtected(["db/**"], ["db/001.sql", "src/a.ts"], [routine]), ["db/001.sql"]);
    assert.deepEqual(uncoveredProtected(["db/**"], ["db/001.sql"], [routine, grant({})]), []);
  });
  it("covers the listed paths only: another protected path is still uncovered", () => {
    assert.deepEqual(uncoveredProtected(["db/**"], ["db/001.sql", "db/002.sql"], [grant({})]), ["db/002.sql"]);
  });
  it("a grant of another class lists no protected path", () => {
    assert.deepEqual(uncoveredProtected(["db/**"], ["db/001.sql"], [grant({ actions: ["scope-widen"] })]), ["db/001.sql"]);
  });
  it("a grant may list a pattern, and an expired one covers nothing", () => {
    assert.deepEqual(uncoveredProtected(["db/**"], ["db/x/002.sql"], [grant({ paths: ["db/x/**"] })]), []);
    assert.deepEqual(uncoveredProtected(["db/**"], ["db/001.sql"], [grant({ expiresAt: "2020-01-01T00:00:00Z" })], "2026-01-01T00:00:00Z"), ["db/001.sql"]);
  });
});
