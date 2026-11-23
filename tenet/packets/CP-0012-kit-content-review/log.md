# CP-0012 log

- 2026-11-22 Seeded from [specs/plan.md](../../specs/plan.md) at M0.
- 2026-11-23 Scope revised in plan v0.8 (L-0013).
- 2026-11-23 Scope revised in plan v0.9 (L-0016).
- 2026-11-23 Plan v0.11 ([L-0023](../../ledger/L-0023-contracts-frozen-before-build.md)): dependencies set from the waves; lane `standard` renamed `careful`; scope and requirements per the release part.
- 2026-11-23 Plan v0.12 ([L-0024](../../ledger/L-0024-one-ci-shape-and-intent-on-the-card.md)): dependencies, scope or requirements updated per the release part.
- 2026-11-23 Adds working practices (R-225) per [L-0028](../../ledger/L-0028-working-practices-ship-with-tenet.md).
- 2026-11-23 Kit content authored and independently reviewed for alpha.0 (`m0/track-2-trial-kit`):
  - **Added / updated:** `kit/templates/{intent,vision,requirements,design,experience,plan,pull-request,agents-block,escalation}.md`, `kit/packs/minimal/pack.yaml`, `kit/skills/{draft-specs,work-a-change,review-with-findings}/SKILL.md`, `kit/agents/{drafter,spec-reviewer}.md`, `kit/practices/default.md`, `kit/defaults/tenet.yaml`, `kit/README.md`.
  - **Deleted superseded v0.1 kit files (17):** `kit/defaults/profile.yaml`, `kit/loops/station-loop.yaml`, `kit/agents/judge-protocol.md`, `kit/agents/criteria/{architecture,experience,product,quality,security}.md`, `kit/agents/roles/{builder,judge,shaper,verifier}.md`, `kit/templates/{agent,definition,holdout-scenario,ledger-entry,packet-plan}.md`.
  - **Left untouched:** `kit/schemas/*` and `kit/TENET.md`.
  - **Note:** `test/kit/` automated schema and `C §3` parser proving awaits `CP-0003`/`CP-0004`/`CP-0044`.
