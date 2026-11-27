---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.1", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:26d538ceb8dca906e155bd8ee2209a4ef194ceac3f9e0e88616357a537553101, flags: []}
  1-placeholder-rules: {state: draft, digest: sha256:1e6a1cd11219981b7881f104b427d462b41e4b1d5a94909057cdead5325a084b, flags: []}
  2-message-and-fix-table: {state: draft, digest: sha256:efe407e09a19266b548f17e02a3d0bd74d575336294e4bad27244cadbe1f4754, flags: []}
  3-alpha1-message-templates: {state: draft, digest: sha256:07503ccd2ff728713ee1701a1f0c57453bf8aaf7195a005d14175412d2c95238, flags: []}
  4-01x-message-templates: {state: draft, digest: sha256:654fea1db55c4ca9d63acd84ea1f39951adfcb5e699eba2f01c0db40956e6422, flags: []}
---
# Tenet technical specification: error messages

> Level L2 · Version 0.1 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Previous version: `—`

**Context card.** Canonical message and fix templates for every `TN-*` error and warning code listed in [contracts.md §13](contracts.md#13-error-codes) and the algorithms. Builders substitute each `{named}` placeholder with the exact value in context so CLI output, thrown errors and `--json` findings (`{code, severity, rule, file, line, message, fix}`) use identical wording across implementations.

## 1. Placeholder rules

- Paths (`{path}`, `{file}`) use forward slashes and are relative to the repository root when known.
- IDs (`{id}`, `{ids}`) keep their exact identifier form (`R-12`, `AB-1`, `V-2`, `CF-1`, `Q-1`); comma-separated lists join with `", "`.
- When `readReport` formats `{path}` for `TN-REPORT-MISSING` or `TN-REPORT-MALFORMED`: relativize each path with forward slashes to `opts.cwd` when `opts.cwd` is passed and inside it (else forward-slash the given path). When `path` is `string[]`, a single-shard failure substitutes that shard's formatted path, while array-wide failures (unknown `kind`, `[]`, merged `> 20,000` cases) join formatted paths with `", "` (or `"[]"` when empty).
- `TN-GATE-*`, `TN-USAGE-*` and `TN-WEAK-*` cover wildcard prefixes in `contracts.md §13`; specific subcodes listed below take their own row.

## 2. Message and fix table

| Code | Message | Fix |
|---|---|---|
| `TN-ACC-DUP-ID` | Duplicate acceptance item ID {id}. | Renumber or remove the repeated {id} item. |
| `TN-ACC-MISSING-ID` | Acceptance item needs an ID. | Prefix the item with [AB-<n>]. |
| `TN-ACC-UNPASSED` | Acceptance items not passing: {ids}. | Add passing tests tagged with [AB-n] or fix failing tests for {ids}. |
| `TN-BLESS-INFERRED` | Section {slug} still contains inferred statements ({ids}). | Edit or adopt {ids}, then run `tenet bless`. |
| `TN-BLESS-NO-TTY` | Interactive terminal required to bless specifications. | Run `tenet bless` in an interactive terminal session. |
| `TN-BLESS-OPEN-CONFLICT` | Section {slug} has unresolved conflicts or open questions ({ids}). | Resolve {ids} in Conflicts or Open questions, then run `tenet bless`. |
| `TN-BUDGET` | File {path} is over its token budget ({tokens} > {limit} tokens). | Trim {path} or run `tenet split` to extract a section into a part. |
| `TN-BUDGET-WARN` | File {path} is at or over 90% of its token budget ({tokens} / {limit} tokens). | Trim {path} or run `tenet split` to extract a section into a part. |
| `TN-CITE-FILE` | Cited file {path} was not found. | Update the citation path or restore {path}. |
| `TN-CITE-HEADING` | Cited heading #{slug} was not found in {path}. | Update the doc: citation to an existing heading slug in {path}. |
| `TN-CITE-RANGE` | Citation {cite} has an invalid line range or format. | Fix {cite} to use a valid path:line or path:start-end within file length. |
| `TN-CITE-TEST` | Cited test {name} was not found in {file}. | Update the test: citation to match a declared test in {file}. |
| `TN-ENV-GIT` | Git {found} is below required version 2.40. | Install Git 2.40 or newer and retry. |
| `TN-ENV-NO-COMMIT` | Repository has no commits yet. | Make a first commit, then run `tenet onboard`. |
| `TN-ENV-NODE` | Node.js {found} is below required version 22. | Install Node.js 22 LTS or newer and retry. |
| `TN-ENV-NOT-GIT` | Directory {path} is not a Git repository. | Run `git init` or run from inside a Git repository. |
| `TN-ENV-OFFLINE` | Command `tenet {command}` requires network access, which is disabled by `--offline`. | Re-run `tenet {command}` without `--offline`. |
| `TN-ENV-REGISTRY` | Could not reach the npm registry to verify {package}@{version}: {cause}. | Check your network or proxy, or run `tenet {command} --offline` to record local package integrity. |
| `TN-EV-DUP` | Duplicate event ID {id} has conflicting content. | Keep one canonical event for {id} and remove the conflicting entry. |
| `TN-EV-ORPHAN` | Event {id} references unknown predecessor {prev}. | Include or fetch event {prev} before reducing work item events. |
| `TN-GATE-*` | Gate blocked or held by rule {rule}: {reason}. | Resolve {reason} and re-run the gate check. |
| `TN-GATE-APPROVE-NOT-EVIDENCE` | Approval cannot satisfy evidence claim {claim}. | Supply required verification evidence for {claim} or request a time-boxed waiver via `tenet decide`. |
| `TN-GATE-CLAIM` | Claim {claim} is {state}. | Satisfy {claim}, wait for CI verification, or request a waiver via `tenet decide`. |
| `TN-GATE-CONFLICT` | Work item has unresolved event conflicts ({ids}). | Run `tenet resolve` on {ids} before advancing. |
| `TN-GATE-FROZEN` | Work item is frozen. | Wait for the Owner to unfreeze the work item before advancing. |
| `TN-GATE-REVIEW` | Review is incomplete or requires adjudication ({reason}). | Resolve review findings or record a decision via `tenet decide`. |
| `TN-GATE-STOP` | Stop threshold reached: {reason}. | Write an escalation report and run `tenet escalate`. |
| `TN-GATE-TRUST` | Protected trust-surface claim {claim} is not satisfied. | Open a change-policy decision request via `tenet decide`. |
| `TN-GATE-UNKNOWN` | Policy applicability is unknown because {missing} is missing. | Define {missing} in tenet.yaml or CODEOWNERS and re-run. |
| `TN-INIT-EXISTS` | File {path} already exists with different content. | Review {path} or rerun `tenet init --force` to overwrite managed blocks. |
| `TN-INTERNAL` | Internal failure: {detail}. | Report this defect with the command and error details. |
| `TN-KIT-EDITED` | Vendored kit digest differs from tenet.lock ({actual} != {expected}). | Restore .tenet/kit or run `tenet upgrade` to update tenet.lock. |
| `TN-KIT-INVALID` | Kit at {path} is invalid: {detail}. | Restore {path} to regular kit files or run `tenet upgrade`. |
| `TN-KIT-MISSING` | Kit directory {path} was not found. | Reinstall @vedprakash-m/tenet or fix kit_path in tenet.yaml. |
| `TN-LOCK-INVALID` | Lock file tenet.lock is invalid: {detail}. | Fix tenet.lock or run `tenet init` to regenerate it. |
| `TN-LOCK-MISMATCH` | Installed package {installed} differs from tenet.lock ({locked}). | Run `tenet upgrade` or reinstall @vedprakash-m/tenet@{locked}. |
| `TN-LOCK-MISSING` | Lock file tenet.lock was not found. | Run `tenet init` to create and pin tenet.lock. |
| `TN-PATH-ESCAPE` | Path {path} resolves outside the repository root. | Use a relative path inside the repository without symlink escapes. |
| `TN-POLICY-ALPHA0-CAP` | The {rule} rule is capped at advise in alpha.0. | The configured mode will take effect when rule modes are available. |
| `TN-POLICY-BRANCH` | Branch modifies protected policy file tenet.yaml. | Revert tenet.yaml on this branch or move policy changes to a separate change. |
| `TN-POLICY-INCOMPATIBLE` | Claim requirements for {claim} have no compatible intersection. | Align conflicting claim methods or pass rules across policy layers. |
| `TN-POLICY-LEVEL-UNAVAILABLE` | Policy level {level} is not yet available; running as observe. | Set an available level in tenet.yaml or wait for support for {level}. |
| `TN-POLICY-LOOSEN` | Policy layer {layer} attempts to loosen {name}. | Remove the loosening override from {layer} so later layers only tighten. |
| `TN-POLICY-MISSING` | Policy file tenet.yaml was not found. | Run `tenet init` to create tenet.yaml. |
| `TN-POLICY-RULE` | Unknown policy rule or setting {name} in tenet.yaml. | Remove or fix {name} in tenet.yaml against the active pack. |
| `TN-POLICY-SCHEMA` | tenet.yaml does not match the alpha.0 schema: {detail}. | Fix tenet.yaml or remove fields that are not available in alpha.0. |
| `TN-PROTECTED` | Change modifies protected path {path}. | Revert edits to {path} or open a change-policy decision request via `tenet decide`. |
| `TN-RECORD-BUNDLE` | Recorded CI bundle {run_id} failed verification: {reason}. | Re-run the CI verification workflow and check bundle integrity. |
| `TN-REPORT-MALFORMED` | Test report {path} is not valid {kind} input. | Fix the {kind} report format, XML entity rules, or size/case limits for {path}. |
| `TN-REPORT-MISSING` | Test report {path} was not found. | Run tests to generate {path}, or provide an existing report path. |
| `TN-SCHEMA` | File {path} failed {schema} schema validation at {pointer}. | Update {path} at {pointer} to match the {schema} schema. |
| `TN-SPEC-BLESSED-COPY` | Blessed copy for section {slug} is missing or changed on disk. | Run `tenet bless` to restore or re-bless section {slug}. |
| `TN-SPEC-DUP-ID` | Duplicate specification ID {id}. | Run `tenet fix` to assign a new ID, or remove the duplicate {id}. |
| `TN-SPEC-DUP-SECTION` | Duplicate section slug {slug}. | Rename or merge the repeated {slug} heading. |
| `TN-SPEC-MISSING-ID` | Specification line needs an ID. | Run `tenet fix` or prefix the line with an unused ID. |
| `TN-SPEC-NO-FRONT` | Specification file has no YAML front matter. | Run `tenet fix` to add the front matter. |
| `TN-SPEC-REQ-META` | Requirement metadata is malformed: check closing braces, allowed keys, and origin. | Fix the `{…}` metadata block with allowed keys and valid origin. |
| `TN-SPEC-UNCOVERED-VISION` | Blessed vision item {id} is not served by a blessed requirement or listed under ## Not yet in scope. | Add serves: {id} to a blessed requirement or list {id} under a blessed ## Not yet in scope section. |
| `TN-SPEC-VISION-WAITS-FOR-PRD` | {count} vision {items} for a blessed requirement; bless the PRD next | Run `tenet bless --doc prd` for separate files or `tenet bless --section requirements` for one file. |
| `TN-SUBJ-DIRTY` | Working tree has uncommitted changes. | Commit or stash local changes before running `tenet {command}`. |
| `TN-USAGE-*` | Invalid usage for `tenet {command}`: {detail}. | Run `tenet {command} --help` for valid arguments and flags. |
| `TN-USAGE-BUDGET` | Context token budget {budget} must be a positive integer. | Pass a positive integer to `--budget-tokens` or `budget_tokens`. |
| `TN-USAGE-REF` | The git ref is invalid. | Pass a repository ref. |
| `TN-WEAK-*` | Possible test weakening ({finding}) in {file}: {names}. | Restore removed tests or remove skip markers in {file}, or ask for a waiver. |

**Proposal · CP-0068 AC-A4–A5.** For specification front matter, `TN-SCHEMA` lists each failing JSON Pointer and the expected shape. It directs the user to `tenet fix` for missing fields, or to correct invalid fields first. Card diagnostics direct the user to commit the repaired draft before retrying.

## 3. Alpha.1 message templates

Moved into the §2 table when `CP-0007` and `CP-0050` add their entries to `src/core/messages.ts` (`test/core/messages.test.ts` checks §2 rows strictly against `src/core/messages.ts`):

- `TN-BACKTEST-INCOMPLETE`: `"Backtest cohort has incomplete coverage ({coverage} / {cohort_size} PRs)."` Fix: `"Complete missing PR records before claiming the 100-PR backtest threshold."`
- `TN-EV-CROSS-WORK`: `"Event {id} references predecessor {prev} from another work item."` Fix: `"Fix predecessor link on {id} to reference an event in the same work item."`
- `TN-EV-CYCLE`: `"Event {id} participates in a cycle or self-link."` Fix: `"Remove the cyclic predecessor edge on {id} before reducing."`
- `TN-EV-NO-CREATE`: `"Work item {work} has no valid unique creation event."` Fix: `"Supply or resolve the canonical \`work.created\` event for {work}."`
- `TN-EV-RESOLVE`: `"Resolution {id} omits one or more active conflict heads."` Fix: `"Record a \`resolve\` event whose \`prev\` includes every active conflict head."`
- `TN-GATE-SELF-WAIVE`: `"Actor {actor} cannot waive claim {claim} broken by their own change."` Fix: `"Have another authorized decision-maker waive {claim} or satisfy the check."`
- `TN-POLICY-RULE-DECISION`: `"Promoting rule {rule} to {mode} requires an approved change-policy decision."` Fix: `"Record an approved \`change-policy\` decision first, then re-run \`tenet rules\`."`
- `TN-DEC-ACTOR`: `"Forge actor {actor} is not eligible to answer this request."` Fix: `"Have an authorized owner from allowed_actors submit the decision."`
- `TN-DEC-AMBIGUOUS`: `"Unqualified reply matches {count} open decision requests."` Fix: `"Specify @<evaluation_id> or target choice on the reply."`
- `TN-DEC-CONFLICT`: `"Competing decision choices ({choices}) leave request {id} unresolved."` Fix: `"Record an authorized resolve decision or issue a fresh request."`
- `TN-DEC-EXPIRED`: `"Decision reply arrived after request {id} expired at {expires_at}."` Fix: `"Open a fresh decision request before replying."`
- `TN-DEC-KEY-REVOKED`: `"Signing key for actor {actor} was revoked at {revoked}."` Fix: `"Sign with an active registered owner key."`
- `TN-DEC-SELF-VERIFY`: `"Actor {actor} cannot approve their own pull request at level {level}."` Fix: `"Have another owner or reviewer submit the decision."`
- `TN-DEC-STALE`: `"Reply targets evaluation {actual}, but current evaluation is {expected}."` Fix: `"Review the latest card and reply against {expected}."`
- `TN-RECORD-TIP`: `"Records ref tip drifted from {expected} to {actual} during board read."` Fix: `"Re-run \`tenet board --fetch\` to read a consistent snapshot."`
- `TN-SEALED-DIRTY`: `"Sealed test job modified tracked files before completing check {check}."` Fix: `"Remove working-tree writes during CI checks and re-run."`

## 4. 0.1.x message templates

Moved into the §2 table when `0.1.x` packets add their entries to `src/core/messages.ts` (`test/core/messages.test.ts` checks §2 rows strictly against `src/core/messages.ts`):

- `TN-HEALTH-BASELINE`: `"Committed health baseline entry {key} is missing or incompatible."` Fix: `"Record the initial entry in .tenet/health-baseline.json via a change-policy commit."`
- `TN-HEALTH-CONFIG-CHANGED`: `"Health report for {check} drifted from pinned tool or scope configuration ({detail})."` Fix: `"Update <base> tenet.yaml checks.{check} or restore the pinned analyzer configuration."`
- `TN-HEALTH-INCOMPATIBLE`: `"Indicator {indicator} received conflicting or multiple health reports for {check}."` Fix: `"Bind one authoritative single report per checks.<name> run."`
- `TN-HEALTH-PROVENANCE`: `"Health report for {indicator} lacks required metadata or mismatches target architecture modules ({detail})."` Fix: `"Emit valid tenet-health-json/sarif provenance matching health.architecture.modules, or run as advisory."`
- `TN-HEALTH-REGRESSED`: `"Health indicator {indicator} regressed beyond tolerance ({detail})."` Fix: `"Reduce the regression within tolerance/max_new or record a forge-verified accept-health-regression waive."`
- `TN-WAIVER-EXPIRED`: `"Waiver {id} expired at {expiry}."` Fix: `"Fix the underlying regression or obtain a fresh forge-verified waiver."`
