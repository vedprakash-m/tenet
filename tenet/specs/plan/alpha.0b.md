# Tenet plan: 0.1.0-alpha.0 build contracts, waves A0-5 to A0-8

> Level L2 · Version 0.13 · Part of [plan.md](../plan.md) · Status: **draft, awaiting the Owner's approval; frozen by CP-0015** · Budget: 6,000 tokens · Split from `plan/alpha.0.md` under the rollover rule (L-0027)

**Context card.** The second half of the alpha.0 build contracts, and the release. The references and the "every contract also means" list in [alpha.0.md](alpha.0.md) apply here unchanged.

## A0-5

**CP-0048 · Onboarding inventory and assignment** · R-021, R-027, R-223 (preflight, inventory, units, assignment, refresh), R-225 (instruction files)
1. *Needs:* CP-0009, CP-0012, CP-0018; OB §1; C §4; ALG-11.
2. *Owns:* `src/onboard/{preflight,inventory,findings,assignment,refresh}.ts`, the `onboard` command (without `--card`) and its result schema, `test/onboard/`.
3. *Exports:* `onboard({inventoryOnly, refresh, layout}) → {preflight, inventory, findings, assignment}`.
4. *Behavior:*
   - **Preflight:** text as UX Part 1.
   - **Inventory:** its first findings, project kind, units and output paths exactly as OB §1 and ALG-11. Test declarations and skips come from CP-0018's `scanTests`; doc dates come from one `lastChangedMap` call.
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
4. *Behavior:* CI §2–§4 step for step: finding the pull request (forks and shared heads included), `refs/pull/<n>/*` fetches, bundle limits and matrix merging, keyed runs with a forward-only `latest`, and plumbing writes. The card model and order are C §5, built from `parseAcceptance`, `itemResults`, `weakening`, `touched`, `deltas`, `check` and the five alpha.0 rules. The forge conclusion follows CI §10. `evaluation_id` is per C §1. It reports blessings changed and whether the test workflow differs from the target's.
5. *Edge cases:*
   - **Card inputs:** no or empty acceptance block; a description edit on the same commit (reuses the bundle); no blessed specifications (badge `intent-not-yet-blessed`).
   - **Test results:** a failing check; a missing report; an expired bundle; a refused bundle (`TN-RECORD-BUNDLE`).
   - **Forge:** a fork; two pull requests sharing a head; an older run finishing last; the summary over the size limit.
6. *Out of scope:* decisions, signing, board publishing.
7. *Fixtures:* `workflow_run`, `edited` and `push` payloads; the fake forge from `test/helpers/`; golden cards; one per CI §10 row.
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
3. *Exports:* `init({yes, vendor, force})`, `upgrade()`, `remove()`, `doctor()`.
4. *Behavior:*
   - **Preflight:** as UX Part 1, with the host capability level (R-222) and where the tests will run (CI §2's rule, with the reason).
   - **Writes (ALG-12, confined to the repository):**
     - `tenet.yaml` at `observe` with the runner command and setup (C §6, CI §2)
     - the lock, with `integrity` from the registry
     - the recorder workflow, plus the chosen test path (Tenet's workflow, or the marked step and reporter edit)
     - the `AGENTS.md` block with the working rules `agents.working_rules` selects, the pull-request template block and the `.gitignore` block
     - host entries, with Windows local forms in local settings (C §10)
     - owners (OB §2), then the manifest
   - **After writing:** prints the first findings and offers onboarding. An empty repository gets two questions and `tenet/intent.md`; with `--yes`, kind `other`.
   - **Other commands:** `upgrade` per OB §2, rewriting the pinned version in every owned entry; `remove` per ALG-12 with the branch-rule reminder; `doctor` checks Node, git, OpenSSH, `gh`, the lock and the workflows.
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
