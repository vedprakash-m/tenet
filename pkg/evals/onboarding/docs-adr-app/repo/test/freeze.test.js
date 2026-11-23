import test from "node:test";
import assert from "node:assert/strict";
import { canOverrideFreeze } from "../src/core/freeze.js";

test("blocks self-approval on freeze override", () => {
  assert.equal(canOverrideFreeze({ requester: "alice", approver: "alice" }), false);
  assert.equal(canOverrideFreeze({ requester: "alice", approver: "bob" }), true);
});
