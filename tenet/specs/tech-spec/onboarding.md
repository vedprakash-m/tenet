# Tenet technical specification: onboarding, install and upgrade

> Level L2 · Version 0.12 · Part of [tech-spec.md](../tech-spec.md) · Status: **draft, awaiting the Owner's approval** · Budget: 6,000 tokens · Split from `tech-spec.md` §6.5 and §12 under the rollover rule (L-0022) · Previous version: `archive/specs/tech-spec/onboarding.md@0.11.md`

**Context card.** How a project gets Tenet, how its specifications are drafted and blessed, and how Tenet is upgraded and removed. Implements PRD R-223 and tooling R-020, R-021, R-025, R-051 and R-221; the experience is UX spec Parts 0, 1 and 4. File formats: [contracts.md](contracts.md) §1–§4 and §10; CI: [ci.md](ci.md); what agents are told: [agents.md](agents.md); algorithms ALG-02, ALG-03, ALG-04, ALG-11, ALG-12, ALG-13.

## 1. Onboarding and blessing (R-223)

<!-- provisional --> **Preflight and inventory.** `tenet onboard` needs at least one commit (else `TN-ENV-NO-COMMIT`: "make a first commit, then run tenet onboard"). It lists:
- what it will read: code, configuration, tests, docs, CI, owners
- what it skips into `sources.skipped: [{path, reason}]` (sorted by `path`, first matching reason): `"env"` (`.env`, `.env.*`), `"credentials"` (`*.pem`, `*.key`, `id_*`, `*credentials*`, `*secret*`), `"vendored"` (`vendor/`, `node_modules/`, `dist/`, `build/`), `"generated"` (ALG-11), `"excluded"` (`onboard.exclude`), `"binary"` (NUL byte in first 8 KB or binary extension), `"oversize"` (`> 1_048_576` bytes); test files stay in `sources.files` (`kind: "test"`) and are excluded only from `size.source_lines`
- that drafting sends content to the user's own agent and its model provider

`--inventory-only` stops there. It writes `.tenet/onboard/inventory.json` and `.tenet/onboard/assignment.json` (`inventory: ".tenet/onboard/inventory.json"`, contracts §4, git-ignored via `init`; `onboard` writes them atomically without refusing missing ignore rules) from `HEAD`. Uncommitted source changes are left out, with a warning (`dirty_warning: true`); `tenet.yaml` is read from the working tree, so a just-written setup applies. CLI human output prints `Will read: …`, `Will skip: …`, `Drafting sends project content to your agent and its model provider.`, `Read <read_count> files at <revision> and skipped <skipped_count>.`, optional `Working tree has uncommitted changes.`, optional `First findings: …`, and `Drafting assignment: .tenet/onboard/assignment.json`. Running `onboard` twice gives the same result over `(HEAD, working tenet.yaml, .tenet/reports/*)`.
- **Modules:** folders holding a manifest (`package.json`, `pyproject.toml`, `setup.py`, `setup.cfg`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `build.gradle.kts`, `Gemfile`, `composer.json`, `Package.swift`), else top-level source folders; languages map `ts/tsx → typescript`, `js/jsx/mjs/cjs → javascript`, `py → python`, `go → go`, `rs → rust`, `java → java`, `kt → kotlin`, `cs → csharp`, `rb → ruby`, `php → php`, `swift → swift`, `c/h → c`, `cc/cpp/hpp → cpp`, `scala → scala`.
- **Project kind (first match wins):**
  - `cli`: a `bin` entry in `package.json` or `cmd/` folder
  - `service`: a server framework dependency or a `Dockerfile*` exposing a port
  - `library`: a published non-private `package.json` (name + version) or `[project]`/`[package]` in `pyproject.toml`/`Cargo.toml`
  - `data`: `dbt_project.yml`, `dags/`, or notebooks (`*.ipynb`)
  - `infrastructure`: Terraform (`*.tf`), `Chart.yaml`, or Kubernetes manifests (`apiVersion:` + `kind:`)
  - `application`: otherwise
- **Tests:** files matching ALG-09; `inventory.tests[]` keeps `{path, runner, cases}` (declaration count from `scanTests`; names stay in test files, not duplicated in v1 JSON; `.py → pytest`, `.go → go`, `.java → junit`, `.rs → cargo`, JS/TS imports/config → `node:test`/`vitest`/`jest`).
- **Docs:** each doc's first `# ` heading (fallback `basename(path)`), its `## ` slugs, and its `last_changed` commit date (fallback `revision`).
- **Instruction files** (kind `instructions`): `.github/copilot-instructions.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/**`, `.windsurfrules`, and `AGENTS.md` outside Tenet's block. The drafter turns their project rules into cited `scope: global` requirements and their working rules into a design section (agents.md §2); once blessed, Tenet's block in those files points to the blessed text.

Repository facts and `assignment.json` are byte-identical over `(HEAD, working tenet.yaml)`. Local test reports under `.tenet/reports/*` and `checks[].report_path` go only in `observations.reports` (named by `sha256` digest; non-empty `observations.reports` suppresses `no-test-report`; tracked `.tenet/reports/*` remain in `sources.files`).

**First findings** (the "first useful finding", V-V3). These are printed by `init` and `onboard --inventory-only`, deterministic, within ten minutes of install (sorted by `kind` order below, then `path`, then `message`):
- `dead-path`: doc paths and links that name missing files (`./`/`../` resolve relative to `doc.path`; `/…` from root; bare names doc-relative first then repo-relative; `path`: doc path; `message: "<doc.path> links missing path <target>"`)
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

`intent.md` sections take the levels shown (`sections.<slug>.level`), so one file keeps section-level governance (R-207). Vision items are `V-<n>` (projects may group them, as `V-P18`). **Who writes what:**
- The agent writes text, citations, origins, `scope`, `applies_to`, conflicts and questions.
- `tenet fix` writes IDs, front matter, section entries, digests and `drafted_from` (the inventory's revision).
- `tenet onboard --card` records `drafted_at_rev`, the commit holding the draft, which ALG-13 compares against.
- The `draft-specs` skill ends with `fix`, `check`, a commit and `onboard --card` (agents.md §2). The drafter writes only the output paths.

**Draft format.** Requirement lines, citations, conflicts, open questions and front matter follow contracts §3. A requirement may also sit in a table whose first column is `ID`: the text comes from `Requirement`, else `Rule`, else the first other text column; `Serves`, `Origin`, `Cites`, `Scope` and `Adopted by` map (case-insensitive headers; `—`, `-` or empty cells map to `null`/`[]`) to the same metadata; braces are optional there; every other column (`Release`, `Guarantee`, `Status`…) is kept and ignored. Vision tables (L0) are parsed the same way for `V-` items. `inferred` statements cannot be blessed until a person edits or explicitly adopts them (origin becomes `asked`, with `adopted_by`).

**The onboarding card.** The target branch has no Tenet workflow yet, so `tenet onboard --card` checks uncommitted spec edits (`TN-SUBJ-DIRTY`), pins `drafted_at_rev` when unset (leaving existing stamps pinned unless `--refresh` or cleared), and renders the card for the pull request description (`onboard --card` cannot combine with `--inventory-only`, `--refresh` or `--layout`, else `TN-USAGE-ONBOARD` exit 2): what was read, conflicts (heading omitted when zero conflicts), sections with statement counts by origin, reading times (`Math.ceil(words / 200)` per section using `minute`/`minutes`; `"Sections (about <n> minutes)"` sums section minutes), and the citation check. **Proposal · CP-0066 AB-A8–A10.** The card puts open questions after conflicts and lists specifications stamped during that run. It describes citation resolution and uses the working tree and upstream for the next step. Use `--pr <number>` to identify an existing pull request using local arguments. Golden examples live in `pkg/conformance/cards/`. CI cards begin after the setup merges. Supported starts:
- protected main (the onboarding pull request)
- an empty repository (commit to main)
- a template clone
- a contributor without settings rights (the pull request waits for someone who has them)

**Checks and blessing.** `tenet check` resolves every citation (ALG-04) and flags statements without an origin. `tenet bless` follows ALG-03:
- interactive only; conflicts first, then each section with its reading time
- actions: bless, confirm (for `sources-changed`), edit, reject, defer
- the person picks who they are from `owners[]`; the card's last line tells them how to get the branch (`gh pr checkout <n>`)
- each session is logged in `<records>/blessed/log.jsonl`
- the blessing is recorded as `self` (advisory: anyone with write access could edit front matter, which is why the card lists blessings changed in each pull request); from alpha.1 a review action also blesses, recorded as `forge`; from alpha.2, `signed`

A conflict's resolution is written as `resolution:` on its `CF` item (case-insensitive `Resolution:` accepted on read). Open conflicts may name `(section: <slug|heading>)` or `null` (document-wide) and optional `(affects: ID1, ID2)`. When the chosen option contradicts a drafted statement ID, bless opens that statement for editing and requires its text to change or vanish before recording `resolution:` and allowing blessing.

The **last blessed text stays in force** (the blessed copy):
- An edit to it is flagged `edited`: an unblessed proposal that rejecting keeps out.
- A change to the cited lines is flagged `sources-changed`: confirm re-anchors.
- Re-running `onboard --refresh` keeps IDs, edits, rejections and blessings, runs `check` (whose diagnostics return in the CLI envelope without blocking the write), unions `git diff` from every `drafted_at_rev` (failing if an anchor commit is missing; assigning all units when none exists), excludes spec outputs/`.tenet/`/skipped paths, and assigns units matching `within(root, file)` (or all units if any file outside all units changed).

## 2. Install and upgrade

`init` runs the preflight (R-020) and writes, all recorded in `.tenet/manifest.json` (ALG-12, UTF-8 with LF and one trailing `\n`):
- `tenet.yaml`: synthesized check `checks.test` with the runner command and setup of [ci.md §2](ci.md#2-running-checks); `package.json` is never edited
- `tenet.lock` (queries registry `dist.integrity` except `0.0.0` or `--offline`; a registry transport failure is `TN-ENV-REGISTRY` (exit 3), and only "not found" plus `0.0.0` or `--offline` leads to local integrity (`x-integrity-source: "local"`, sorted installed files), which CI checks over installed files as advisory below `verify`; `doctor` verifies that digest and notes CI advisory until `tenet upgrade`; bad integrity fails `TN-LOCK-INVALID`, never `TN-INTERNAL`)
- the `AGENTS.md` block (agents.md §1)
- on GitHub remotes, the recorder workflow, and either Tenet's test workflow or the existing-CI step (`ci_mode: "existing-ci"|"tenet-workflow"`); on non-GitHub remotes, workflows and `.github/pull_request_template.md` are omitted (`ci_mode: "none"`, `ci_reason: "non-GitHub remote: local checks and specifications are enabled; CI proof cards require GitHub in alpha.0"`)
- the pull-request template block (GitHub) and the `.gitignore` and `.gitattributes` blocks
- the host skills and MCP entries selected below; the plan lists each host path with its reason

`.tenet/manifest.json`: `{schema_version, version, created: [{path, sha256}], blocks: [{path, kind: markdown|yaml, marker, previous_block?, prefix_sep?}], keys: [{path, pointer, previous, installed, previous_raw?}]}` (repo-relative paths only); outside-repo Windows local host edits go only in git-ignored `.tenet/manifest.local.json` (`{schema_version: 1, profile_roots, keys: [{host, path, pointer, previous, installed, previous_raw?}]}`). `.tenet/manifest.pending.json` holds the full plan before the first write (ALG-12). Markdown blocks: `<!-- tenet:begin v<version> -->` … `<!-- tenet:end -->`; YAML: `# tenet:begin` … `# tenet:end`. JSON files are owned by key (`/mcpServers/tenet`, `/servers/tenet` in `.vscode/mcp.json`), with the previous value (and optional `previous_raw` bytes) kept.

| Host marker | Writes |
|---|---|
| `.claude/` or `CLAUDE.md` | `.mcp.json` key; skills in `.claude/skills/tenet-*/SKILL.md`; a block in `CLAUDE.md` pointing to `AGENTS.md` |
| `.cursor/` | `.cursor/mcp.json` key |
| `.github/copilot-instructions.md` | a marked block pointing to `AGENTS.md` |
| `.vscode/` | `.vscode/mcp.json` key |
| always, for agent-neutral use | the `AGENTS.md` block ([agents.md](agents.md) §1); skills in `.agents/skills/tenet-*/SKILL.md`; a `.gitignore` block (`.tenet/*`, `!.tenet/manifest.json`, `!.tenet/kit/`); an `## Acceptance` block in `.github/pull_request_template.md`; a `.gitattributes` block marking every file Tenet writes `text eol=lf` (on Windows with `core.autocrlf=true` and `core.safecrlf=true`, `git add` otherwise refuses LF files, as Spike B hit) |

**Proposal (CP-0066 AB-B4):** `init --host <name>` is repeatable and accepts `claude`, `cursor`, `copilot` or `vscode`. A named host contributes the same writes as its marker without requiring the marker to exist. A repository with no detected or selected host stays agent-neutral: it keeps the portable `.agents/skills/` files and the plan says to rerun with `--host claude` for Claude Code.

Host files above are repository writes covered by the normal `init` preflight. External local profile files still require the separate local-host consent described below; `--yes` alone does not grant that consent.

MCP entries run `npx -y @vedprakash-m/tenet@<locked version> mcp` in the committed file; where a Windows host needs `cmd /c`, `init` writes that form only into allowlisted per-host local settings (`~/.claude.json`, `%APPDATA%/Cursor/User/mcp.json`, `%APPDATA%/Code/User/mcp.json`) when explicitly consented (`[y/N]` prompt interactively, or `--local-hosts` under `--yes` — never by `--yes` alone; fixture tests isolate with `localProfileRoot`), listed separately in preflight as `Will edit locally (outside repository): …` / `local_keys`, never into shared repo files (CP-0045 tests both). `upgrade` rewrites the pinned version in every repo entry and any already-recorded `manifest.local.json` entry.

It then prints the first findings and offers onboarding (in an empty repo, asks purpose and kind, or under `--yes` seeds `tenet/intent.md` with kind `other`, purpose `"Undecided · edit or run tenet onboard"`, and finding `no-test-report`). Existing files are edited only inside marked blocks or owned JSON keys. Integrity is checked by hash; files are not made read-only. `owners[]` starts from `git config user.name` and the CODEOWNERS handles (`id` = handle stripped of `@` with non-alphanumeric runs lowercased to `-`), confirmed once (with `--yes`: the git user only). The lock's `kit_sha256` is SHA-256 over the sorted lines `<path>\0<sha256 of file>` for every file under `kit/`.

`tenet remove` reverses the manifest (ALG-12), retires `.tenet/manifest.json` and `.tenet/manifest.pending.json`, keeps specifications, records and values the user changed, and returns `reminder: "If you made the Tenet check required in branch protection or rulesets, remove that rule in your forge settings."`. `tenet check` reports a package version that differs from the lock ("run tenet upgrade").

**Upgrade** (alpha.0 on): update the lock from the installed release, regenerate the `AGENTS.md` block, workflows, skills and owned MCP pins (repo and Windows local profile), report `changed: [{path, action: created|replaced|kept}]`, and run `tenet check`. It never changes `tenet.yaml` (`level`, `rules`, `checks`, `owners`) or starts a new rule beyond `observe`. **Proposal (CP-0066 AB-E1/E2):** when the installed and manifest versions match, upgrade preserves every manifest entry and changes no file whose bytes already match the current version's generated form. It still replaces a prior-owned generated file that differs from that form, and rewrites legacy citation sidecars to hash-and-range records without cited text. From M4: stage, migrate with a restricted file API, regenerate, swap atomically; classify from structured fields; a scheduled pull request.

**Install and removal (`ALG-12`).**
- **Paths:** every planned or recorded repo path is resolved and must stay inside the repository root; allowlisted `local_key` entries resolve strictly inside `manifest.local.json`'s `profile_roots[host]`: no unpermitted absolute paths, `..`, or symlink or junction leading outside (`TN-PATH-ESCAPE`, checked before writing `.tenet/manifest.pending.json` and before `remove`).
- **`init` plans every write**, then applies it:
  1. Validate path confinement (`TN-PATH-ESCAPE`) and unmanaged file collisions (`TN-INIT-EXISTS` when a created file already exists with different content and `--force` is absent) before touching disk. If the user declines the preflight prompt (`Continue? [Y/n]`), write nothing and return `{plan, wrote: {created: [], blocks: [], keys: [], local_keys: []}, findings: [], cancelled: true}` (exit 0). Otherwise write `.tenet/manifest.pending.json` `{schema_version: 1, version, writes: [{id, kind: file|block|key|local_key, path, profile_root?, pointer?, before_sha256, after_sha256, content?}], manifest}`.
  2. Apply in order, checking each target file's SHA-256 before writing: if `current_sha256 === after_sha256`, skip as already applied; if `current_sha256 !== before_sha256`, stop immediately, keep `.tenet/manifest.pending.json`, and fail with `TN-INIT-EXISTS` (exit 4). Blocks go at the end of the file, or replace an existing block (preserving surrounding bytes, including CRLF, and recording `previous_block` / `prefix_sep` in `manifest.blocks[]`). JSON keys are set (recording `previous`, `installed`, and optional `previous_raw` in `manifest.keys[]`).
  3. Rename the pending file to `manifest.json`.
  A rerun after an interruption finds the pending file and completes remaining writes.
- **`remove`:**
  - deletes a created file only if its SHA-256 matches the manifest; otherwise it is kept and reported in `kept` (`reason: "edited-by-you"`)
  - deletes text between markers (or restores `previous_block` / `prefix_sep` when recorded and surrounding bytes match)
  - restores a key's `previous` value (or `previous_raw` when no unowned key changed) only if it still holds the `installed` value; otherwise keeps it (`reason: "edited-by-you"`)
  - read any `.tenet/reports/` `checks[].report_path` entries from `tenet.yaml` before removing created files, then delete `.tenet/manifest.json`, `.tenet/manifest.local.json`, `.tenet/manifest.pending.json`, Tenet's local generated working state under `.tenet/` (`.tenet/onboard/inventory.json`, `.tenet/onboard/assignment.json`, `.tenet/cache/**`, `.tenet/runs/**`, and generated report files under `.tenet/reports/` matching `checks[].report_path` or `test.xml|test.json|junit.xml|ctrf.json|go-test.json|go-test-json.json|jest.json|jest-json.json`, verified by `lstat` confinement without traversing symlinks), and any created file (including local wrappers Tenet created) or managed directory left empty, reporting each deleted working-state file in `removed` (`kind: "file"`)
  - never touches specifications, records, `.tenet/onboard/interview.json`, or any custom user-written file inside or outside `.tenet/`
- Fixtures: interruption after each write; a pre-existing `AGENTS.md` and `.mcp.json` are restored exactly; an edited `tenet.yaml` is kept; a key the user changed after install is kept.

## 3. Onboarding measures (ALG-13)

- **A statement** is one requirement line, or one sentence in a vision, design, experience or plan section.
- **Kept:** its text, with whitespace collapsed and the `{…}` metadata removed, is identical in the drafted text and the blessed text. Anything else is a substantive edit. Adoptions (`inferred` -> `asked`) with unchanged text count in both `kept` and `adopted`; deleted drafted statements count in `edited` (`kept + edited === drafted`). `bless` computes this per finished section, comparing with the section's text at `drafted_at_rev`, the commit holding the agent's draft (still on the branch when blessing happens), and writes it to `<records>/blessed/log.jsonl` (**proposal · CP-0066 AB-A5:** `minutes` tracks elapsed review time for that section). Without `drafted_at_rev` (or if unreachable in a shallow clone after squash merge) `statements` records all five counts as `null`, never computed against later text.
- **Denominator:** statements in sections blessed or rejected (`action === "defer"` still writes a log row, excluded from `ALG-13` scoring).
- **Recall:** answer-key obligations matched by a kept or edited statement, judged by a human scorer.
- **Invented:** statements the scorer finds in neither the sources nor the answer key.
- **Blessing minutes (proposal · CP-0066 AB-A5):** sum per-section review minutes in the log.
- **Automatic checks:** every citation resolves; every planted conflict in the fixture key appears as a `CF` item; every `asked` statement has an answer in `.tenet/onboard/interview.json` (fixtures only).
- **Each run records** agent, model, effort and fixture revision.

## 4. Release procedure

Each alpha is an `ops` work item:
1. Bump the version; write the changelog with structured fields (`kind: rule-added|rule-clarified|field-added|breaking`).
2. `npm pack` **once** per workspace package, record each `.tgz` digest, and assert each tarball's file list (no `pkg/evals`).
3. Install those files on clean Windows, macOS and Linux, and run both UX Part 1 journeys and the scenario suite.
4. Publish **the same files** with `--provenance --tag next` through trusted publishing. The first publish of a new package may use a short-lived granular token. If one package publishes and the other fails, the release is retried with the same version.
5. Create a GitHub release with the tarballs, the kit archive and `SHA256SUMS`.
6. Install from the registry and compare the bytes.
7. Update and tag `tenet-starter`.
