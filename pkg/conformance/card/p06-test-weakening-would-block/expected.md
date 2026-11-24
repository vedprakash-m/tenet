### Tenet proof · 9b41d0 (merge candidate) · advisory
Your intent this change touches
  C-1 blessed · "A payment that times out is retried once, never twice." · implements · 1 tagged test passed
Acceptance
  ✓ AB-1 · test passed on this commit · written in this change · test/checkout.retry.test.ts › checkout › [AB-1] one retry after timeout
Tests 1 passed · ! weakening detected: skip-added in test/checkout.retry.test.ts (test.skip("rejects third retry", () => { assert.strictEqual(2, 2); });) (not checked: rust) · ✓ no protected files touched
Would have blocked: skip-added in test/checkout.retry.test.ts
Why: tests written in this change require reviewer judgment [judge] · rust files not checked for test weakening [not-tenet]
