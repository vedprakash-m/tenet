import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/path.mjs";
test("parent traversal cancels preceding directory", () => assert.equal(api.normalizeRelative("a/b/../c"),"a/c"));
