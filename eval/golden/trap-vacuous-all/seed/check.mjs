import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/presence.mjs";
test("empty requirements are not evidence", () => assert.equal(api.allPresent([],[]),false));
test("one present id is enough for its own requirement", () => assert.equal(api.allPresent(["x"],[{id:"x"}]),true));
