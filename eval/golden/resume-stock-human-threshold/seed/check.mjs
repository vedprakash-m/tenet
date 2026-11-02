import { test } from "node:test";
import assert from "node:assert/strict";
import { stockStatus } from "./src/stock.mjs";
test("low stock below threshold", () => assert.equal(stockStatus(2),"low"));
