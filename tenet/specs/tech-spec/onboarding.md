---
tenet: {spec: 1, doc: tech-spec, level: L2, version: "0.12", owner: ved}
sections:
  _preamble: {state: draft, digest: sha256:64432fcf9a607a02fa01925145bc157293ccfb5b174e4e87d5efa8bece34936b, flags: []}
  1-onboarding-and-blessing-r-223: {state: draft, digest: sha256:dff6730c4fb8e3c5567c21be17552fda976994b647f796c63bb76ef5152c6d7c, flags: []}
  2-install-and-upgrade: {state: draft, digest: sha256:56c2297a10f56338bfbe34c766bf81aa0f588f673f346fe978e671070b2ab9b4, flags: []}
  3-onboarding-measures-alg-13: {state: draft, digest: sha256:19eede5e04dfb76d4907f9059fb090b8e28a071c60556923d232e7b34bd19b7b, flags: []}
  4-release-procedure: {state: draft, digest: sha256:180901eb6fa30719465059730c7f4a2577c013f2eb07a389ed9177f75e79d990, flags: []}
---
# Tenet technical specification: onboarding, install and upgrade

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `tech-spec.md` §6.5 and §12 under the rollover rule (L-0022) · Previous version: `archive/specs/tech-spec/onboarding.md@0.11.md`

**Context card.** Setup, drafting, blessing, upgrade and removal. Implements PRD R-223 and tooling R-020, R-021, R-025, R-051, R-221; experience: UX Parts 0, 1 and 4. Formats: [contracts.md](contracts.md) §1–§4 and §10; CI: [ci.md](ci.md); agents: [agents.md](agents.md); algorithms ALG-02, ALG-03, ALG-04, ALG-11, ALG-12, ALG-13.

## 1. Onboarding and blessing (R-223)

<!-- provisional --> **Preflight and inventory.** `tenet onboard` needs at least one commit (else `TN-ENV-NO-COMMIT`: "make a first commit, then run tenet onboard"). It lists:
- what it will read: code, configuration, tests, docs, CI, owners
- skipped paths in `sources.skipped: [{path, reason}]`, sorted by `path` with the first matching reason: `"env"` (`.env`, `.env.*`), `"credentials"` (`*.pem`, `*.key`, `id_*`, `*credentials*`, `*secret*`), `"archive"` (`.archive/`, `archive/`, `old/` at any depth), `"vendored"` (`vendor/`, `node_modules/`, `dist/`, `build/`), `"generated"` (ALG-11), `"excluded"` (`onboard.exclude`), `"binary"` (NUL byte in first 8 KB or binary extension), `"oversize"` (`> 1_048_576` bytes); a negated `onboard.exclude` pattern ending in the archived paths (`!**/{.archive,archive,old}/**`) includes them again, and the human output prints that pattern when archive files were skipped; test files stay in `sources.files` (`kind: "test"`) and are excluded only from `size.source_lines`
- that drafting sends content to the user's own agent and its model provider

`--inventory-only` writes `.tenet/onboard/inventory.json` and `.tenet/onboard/assignment.json` from `HEAD` (`inventory: ".tenet/onboard/inventory.json"`, contracts §4, atomic if un-ignored), flags uncommitted code (`dirty_warning: true`) and reads working `tenet.yaml`. Human output: `Will read: …`, `Will skip: …`, `Drafting sends project content to your agent and its model provider.`, `Read <read_count> files at <revision> and skipped <skipped_count>.`, optional `Working tree has uncommitted changes.`, `First findings: …`, and `Drafting assignment: .tenet/onboard/assignment.json`. Output is deterministic over `(HEAD, working tenet.yaml, .tenet/reports/*)`.
- **Modules:** folders with a manifest (`package.json`, `pyproject.toml`, `setup.py`, `setup.cfg`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `Gemfile`, `composer.json`, `Package.swift`), otherwise top-level source folders. Languages: `ts/tsx → typescript`, `js/jsx/mjs/cjs → javascript`, `py → python`, `go → go`, `rs → rust`, `java → java`, `kt → kotlin`, `cs → csharp`, `rb → ruby`, `php → php`, `swift → swift`, `c/h → c`, `cc/cpp/hpp → cpp`, `scala → scala`.
- **CP-0068 AC-E4/E5 (L-0044).** The default layout is `separate` at 20,000 source lines, 4 owner areas, or 12,000 estimated documentation tokens (`ceil(project doc and adr characters / 4)`). Tenet's own records are not project documentation: exclude the records folder (`paths.records`, `tenet` by default) and the specification documents (Owner decision, 2026-11-27). Human output states the selected layout and why, and lists every unit with its paths. In `separate`, project documentation outside all code units forms a `docs` unit and is never merged into a code unit; root-level files keep their own paths.
- **Project kind (first match wins):**
  - `cli`: a `bin` entry in `package.json`, or a `cmd/` folder
  - `service`: a server framework dependency or a `Dockerfile*` exposing a port
  - `library`: a published non-private `package.json` (name + version), or `[project]`/`[package]` in `pyproject.toml`/`Cargo.toml`
  - `data`: `dbt_project.yml`, `dags/`, or notebooks (`*.ipynb`)
  - `infrastructure`: Terraform (`*.tf`), `Chart.yaml`, or Kubernetes manifests (`apiVersion:` + `kind:`)
  - `application`: otherwise
- **Tests:** files matching ALG-09; `inventory.tests[]` keeps `{path, runner, cases}` (`scanTests`; names stay in test files; `.py → pytest`, `.go → go`, `.java → junit`, `.rs → cargo`, JS/TS imports/config: `node:test`/`vitest`/`jest`).
- **Docs:** first `# ` heading (fallback `basename(path)`), `## ` slugs, `last_changed` (fallback `revision`).
- **Instruction files** (`instructions`): `.github/copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/**`, `.windsurfrules`, and `AGENTS.md` outside Tenet's block. Drafter turns project rules into cited `scope: global` requirements and working rules into a design section (agents.md §2); blessed Tenet blocks point to blessed text.

Repository facts and `assignment.json` are byte-identical over `(HEAD, working tenet.yaml)`. Local reports under `.tenet/reports/*` and `checks[].report_path` go only in `observations.reports` (`sha256` name; non-empty suppresses `no-test-report`; tracked reports remain in `sources.files`).

**First findings** (the "first useful finding", V-V3). `init` and `onboard --inventory-only` print deterministic findings within ten minutes of install, sorted by `kind` below, then `path`, then `message`:
- `dead-path`: links and inline path references name missing files (`./`/`../` resolve relative to `doc.path`; `/…` from root; bare names doc-relative first then repo-relative; `path`: doc path; `message: "<doc.path> links missing path <target>"`) **CP-0068 AC-B3 (L-0045).** Count a reference only if it has a path separator, a recognizable file suffix or a standard filename. An explicit Markdown link may name a file with another suffix. Skip URLs, inline identifiers and function names. The printed count uses these same findings.
- `skipped-tests`: skipped or focused tests present (`path`: test file; `message: "<count> skipped or focused test(s) in <test.path>"`)
- `owners-unmatched`: CODEOWNERS patterns matching nothing (leading `/` root-anchored, trailing `/` subtree, bare name `**/…`; `path`: CODEOWNERS path; `message: "CODEOWNERS pattern <pattern> matches no tracked files"`)
- `no-test-report`: whether a test report can be produced (`path`: first CI workflow path, else `"tenet.yaml"`; `message: "No machine-readable test report configured"`)

**Drafting units and output paths.** The assignment (`.tenet/onboard/assignment.json`) lists units (ALG-11) in order, each with its slice of the inventory.

| View | `one-file` | `separate` |
|---|---|---|
| vision | `tenet/intent.md` `## Vision` | `tenet/vision.md` (L0) |
| requirements | `## Requirements` | `tenet/specs/prd.md` (L1) |
| design | `## Design` | `tenet/specs/tech-spec.md` (L2) |
| experience | `## Experience` | `tenet/specs/ux-spec.md` (L2) |
| plan | `## Plan` | `tenet/specs/plan.md` (L2) |

`intent.md` sections keep the shown levels (`sections.<slug>.level`, R-207). Vision items are `V-<n>` (groups may use `V-P18`). **Who writes what:**
- **CP-0068 AC-A3 (L-0045).** The agent drafts the Markdown, citations, origins, `scope`, conflicts and questions. `tenet fix` creates the YAML header. Add optional `applies_to` path globs to the generated section entries.
- `tenet fix` writes IDs, front matter, section entries, digests and `drafted_from` (the inventory's revision).
- `tenet onboard --card` records `drafted_at_rev`, the commit holding the draft, which ALG-13 compares against.
- The `draft-specs` skill ends with `fix`, `check`, a commit and `onboard --card` (agents.md §2). The drafter writes only the output paths.

**Draft format.** Requirement lines, citations, conflicts, open questions and front matter follow contracts §3. In an `ID` table, text comes from `Requirement`, else `Rule`, else the first text column. `Serves`, `Origin`, `Cites`, `Scope` and `Adopted by` map case-insensitively (`—`, `-` or empty → `null`/`[]`); braces are optional. Other columns (`Release`, `Guarantee`, `Status`…) are kept and ignored. Vision tables (L0) use the same parse. `inferred` statements cannot be blessed until edited or adopted (origin becomes `asked`, with `adopted_by`).

**The onboarding card.** No target Tenet workflow. `tenet onboard --card` checks uncommitted spec edits (`TN-SUBJ-DIRTY`), pins `drafted_at_rev` when unset (existing stamps stay pinned unless `--refresh` or cleared), and renders reads, conflicts (omitted at zero), section/origin counts, reading times (`Math.ceil(words / 200)` using `minute`/`minutes`; `"Sections (about <n> minutes)"` sums section minutes), and citation check. **CP-0068 AC-E12/E13 (L-0045).** It groups sections under each file name, labels the preamble as `intro` and a completeness checklist as `checklist (<n> items)`, and leaves those two out of unlabelled counts and review time. A table with no requirement IDs is `table, no requirements`. `Available to the drafter:` replaces `Read:`, skipped reasons carry counts, and `Cited:` counts distinct cited files. Combining `--card` with `--inventory-only`, `--refresh` or `--layout` returns `TN-USAGE-ONBOARD` exit 2. **Proposal · CP-0066 AB-A8–A10.** Open questions follow conflicts; stamped specifications and citation resolution appear. The next step uses working-tree/upstream state. `--pr <number>` identifies an existing pull request locally. Goldens: `pkg/conformance/cards/`; CI cards start after setup merges. Supported starts: protected main (onboarding pull request), empty repository (commit to main), template clone, contributor without settings rights (pull request waits for someone with rights).

**Checks and blessing.** `tenet check` resolves citations (ALG-04) and flags missing origins. Interactive `tenet bless` (ALG-03) shows conflicts, then sections with reading times (`bless`, `confirm`, `edit`, `reject`, `defer`). It uses `owners[]` (card gives `gh pr checkout <n>`), appends `<records>/blessed/log.jsonl`, and records `recorded: "self"` (advisory; cards list changes; `forge` in alpha.1, `signed` in alpha.2).

**CP-0068 AC-A1–A5 (L-0045).** The assignment output is checked even if its front matter is missing or invalid. `board` reports the draft’s diagnostic instead of the empty-board message. `bless` validates selected specifications before asking any questions. Follow the diagnostic’s repair steps, then retry.

Conflict resolutions use `resolution:` on `CF` items (`Resolution:` accepted on read), optional `(section: <slug|heading>)` or `null`, and `(affects: ID1, ID2)`. A choice contradicting a drafted ID opens it for editing; the text must change or vanish before `resolution:` is written and blessing is allowed.

**Last blessed text stays in force** (blessed copy): `edited` marks unblessed proposals (rejecting keeps it); `sources-changed` prompts `confirm`; `onboard --refresh` preserves IDs, edits, rejections and blessings, returns `check` diagnostics, diffs since `drafted_at_rev` (fails on missing anchors; assigns all units if none exist), skips outputs/`.tenet/`/skipped paths, and assigns matching `within(root, file)` units (else all units).

## 2. Install and upgrade

`init` runs preflight (R-020), then writes and records each write in `.tenet/manifest.json` (ALG-12, UTF-8, LF, one trailing `\n`):
- `tenet.yaml`: synthesized `checks.test` with the runner command and [ci.md §2](ci.md#2-running-checks) setup; `package.json` is never edited
- `tenet.lock` (queries registry `dist.integrity` except `0.0.0` or `--offline`; a registry transport failure is `TN-ENV-REGISTRY` (exit 3), and only "not found" plus `0.0.0` or `--offline` leads to local integrity (`x-integrity-source: "local"`, sorted installed files), which CI checks over installed files as advisory below `verify`; `doctor` verifies that digest and notes CI advisory until `tenet upgrade`; bad integrity fails `TN-LOCK-INVALID`, never `TN-INTERNAL`)
- the `AGENTS.md` block (agents.md §1)
- on GitHub remotes, the recorder workflow, and either Tenet's test workflow or the existing-CI step (`ci_mode: "existing-ci"|"tenet-workflow"`); on non-GitHub remotes, workflows and `.github/pull_request_template.md` are omitted (`ci_mode: "none"`, `ci_reason: "non-GitHub remote: local checks and specifications are enabled; CI proof cards require GitHub in alpha.0"`)
- the pull-request template block (GitHub) and the `.gitignore` and `.gitattributes` blocks
- the host skills and MCP entries selected below; the plan lists every created or edited path with its short purpose

**CP-0068 AC-E1 (L-0045).** `init` checks package integrity during preflight. A failed registry lookup gives a one-line cause and, in a terminal, offers local integrity before final confirmation. Full npm output requires `--verbose`. `--yes` requires explicit `--offline` to proceed after a transport error. When npm uses another registry, the plan explains that Tenet checks public npm for the published integrity CI verifies.

`.tenet/manifest.json`: `{schema_version, version, created: [{path, sha256}], blocks: [{path, kind: markdown|yaml, marker, previous_block?, prefix_sep?}], keys: [{path, pointer, previous, installed, previous_raw?}]}` (repo-relative only). Windows outside-repo edits go only in git-ignored `.tenet/manifest.local.json` (`{schema_version: 1, profile_roots, keys: [{host, path, pointer, previous, installed, previous_raw?}]}`). `.tenet/manifest.pending.json` holds the full plan (ALG-12). Markdown markers: `<!-- tenet:begin v<version> -->` … `<!-- tenet:end -->`; YAML markers: `# tenet:begin` … `# tenet:end`. Owned JSON keys: `/mcpServers/tenet`, `/servers/tenet` in `.vscode/mcp.json`; preserve previous value and optional `previous_raw`.

| Host marker | Writes |
|---|---|
| `.claude/` or `CLAUDE.md` | `.mcp.json` key; skills in `.claude/skills/tenet-*/SKILL.md`; a block in `CLAUDE.md` pointing to `AGENTS.md` |
| `.cursor/` | `.cursor/mcp.json` key |
| `.github/copilot-instructions.md` | a marked block pointing to `AGENTS.md` |
| `.vscode/` | `.vscode/mcp.json` key |
| always, for agent-neutral use | the `AGENTS.md` block ([agents.md](agents.md) §1); skills in `.agents/skills/tenet-*/SKILL.md`; a `.gitignore` block (`.tenet/*`, `!.tenet/manifest.json`, `!.tenet/kit/`); an `## Acceptance` block in `.github/pull_request_template.md`; a `.gitattributes` block marking every file Tenet writes `text eol=lf` (on Windows with `core.autocrlf=true` and `core.safecrlf=true`, `git add` otherwise refuses LF files, as Spike B hit) |

**Proposal (CP-0066 AB-B4):** `init --host <name>` is repeatable; names are `claude`, `cursor`, `copilot` and `vscode`. A named host gets marker writes without an existing marker. With no detected or selected host, the repository stays agent-neutral with portable `.agents/skills/`; the plan recommends `--host claude` for Claude Code.

Host files above are repository writes covered by the normal `init` preflight. External local profile files still require the separate local-host consent described below; `--yes` alone does not grant that consent.

MCP entries run `npx -y @vedprakash-m/tenet@<locked version> mcp` in committed files. Windows hosts needing `cmd /c` get that form only in allowlisted local settings (`~/.claude.json`, `%APPDATA%/Cursor/User/mcp.json`, `%APPDATA%/Code/User/mcp.json`) after explicit consent (`[y/N]`, or `--local-hosts` under `--yes`; never `--yes` alone). Fixture tests isolate `localProfileRoot`. Preflight lists these separately as `Will edit locally (outside repository): …` / `local_keys`, never as shared repo writes (CP-0045). `upgrade` rewrites the pin in repo entries and recorded `manifest.local.json` entries.

It prints findings and offers onboarding (empty repo: purpose and kind; `--yes`: seed `tenet/intent.md` with kind `other`, purpose `"Undecided · edit or run tenet onboard"`, and finding `no-test-report`). Existing files change only in marked blocks or owned JSON keys. Integrity uses hashes; files stay writable. `owners[]` starts from `git config user.name` and CODEOWNERS handles (`id` = handle without `@`, non-alphanumeric runs lowercased to `-`), confirmed once (`--yes`: git user only). `kit_sha256` hashes sorted `<path>\0<sha256 of file>` lines for every `kit/` file.

`tenet remove` reverses the manifest (ALG-12), retires `.tenet/manifest.json` and `.tenet/manifest.pending.json`, keeps specifications, records and user-changed values, and returns `reminder: "If you made the Tenet check required in branch protection or rulesets, remove that rule in your forge settings."`. `tenet check` reports a package version differing from the lock ("run tenet upgrade").

**Upgrade** (alpha.0 on): update the lock, regenerate `AGENTS.md`, workflows, skills and MCP pins, report `changed: [{path, action: created|replaced|kept}]`, and run `tenet check`. It never changes `tenet.yaml` (`level`, `rules`, `checks`, `owners`) or starts a rule beyond `observe`. **Proposal (CP-0066 AB-E1/E2; CP-0068 AC-C1):** matching versions preserve entries and unchanged bytes. The generated `AGENTS.md` document list names both the one-file and separate-document outputs, so onboarding may choose either layout without a later same-version upgrade rewriting that block. It replaces differing prior-owned files and rewrites legacy sidecars to hash-and-range records without cited text. M4 stages, migrates via the restricted API, regenerates, swaps, classifies fields and schedules a pull request.

**Install and removal (`ALG-12`).**
- **Paths:** resolve every planned or recorded repo path inside the repository root. `local_key` entries resolve only inside `manifest.local.json`'s `profile_roots[host]`; reject absolute paths, `..`, and outside symlinks or junctions (`TN-PATH-ESCAPE`, before pending-plan write and `remove`).
- **`init` plans every write**, then applies it:
  1. Validate confinement (`TN-PATH-ESCAPE`) and unmanaged collisions (`TN-INIT-EXISTS` if a created file differs and `--force` is absent). Declining `Continue? [Y/n]` writes nothing and returns `{plan, wrote: {created: [], blocks: [], keys: [], local_keys: []}, findings: [], cancelled: true}` (exit 0). Otherwise write `.tenet/manifest.pending.json` `{schema_version: 1, version, writes: [{id, kind: file|block|key|local_key, path, profile_root?, pointer?, before_sha256, after_sha256, content?}], manifest}`.
  2. Apply in order, checking SHA-256: matching `after_sha256` is already applied; differing from `before_sha256` keeps `.tenet/manifest.pending.json` and fails `TN-INIT-EXISTS` (exit 4). Append or replace blocks, preserving surrounding bytes including CRLF and recording `previous_block` / `prefix_sep` in `manifest.blocks[]`; set JSON keys and record `previous`, `installed`, optional `previous_raw` in `manifest.keys[]`.
  3. Rename the pending file to `manifest.json`.
  Recovery completes writes.
- **`remove`:**
  - delete a created file only when its SHA-256 matches the manifest; otherwise keep and report it in `kept` (`reason: "edited-by-you"`)
  - delete text between markers, or restore `previous_block` / `prefix_sep` when recorded and surrounding bytes match
  - restore a key's `previous` (or `previous_raw` if no unowned key changed) only when it still holds `installed`; otherwise keep it (`reason: "edited-by-you"`)
  - read `checks[].report_path` entries from `tenet.yaml` before removing created files, then delete `.tenet/manifest.json`, `.tenet/manifest.local.json`, `.tenet/manifest.pending.json`, `.tenet/onboard/inventory.json`, `.tenet/onboard/assignment.json`, `.tenet/cache/**`, `.tenet/runs/**`, reports under `.tenet/reports/` matching that path or `test.xml|test.json|junit.xml|ctrf.json|go-test.json|go-test-json.json|jest.json|jest-json.json`, created files/local wrappers and empty managed directories; reports and working-state files are verified by `lstat` confinement without traversing symlinks; report each deleted working-state file in `removed` (`kind: "file"`)
  - never touch specifications, records, `.tenet/onboard/interview.json`, or custom files inside/outside `.tenet/`
- Fixtures cover interruptions and exact restoration of pre-existing `AGENTS.md` and `.mcp.json`; keep edited `tenet.yaml` and post-install key edits.

## 3. Onboarding measures (ALG-13)

- **A statement** is one requirement line, or one sentence in a vision, design, experience or plan section.
- **Kept:** whitespace-collapsed, `{…}`-removed text identical in draft/blessed copy. Other text is substantive edit. Unchanged adoptions count in `kept` and `adopted`; deleted drafts count in `edited` (`kept + edited === drafted`). `bless` compares each finished section with `drafted_at_rev`, the commit holding the agent's draft, then writes `<records>/blessed/log.jsonl` (**proposal · CP-0066 AB-A5:** `minutes` tracks section review). Missing or unreachable `drafted_at_rev` after squash merge leaves all five `statements` counts `null`.
- **Denominator:** statements in blessed or rejected sections (`defer` writes a log row but stays outside `ALG-13`).
- **Recall:** human-scored answer-key obligations matched by a kept or edited statement.
- **Invented:** statements found in neither sources nor answer key.
- **Blessing minutes (proposal · CP-0066 AB-A5):** sum section review minutes in the log.
- **Automatic checks:** every citation resolves; fixture conflicts appear as `CF` items; every fixture `asked` statement has an answer in `.tenet/onboard/interview.json`.
- **Each run records** agent, model, effort and fixture revision.

## 4. Release procedure

Each alpha is an `ops` work item:
1. Bump version; write changelog (`kind: rule-added|rule-clarified|field-added|breaking`).
2. `npm pack` each workspace once; record `.tgz` digests and assert file lists (no `pkg/evals`).
3. Install on clean Windows, macOS and Linux; run Part 1 journeys and scenarios.
4. Publish identical files with `--provenance --tag next` via trusted publishing. A new package may use a short-lived granular token. If one package publishes and the other fails, the release is retried with the same version.
5. Create a GitHub release with tarballs, kit archive and `SHA256SUMS`.
6. Install from registry; compare bytes.
7. Update/tag `tenet-starter`.
