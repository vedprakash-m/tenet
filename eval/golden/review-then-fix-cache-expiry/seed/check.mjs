import { test } from "node:test";
import assert from "node:assert/strict";
import { readCached } from "./src/cache.mjs";
test("expires at its boundary", () => assert.equal(readCached({value:"old", expiresAt:10},10),undefined));
