import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/run-result.mjs";
test("a zero-test process is inconclusive", () => assert.equal(api.evaluateRun({exit:0,tests:[]}),"inconclusive"));
