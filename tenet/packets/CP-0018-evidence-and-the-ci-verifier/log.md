# CP-0018 log

- 2026-11-22 Seeded from [specs/plan.md](../../specs/plan.md) after the M0 review (L-0007).
- 2026-11-23 Scope revised in plan v0.8 (L-0013).
- 2026-11-23 Scope revised after the feasibility review (L-0015).
- 2026-11-23 Scope revised in plan v0.9 (L-0016).
- 2026-11-23 Scope revised in plan v0.10 (L-0022).
- 2026-11-23 Plan v0.11 ([L-0023](../../ledger/L-0023-contracts-frozen-before-build.md)): dependencies set from the waves; lane `standard` renamed `careful`; scope and requirements per the release part.
- 2026-11-23 Plan v0.13 ([L-0027](../../ledger/L-0027-last-pass-before-build.md)): dependencies or scope updated.
- 2026-11-23 Part 2 implemented the report readers, acceptance parser, declaration and tag scans, item results, and weakening checks in the CP-0018-owned areas. The report registry covers `none`, `junit`, `jest-json`, `ctrf`, and `go-test-json`; real CP-0041 captures are exercised alongside report safety, retry, matrix, teardown, declaration, authorship, rename, skip, deletion, and consolidation cases.
- 2026-11-23 Part 2 proof: `npm test -- test/reports` passed 7/7; `npm run build`, the full `npm test` suite (68/68), `npm run lint`, and `npm run check:examples` passed. No proposal or escalation was needed.
- 2026-11-23 Part 2 review fixes added optional option defaults, restricted declaration body tag discovery to recognized `record_property` calls, tracked multiline title removals through renames, and omitted absent/invalid JUnit durations. Focused reports passed 10/10; the full suite passed 71/71; build, lint, examples, and `git diff --check` passed.

| Code | Plain message | Fix |
|---|---|---|
| `TN-REPORT-MISSING` | `test report is missing: <path>` | `Generate the configured test report and try again.` |
| `TN-REPORT-MALFORMED` | `test report is malformed: <path>: <detail>` | `Generate a valid report for the configured kind and try again.` |
| `TN-ACC-MISSING-ID` | `acceptance item needs an ID` | `Add a unique [AB-n] ID to the acceptance item.` |
| `TN-ACC-DUP-ID` | `acceptance item ID is repeated: <id>` | `Keep the first item and give this item a unique [AB-n] ID.` |
