// Cleanup removal is disabled in this preview: a confirmed cleanup is refused and removes nothing.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { KernelError } from "../src/core/errors.ts";
import { cleanup } from "../src/decisions/cleanup.ts";
import type { DecisionCtx } from "../src/decisions/types.ts";

describe("cleanup removal in the preview", () => {
  it("[LFC-05] refuses a confirmed cleanup before touching the store", () => {
    let removed = false;
    const ports = { store: { cleanTemp: () => { removed = true; return { removed: [] }; } } };
    const ctx = { ports, state: { work: {}, pending: [] }, work: { id: "W1" }, input: { target: "project", answers: { "cleanup-confirm": "yes" } } };
    assert.throws(() => cleanup.run(ctx as unknown as DecisionCtx), (e: unknown) => e instanceof KernelError && e.reasons[0]?.code === "capability-missing" && e.exit === 2);
    assert.equal(removed, false);
  });
});
