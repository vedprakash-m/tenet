# CP-0006 log

- 2026-11-22 Seeded from [specs/plan.md](../../specs/plan.md) at M0.
- 2026-11-23 Scope revised in plan v0.8 (L-0013).
- 2026-11-23 Scope revised in plan v0.9 (L-0016).
- 2026-11-23 Plan v0.11 ([L-0023](../../ledger/L-0023-contracts-frozen-before-build.md)): dependencies set from the waves; lane `standard` renamed `careful`; scope and requirements per the release part.
- 2026-11-23 Implemented policy loading, rule modes, selectors, owners/areas, kit hashing and lock verification within the CP-0006 owned paths. Added focused repositories and fixtures for all levels, target-ref policy, branch edits, owners, vendored-kit drift, lock mismatch and self-hosting. Focused proof, lint and full tests pass; no escalation was needed.
- 2026-11-23 Independent review fixes keep ref-loaded policy in context for owners and areas, apply specification owner/CODEOWNERS/Owner precedence, and reject lowered default document levels. Regression tests for all three cases pass with lint and the full suite.
- 2026-11-23 Second review aligned ALG-03 document ownership exactly to front matter, CODEOWNERS, then Owner; configured areas now produce unknown applicability instead of falling through to CODEOWNERS. Focused, lint and full verification pass.
- 2026-11-23 Final review made `areaFor` reject unmatched configured areas with `TN-GATE-UNKNOWN`, matching `ownersFor`; focused, lint and full verification pass.
