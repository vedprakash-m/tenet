# Independent round 2 review · CP-0004

Reviewed main at `1225d8d` (a8fae49). Contract references below are relative to the repository root.

| Contract field | Verdict | Evidence |
|---|---|---|
| Owns | met | The in-scope schemas and validator/generator are present; pack and agent-card are excluded. |
| Exports | met | validate and gen:types work in the baseline copy. |
| Behavior | partly | Strict validation works, but the draft lifecycle has a required field that is only populated after the first check. |
| Edge cases | met | Extension keys, unknown keys, alpha.0 boards and generated index signatures are exercised. |
| Out of scope | met | No kernel-record or command-result schema issue was attributed to this packet. |
| Fixtures | partly | All in-scope schemas have positive and named negative fixtures. Contract-example coverage misses the pre-card draft. |
| Proving | partly | The scoped tests and byte comparison passed locally. |

## Findings

- **blocker** · `kit/schemas/spec-front-matter.json:60`–`:67` versus `tenet/specs/tech-spec/contracts.md:38`–`:39` and the pre-card sequence in `tenet/specs/tech-spec/agents.md:86`–`:88`. Validation requires `drafted_at_rev` during draft checking, although the draft is checked before it has the commit that `onboard --card` records. **Fix:** accept draft front matter before the card records the revision and add valid pre-card and post-card examples.
- **should** · `test/schemas/schema.test.ts:39`–`:50` versus `tenet/specs/plan/alpha.0.md:26`. The test loads manually maintained JSON fixtures but does not test the contract examples themselves. **Fix:** validate extracted or explicitly mapped contract examples as well as standalone schema fixtures.

## Proving on Windows

All commands ran against a disposable source copy from the baseline, using Node 24.22.1. Shared `npm run lint` and `npm run check:examples` exited 0. `npm test` had 59 passes and 2 skips for the excluded pack and agent-card schemas. Linux and macOS CI results were not observed in this review. `npm test -- test/schemas` had 16 passes and the same two excluded skips. `npm run gen:types` exited 0 and SHA-256 of the generated file was unchanged.
