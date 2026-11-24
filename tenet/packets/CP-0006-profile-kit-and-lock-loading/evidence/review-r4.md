# Independent round 4 re-review · CP-0006

Re-reviewed `main` at `ab5b78c` against the two `should` findings in `tenet/packets/CP-0006-profile-kit-and-lock-loading/evidence/review-r3.md`, `tenet/packets/CP-0006-profile-kit-and-lock-loading/escalations/answers-r4.md`, `tenet/specs/plan/alpha.0.md:63–75`, `tenet/specs/tech-spec/contracts.md:150–170`, and `tenet/specs/tech-spec/messages.md`.

## Status of Round 3 Findings

| # | R3 severity & subject | R4 status | Evidence (`file:line`) |
|---|---|---|---|
| 1 | **should** · Unregistered codes (`TN-POLICY-SCHEMA`, `TN-POLICY-ALPHA0-CAP`, `TN-USAGE-REF`) and canonical `messages.md` templates in `src/policy/load.ts` | **fixed** | All three codes were registered in `tenet/specs/tech-spec/contracts.md:152–167` and `tenet/specs/tech-spec/messages.md:52–70` per `answers-r4.md` (`07ff12d`), and `src/policy/load.ts:8, 78, 119, 133, 140, 155, 200, 215, 222, 235, 240, 333, 346, 371, 455, 483` now formats every diagnostic through `message(code, vars)` from `src/core/messages.ts`. (The remaining lock/kit codes in `src/policy/kit.ts:36, 48, 62, 85, 95, 139, 153, 162, 176` — `TN-KIT-MISSING`, `TN-KIT-INVALID`, `TN-LOCK-MISSING`, `TN-LOCK-INVALID` — are registered in Part 3 of round 5.) |
| 2 | **should** · Section-level front-matter owner lookup (`sections.<slug>.owner`) in `src/policy/load.ts` | **not fixed (accepted architectural boundary)** | `src/policy/load.ts:263–302, 462–488` (`ownersFor(filename)`) resolves file-path owners (`tenet.owner` → `policy.areas` → `CODEOWNERS` → `"Owner"`), while section-level owner precedence (`section.owner ?? doc.owner`) is handled by `CP-0044`'s `parseDoc` (`tenet/specs/plan/alpha.0.md:103`) and joined with `ownersFor(doc.path)` in `CP-0045` (`tenet/specs/plan/alpha.0b.md:27`). No defect in `CP-0006`. |

## New Defects

- **Blockers / Shoulds:** None.
