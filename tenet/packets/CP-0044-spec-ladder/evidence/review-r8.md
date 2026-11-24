# Independent round 8 re-review · CP-0044

Reviewed the PR #12 merge at `96eee9a` against [review-r4.md](review-r4.md), the CP-0044 contract in `alpha.0.md`, and the current named algorithms and binding answers.

| Prior finding | Status | Evidence |
|---|---|---|
| B1 | fixed | `test/specs/conformance.test.ts:7,213–245` uses `tmpRepo`; `test/helpers/tmpRepo.ts:31–35` pins both CRLF settings. Regression `test/specs/review-r4.test.ts:32`. A separate build-entry-point problem is N1. |
| B2 | fixed | `src/specs/parse.ts:455–470,553–561` tracks fences in both passes and preserves their body bytes; regression `test/specs/review-r4.test.ts:46`. |
| B3 | fixed | `src/specs/parse.ts:153–178` checks the text before a trailing metadata block as well as when there is no block; regression `test/specs/review-r4.test.ts:66`. |
| B4 | partly fixed | `src/specs/anchors.ts:24–45` reserves doc/test prefixes and `src/specs/citations.ts:59–70` checks syntax first. The old wording passes the round 4 test at `test/specs/review-r4.test.ts:75–89`, while CP-0009's binding `answers-r4.md:36` requires the canonical `messages.md:28` message for malformed and out-of-bounds citations. `src/specs/citations.ts:44` still uses the literal for malformed citations. Update the wording and reconcile the earlier CP-0044 answer with the newer binding requirement. |
| B5 | fixed | `src/specs/anchors.ts:71–111` ends at the next qualifying declaration and skips non-test helpers; regression `test/specs/review-r4.test.ts:91`. |
| B6 | fixed | `src/specs/touched.ts:257–268,394` handles head-only blessed entries with head-side overlap; regression `test/specs/review-r4.test.ts:116`. |
| B7 | fixed | `src/specs/touched.ts:37–42,409–412` sorts first by reason priority, then numeric/ASCII ID; regression `test/specs/review-r4.test.ts:135`. |
| B8 | fixed | `src/specs/touched.ts:110–173` removes the patch-header tab and decodes quoted paths; regression `test/specs/review-r4.test.ts:155`. |
| B9 | fixed | `src/specs/ladder.ts:40–67,100–104` records the duplicate, `src/specs/touched.ts:191–202` refuses the collision; regression `test/specs/review-r4.test.ts:173`. Duplicate reporting interactions with check are covered in CP-0009 B2. |
| B10 | fixed | `src/specs/deltas.ts:41–54,91–107` groups all same-kind parts and rejects collisions within the group; regression `test/specs/review-r4.test.ts:199`. |
| B11 | partly fixed | `src/specs/touched.ts:240–247` distinguishes a missing slug in both versions when both document snapshots exist. If the base file exists but the head file is removed, line 243 returns before it checks whether the base ever had that slug. ALG-14 requires a cited base section overlap/deletion. Resolve the base slug before treating deletion as a change. The regression at `test/specs/review-r4.test.ts:232` covers an unchanged file only. |
| S1 | fixed | `src/specs/anchors.ts:8–12,145–148` stores the line-normalized document anchor text; regression `test/specs/review-r4.test.ts:248`. |
| S2 | fixed | `src/specs/parse.ts:399–413,455` preserves resolution/answer fields and uses exact special headings; regression `test/specs/review-r4.test.ts:258`. |
| S3 | fixed | `src/specs/parse.ts:103–111,185–189,244–245` limits dash placeholders to table conversion; regression `test/specs/review-r4.test.ts:279`. |

## Notes

- **N1.** The first combined proving run passed 106 tests and failed to load `test/specs/review-r4.test.ts`. The file statically imports `dist/specs/deltas.js` and `dist/specs/touched.js` at lines 4–8. The normal build has no dependency on them while verify is still injected, and `test/specs/conformance.test.ts:9–35` compiles them inside a different Node test worker. The regression suite passes in isolation after that compile. Build all test dependencies before the workers start so the gate in CP-0044's Proving line works from a clean checkout.
- **N2.** `test/specs/conformance.test.ts:69–85` reads the four independent suites and runs the prescribed expectations. The merged fixture files match their independent baseline. The original deleted-document reason overlap (round 4 N1) still needs its oracle reconciled with the binding answer before changing the fixture.
