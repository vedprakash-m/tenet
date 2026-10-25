import test from "node:test";
import assert from "node:assert/strict";
import { createDocs } from "./src/docs.mjs";

const users = new Map([["u1", { role: "member" }], ["u2", { role: "member" }]]);

test("the owner can remove a document", () => {
  const docs = createDocs(users);
  const id = docs.create({ userId: "u1" }, "Plan");
  docs.remove({ userId: "u1" }, id);
  assert.throws(() => docs.get({ userId: "u1" }, id), { code: "not-found" });
});

test("another member cannot remove it", () => {
  const docs = createDocs(users);
  const id = docs.create({ userId: "u1" }, "Plan");
  assert.throws(() => docs.remove({ userId: "u2" }, id), { code: "forbidden" });
});
