---
name: tenet-review-with-findings
description: Review a pull request against Tenet's proof card and touched blessed requirements, reporting structured findings without approving self-authored work.
---
# Review with Findings (`tenet-review-with-findings`)

Use this skill when reviewing a pull request in a Tenet repository:

1. **Read the proof card first (or run a local preview if none exists).**
   Inspect the `Tenet` check run card on the pull request before reading code diffs: note which commit was tested, the blessed requirements touched (`implements`, `cited-code-changed`, `text-changed`, `same-area`), item test counts and authorship (`written-here`, `tag-added-here`, `unknown`), coverage status, weakening checks, protected paths, and spec deltas.
   - **When there is no proof card** (for example, on the setup pull request, on a non-GitHub forge, or before CI runs): state explicitly in your review that no proof card exists, inspect the requirements named in `Implements:` with `tenet context --ids <Implements>` (and `tenet context --paths <changed files>`), and run `tenet verify --local` to preview checks, weakening, and deltas locally.

2. **Compare blessed intent against the change.**
   For every touched requirement, read its **blessed text** (remember that `edited` or `sources-changed` requirements still enforce their blessed text). Check whether the implementation, tests, and any proposed spec edits satisfy the blessed text rather than merely matching new code to new tests.

3. **Report each finding in the `review` shape.**
   For every issue you find, state:
   - Classification: `introduced` (added by this change), `exposed` (pre-existing issue surfaced by this change), `inherited` (already in unchanged code), or `uncertain`
   - Evidence: exact `file:line` location or reproducible failing case, quoting both the requirement/criterion and the code or test under review

4. **Respect independence rules.**
   Never approve work you wrote. Do not approve or dismiss missing tests (`no-test`, `not-run`, `coverage: not-confirmed`) as "proven" — state explicitly what was checked and what still needs human judgment.
