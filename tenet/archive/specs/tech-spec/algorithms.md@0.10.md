# Tenet technical specification: algorithms

> Level L2 · Version 0.10 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0023

**Context card.** Each algorithm a builder must implement identically: inputs, steps, outputs, error codes and the fixtures that prove it. Formats are in [contracts.md](contracts.md). Error codes are stable; every error also carries plain words and a fix (R-083). Fixtures live in `pkg/conformance/alg-<nn>/` with their expected outputs.

## ALG-01

**Subject digest (`git-tree`).** Input: a commit. Run `git -c core.quotepath=false ls-tree -r --full-tree <commit>`; drop paths under the records folder, `.tenet/` and generated views; sort by path bytes; digest = `sha256:` over the lines `<mode> <type> <oid>\t<path>` joined by `\n`. Symlinks and submodules (mode `160000`) are included as listed; LFS files as their pointer. A working tree with uncommitted changes has no subject (`TN-SUBJ-DIRTY`); local advisory runs commit nothing and say so. In CI the tested commit is the merge candidate when the forge provides one. Fixtures: identical trees on three platforms; a change only in `tenet/` keeps the digest; a renamed file changes it.

## ALG-02

**Sections and digests.** Skip front matter. A section runs from a line starting `## ` (outside fenced code) to the next such line or end of file; text before the first is `_preamble`. Slug: lowercase; drop characters other than `a-z`, `0-9`, space and `-`; spaces to `-`; collapse repeated `-`; trim `-`. A duplicate slug in one file is `TN-SPEC-DUP-SECTION`. Digest = `sha256:` over the section text with CRLF→LF, trailing spaces trimmed per line and trailing blank lines removed. Fixtures: CRLF and LF give one digest; editing one section leaves the others' digests unchanged; a `## ` inside a code fence is not a heading.

## ALG-03

**Blessing and flags.**
- `bless(section)` requires an interactive terminal (else exit 2), no open conflict or question naming the section, and no `origin: inferred` statement left (each is edited or adopted, which sets `origin: asked; adopted_by`). The person chooses who they are from `owners[]`; `recorded: self`.
- Blessing writes `state: blessed`, `blessed_digest` = current digest, `blessed_at_rev` = `HEAD`, and a copy of the text to `<records>/blessed/<document path with / as __>/<slug>.md` (`blessed_copy`). Bless prints the `git commit` command; it never commits.
- **Flags**, recomputed by `check` and `board`: `edited` when the digest differs from `blessed_digest`; `sources-changed` when, since `blessed_at_rev`, a cited file was deleted, a cited test name no longer appears in its file, or `git diff -U0` changed a line overlapping a cited range (old-side line numbers).
- **Text in force** is always the blessed copy. Re-blessing replaces it. `reject` sets `rejected`, which context excludes. `defer` sets `deferred`, which context returns as a hint.
- **Owner:** front matter, else the owners on the last CODEOWNERS line matching the document (GitHub's rule), else the Owner.
- Fixtures: the "retry once" case (bless, change the code to retry twice: context still returns "retry once" with `sources-changed`); an edited section keeps the old text in force; a section with an open conflict cannot be blessed.

## ALG-04

**Citation resolution.** For drafts, resolve at `drafted_from`; for blessed sections, at `blessed_at_rev`.
- `path:start-end`: the file exists and `1 ≤ start ≤ end ≤ line count`.
- `doc: path#slug`: a heading with that slug exists.
- `test: file > name`: the file exists and contains `name` literally, or the inventory lists that case.

Errors: `TN-CITE-FILE`, `TN-CITE-RANGE`, `TN-CITE-HEADING`, `TN-CITE-TEST`. Resolving says nothing about whether the source supports the statement; that judgment is the spec reviewer's, labelled advisory.

## ALG-05

**Event reduction** (alpha.1).
1. Load a work item's events and validate each.
2. A duplicate ID with identical content is ignored; with different content it is `TN-EV-DUP`.
3. An event whose `prev` names an unknown ID is held as an orphan (`TN-EV-ORPHAN`) and not reduced.
4. Order topologically over `prev`, ties by ID.
5. Two state events, neither an ancestor of the other, **conflict** when they are:
   - `work.moved` with different stations
   - `work.status` with different statuses
   - `work.changed` setting the same scalar field differently
   - `work.closed` against any state event
   - `claim.stated` for the same claim ID

   Disjoint field changes merge, and note events never conflict.
6. A `resolve` whose `prev` includes every conflicting head keeps the event it names. A later incompatible event starts a new conflict.

Fixtures: every arrival order of the same set gives one state; a resolution delivered twice applies once.

## ALG-06

**Selectors and policy merge.**
- **Paths:** picomatch globs, case-sensitive, forward slashes. A path matches if any include matches and no `!` pattern does.
- **Areas:** come from `tenet.yaml`, else CODEOWNERS (last matching line wins). An unknown area makes applicability unknown.
- **Layering:** pack, then area, then project. A later layer may only tighten; loosening is refused at load (`TN-POLICY-LOOSEN`).
- **Merging claims of one type:**
  - methods: the intersection; empty is `TN-POLICY-INCOMPATIBLE`
  - strength: the maximum per axis
  - binary pass rules: all must pass
  - baseline-relative: the smallest tolerance
  - probabilistic: the higher rate and the larger run count
  - different pass-rule kinds: incompatible

## ALG-07

**Gate: verdict, disposition, next action.**

Each applicable claim's result is `satisfied`, `waived`, `failed`, `unsatisfied` (no fresh evidence) or `unknown` (a missing field or input, named). Evidence claims are satisfied only by evidence and approval claims only by an `approve`; an approval offered for an evidence claim is `TN-GATE-APPROVE-NOT-EVIDENCE`. The verdict is the first matching row:

| # | Condition | Verdict | Reason | Next action |
|---|---|---|---|---|
| 1 | Frozen | refuse | `TN-GATE-FROZEN` | whoever froze it thaws it (M3) |
| 2 | In conflict | refuse | `TN-GATE-CONFLICT` | a `resolve` request |
| 3 | Applicability unknown | refuse | `TN-GATE-UNKNOWN` | fix the policy input it names |
| 4 | Policies incompatible | refuse | `TN-POLICY-INCOMPATIBLE` | fix the policy |
| 5 | Stop threshold met (even if claims pass) | refuse | `TN-GATE-STOP` | escalation to the level that can answer |
| 6 | Trust-surface claim not satisfied | human gate | `TN-GATE-TRUST` | `change-policy` request |
| 7 | Review incomplete or `requires_human` | human gate | `TN-GATE-REVIEW` | a person adjudicates |
| 8 | Any claim failed, unsatisfied or unknown, and not waived | refuse | `TN-GATE-CLAIM` | failed with rounds left: the builder revises; rounds exhausted: human gate (accept with findings, revise, stop); evidence missing or stale: wait for CI; approval missing: a decision request |
| 9 | Otherwise | advance | — | — |

**Disposition:** rows 1–4 always block a move. Rows 5–8 take the mode of the rule behind them (`stop-threshold`, `protected-surfaces`, `review-converged` or the claim's rule): `enforce` blocks, `advise` shows "would have blocked", `observe` records only.

**Output:** `{claims: [{id, result, reason}], verdict, disposition: blocks|advises|records, reasons, next: {who, action, command}, evaluated_at, snapshot}`.

Fixtures: one per row, plus an advisory failure with an enforced pass (verdict refuse, disposition advises) and a stop threshold with all claims passing.

## ALG-08

**Test-report normalization.**

| Format | Case name | Status | Tags |
|---|---|---|---|
| JUnit (any `testsuite` nesting) | `classname > name` | failure → fail, error → error, skipped → skip | from the name plus `tenet.case` properties |
| CTRF | `tests[].name` | passed, failed, skipped (pending and other count as skip) | from the name plus `extra.tenet_cases` |
| `go-test-json` | `Package > Test` | the final pass, fail or skip action | from the name |
| `jest-json` | `assertionResults[].fullName` | its status | from the name |

A case repeated by retries takes its last status. A missing report is `TN-REPORT-MISSING`, an unreadable one `TN-REPORT-MALFORMED`, and zero cases makes the result inconclusive. An acceptance item is **proven** when at least one case tagged with its ID passed and none tagged with it failed, errored or was skipped.

## ALG-09

**Weakening.** Test files match `**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}`, `**/test_*.py`, `**/*_test.py`, `**/*_test.go`, `**/*Test.java` (configurable). Over `git diff -M -U0 <merge-base>..<tested>`:

| Finding | Detected when |
|---|---|
| `removed-tests` | The count of `it(`, `test(`, `def test_`, `func Test`, `@Test` falls in a file |
| `skip-added` | An added line contains `.skip(`, `.only(`, `xit(`, `xdescribe(`, `test.todo(`, `@pytest.mark.skip`, `@pytest.mark.xfail`, `pytest.skip(`, `t.Skip(`, `@Disabled` or `@Ignore` |
| `file-deleted` | A test file is deleted with no rename |

The card says "no weakening detected by these checks", never "no weakening".

## ALG-10

**Context selection.**
- **Inputs:** `paths`, `ids`, `query`, `include_drafts`, `budget_tokens` (default 4,000).
- **Candidates:** blessed sections, using their blessed copies.
- **Groups, in order:**
  1. requirements whose ID is named
  2. requirements citing a path equal to, inside or containing an input path
  3. requirements whose text contains the query, case-insensitive
  4. requirements marked `scope: global`, such as cross-cutting never-dos
  5. rules of the areas the paths fall in
- **Ordering:** within a group, by level (L0, L1, L2) then ID; duplicates are dropped.
- **Budget:** add whole requirements while they fit (tokens = characters ÷ 4). Then add an index of the remaining blessed requirements (ID and first 80 characters) up to 20% of the budget, and set `truncated`.
- **Flags and reasons:** flags travel with each requirement; each carries the group that chose it as `reason`.
- **Drafts:** only with `include_drafts`, in `drafts`.
- **No inputs:** groups 4 and 5 plus the index.

## ALG-11

**Size rule.** Count lines in tracked files with extensions `ts tsx js jsx mjs cjs py go rs java kt cs rb php swift c cc cpp h hpp scala`, excluding `vendor/`, `node_modules/`, `dist/`, `build/`, generated paths and test files. The layout is `separate` when there are ≥ 20,000 lines or ≥ 4 CODEOWNERS areas, otherwise `one-file`. `onboard --layout` overrides.

## ALG-12

**Install and removal.**
- **`init` plans every write**, then applies it:
  - a created file that exists with identical content is skipped; with different content it is `TN-INIT-EXISTS` (pass `--force` to replace)
  - blocks go at the end of the file, or replace an existing block
  - JSON keys are set with their previous value recorded
  - the manifest is written last; a rerun after an interruption completes the plan
- **`remove`:**
  - deletes a created file only if its SHA-256 matches the manifest; otherwise it is kept and reported as "edited by you"
  - deletes text between markers
  - restores each key's previous value, or deletes the key
  - deletes a created file left empty
  - never touches specifications or records
- Fixtures: a pre-existing `AGENTS.md` and `.mcp.json` are restored exactly; an edited `tenet.yaml` is kept.

## ALG-13

**Onboarding measures** (V-M12).
- **A statement** is one requirement line, or one sentence in a vision, design, experience or plan section.
- **Kept:** its text, with whitespace collapsed and the `{…}` metadata removed, is identical in the draft and the blessed copy. Anything else is a substantive edit.
- **Denominator:** statements in sections blessed or rejected; deferred sections are reported separately.
- **Recall:** answer-key obligations matched by a kept or edited statement, judged by a human scorer.
- **Invented:** statements the scorer finds in neither the sources nor the answer key.
- **Blessing minutes:** summed from the `tenet bless` session timestamps.
- **Automatic checks:**
  - every citation resolves
  - every planted conflict in the fixture key appears as a `CF` item
  - every `asked` statement has an answer in `.tenet/onboard/interview.json`
- **Each run records** agent, model, effort and fixture revision.
