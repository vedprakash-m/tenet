import test from "node:test";
import assert from "node:assert/strict";
import { MAX } from "./src/config.mjs";
import { createQueue } from "./src/queue.mjs";

test("oldest item comes out first", () => {
  const q = createQueue();
  q.enqueue("a");
  q.enqueue("b");
  assert.equal(q.dequeue(), "a");
  assert.equal(q.size(), 1);
});

test("an item beyond MAX is refused", () => {
  const q = createQueue();
  for (let i = 0; i < MAX; i++) q.enqueue(i);
  assert.throws(() => q.enqueue("x"), RangeError);
});
