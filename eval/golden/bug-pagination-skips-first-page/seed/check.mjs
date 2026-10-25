import test from "node:test";
import assert from "node:assert/strict";
import { paginate, pageCount } from "./src/paginate.mjs";

const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

test("page 1 is the first page", () => assert.deepEqual(paginate(items, 1, 5), [1, 2, 3, 4, 5]));
test("page 2 is the second page", () => assert.deepEqual(paginate(items, 2, 5), [6, 7, 8, 9, 10]));
test("a page size below 1 is refused", () => assert.throws(() => paginate(items, 1, 0), RangeError));
test("ten items in pages of five make two pages", () => assert.equal(pageCount(10, 5), 2));
