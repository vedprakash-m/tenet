import assert from "node:assert/strict";
import { it } from "node:test";
import { MEMORY_LIMIT_BYTES, memoryPass, peakRssBytes } from "../../../tools/starter-memory.ts";

it("checks the approved 400 MB peak RSS inclusively and refuses missing measurements", () => {
  assert.equal(peakRssBytes("Name:\tnode\nVmHWM:\t409600 kB\n"), MEMORY_LIMIT_BYTES);
  assert.ok(memoryPass(MEMORY_LIMIT_BYTES));
  assert.ok(!memoryPass(MEMORY_LIMIT_BYTES + 1024));
  assert.ok(!memoryPass(0));
  assert.ok(!memoryPass(NaN));
  for (const status of ["", "VmRSS: 42 kB", "VmHWM: 0 kB", "VmHWM: -1 kB"]) {
    assert.throws(() => peakRssBytes(status));
  }
});
