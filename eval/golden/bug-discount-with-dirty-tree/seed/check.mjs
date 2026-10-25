import test from "node:test";
import assert from "node:assert/strict";
import { totalCents } from "./src/price.mjs";

test("no discount", () => assert.equal(totalCents([{ cents: 1000, qty: 2 }]), 2000));
test("ten percent off two items", () => assert.equal(totalCents([{ cents: 1000, qty: 2 }], 10), 1800));
