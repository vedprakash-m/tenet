import test from "node:test";
import assert from "node:assert/strict";
import { MemoryJsonStore } from "../src/store/jsonStore.js";

test("hard purges expired records after retention period", () => {
  const store = new MemoryJsonStore();
  store.save("inc-1", { ageDays: 95 });
  assert.equal(store.purge("inc-1"), true);
  assert.equal(store.get("inc-1"), null);
});
