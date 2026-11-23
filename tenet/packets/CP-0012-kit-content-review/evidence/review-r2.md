# Independent round 2 review · CP-0012

Reviewed main at `1225d8d` (e96bda6). Contract references below are relative to the repository root.

| Contract field | Verdict | Evidence |
|---|---|---|
| Owns | partly | Kit content exists. The specified test/kit directory is absent. |
| Exports | met | The named kit artifacts are present. |
| Behavior | partly | The pack, agents block and workflow guidance are present. Draft front matter does not validate against the integrated schema. |
| Edge cases | met | The skill explicitly handles empty repositories and generic questions for an unlisted kind. |
| Out of scope | met | The GA cards and station loops remain outside this packet. |
| Fixtures | not met | No kit test suite validates the examples and profiles. |
| Proving | not met | The exact proving invocation exits 1 because test/kit does not exist. |

## Findings

- **blocker** · `package.json:31` and missing `test/kit/` versus `tenet/specs/plan/alpha.0.md:51` and `:60`–`:61`. The prescribed test command fails before collecting tests. **Fix:** provide the kit suite covering the pack, cards, template examples and token budgets, and run it against the integrated schemas.
- **blocker** · `kit/templates/intent.md:2`–`:8` versus `tenet/specs/plan/alpha.0.md:55`, `:60` and `tenet/specs/tech-spec/contracts.md:35`–`:54`. The baseline validator rejects all six spec templates' extracted front matter, including null digest and blessing revision values and absent draft metadata. **Fix:** agree with CP-0004 which values are valid at each draft stage, then prove that the worked examples pass at the documented stage.

## Proving on Windows

All commands ran against a disposable source copy from the baseline, using Node 24.22.1. Shared `npm run lint` and `npm run check:examples` exited 0. `npm test` had 59 passes and 2 skips for the excluded pack and agent-card schemas. Linux and macOS CI results were not observed in this review. `npm test -- test/kit` exited 1 with ENOENT for `test/kit`. The three skill files were independently measured at 786, 428 and 525 estimated tokens, below their 2,000-token budget. The absence of CP-0004 pack and agent-card schemas was treated as a parallel dependency, not a CP-0012 defect.
