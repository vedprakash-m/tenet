import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/clone.mjs";
test("dates keep their type", () => assert.ok(api.cloneRecord({created:new Date(0)}).created instanceof Date));
