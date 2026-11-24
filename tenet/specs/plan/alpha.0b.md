# Tenet plan: 0.1.0-alpha.0 build contracts, waves A0-4 to A0-8

> Level L2 · Version 0.13 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval; frozen by CP-0015** · Budget: 6,000 tokens · Split from `plan/alpha.0.md` under the rollover rule (L-0027)

**Context card.** The second half of the alpha.0 build contracts, and the release. The references and the "every contract also means" list in [alpha.0.md](alpha.0.md) apply here unchanged.

## A0-4

**CP-0009 · Check, fix and split** · R-008, R-033, R-038, R-054 (lock mismatch), R-219
1. *Needs:* CP-0044; TS §9–§10; C §1, §8, §13; ALG-02 (rename), ALG-03 (integrity, relocation).
2. *Owns:* `src/specs/{check,fix,split}.ts`, the commands `check`, `fix`, `split` with their result schemas, `kit/hooks/pre-commit`, `test/check/`.
3. *Exports:* `check({paths?, pack?, ci?, base?}) → {findings, summary: {errors, warnings, advises}}`; `fix({dryRun}) → {changes}`; `split(doc, section)`.
4. *Behavior:*
   - **Findings** (sorted by `file ?? ""`, numeric `line ?? 0`, `code`, `message`): required files (`tenet.yaml`; `<records>/intent.md` in one-file layout else every `policy.specs.documents` path, missing → `TN-SCHEMA`; `tenet.lock` and vendored `kit_path` when `kit_path !== "kit"`), schemas, links and anchors, citations (`file: doc.path`), origin present, section states and flags, blessed-copy integrity (`TN-SPEC-BLESSED-COPY`, `file: doc.path`, `line`: heading line), unique IDs across `ladder` order (`TN-SPEC-DUP-ID` on each later duplicate's `file` and `line`), vision coverage (`TN-SPEC-UNCOVERED-VISION`, TS §6.3), budgets (`TN-BUDGET-WARN` locally at `≥ Math.ceil(limit * 0.9)`; `TN-BUDGET` with `--ci --base` when `head > limit` and `base <= limit`), kit integrity (`TN-KIT-EDITED`, `file: "tenet.lock"`), and package version vs lock (`TN-LOCK-MISMATCH`, `file: "tenet.lock"`, coexisting with `TN-KIT-EDITED`). `--paths` scopes per-document checks and skips cross-document and lock/kit checks.
   - **Exit codes** follow C §13: `budget` is a rule finding only with `--ci --base` on a change that crosses 100%.
   - **`fix`:** assigns IDs (C §1), numbers `V-` items, writes front matter, section entries, digests and `drafted_from`, moves renamed entries and copies, updates uniquely relocated anchors, and normalizes citation paths. It never changes meaning, states or blessings.
   - **`split`:** moves a section into a part, leaving a pointer and updated links.
   - The hook warns and never blocks.
5. *Edge cases:* `fix` twice changes nothing; two branches both assigning `R-40` (`fix` renumbers the newer unblessed one; if both are blessed, `check` reports it).
6. *Out of scope:* event and alias checks (CP-0007).
7. *Fixtures:* `test/check/<code>/`, one violation each; a generated 500-document repository for R-082.
8. *Proving:* `npm test -- test/check`: each fixture yields exactly its finding; `fix` repairs every mechanical one; R-082 timing holds with git calls batched.

**CP-0045 · Agent context and MCP** · R-049, R-211
1. *Needs:* CP-0044; C §9; ALG-10.
2. *Owns:* `src/context/`, `src/mcp/`, the commands `context` and `mcp` with their result schemas, `test/context/`, `test/mcp/`.
3. *Exports:* `context(input) → {blessed, drafts, index, omitted, truncated, rules}`; `serveMcp(io)`.
4. *Behavior:* ALG-10 and C §9 exactly, reading blessed copies; `rules` lists the five alpha.0 pack rules with their effective capped modes; when nothing is blessed, human CLI and MCP `content[0].text` print `"nothing blessed yet; run tenet bless"` while keeping the 6-key JSON result; a blessed copy failing integrity emits `TN-SPEC-BLESSED-COPY` (in CLI `--json` `errors[]` and human/MCP text) and is served in `drafts` (`integrity_failed: true`); `tenet_status` gives the level and spec states; `tenet_next` gives the pending blessings; `tenet_propose` writes into the named work item's packet folder.
5. *Edge cases:*
   - nothing blessed ("nothing blessed yet; run tenet bless")
   - global rules over their reserved share; an item asked for by ID that alone exceeds the budget (`over_budget`)
   - a blessed copy failing integrity (served as a draft)
   - notifications get no reply; stdout carries only protocol messages
6. *Out of scope:* writing host entries (CP-0010).
7. *Fixtures:* `pkg/conformance/alg-10/`, including "retry once".
8. *Proving:* `npm test -- test/context test/mcp`; a scripted session matches its golden transcript; the pinned MCP Inspector CLI lists and calls every tool on Windows, macOS and Linux, through both the committed entry and the Windows local form.

**CP-0053 · Specification board** · R-032 (alpha.0 part)
1. *Needs:* CP-0044, CP-0018; C §5.
2. *Owns:* `src/views/specs-board.ts`, the `board` command and its result schema, `kit/schemas/board.json` (adding `spec_debt` and optional `recorded` on unblessed `specs[]`), `test/views/`.
3. *Exports:* `board({all}) → board.json` with `as_of`, `read`, `specs`, `pending_blessings`, `spec_debt`.
4. *Behavior:* reads the working tree (`board.json` always holds the full arrays in `ladder`/section order; `--all` adds `Blessed (<n>)` to the rendered text). `pending_blessings` holds `draft` sections plus `blessed` sections flagged `edited` or `sources-changed`. **Spec debt** is `{kind: broken-citation|untested-requirement|over-budget, path, id: string|null, message}` (`broken-citation` across `blessed`/`draft`/`deferred` sections, `"<Heading> cites <target>, which no longer exists"`; `untested-requirement` across `blessed` requirements via `scanTests`, `"<Heading> › <id> has no tagged test"`; `over-budget` when `Math.ceil(chars / 4) > limit`, `"<path> is over its token budget (<tokens> > <limit> tokens)"`). The LF-terminated view matches UX Part 2 lines 151–158 (`<repo> · <branch> <7-char-commit> · level <level>`, then non-empty groups `Waiting for your blessing (<n>)`, `Sources changed (<n>)`, `Edited (<n>)`, `Spec debt (<n>)`, and with `--all` `Blessed (<n>)`, two-space indented; when all displayed groups are empty, `"All blessed specifications are current."`).
5. *Edge cases:* no specifications (`"No specifications found · run tenet onboard"`).
6. *Out of scope:* work items, `--open`, `--since`, `--fetch` (CP-0008).
7. *Fixtures:* fresh drafts; half blessed; blessed with sources changed; spec debt of each kind; the UX Part 2 example.
8. *Proving:* golden `board.json` and markdown byte-identical on three platforms.

## A0-5

**CP-0048 · Onboarding inventory and assignment** · R-021, R-027, R-223 (preflight, inventory, units, assignment, refresh), R-225 (instruction files)
1. *Needs:* CP-0009, CP-0012, CP-0018; OB §1; C §4; ALG-11.
2. *Owns:* `src/onboard/{preflight,inventory,findings,assignment,refresh}.ts`, the `onboard` command (without `--card`) and its result schema, `test/onboard/`.
3. *Exports:* `onboard({inventoryOnly, refresh, layout}) → {preflight: {revision, read_count, skipped_count, dirty_warning}, inventory, findings, assignment}`.
4. *Behavior:*
   - **Preflight:** text as UX Part 1; returns `{revision, read_count: sources.files.length, skipped_count: sources.skipped.length, dirty_warning}`.
   - **Inventory:** its first findings (sorted by `kind` order `dead-path`, `skipped-tests`, `owners-unmatched`, `no-test-report`, then `path`, then `message`, with the templates in OB §1; top-level `findings` equals `inventory.findings`), project kind, `sources.skipped` reasons (`env|credentials|vendored|generated|excluded|binary|oversize`), units (`one-file`: `[{id: "root", paths: ["."], views}]`; `separate`: CODEOWNERS areas else top-level source folders, merging `< 2,000`-line units into their preceding neighbor, or following neighbor at index `0`) and output paths (`assignment.inventory = ".tenet/onboard/inventory.json"`) exactly as OB §1 and ALG-11. Test declarations and skips come from CP-0018's `scanTests`; doc dates come from one `lastChangedMap` call.
   - **Instruction files:** listed with kind `instructions` (OB §1).
   - **Inputs:** repository facts are byte-identical for one commit, and report data goes only in `observations`. `tenet.yaml` is read from the working tree.
   - **Refresh:** keeps IDs, edits, rejections and blessings, and assigns only units whose sources changed since `drafted_at_rev`.
5. *Edge cases:* no commit (`TN-ENV-NO-COMMIT`); uncommitted changes; a monorepo; not a git repository (exit 3); `onboard` run twice.
6. *Out of scope:* drafting (the user's agent); blessing and the card (CP-0052).
7. *Fixtures:* `test/onboard/{empty,node-service,python-lib,go-cli,monorepo}`.
8. *Proving:* inventories byte-identical on three platforms; no skipped file in `sources`; layouts and units match ALG-11.

**CP-0051 · Test job, recorder and card** · R-218, R-103, R-146, R-034 (part)
1. *Needs:* CP-0006, CP-0009, CP-0018; CI §1–§4, §10; C §5; ALG-07 (alpha.0: every rule in `advise`), ALG-14.
2. *Owns:*
   - `src/verify/{run-checks,bundle,record,card,records,forge}.ts`, where `forge.ts` is a `ForgeAdapter` (`findPullRequests`, `getPullRequest`, `upsertCheckRun`, `downloadBundles`) with a GitHub implementation
   - `verify --run-checks`, `--bundle` and `--record`, with their result schema
   - `kit/workflows/{tenet-tests.yml,tenet.yml,existing-ci-step.yml}`, `pkg/conformance/cards/`, `test/verify/`
3. *Exports:* `runChecks(policy) → bundle`; `record(event) → {card, conclusion, wrote}`; `renderCard(model) → markdown`.
4. *Behavior:* CI §2–§4 step for step: finding the pull request (forks and shared heads included), `refs/pull/<n>/*` fetches, bundle limits and matrix merging, keyed runs with a forward-only `latest`, and plumbing writes. The card model and order are C §5, built from `parseAcceptance`, `itemResults`, `weakening`, `touched`, `deltas`, `check` and the five alpha.0 rules (`card.rules` holds only rules with `would_block === true`, in pack order). The forge conclusion and `card.degraded` strings follow CI §10. `evaluation_id` is per C §1. It reports blessings changed and whether the test workflow differs from the target's. `renderCard(model)` produces exact LF-terminated Markdown matching UX Part 1A lines 102–111:
   - Header: `### Tenet proof · <tested.commit.slice(0, 6)> (<merge candidate|head>) · <advisory|verified on CI|advisory · intent not yet blessed>`.
   - `Your intent this change touches` (when `requirements.length > 0`; `requirements[].tests` counts only declarations tagged with that requirement's ID in `declared.requirement`, never `[AB-n]` alone): `  <id> <state> · "<excerpt>" · <why> · <n> tagged test(s) <passed|failed|not run>` for non-`same-area`, then `  <ids.join(", ")> blessed · may be affected (same area)`.
   - `Acceptance`: `  ! no acceptance items · add the block from the template` when `items.length === 0`; else per item `  ✓ <id> · test passed on this commit · <written in this change|tag added here|existing test> · <names.join(", ")>` (`passed`), `  ✗ <id> · test failed on this commit · <authorship> · <first_failure>` (`failed`), `  ! <id> · no test · nothing tagged [<id>]` (`no-test`), `  ! <id> · skipped · <names.join(", ")>` (`skipped`), `  ! <id> · coverage not confirmed · <passed>/<expected> tagged tests ran` (`not-run` with `passed > 0`), or `  ! <id> · not run · <expected> tagged test(s) did not run` (`not-run` with `passed === 0`).
   - Summary line: `Tests <passed> passed[, <failed> failed, <skipped> skipped] | not checked (report <missing|malformed>) · ✓ no weakening detected by these checks[(not checked: <langs>)] | ! weakening detected: <finding in file (names)>[ (not checked: <langs>)] · ✓ no protected files touched | ! protected files touched: <paths>[ (test workflow changed)]`.
   - Optional lines (when non-empty): `Blessings changed: <doc>#<section> blessed by <blessed_by> (committed by <commit_author>)`; `Spec deltas: <doc> (+<added> ~<modified> -<removed>)`; `Would have blocked: <reasons joined by " · ">`; `Degraded: <degraded joined by " · ">`; `Why: <text [class] joined by " · ">`.
5. *Edge cases:*
   - **Card inputs:** no or empty acceptance block; a description edit on the same commit (reuses the bundle); no blessed specifications (badge `intent-not-yet-blessed`).
   - **Test results:** a failing check; a missing report; an expired bundle; a refused bundle (`TN-RECORD-BUNDLE`).
   - **Forge:** a fork; two pull requests sharing a head; an older run finishing last; the summary over the size limit.
6. *Out of scope:* decisions, signing, board publishing.
7. *Fixtures:* `workflow_run`, `edited` and `push` payloads; the fake forge from `test/helpers/`; golden cards (`pkg/conformance/card/`, with `bundle.json`-conformant `bundles` and the 8-key `evaluation_input` tuple); one per CI §10 row.
8. *Proving:* `npm test -- test/verify`. Then on `vedprakash-m/tenet-sandbox`, through both Tenet's test workflow and the existing-CI step (a console-only job with the reporter edit, and a two-shard matrix):
   - a tagged declaration removed from discovery gives `not run`
   - a deleted test is reported
   - editing `Implements:` re-evaluates
   - a fork gets the full card
   - five concurrent writes lose no record

**CP-0054 · This repository's specifications, prepared** · R-210 (this repository) · a `spec` packet; each document's change is approved by its owner
1. *Needs:* CP-0009; C §3; OB §1.
2. *Owns:* front matter and requirement metadata for `tenet/vision.md` and `tenet/specs/**`; the Status column's removal (R-210).
3. *Exports:* none.
4. *Behavior:* convert the tables to the table form (OB §1), add origins and citations, run `tenet fix`, and get `check` to report no structural finding.
5. *Edge cases:* a requirement with no source (origin `asked`); budgets near 90%.
6. *Out of scope:* blessing (CP-0057); changing any requirement's meaning.
7. *Fixtures:* none beyond this repository.
8. *Proving:* `tenet check --json` on this repository lists no structural finding and no `citations-valid` finding.

## A0-6

**CP-0010 · Init, upgrade, remove** · R-020, R-022, R-023, R-024, R-025, R-051, R-221, R-222, R-225 (rules in the block, Copilot pointer)
1. *Needs:* CP-0045, CP-0048, CP-0051 (its workflow templates, loaded through the kit, never imported); OB §2; C §6, §10; CI §2–§3; AG §1; ALG-12.
2. *Owns:* `src/install/` (with `hosts.ts`, a list of `HostDescriptor` entries: `detect`, `planWrites`, `capabilityLevel`), the commands `init`, `upgrade`, `remove`, `doctor` with their result schemas, `examples/starter/` (the `tenet-starter` contents), `test/install/`.
3. *Exports:* `init({yes, vendor, force}) → {plan, wrote, findings, cancelled?}`, `upgrade() → {from, to, changed: [{path, action: created|replaced|kept}]}`, `remove() → {removed: [{path, kind: file|block|key}], kept: [{path, reason: edited-by-you|spec-or-records}], reminder}`, `doctor() → {checks: [{name: node|git|ssh|gh|lock|workflows, ok, detail}]}`.
4. *Behavior:*
   - **Preflight:** as UX Part 1, with the host capability level (`skills+mcp|mcp|instructions`, R-222) and where the tests will run (`ci_mode: existing-ci|tenet-workflow|none`, `ci_reason` per CI §2). Declining preflight writes nothing and exits 0 (`cancelled: true`).
   - **Writes (ALG-12, confined to the repository; static `TN-PATH-ESCAPE` and `TN-INIT-EXISTS` checks run before writing `.tenet/manifest.pending.json`):**
     - `tenet.yaml` at `observe` with synthesized check `checks.test`, runner command and shell `run:` setup (C §6, CI §2)
     - the lock, with `integrity` from the registry and `kit_sha256` over `kit/`
     - on GitHub remotes, the recorder workflow, plus the chosen test path (Tenet's workflow, or the marked step with synthesized `id: tenet-tests` and consented reporter edit; `--yes` without reporter consent or reusable workflows fall back to `tenet-workflow`); on non-GitHub remotes, omit `.github/**` (`ci_mode: "none"`)
     - the `AGENTS.md` block with the working rules `agents.working_rules` selects, the pull-request template block (GitHub), `.gitignore` and `.gitattributes` blocks (preserving outside CRLF bytes)
     - host entries (`.mcp.json`, `.cursor/mcp.json`, `.vscode/mcp.json` always use portable `npx -y @vedprakash-m/tenet@<locked> mcp`; Windows `cmd /c` forms go in local host settings tracked in `local_keys`, C §10 / OB §2)
     - owners (`id` stripped of `@` and lowercased, OB §2), then `.tenet/manifest.json` (recording `previous_block`/`prefix_sep` and `previous_raw` for byte-exact `remove`)
   - **After writing:** prints the first findings and offers onboarding. An empty repository asks purpose and kind (with `--yes`: kind `other`, purpose `"Undecided · edit or run tenet onboard"`, seeding `tenet/intent.md` and finding `no-test-report`).
   - **Other commands:** `upgrade` per OB §2, rewriting the pinned version in every owned repo and local entry while preserving `tenet.yaml`; `remove` per ALG-12, retiring `.tenet/manifest*.json` and printing the branch-rule reminder; `doctor` checks `node`, `git` (missing git executable emits `TN-ENV-GIT` with `found: "not installed"`, exit 3), `ssh` (optional), `gh` (optional), `lock` (`TN-LOCK-MISSING` / `TN-LOCK-INVALID` / `TN-KIT-EDITED` / `TN-KIT-MISSING`, exit 1) and `workflows`.
5. *Edge cases:*
   - **Existing files:** an `AGENTS.md` block or pull-request template; `.mcp.json` with other servers.
   - **Interruption and repeats:** interrupted after each write; `init → init → upgrade → remove`; `--vendor` then a fresh clone.
   - **Environment:** no git (exit 3); a forge other than GitHub (no card, said plainly); a CI job using services or a reusable workflow; a path escaping the repository (`TN-PATH-ESCAPE`).
6. *Out of scope:* `level`, `rules` (CP-0050); scheduled upgrades (M4).
7. *Fixtures:* `test/install/{empty,node-vitest,node-existing-ci,node-matrix,python-pytest,go,existing-agents-md,existing-mcp}`.
8. *Proving:* a second `init` changes nothing; `remove` restores every fixture byte for byte and keeps a key the user changed; first findings appear within ten minutes on Torus and on an empty repository.

## A0-7

**CP-0052 · Blessing, onboarding card, evaluation and scenarios** · R-223 (bless, card), R-012 (drafter evaluation)
1. *Needs:* CP-0010; ALG-03, ALG-13; OB §1; AG §1–§2.
2. *Owns:* `src/onboard/{bless,card}.ts`, the `bless` command and its result schema, `onboard --card`, `pkg/evals/onboarding/` (repository only, never published), `pkg/conformance/scenarios/`, `test/onboard/bless/`.
3. *Exports:* `bless({doc?, section?}) → {blessed, confirmed, rejected, deferred, minutes}`; `onboardingCard() → markdown` (it also records `drafted_at_rev`).
4. *Behavior:* ALG-03's session (conflicts first; bless, confirm, edit, reject, defer); version bumps; the anchors file; the log line (ALG-13); the card per OB §1 and its golden examples.
5. *Edge cases:* no terminal (exit 2); an inferred statement left; an open conflict; a conflict choice that contradicts a statement; interruption keeps finished sections; re-blessing an edited section; `confirm` after a squash from a shallow clone.
6. *Out of scope:* forge blessing (alpha.1).
7. *Fixtures:*
   - **The evaluation suite** (never read by agents under test):
     - ≥4 repositories: a Node service, a Python library, a Go CLI, and one with docs and ADRs
     - each has a `key.json` with obligations and their sources, planted conflicts (a stale README, an ADR against a test, an inactive flag, a roadmap issue) and scripted answers
     - scoring: ALG-13's automatic checks and kept ratio; recall and invented scored by a person who did not run the agent, with a second scorer on 20%
     - **fresh-session check:** bless "retry once", change the code to retry twice, then ask a fresh agent session that has only the installed `AGENTS.md`, skills and MCP to change the retry code; it passes if the agent works from "retry once" and reports the drift
   - **The scenario suite** (`pkg/conformance/scenarios/`), run against the CLI, SDK, MCP and card:
     - a tagged test that never ran
     - `Implements:` changed on the same commit
     - an advisory and an enforced failure together (ALG-07, as a fixture)
     - rejecting an edit to a blessed section
     - a global rule under budget pressure
     - a change to a shared helper
     - an install interrupted part-way
     - blessing in a fresh clone after a squash merge
     - a renamed heading
     - a pull request closed without merging (nothing beyond its last evaluation is recorded)
     - the README and UX walkthroughs run verbatim
8. *Proving:* `npm test -- test/onboard`, using `fakeTty`; `npm run eval:onboarding -- --agent <name>` writes a scored report, which passes on the two agents CP-0058 names; `npm run scenarios` passes.

## A0-8

**CP-0057 · This repository's specifications, blessed** · R-210 (this repository) · the Owner's act
1. *Needs:* CP-0052, CP-0054.
2. *Owns:* the blessing fields, `blessed/` copies and log for this repository's specifications.
8. *Proving:* the Owner blesses every section with `tenet bless`; `tenet check --json` then lists no finding of any kind except those the Owner deferred by name.

**Release 0.1.0-alpha.0** (an `ops` work item): CI §9's release procedure; CP-0016's unaided maintainer sessions on the release candidate; then the M1 alpha.0 gate in [plan §1](../plan.md#1-milestones).
