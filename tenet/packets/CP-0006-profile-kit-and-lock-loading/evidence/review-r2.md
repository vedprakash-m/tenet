# Independent round 2 review · CP-0006

Reviewed main at `1225d8d` (0779b95). Contract references below are relative to the repository root.

| Contract field | Verdict | Evidence |
|---|---|---|
| Owns | met | Policy modules and policy tests are present. |
| Exports | met | All listed policy, owner, area, kit and lock functions are exported. |
| Behavior | partly | Schema, lock hashing, target policy and capping are implemented. An unavailable level loses observe defaults. |
| Edge cases | partly | Missing policy, unknown rule, loosening and CODEOWNERS fallback are covered. The unavailable-level expectation differs from the contract. |
| Out of scope | met | No level or rules commands were attributed to this packet. |
| Fixtures | partly | Per-level, branch edit and changed lock cases exist, but the unavailable-level expectation should assert equivalence with observe. |
| Proving | partly | All six scoped tests passed on Windows; other platforms remain unobserved. |

## Findings

- **should** · `src/policy/load.ts:147`–`:149` versus `tenet/specs/plan/alpha.0.md:68` and the observe defaults in `tenet/specs/tech-spec.md:154`–`:158`. An unavailable level becomes `observe` on the returned policy but all of its rules are set to `observe`; explicitly requesting the observe level gives the five alpha.0 rules `advise` defaults. **Fix:** apply the same rule defaults as explicit observe, retain the warning and test that equivalence.
- **should** · `src/policy/load.ts:282`–`:306` and `:479`–`:487` versus `tenet/specs/plan/alpha.0.md:71` and `tenet/specs/tech-spec.md:199`. Owner lookup stores a single document-level front-matter owner and cannot represent the different section owners allowed by the spec. **Fix:** coordinate a section-aware lookup with CP-0044 and keep the documented precedence for each section.

## Proving on Windows

All commands ran against a disposable source copy from the baseline, using Node 24.22.1. Shared `npm run lint` and `npm run check:examples` exited 0. `npm test` had 59 passes and 2 skips for the excluded pack and agent-card schemas. Linux and macOS CI results were not observed in this review. `npm test -- test/policy` had six passes.
