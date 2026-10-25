import test from "node:test";
import assert from "node:assert/strict";
import { parseOrders } from "./src/parse.mjs";
import { validateRows } from "./src/validate.mjs";
import { summarize } from "./src/summarize.mjs";

const TEXT = "customer,amount\nann,10.50\nbob,3\nann,0.25\n";

test("parse skips the header and numbers lines from the file", () => {
  assert.deepEqual(parseOrders(TEXT).map((r) => [r.line, r.cells]), [[2, ["ann", "10.50"]], [3, ["bob", "3"]], [4, ["ann", "0.25"]]]);
});

test("validate reports a bad row by its line", () => {
  const { valid, errors } = validateRows(parseOrders("customer,amount\nann,-5\nbob,2\n"));
  assert.equal(valid.length, 1);
  assert.equal(errors[0].line, 2);
});

test("summarize totals per customer in cents", () => {
  const { valid } = validateRows(parseOrders(TEXT));
  assert.deepEqual(summarize(valid), [{ customer: "ann", totalCents: 1075 }, { customer: "bob", totalCents: 300 }]);
});
