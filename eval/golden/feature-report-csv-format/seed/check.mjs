import test from "node:test";
import assert from "node:assert/strict";
import { renderReport } from "./src/report.mjs";

const rows = [{ name: "bolt", qty: 3 }, { name: "nut", qty: 10 }];

test("text format", () => assert.equal(renderReport(rows), "bolt: 3\nnut: 10"));
test("unknown format is refused", () => assert.throws(() => renderReport(rows, "xml"), /unknown format/));
test("csv format", () => assert.equal(renderReport(rows, "csv"), "name,qty\nbolt,3\nnut,10"));
