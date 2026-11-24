### Tenet proof · 9b41d0 (merge candidate) · advisory
Your intent this change touches
  C-1 blessed · "A payment that times out is retried once within 2 seconds, never twice." · implements · 1 tagged test passed
  C-4 blessed · "Every retry writes an audit entry in the same checkout folder." · text-changed · 0 tagged tests passed
  C-5 blessed · "Every retry reuses the original idempotency key." · text-changed · 0 tagged tests passed
Acceptance
  ✓ AB-1 · test passed on this commit · written in this change · test/checkout.retry.test.ts › checkout › [AB-1] one retry after timeout
Tests 1 passed · ✓ no weakening detected by these checks · ✓ no protected files touched
Blessings changed: intent#requirements blessed by priya (committed by priya)
Spec deltas: intent (+1 ~1 -1)
Why: tests written in this change require reviewer judgment [judge]
