---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.12", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:2f9d1d59b257b3ab489898cf4b5411ee0e4581dbd73f06b1957774b36ba21279, flags: []}
  alg-01: {state: draft, digest: sha256:0b13cbc010c9e82b3f86e65262d7337ab4cbc40c5e08bd910450cd52c789b56b, flags: []}
  alg-02: {state: draft, digest: sha256:cc03b1de45c5627e93bcca83195e83b309e06e7e00e4de22da04d558e9dd8973, flags: []}
  alg-03: {state: draft, digest: sha256:15376fb12a26789b5e8f69174577086b6781b1d6410fb8837f29d1a951498294, flags: []}
  alg-04: {state: draft, digest: sha256:5ff4dc20a07a51914c80b556fcc9d593e1e8a19268a533018fd5f02e3cadad7b, flags: []}
  alg-05: {state: draft, digest: sha256:9b2a64ae1a34580bbc5174c4a18ba3c910f6d10c30ed80f46edefecaad608324, flags: []}
  alg-06: {state: draft, digest: sha256:0cbd9e5f82705b68fd57374af166f71b101592693bdb37e018e54f9dcc8c79a6, flags: []}
  alg-07: {state: draft, digest: sha256:7ef3ef7c0147e7ab6116b5d701ea80dd9cd636642cbb3f27b4ba23e80c54c2b2, flags: []}
  alg-08: {state: draft, digest: sha256:c4d5319d8d0edc07c22879cb3ca32838c5962472d8d982331fc225eb98928662, flags: []}
  alg-09: {state: draft, digest: sha256:3e6b277eb5ad84a6752ef1bfd531f8a0d7218242eaedd4bf8db38961884755f9, flags: []}
  alg-10: {state: draft, digest: sha256:2dfb29a9a8cef5064362f1a3048f1cda924dfad11fc76d7069be265a45a06a72, flags: []}
  alg-11: {state: draft, digest: sha256:727c954ef8fda775ac06d62bdc306c121081b52c311d17369ddd841ca1b1807c, flags: []}
  alg-12: {state: draft, digest: sha256:dc3e580b30e1b3a68a940db6a0e4dd5d00db0df27f298a908dca31faef818e34, flags: []}
  alg-13: {state: draft, digest: sha256:5a9f1581f440047e7ab46d63e475226bf58363d09e926b25ad59dbcc0a15a9d2, flags: []}
  alg-14: {state: draft, digest: sha256:6d664f34e004ab89c35acc5865d574c8d5d78162ebe13d0612f8b69f56f7b6af, flags: []}
  alg-15: {state: draft, digest: sha256:8aa71e957bf5b528cec5808a5a4f8be7a4e64f3521457ef845df4ed67256b210, flags: []}
  alg-16: {state: draft, digest: sha256:05790334a2973c01bac8848a852f3e525b160c4a8158a22d1eb17874c4d718da, flags: []}
---
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
- Skip front matter. A section runs from a line starting `## ` to the next such line or end of file; non-empty text before the first `## ` is `_preamble` (omitted when empty/whitespace). Fences follow CommonMark: 3+ backticks or tildes close only with the same char at least as long; headings inside fences don't count.
- **Slug:** lowercase; keep Unicode letters and digits (categories L and N), spaces and `-`; drop everything else; spaces to `-`; collapse repeated `-`; trim `-`. Empty slugs become `section-<n>` (1-based non-preamble position). Duplicate slugs emit `TN-SPEC-DUP-SECTION` and stay in `sections[]`.
- **Digest:** `sha256:` over section **body** (without `## ` line): CRLF→LF, trim trailing `[ \t]` per line, strip trailing blank lines (keep leading newlines), normalize path citations `[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)+:\d+(?:-\d+)?` (or `[A-Za-z0-9._-]+\.[A-Za-z][A-Za-z0-9]*:\d+(?:-\d+)?`, never after `://`/`sha256:`, excluding trailing punctuation) to the path.
- **Rename:** when a front-matter entry's slug no longer exists and one new section (not `_preamble`, `conflicts`, `open-questions`) matches it, `fix` moves the entry, blessed copy and `.anchors.json`. Match by current `digest` first; only when that finds no candidate, by `blessed_digest`. `≥2` candidates in the deciding tier go to `ambiguous`; the result's `digest` is the value that matched. Split/merge is a new section and needs blessing.

Fixtures: CRLF and LF give one digest; editing one section leaves the others unchanged; a `## ` inside a code fence is not a heading; a Japanese heading keeps its slug; a renamed heading keeps its blessing.

## ALG-03

**Blessing and flags.**
- **`bless(section)`** requires:
  - **Proposal · CP-0068 AC-A4.** valid specification front matter before the first question, using contracts §3
  - an interactive terminal (else `TN-BLESS-NO-TTY`)
  - no open conflict or question naming the section (`TN-BLESS-OPEN-CONFLICT`)
  - no `origin: inferred` statement left (`TN-BLESS-INFERRED`; each is edited, or adopted, which sets `origin: asked; adopted_by`)

  The person picks who they are from `owners[]` (falling back to `ownersFor` when empty; `alpha.0` allows any configured owner, `recorded: self`). Before blessing, resolve each open conflict (`section` match or document-wide `null`; optional `affects: ID1, ID2`; `Resolution:` read case-insensitively): ask which drafted statement ID it contradicts (or `no`), open the editor, and require that statement's text to change or vanish before writing `resolution:` (else postpone or fail `TN-BLESS-OPEN-CONFLICT`).

  **Proposal · CP-0066 AB-A1–A5.** Enter selects a sole owner. The contradiction prompt lists the relevant statement IDs. `Decide later` leaves the conflict open, emits a warning, and continues with the other conflicts. During section review, skip sections with open conflicts. For each open question on a section about to be reviewed, offer `Answer`, `Not a blocker` and `Skip section`. The first two close the question with an `answer:`. The third leaves the question open and proceeds to the next section. Log elapsed review time per completed section from the start of its review through the action, including questions and edits. End every interactive session with `Blessed N of M sections`, counting confirmations in N and all selected sections in M. At N = 0 also print `Nothing is in force yet`. Then show how to commit changes or return to review.
- **Blessing writes:**
  - `state: blessed`, `blessed_digest` = the current digest, `blessed_at_rev` = `HEAD` (information only)
  - `anchors`: per citation, `sha256` over its cited lines (CRLF→LF, trailing `[ \t]` trimmed; file trailing `\n` dropped before 1-based split). **Proposal (CP-0066 AB-E2):** sidecar `<blessed copy>.anchors.json` maps each citation to `{hash, start, end, blessed_at_rev}` and never stores cited text. A `test:` citation anchors from the matching declaration line up to (exclusive of) the next outer/peer `ALG-09` declaration or EOF; a `doc:` citation anchors that section's digest and its inclusive source range.
  - a copy of the text at `<records>/blessed/<document path with / as __>/<slug>.md` (confined under `<records>/blessed/`, UTF-8 LF, refusing `/` vs `__` collisions with `TN-SCHEMA`)
  - a line in `<records>/blessed/log.jsonl` (ALG-13)

  Persist per finished section (copy, sidecar, atomic spec write after checking concurrent edits with `TN-SUBJ-DIRTY`, then log append); roll back that section's files on error. `EOF`/`SIGINT` keeps finished sections; prints `git commit` and never commits.
- **Session actions:** (`bless` prompts owner from `owners[]`, conflicts with numbered choices plus `Decide later`, then each section with `bless / edit / reject / later` or `confirm` when `sources-changed`; `later` records `defer`):
  - bless (on first blessing keep `version`; when blessed text changes, increment the final integer of dotted numeric `version` e.g. `0.1` → `0.2`, or increment trailing `.<n>` / append `.1` on legacy strings)
  - **confirm**: only for `sources-changed` sections. **Proposal (CP-0066 AB-E2):** it shows each changed anchor's old lines from `git show <blessed_at_rev>:<path>` when that object exists; otherwise it shows the recorded changed range. It shows the current lines as `New`, prompts `[y/N]`, then keeps the text, re-anchors and records a blessing.
  - **edit**: opens `$VISUAL`, else `$EDITOR`, else `notepad` on Windows or `vi`, then re-parses.
  - **reject** and **defer**: on a section that was never blessed, they set `rejected` (excluded from context) or `deferred` (returned as a hint). On an `edited` blessed section, they act on the edit: the blessed copy stays in force, and `"Restore the document's section from its blessed copy? [y/N] "` offers to overwrite the document section (`y` restores `digest === blessed_digest` and clears `edited`; `n` keeps the edited draft flagged `edited`).
- **Flags**, recomputed by `check` and `board` at the current revision (return `[]` when `section.state !== "blessed"`):
  - `edited`: the section's digest differs from `blessed_digest`
  - `sources-changed`: an anchored range's lines no longer hash to its anchor, or the file or test is gone. If the same lines appear **exactly once** elsewhere in the file (a sliding-window hash scan; files over 50,000 lines are not scanned and are flagged), they moved: `check` doesn't flag them and `fix` updates the range. Zero or several matches flag `sources-changed` ("matched N places").
- **Integrity:** the blessed copy's digest must equal `blessed_digest` (`TN-SPEC-BLESSED-COPY`, `file: doc.path`, `line`: 1-based `## ` heading line or `null` for `_preamble`); a copy that fails is served as a draft with a warning.
- **Text in force** is always the blessed copy. Re-blessing replaces it.
- **Owner:** the section's `owner`, else the document's `tenet.owner`, else the owners on the last CODEOWNERS line matching the document (GitHub's rule), else the Owner. `parseDoc` resolves the first two; callers apply the rest through `ownersFor`.
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
- `doc: path#slug`: a heading with that slug exists (missing `#slug` is `TN-CITE-RANGE`).
- `test: file > name`: `file` exists (missing ` > ` is `TN-CITE-RANGE`) and each segment split on ` > ` appears in order (`indexOf` advancing cursor) in `file` as written, `def <seg>` or `func <seg>`.

Errors, at most one per citation, checked as syntax, then file, then range, heading or test: `TN-CITE-FILE`, `TN-CITE-RANGE` (also every malformed citation: `doc:` without `#slug`, `test:` without ` > `, a range that isn't integer `start-end`, using the `TN-CITE-RANGE` template in `messages.md`), `TN-CITE-HEADING`, `TN-CITE-TEST` (carrying `severity: "error"` on direct `check` or `citations-valid` mode under `--ci --base`, `rule: "citations-valid"`, `file: doc.path`, and 1-based `line` of the citing statement, else `null`). Resolving says nothing about whether the source supports the statement; that judgment is the spec reviewer's, labelled advisory. Fixtures: a nested `describe > it` name resolves; a renamed test fails.

## ALG-05

**Event reduction** (alpha.1).
1. Load a work item's events and validate each.
2. A duplicate ID with identical content is ignored; with different content it is `TN-EV-DUP`.
3. An event whose `prev` names an unknown ID is held as an orphan (`TN-EV-ORPHAN`, a warning) and not reduced, with its descendants, until the predecessor arrives.
4. Order topologically over `prev`, ties by ID.
5. Two state events, neither an ancestor of the other, **conflict** when they are:
   - `work.moved` with different stations
   - `work.status` with different statuses
   - `work.changed` setting the same scalar field differently
   - `work.closed` against any state event
   - `claim.stated` for the same claim ID

   Disjoint field changes merge, and note events never conflict.
6. A `resolve` whose `prev` includes every conflicting head keeps the event it names and becomes the head. A later incompatible event starts a new conflict. Reduction follows cause only and never rejects a `work.moved` for its edge; `tenet move` and the gate check legal edges.
7. A cycle, a self-link or a predecessor from another work item is a structural finding: those events and their dependents are held, and the rest still reduces ([kernel §1](kernel.md#1-state-reduction-and-replay)).

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
  - health scopes: later layers never narrow `scope_globs` or add `exclude_globs` (`TN-POLICY-LOOSEN`)
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

**Output:** `{claims: [{id, result, reason}], verdict, disposition: blocks|advises|records, lead, reasons, next: {who, action, command}, blocking?, evaluated_at, snapshot}`. Order `reasons` by row (`1..8`), then ASCII `claim_id`; `blocking` is `{row, rule, claim_id, reason}` (`claim_id: null` for rows 1–5; `rule: "always-enforce"` for rows 1–4, which no rule produces, L-0043 OD-9) for the earliest enforcing match (L-0032); live `next.command` is `tenet resolve|decide|escalate|fix` or `null`. Author self-waiver sets claim reason `TN-GATE-SELF-WAIVE` and `verdict: "refuse"`.

Fixtures: one per row; an advisory review (row 7) beside an enforced failed claim (row 8): verdict refuse, disposition blocks; an advisory failure beside an enforced pass; a stop threshold with all claims passing.

## ALG-08

**Test evidence matching:** in [evidence.md §3](evidence.md#3-test-evidence-matching-alg-08) (moved under the rollover rule, L-0036).

## ALG-09

**Weakening:** in [evidence.md §5](evidence.md#5-weakening-alg-09), moved under the rollover rule.

## ALG-10

**Context selection:** in [mcp.md §2](mcp.md#2-context-selection-alg-10), moved under the rollover rule.

## ALG-11

**Size rule.** Count lines in tracked files with extensions `ts tsx js jsx mjs cjs py go rs java kt cs rb php swift c cc cpp h hpp scala`, excluding `vendor/`, `node_modules/`, `dist/`, `build/`, test files and generated paths (marked `linguist-generated` in `.gitattributes`, or whose first 5 lines contain `Code generated` or `@generated`). The layout is `separate` when there are ≥ 20,000 lines or ≥ 4 CODEOWNERS areas, otherwise `one-file`. `onboard --layout` overrides. **Drafting units:** `one-file` is a single unit `[{id: "root", paths: ["."], views: ["vision", "requirements", "design", "experience", "plan"]}]`. In `separate`, start with one unit per CODEOWNERS area (in CODEOWNERS order; `id` = pattern stripped of leading/trailing `/` and `*` with `/` → `-`, `paths: [<normalized prefix>]`), else one per top-level folder containing counted source files in ASCII order (`id` = folder name, `paths: ["<folder>"]`; root source files use `{id: "root", paths: ["."]}`); while `units.length > 1` and any unit has `< 2,000` counted source lines, merge the first such unit into its preceding neighbor (or following neighbor when at index `0`), keeping the target unit's `id` and appending `paths`; every unit has `views: ["vision", "requirements", "design", "experience", "plan"]`.

## ALG-12

**Install and removal:** in [onboarding.md §2](onboarding.md#2-install-and-upgrade), moved under the rollover rule.

## ALG-13

**Onboarding measures** (V-M12): in [onboarding.md §3](onboarding.md#3-onboarding-measures-alg-13).

## ALG-14

**Requirements a change touches.** Scan `.md` files with `tenet.spec` front matter at `head` (`base` fallback for deleted docs). Input: base and tested commits, `Implements:`. Output: blessed requirements with `why` (first-reason wins, ordered below, then sorted by numeric ID, then by the full ID in ASCII order):
1. `implements`: named in `Implements:`
2. `cited-code-changed`: path range, `test:` block, or `doc:` section's 1-based range at `base` overlaps a `git diff -U0` old-side hunk (`oldCount > 0` intersects `[start, end]`; `@@ -L,0` overlaps iff `start <= L && L < end`), cited section digest changed, or cited file/section/test deleted or renamed
3. `text-changed`: blessed doc/section deleted at head, section digest changed, line overlaps a `git diff -U0` head hunk, or a requirement blessed at base is gone at head or its section is no longer `blessed` (record read from base)
4. `same-area`: cites a file sharing the same area key (`codeowners:<pattern>` from last matching rule in first existing `.github/CODEOWNERS`, `CODEOWNERS`, `docs/CODEOWNERS` at head, else `dir:<top-level>` or `dir:.`) as a changed file, sorted by numeric ID then capped at 10, shown collapsed as "may be affected"

Fixtures: changing `src/retry.ts:42` → `cited-code-changed`; sibling file → `same-area`.

## ALG-15

**Touched-scope and rename diff mapper:** in [health.md §3](health.md#3-touched-scope-and-rename-diff-mapper-alg-15), moved under the rollover rule.

## ALG-16

**Health evaluation, architecture SCC and tamper routing:** in [health.md §2](health.md#2-health-evaluation-and-tamper-routing-alg-16), moved under the rollover rule.
