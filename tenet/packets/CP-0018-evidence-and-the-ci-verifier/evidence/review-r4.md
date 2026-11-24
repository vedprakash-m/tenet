# Independent round 4 re-review · CP-0018

Re-reviewed `main` at `ab5b78c` (after commit `9de93f8`, GPT's fixes to `CP-0018`) against `tenet/packets/CP-0018-evidence-and-the-ci-verifier/evidence/review-r3.md`, `tenet/specs/plan/alpha.0.md:77–95`, `tenet/specs/tech-spec/contracts.md:16, 23–32, 84, 88–94, 150–170`, `tenet/specs/tech-spec/evidence.md:20–59` (`EV §2` and `§3 / ALG-08`), `tenet/specs/tech-spec/algorithms.md:138–154` (`ALG-09`), and `tenet/specs/tech-spec/messages.md:11, 18–19, 60–61`.

## 1. Contract Verdict Table

| Contract field | Verdict | Evidence |
|---|---|---|
| Needs | met | Imports only `CP-0005` (`src/core/{git,hash,messages,output}.ts`) and `picomatch` / `fast-xml-parser` (`src/reports/scan.ts:2–3`, `src/reports/registry.ts:3`). |
| Owns | met | All files remain under `src/reports/`, `test/reports/`, `pkg/conformance/alg-08/`, and `pkg/conformance/alg-09/`. |
| Exports | met | `readReport`, `reportRegistry`, `parseAcceptance`, `scanTests`, `declaredTags`, `itemResults`, and `weakening` are exported from `src/reports/index.ts`. |
| Behavior | met | All 5 round 3 blockers and both round 3 shoulds are fixed; one minor residual nit remains on `itemResults` custom-prefix stripping (noted below). |
| Edge cases | met | All contract edge cases and the round 3 edge cases (fences, identifier tag punctuation/boundaries, JUnit `<testsuite file>` inheritance, empty `name`/`classname`, pytest `<error>` body teardown, CTRF `filePath`, Go `Elapsed` and repeated terminal `attempts`, Jest unknown-status `TN-REPORT-MALFORMED`, `via_describe` inheritance, expression-body arrow tests, comment-safe brace scanning, and comment-line skip patterns) are covered and pass. |
| Out of scope | met | Check execution and proof card rendering remain in `CP-0051`. |
| Fixtures | met | `test/reports/reports.test.ts:538–591` loads and executes all 16 cases in `pkg/conformance/alg-08/cases.json` and all 5 cases in `pkg/conformance/alg-09/cases.json`. |
| Proving | met | `npm test -- test/reports` runs 36 tests (15 unit tests + 16 `ALG-08` conformance cases + 5 `ALG-09` conformance cases) with `36 pass, 0 fail`. |

## 2. Status of Round 3 Findings

| # | R3 severity & subject | R4 status | Evidence (`file:line`) |
|---|---|---|---|
| 1 | **blocker** · `parseAcceptance` return ordering, `implements` deduplication, `items[].text` whitespace, and fence matching | **fixed** | `src/reports/acceptance.ts:7, 16–25, 34–38, 43, 56–62` keeps first-seen order on deduplicated `implements` (`Set<string>`) and trimmed `items[].text`, collapses internal whitespace and sorts by ASCII `id` only inside `digest`, and closes code fences only on a matching fence character of at least the opening length (`run[0] === fence[0] && run.length >= fence.length`). Verified by `test/reports/reports.test.ts:342–360`. |
| 2 | **blocker** · `extractTags` and `stripTags` boundary and underscore cleanup for `tenet_<prefix>_<n>` | **fixed** | `src/reports/tags.ts:11–13, 15–39` uses `(?<![A-Za-z0-9])tenet_(${prefixes})_(\\d+)(?![A-Za-z0-9])` in `extractTags` and strips identifier tags per word in `stripTags` while cleaning leading/trailing underscores, collapsing `_{2,}` to `_`, and normalizing whitespace. Verified by `test/reports/reports.test.ts:362–372`. |
| 3 | **blocker** · `parseJunit`, `parseCtrf`, `parseGo`, and `parseJest` report reader rules (`evidence.md §2`) | **fixed** | `src/reports/registry.ts:127–133, 158–201` throws when both `name` and `classname` are empty, returns `name || classname` when one is empty, inherits `file` from ancestor `<testsuite file="…">`, inspects `<properties>` only as direct children of `<testcase>`, and checks `<error>` body text (unwrapping CDATA) in `isTeardown`; `src/reports/registry.ts:219` reads `entry.filePath ?? entry.file` in CTRF; `src/reports/registry.ts:259–270` collapses repeated Go terminal events into `attempts` and converts `Elapsed` to `duration_ms`; `src/reports/registry.ts:298–302` throws on unknown Jest statuses. Verified by `test/reports/reports.test.ts:374–435`. |
| 4 | **blocker** · `attachDescribeSources` `via_describe`, comment/expression-safe `declarationEnd`, and `declaredTags` inherited `AB-n` on new inner tests | **fixed** | `src/reports/scan.ts:301–316` sets `via_describe: true` only when an enclosing `describe(` contributes a tag absent on the declaration (`inherited.length > 0`) and marks each inherited `TagSource` with `via_describe: true`; `src/reports/scan.ts:396–458` skips `//`, `/* */`, and quoted strings and returns at `rounds === 0` for expression-body arrow callbacks; `src/reports/declared.ts:28–31` counts `sourceTag.via_describe` when `added.has(declaration.line)` or any `declaration.title_lines` line is in `added`. Verified by `test/reports/reports.test.ts:437–464`. |
| 5 | **blocker** · `weakening` `skip-added` comment filtering and innermost enclosing declaration selection (`ALG-09`) | **fixed** | `src/reports/scan.ts:383–387` ignores `//` comment lines and `.py` `#` comment lines in `skipPattern`; `src/reports/weakening.ts:87–97, 143–162` picks the innermost enclosing declaration (`declaration.line > enclosing.line`, or narrower `end_line` on tie), then the nearest declaration within 3 lines (`declaration.line - line <= 3`), else `text.trim()`. Verified by `test/reports/reports.test.ts:466–488`. |
| 6 | **should** · Canonical `messages.md` templates for `TN-REPORT-MISSING`, `TN-REPORT-MALFORMED`, `TN-ACC-MISSING-ID`, and `TN-ACC-DUP-ID` | **fixed** | `src/reports/errors.ts:1–16`, `src/reports/read.ts:18–26, 47–53`, and `src/reports/acceptance.ts:2, 65–79` now format all four codes directly through `message(code, vars)` from `src/core/messages.ts`. Verified by `test/reports/reports.test.ts:354–359, 420–431`. |
| 7 | **should** · Execute `pkg/conformance/alg-08/cases.json` and `pkg/conformance/alg-09/cases.json` in `test/reports` | **fixed** | `test/reports/reports.test.ts:538–591` loads both files and registers a `node:test` case per entry (16 `ALG-08` cases and 5 `ALG-09` cases), all of which run and pass. |
| 8 | **nit** · `titleMatches` in `src/reports/items.ts` uses default prefix `"R"` when stripping tags from `testCase.full_name` | **not fixed (remains nit)** | `src/reports/items.ts:20, 61–64` still calls `stripTags(fullName)` with default prefix `"R"`, so if a project configures a non-`"R"` `id_prefix` (e.g. `"C"`) and a test title embeds `[C-1]` after the declaration prefix or via `tenet_C_1`, `titleMatches` does not strip `C-1` unless `stripTags` is given the prefix or `testCase.tags` are stripped. Non-blocking nit. |

## 3. Judgment on the Changed `ALG-09` Conformance Fixture (`9de93f8`)

Commit `9de93f8` updated `pkg/conformance/alg-09/cases.json:51–72` (`"skip-added"`):
- Input `after["value.test.ts"]` is `it.skip("disabled", () => {});\n`.
- Under `ALG-09` (`tenet/specs/tech-spec/algorithms.md:142`), the recognized JS/TS declaration regex is `(?:^|[^\w$.])(?:it|test)(?:\.each\([^)]*\))?\s*\(`, which matches `it(` / `test(` / `it.each(...)` / `test.each(...)` and intentionally does **not** match `it.skip(`.
- Under `ALG-09` (`tenet/specs/tech-spec/algorithms.md:150`), `skip-added` sets `names` to *"innermost enclosing declaration or next within 3 lines, else trimmed line"*.
- Because `value.test.ts` has only `it.skip("disabled", () => {});` with no enclosing or following declaration, `ALG-09` requires `names` to fall back to the trimmed line `["it.skip(\"disabled\", () => {});"]`.
- **Verdict:** The fixture correction in `pkg/conformance/alg-09/cases.json:66` is **sound and faithful to `ALG-09`**.

## 4. New Defects Introduced by `9de93f8`

- **Blockers:** None.
- **Shoulds:** None.
- **Notes / Nits:** Only the carried-over nit in `src/reports/items.ts:20, 61–64` (stripping `testCase.tags` in `titleMatches` when a non-`"R"` requirement prefix appears inside a test name).
