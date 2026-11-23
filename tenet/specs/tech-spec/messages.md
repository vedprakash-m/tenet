# Tenet technical specification: error messages

> Level L2 · Version 0.1 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Previous version: `—`

**Context card.** Canonical message and fix templates for every `TN-*` error and warning code listed in [contracts.md §13](contracts.md#13-error-codes) and the algorithms. Builders substitute each `{named}` placeholder with the exact value in context so CLI output, thrown errors and `--json` findings (`{code, severity, rule, file, line, message, fix}`) use identical wording across implementations.

## 1. Placeholder rules

- Paths (`{path}`, `{file}`) use forward slashes and are relative to the repository root when known.
- IDs (`{id}`, `{ids}`) keep their exact identifier form (`R-12`, `AB-1`, `V-2`, `CF-1`, `Q-1`); comma-separated lists join with `", "`.
- When `path` is `string[]` on `TN-REPORT-MISSING` or `TN-REPORT-MALFORMED`, `{path}` joins formatted paths with `", "` (or `"[]"` when empty).
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
| `TN-CITE-FILE` | Cited file {path} was not found. | Update the citation path or restore {path}. |
| `TN-CITE-HEADING` | Cited heading #{slug} was not found in {path}. | Update the doc: citation to an existing heading slug in {path}. |
| `TN-CITE-RANGE` | Citation {cite} has an invalid line range or format. | Fix {cite} to use a valid path:line or path:start-end within file length. |
| `TN-CITE-TEST` | Cited test {name} was not found in {file}. | Update the test: citation to match a declared test in {file}. |
| `TN-ENV-GIT` | Git {found} is below required version 2.40. | Install Git 2.40 or newer and retry. |
| `TN-ENV-NO-COMMIT` | Repository has no commits yet. | Make a first commit, then run `tenet onboard`. |
| `TN-ENV-NODE` | Node.js {found} is below required version 22. | Install Node.js 22 LTS or newer and retry. |
| `TN-ENV-NOT-GIT` | Directory {path} is not a Git repository. | Run `git init` or run from inside a Git repository. |
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
| `TN-KIT-EDITED` | Vendored kit digest differs from tenet.lock ({actual} != {expected}). | Restore .tenet/kit or run `tenet upgrade` to update tenet.lock. |
| `TN-LOCK-MISMATCH` | Installed package {installed} differs from tenet.lock ({locked}). | Run `tenet upgrade` or reinstall @vedprakash-m/tenet@{locked}. |
| `TN-PATH-ESCAPE` | Path {path} resolves outside the repository root. | Use a relative path inside the repository without symlink escapes. |
| `TN-POLICY-BRANCH` | Branch modifies protected policy file tenet.yaml. | Revert tenet.yaml on this branch or move policy changes to a separate change. |
| `TN-POLICY-INCOMPATIBLE` | Claim requirements for {claim} have no compatible intersection. | Align conflicting claim methods or pass rules across policy layers. |
| `TN-POLICY-LEVEL-UNAVAILABLE` | Policy level {level} is not yet available; running as observe. | Set an available level in tenet.yaml or wait for support for {level}. |
| `TN-POLICY-LOOSEN` | Policy layer {layer} attempts to loosen {name}. | Remove the loosening override from {layer} so later layers only tighten. |
| `TN-POLICY-MISSING` | Policy file tenet.yaml was not found. | Run `tenet init` to create tenet.yaml. |
| `TN-POLICY-RULE` | Unknown policy rule or setting {name} in tenet.yaml. | Remove or fix {name} in tenet.yaml against the active pack. |
| `TN-PROTECTED` | Change modifies protected path {path}. | Revert edits to {path} or open a change-policy decision request via `tenet decide`. |
| `TN-RECORD-BUNDLE` | Recorded CI bundle {run_id} failed verification: {reason}. | Re-run the CI verification workflow and check bundle integrity. |
| `TN-REPORT-MALFORMED` | Test report {path} is not valid {kind} input. | Fix the {kind} report format, XML entity rules, or size/case limits for {path}. |
| `TN-REPORT-MISSING` | Test report {path} was not found. | Run tests to generate {path}, or provide an existing report path. |
| `TN-SCHEMA` | File {path} failed {schema} schema validation at {pointer}. | Update {path} at {pointer} to match the {schema} schema. |
| `TN-SPEC-BLESSED-COPY` | Blessed copy for section {slug} is missing or changed on disk. | Run `tenet bless` to restore or re-bless section {slug}. |
| `TN-SPEC-DUP-ID` | Duplicate specification ID {id}. | Run `tenet fix` to assign a new ID, or remove the duplicate {id}. |
| `TN-SPEC-DUP-SECTION` | Duplicate section slug {slug}. | Rename or merge the repeated {slug} heading. |
| `TN-SPEC-MISSING-ID` | Specification line needs an ID. | Run `tenet fix` or prefix the line with an unused ID. |
| `TN-SPEC-NO-FRONT` | Specification file has no valid YAML front matter. | Add YAML front matter (`---`) with `tenet` and `sections`, or run `tenet fix`. |
| `TN-SPEC-REQ-META` | Requirement metadata is malformed: check closing braces, allowed keys, and origin. | Fix the `{…}` metadata block with allowed keys and valid origin. |
| `TN-SUBJ-DIRTY` | Working tree has uncommitted changes. | Commit or stash local changes before running `tenet {command}`. |
| `TN-USAGE-*` | Invalid usage for `tenet {command}`: {detail}. | Run `tenet {command} --help` for valid arguments and flags. |
| `TN-WEAK-*` | Possible test weakening ({finding}) in {file}: {names}. | Restore removed tests or remove skip markers in {file}, or ask for a waiver. |
