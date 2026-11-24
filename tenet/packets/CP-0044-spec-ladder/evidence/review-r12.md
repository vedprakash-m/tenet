# Independent round 12 re-review · CP-0044

Re-reviewed PR #28 (`9cb1be3`, on `main` `aa925e6`) against [review-r8.md](review-r8.md), `CP-0044` (`plan/alpha.0.md`), `ALG-02`–`ALG-04`, `ALG-14`, and `messages.md §2`. Did not edit code under review.

## Prior Findings Status

| Prior finding | Status | Evidence |
|---|---|---|
| B1–B3, B5–B10, S1–S3 | fixed | Already confirmed fixed in `review-r8.md` and passing across `test/specs/review-r4.test.ts` and `test/specs/conformance.test.ts`. |
| B4 | fixed | `src/specs/citations.ts:41` now emits `citationFinding("TN-CITE-RANGE", doc, item, { cite })` matching `messages.md:28` for malformed citations; `test/specs/review-r4.test.ts:85–111` verifies both malformed and out-of-range wording. |
| B11 | fixed | `src/specs/touched.ts:248–252` checks `before = docSection(parsed.path, baseText, parsed.slug)` and returns `continue` when the slug never existed at base before treating file deletion (`!headText`) as a change; regression `test/specs/review-r4.test.ts:311–331`. |
| N1 | fixed | `src/commands/verify.ts:6–10` imports `check`, `touched`, `deltas`, `parseDoc`, and `sectionDigest` into the CLI build graph (`package.json:27`), eliminating the cross-worker `dist/specs/*.js` build race. |
| N2 | unchanged | `test/specs/conformance.test.ts` runs all 46 independent cases across `pkg/conformance/{alg-02,alg-03,alg-04,alg-14}` unmodified. |
