# Tenet technical specification: contracts

> Level L2 · Version 0.10 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Added in L-0023

**Context card.** Every format, identifier, grammar and interface a builder needs, so that two implementations produce the same files and outputs. Algorithms that act on these formats are in [algorithms.md](algorithms.md); onboarding behavior in [onboarding.md](onboarding.md). Each format has a JSON Schema in `kit/schemas/` (CP-0004) with ≥2 valid and ≥3 invalid fixtures. Unknown keys are refused except `x-` keys. All files are UTF-8 with LF line endings.

## 1. Files and identifiers

| Item | Format |
|---|---|
| Requirement ID | `R-<n>` (prefix set by `specs.id_prefix`, default `R`); `n` is the next unused integer in the project; assigned by `tenet fix`; never reused |
| Acceptance item ID | `AB-<pull request number>-<n>`, unique across the project |
| Work item | `pr-<number>` for a quick change; `CP-<6 Crockford Base32 chars>` alias for a packet, the first 6 characters of the base32 SHA-256 of its ULID, lengthened by one on collision; legacy `CP-NNNN` stays valid |
| ULID | 26 uppercase Crockford Base32 characters, monotonic within one millisecond |
| Test tag | regex `\[(AB-\d+-\d+\|[A-Z][A-Z0-9]*-\d+)\]` in a test's full name, or a JUnit `<property name="tenet.case" value="…">`, or a CTRF `extra.tenet_cases` array; a test may carry several |
| `tenet.lock` | `{schema_version: 1, package: "@vedprakash-m/tenet", version, integrity: "sha512-…", kit_sha256, vendored: bool}` |
| `.tenet/` | `manifest.json` (§10), `onboard/` (§4), `proposals/` (MCP), `reports/` (test reports from checks), `cache/`; all git-ignored except `manifest.json` |
| `<records>/blessed/` | Copies of blessed section text, committed (ALG-03) |

## 2. Pull-request acceptance block

```text
## Acceptance                          heading text exact; level 2 or 3
Implements: R-12, R-14                  optional; IDs of blessed requirements
- [AB-41-1] one retry after a timeout   one item per line; "- [ ] " checkbox prefix allowed
```

Parsing: the block ends at the next heading or end of text. `Implements:` matches `^Implements:\s*(.+)$` and splits on commas. An item matches `^\s*[-*]\s*(\[[ xX]\]\s*)?\[(AB-\d+-\d+)\]\s+(.+)$`. An item line without an ID is reported "needs an ID". **Acceptance digest:** SHA-256 over RFC 8785 JSON of `[{id, text}]` sorted by `id`, with whitespace in `text` collapsed to single spaces.

## 3. Specification documents

**Front matter** (YAML, first lines of the file):

```yaml
tenet: {spec: 1, doc: intent, level: L1, version: "0.1", owner: ved, drafted_from: <40-hex commit>}
sections:
  requirements:                     # section slug (ALG-02)
    state: blessed                  # draft | blessed | rejected | deferred
    digest: sha256:<64 hex>         # current text (ALG-02)
    blessed_digest: sha256:<64 hex> # text last blessed; null until blessed
    blessed_at_rev: <commit>        # HEAD when blessed; citations checked here
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

Braces close the line. `origin` is `observed`, `documented`, `asked` or `inferred`; `asked` may add `adopted_by: <owner id>`; optional `scope: global` marks a cross-cutting rule (ALG-10). **Citations** inside `cites:`, separated by commas: `path:start-end`, `path:line`, `test: <file> > <name>`, `doc: path#heading-slug`. Paths are relative to the repository root with forward slashes.

**Conflicts and open questions** (sections named exactly `Conflicts` and `Open questions`):

```text
- [ ] CF-1 (section: requirements) README says two retries; src/retry.ts:42 retries once. | 1: retry once | 2: retry twice
- [x] Q-2 (section: vision) Who are the primary users? answer: returning shoppers
```

An open item (`[ ]`) blocks blessing its named section until it is checked with `resolution:` or `answer:`, or the section is deferred.

## 4. Onboarding files

`.tenet/onboard/inventory.json`: `{schema_version, revision, sources: {files: [{path, kind: source|config|test|doc|ci|adr|manifest, sha256, lines}], skipped: [{path, reason}]}, modules: [{id, roots, languages}], tests: [{path, runner, cases}], docs: [{path, title, sections, last_changed}], owners: [{pattern, owners}], ci: [{path, commands}], size: {source_lines, areas}, layout: one-file | separate}`.

`.tenet/onboard/interview.json` (written by the agent): `{questions: [{id, text, answer, answered_at}]}`.

`.tenet/onboard/assignment.json`: `{schema_version, inventory, skill: "draft-specs", project_kind, views: [vision, requirements, design, experience, plan], layout, question_limit: 10, output: {paths}, rules: [no intent from code alone, every observed or documented statement cites, never resolve a conflict, never bless]}`.

## 5. Proof card and board models

**Proof card** (`kit/schemas/proof-card.json`): `{schema_version, tested: {commit, kind: merge-candidate|head, head, base}, acceptance_digest, items: [{id, text, result: proven|unproven|skipped|failed, method, tests: [name]}], weakening: {found: bool, by: [pattern], files}, protected: [path], specs: [{id, state, flags}], rules: [{rule, mode, would_block: bool, reason}], badge: advisory|verified-on-ci|self-accepted|intent-not-yet-blessed, why: [text], degraded: [reason]}`. The markdown card is rendered from it.

**`board.json`** (`schema_version` 1; `--since <rev>` returns changed items only): `{schema_version, as_of, read: {main, branches, records}, pack: {phases}, specs: [{path, section, level, state, flags, recorded}], pending_blessings: [{path, section, conflicts, open_questions}], items: [{id, title, lane, station, status, branch, age, depends_on, replay, lease, next_actions: [{who, action, reason, command, dispatch?}], claims: {applicable, satisfied, waived, unsatisfied}, guarantee, cost: {amount, source}}], decision_queue, review_queue, campaigns, active_runs?, areas: [{name, owner, promises, health, readiness, quarantined, waivers}], conflicts, flow, escalations}`. In alpha.0 only `as_of`, `read`, `specs` and `pending_blessings` are filled.

## 6. Test reports

| Runner | Flags in `checks.<name>.run` | `report` |
|---|---|---|
| vitest | `--reporter=junit --outputFile=.tenet/reports/<name>.xml` | `junit` |
| jest | `--json --outputFile=.tenet/reports/<name>.json` | `jest-json` |
| node:test | `--test-reporter=junit --test-reporter-destination=.tenet/reports/<name>.xml` | `junit` |
| pytest | `--junitxml=.tenet/reports/<name>.xml` | `junit` |
| go | `go test -json ./... > .tenet/reports/<name>.json` | `go-test-json` |
| other | the user's own command; `report: none` | per-test proof unavailable |

Every reader produces one model: `{runner, cases: [{full_name, file?, status: pass|fail|skip|error, tags: [id], duration_ms?}]}` (ALG-08).

## 7. CI and ownership by release

| Capability | alpha.0 | alpha.1 | alpha.2 on |
|---|---|---|---|
| Run checks, build the card | proof job | proof job | check job runs; attest job builds and signs |
| Keep results | records ref, unsigned | records ref | evidence store, signed |
| Read reviews and `/tenet` replies; write decisions | — | proof job (`forge`) | attest job (`signed`) |
| Record forge state as events | — | proof job | attest job |
| Publish board data | — | proof job, `board/` on the records ref | attest job |

**Proof job** (`.github/workflows/tenet.yml`, written by `init`): triggers `pull_request` (opened, synchronize, reopened, edited, ready_for_review), `pull_request_review` and `issue_comment` (alpha.1), `push` to the default branch. Permissions `contents: read`, `checks: write`, `pull-requests: read`; `contents: write` only in the `push` job that appends records. Steps:
1. install the version in `tenet.lock`
2. run each check in `tenet.yaml` from the target branch
3. read reports
4. parse the acceptance block
5. evaluate built-in rules
6. create or update the check run `Tenet`
7. on a read-only token, write the job summary instead

**Records ref** `refs/tenet/records`: `proof/<commit>.json`, `rules/<yyyy-mm>.jsonl`, `works/pr-<n>/events/<id>.json`, `board/board.json`. **Verify** (alpha.2): `tenet-checks.yml` on `pull_request` with `permissions: {}` uploads a bundle; `tenet-attest.yml` on `workflow_run` from the default branch downloads it, parses it as data, signs and writes `refs/tenet/evidence` (`evidence/<subject>/<id>.json`, `decisions/<id>.json`, `works/…`, `trust/<time>.json`).

**Release procedure** (each alpha is an `ops` work item): bump the version; changelog with structured fields (`kind: rule-added|rule-clarified|field-added|breaking`); `npm publish --provenance --tag next`; a GitHub release with the packed `.tgz`, kit archive and `SHA256SUMS`; install the packed artifact on clean Windows, macOS and Linux and run the quick start.

## 8. Commands

| Command | First | Writes | Notes |
|---|---|---|---|
| `init` | alpha.0 | files in the preflight, `.tenet/manifest.json` | `--yes`, `--vendor`; idempotent |
| `onboard` | alpha.0 | `.tenet/onboard/*`, drafted documents via the agent | `--inventory-only`, `--refresh` |
| `bless` | alpha.0 | front matter | refuses without a terminal (exit 2) |
| `context` | alpha.0 | — | `--paths`, `--ids`, `--query` (titles only), `--include-drafts` |
| `check`, `fix`, `split` | alpha.0 | `fix` and `split`: local files | `check --pack` |
| `board` | alpha.0 | — | `--all`; `--open` and `--since` from alpha.1 |
| `upgrade`, `remove`, `doctor`, `mcp` | alpha.0 | lock, block, keys; nothing for `doctor`, `mcp` | |
| `level`, `rules` | alpha.1 | `tenet.yaml` | |
| `verify --proof` | alpha.0 | check run or job summary; records ref on `push` | CI only; the proof job (§7) |
| `verify --run-checks`, `verify --attest` | alpha.2 | evidence store (attest) | CI only |
| `new`, `move`, `status`, `task done`, `close`, `resume`, `decide`, `resolve`, `lease`, `release`, `assign`, `result`, `inspect`, `record`, `agent check`, `skill list`, `build --target agents-md` | 0.1.0 | packets and events | |

Global flags: `--json`, `--cwd`, `--quiet`, `--verbose`, `--offline`. Under `--json` stdout holds exactly one JSON object `{ok, command, version, result, errors: [{file, line, rule, message, fix}]}`; human text goes to stderr. Exit codes in precedence order: 2 usage, 3 environment, 4 policy refusal, 1 gate or check failed, 0 success.

## 9. MCP

Newline-delimited JSON-RPC 2.0 over stdio; logs on stderr only; methods `initialize`, `tools/list`, `tools/call`. Tools, all without network:

| Tool | Input | Result |
|---|---|---|
| `tenet_context` | `{paths?, ids?, query?, include_drafts?, budget_tokens?}` | `{blessed: [{id, section, text, flags, reason}], drafts, index: [{id, title}], rules, lane}` |
| `tenet_check` | `{paths?}` | the `check --json` errors array |
| `tenet_status` | `{work?}` | level, spec states, work item status |
| `tenet_next` | `{work?}` | `next_actions` |
| `tenet_propose` | `{kind: spec-delta \| acceptance \| escalation, work?, payload}` | `{path}` under `.tenet/proposals/`; never edits specifications |

## 10. Install manifest and hosts

`.tenet/manifest.json`: `{schema_version, version, created: [{path, sha256}], blocks: [{path, kind: markdown|yaml, marker}], keys: [{path, pointer, previous}]}`. Markdown blocks: `<!-- tenet:begin v<version> -->` … `<!-- tenet:end -->`; YAML: `# tenet:begin` … `# tenet:end`. JSON files are owned by key (`/mcpServers/tenet`, `/servers/tenet` in `.vscode/mcp.json`), with the previous value kept.

| Host marker | Writes |
|---|---|
| `.claude/` or `CLAUDE.md` | `.mcp.json` key; skills in `.claude/skills/tenet-*/SKILL.md`; a block in `CLAUDE.md` pointing to `AGENTS.md` |
| `.cursor/` | `.cursor/mcp.json` key |
| `.vscode/` | `.vscode/mcp.json` key |
| always | the `AGENTS.md` block; skills in `.agents/skills/tenet-*/SKILL.md` when no host is detected |

MCP entries run `npx -y @vedprakash-m/tenet@<locked version> mcp`.

## 11. Determinism

Normalize CRLF to LF before hashing text; store paths with forward slashes; call git with `-c core.quotepath=false`; serialize JSON for hashing with RFC 8785 (keys in UTF-16 code-unit order; `NaN`, `Infinity` and `undefined` refused); timestamps UTC RFC 3339 with seconds; the clock is injected, never read inside algorithms.

## 12. Evidence payloads

| Kind | Payload | Completes when |
|---|---|---|
| `check` | report digest, log hash, fix hints `[{rule_id, path, hint}]` | Its expected cases were discovered and run (zero discovered is inconclusive); a static method reports the scope it analyzed |
| `measurement` | `{metric, value, threshold, direction, samples, baseline_value, rule, scope, confidence}`; mutation counts (eligible, generated, executed, killed, survived, invalid, equivalent, timed out, excluded) | Samples meet the pass rule's minimum |
| `attestation` | Artifact hashes (screenshots, recordings, traces) | The attested artifact is present |
| `observation` | Outcome status (`recovered`, `partial`, `no-change`, `insufficient-exposure`, `unknown`), scope, window; trust observations | The window has closed or the exposure is sufficient |
| `review` | `{round, judge, model_family, status, findings, invalid, resolved, requires_human}`; each finding is `introduced`, `exposed`, `inherited` or `uncertain`, and `located` or `substantiated` | Every finding is located or moved to `invalid`, which makes the review `incomplete` |
| `proof` | `{prover, version, theorem_hash, obligations, audit: {escape_hatches, axioms_used, axioms_allowed, unsafe_added}}` | Every obligation is discharged, the audit is clean and `theorem_hash` matches the approved definition; a model-check timeout is `unknown` |
| `simulation` | `{seed, fault_profile, steps, properties, replay, twin?}` | The replay command reproduces the result |
| `differential` | `{reference, generator, cases, divergences}` | All cases ran |
