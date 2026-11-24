# Tenet technical specification: contracts

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0023 · Previous version: `archive/specs/tech-spec/contracts.md@0.11.md`

**Context card.** Every format, identifier, grammar and interface a builder needs, so that two implementations produce the same files and outputs. Algorithms that act on these formats are in [algorithms.md](algorithms.md); onboarding behavior in [onboarding.md](onboarding.md); CI in [ci.md](ci.md); what agents are told in [agents.md](agents.md). Each format has a JSON Schema in `kit/schemas/` (CP-0004) with ≥2 valid and ≥3 invalid fixtures. Unknown keys are refused except `x-` keys. All files are UTF-8 with LF line endings.

## 1. Files and identifiers

| Item | Format |
|---|---|
| Requirement ID | `R-<n>` (prefix set by `specs.id_prefix`, default `R`); `n` is the next unused integer in the project; assigned by `tenet fix`; never reused |
| Acceptance item ID | `AB-<n>`, numbered from 1 within its pull request; stored as `pr-<number>/AB-<n>` |
| Work item | `pr-<number>` for a quick change; `CP-<6 Crockford Base32 chars>` alias for a packet, the first 6 characters of the base32 SHA-256 of its ULID, lengthened by one on collision; legacy `CP-NNNN` stays valid |
| Schema ID | `https://vedprakash-m.github.io/tenet/schemas/<minor>/<name>.json` (alpha.1 adds `subject`, `actor`, `claim`, `evidence`, `decision`, `event`, `work`, `criteria`, `step-assignment`, `step-result`, `loop`), published with the release (L-0031) |
| ULID | 26 uppercase Crockford Base32 characters, monotonic within one millisecond |
| Test tag | `\[(AB-\d+|<prefix>-\d+)\]` in a test's full name, where `<prefix>` is `specs.id_prefix`; or `(?:^|[^A-Za-z0-9]|_)tenet_(AB|<prefix>)_(\d+)(?=$|[^A-Za-z0-9])` (`tenet_AB_1` means `AB-1`, and it also matches inside `test_retries_once_tenet_AB_1` or `suite > tenet_AB_1`); or a JUnit `<property name="tenet.case" value="…">`, or a CTRF `extra.tenet_cases` array. `AB`, `CF`, `Q` and `V` are reserved and can't be a requirement prefix; any other bracketed token (`[UTF-8]`) is ignored. ALG-08 says which tags count |
| Vision item ID | `V-(?:[A-Z]+)?\d+` (`V-2`, `V-P18`), numbered by `fix`; `serves:` takes a comma-separated list |
| Evaluation ID | First 16 hex characters of SHA-256 over RFC 8785 `{repository, work, tested_commit, base, acceptance_digest, implemented: [{id, blessed_digest}], policy_blob, tenet_version}` (`policy_blob` is the git blob ID of the target's `tenet.yaml`); a reply or approval binds it (ci.md §6). One evaluation can have several runs; each record is keyed by run and attempt (ci.md §4) |
| `tenet.lock` | `{schema_version: 1, package: "@vedprakash-m/tenet", version, integrity: "sha512-…", kit_sha256}`; `integrity` is registry `dist.integrity` when published, or local package SHA-512 (`x-integrity-source: "local"`) for unpublished/local/prerelease builds; CI runs `npm install --no-save` and checks `integrity`; `kit_sha256` hashes sorted `<path>\0<sha256>` after CRLF/CR→LF normalization (`kit/` holds UTF-8 text only); `kit_path` sets vendoring |
| `.tenet/` | `manifest.json` (§10), `manifest.pending.json`, `onboard/` (§4), `reports/`, `cache/`, `runs/`; all git-ignored except `manifest.json` and a vendored `kit/` (`init` writes the `.gitignore` block) |
| `<records>/blessed/` | Copies of blessed section text and `log.jsonl` (one line per finished section action: `{doc, section, action: bless|confirm|reject|defer, by, at, minutes, statements: {drafted, kept, edited, adopted, added}, session_id?}`, where `statements` fields are `null` when unavailable), committed (ALG-03, ALG-13) |

## 2. Pull-request acceptance block

```text
## Acceptance
Implements: R-12, R-14
- [AB-1] one retry after a timeout
```

Parsing: heading text exact (`## Acceptance` or `### Acceptance`); optional `Implements:` (IDs of blessed requirements); one item per line (`- [ ] ` checkbox prefix allowed). Missing heading returns `{implements: [], items: [], digest, problems: []}`. Block ends at next heading or EOF; ignore code fences. `Implements:` matches `^Implements:\s*(.+)$`, splitting non-empty values on commas across lines (digest dedupes/sorts). Items match `^\s*[-*]\s*(\[[ xX]\]\s*)?\[(AB-\d+)\]\s+(.+)$` (`item.text` trimmed; digest collapses internal whitespace). Bullets missing `[AB-n]` emit `TN-ACC-MISSING-ID`; repeated IDs emit `TN-ACC-DUP-ID` and exclude duplicates after the first. `problems[]` sets `severity: "error", rule: null, file: null, line`. **Acceptance digest:** SHA-256 over RFC 8785 `{implements, items: [{id, text}]}` sorted by ASCII `id` (`a < b ? -1 : a > b ? 1 : 0`).

## 3. Specification documents

**Front matter** (YAML, first lines of the file):

```yaml
tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: ved, drafted_from: 9f3c2e1, drafted_at_rev: 9f3c2e1}   # version uses /^\d+(?:\.\d+)*$/ (tenet fix defaults missing to "0.1")
# drafted_from: the inventory's revision (information only; onboarding drafts only); drafted_at_rev: the commit holding the agent's draft, set by `onboard --card` (ALG-13). Both optional before then
sections:
  requirements:                     # section slug (ALG-02)
    level: L1                       # optional; defaults to the document's level
    state: blessed                  # draft | blessed | rejected | deferred
    digest: sha256:0dbd08e5ad469fb93440fa5489aae662f07dd294fd2dc68cbf202b6df6527bae         # current text (ALG-02); null until `tenet fix` computes it
    blessed_digest: sha256:0dbd08e5ad469fb93440fa5489aae662f07dd294fd2dc68cbf202b6df6527bae # text last blessed; null until blessed
    blessed_at_rev: 9f3c2e1         # HEAD when blessed; null until blessed; information only, never required to exist
    anchors: {"src/retry.ts:40-48": "sha256:cb3a0834537f84c19727dce128035f7a9f16972c94a9253d457c0812e3e70328"}   # one per citation, set when blessed; the cited text is kept beside the blessed copy (ALG-03)
    applies_to: ["src/checkout/**"] # optional; prose sections reach context through it (ALG-10)
    blessed_copy: tenet/blessed/<doc>/<slug>.md   # text in force (ALG-03)
    flags: []                       # edited | sources-changed
    recorded: self                  # self | forge | signed
    owner: payments                 # optional; else ALG-03 owner rule
    blessed_by: ved
    blessed_at: 2026-11-23T10:00:00Z
```

**Requirement line** (in a list item or a table's Requirement cell):

```text
- R-12 A payment that times out is retried once, never twice. {origin: observed; cites: src/retry.ts:40-48, test: checkout.retry.test.ts > retries once; serves: V-2}
```

Braces close the line (`- <ID> <text> {…}`; table rows in onboarding §1). `{…}` fields split on `;` (`origin:`, `cites:`, `serves:`, `scope:`, `adopted_by:`; repeated keys overwrite); `cites:`/`serves:` split on `,`. Parsed item: `{id, text, origin, cites, serves, scope, adopted_by}` (`scope` is `"global"` or non-empty string, else `null`; other scalars nullable). `origin` is `observed|documented|asked|inferred`. `_preamble` has `heading: ""`; `section.level` defaults to `sections[slug].level ?? tenet.level ?? null`; omitted `applies_to` defaults to `[]`. Citations: `path:start-end`, `path:line`, `test: <file> > <name>`, `doc: path#slug` (forward slashes). Missing front matter emits `TN-SPEC-NO-FRONT` (`line: null`, treat sections as `draft`). Unclosed braces, metadata outside braces, unknown keys, or empty/invalid `origin` emit `TN-SPEC-REQ-META`. Bullets lacking an ID inside `Requirements`/`Vision`/`L0` sections, bullets with `{…}`, or empty Requirement/Vision table ID cells emit `TN-SPEC-MISSING-ID` (prose bullets elsewhere never emit it). Duplicate IDs emit `TN-SPEC-DUP-ID`.

**Conflicts and open questions** (sections named exactly `Conflicts` and `Open questions`):

```text
- [ ] CF-1 (section: requirements) README says two retries; src/retry.ts:42 retries once. | 1: retry once | 2: retry twice
- [x] Q-2 (section: vision) Who are the primary users? answer: returning shoppers
```

Parsed entries: `{id, checked: bool, section: string|null, text, resolution?: string, answer?: string}` (stripping trailing `| 1: …`, and `resolution:`/`answer:` when preceded by start, whitespace, `;` or `|`). An open item (`[ ]`) blocks blessing its named section until checked with `resolution:`/`answer:`, or deferred.

## 4. Onboarding files

`.tenet/onboard/inventory.json`: `{schema_version, revision, sources: {files: [{path, kind: source|config|test|doc|ci|adr|manifest|instructions, sha256, lines}], skipped: [{path, reason: env|credentials|vendored|generated|excluded|binary|oversize}]}, modules: [{id, roots, languages}], tests: [{path, runner, cases}], docs: [{path, title, sections, last_changed}], owners: [{pattern, owners}], ci: [{path, commands}], size: {source_lines, areas}, layout: one-file | separate, units: [{id, paths, views}], findings: [{kind: dead-path | skipped-tests | owners-unmatched | no-test-report, path, message}], observations: {reports: [{path, sha256, runner, cases}]}}`. Everything except `observations` is deterministic over `(HEAD, working tenet.yaml)`; `observations.reports` reads working-tree `.tenet/reports/*` and `checks[].report_path` (named by `sha256`, suppressing `no-test-report` when non-empty; tracked `.tenet/reports/*` stay in `sources.files`).

`.tenet/onboard/interview.json` (written by the agent): `{questions: [{id, text, answer, answered_at}]}`.

`.tenet/onboard/assignment.json`: `{schema_version, inventory, skill: "draft-specs", project_kind, views: [vision, requirements, design, experience, plan], layout, units, question_limit: 10, output: {paths}, rules: [no intent from code alone, every observed or documented statement cites, never resolve a conflict, never bless]}`.

## 5. Proof card and board models

**Proof card** (`kit/schemas/proof-card.json`): `{schema_version, evaluation_id, tested: {commit, kind: merge-candidate|head, head, base}, acceptance_digest, requirements: [{id, excerpt, state, recorded, flags, why: implements|cited-code-changed|text-changed|same-area, tests: {expected, passed, failed, skipped, not_run}}], items: [{id, text, result: passed|failed|not-run|no-test|skipped, coverage: confirmed|not-confirmed, tests: {expected, passed, failed, skipped, not_run}, names: [full_name], authorship: written-here|tag-added-here|unknown, first_failure?}], tests: {report: ok|missing|malformed, total, passed, failed, skipped, failing: [full_name]}, weakening: {found, by: [{finding, file, names}], not_checked: [language]}, workflow_changed, protected: [path], blessings_changed: [{doc, section, blessed_by, commit_author}], deltas: [{doc, added, modified, removed}], rules: [{rule, mode, would_block, reason}], badge: advisory|verified-on-ci|intent-not-yet-blessed, why: [{text, class: checked|judge|host|not-tenet}], degraded: [reason]}`. `rules` lists only rules where `would_block === true` (in pack order). `renderCard(model)` emits LF-terminated lines in this order (UX Part 1A lines 102–111; line templates in plan/alpha.0b.md CP-0051): (1) `### Tenet proof · <tested.commit.slice(0, 6)> (<merge candidate|head>) · <advisory|verified on CI|advisory · intent not yet blessed>`; (2) `Your intent this change touches` (non-`same-area` lines `  <id> <state> · "<excerpt>" · <why> · <n> tagged test(s) …`, then collapsed `  <ids> blessed · may be affected (same area)`); (3) `Acceptance` (or `  ! no acceptance items · add the block from the template`); (4–6) `Tests <clause> · <weakening clause> · <protected clause>`, then optional `Blessings changed: …`; (7) optional `Spec deltas: …`; (8) optional `Would have blocked: …`; (9) optional `Degraded: …` and `Why: …`. Golden cards live in `pkg/conformance/card/` and `pkg/conformance/cards/`.

**`board.json`** (`schema_version` 1; `--since <rev>` returns changed items only): `{schema_version, as_of, read: {main, branches, records}, pack: {phases}, specs: [{path, section, level, state, flags, recorded?}], pending_blessings: [{path, section, conflicts, open_questions}], spec_debt?: [{kind: broken-citation|untested-requirement|over-budget, path, id: string|null, message}], items: [{id, title, lane, station, status, branch, age, depends_on, replay, lease, next_actions: [{who, action, reason, command, dispatch?}], claims: {applicable, satisfied, waived, unsatisfied}, guarantee, cost: {amount, unit, status: known|estimated|unavailable, source}}], decision_queue, review_queue, campaigns, active_runs?, areas: [{name, owner, promises, health, readiness, quarantined, waivers}], conflicts, flow, escalations}`. In alpha.0 only `as_of`, `read` (`{main: <HEAD|null>, branches: [], records: null}`), `specs` (`recorded` required only when `state === "blessed"`), `pending_blessings` and `spec_debt` are filled.

## 6. Test reports

Moved to [evidence.md §2](evidence.md#2-real-test-reports) under the rollover rule. Every reader produces one `TestReport` model (`runner` equals `kind`: `junit` | `ctrf` | `go-test-json` | `jest-json` | `none`): `{runner, cases: [{full_name, file?, status: pass|fail|skip|error, attempts: [status], tags: [id], duration_ms?}], teardown_failed: bool, inconclusive: bool}` (ALG-08). Missing reports throw `TN-REPORT-MISSING`; malformed reports throw `TN-REPORT-MALFORMED`. When `file` is present, store it with forward slashes, relativized to `cwd` if supplied. `duration_ms`, when present, is rounded to the nearest integer millisecond (`Math.round`).

## 7. CI

Moved to [ci.md](ci.md) under the rollover rule: the test job and recorder, running checks, workflows, the records ref, verification, decisions, trust and the release procedure.

## 8. Commands

| Command | First | Writes | Notes |
|---|---|---|---|
| `init` | alpha.0 | files in the preflight, `.tenet/manifest.json` | `--yes`, `--local-hosts`, `--vendor`, `--force`; idempotent |
| `onboard` | alpha.0 | `.tenet/onboard/*`, drafted documents via the agent | `--inventory-only`, `--refresh` |
| `bless` | alpha.0 | front matter, `<records>/blessed/*` and its `log.jsonl` | refuses without a terminal (exit 2); per section: bless, confirm (`sources-changed`), edit, reject, defer |
| `context` | alpha.0 | — | `--paths`, `--ids`, `--query`, `--include-drafts` |
| `check`, `fix`, `split` | alpha.0 | `fix` and `split`: local files | `check --pack` |
| `board` | alpha.0 | — | `--all`; `--open`, `--since`, `--fetch` from alpha.1 |
| `upgrade`, `remove`, `doctor`, `mcp` | alpha.0 | lock, block, keys; nothing for `doctor`, `mcp` | |
| `level`, `rules` | alpha.1 | `tenet.yaml` | |
| `verify --run-checks`, `verify --bundle`, `verify --record` | alpha.0 | `tenet-bundle/`; the check run; the records ref | CI only (ci.md), except `--run-checks --local` (0.1.0), which writes a local advisory card for the runner; `--record` signs from `verify` |
| `new`, `move`, `status`, `task done`, `close`, `resume`, `decide`, `resolve`, `escalate`, `lease`, `release`, `assign`, `result`, `inspect`, `record`, `agent check`, `skill list`, `build --target agents-md` | 0.1.0 | packets and events | |
| `tenet-runner start`, `status`, `stop`, `doctor` | 0.1.0 | worktrees under `.tenet/runs/`; run events | separate package (agents.md §6) |
| `import` | 0.1.x | packets | |
| `conform` | M4 | — | |

Global flags: `--json`, `--cwd`, `--quiet`, `--verbose`, `--offline`. Under `--json` stdout holds exactly one JSON object `{ok, command, version, result, errors: [finding]}`; human text goes to stderr. A **finding** is `{code, severity: error|warning|advise, rule, file, line, message, fix}`, with `rule`, `file` and `line` nullable; `check` returns `result: {findings: [finding], summary: {errors, warnings, advises}}` (counts by `severity`, with `findings` sorted by `file ?? ""`, numeric `line ?? 0`, `code`, `message`), and `tenet_check` the same. **Results by command:** `init` `{plan, wrote, findings}`; `onboard` `{preflight, inventory, findings, assignment}` (`onboard --card`: `{card, drafted_at_rev}`); `bless` `{blessed, confirmed, rejected, deferred, minutes}` (integer counts, numeric minutes); `context` the `tenet_context` result; `fix` `{changes}`; `split` `{moved, pointer}`; `board` `board.json`; `upgrade` `{from, to, changed}`; `remove` `{removed, kept}`; `doctor` `{checks: [{name, ok, detail}]}`; `verify --record` `{evaluation_id, conclusion, wrote}`. Each command's packet owns `kit/schemas/results/<command>.json`. Exit codes in precedence order: 2 usage, 3 environment, 4 policy refusal, 1 gate or check failed, 0 success; each error code's exit code is in §13. Each command's `result` follows `kit/schemas/results/<command>.json` (CP-0004). Pull-request replies (`/tenet approve`, `pick`, `bless`, `not-useful`) arrive in alpha.1 (ci.md §6).

## 9. MCP

Newline-delimited JSON-RPC 2.0 over stdio; logs on stderr only; no network. Protocol revision `2025-11-25`, also accepting `2025-06-18`.
- `initialize`: answer `{protocolVersion, capabilities: {tools: {listChanged: false}}, serverInfo: {name: "tenet", version}}`, where `protocolVersion` is the client's requested revision if supported, else `2025-11-25`.
- Notifications (`notifications/initialized` and any other message without an `id`) get no reply. `ping` returns `{}`.
- `tools/list` gives each tool's `inputSchema` and `outputSchema` (from its result schema). `tools/call` returns `{content: [{type: "text", text: <markdown>}], structuredContent: <result>, isError}` (`content[0].text` uses the CLI human summary).
- Errors: -32700 `"Parse error"`, -32600 `"Invalid Request"`, -32601 `"Method not found"`, -32602 `"Invalid params"`.

| Tool | Input | Result |
|---|---|---|
| `tenet_context` | `{paths?, ids?, query?, include_drafts?, budget_tokens?}` | `{blessed: [{id, section, text, flags, owner, reason: global\|id\|path\|applies_to\|query, over_budget?}], drafts: [{id?, section, path, state, text, integrity_failed?}], index: [{id, title}], omitted: [id], truncated, rules: [{rule, mode}]}` (`owner` joins multiple CODEOWNERS with `", "`; `rules` lists the five alpha.0 pack rules in pack order; an explicit `id` item always comes back whole, flagged `over_budget` if `tokens > budget_tokens`) |
| `tenet_check` | `{paths?}` | `{findings, summary}`, as `check` |
| `tenet_status` | `{work?}` | level, spec states, work item status |
| `tenet_next` | `{work?}` | `next_actions` |
| `tenet_propose` | `{kind: acceptance \| escalation, work, payload}` | `{path}` inside the work item's packet folder (committed); specification changes are edits to the files themselves (agents.md §1) |

## 10. Install manifest and hosts

In [onboarding.md §2](onboarding.md#2-install-and-upgrade), moved under the rollover rule.

## 11. Determinism

Normalize CRLF to LF before hashing text; store paths with forward slashes; call git with `-c core.quotepath=false`; serialize JSON for hashing with RFC 8785 (keys in UTF-16 code-unit order; `NaN`, `Infinity` and `undefined` refused); timestamps UTC RFC 3339 with seconds; the clock is injected, never read inside algorithms.

## 12. Evidence payloads

In [evidence.md §1](evidence.md#1-evidence-payloads).

## 13. Error codes

Every error carries its code, plain words and a fix (R-083). What each situation concludes on the forge, at each level, is [ci.md §10](ci.md#10-outcomes). **Structural** codes always fail `check` (exit 1); **rule** codes fail only when `enforce` under `--ci --base`/gates (`observe`/`advise` advise exit 0); direct local `check` keeps `TN-CITE-*` as `error` (exit 1).

Message and fix text for every code: [messages.md](messages.md).

| Codes | Kind | Exit |
|---|---|---|
| `TN-USAGE-*`, `TN-USAGE-REF`, `TN-USAGE-BUDGET`, `TN-BLESS-NO-TTY` | usage | 2 |
| `TN-ENV-NODE`, `TN-ENV-GIT`, `TN-ENV-NO-COMMIT`, `TN-ENV-NOT-GIT`, `TN-ENV-OFFLINE`, `TN-POLICY-MISSING` | environment | 3 |
| `TN-POLICY-LOOSEN`, `TN-POLICY-INCOMPATIBLE`, `TN-POLICY-RULE`, `TN-POLICY-RULE-DECISION`, `TN-INIT-EXISTS`, `TN-BLESS-OPEN-CONFLICT`, `TN-BLESS-INFERRED` | policy refusal | 4 |
| `TN-SCHEMA`, `TN-POLICY-SCHEMA`, `TN-BACKTEST-INCOMPLETE`, `TN-SEALED-DIRTY`, `TN-PATH-ESCAPE`, `TN-SPEC-NO-FRONT`, `TN-SPEC-DUP-SECTION`, `TN-SPEC-DUP-ID`, `TN-SPEC-MISSING-ID`, `TN-SPEC-REQ-META`, `TN-SPEC-BLESSED-COPY`, `TN-SPEC-UNCOVERED-VISION`, `TN-KIT-EDITED`, `TN-KIT-INVALID`, `TN-KIT-MISSING`, `TN-LOCK-INVALID`, `TN-LOCK-MISSING`, `TN-EV-DUP`, `TN-EV-CYCLE`, `TN-EV-CROSS-WORK`, `TN-EV-NO-CREATE`, `TN-EV-RESOLVE`, `TN-DEC-ACTOR`, `TN-DEC-CONFLICT`, `TN-DEC-KEY-REVOKED`, `TN-DEC-SELF-VERIFY`, `TN-ACC-MISSING-ID`, `TN-ACC-DUP-ID`, `TN-INTERNAL` | structural | 1 |
| `TN-CITE-FILE`, `TN-CITE-RANGE`, `TN-CITE-HEADING`, `TN-CITE-TEST` (rule `citations-valid`); `TN-BUDGET` (`budget`); `TN-WEAK-*` (`tests-not-weakened`); `TN-PROTECTED` (`protected-surfaces`); `TN-ACC-UNPASSED` (`acceptance-passed`); `TN-GATE-*` (the row's rule) | rule (`severity: "error"` in `enforce`, `"advise"` in `advise`) | 1 in `enforce`, else 0 |
| `TN-REPORT-MISSING`, `TN-REPORT-MALFORMED`, `TN-RECORD-BUNDLE`, `TN-RECORD-TIP`, `TN-LOCK-MISMATCH`, `TN-POLICY-BRANCH`, `TN-POLICY-LEVEL-UNAVAILABLE`, `TN-POLICY-ALPHA0-CAP`, `TN-BUDGET-WARN`, `TN-SUBJ-DIRTY`, `TN-EV-ORPHAN`, `TN-DEC-STALE`, `TN-DEC-EXPIRED`, `TN-DEC-AMBIGUOUS` | warning, shown as degraded | 0 |

## 14. Loops

In [agents.md §5](agents.md#5-loops): the loop format, step kinds, assignment and result records, static checks and the worked `define` and `build` loops.
