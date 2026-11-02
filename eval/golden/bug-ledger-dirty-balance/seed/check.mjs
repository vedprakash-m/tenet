import test from "node:test";
import assert from "node:assert/strict";
import * as api from "./src/ledger.mjs";
test("debits subtract", () => assert.equal(api.balance(1000,[{type:"debit",cents:250}]),750));
