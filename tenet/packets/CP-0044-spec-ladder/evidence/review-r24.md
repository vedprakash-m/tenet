# Review — CP-0044 round 24 (PR #26 brace rule)

- **Branch reviewed:** `r24/review-mai-fixes-track2` at `origin/main` (`e0c18c8`)
- **Scope:** PR #26 (`cbb6d70`, `src/specs/parse.ts` and `test/specs/review-r4.test.ts`) against the [contracts.md §3](../../../specs/tech-spec/contracts.md#L57-L64) requirement metadata brace clarification (`CP-0054` second-pass ruling).

## Assessment

1. **Does the code do exactly what the ruling says, no more and no less?**
   - **Yes.** `contracts.md §3` (`contracts.md:63`) specifies that requirement metadata braces close the line (`- <ID> <text> {…}`) outside inline code, while braces inside backticks or mid-line remain prose.
   - `outsideInlineCode()` (`src/specs/parse.ts:148-170`) replaces matching single- and multi-backtick code spans character-for-character with spaces so UTF-16 offsets remain aligned 1:1 with `value`, ignoring unclosed backtick runs (`lines 162-165`).
   - `metadataRange()` (`src/specs/parse.ts:172-187`) examines `outside.trimEnd()` so trailing code spans like `` `{foo}` `` are ignored, treats only a trailing `{…}` at line end (`trimmed[close] === "}" && open >= 0 && open < close`) as a metadata block, flags unclosed trailing braces containing a colon (`open >= 0 && completedMidLine < 0 && /:/.test(...)`) as `"malformed"` (`TN-SPEC-REQ-META`), and treats mid-line `{…}` and inline-code `{…}` as prose.
   - `parseMetadata()` (`src/specs/parse.ts:212-246`) slices the original `text` using those aligned indices (`text.slice(open + 1, close)`), rejects metadata keywords outside the trailing block (`lines 219, 232`), parses `;`-delimited fields (`origin`, `cites`, `serves`, `scope`, `adopted_by`), and validates `origin`.
   - `hasTrailingMetadata()` (`src/specs/parse.ts:189-199`) and `parseStatements()` (`lines 566-569`) ensure prose bullets outside `Requirements`/`Vision`/`L0` that end in technical `{path, reason}` or `{path: reason}` never emit `TN-SPEC-MISSING-ID`, while bullets carrying trailing Tenet metadata keys (`origin|cites|serves|scope|adopted_by|adopted by:`) still require an ID.

2. **Is it tested, including edge cases named in the ruling?**
   - **Yes**, for the primary cases: `test/specs/review-r4.test.ts:85-127` tests trailing inline-code braces `` `{path, reason}` ``, mid-line inline-code `` `{path: reason}` ``, valid trailing `{origin: asked; scope: global}`, unclosed `{origin: asked` (`TN-SPEC-REQ-META`), and non-requirement `## Design` bullets ending with `` `{path, reason}` ``, `{path: reason}`, and `{path, reason}`. Existing `r4 B3` (`lines 76-83`) preserves detection of metadata outside braces.
   - Minor non-blocking coverage notes below.

3. **Can a user be surprised or lose data?**
   - **No.** `src/specs/parse.ts` is a pure read-only parser; it creates, modifies, or deletes no files.

4. **Does any test reach the network or the real home folder?**
   - **No.** `test/specs/review-r4.test.ts:85-127` runs pure in-memory parsing with zero filesystem outside tmp fixtures, zero network calls, and zero home-directory access.

---

## Shoulds & Notes (Non-blocking)

- **Note N1 (`src/specs/parse.ts:148-169` — escaped backticks):** `outsideInlineCode()` does not special-case backslash-escaped backticks (`` \` ``); acceptable for Markdown spec bullets unless literal escaped backticks with `{` appear later.
- **Note N2 (`src/specs/parse.ts:178-186` — unclosed `{` without colon and trailing `{}`):** On a governed requirement line, unclosed braces lacking `:` (such as `- R-1 Keep {foo`) return `null` rather than `TN-SPEC-REQ-META`, avoiding false positives on incomplete expressions while still rejecting `- R-1 ... {origin: asked`; conversely, ending a governed requirement with unbackticked `{}` emits `TN-SPEC-REQ-META` as expected by `contracts.md:63`.
- **Note N3 (`src/specs/parse.ts:195, 198` vs `lines 219, 232` & test gap):** `hasTrailingMetadata()` matches `;`-preceded keys (`(?:^|\s|;)`) whereas `parseMetadata()`'s outside-braces check matches `(?:^|\s)`. Adding unit cases for unbackticked non-requirement `{origin: asked}` (`TN-SPEC-MISSING-ID`), trailing `{unknown: x}` (`TN-SPEC-REQ-META`), and inline-code metadata values inside `{...}` (e.g. ``{origin: asked; scope: `x`}``) would tighten regression coverage.

## Verification Observed on `r24/review-mai-fixes-track2` (`e0c18c8`)

- `npm test -- test/install/doctor.test.ts test/install/integrity.test.ts test/install/cli.test.ts test/specs/review-r4.test.ts`: **37 passed, 0 failed, 0 skipped** (includes all `test/specs/review-r4.test.ts` cases).

VERDICT: APPROVE
