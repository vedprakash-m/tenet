# Tenet technical specification: algorithms

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0023 · Previous version: `archive/specs/tech-spec/algorithms.md@0.11.md`

**Context card.** Each algorithm a builder must implement identically: inputs, steps, outputs, error codes and the fixtures that prove it. Formats are in [contracts.md](contracts.md); error codes and their exit codes in contracts §13. Every error also carries plain words and a fix (R-083). Fixtures live in `pkg/conformance/alg-<nn>/` with their expected outputs.

## ALG-01

**Subject digest (`git-tree`).** Input: a commit.
1. Run `git ls-tree -r -z --full-tree <commit>` and split on NUL; paths are raw bytes, never re-encoded.
2. Drop paths under the records folder, `.tenet/` and generated views.
3. Sort by path bytes (`Buffer.compare`, never `localeCompare` or UTF-16 order; RFC 8785 keys keep UTF-16 order, contracts §11).
4. Digest = `sha256:` over each entry as `<mode> <type> <oid>\t<path>\0`, concatenated.

Symlinks and submodules (mode `160000`) are included as listed; LFS files as their pointer. A working tree with uncommitted changes has no subject (`TN-SUBJ-DIRTY`); local advisory runs commit nothing and say so. In CI the tested commit is the merge candidate when the forge provides one. Fixtures: identical trees on three platforms; a change only in `tenet/` keeps the digest; a renamed file changes it.

## ALG-02

**Sections and digests.**
- Skip front matter. A section runs from a line starting `## ` to the next such line or end of file; text before the first is `_preamble`. Fences follow CommonMark: an opening run of 3 or more backticks or tildes is closed only by a run of the same character at least as long, and headings inside a fence don't count.
- **Slug:** lowercase; keep Unicode letters and digits (categories L and N), spaces and `-`; drop everything else; spaces to `-`; collapse repeated `-`; trim `-`. An empty slug becomes `section-<n>`, its position. A duplicate slug in one file is `TN-SPEC-DUP-SECTION`.
- **Digest:** `sha256:` over the section **body** (without its `## ` line) with CRLF→LF, trailing spaces trimmed per line, trailing blank lines removed, and citation ranges normalized (`path:40-48` and `path:42` both become `path`), so moving a citation's lines never makes a section `edited`.
- **Rename:** when a front-matter entry's slug no longer exists and exactly one new section has its digest (or its `blessed_digest`), `tenet fix` moves the entry and renames the blessed copy and its anchors file. Two or more candidates are left for a person. A split or merge is a new section and needs blessing.

Fixtures: CRLF and LF give one digest; editing one section leaves the others unchanged; a `## ` inside a code fence is not a heading; a Japanese heading keeps its slug; a renamed heading keeps its blessing.

## ALG-03

**Blessing and flags.**
- **`bless(section)`** requires:
  - an interactive terminal (else `TN-BLESS-NO-TTY`)
  - no open conflict or question naming the section (`TN-BLESS-OPEN-CONFLICT`)
  - no `origin: inferred` statement left (`TN-BLESS-INFERRED`; each is edited, or adopted, which sets `origin: asked; adopted_by`)

  The person picks who they are from `owners[]`; `recorded: self`.
- **Blessing writes:**
  - `state: blessed`, `blessed_digest` = the current digest, `blessed_at_rev` = `HEAD` (information only)
  - `anchors`: for each citation, `sha256` over its cited lines (CRLF→LF, trailing spaces trimmed); the lines themselves go to `<blessed copy>.anchors.json`, so `confirm` can show old against new after a squash. A `test:` citation anchors its declaration line and body up to the next declaration; a `doc:` citation anchors that section's digest
  - a copy of the text at `<records>/blessed/<document path with / as __>/<slug>.md`
  - a line in `<records>/blessed/log.jsonl` (ALG-13)

  It prints the `git commit` command; it never commits.
- **Session actions:**
  - bless (and bump the document's `version` when blessed text changed)
  - **confirm**: only for `sources-changed` sections. It shows each changed anchor's old and new lines, then keeps the text, re-anchors and records a blessing.
  - **edit**: opens `$VISUAL`, else `$EDITOR`, else `notepad` on Windows or `vi`, then re-parses.
  - **reject** and **defer**: on a section that was never blessed, they set `rejected` (excluded from context) or `deferred` (returned as a hint). On an `edited` blessed section, they act on the edit: the blessed copy stays in force, and the person is offered to restore the file's text from it.
- **Flags**, recomputed by `check` and `board` at the current revision:
  - `edited`: the section's digest differs from `blessed_digest`
  - `sources-changed`: an anchored range's lines no longer hash to its anchor, or the file or test is gone. If the same lines appear **exactly once** elsewhere in the file (a sliding-window hash scan; files over 50,000 lines are not scanned and are flagged), they moved: `check` doesn't flag them and `fix` updates the range. Zero or several matches flag `sources-changed` ("matched N places").
- **Integrity:** the blessed copy's digest must equal `blessed_digest` (`TN-SPEC-BLESSED-COPY`); a copy that fails is served as a draft with a warning.
- **Text in force** is always the blessed copy. Re-blessing replaces it.
- **Owner:** front matter, else the owners on the last CODEOWNERS line matching the document (GitHub's rule), else the Owner.
- **Fixtures:**
  - "retry once": bless, change the code to retry twice; context still returns "retry once" with `sources-changed`
  - squash-merge the blessing, then clone with `--depth 1`; flags still compute
  - lines shifted by an edit above them are not flagged
  - an edited section keeps the old text in force
  - rejecting an edit keeps the blessed text
  - a section with an open conflict cannot be blessed
  - a hand-edited blessed copy fails `check`

## ALG-04

**Citation resolution,** at the current revision (the working tree for `check`; the tested commit in CI):
- `path:start-end`: the file exists and `1 ≤ start ≤ end ≤ line count`; for blessed sections, the anchor rules of ALG-03 apply.
- `doc: path#slug`: a heading with that slug exists.
- `test: file > name`: the file exists and each segment of `name` split on ` > ` appears in it as written, or as `def <segment>` or `func <segment>`.

Errors: `TN-CITE-FILE`, `TN-CITE-RANGE`, `TN-CITE-HEADING`, `TN-CITE-TEST`. Resolving says nothing about whether the source supports the statement; that judgment is the spec reviewer's, labelled advisory. Fixtures: a nested `describe > it` name resolves; a renamed test fails.

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

Each applicable claim's result is `satisfied`, `waived`, `failed`, `unsatisfied` (no fresh evidence) or `unknown` (a missing field or input, named). Evidence claims are satisfied only by evidence, and approval claims only by an `approve`. An approval offered for an evidence claim is `TN-GATE-APPROVE-NOT-EVIDENCE`, whether or not the claim is waivable. **Every row is evaluated:**

| # | Condition | Verdict | Reason | Rule (mode) | Next action |
|---|---|---|---|---|---|
| 1 | Frozen | refuse | `TN-GATE-FROZEN` | always enforce | whoever froze it thaws it (M3) |
| 2 | In conflict | refuse | `TN-GATE-CONFLICT` | always enforce | a `resolve` request |
| 3 | Applicability unknown | refuse | `TN-GATE-UNKNOWN` | always enforce | fix the policy input it names |
| 4 | Policies incompatible | refuse | `TN-POLICY-INCOMPATIBLE` | always enforce | fix the policy |
| 5 | Stop threshold met (even if claims pass) | refuse | `TN-GATE-STOP` | `stop-threshold` | escalation to the level that can answer |
| 6 | Trust-surface claim not satisfied | human gate | `TN-GATE-TRUST` | `protected-surfaces` | `change-policy` request |
| 7 | Review incomplete or `requires_human` | human gate | `TN-GATE-REVIEW` | `review-converged` | a person adjudicates |
| 8 | Any claim failed, unsatisfied or unknown, and not waived | refuse | `TN-GATE-CLAIM` | the claim's rule | failed with rounds left: the builder revises; rounds exhausted: human gate (accept with findings, revise, stop); evidence missing or stale: wait for CI; approval missing: a decision request |
| 9 | None of the above | advance | — | — | — |

**Combining.**
- **Verdict:** `refuse` if any matching row refuses; else `human gate` if any matching row is one; else `advance`.
- **Disposition:** `blocks` if any matching row's rule is in `enforce`; else `advises` if any is in `advise`; else `records`.
- **Lead reason and next action:** the first matching row with the verdict's value. All matching reasons are listed.
- Property: adding an applicable claim that is enforced and unsatisfied never yields a more permissive verdict or disposition.

**Output:** `{claims: [{id, result, reason}], verdict, disposition: blocks|advises|records, lead, reasons, next: {who, action, command}, evaluated_at, snapshot}`.

Fixtures: one per row; an advisory review (row 7) beside an enforced failed claim (row 8): verdict refuse, disposition blocks; an advisory failure beside an enforced pass; a stop threshold with all claims passing.

## ALG-08

**Test reports and items.**

| Format | Case name | Status | Tags |
|---|---|---|---|
| JUnit (any `testsuite` nesting) | `classname > name` | failure → fail, error → error, skipped → skip | from the name plus `tenet.case` properties |
| CTRF | `tests[].name` | passed, failed, skipped (pending and other count as skip) | from the name plus `extra.tenet_cases` |
| `go-test-json` | `Package > Test`; a subtest (`Test/sub`) is its own case, and its parent doesn't count twice | the final pass, fail or skip action | from the name |
| `jest-json` | `assertionResults[].fullName` | its status | from the name |

- **Readers:** XML is read with entity expansion off, within the bundle limits (ci.md §4). A case repeated by retries keeps every status in `attempts`; its status is the last, and the card shows the first failure. Bundles from a matrix merge: a case's status is its worst across them. A missing report is `TN-REPORT-MISSING`, an unreadable one `TN-REPORT-MALFORMED`, and zero cases makes the result inconclusive.
- **Tagged declarations** (ALG-09 patterns, per runner): `it(` or `test(` with `.each`, and a multi-line call whose title is on the next 3 lines; `def test_…`; `t.Run(`; the method line after `@Test`, or the `fn` line after `#[test]`; `record_property("tenet.case", "<tag>")` inside a test body. A tag on `describe(` marks every declaration inside it.
- **Which tags count:** an acceptance tag (`AB-n`) counts for a pull request only on lines the pull request adds (`git diff -U0 <base>..<tested>`); a requirement tag counts wherever it is. Unknown and reserved-looking tokens are ignored (contracts §1).
- **Matching cases to declarations:** a case belongs to a declaration when the case's name, with tags removed, ends with the declaration's title or function name, with tags removed. Placeholders in a title (`%s %d %i %f %j %o %p %#`, `$name`, `${…}`) match any text, and pytest's parameter suffix `[…]` is dropped first (checked on real reports in Spike C). Parameter instances, retries and shards roll up to their declaration. `coverage` is `confirmed` when every tagged declaration has at least one case; otherwise `not-confirmed`, and the card says "N tagged results passed; coverage not confirmed" instead of claiming every test ran.
- **Item result:**
  - `failed`: any counted case failed or errored
  - `skipped`: all counted cases skipped
  - `not-run`: a tagged declaration has no case
  - `passed`: at least one case ran, all passed, and no tagged declaration lacks a case
  - `no-test`: no tag found at all
- **Authorship:** `written-here` when the declaration's title, with tags removed, doesn't exist at the base; `tag-added-here` when it does; `unknown` when it can't be told (for example a `describe` tag).
- **Check result versus case results:** a check whose process exits non-zero fails even when its report shows only passing cases (a teardown failure); its items keep their case results and the card shows the check's failure.
- **Fixtures:** one parameterized declaration plus a second that disappears from discovery gives `not-run`; an old `[AB-1]` from another pull request doesn't count; a tag added to an existing test gives `tag-added-here`; a fail-then-pass retry shows its first failure; a missing matrix shard; a teardown failure; each runner's declaration forms.

## ALG-09

**Weakening.**
- **Test files:** `**/*.{test,spec}.{ts,tsx,js,jsx,mjs,cjs}`, `**/test_*.py`, `**/*_test.py`, `**/*_test.go`, `**/*Test.java`, `**/tests/**/*.rs` (configurable).
- **Declarations:** `(?:^|[^\w$.])(?:it|test)(?:\.each\([^)]*\))?\s*\(`, `^\s*def\s+test_\w*\s*\(`, `^\s*func\s+Test\w*\s*\(`, `\bt\.Run\s*\(`, `^\s*@Test\b` (with the method on a following line) and `^\s*#\[test\]` (with the `fn` on a following line).

Over `git diff -M -U0 <base>..<tested>`:

| Finding | Detected when |
|---|---|
| `removed-tests` | A test name declared on a removed line is declared on no added line anywhere in the diff (moves between files are not removals) |
| `tests-consolidated` (a note, not a finding) | Names were removed and the same file adds `.each(`, `@pytest.mark.parametrize` or `t.Run(` |
| `skip-added` | An added line contains `.skip(`, `.only(`, `.todo(`, `.skipIf(`, `xit(`, `xdescribe(`, `@pytest.mark.skip`, `@pytest.mark.xfail`, `pytest.skip(`, `@unittest.skip`, `t.Skip(`, `@Disabled`, `@Ignore` or `#[ignore]` |
| `file-deleted` | A test file is deleted with no rename |

For each language present in the change with no recognized test files, the card says "not checked for: <language>". It says "no weakening detected by these checks", never "no weakening". Fixtures: deleting a call to `init(` finds nothing; moving a test between files finds nothing; three tests folded into `it.each` gives the note.

## ALG-10

**Context selection.**
- **Inputs:** `paths`, `ids`, `query`, `include_drafts`, `budget_tokens` (default 4,000).
- **Candidates:** blessed sections, using their blessed copies.
- **Groups, in order:**
  1. **global**: requirements marked `scope: global`, within a reserved 25% of the budget
  2. requirements whose ID is named
  3. requirements citing a path equal to, inside or containing an input path
  4. prose sections whose `applies_to` matches an input path
  5. requirements whose text contains the query, case-insensitive
- **Ordering:** within a group, by level (L0, L1, L2) then ID; duplicates are dropped.
- **Budget:** in estimated tokens (characters ÷ 4, not any model's tokenizer). Add whole items while they fit. Global rules beyond their 25% share still come first; what no longer fits goes to `omitted`. An item named in `ids` always comes back whole, flagged `over_budget` if it alone exceeds the budget, so asking for an omitted item by ID always ends. Every item that does not fit goes into `omitted` by ID, and `truncated` is set. Then add an index of the remaining blessed requirements (ID and first 80 characters) up to 20% of the budget.
- **Each item carries** its flags, its owner and `reason` (the group that chose it).
- **Drafts:** only with `include_drafts`, in `drafts`.
- **No inputs:** group 1 plus the index.

Fixtures: a global rule survives a budget filled by one long local requirement; the omitted IDs match between CLI and MCP.

## ALG-11

**Size rule.** Count lines in tracked files with extensions `ts tsx js jsx mjs cjs py go rs java kt cs rb php swift c cc cpp h hpp scala`, excluding `vendor/`, `node_modules/`, `dist/`, `build/`, test files and generated paths (marked `linguist-generated` in `.gitattributes`, or whose first 5 lines contain `Code generated` or `@generated`). The layout is `separate` when there are ≥ 20,000 lines or ≥ 4 CODEOWNERS areas, otherwise `one-file`. `onboard --layout` overrides. **Drafting units:** one per CODEOWNERS area, else one per top-level source folder, merging any unit under 2,000 lines into its neighbor; `one-file` is a single unit.

## ALG-12

**Install and removal.**
- **Paths:** every planned or recorded path is resolved and must stay inside the repository root: no absolute paths, `..`, or symlink or junction leading outside (`TN-PATH-ESCAPE`).
- **`init` plans every write**, then applies it:
  1. Write `.tenet/manifest.pending.json` with every planned file, block and key, and each key's current value.
  2. Apply in order, re-checking each file's hash just before writing it; a file that changed since planning stops the run with the plan shown. A created file that exists with identical content is skipped; with different content it is `TN-INIT-EXISTS` (pass `--force`). Blocks go at the end of the file, or replace an existing block. JSON keys are set.
  3. Rename the pending file to `manifest.json`, recording each key's `previous` and `installed` value.

  A rerun after an interruption finds the pending file and completes it.
- **`remove`:**
  - deletes a created file only if its SHA-256 matches the manifest; otherwise it is kept and reported as "edited by you"
  - deletes text between markers
  - restores a key's `previous` value only if it still holds the `installed` value; otherwise keeps it and says so
  - deletes a created file left empty
  - never touches specifications or records
- Fixtures: interruption after each write; a pre-existing `AGENTS.md` and `.mcp.json` are restored exactly; an edited `tenet.yaml` is kept; a key the user changed after install is kept.

## ALG-13

**Onboarding measures** (V-M12).
- **A statement** is one requirement line, or one sentence in a vision, design, experience or plan section.
- **Kept:** its text, with whitespace collapsed and the `{…}` metadata removed, is identical in the drafted text and the blessed text. Anything else is a substantive edit. `bless` computes this when it blesses, comparing with the section's text at `drafted_at_rev`, the commit holding the agent's draft (still on the branch when blessing happens), and writes it to `<records>/blessed/log.jsonl`. Without `drafted_at_rev` the measure is recorded as unavailable, never computed against later text.
- **Denominator:** statements in sections blessed or rejected; deferred sections are reported separately.
- **Recall:** answer-key obligations matched by a kept or edited statement, judged by a human scorer.
- **Invented:** statements the scorer finds in neither the sources nor the answer key.
- **Blessing minutes:** from the session's start and end, in the log.
- **Automatic checks:** every citation resolves; every planted conflict in the fixture key appears as a `CF` item; every `asked` statement has an answer in `.tenet/onboard/interview.json` (fixtures only).
- **Each run records** agent, model, effort and fixture revision.

## ALG-14

**Requirements a change touches.** Input: base and tested commits, the pull request's `Implements:`. Output: blessed requirements with `why`, in this order:
1. `implements`: named in `Implements:`
2. `cited-code-changed`: an anchored range overlaps a changed hunk (old-side lines), or a cited file or test is deleted or renamed
3. `text-changed`: the requirement's line or its section changed in this pull request
4. `same-area`: cites a file in the same CODEOWNERS area as a changed file (else the same top-level folder), capped at 10, shown collapsed as "may be affected"

A requirement appears once, under its first reason. Fixtures: a change to `src/retry.ts:42` lists "retry once" as `cited-code-changed`; a change to a sibling file lists it as `same-area`.
